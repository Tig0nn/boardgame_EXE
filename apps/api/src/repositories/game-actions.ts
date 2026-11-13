import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '../db/client.ts'
import { gameActions, gameResults, gameSessions, gameSnapshots } from '../db/schema.ts'

export function actionRepository(db: Pick<Database, 'select' | 'insert' | 'update'>) {
  return {
    async findByKey(sessionId: string, key: string) {
      const [action] = await db.select().from(gameActions)
        .where(and(eq(gameActions.sessionId, sessionId), eq(gameActions.idempotencyKey, key)))
      return action
    },
    async snapshot(sessionId: string, stateVersion: number) {
      const [snapshot] = await db.select().from(gameSnapshots)
        .where(and(eq(gameSnapshots.sessionId, sessionId), eq(gameSnapshots.stateVersion, stateVersion)))
      return snapshot
    },
    async insertAction(values: typeof gameActions.$inferInsert) {
      await db.insert(gameActions).values(values)
    },
    async updateSession(sessionId: string, stateVersion: number, status: 'active' | 'completed') {
      await db.update(gameSessions)
        .set({ stateVersion, status, updatedAt: sql`statement_timestamp()` })
        .where(eq(gameSessions.id, sessionId))
    },
    async insertResult(values: typeof gameResults.$inferInsert) {
      await db.insert(gameResults).values(values)
    },
  }
}
