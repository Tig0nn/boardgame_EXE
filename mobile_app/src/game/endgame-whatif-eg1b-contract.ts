import type { CourseRequest, CommandIdentity, EndingFacts, SimulationResult, WorkOptions } from './endgame-whatif-contract.ts'
export const CONTINUATION_POLICY = 'eg1b-explicit-followup.v1' as const
export const FAIRNESS_POLICY = 'F1-native-coupling.v1' as const
export const EG1B_LIMITS = Object.freeze({ followups: 16, transcriptCharacters: 32_768, choices: 10, steps: 20_000, milliseconds: 30_000 })
export type FollowupAction = { kind: 'event'; optionId: string } | { kind: 'fund-debt'; amount: number }
export type ContinuationIdentity = { branchId: string; sourceHash: string; configHash: string; engine: string; profile: string; schema: 7; selected: CommandIdentity; initial: 'skip'; fairness: typeof FAIRNESS_POLICY; policy: typeof CONTINUATION_POLICY; revision: number; transcriptHash: string; cursor: number; alternativePrefixHash: string }
export type PendingBlocker = { hash: string; command: CommandIdentity; reason: string; boundary: 'before-command' | 'after-command' | 'phase-advance'; commandApplied: boolean; phaseAdvanceOccurred: boolean; cursor: number; context: { phase: string; turn: number; lap: number; tile: number; event: string | null }; payment: { origin: string; remaining: number; total: number } | null; externalEqual: boolean; choices: { action: FollowupAction; label: string }[] }
export type FollowupRecord = { ordinal: number; blockerHash: string; command: CommandIdentity; boundary: PendingBlocker['boundary']; action: FollowupAction; beforeHash: string; afterHash: string; superseded: number[]; previousHash: string; hash: string }
export type Transcript = { branchId: string; sourceHash: string; configHash: string; engine: string; selected: CommandIdentity; policy: typeof CONTINUATION_POLICY; fairness: typeof FAIRNESS_POLICY; entries: FollowupRecord[]; hash: string }
export type Attribution = { initialFork: 'course-basic-to-skip-full-end.v1'; followupCount: number; choices: { ordinal: number; action: FollowupAction; superseded: number[] }[]; combinedConsequences: boolean }
type Final = Extract<SimulationResult, { status: 'supported-final' }>
export type ContinuationResult = (Final & { transcript: Transcript; attribution: Attribution; continuation: ContinuationIdentity })
  | { status: 'needs-followup'; continuation: ContinuationIdentity; blocker: PendingBlocker; transcript: Transcript }
  | { status: 'limited'; reason: string; transcript?: Transcript; blocker?: PendingBlocker; endings?: { actual: EndingFacts; alternative?: EndingFacts } }
  | { status: 'blocked' | 'cancelled' | 'error'; reason: string }
export type ResumeInput = { continuation: ContinuationIdentity; blocker: PendingBlocker; choice: FollowupAction }
/** Per-handle ordinal lock only; not a live MobileSession identity or authenticated token. */
export type ContinuationHandle = { readonly result: ContinuationResult; resume(input: ResumeInput, options?: WorkOptions): Promise<ContinuationResult> }
export type StartOptions = WorkOptions
export type { CourseRequest, WorkOptions }