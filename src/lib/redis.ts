// src/lib/redis.ts
import Redis from 'ioredis';

// Declare a global variable to hold the Redis instance.
// Using 'var' in the global scope (or a globalThis object) is a common pattern
// to ensure the instance persists across hot reloads in development.
declare global {
  // eslint-disable-next-line no-var
  var redis: Redis | undefined;
}

let redis: Redis | undefined;

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is not set in environment variables');
}

// In development, we use a global variable so that the value
// is preserved across module reloads caused by HMR (Hot Module Replacement).
if (process.env.NODE_ENV === 'development') {
  if (!global.redis) {
    global.redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    });
    console.log('New Redis client connected (development).');
  }
  redis = global.redis;
} else {
  // In production, we create a single instance.
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
  });
  console.log('New Redis client connected (production).');
}

redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  console.log('Successfully connected to Redis.');
});


export default redis;