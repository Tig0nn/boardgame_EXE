import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { GameState } from '../../../src/game/types.ts'
import { createAppAnalysisBinding } from './endgame-analysis-app-binding.ts'
import { createMvpMobileGame, createMobileSession } from './session.ts'

test('observer failures and throwing unsubscribe cannot interrupt replacement or cleanup', () => {
  const adapter = createAppAnalysisBinding({ transport: 'T' })
  const state = createMvpMobileGame('eg2a2-fault', 0, 1)
  let listener: (() => void) | undefined
  let unsubscribeCalls = 0
  const broken = {
    getSnapshot(): GameState { throw Error('read fault') },
    subscribe(callback: () => void) {
      listener = callback
      return () => { unsubscribeCalls++; throw Error('unsubscribe fault') }
    },
  }
  assert.doesNotThrow(() => adapter.replaceSession(broken, 'saved'))
  assert.equal(adapter.inspect().terminal, false)
  assert.doesNotThrow(() => listener?.())
  const healthy = createMobileSession(state)
  assert.doesNotThrow(() => adapter.replaceSession(healthy, 'fresh'))
  assert.equal(unsubscribeCalls, 1)
  assert.equal(adapter.inspect().sessionEpoch, 2)
  assert.doesNotThrow(() => listener?.())
  assert.equal(adapter.inspect().sessionEpoch, 2)
  assert.doesNotThrow(() => { adapter.dispose(); adapter.dispose(); adapter.revoke('home') })
  assert.equal(adapter.read(), null)
  assert.equal(healthy.getSnapshot(), state)
})

test('subscription failure releases authority and permits a later valid attachment', () => {
  const adapter = createAppAnalysisBinding({ transport: 'S' })
  const state = createMvpMobileGame('eg2a2-subscribe', 0, 1)
  assert.doesNotThrow(() => adapter.replaceSession({
    getSnapshot: () => state,
    subscribe: () => { throw Error('subscribe fault') },
  }, 'saved'))
  assert.equal(adapter.inspect().sessionIncarnation, null)
  adapter.replaceSession(createMobileSession(state), 'fresh')
  assert.equal(adapter.inspect().sessionEpoch, 2)
  assert.equal(adapter.inspect().terminal, false)
})
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseHistory } from './endgame-whatif-identity.ts'
import { WorkBudget } from './endgame-whatif-contract.ts'
import { replayHistory } from './endgame-whatif-replay.ts'

test('an unnotified snapshot replacement during capture revokes authority before Worker startup', async () => {
  const text = gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString('utf8')
  const native = (await replayHistory(parseHistory(text), new WorkBudget())).final
  let live = native
  const adapter = createAppAnalysisBinding({ transport: 'S' })
  adapter.replaceSession({ getSnapshot: () => live, subscribe: () => () => {} }, 'saved')
  assert.equal(adapter.inspect().terminal, true)
  const pending = adapter.prepare()
  live = { ...native }
  assert.equal(await pending, null)
  assert.equal(adapter.inspect().reason, 'CAPTURE_INTEGRITY_GAP')
  assert.equal(adapter.inspect().worker, null)
  assert.equal(adapter.read(), null)
})

test('dispose unsubscribes every attached session exactly once', () => {
  const state = createMvpMobileGame('eg2a2-observe', 0, 1)
  const active = new Set<() => void>()
  let unsubscribed = 0
  const session = {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      active.add(listener)
      return () => { assert(active.delete(listener)); unsubscribed++ }
    },
  }
  const adapter = createAppAnalysisBinding({ transport: 'T' })
  for (let i = 0; i < 10; i++) {
    adapter.replaceSession(session, 'fresh')
    assert.equal(active.size, 1)
  }
  adapter.dispose()
  adapter.dispose()
  assert.equal(active.size, 0)
  assert.equal(unsubscribed, 10)
})
