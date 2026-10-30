import { answerRepairQuestion } from './answer.ts'
import type { QuestionAnswer } from './answer.ts'

/** Private lifecycle helper. Host must invalidate on every snapshot/session change and on unmount. */
export function createQuestionSession() {
  let generation = 0
  let active: AbortController | undefined
  function invalidate() {
    generation++
    active?.abort()
    active = undefined
  }
  return {
    invalidate,
    async ask(request: unknown): Promise<QuestionAnswer | null> {
      invalidate()
      const started = generation, controller = new AbortController()
      active = controller
      try {
        const answer = await answerRepairQuestion(request, controller.signal)
        return generation === started && !controller.signal.aborted ? answer : null
      } catch (error) {
        if (controller.signal.aborted) return null
        throw error
      } finally {
        if (generation === started) active = undefined
      }
    },
  }
}
