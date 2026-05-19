import { Queue, Worker, Job } from 'bullmq';
import axios from 'axios';
import { pool } from '../config/db';
import dotenv from 'dotenv';
import { getIO } from '../config/socket';

dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const TARGET_MODEL = 'llama3.2:latest';

const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null, // Critical BullMQ setting to prevent crash loops
};

let useMockQueue = false;
let realQueue: Queue | null = null;
let realWorker: Worker | null = null;

// The actual processing logic that is shared by both real worker and mock queue!
async function processLogJob(logId: number, endpointId: number | null, rawLog: string, parsedData: any) {
  console.log(`📥 [SOAR Worker] Processing Log ID ${logId}...`);
  try {
    // 1. Run Ollama AI Threat Analysis
    const analysis = await analyzeLogWithAI(rawLog, parsedData);

    // 2. Save Analysis Results to PostgreSQL
    const updateQuery = `
      UPDATE security_logs 
      SET is_threat = $1, attack_type = $2, summary = $3 
      WHERE id = $4
    `;
    await pool.query(updateQuery, [
      analysis.is_threat,
      analysis.attack_type,
      analysis.summary,
      logId
    ]);

    // 3. Automated Orchestration (SOAR):
    // If threat validation confirms threat, trigger status change to "Isolated"
    if (analysis.is_threat && endpointId) {
      const updateEndpointQuery = `
        UPDATE endpoints 
        SET status = 'Isolated', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `;
      await pool.query(updateEndpointQuery, [endpointId]);
      console.log(`🛡️ [SOAR Containment] Endpoint ID ${endpointId} has been AUTOMATICALLY ISOLATED!`);

      // Emit real-time threat alert event to all connected WebSocket clients
      try {
        getIO().emit('threat_alert', {
          logId,
          endpointId,
          parsedData,
          status: 'Isolated',
          analysis
        });
        console.log(`📡 [WebSocket] Emitted threat_alert for log ${logId}`);
      } catch (wsErr: any) {
        console.warn('⚠️ Could not emit threat_alert WebSocket event:', wsErr.message);
      }
    }

    console.log(`✅ [SOAR Worker] Log ID ${logId} analyzed.`);
  } catch (error: any) {
    console.error(`❌ [SOAR Worker] Failed for Log ID ${logId}:`, error.message);
    throw error;
  }
}

// Exportable logQueue object that automatically switches to Mock Mode
export const logQueue: any = {
  add: async (name: string, data: any) => {
    if (!useMockQueue) {
      try {
        if (!realQueue) {
          realQueue = new Queue('log-analysis-queue', { connection });
          realQueue.on('error', (err) => {
            // Suppress background redis connection logs
            useMockQueue = true;
          });
        }
        return await realQueue.add(name, data);
      } catch (err) {
        console.log('⚠️ Failed to initialize BullMQ Queue. Activating In-Memory Mock Queue Mode.');
        useMockQueue = true;
      }
    }

    // Mock Mode: Run asynchronously using setTimeout to emulate Queue!
    console.log(`📥 [Mock Queue] Queueing log ${data.logId} for asynchronous processing...`);
    setTimeout(async () => {
      await processLogJob(data.logId, data.endpointId, data.rawLog, data.parsedData);
    }, 1500); // 1.5s delay to simulate network/queue queueing beautifully!
    return { id: `mock-job-${Date.now()}` };
  }
};

// Initialize real worker if possible, catch and suppress error to prevent crash loops
try {
  realWorker = new Worker(
    'log-analysis-queue',
    async (job: Job) => {
      const { logId, endpointId, rawLog, parsedData } = job.data;
      return await processLogJob(logId, endpointId, rawLog, parsedData);
    },
    { connection }
  );

  realWorker.on('error', (err) => {
    // Suppress background redis connection logs
    useMockQueue = true;
  });

  realWorker.on('failed', (job, err) => {
    console.error(`⚠️ [Queue Worker] Job ${job?.id} failed with error:`, err.message);
  });
} catch (err) {
  console.log('⚠️ Real Worker initialization skipped due to offline Redis. Mock Worker is active.');
  useMockQueue = true;
}

// Helper to query Ollama via Axios
async function analyzeLogWithAI(rawLog: string, parsedLog: any): Promise<{ is_threat: boolean; attack_type: string; summary: string }> {
  const prompt = `
You are an expert Security Operations Center (SOC) analyst. Analyze this web access log and identify if it is suspicious or malicious.
Raw Log: ${rawLog}
Parsed Details: ${JSON.stringify(parsedLog)}

Respond ONLY with a valid JSON object in the following format (no other text, no markdown formatting, no backticks):
{
  "is_threat": true/false,
  "attack_type": "Brute Force" / "Path Traversal" / "SQL Injection" / "Vulnerability Scanning" / "None",
  "summary": "1-2 sentence explanation of the threat and recommended containment action."
}
`;

  try {
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: TARGET_MODEL,
      prompt: prompt,
      stream: false,
    }, { timeout: 10000 });

    const responseText = response.data.response;
    return parseOllamaJsonResponse(responseText);
  } catch (error: any) {
    console.warn(`⚠️ Ollama AI engine failed for model ${TARGET_MODEL}. Falling back to Rule-Based analysis. Error:`, error.message);
    return getRuleBasedAnalysis(parsedLog);
  }
}

function parseOllamaJsonResponse(text: string): { is_threat: boolean; attack_type: string; summary: string } {
  try {
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.warn('⚠️ Failed to parse JSON response from Ollama. Raw response was:', text);
    const isThreat = text.toLowerCase().includes('true') || !text.toLowerCase().includes('"is_threat": false');
    let attackType = 'Unknown';
    if (text.toLowerCase().includes('brute force')) attackType = 'Brute Force';
    else if (text.toLowerCase().includes('path traversal')) attackType = 'Path Traversal';
    else if (text.toLowerCase().includes('sql injection')) attackType = 'SQL Injection';
    else if (text.toLowerCase().includes('vulnerability scanning')) attackType = 'Vulnerability Scanning';

    return {
      is_threat: isThreat,
      attack_type: attackType,
      summary: 'Potential threat detected by AI analysis. Please review log details.'
    };
  }
}

function getRuleBasedAnalysis(parsed: any): { is_threat: boolean; attack_type: string; summary: string } {
  const suspiciousPaths = ['/wp-admin', '/admin', '/.env', '/etc/passwd', '/config', '/setup', '/actuator'];
  const isSuspiciousPath = suspiciousPaths.some(p => parsed.path.toLowerCase().includes(p));
  const isFailedAuth = parsed.status_code === 401 || parsed.status_code === 403;
  const isServerError = parsed.status_code >= 500;

  if (isSuspiciousPath) {
    return {
      is_threat: true,
      attack_type: 'Vulnerability Scanning',
      summary: `Client attempted to access sensitive path: ${parsed.path}. Recommended to isolate IP.`
    };
  }

  if (isFailedAuth) {
    return {
      is_threat: true,
      attack_type: 'Brute Force',
      summary: `Failed authorization or access forbidden at: ${parsed.path}. Potential brute force.`
    };
  }

  if (isServerError) {
    return {
      is_threat: true,
      attack_type: 'System Anomaly',
      summary: `Server returned 5xx code on path ${parsed.path}. Potential exploit attempt.`
    };
  }

  return {
    is_threat: false,
    attack_type: 'None',
    summary: 'Log appears normal and secure.'
  };
}
