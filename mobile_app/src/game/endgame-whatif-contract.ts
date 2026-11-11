import type { GameState, LogEntry } from '../../../src/game/types.ts'

export const COURSE_POLICY = 'course-basic-to-skip-full-end.v1' as const
export const ENDGAME_ENGINE = 'eg1a-course-v1:5a9f6aa4907ad5d2e2013fe68d6d22fa10debd9e3c93c2c01ced11f2494d8415'
export const ENDGAME_PROFILE = 'core-mvp-b18-multi-course-v1' as const
export type Source = { schemaVersion: number; seed: string; rulesVersion: string; state: GameState; entries: LogEntry[]; [key: string]: unknown }
export type CommandIdentity = { sequence: number; kind: LogEntry['kind']; turn: number; lap: number; tileId: number; eventId: string | null; decisionId: string | null; action: LogEntry['action'] | null }
export type SourceIdentity = { sourceHash: string; configHash: string; engine: string; policy: string; branch: string; decision: CommandIdentity }
export type CourseRequest = { source: string; identity: SourceIdentity }
export type WorkOptions = { signal?: AbortSignal; maxSteps?: number; maxMilliseconds?: number }
export type EndingFacts = { termination: GameState['termination']; phase: GameState['phase']; lap: number; turn: number; summaries: number[]; shortfall: number }
export type Metrics = { cash: number; totalWorth: number; liquidatableFunds: number; debt: number; obligations: number; goalFunds: number; goalTarget: number; goalPercent: number; goalRemaining: number; won: boolean; courses: string[]; recurringIncome: number; salaryAtStarts: { lap: number; base: number; courseBoost: number }[] }
export type Delta = { cash: number; totalWorth: number; liquidatableFunds: number; debt: number; obligations: number; goalFunds: number; goalPercent: number; goalRemaining: number; recurringIncome: number }
export type ContinuationBoundary = 'before-command' | 'after-command' | 'phase-advance'
export type Followup = {
  source: SourceIdentity; command: CommandIdentity
  reason: string
  context: { phase: GameState['phase']; turn: number; lap: number; position: number; eventId: string | null }
  cursor: { sourceCommandIndex: number; sourceSequence: number; alternativeLogLength: number; alternativePrefixHash: string; externalHash: string; boundary: ContinuationBoundary; nextSourceCommandIndex: number }
  legalOptions: { id: string; label: string }[]
  resumeSupported: false
}
export type SimulationResult =
  | { status: 'verifying'; policy: typeof COURSE_POLICY }
  | { status: 'supported-final'; policy: typeof COURSE_POLICY; identity: SourceIdentity; comparability: 'same-completed-horizon'; actual: Metrics; alternative: Metrics; delta: Delta; endings: { actual: EndingFacts; alternative: EndingFacts }; proof: { actualReplay: true; alternativeReplay: true; pairedBoundaries: number; finalAdvances: number; alternativeTranscriptHash: string; steps: number } }
  | { status: 'needs-followup'; policy: typeof COURSE_POLICY; followup: Followup }
  | { status: 'limited'; policy: typeof COURSE_POLICY; reason: string; endings?: { actual: EndingFacts; alternative?: EndingFacts }; blocker?: Followup }
  | { status: 'blocked' | 'cancelled' | 'error'; policy: typeof COURSE_POLICY; reason: string }

export class EndgameRejected extends Error {
  readonly status: 'blocked' | 'limited' | 'cancelled'
  constructor(reason: string, status: EndgameRejected['status'] = 'blocked') { super(reason); this.status = status }
}
export function requireEndgame(value: unknown, reason: string): asserts value {
  if (!value) throw new EndgameRejected(reason)
}
export class WorkBudget {
  readonly signal?: AbortSignal
  readonly maxSteps: number
  readonly deadline: number
  steps = 0
  constructor(options: WorkOptions = {}) {
    const maxSteps = options.maxSteps ?? 5_000, milliseconds = options.maxMilliseconds ?? 20_000
    requireEndgame(Number.isSafeInteger(maxSteps) && maxSteps > 0 && maxSteps <= 20_000
      && Number.isSafeInteger(milliseconds) && milliseconds > 0 && milliseconds <= 30_000, 'invalid-work-budget')
    this.signal = options.signal; this.maxSteps = maxSteps; this.deadline = Date.now() + milliseconds
  }
  check() {
    if (this.signal?.aborted) throw new EndgameRejected('cancelled', 'cancelled')
    if (Date.now() > this.deadline) throw new EndgameRejected('time-budget', 'limited')
  }
  step() {
    this.check()
    if (++this.steps > this.maxSteps) throw new EndgameRejected('step-budget', 'limited')
  }
  async yield() { this.check(); await new Promise<void>(resolve => setTimeout(resolve, 0)); this.check() }
}
