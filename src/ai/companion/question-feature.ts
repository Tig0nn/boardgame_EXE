import { QuestionApiError } from './question-errors.ts'

export interface QuestionFeature {
  isEnabled(): boolean
  setEnabled(enabled: boolean): void
  subscribe(listener: () => void): () => void
}
export function createQuestionFeature(initial = false): QuestionFeature {
  if (typeof initial !== 'boolean') throw new QuestionApiError('INVALID_REQUEST')
  let enabled = initial
  const listeners = new Set<() => void>()
  return {
    isEnabled: () => enabled,
    setEnabled(value) {
      if (typeof value !== 'boolean') throw new QuestionApiError('INVALID_REQUEST')
      if (value === enabled) return
      enabled = value
      // One host callback must not prevent cancellation of other subscribers.
      for (const listener of [...listeners]) { try { listener() } catch { /* Host owns callback failures. */ } }
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
}
/** Gates execution and delivery; the race settles even if injected work ignores its signal. */
export async function runQuestionFeature<T>(feature: QuestionFeature | undefined, parent: AbortSignal | undefined,
  work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (!feature?.isEnabled()) throw new QuestionApiError('QUESTION_FEATURE_DISABLED')
  parent?.throwIfAborted()
  const controller = new AbortController()
  const cancel = () => controller.abort(parent?.reason)
  const unsubscribe = feature.subscribe(() => controller.abort(new QuestionApiError('QUESTION_FEATURE_DISABLED')))
  parent?.addEventListener('abort', cancel, { once: true })
  if (parent?.aborted) cancel()
  let onAbort: () => void = () => {}
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(controller.signal.reason)
    controller.signal.addEventListener('abort', onAbort, { once: true })
    if (controller.signal.aborted) onAbort()
  })
  try {
    // Execute synchronously until the first await, retaining boundary-detachment guarantees.
    const task = new Promise<T>((resolve, reject) => {
      try { controller.signal.throwIfAborted(); resolve(work(controller.signal)) } catch (error) { reject(error) }
    })
    const result = await Promise.race([task, aborted])
    controller.signal.throwIfAborted()
    if (!feature.isEnabled()) throw new QuestionApiError('QUESTION_FEATURE_DISABLED')
    return result
  } finally {
    unsubscribe()
    parent?.removeEventListener('abort', cancel)
    controller.signal.removeEventListener('abort', onAbort)
    controller.abort()
  }
}
