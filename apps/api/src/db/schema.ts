import { sql } from 'drizzle-orm'
import {
  bigint, check, foreignKey, index, integer, jsonb, pgEnum, pgTable,
  primaryKey, text, timestamp, unique, uuid,
} from 'drizzle-orm/pg-core'

const timestampWithZone = (name: string) => timestamp(name, { withTimezone: true })
const jsonObject = (name: string) => jsonb(name).$type<Record<string, unknown>>()

export const sessionStatus = pgEnum('game_session_status', ['active', 'completed', 'abandoned'])
export const resultOutcome = pgEnum('game_result_outcome', ['victory', 'defeat', 'insolvent'])

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey(),
  createdAt: timestampWithZone('created_at').notNull().defaultNow(),
})

export const scenarioVersions = pgTable('scenario_versions', {
  scenarioId: text('scenario_id').notNull(),
  version: text('version').notNull(),
  gameplayProfile: text('gameplay_profile').notNull(),
  engineVersion: text('engine_version').notNull(),
  resultVersion: text('result_version').notNull(),
  tiles: integer('tile_count').notNull(),
  laps: integer('lap_count').notNull(),
}, table => [
  primaryKey({ columns: [table.scenarioId, table.version] }),
  check('scenario_versions_dimensions_check', sql`${table.tiles} > 0 AND ${table.laps} > 0`),
])

export const gameSessions = pgTable('game_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.userId),
  scenarioId: text('scenario_id').notNull(),
  scenarioVersion: text('scenario_version').notNull(),
  creationKey: uuid('creation_key').notNull(),
  seed: text('seed').notNull(),
  status: sessionStatus('status').notNull().default('active'),
  stateVersion: integer('state_version').notNull().default(0),
  createdAt: timestampWithZone('created_at').notNull().defaultNow(),
  updatedAt: timestampWithZone('updated_at').notNull().defaultNow(),
}, table => [
  foreignKey({
    name: 'game_sessions_scenario_version_fk',
    columns: [table.scenarioId, table.scenarioVersion],
    foreignColumns: [scenarioVersions.scenarioId, scenarioVersions.version],
  }),
  unique('game_sessions_user_creation_key_unique').on(table.userId, table.creationKey),
  index('game_sessions_user_created_idx').on(table.userId, table.createdAt.desc(), table.id.desc()),
  index('game_sessions_scenario_idx').on(table.scenarioId, table.scenarioVersion),
  check('game_sessions_state_version_check', sql`${table.stateVersion} >= 0`),
  check('game_sessions_seed_check', sql`${table.seed} ~ '^[0-9a-f]{32}$'`),
])

export const gameActions = pgTable('game_actions', {
  sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  sequence: integer('sequence').notNull(),
  idempotencyKey: uuid('idempotency_key').notNull(),
  actionType: text('action_type').notNull(),
  payload: jsonObject('payload').notNull(),
  engineVersion: text('engine_version').notNull(),
  resultVersion: text('result_version').notNull(),
  createdAt: timestampWithZone('created_at').notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.sessionId, table.sequence] }),
  unique('game_actions_session_key_unique').on(table.sessionId, table.idempotencyKey),
  check('game_actions_sequence_check', sql`${table.sequence} > 0`),
  check('game_actions_payload_check', sql`jsonb_typeof(${table.payload}) = 'object'`),
])

export const gameSnapshots = pgTable('game_snapshots', {
  sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  stateVersion: integer('state_version').notNull(),
  schemaVersion: integer('schema_version').notNull(),
  payload: text('payload').notNull(),
  createdAt: timestampWithZone('created_at').notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.sessionId, table.stateVersion] }),
  check('game_snapshots_state_version_check', sql`${table.stateVersion} >= 0`),
  check('game_snapshots_schema_version_check', sql`
    ${table.schemaVersion} > 0
    AND jsonb_typeof(${table.payload}::jsonb) = 'object'
    AND (${table.payload}::jsonb->'schemaVersion' = to_jsonb(${table.schemaVersion})) IS TRUE
  `),
])

export const gameResults = pgTable('game_results', {
  sessionId: uuid('session_id').primaryKey(),
  stateVersion: integer('state_version').notNull(),
  outcome: resultOutcome('outcome').notNull(),
  lawfulProceedsVnd: bigint('lawful_proceeds_vnd', { mode: 'bigint' }).notNull(),
  engineVersion: text('engine_version').notNull(),
  resultVersion: text('result_version').notNull(),
  createdAt: timestampWithZone('created_at').notNull().defaultNow(),
}, table => [
  foreignKey({
    name: 'game_results_final_snapshot_fk',
    columns: [table.sessionId, table.stateVersion],
    foreignColumns: [gameSnapshots.sessionId, gameSnapshots.stateVersion],
  }),
  check('game_results_final_state_check', sql`${table.stateVersion} > 0`),
  check('game_results_proceeds_check', sql`${table.lawfulProceedsVnd} BETWEEN -9007199254740991 AND 9007199254740991`),
])

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').notNull().references(() => profiles.userId),
  actionType: text('action_type').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  details: jsonObject('details').notNull().default({}),
  createdAt: timestampWithZone('created_at').notNull().defaultNow(),
}, table => [
  index('admin_audit_logs_actor_created_idx').on(table.actorId, table.createdAt.desc()),
  index('admin_audit_logs_target_idx').on(table.targetType, table.targetId, table.createdAt.desc()),
  check('admin_audit_logs_details_check', sql`jsonb_typeof(${table.details}) = 'object'`),
])
