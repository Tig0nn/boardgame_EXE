import type { GameState } from '../../game/types.ts'
import { buildRepairContext } from './context.ts'
import { createQuestionRequest } from './question-contract.ts'
import { parseQuestionResponse } from './question-response.ts'
import { createQuestionFeature, runQuestionFeature } from './question-feature.ts'
import type { QuestionFeature } from './question-feature.ts'
import { createLocalQuestionTransport, QuestionTransportError } from './question-transport.ts'
import type { QuestionTransport } from './question-transport.ts'
import { QuestionApiError, parseQuestionError, questionErrorResponse, questionFailure } from './question-errors.ts'
import type { QuestionError, QuestionRequest, QuestionResponse } from './question-types.ts'
import { text } from './schema.ts'

export interface QuestionDelivery {
  readonly response: QuestionResponse
  isCurrent(): boolean
  /** Synchronous only. A deferred host state updater must recheck isCurrent when it actually runs. */
  render(apply: (response: QuestionResponse) => void): boolean
}
export type QuestionControllerState =
  | { status: 'disabled' | 'idle' | 'loading' }
  | { status: 'answered' | 'fallback'; delivery: QuestionDelivery }
  | { status: 'error'; error: QuestionError; isCurrent(): boolean }
export interface QuestionControllerOptions {
  getSnapshot(): GameState
  feature?: QuestionFeature
  transport?: QuestionTransport
  sessionEpoch?: string
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function freshId(): string {
  if (!globalThis.crypto?.randomUUID) throw new QuestionApiError('SERVICE_UNAVAILABLE')
  return globalThis.crypto.randomUUID()
}
function epoch(value?: string): string {
  if (value === undefined) {
    value = freshId()
  }
  return text(48, /^[A-Za-z0-9_-]+$/)(value)
}
/** Host must subscribe observe() to its real session; no engine subscription or UI is installed here. */
export function createQuestionController(options: QuestionControllerOptions) {
  const feature = options.feature ?? createQuestionFeature()
  const transport = options.transport ?? createLocalQuestionTransport({ feature })
  let sessionEpoch = epoch(options.sessionEpoch), revision = 0
  const usedEpochs = new Set([sessionEpoch])
  let snapshot = options.getSnapshot(), question = '', generation = 0, disposed = false, closing = false
  let active: AbortController | undefined, activeId: string | undefined
  let state: QuestionControllerState = { status: feature.isEnabled() ? 'idle' : 'disabled' }
  const listeners = new Set<(state: QuestionControllerState) => void>()
  function publish(next: QuestionControllerState) {
    state = Object.freeze(next)
    for (const listener of [...listeners]) { try { listener(state) } catch { /* Host owns callback failures. */ } }
  }
  function invalidate(notify = true) {
    const token = ++generation, previous = active
    // Commit cleared state before abort dispatch: abort listeners can call this controller synchronously.
    active = undefined; activeId = undefined
    const next: QuestionControllerState = { status: feature.isEnabled() ? 'idle' : 'disabled' }
    state = Object.freeze(next)
    previous?.abort()
    if (notify && generation === token) publish(next)
    return token
  }
  function readSnapshot(): boolean {
    if (disposed) return false
    const current = options.getSnapshot()
    if (current === snapshot) return false
    if (revision === Number.MAX_SAFE_INTEGER) throw new QuestionApiError('INVALID_REQUEST')
    snapshot = current; revision++
    return true
  }
  function observe() { if (readSnapshot()) invalidate() }
  function retire(controller: AbortController) {
    if (active !== controller) return
    readSnapshot(); invalidate()
  }
  const unsubscribeFeature = feature.subscribe(() => invalidate())
  return {
    observe: () => observe(),
    getState(): QuestionControllerState { observe(); return state },
    subscribe(listener: (state: QuestionControllerState) => void) {
      listeners.add(listener)
      try { listener(state) } catch { /* Host owns callback failures. */ }
      return () => { listeners.delete(listener) }
    },
    editQuestion(next: string) {
      if (typeof next !== 'string') throw new QuestionApiError('INVALID_REQUEST')
      if (next !== question) { question = next; invalidate() }
    },
    close() {
      const previous = closing; closing = true
      try { invalidate() } finally { closing = previous }
    },
    setEnabled: (enabled: boolean) => feature.setEnabled(enabled),
    resetSession(nextEpoch?: string) {
      const next = epoch(nextEpoch)
      if (usedEpochs.has(next)) throw new QuestionApiError('INVALID_REQUEST')
      usedEpochs.add(next); sessionEpoch = next; revision = 0; snapshot = options.getSnapshot(); invalidate()
    },
    dispose() {
      if (disposed) return
      disposed = true; invalidate(); unsubscribeFeature(); listeners.clear()
    },
    async ask(nextQuestion: string): Promise<QuestionDelivery | null> {
      if (disposed || closing) return null
      readSnapshot()
      question = nextQuestion
      const started = invalidate(false)
      // A synchronous abort callback may have closed, edited, reset or started newer work.
      if (generation !== started || disposed || closing) return null
      if (!feature.isEnabled()) { publish({ status: 'disabled' }); return null }
      const id = freshId()
      const captured = { snapshot, question, sessionEpoch, revision, generation }
      const controller = new AbortController()
      active = controller; activeId = id
      const current = () => !disposed && feature.isEnabled() && !controller.signal.aborted && active === controller
        && activeId === id && generation === captured.generation && question === captured.question
        && sessionEpoch === captured.sessionEpoch && revision === captured.revision && options.getSnapshot() === captured.snapshot
      publish({ status: 'loading' })
      let request: QuestionRequest | undefined
      try {
        if (!current()) { retire(controller); return null }
        const response = await runQuestionFeature(feature, controller.signal, async signal => {
          const context = buildRepairContext(captured.snapshot, { sessionEpoch: captured.sessionEpoch, revision: captured.revision })
          request = await createQuestionRequest(context, { sessionEpoch: captured.sessionEpoch, revision: captured.revision }, captured.question, id)
          signal.throwIfAborted()
          if (!current()) { retire(controller); return null }
          const raw = await transport(freeze(request), signal)
          signal.throwIfAborted()
          if (!current()) { retire(controller); return null }
          return parseQuestionResponse(raw, request, { feature, signal })
        })
        if (!response || !current()) { retire(controller); return null }
        const delivery: QuestionDelivery = Object.freeze({ response: freeze(response), isCurrent: current,
          render(apply: (value: QuestionResponse) => void) {
            if (!current()) return false
            apply(response)
            return true
          } })
        publish({ status: response.result.status, delivery })
        if (!current()) { retire(controller); return null }
        return delivery
      } catch (cause) {
        // Superseded failures must not disable a newer request or publish an old error.
        if (!current()) { retire(controller); return null }
        const failure = questionFailure(cause)
        let error: QuestionError
        if (cause instanceof QuestionTransportError) {
          try { error = parseQuestionError(cause.response, request, cause.status) }
          catch { error = questionErrorResponse('INVALID_RESPONSE', request) }
        } else error = questionErrorResponse(failure.code, request)
        if (error.error.code === 'QUESTION_FEATURE_DISABLED') { feature.setEnabled(false); return null }
        publish({ status: 'error', error: freeze(error), isCurrent: current })
        return null
      }
    },
  }
}
