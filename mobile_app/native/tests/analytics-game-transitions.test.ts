import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { createGameplayAnalytics } from '../src/analytics/core.ts'
import { localGameSignal, cloudGameSignal } from '../src/analytics/game-signal.ts'
import { sanitizeEvent, type AnalyticsEvent } from '../src/analytics/schema.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { createMobileSession } from '../../src/game/session.ts'
import { fromLocal, setAmount } from '../src/arena-model.ts'
import type { SessionDetail } from '../../src/game/server-session.ts'

test('canonical four-lap local gameplay emits exactly four summaries and one result without changing save', async () => {
  const controller = createMobileSession(createMultiCourseGame('analytics-qa-local', 0, 1))
  let counter = 0
  const sent: AnalyticsEvent[] = []
  const core = createGameplayAnalytics({ configured: true, testMode: true, build: '9', now: () => 1795737600000,
    uuid: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
    hash: async text => createHash('sha256').update(text).digest('hex'),
    storage: { getItem: async () => null, setItem: async () => {} }, send: async events => { sent.push(...events) } })
  await core.initialize(); await core.activate(); await core.setConsent(true)
  await core.gameStarted(localGameSignal(controller.getSnapshot()), false)
  for (let i = 0; i < 120; i++) {
    const before = controller.getSnapshot()
    if (before.phase === 'finished') break
    const arena = fromLocal(before)
    const command = before.phase === 'rolling' ? { type: 'roll' as const }
      : (arena.fixed.find(c => c.skip) ?? arena.fixed[0])?.command ?? setAmount(arena.trades[0], arena.trades[0].max)
    assert.equal(controller.dispatch(command, before), true)
    const next = controller.getSnapshot(), exact = serializeLog(next)
    const signals = [localGameSignal(before), localGameSignal(next)] as const
    await core.transition(...signals); await core.transition(...signals)
    assert.equal(serializeLog(next), exact, 'analytics preserves canonical state and save TEXT')
    await core.flush()
  }
  assert.equal(controller.getSnapshot().phase, 'finished')
  assert.deepEqual(sent.filter(e => e.name === 'lap_completed').map(e => e.properties.lap), [1, 2, 3, 4])
  const result = sent.filter(e => e.name === 'game_completed')
  assert.equal(result.length, 1); assert.equal(result[0].properties.completed_four_laps, true)
  assert.doesNotMatch(JSON.stringify(sent), /analytics-qa-local|cash|savings|journal|portfolio|lawfulProceeds/)
})

test('cloud result projection uses authoritative outcome and discloses no financial values', () => {
  const detail = { session: { id: 'owner-private-session' },
    state: { phase: 'finished', summaries: [{ lap: 1 }, { lap: 2 }] }, result: { outcome: 'insolvent', lawfulProceedsVnd: '123456' } } as unknown as SessionDetail
  assert.deepEqual(cloudGameSignal(detail), { key: 'owner-private-session', mode: 'cloud', completedLaps: [1, 2], outcome: 'insolvent' })
  assert.deepEqual(cloudGameSignal({ ...detail, result: null }).outcome, undefined, 'never invent a missing official result')
})

test('schema rejects non-ISO metadata, unknown events, malformed scores and strips arbitrary data', () => {
  const e = { id: '12345678-1234-5123-8123-123456789abc', anonymousId: '12345678-1234-4123-8123-123456789abc', name: 'app_open', properties: {
    schema_version: 1, platform: 'android', app_build: '9', test_mode: true, first_seen: '2026-11-27T00:00:00.000Z',
    occurred_at: '2026-11-27T00:00:00.000Z', visit_id: '12345678-1234-4123-8123-123456789abc', opening: 'cold_start', email: 'private' } }
  assert.ok(sanitizeEvent(e)); assert.equal(sanitizeEvent(e)!.properties.email, undefined)
  assert.equal(sanitizeEvent({ ...e, name: '$identify' }), null)
  assert.equal(sanitizeEvent({ ...e, properties: { ...e.properties, first_seen: 'private@example.com' } }), null)
  assert.equal(sanitizeEvent({ ...e, properties: { ...e.properties, app_build: 'personal-label' } }), null)
})
