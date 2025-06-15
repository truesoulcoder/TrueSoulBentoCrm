// src/lib/redis.ts
import Redis from 'ioredis';

// This will be our singleton instance
let redis: Redis;

// This trick is to prevent multiple instances in development with hot-reloading
declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is not set in environment variables');
}

const redisOptions = {
  // Only connect when a command is first issued, best for serverless envs.
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
};

// In a serverless environment or for a single-instance app, you can
// create the connection once and reuse it. The global variable helps
// avoid re-creating the connection on every hot-reload in development.
if (process.env.NODE_ENV === 'production') {
  redis = new Redis(process.env.REDIS_URL, redisOptions);
} else {
  if (!global.__redis) {
    global.__redis = new Redis(process.env.REDIS_URL, redisOptions);
    console.log('New lazy Redis client created for development.');
  }
  redis = global.__redis;
}

redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

// We now export the guaranteed-to-be-defined instance.
export default redis;