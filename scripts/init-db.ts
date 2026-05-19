import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const schema = `
-- Membuat Tabel Endpoints
CREATE TABLE IF NOT EXISTS endpoints (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Suspicious', 'Isolated')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Membuat Tabel Logs
CREATE TABLE IF NOT EXISTS security_logs (
    id SERIAL PRIMARY KEY,
    endpoint_id INT REFERENCES endpoints(id) ON DELETE SET NULL,
    raw_text TEXT NOT NULL,
    parsed_json JSONB,
    is_threat BOOLEAN DEFAULT FALSE,
    attack_type VARCHAR(50) DEFAULT 'Unknown',
    summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Memasukkan data simulasi server awal untuk pengujian
INSERT INTO endpoints (name, ip_address, status)
VALUES ('Nginx-Web-Production', '192.168.1.50', 'Active')
ON CONFLICT (ip_address) DO NOTHING;
`;

async function initDB() {
  console.log('🔄 Initializing PostgreSQL database tables (Phase 2)...');
  try {
    const client = await pool.connect();
    console.log('✅ Connected to database. Executing schema queries...');
    await client.query(schema);
    console.log('✅ Tables created successfully & initial endpoint inserted.');
    client.release();
  } catch (error) {
    console.error('❌ Database initialization failed:', (error as Error).message);
    console.log('\nMake sure DATABASE_URL in your .env file is correct and the PostgreSQL server is running.');
  } finally {
    await pool.end();
  }
}

initDB();
