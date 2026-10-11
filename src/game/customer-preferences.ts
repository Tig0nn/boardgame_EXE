import { CUSTOMER_PREFERENCES } from '../data/customer-preferences.ts'
import { hashSeed, random } from './random.ts'
import type { CustomerPreferenceId, Snapshot } from './types.ts'

// Versioned, domain-separated source: never reads or advances GameState.rng.
// Keep this algorithm/order unchanged for v2.4 replay compatibility.
export function customerPreferenceForLap(seed: string, lap: number): CustomerPreferenceId {
  const [value] = random(hashSeed(`customer-preferences-v2.4:${seed}:${lap}`))
  return CUSTOMER_PREFERENCES[Math.floor(value * CUSTOMER_PREFERENCES.length)].id
}

export function currentCustomerPreference(s: Pick<Snapshot, 'customerPreferenceId'>) {
  const preference = CUSTOMER_PREFERENCES.find(p => p.id === s.customerPreferenceId)
  if (!preference) throw new Error('Thiếu hoặc sai sở thích khách hàng của vòng hiện tại.')
  return preference
}
