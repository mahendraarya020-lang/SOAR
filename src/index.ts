import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { pool, connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { parseNginxLog } from './utils/parser';
import { logQueue } from './queues/logQueue';
import { initSocket } from './config/socket';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create HTTP server wrapping the express app for WebSocket support
const server = http.createServer(app);

// Initialize Socket.io WebSocket server
initSocket(server);

// Endpoint Tes Koneksi API (Fase 2)
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.json({ status: 'UP', message: 'SOAR API is running smoothly' });
});

// Endpoint Utama Ingesti Log (Fase 2 & 3)
app.post('/api/v1/logs/ingest', async (req: Request, res: Response): Promise<any> => {
  try {
    const { raw_log } = req.body;

    if (!raw_log) {
      return res.status(400).json({ error: 'Missing field: raw_log' });
    }

    // 1. Jalankan Log Parser
    const parsedData = parseNginxLog(raw_log);
    
    if (!parsedData) {
      return res.status(422).json({ error: 'Failed to parse log format' });
    }

    // 2. Cari ID Endpoint berdasarkan IP Address yang tertera di log
    const endpointCheck = await pool.query(
      'SELECT id FROM endpoints WHERE ip_address = $1',
      [parsedData.ip_address]
    );

    let endpointId = endpointCheck.rows[0]?.id || null;

    // Optional Auto-discovery: Register endpoint if it doesn't exist yet
    if (!endpointId) {
      const autoRegisterName = `Auto-Discovered-${parsedData.ip_address}`;
      const newEndpoint = await pool.query(
        `INSERT INTO endpoints (name, ip_address, status)
         VALUES ($1, $2, 'Active')
         ON CONFLICT (ip_address) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [autoRegisterName, parsedData.ip_address]
      );
      endpointId = newEndpoint.rows[0].id;
    }

    // 3. Simpan Log Hasil Parsing ke Database PostgreSQL
    const insertQuery = `
      INSERT INTO security_logs (endpoint_id, raw_text, parsed_json)
      VALUES ($1, $2, $3)
      RETURNING id, created_at;
    `;
    
    const result = await pool.query(insertQuery, [
      endpointId,
      raw_log,
      JSON.stringify(parsedData)
    ]);

    const logId = result.rows[0].id;

    // 4. Masukkan Pekerjaan Analisis ke Antrean BullMQ (Fase 3 - Async SOAR Queue)
    await logQueue.add(`analyze-log-${logId}`, {
      logId,
      endpointId,
      rawLog: raw_log,
      parsedData
    });

    // 5. Berikan Respon Cepat (Sesuai Konsep Async SOAR)
    return res.status(202).json({
      message: 'Log successfully ingested and queued for analysis',
      log_id: logId,
      parsed: parsedData
    });

  } catch (error) {
    console.error('Ingestion Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/v1/endpoints: Fetches all tracked assets from the PostgreSQL database
app.get('/api/v1/endpoints', async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await pool.query('SELECT * FROM endpoints ORDER BY id ASC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Fetch Endpoints Error:', error);
    return res.status(500).json({ error: 'Failed to fetch endpoints' });
  }
});

// POST /api/v1/endpoints/:id/reconnect: Restores isolated node status back to 'Active'
app.post('/api/v1/endpoints/:id/reconnect', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE endpoints 
       SET status = 'Active', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    console.log(`🔌 [Manual SOAR Restoral] Endpoint ID ${id} was manually reconnected/restored to 'Active' status.`);
    return res.json({
      message: 'Endpoint successfully reconnected and set to Active',
      endpoint: result.rows[0]
    });
  } catch (error) {
    console.error('Reconnect Endpoint Error:', error);
    return res.status(500).json({ error: 'Failed to reconnect endpoint' });
  }
});

// Start Server
const startServer = async () => {
  // Initialize DB & Redis connections
  await connectDB();
  await connectRedis();

  server.listen(PORT, () => {
    console.log(`🚀 SOAR Engine Core listening on http://localhost:${PORT}`);
  });
};

startServer();
