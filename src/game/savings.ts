import type { GameModeId, SavingsProfile, SavingsProfileId } from './types.ts'

export function createSavingsProfile(id: SavingsProfileId): SavingsProfile {
  if (id === 'v2.1-standard') return { id, rates: { 1: .06, 2: .07, 3: .08 } }
  if (id === 'v2.2-c20') return { id, rates: { 1: .04, 2: .05, 3: .06 } }
  throw new Error('Hồ sơ lãi tiết kiệm không hợp lệ.')
}
export function savingsProfileForMode(mode: GameModeId) {
  return createSavingsProfile(mode === 'experimental-b' ? 'v2.2-c20' : 'v2.1-standard')
}
export function savingsProfileForGame(game: { savingsProfile?: SavingsProfile }): SavingsProfile {
  // Never infer new rates from the mode of a historical state.
  const profile = game.savingsProfile ?? createSavingsProfile('v2.1-standard')
  return { ...profile, rates: { ...profile.rates } }
}
