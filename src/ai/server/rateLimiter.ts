interface RateLimitRecord {
  timestamps: number[]
}

const ipMap = new Map<string, RateLimitRecord>()

// Xóa các IP không hoạt động sau 5 phút để giải phóng bộ nhớ
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpired(now: number, windowMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [ip, record] of ipMap.entries()) {
    record.timestamps = record.timestamps.filter(t => now - t < windowMs)
    if (record.timestamps.length === 0) {
      ipMap.delete(ip)
    }
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * Kiểm tra giới hạn tần suất yêu cầu theo địa chỉ IP (in-memory sliding window).
 * Mặc định: tối đa 5 requests trong 60 giây.
 */
export function checkRateLimit(
  ip: string,
  limit = 5,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now()
  cleanupExpired(now, windowMs)

  const normalizedIp = ip.trim() || 'unknown'
  let record = ipMap.get(normalizedIp)
  if (!record) {
    record = { timestamps: [] }
    ipMap.set(normalizedIp, record)
  }

  // Lọc các timestamp nằm ngoài sliding window
  record.timestamps = record.timestamps.filter(t => now - t < windowMs)

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0]
    const retryAfterMs = oldest + windowMs - now
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    }
  }

  record.timestamps.push(now)
  return {
    allowed: true,
    remaining: limit - record.timestamps.length,
    retryAfterSeconds: 0,
  }
}

/**
 * Reset bộ nhớ rate limiter (dùng cho unit test).
 */
export function resetRateLimiter(): void {
  ipMap.clear()
}
