import { ECONOMY, SCENARIOS, MACRO_EVENTS, RULES } from '../../../src/data/config.ts'
import { BOND_ISSUERS } from '../../../src/data/bond-issuers.ts'
import { MULTI_COURSES } from '../../../src/data/courses.ts'
import { CUSTOMER_PREFERENCES } from '../../../src/data/customer-preferences.ts'
import { GAME_MODES } from '../../../src/data/modes.ts'
import { MULTI_COURSE_B18_BOARD } from '../../../src/data/board.ts'
import { stockCatalog } from '../../../src/data/stock-catalog.ts'
import { MULTI_COURSE_RULES, CORE_MVP_RULES } from '../../../src/game/rules-profile.ts'
import { requireEndgame } from './endgame-whatif-contract.ts'

type NodeRecord = { object: object; prototype: object | null; keys: PropertyKey[]; values: unknown[]; enumerable: boolean[] }
/** Request and shared config witness. Reject accessors before serializing; never freeze/mutate caller data. */
export function captureDataIntegrity(value: unknown) {
  const records: NodeRecord[] = [], seen = new WeakSet<object>(), visiting = new WeakSet<object>()
  let properties = 0
  const visit = (item: unknown, depth: number) => {
    requireEndgame(depth <= 64, 'data-too-deep')
    if (item === null || typeof item !== 'object') {
      requireEndgame(item === undefined || item === null || ['string', 'number', 'boolean'].includes(typeof item), 'non-data-input')
      requireEndgame(typeof item !== 'number' || Number.isFinite(item), 'non-data-input')
      return
    }
    requireEndgame(!visiting.has(item), 'cyclic-input')
    if (seen.has(item)) return
    const prototype = Object.getPrototypeOf(item)
    requireEndgame(prototype === Object.prototype || (Array.isArray(item) && prototype === Array.prototype), 'non-data-input')
    requireEndgame(!('toJSON' in item), 'non-data-input')
    const keys = Reflect.ownKeys(item), values: unknown[] = [], enumerable: boolean[] = []
    properties += keys.length
    requireEndgame(properties <= 600_000 && records.length < 100_000 && keys.every(k => typeof k === 'string'), 'data-budget')
    records.push({ object: item, prototype, keys, values, enumerable }); visiting.add(item); seen.add(item)
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(item, key)!
      requireEndgame('value' in descriptor, 'non-data-input')
      values.push(descriptor.value); enumerable.push(!!descriptor.enumerable); visit(descriptor.value, depth + 1)
    }
    visiting.delete(item)
  }
  visit(value, 0)
  return () => {
    try {
      return records.every(record => {
        if (Object.getPrototypeOf(record.object) !== record.prototype || 'toJSON' in record.object) return false
        const keys = Reflect.ownKeys(record.object)
        return keys.length === record.keys.length && keys.every((key, i) => {
          const descriptor = Object.getOwnPropertyDescriptor(record.object, key)!
          return key === record.keys[i] && 'value' in descriptor && Object.is(descriptor.value, record.values[i])
            && !!descriptor.enumerable === record.enumerable[i]
        })
      })
    } catch { return false }
  }
}
export function captureEnvironment() {
  return captureDataIntegrity({ ECONOMY, SCENARIOS, MACRO_EVENTS, RULES, BOND_ISSUERS, MULTI_COURSES,
    CUSTOMER_PREFERENCES, GAME_MODES, MULTI_COURSE_B18_BOARD, stocks: stockCatalog('vn-v1'), MULTI_COURSE_RULES, CORE_MVP_RULES })
}
