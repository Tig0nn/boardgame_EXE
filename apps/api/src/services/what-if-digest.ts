import { createHash } from 'node:crypto'
import { serializeLog } from '../../../../src/game/log.ts'
import type { GameState, Snapshot } from '../../../../src/game/types.ts'
import type { WhatIfTrace } from './what-if-timing.ts'

const fragmentLimit = 4 * 1024 * 1024

// serializeLog remains the sole definition of the document and its financial
// metadata. Only its repeated market values are replaced while it builds the
// envelope. Expand those values at their exact original indentation, then hash
// every UTF-8 byte. No proof, state, or fragment survives a digest invocation.
export function createWhatIfSnapshotDigester(trace?: WhatIfTrace) {
  let retainedBytes = 0
  let peakRetainedBytes = 0
  return {
    get retainedBytes() { return retainedBytes },
    get peakRetainedBytes() { return peakRetainedBytes },
    digest(game: GameState) {
      let serializationMs = 0, hashingMs = 0, payloadBytes = 0
      const serialize = <T>(operation: () => T) => {
        const started = performance.now()
        try { return operation() } finally { serializationMs += performance.now() - started }
      }
      const markets = new Map<string, GameState['market']>()
      const wrappers = new Map<GameState['market'], GameState['market'] & { toJSON(): string }>()
      const fragments = new Map<string, Buffer>()
      const wrap = (market: GameState['market']) => {
        let wrapped = wrappers.get(market)
        if (!wrapped) {
          const token = '@what-if-market:' + markets.size + '@'
          markets.set(token, market)
          wrapped = { ...market, toJSON: () => token }
          wrappers.set(market, wrapped)
        }
        return wrapped
      }
      const snapshot = (value: Snapshot) => ({ ...value, market: wrap(value.market) })
      try {
        const envelope = serialize(() => serializeLog({
          ...game, market: wrap(game.market),
          log: game.log.map(entry => ({ ...entry, before: snapshot(entry.before), after: snapshot(entry.after) })),
          settlement: game.settlement ? { ...game.settlement, before: snapshot(game.settlement.before) } : null,
        }))
        const hash = createHash('sha256')
        const update = (bytes: Buffer) => {
          const started = performance.now()
          hash.update(bytes)
          hashingMs += performance.now() - started
          payloadBytes += bytes.length
        }
        // Only a complete market-valued line in the canonical envelope can be
        // a placeholder. Escaped strings cannot introduce a matching JSON line.
        const markers = /^( *)"market": "(@what-if-market:\d+@)"/gm
        let cursor = 0
        for (const match of envelope.matchAll(markers)) {
          const start = match.index + match[1].length + '"market": '.length
          update(serialize(() => Buffer.from(envelope.slice(cursor, start), 'utf8')))
          const key = match[2] + ':' + match[1].length
          let bytes = fragments.get(key)
          if (!bytes) {
            const market = markets.get(match[2])
            if (!market) throw new Error('Unknown canonical market fragment')
            bytes = serialize(() => Buffer.from(JSON.stringify(market, null, 2).replace(/\n/g, '\n' + match[1]), 'utf8'))
            if (retainedBytes + bytes.length <= fragmentLimit) {
              fragments.set(key, bytes)
              retainedBytes += bytes.length
              peakRetainedBytes = Math.max(peakRetainedBytes, retainedBytes)
            }
          }
          update(bytes)
          cursor = start + match[2].length + 2
        }
        update(serialize(() => Buffer.from(envelope.slice(cursor), 'utf8')))
        const started = performance.now()
        const digest = hash.digest('hex')
        hashingMs += performance.now() - started
        // Aggregate actual work, excluding time spent hashing from serialization
        // (and vice versa). No content or identity enters the timing observer.
        trace?.record('canonical_serialization', performance.now() - serializationMs)
        trace?.record('canonical_sha256', performance.now() - hashingMs, 'ok', { payloadBytes })
        return digest
      } finally {
        fragments.clear()
        markets.clear()
        wrappers.clear()
        retainedBytes = 0
      }
    },
  }
}
