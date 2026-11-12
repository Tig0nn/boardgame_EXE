import { eq } from 'drizzle-orm'
import type { Database } from '../db/client.ts'
import { profiles } from '../db/schema.ts'

export async function insertProfileIfMissing(db: Pick<Database, 'insert'>, userId: string) {
  const [created] = await db.insert(profiles).values({ userId }).onConflictDoNothing().returning()
  return created
}

export async function getOrCreateProfile(db: Database, userId: string) {
  const created = await insertProfileIfMissing(db, userId)
  if (created) return created

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId))
  if (!profile) throw new Error('Player profile lookup failed')
  return profile
}
