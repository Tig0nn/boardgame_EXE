import { advance, decide, fundPayment, roll, transact } from '../../../src/game/engine.ts'
import { createPlayerGame } from '../../../src/game/new-game.ts'
import { boardFor } from '../../../src/data/board.ts'
import type { FundingSource, GameState, Phase, RebalanceAction, Term } from '../../../src/game/types.ts'

// Presentation mapping only. Every transition and financial value belongs to src/game.
export const PHASE_UI: Record<Phase, string> = {
  forecast: 'forecast', rolling: 'board', event: 'event', funding: 'funding',
  summary: 'start-summary', rebalancing: 'rebalancing', finished: 'finished',
}
export type MobileCommand = { type: 'advance' | 'roll' } | { type: 'choose'; id: string }
  | { type: 'trade'; action: RebalanceAction }
  | { type: 'fund'; source: FundingSource; amount: number; lotId?: string }

export function createMobileGame(seed?: string, savings = 20_000_000, term: Term = 1) {
  return createPlayerGame(seed, savings, term, 'experimental-b')
}

export function createMobileSession(initial: GameState) {
  let game = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => game,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispatch(command: MobileCommand, expected: GameState): boolean {
      // The rendered snapshot acts as a revision token, including for same-phase funding/trades.
      if (game !== expected) return false
      let next: GameState
      switch (command.type) {
        case 'advance': next = advance(game); break
        case 'roll': next = roll(game); break
        case 'choose': next = decide(game, command.id); break
        case 'trade': next = transact(game, command.action); break
        case 'fund': next = fundPayment(game, command.source, command.amount, command.lotId); break
      }
      if (next === game) return false
      game = next
      listeners.forEach(listener => listener())
      return true
    },
  }
}

export function movementPath(before: GameState, after: GameState): number[] {
  return Array.from({ length: after.dice }, (_, step) => (before.position + step + 1) % boardFor(before).length)
}
