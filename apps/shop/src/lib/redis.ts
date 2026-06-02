import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redisPublisher: Redis | undefined }

export const redis =
  globalForRedis.redisPublisher ??
  new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })

if (process.env.NODE_ENV !== 'production') globalForRedis.redisPublisher = redis
