import { createLocalLimiter } from '../../../../src/ai/companion/server/limits.ts'
import { createGeminiLearningProvider } from '../../../../src/ai/mascot/learning-gemini.ts'
import { readLearningIds } from '../../../../src/ai/mascot/learning.ts'
import type { LearningCard } from '../../../../src/ai/mascot/learning.ts'

export type FoxAssistanceStatus = 'not-requested' | 'disabled' | 'not-needed' | 'used' | 'no-match' | 'unavailable' | 'timeout' | 'rate-limited'

type AssistResult = { status: FoxAssistanceStatus; cards: LearningCard[] }
export type FoxAssist = (playerId: string, question: string, cards: readonly LearningCard[], signal?: AbortSignal) => Promise<AssistResult>

export function createFoxAssistance(env: NodeJS.ProcessEnv, transport: typeof fetch = globalThis.fetch, deadlineMs = 2500): FoxAssist | undefined {
  if (env.EXE_FOX_GEMINI_ENABLED !== '1') return undefined
  const provider = createGeminiLearningProvider({
    credential: env.EXE_FOX_GEMINI_API_KEY, model: env.EXE_FOX_GEMINI_MODEL, transport,
  })
  if (!provider) return undefined

  const limitPlayer = createLocalLimiter(4, 60_000)
  const limitInstance = createLocalLimiter(16, 60_000)
  let inFlight = 0
  return async (playerId, question, cards, disconnect) => {
    const fallback = (status: FoxAssistanceStatus): AssistResult => ({ status, cards: [] })
    if (disconnect?.aborted) return fallback('unavailable')
    if (inFlight >= 2 || limitPlayer(playerId) || limitInstance('fox')) return fallback('rate-limited')

    // Only public curriculum goes to the provider. Saved game facts and identity stay here.
    const publicCards = cards.filter(card => card.scope === 'GENERAL_FINANCE' || card.scope === 'EXE_RULE')
    const timeout = AbortSignal.timeout(deadlineMs)
    const signal = disconnect ? AbortSignal.any([timeout, disconnect]) : timeout
    inFlight++
    let onAbort: () => void = () => {}
    try {
      signal.throwIfAborted()
      const cancelled = new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason)
        signal.addEventListener('abort', onAbort, { once: true })
      })
      const reply = await Promise.race([provider.select(question, publicCards, signal), cancelled])
      signal.throwIfAborted()
      const ids = readLearningIds(reply, publicCards)
      if (!ids) return fallback('unavailable')
      if (!ids.length) return fallback('no-match')
      return { status: 'used', cards: ids.flatMap(id => publicCards.filter(card => card.id === id)) }
    } catch {
      return fallback(timeout.aborted ? 'timeout' : 'unavailable')
    } finally {
      signal.removeEventListener('abort', onAbort)
      inFlight--
    }
  }
}
