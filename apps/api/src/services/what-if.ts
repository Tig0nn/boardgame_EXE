import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { and, eq, sql } from 'drizzle-orm'
import { createMultiCourseGame } from '../../../../src/game/new-game.ts'
import type { Database } from '../db/client.ts'
import { gameActions, gameSessions, gameSnapshots } from '../db/schema.ts'
import { ApiError, notFound } from '../errors.ts'
import { postgresFailure } from '../observability.ts'
import { sessionRepository } from '../repositories/game-sessions.ts'
import { gameActionBody } from '../validation.ts'
import type { WhatIfRequest } from '../validation.ts'
import { officialB18Result } from './b18-actions.ts'
import { explainFoxWhatIf } from './fox-what-if.ts'
import type { FoxWhatIfReply } from './fox-what-if.ts'
import { assertSupportedB18, restoreB18State } from './game-state.ts'
import { completedFour, decisionCatalog, evaluateWhatIf, maxHistory, replayWhatIfHistory, snapshotDigest, WhatIfBudget, whatIfPolicy } from './what-if-replay.ts'
import type { WhatIfTrace } from './what-if-timing.ts'

export type WhatIfCatalog = { stateVersion: number; policy: typeof whatIfPolicy; decisions: ReturnType<typeof decisionCatalog> }
type Replay = Awaited<ReturnType<typeof evaluateWhatIf>>
export type WhatIfEvaluation = { stateVersion: number; policy: typeof whatIfPolicy; sequence: number; coach: FoxWhatIfReply }
  & (Extract<Replay, { status: 'completed' }> | Omit<Extract<Replay, { status: 'limited' }>, 'decision'>)

