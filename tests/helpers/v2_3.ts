import { createGame } from '../../src/game/engine.ts'

/** Preserve the baseline of pre-V2.4 regression suites without changing their assertions. */
export function createV23Game(...args: Parameters<typeof createGame>) {
  args[5] ??= 'v2.3-fixed-income'
  args[6] ??= 'v2.3-single-action'
  return createGame(...args)
}
