import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { EndgameAppBinding } from './endgame-analysis-app-binding.ts'
import type { Response } from './endgame-analysis-protocol.ts'
import { createEndgameUiController, isEndgameDevQuery } from './endgame-whatif-ui-controller.ts'

const proof = JSON.parse(readFileSync(new URL('../../../docs/playtests/whatif-endgame/2026-11-07/eg2a-2-05/browser-attempt-07/positive-320-T-1.json', import.meta.url), 'utf8')) as {
  stages: { result: Response }[]
}

function fixture() {
  const [source, catalog, blocker, final] = structuredClone(proof.stages.map(stage => stage.result))
  const id = source.envelope
  const status = {
    terminal: true,
    reason: null as string | null,
    controllerIncarnation: id.controllerIncarnation,
    sessionIncarnation: id.sessionIncarnation,
    sessionEpoch: id.sessionEpoch,
    captureId: null as string | null,
    captureRevision: null as number | null,
  }
  let observed: (() => void) | undefined
  let read: Response | null = final
  const calls: string[] = []
  const binding: Pick<EndgameAppBinding, 'prepare' | 'list' | 'create' | 'followUp' | 'read' | 'cancel'> & { inspect: () => typeof status } = {
    inspect: () => ({ ...status }),
    async prepare() {
      calls.push('prepare')
      status.captureId = id.captureId
      status.captureRevision = id.captureRevision
      return source
    },
    async list() { calls.push('list'); return catalog },
    async create() { calls.push('create'); return blocker },
    async followUp(input) {
      calls.push('followUp')
      assert.deepEqual(input, {
        continuation: blocker.body.continuation,
        blocker: blocker.body.blocker,
        choice: { kind: 'gold-skip', optionId: 'skip' },
      })
      return final
    },
    read() { calls.push('read'); return read },
    cancel() { calls.push('cancel'); status.captureId = null; status.captureRevision = null },
  }
  const ui = createEndgameUiController(binding)
  const detach = ui.mount(listener => { observed = listener; return () => { observed = undefined } })
  return { ui, binding, calls, status, blocker, final, catalog, detach,
    notify: () => observed?.(),
    setRead: (response: Response | null) => { read = response },
  }
}

async function toFollowup({ ui }: ReturnType<typeof fixture>) {
  await ui.open()
  await ui.create(4, 'skip')
  assert.equal(ui.getSnapshot().kind, 'followup')
}

test('DEV entry accepts only the exact unmixed opt-in', () => {
  assert(isEndgameDevQuery('?endgameWhatIf=1'))
  for (const search of ['', '?endgameWhatIf=0', '?endgameWhatIf=1&endgameWhatIf=1',
    '?endgameWhatIf=1&whatIfDemo=repair', '?endgameWhatIf=1&goldHistoricalWhatIf=1',
    '?endgameWhatIf=1&historicalWhatIf=1', '?endgameWhatIf=1&whatIf=1',
    '?endgameWhatIf=1&repairAi=1', '?endgameWhatIf=1&universalAi=1']) {
    assert(!isEndgameDevQuery(search), search)
  }
})

test('ineligible terminal cannot start work and mount alone creates no Worker', async () => {
  const f = fixture()
  f.status.terminal = false
  f.notify()
  await f.ui.open()
  assert.equal(f.calls.length, 0)
  assert.equal(f.ui.getSnapshot().kind, 'ineligible')
})

test('requires explicit initial and follow-up actions, then publishes via guarded read', async () => {
  const f = fixture()
  assert.equal(f.calls.length, 0)
  await f.ui.open()
  assert.equal(f.ui.getSnapshot().kind, 'catalog')
  await f.ui.create(99, 'skip')
  await f.ui.create(4, null)
  assert.deepEqual(f.calls, ['prepare', 'list'])
  await f.ui.create(4, 'skip')
  assert.deepEqual(f.calls, ['prepare', 'list', 'create'])
  assert.equal(f.ui.getSnapshot().kind, 'followup')
  await f.ui.followUp()
  assert.equal(f.ui.getSnapshot().kind, 'final-read')
  assert(!f.calls.includes('read'))
  f.ui.readFinal()
  const view = f.ui.getSnapshot()
  assert.equal(view.kind, 'final')
  if (view.kind !== 'final') return
  assert.equal(view.rows.find(row => row.key === 'cash')?.delta, '+104.006 ₫')
  assert.equal(view.combined, true)
  f.ui.close()
  assert.equal(f.ui.getSnapshot().kind, 'closed')
  assert.equal(f.calls.at(-1), 'cancel')
})

test('blocks a stale or unguarded result even after verified final publication', async () => {
  const f = fixture()
  await toFollowup(f)
  await f.ui.followUp()
  f.setRead(null)
  f.ui.readFinal()
  assert.equal(f.ui.getSnapshot().kind, 'revoked')
  assert(!('rows' in f.ui.getSnapshot()))
})

test('same-source ABA during resume cannot publish or cancel the new capture', async () => {
  const f = fixture()
  await toFollowup(f)
  let release: (result: Response) => void = () => { throw Error('resume not started') }
  f.binding.followUp = () => new Promise(resolve => { release = resolve })
  const pending = f.ui.followUp()
  f.status.sessionEpoch++
  f.status.sessionIncarnation = crypto.randomUUID()
  f.status.captureId = crypto.randomUUID()
  f.notify()
  release(f.final)
  await pending
  assert(!('rows' in f.ui.getSnapshot()))
  assert(!f.calls.includes('cancel'))
})

test('ignores late CREATE after close and late RESUME after unmount', async () => {
  const f = fixture()
  await f.ui.open()
  const create = f.binding.create
  let release: (result: Response) => void = () => { throw Error('job not started') }
  f.binding.create = () => new Promise(resolve => { release = resolve })
  const pending = f.ui.create(4, 'skip')
  f.ui.close()
  await f.ui.open()
  release(f.blocker)
  await pending
  assert.equal(f.ui.getSnapshot().kind, 'catalog')
  f.binding.create = create
  await f.ui.create(4, 'skip')
  f.binding.followUp = () => new Promise(resolve => { release = resolve })
  const resume = f.ui.followUp()
  f.detach()
  release(f.final)
  await resume
  assert.equal(f.ui.getSnapshot().kind, 'ineligible')
})

test('unknown commit clears the capture and does not retry', async () => {
  const f = fixture()
  await toFollowup(f)
  f.binding.followUp = async () => ({
    ...f.final, kind: 'CANCELLED', body: { reason: 'transport-timeout-unknown-commit', commit: 'unknown' },
  })
  await f.ui.followUp()
  assert.equal(f.ui.getSnapshot().kind, 'timeout')
  await f.ui.followUp()
  assert.equal(f.ui.getSnapshot().kind, 'timeout')
  assert.equal(f.calls.at(-1), 'cancel')
})

test('final guarded read rejects a different job even with the same source', async () => {
  const f = fixture()
  await toFollowup(f)
  await f.ui.followUp()
  f.setRead({ ...f.final, envelope: { ...f.final.envelope, jobId: crypto.randomUUID() } })
  f.ui.readFinal()
  assert.equal(f.ui.getSnapshot().kind, 'revoked')
})
