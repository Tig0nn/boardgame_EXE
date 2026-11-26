import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useVisualMotion } from './visual-motion'

export type RollStage = 'dice' | 'pawn'
export type RollPresentation = { id: number; from: number; stage: 'waiting' | RollStage }
type PendingRoll = RollPresentation & { before?: number }

// Normal progression is callback-driven (800ms die, then <= 6 * 145ms pawn).
// This ceiling only releases the UI if a GPU/native callback never arrives.
export const ROLL_PRESENTATION_LIMIT_MS = 2500

export function useRollPresentation(sequence: number | undefined, failed: boolean) {
  const motion = useVisualMotion()
  const [pending, setPending] = useState<PendingRoll | null>(null)
  const pressing = useRef<number | null>(null)
  const mounted = useRef(false)
  const nextId = useRef(0)
  const cancel = useCallback(() => setPending(null), [])
  // Reconcile on EVERY commit, including null -> null when a reduced-motion
  // roll finishes during render. A [pending] effect misses that transition.
  // Until commit, begin's token rejects duplicate presses in the same event.
  useLayoutEffect(() => { pressing.current = pending?.id ?? null })
  useLayoutEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; pressing.current = null }
  }, [])
  const begin = useCallback((from: number, before: number | undefined) => {
    // Synchronous guard also rejects two presses before React commits a render.
    if (!mounted.current || pressing.current !== null) return false
    const id = ++nextId.current
    pressing.current = id
    setPending({ id, from, before, stage: 'waiting' })
    return true
  }, [])
  const complete = useCallback((id: number, stage: RollStage) => {
    if (!mounted.current || pressing.current !== id) return
    setPending(active => !active || active.id !== id || active.stage !== stage
      ? active : stage === 'dice' ? { ...active, stage: 'pawn' } : null)
  }, [])
  // Adjust this component's own presentation state before rendering children.
  // No paint may place the pawn at its destination before the dice animation.
  // Presentation may be skipped, but a pending server mutation stays locked
  // until its canonical roll arrives (or the existing client reports failure).
  if (pending && (failed || (!motion && (pending.stage !== 'waiting' || sequence !== pending.before)))) setPending(null)
  else if (pending?.stage === 'waiting' && sequence !== pending.before) setPending({ ...pending, stage: 'dice' })
  const animationId = pending && pending.stage !== 'waiting' ? pending.id : undefined
  useEffect(() => {
    if (animationId === undefined) return
    const timer = setTimeout(() => {
      setPending(active => active?.id === animationId ? null : active)
    }, ROLL_PRESENTATION_LIMIT_MS)
    return () => clearTimeout(timer)
  }, [animationId])
  const presentation: RollPresentation | null = pending
  return { active: !!pending, presentation, begin, complete, cancel }
}
