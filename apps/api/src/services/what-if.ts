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

export type WhatIfCatalog = { stateVersion: number; policy: typeof whatIfPolicy; decisions: ReturnType<typeof decisionCatalog> }
type Replay = Awaited<ReturnType<typeof evaluateWhatIf>>
export type WhatIfEvaluation = { stateVersion: number; policy: typeof whatIfPolicy; sequence: number; coach: FoxWhatIfReply }
  & (Extract<Replay, { status: 'completed' }> | Omit<Extract<Replay, { status: 'limited' }>, 'decision'>)

export async function loadVerifiedWhatIf(db: Database, userId: string, id: string, budget: WhatIfBudget, stateVersion?: number, sequence?: number) {
  try {
    const { session, actions, genesisSnapshot, forkSnapshot, finalDigest } = await db.transaction(async tx => {
      // Dedicated budget for this read-only analysis; no project or pool timeout change.
      await tx.execute(sql`SET LOCAL statement_timeout = '1500ms'`)
      budget.check()
      const session = await sessionRepository(tx).findWithState(userId, id)
      if (!session) throw notFound()
      assertSupportedB18(session)
      if (session.status !== 'completed' || session.result?.outcome === 'insolvent') {
        throw new ApiError(409, 'WHAT_IF_REQUIRES_FOUR_LAPS', 'What-if requires an original game completed through lap four')
      }
      if (stateVersion !== undefined && stateVersion !== session.stateVersion) {
        throw new ApiError(409, 'STATE_VERSION_CONFLICT', 'Reload the decision list for this game')
      }
      if (session.stateVersion > maxHistory) {
        throw new ApiError(422, 'WHAT_IF_HISTORY_TOO_LONG', 'History exceeds the analysis limit')
      }
      if (!session.snapshot || session.snapshot.schemaVersion !== 7 || !session.result) throw new Error('Missing canonical endgame')
      budget.check()
      const ownedSnapshot = (version: number) => tx.select({ schemaVersion: gameSnapshots.schemaVersion, payload: gameSnapshots.payload })
        .from(gameSnapshots).innerJoin(gameSessions, eq(gameSessions.id, gameSnapshots.sessionId))
        .where(and(eq(gameSessions.userId, userId), eq(gameSessions.id, id), eq(gameSnapshots.stateVersion, version)))
      const [genesisSnapshot] = await ownedSnapshot(0)
      budget.check()
      const [forkSnapshot] = sequence !== undefined && sequence > 1 && sequence <= session.stateVersion
        ? await ownedSnapshot(sequence - 1) : [genesisSnapshot]
      budget.check()
      const actions = await tx.select({
        sequence: gameActions.sequence, actionType: gameActions.actionType, payload: gameActions.payload,
        engineVersion: gameActions.engineVersion, resultVersion: gameActions.resultVersion,
      }).from(gameActions).innerJoin(gameSessions, eq(gameSessions.id, gameActions.sessionId))
        .where(and(eq(gameSessions.userId, userId), eq(gameSessions.id, id)))
        .orderBy(gameActions.sequence).limit(maxHistory + 1)
      const { snapshot, result, ...identity } = session
      const finalDigest = createHash('sha256').update(snapshot.payload).digest('hex')
      return { session: { ...identity, result }, actions, genesisSnapshot, forkSnapshot, finalDigest }
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' })
    budget.check()
    if (!genesisSnapshot || actions.length !== session.stateVersion) throw new Error('Incomplete B18 replay source')
    const { initialSavings, savingsTerm } = session.setup
    const genesis = createMultiCourseGame(session.seed, initialSavings, savingsTerm)
    restoreB18State(session, genesisSnapshot)
    if (snapshotDigest(genesis) !== createHash('sha256').update(genesisSnapshot.payload).digest('hex')) {
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
    const { final, steps } = await replayWhatIfHistory(genesis, commands, budget)
    if (snapshotDigest(final) !== finalDigest || !isDeepStrictEqual(officialB18Result(final), {
      outcome: session.result.outcome, lawfulProceedsVnd: String(session.result.lawfulProceedsVnd),
    }) || !completedFour(final)) {
      throw new Error('B18 replay differs from the final snapshot or result')
    }
    budget.check()
    const fork = sequence === undefined ? undefined : steps[sequence - 1]
    if (fork && (!forkSnapshot || forkSnapshot.schemaVersion !== 7 ||
        snapshotDigest(fork.before) !== createHash('sha256').update(forkSnapshot.payload).digest('hex'))) {
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
  const evaluation = await evaluateWhatIf(final, steps, input, budget)
  const response = { stateVersion, policy: whatIfPolicy, sequence: input.sequence, coach: explainFoxWhatIf(evaluation, input.sequence) } as const
  if (evaluation.status === 'limited') {
    const { status, reason, completedLaps, continuation } = evaluation
    return { ...response, status, reason, completedLaps, continuation }
  }
  return { ...response, ...evaluation }
}

export async function analyzeSavedGame(db: Database, userId: string, id: string, input?: WhatIfRequest, signal?: AbortSignal): Promise<WhatIfCatalog | WhatIfEvaluation> {
  const budget = new WhatIfBudget(signal)
  const source = await loadVerifiedWhatIf(db, userId, id, budget, input?.stateVersion, input?.sequence)
  const { stateVersion, steps } = source
  const base = { stateVersion, policy: whatIfPolicy } as const
  if (!input) {
    const decisions = decisionCatalog(steps)
    budget.check()
    return { ...base, decisions }
  }
  return evaluateVerifiedWhatIf(source, input, budget)
}
