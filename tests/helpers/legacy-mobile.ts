import { createMobileGame as createCurrentMobileGame } from '../../mobile_app/src/game/session.ts'
import type { Term } from '../../src/game/types.ts'

// Historical regression suites must keep their saved V2.4 instrument assumptions explicit.
export const createMobileGame = (seed?: string, savings = 20_000_000, term: Term = 1) =>
  createCurrentMobileGame(seed, savings, term, 'v2.4-single-issuer', 'v2.4-on-landing')
