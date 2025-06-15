// src/lib/redis.ts
import Redis from 'ioredis';

// Ensure the REDIS_URL is set in your environment variables
if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is not set in environment variables');
}

// Create a new Redis instance.
// The client will automatically try to reconnect if the connection is lost.
const redis = new Redis(process.env.REDIS_URL);

redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  console.log('Successfully connected to Redis.');
});

export default redis;