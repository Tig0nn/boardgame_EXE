import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMvpMobileGame, createMobileSession } from './session.ts'
import { createAppAnalysisBinding } from './endgame-analysis-app-binding.ts'

test('ordinary active session has an identity but does not register a terminal capture', async () => {
  const adapter = createAppAnalysisBinding({ transport: 'T' })
  const session = createMobileSession(createMvpMobileGame('eg2a2-active', 0, 1))
  adapter.replaceSession(session, 'fresh')
  assert.equal(adapter.inspect().sessionEpoch, 1)
  assert.equal(adapter.inspect().terminal, false)
  assert.equal(await adapter.prepare(), null)
  assert.equal(adapter.read(), null)
  assert.equal(adapter.inspect().worker, null)
  adapter.dispose()
})

test('reattaching the same content creates a new session incarnation', () => {
  const adapter = createAppAnalysisBinding({ transport: 'S' })
  const state = createMvpMobileGame('eg2a2-aba', 0, 1)
  adapter.replaceSession(createMobileSession(state), 'fresh')
  const first = adapter.inspect()
  adapter.replaceSession(createMobileSession(state), 'saved')
  const second = adapter.inspect()
  assert.notEqual(second.sessionIncarnation, first.sessionIncarnation)
  assert.equal(second.sessionEpoch, first.sessionEpoch + 1)
  adapter.revoke('home')
  assert.equal(adapter.inspect().sessionIncarnation, null)
  assert.equal(adapter.read(), null)
})
