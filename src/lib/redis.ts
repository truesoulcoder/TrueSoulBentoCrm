// src/lib/redis.ts
import Redis from 'ioredis';

// Define the structure on the global object to avoid TypeScript errors.
declare global {
  // eslint-disable-next-line no-var
  var redisClient: Redis | undefined;
}

let redis: Redis;

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is not set in the environment variables.');
}

/**
 * Creates and configures a new Redis client.
 * This function is called only when a client doesn't already exist for the process.
 */
const createRedisClient = () => {
  console.log('Creating new Redis client...');

  const client = new Redis(redisUrl, {
    // For development, connect eagerly. For production (serverless), connect lazily.
    lazyConnect: process.env.NODE_ENV === 'production',
    connectTimeout: 10000, // 10 seconds
    // Keep the connection alive by sending PING commands periodically.
    keepAlive: 30000, // 30 seconds
    retryStrategy(times: number) {
      // Use a more patient exponential backoff strategy.
      const delay = Math.min(times * 200, 5000); // 200ms, 400ms, ... up to 5s
      console.log(`Redis: Retrying connection in ${delay}ms (attempt ${times})`);
      return delay;
    },
  });

  // --- Attach Event Listeners Once ---
  client.on('connect', () => {
    console.log('Redis client connected successfully.');
  });

  client.on('error', (err) => {
    // This listener prevents the app from crashing and logs the error.
    // The retryStrategy handles the actual reconnection attempts.
    console.error('Redis Client Error:', err.message);
  });

  client.on('reconnecting', () => {
    console.log('Redis client is reconnecting...');
  });

  client.on('close', () => {
    console.log('Redis connection has been closed.');
  });

  return client;
};

// --- Singleton Logic for Next.js --- //
// In production, we create a single client.
if (process.env.NODE_ENV === 'production') {
  redis = createRedisClient();
} else {
  // In development, we use a global variable to preserve the client across hot reloads.
  if (!global.redisClient) {
    global.redisClient = createRedisClient();
  }
  redis = global.redisClient;
}

export default redis;