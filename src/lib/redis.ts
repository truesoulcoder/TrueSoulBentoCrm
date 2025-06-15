// src/lib/redis.ts
import Redis from 'ioredis';

// Ensure the REDIS_URL is set in your environment variables
if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is not set in environment variables');
}

// Create a new Redis instance with options optimized for serverless environments.
const redis = new Redis(process.env.REDIS_URL, {
  // Set a connection timeout
  connectTimeout: 10000, // 10 seconds
  // Do not retry more than 3 times for a single command.
  // This prevents long-running retries in a serverless function.
  maxRetriesPerRequest: 3,
  // This option can help in some serverless environments.
  enableReadyCheck: false,
});

redis.on('error', (err) => {
  // Prevent crashing the process on connection errors, as we handle them in API routes.
  console.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  console.log('Successfully connected to Redis.');
});

export default redis;