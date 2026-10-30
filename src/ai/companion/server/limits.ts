export function boundedInteger(value: number, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('Invalid Companion server configuration')
  return value
}

/** One process, one handler instance. Neither shared quota nor authenticated identity. */
export function createLocalLimiter(max: number, windowMs: number, maxClients = 1024, now = Date.now) {
  boundedInteger(max, 0, 10_000)
  boundedInteger(windowMs, 1, 86_400_000)
  boundedInteger(maxClients, 1, 10_000)
  const clients = new Map<string, { count: number; until: number }>()
  return (client: string): number => {
    const time = now()
    for (const [key, entry] of clients) if (entry.until <= time) clients.delete(key)
    let entry = clients.get(client)
    // At capacity fail closed without evicting a peer's active limit.
    if (!entry && clients.size >= maxClients) return windowMs
    if (!entry) { entry = { count: 0, until: time + windowMs }; clients.set(client, entry) }
    if (entry.count >= max) return Math.max(1, entry.until - time)
    entry.count++
    return 0
  }
}
