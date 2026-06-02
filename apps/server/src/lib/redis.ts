import { Redis } from 'ioredis'

const url = process.env.REDIS_URL ?? 'redis://localhost:6379'

// Singleton — один клиент на весь процесс
let _redis: Redis | null = null

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck:     true,
      lazyConnect:          false,
    })

    _redis.on('error', (err: Error) => {
      console.error('[redis] connection error:', err.message)
    })
    _redis.on('connect', () => {
      console.log('[redis] connected')
    })
  }
  return _redis
}

export async function closeRedis() {
  if (_redis) {
    await _redis.quit()
    _redis = null
  }
}

// ── Ключи ─────────────────────────────────────────────────────────────────────
export const KEYS = {
  batchReady: (batchId: string | bigint) => `batch:ready:${batchId}`,
}
