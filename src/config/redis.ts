import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let useMock = false;

export const redisClient: any = {
  isOpen: false,
  connect: async () => {
    if (useMock) return;
    try {
      const client = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
      });
      // Set short connect timeout so it fails quickly if redis is not running
      await client.connect();
      console.log('✅ Connected to real Redis');
      redisClient.isOpen = true;
    } catch (err) {
      console.log('⚠️ Failed to connect to real Redis. Activating In-Memory Mock Redis Mode.');
      useMock = true;
      redisClient.isOpen = true;
    }
  }
};

export const connectRedis = async () => {
  await redisClient.connect();
};

export default redisClient;
