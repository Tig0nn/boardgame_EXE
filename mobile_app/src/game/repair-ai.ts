import type { GameState } from '../../../src/game/types.ts'
import { buildRepairContext } from '../../../src/ai/companion/context.ts'
import { createQuestionController } from '../../../src/ai/companion/question-index.ts'
import type { QuestionControllerState, QuestionFeature, QuestionTransport } from '../../../src/ai/companion/question-index.ts'

export interface RepairAiSession {
  getSnapshot(): GameState
  subscribe(listener: () => void): () => void
}
export function repairAiOptIn(development: boolean, search: string): boolean {
  return development === true && new URLSearchParams(search).get('repairAi') === '1'
}
export function repairAiEligible(game: GameState): boolean {
  try { buildRepairContext(game, { sessionEpoch: 'eligibility', revision: 0 }); return true } catch { return false }
}
export interface RepairAiView { open: boolean; question: string; state: QuestionControllerState }
/** Pure construction: subscriptions start at React commit, not render (including StrictMode). */
export function createRepairAiBinding(session: RepairAiSession, feature: QuestionFeature, transport?: QuestionTransport) {
  const listeners = new Set<() => void>()
  let controller: ReturnType<typeof createQuestionController> | undefined
  let stopSession = () => {}, stopController = () => {}
  let open = false, question = ''
  let view: RepairAiView = { open, question, state: { status: feature.isEnabled() ? 'idle' : 'disabled' } }
  function refresh() {
    const state = controller?.getState() ?? { status: feature.isEnabled() ? 'idle' as const : 'disabled' as const }
    if (!feature.isEnabled()) { open = false; question = '' }
    view = Object.freeze({ open, question, state })
    listeners.forEach(listener => listener())
  }
  function close() { open = false; question = ''; controller?.close(); refresh() }
  function start() {
    if (controller) return
    controller = createQuestionController({ getSnapshot: session.getSnapshot, feature, transport })
    stopController = controller.subscribe(refresh)
    let previous = session.getSnapshot()
    stopSession = session.subscribe(() => {
      controller?.observe()
      const next = session.getSnapshot()
      if (next !== previous) { previous = next; close() }
    })
  }
  return {
    getSnapshot: () => view,
    subscribe(listener: () => void) {
      listeners.add(listener); start()
      return () => {
        listeners.delete(listener)
        if (!listeners.size) {
          stopSession(); stopController(); controller?.dispose(); controller = undefined
          open = false; question = ''; refresh()
        }
      }
    },
    open() { if (!feature.isEnabled() || !repairAiEligible(session.getSnapshot())) return; start(); open = true; refresh() },
    close,
    edit(value: string) { question = value; controller?.editQuestion(value); refresh() },
    ask() { return open && controller ? controller.ask(question) : Promise.resolve(null) },
  }
}