import { createMobileGame as createCandidateMobileGame } from '../../mobile_app/src/game/session.ts'

// Freeze old living/board assumptions while preserving the selected Bond policy.
export const createMobileGame = (...args: Parameters<typeof createCandidateMobileGame>) =>
  createCandidateMobileGame(args[0], args[1], args[2], args[3], 'v2.4-on-landing')
