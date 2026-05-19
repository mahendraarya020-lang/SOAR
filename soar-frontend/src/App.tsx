import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Wifi,
  WifiOff,
  Server,
  RefreshCw,
  Database,
  Terminal,
  Clock,
  Skull,
  CheckCircle2,
  HardDrive
} from 'lucide-react';

interface Endpoint {
  id: number;
  name: string;
  ip_address: string;
  status: 'Active' | 'Suspicious' | 'Isolated';
  created_at: string;
  updated_at: string;
}

interface ThreatAlert {
  logId: number;
  endpointId: number;
  parsedData: {
    ip_address: string;
    timestamp: string;
    method: string;
    path: string;
    status_code: number;
  };
  status: string;
  analysis: {
    is_threat: boolean;
    attack_type: string;
    summary: string;
  };
  timestamp: string;
}

const BACKEND_URL = 'http://localhost:5000';

function App() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [alerts, setAlerts] = useState<ThreatAlert[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reconnectingId, setReconnectingId] = useState<number | null>(null);
  const [rawLogInput, setRawLogInput] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  // Fetch all endpoints from PostgreSQL
  const fetchEndpoints = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/v1/endpoints`);
      setEndpoints(response.data);
    } catch (err) {
      console.error('Failed to fetch endpoints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEndpoints();

    // Setup Socket.io client connection
    const socket: Socket = io(BACKEND_URL);

    socket.on('connect', () => {
      console.log('📡 Connected to SOAR WebSocket server');
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from SOAR WebSocket server');
      setSocketConnected(false);
    });

    // Listen to real-time threat alert events
    socket.on('threat_alert', (alertData: any) => {
      console.log('🚨 Received threat alert:', alertData);
      
      const newAlert: ThreatAlert = {
        ...alertData,
        timestamp: new Date().toLocaleTimeString()
      };

      setAlerts((prev) => [newAlert, ...prev]);
      
      // Auto-refresh endpoints lists to reflect automatic status change
      fetchEndpoints();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Restore isolated node back to Active
  const handleReconnect = async (id: number) => {
    setReconnectingId(id);
    try {
      await axios.post(`${BACKEND_URL}/api/v1/endpoints/${id}/reconnect`);
      // Update local state instantly
      setEndpoints((prev) =>
        prev.map((ep) => (ep.id === id ? { ...ep, status: 'Active' } : ep))
      );
      
      // Clear any alerts for this endpoint or just add a recovery notification
      console.log(`Endpoint ${id} reconnected successfully.`);
    } catch (err) {
      console.error('Failed to reconnect endpoint:', err);
    } finally {
      setReconnectingId(null);
    }
  };

  // Trigger Nginx Log Ingestion (Simulate Attack / Log Activity)
  const handleIngestLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawLogInput.trim()) return;

    setIngesting(true);
    setIngestSuccess(null);
    setIngestError(null);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/v1/logs/ingest`, {
        raw_log: rawLogInput
      });

      setIngestSuccess(`Log Ingested! ID: ${response.data.log_id}. Queueing for AI threat check...`);
      setRawLogInput('');
      fetchEndpoints(); // Auto-refresh in case auto-discovery registers a new endpoint
      
      // Clear success notification after 5s
      setTimeout(() => setIngestSuccess(null), 5000);
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Failed to ingest log';
      setIngestError(errMsg);
    } finally {
      setIngesting(false);
    }
  };

  // Helper template logs to easily test the app
  const injectSampleLog = (type: 'attack' | 'normal' | 'discovery') => {
    const randomIP = `192.168.1.${Math.floor(Math.random() * 200) + 10}`;
    const timestamp = '19/May/2026:18:15:00 +0700';
    
    if (type === 'attack') {
      // Attacks static IP or random IP
      setRawLogInput(`192.168.1.50 - - [${timestamp}] "GET /etc/passwd HTTP/1.1" 403 12`);
    } else if (type === 'discovery') {
      setRawLogInput(`${randomIP} - - [${timestamp}] "POST /wp-admin/index.php HTTP/1.1" 401 512`);
    } else {
      setRawLogInput(`192.168.1.50 - - [${timestamp}] "GET /api/v1/health HTTP/1.1" 200 45`);
    }
  };

  const isolatedCount = endpoints.filter(ep => ep.status === 'Isolated').length;
  const activeCount = endpoints.filter(ep => ep.status === 'Active').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/30 text-rose-500 animate-pulse">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                API SOAR <span className="text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded">PHASE 4</span>
              </h1>
              <p className="text-xs text-slate-400">AI-Powered Security Orchestration Dashboard</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-slate-850 px-3 py-1.5 rounded-full border border-slate-800 text-xs">
              <Activity className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
              <span className="text-slate-300">SOAR Core:</span>
              <span className="text-emerald-400 font-semibold">Active</span>
            </div>

            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-300 ${
              socketConnected 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              {socketConnected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 animate-pulse" />
                  <span>WebSocket Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  <span>WebSocket Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Side: System Control & Monitoring */}
        <div className="flex-1 flex flex-col gap-8">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-lg">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Total Endpoints</p>
                <h3 className="text-2xl font-bold mt-1 text-white">{endpoints.length}</h3>
              </div>
              <div className="p-3 bg-slate-800 rounded-lg text-slate-300">
                <Server className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-lg">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Active Assets</p>
                <h3 className="text-2xl font-bold mt-1 text-emerald-400">{activeCount}</h3>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-lg">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Isolated Assets</p>
                <h3 className="text-2xl font-bold mt-1 text-rose-500">{isolatedCount}</h3>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-lg text-rose-500 border border-rose-500/20">
                <Skull className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Endpoints Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-5 w-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Monitored Assets</h2>
              </div>
              <button 
                onClick={fetchEndpoints}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Refresh Assets"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 text-rose-500 animate-spin" />
                <span className="ml-3 text-slate-400 text-sm">Loading security nodes...</span>
              </div>
            ) : endpoints.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-850 rounded-lg">
                <p className="text-slate-400 text-sm">No monitored endpoints found in PostgreSQL.</p>
                <p className="text-xs text-slate-500 mt-1">Ingest Nginx logs to auto-discover active assets!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {endpoints.map((ep) => (
                  <div
                    key={ep.id}
                    className={`p-4 rounded-xl border transition-all duration-300 ${
                      ep.status === 'Isolated'
                        ? 'bg-rose-950/20 border-rose-500/30 shadow-rose-950/20 shadow-md'
                        : ep.status === 'Suspicious'
                        ? 'bg-yellow-950/10 border-yellow-500/30'
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          ep.status === 'Isolated' 
                            ? 'bg-rose-500/20 text-rose-400' 
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          <Server className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{ep.name}</h4>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{ep.ip_address}</p>
                        </div>
                      </div>

                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                        ep.status === 'Isolated'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                          : ep.status === 'Suspicious'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {ep.status}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs text-slate-400">
                      <span>Updated: {new Date(ep.updated_at).toLocaleTimeString()}</span>
                      
                      {ep.status === 'Isolated' && (
                        <button
                          onClick={() => handleReconnect(ep.id)}
                          disabled={reconnectingId === ep.id}
                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-bold rounded shadow-md shadow-emerald-950/20 flex items-center space-x-1.5 transition-all text-xs"
                        >
                          <RefreshCw className={`h-3 w-3 ${reconnectingId === ep.id ? 'animate-spin' : ''}`} />
                          <span>Reconnect Node</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Log Simulator Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="flex items-center space-x-2 mb-4">
              <Terminal className="h-5 w-5 text-rose-500" />
              <h2 className="text-lg font-bold text-white">Log Ingestion Simulator</h2>
            </div>
            
            <form onSubmit={handleIngestLog} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-semibold uppercase mb-1.5">
                  Raw Nginx Log
                </label>
                <textarea
                  value={rawLogInput}
                  onChange={(e) => setRawLogInput(e.target.value)}
                  placeholder="Paste a raw Nginx standard access log here..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono text-cyan-400 focus:outline-none focus:border-rose-500/50 transition-colors placeholder:text-slate-700 resize-none"
                />
              </div>

              {ingestSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{ingestSuccess}</span>
                </div>
              )}

              {ingestError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs flex items-center space-x-2">
                  <Skull className="h-4 w-4" />
                  <span>{ingestError}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => injectSampleLog('attack')}
                    className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/20 hover:border-rose-500/50 text-rose-400 text-xs rounded transition-colors"
                  >
                    Simulate Threat Log
                  </button>
                  <button
                    type="button"
                    onClick={() => injectSampleLog('discovery')}
                    className="px-2.5 py-1.5 bg-yellow-950/20 hover:bg-yellow-900/20 border border-yellow-500/20 hover:border-yellow-500/50 text-yellow-400 text-xs rounded transition-colors"
                  >
                    Auto-Discover Asset Log
                  </button>
                  <button
                    type="button"
                    onClick={() => injectSampleLog('normal')}
                    className="px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs rounded transition-colors"
                  >
                    Simulate Normal Log
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={ingesting || !rawLogInput.trim()}
                  className="px-5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded shadow-lg shadow-rose-950/20 transition-all text-xs"
                >
                  {ingesting ? 'Ingesting...' : 'Ingest Log'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Side: Live Threat Intelligence Feed */}
        <div className="w-full lg:w-96 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <h2 className="text-sm font-bold tracking-wider uppercase text-white">Live Threat Intelligence Feed</h2>
            </div>
            <span className="text-xs text-rose-500 font-mono font-bold bg-rose-500/10 px-2 py-0.5 border border-rose-500/20 rounded">
              REAL-TIME
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[700px] lg:max-h-[850px] min-h-[400px]">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center text-slate-600">
                <ShieldCheck className="h-12 w-12 text-slate-700 mb-3" />
                <p className="text-sm font-semibold">Feed Secure</p>
                <p className="text-xs mt-1 max-w-[200px]">Waiting for real-time WebSocket alerts from Ollama analysis worker.</p>
              </div>
            ) : (
              alerts.map((alert, idx) => (
                <div 
                  key={idx} 
                  className="bg-slate-950 border border-rose-500/20 rounded-xl p-4 flex flex-col space-y-3 shadow-md animate-slide-down border-l-4 border-l-rose-500"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Skull className="h-4 w-4 text-rose-500" />
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-wide">
                        {alert.analysis.attack_type}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-1 text-slate-500 text-[10px]">
                      <Clock className="h-3 w-3" />
                      <span>{alert.timestamp}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-rose-950/20 border border-rose-900/30 rounded-lg text-xs text-rose-200 leading-relaxed font-semibold">
                    {alert.analysis.summary}
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded border border-slate-850">
                    <p className="font-mono text-slate-500 mb-1 border-b border-slate-800 pb-0.5">METRIC LOG DETAILS</p>
                    <p><span className="text-slate-500">Log Reference ID:</span> <span className="text-rose-400 font-mono">#{alert.logId}</span></p>
                    <p><span className="text-slate-500">Target IP Address:</span> <span className="text-slate-200 font-mono">{alert.parsedData.ip_address}</span></p>
                    <p><span className="text-slate-500">HTTP Access:</span> <span className="text-yellow-400 font-mono">{alert.parsedData.method} {alert.parsedData.path}</span></p>
                    <p><span className="text-slate-500">Response Code:</span> <span className="text-red-400 font-mono">{alert.parsedData.status_code}</span></p>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-[10px] text-rose-400 font-semibold bg-rose-950/30 border border-rose-500/20 px-2.5 py-1 rounded">
                    <Database className="h-3.5 w-3.5 animate-spin" />
                    <span>SOAR TRIGGERED: TARGET ISOLATED</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-600">
        <p>© 2026 API SOAR Platform. Built locally and securely using React, Express, BullMQ, Redis, PostgreSQL, and Ollama AI Engine.</p>
      </footer>
    </div>
  );
}

export default App;
