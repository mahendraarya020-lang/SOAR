import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let useMock = false;

// In-Memory Database store
const mockEndpoints = [
  { id: 1, name: 'Nginx-Web-Production', ip_address: '192.168.1.50', status: 'Active', created_at: new Date(), updated_at: new Date() }
];
const mockLogs: any[] = [];

// Mock Pool implementation
export const pool: any = {
  query: async (text: string, params: any[] = []): Promise<{ rows: any[] }> => {
    if (!useMock) {
      try {
        const realPool = new Pool({ connectionString: process.env.DATABASE_URL });
        const res = await realPool.query(text, params);
        await realPool.end();
        return res;
      } catch (err) {
        useMock = true;
      }
    }

    const cleanSql = text.replace(/\s+/g, ' ').trim();
    
    // Query 1: SELECT id FROM endpoints WHERE ip_address = $1
    if (cleanSql.includes('SELECT id FROM endpoints WHERE ip_address = $1') || cleanSql.includes('SELECT id, name, status FROM endpoints WHERE ip_address = $1')) {
      const ip = params[0];
      const rows = mockEndpoints.filter(e => e.ip_address === ip);
      return { rows };
    }

    // Query 2: SELECT * FROM endpoints
    if (cleanSql.includes('SELECT * FROM endpoints')) {
      return { rows: [...mockEndpoints] };
    }

    // Query 3: INSERT INTO endpoints
    if (cleanSql.includes('INSERT INTO endpoints')) {
      const name = params[0];
      const ip = params[1];
      const existing = mockEndpoints.find(e => e.ip_address === ip);
      if (existing) {
        existing.updated_at = new Date();
        return { rows: [existing] };
      }
      const newEp = {
        id: mockEndpoints.length + 1,
        name,
        ip_address: ip,
        status: 'Active' as const,
        created_at: new Date(),
        updated_at: new Date()
      };
      mockEndpoints.push(newEp);
      return { rows: [newEp] };
    }

    // Query 4: INSERT INTO security_logs
    if (cleanSql.includes('INSERT INTO security_logs')) {
      const endpointId = params[0];
      const rawText = params[1];
      const parsedJson = JSON.parse(params[2]);
      const newLog = {
        id: mockLogs.length + 1,
        endpoint_id: endpointId,
        raw_text: rawText,
        parsed_json: parsedJson,
        is_threat: false,
        attack_type: 'Unknown',
        summary: '',
        created_at: new Date()
      };
      mockLogs.push(newLog);
      return { rows: [newLog] };
    }

    // Query 5: UPDATE security_logs SET is_threat = $1, attack_type = $2, summary = $3 WHERE id = $4
    if (cleanSql.includes('UPDATE security_logs SET is_threat = $1') || cleanSql.includes('UPDATE security_logs SET is_threat=$1')) {
      const isThreat = params[0];
      const attackType = params[1];
      const summary = params[2];
      const logId = params[3];
      const log = mockLogs.find(l => l.id === logId);
      if (log) {
        log.is_threat = isThreat;
        log.attack_type = attackType;
        log.summary = summary;
      }
      return { rows: log ? [log] : [] };
    }

    // Query 6: UPDATE endpoints SET status = 'Isolated' ... WHERE id = $1
    if (cleanSql.includes("status = 'Isolated'") || cleanSql.includes("status='Isolated'")) {
      const id = parseInt(params[0], 10);
      const ep = mockEndpoints.find(e => e.id === id);
      if (ep) {
        ep.status = 'Isolated';
        ep.updated_at = new Date();
      }
      return { rows: ep ? [ep] : [] };
    }

    // Query 7: UPDATE endpoints SET status = 'Active' ... WHERE id = $1
    if (cleanSql.includes("status = 'Active'") || cleanSql.includes("status='Active'")) {
      const id = parseInt(params[0], 10);
      const ep = mockEndpoints.find(e => e.id === id);
      if (ep) {
        ep.status = 'Active';
        ep.updated_at = new Date();
      }
      return { rows: ep ? [ep] : [] };
    }

    console.warn('⚠️ Mock Database received unhandled SQL:', cleanSql);
    return { rows: [] };
  }
};

export const connectDB = async () => {
  try {
    const realPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const client = await realPool.connect();
    console.log('✅ Connected to real PostgreSQL Database');
    client.release();
    await realPool.end();
  } catch (err) {
    console.log('⚠️ Failed to connect to real PostgreSQL. Activating In-Memory Mock Database Mode.');
    useMock = true;
  }
};

export default pool;
