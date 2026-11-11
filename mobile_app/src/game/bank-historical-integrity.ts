import type { GameState } from '../../../src/game/types.ts'
import { ECONOMY } from '../../../src/data/config.ts'
import { boardFor } from '../../../src/data/board.ts'
import { MULTI_COURSES } from '../../../src/data/courses.ts'
import { BOND_ISSUERS } from '../../../src/data/bond-issuers.ts'
import { rulesForGame } from '../../../src/game/rules-profile.ts'
import { requireProof } from './bank-historical-contract.ts'

/** Every external mutable input read by serializeLog; derived defaults are pure module code. */
export function serializationEnvironment(game: GameState) {
  return { economy: ECONOMY, board: boardFor(game), rules: rulesForGame(game), courses: MULTI_COURSES, bonds: BOND_ISSUERS }
}
type RecordNode = { object: object; prototype: object | null; keys: string[]; values: unknown[]; enumerable: boolean[] }
/** Exact data-graph witness, not a memoized hash. No writes/freezing/proxying of live state.
 * Checks every captured property again at publication AND read, including silent mutations.
 * Identity-preserving equality is stricter than serialized equality (safe false negatives).
 * Getters, custom prototypes/toJSON, cycles and oversized graphs fail closed.
 */
export function captureIntegrity(game: GameState) {
  requireProof(Array.isArray(game.log) && game.log.length <= 500, 'source-too-large')
  const environment = serializationEnvironment(game)
  const records: RecordNode[] = [], seen = new WeakSet<object>(), visiting = new WeakSet<object>()
  let properties = 0
  function visit(value: unknown) {
    if (value === null || typeof value !== 'object') {
      requireProof(value === undefined || value === null || ['string','boolean','number'].includes(typeof value), 'non-data-source')
      requireProof(typeof value !== 'number' || Number.isFinite(value), 'non-data-source'); return
    }
    requireProof(!visiting.has(value), 'cyclic-source')
    if (seen.has(value)) return
    const prototype = Object.getPrototypeOf(value)
    requireProof(prototype === Object.prototype || (Array.isArray(value) && prototype === Array.prototype), 'non-data-source')
    requireProof(!('toJSON' in value), 'non-data-source')
    const keys = Reflect.ownKeys(value)
    requireProof(keys.every((k): k is string => typeof k === 'string'), 'non-data-source')
    properties += keys.length; requireProof(properties <= 500_000 && records.length < 100_000, 'source-too-large')
    const values: unknown[] = [], enumerable: boolean[] = []
    const record = { object: value, prototype, keys, values, enumerable }; records.push(record)
    seen.add(value); visiting.add(value)
    for (const key of keys) {
      const d = Object.getOwnPropertyDescriptor(value, key)!
      requireProof('value' in d, 'non-data-source')
      values.push(d.value); enumerable.push(!!d.enumerable); visit(d.value)
    }
    visiting.delete(value)
  }
  visit(game); for (const value of Object.values(environment)) visit(value)
  const roots = Object.values(environment)
  return {
    environment,
    valid(): boolean {
      try {
        if (!Object.values(serializationEnvironment(game)).every((v,i) => v === roots[i])) return false
        for (const r of records) {
          if (Object.getPrototypeOf(r.object) !== r.prototype || 'toJSON' in r.object) return false
          const keys = Reflect.ownKeys(r.object)
          if (keys.length !== r.keys.length) return false
          for (let i = 0; i < keys.length; i++) {
            if (keys[i] !== r.keys[i]) return false
            const d = Object.getOwnPropertyDescriptor(r.object, keys[i])!
            if (!('value' in d) || !Object.is(d.value, r.values[i]) || !!d.enumerable !== r.enumerable[i]) return false
          }
        }
        return true
      } catch { return false }
    },
  }
}