export async function loadVerifiedWhatIf(db: Database, userId: string, id: string, budget: WhatIfBudget, stateVersion?: number, sequence?: number) {
  try {
    const { session, actions, genesisSnapshot, forkSnapshot, finalSnapshot } = await budget.run('transaction', () => db.transaction(async tx => {
      // Dedicated budget for this read-only analysis; no project or pool timeout change.
      await tx.execute(sql`SET LOCAL statement_timeout = '1500ms'`)
      budget.check()
      const session = await budget.run('session_query', () => sessionRepository(tx).findReplayHeader(userId, id))
      if (!session) throw notFound()
      if (budget.trace) budget.trace.stateVersion = session.stateVersion
      budget.time('ownership', () => assertSupportedB18(session))
      if (session.status !== 'completed' || session.result?.outcome === 'insolvent') {
        throw new ApiError(409, 'WHAT_IF_REQUIRES_FOUR_LAPS', 'What-if requires an original game completed through lap four')
      }
      if (stateVersion !== undefined && stateVersion !== session.stateVersion) {
        throw new ApiError(409, 'STATE_VERSION_CONFLICT', 'Reload the decision list for this game')
      }
      if (session.stateVersion > maxHistory) {
        throw new ApiError(422, 'WHAT_IF_HISTORY_TOO_LONG', 'History exceeds the analysis limit')
      }
      if (!session.result) throw new Error('Missing canonical endgame')
      budget.check()
      // Final/fork TEXT is used only for byte verification, never to drive replay.
      // Hash the exact UTF-8 TEXT in PostgreSQL; do not parse/re-encode JSON or
      // transport a multi-megabyte document just to hash it again in Node.
      const ownedDigest = (version: number) => tx.select({
        schemaVersion: gameSnapshots.schemaVersion,
        digest: sql<string>`encode(sha256(convert_to(${gameSnapshots.payload}, 'UTF8')), 'hex')`,
        payloadBytes: sql<number>`octet_length(${gameSnapshots.payload})`,
      }).from(gameSnapshots).innerJoin(gameSessions, eq(gameSessions.id, gameSnapshots.sessionId))
        .where(and(eq(gameSessions.userId, userId), eq(gameSessions.id, id), eq(gameSnapshots.stateVersion, version)))
      const [finalSnapshot] = await budget.run('final_snapshot_read', () => ownedDigest(session.stateVersion),
        rows => ({ payloadBytes: rows[0]?.payloadBytes }))
      if (!finalSnapshot || finalSnapshot.schemaVersion !== 7) throw new Error('Missing canonical endgame')
      budget.check()
      const ownedSnapshot = (version: number) => tx.select({ schemaVersion: gameSnapshots.schemaVersion, payload: gameSnapshots.payload })
        .from(gameSnapshots).innerJoin(gameSessions, eq(gameSessions.id, gameSnapshots.sessionId))
        .where(and(eq(gameSessions.userId, userId), eq(gameSessions.id, id), eq(gameSnapshots.stateVersion, version)))
      const [genesisSnapshot] = await budget.run('genesis_snapshot_read', () => ownedSnapshot(0),
        rows => ({ payloadBytes: rows[0] ? Buffer.byteLength(rows[0].payload) : undefined }))
      budget.check()
      const [forkSnapshot] = sequence !== undefined && sequence > 1 && sequence <= session.stateVersion
        ? await budget.run('fork_snapshot_read', () => ownedDigest(sequence - 1), rows => ({ payloadBytes: rows[0]?.payloadBytes })) : []
      budget.check()
      const actions = await budget.run('action_history_read', () => tx.select({
        sequence: gameActions.sequence, actionType: gameActions.actionType, payload: gameActions.payload,
        engineVersion: gameActions.engineVersion, resultVersion: gameActions.resultVersion,
      }).from(gameActions).innerJoin(gameSessions, eq(gameSessions.id, gameActions.sessionId))
        .where(and(eq(gameSessions.userId, userId), eq(gameSessions.id, id)))
        .orderBy(gameActions.sequence).limit(maxHistory + 1))
      return { session: { ...session, result: session.result }, actions, genesisSnapshot, forkSnapshot, finalSnapshot }
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' }))
    budget.check()
    if (!genesisSnapshot || actions.length !== session.stateVersion) throw new Error('Incomplete B18 replay source')
    const { initialSavings, savingsTerm } = session.setup
    const genesis = createMultiCourseGame(session.seed, initialSavings, savingsTerm)
    budget.time('snapshot_restore', () => restoreB18State(session, genesisSnapshot),
      { payloadBytes: genesisSnapshot ? Buffer.byteLength(genesisSnapshot.payload) : 0 })
    if (budget.time('genesis_hash', () => snapshotDigest(genesis, budget.trace) !== createHash('sha256').update(genesisSnapshot.payload).digest('hex'))) {
      throw new Error('B18 genesis snapshot differs from canonical setup')
    }
    const commands = actions.map(({ sequence, actionType, payload, engineVersion, resultVersion }, index) => {
      if (sequence !== index + 1 || engineVersion !== session.engineVersion || resultVersion !== session.resultVersion) {
        throw new Error('B18 action sequence or version mismatch')
      }
      const parsed = gameActionBody.safeParse({ actionId: actionType, expectedStateVersion: index, payload })
      if (!parsed.success) throw new Error('Invalid persisted B18 action')
      return parsed.data
    })
    const { final, steps } = await budget.run('action_replay', () => replayWhatIfHistory(genesis, commands, budget))
    if (budget.time('final_hash', () => snapshotDigest(final, budget.trace), { payloadBytes: finalSnapshot.payloadBytes }) !== finalSnapshot.digest || !isDeepStrictEqual(officialB18Result(final), {
      outcome: session.result.outcome, lawfulProceedsVnd: String(session.result.lawfulProceedsVnd),
    }) || !completedFour(final)) {
      throw new Error('B18 replay differs from the final snapshot or result')
    }
    budget.check()
    const fork = sequence === undefined ? undefined : steps[sequence - 1]
    const forkDigest = sequence === 1 ? createHash('sha256').update(genesisSnapshot.payload).digest('hex') : forkSnapshot?.digest
    if (fork && ((sequence !== 1 && (!forkSnapshot || forkSnapshot.schemaVersion !== 7)) ||
        budget.time('fork_hash', () => snapshotDigest(fork.before, budget.trace), { payloadBytes: sequence === 1 ? Buffer.byteLength(genesisSnapshot.payload) : forkSnapshot?.payloadBytes }) !== forkDigest)) {
      throw new Error('B18 branch point differs from its stored snapshot')
    }
    budget.check()
    return { stateVersion: session.stateVersion, final, steps }
  } catch (error) {
    if (postgresFailure(error)?.sqlState === '57014') {
      throw new ApiError(503, 'WHAT_IF_BUDGET_EXCEEDED', 'Analysis was interrupted; try again')
    }
    throw error
  }
}

export async function evaluateVerifiedWhatIf(source: Awaited<ReturnType<typeof loadVerifiedWhatIf>>,
  input: WhatIfRequest, budget: WhatIfBudget): Promise<WhatIfEvaluation> {
  const { stateVersion, final, steps } = source
  const evaluation = await budget.run('alternative_replay', () => evaluateWhatIf(final, steps, input, budget))
  const response = { stateVersion, policy: whatIfPolicy, sequence: input.sequence, coach: budget.time('coach', () => explainFoxWhatIf(evaluation, input.sequence)) } as const
  if (evaluation.status === 'limited') {
    const { status, reason, completedLaps, continuation } = evaluation
    return { ...response, status, reason, completedLaps, continuation }
  }
  return { ...response, ...evaluation }
}

export async function analyzeSavedGame(db: Database, userId: string, id: string, input?: WhatIfRequest, signal?: AbortSignal, trace?: WhatIfTrace): Promise<WhatIfCatalog | WhatIfEvaluation> {
  const budget = new WhatIfBudget(signal, 2500, trace)
  const source = await loadVerifiedWhatIf(db, userId, id, budget, input?.stateVersion, input?.sequence)
  const { stateVersion, steps } = source
  const base = { stateVersion, policy: whatIfPolicy } as const
  if (!input) {
    const decisions = budget.time('decision_catalog', () => decisionCatalog(steps))
    budget.check()
    return { ...base, decisions }
  }
  return evaluateVerifiedWhatIf(source, input, budget)
}
