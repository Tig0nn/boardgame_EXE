import { and, desc, eq } from 'drizzle-orm'
import type { SelectedFields } from 'drizzle-orm/pg-core'
import type { Database } from '../db/client.ts'
import { gameSessions, gameSnapshots, scenarioVersions } from '../db/schema.ts'

const sessionFields = {
  id: gameSessions.id,
  scenarioId: gameSessions.scenarioId,
  scenarioVersion: gameSessions.scenarioVersion,
  status: gameSessions.status,
  stateVersion: gameSessions.stateVersion,
  createdAt: gameSessions.createdAt,
  updatedAt: gameSessions.updatedAt,
}

const scenarioFields = {
  gameplayProfile: scenarioVersions.gameplayProfile,
  engineVersion: scenarioVersions.engineVersion,
  resultVersion: scenarioVersions.resultVersion,
  tiles: scenarioVersions.tiles,
  laps: scenarioVersions.laps,
}

export function sessionRepository(db: Pick<Database, 'select' | 'insert'>) {
  const ownedSessions = <T extends SelectedFields>(extra: T) => db.select({ ...sessionFields, ...scenarioFields, ...extra })
    .from(gameSessions)
    .innerJoin(scenarioVersions, and(
      eq(gameSessions.scenarioId, scenarioVersions.scenarioId),
      eq(gameSessions.scenarioVersion, scenarioVersions.version),
    ))

  return {
    async find(userId: string, id: string) {
      const [session] = await ownedSessions({})
        .where(and(eq(gameSessions.userId, userId), eq(gameSessions.id, id)))
      return session
    },
    async lockOwned(userId: string, id: string) {
      const [session] = await ownedSessions({ seed: gameSessions.seed })
        .where(and(eq(gameSessions.userId, userId), eq(gameSessions.id, id)))
        .for('update', { of: gameSessions })
      return session
    },
    async findByCreationKey(userId: string, creationKey: string) {
      const [session] = await ownedSessions({})
        .where(and(eq(gameSessions.userId, userId), eq(gameSessions.creationKey, creationKey)))
      return session
    },
    list(userId: string, limit: number, offset: number) {
      return ownedSessions({})
        .where(eq(gameSessions.userId, userId))
        .orderBy(desc(gameSessions.createdAt), desc(gameSessions.id))
        .limit(limit)
        .offset(offset)
    },
    async scenario(id: string, version: string) {
      const [scenario] = await db.select(scenarioFields).from(scenarioVersions)
        .where(and(eq(scenarioVersions.scenarioId, id), eq(scenarioVersions.version, version)))
      return scenario
    },
    async insert(values: typeof gameSessions.$inferInsert) {
      const [session] = await db.insert(gameSessions).values(values)
        .onConflictDoNothing({ target: [gameSessions.userId, gameSessions.creationKey] })
        .returning(sessionFields)
      return session
    },
    async insertSnapshot(values: typeof gameSnapshots.$inferInsert) {
      await db.insert(gameSnapshots).values(values)
    },
  }
}
