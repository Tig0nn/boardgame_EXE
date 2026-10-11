import test from 'node:test'
import assert from 'node:assert/strict'
import { BOARD } from '../../src/data/board.ts'
import { RULES } from '../../src/data/config.ts'
import { layouts, withBoard, playBoard, allocation } from './board-balance-model.ts'
import { playDiagnostic } from './game-length-model.ts'
import { movementExpectation } from './board-balance-statistics.ts'

test('experimental boards restore shared data, including after a failure', () => {
  const before = structuredClone(BOARD)
  assert.throws(() => withBoard(layouts.find(l => l.id === 'F16')!, () => {
    assert.equal(RULES.tiles, 16)
    throw new Error('expected')
  }), /expected/)
  assert.deepEqual(BOARD, before)
  assert.equal(RULES.tiles, 20)
  assert.equal(RULES.laps, 3)
})
test('B/C replace exactly one category; D preserves every count', () => {
  const a = allocation(layouts[0])
  assert.deepEqual(allocation(layouts[1]), { ...a, business: 3, course: 1 })
  assert.deepEqual(allocation(layouts[2]), { ...a, business: 3, macro: 1 })
  assert.deepEqual(allocation(layouts[3]), a)
})
test('control reproduces the old runner; diagnostics count encounters before transactions', () => {
  const seed = 'XVTL-V2-42'
  const control = playBoard(seed, 'business-heavy', layouts[0])
  assert.deepEqual(control.run, playDiagnostic(seed, 'business-heavy', 4).run)
  assert.equal(control.audit.resolvedVisits.reduce((a, b) => a + b, 0), control.run.eventDecisions)
  assert.equal(control.audit.rawLandings.reduce((a, b) => a + b, 0), control.run.rolls)
  assert.equal(control.audit.types.business.visits, control.run.businessEncounters)
})
test('same-size layouts retain paired dice paths; 16/24 preserve engine terminal semantics', () => {
  for (const seed of ['XVTL-V2-1', 'XVTL-V2-42', 'XVTL-V2-400']) {
    const a = playBoard(seed, 'business-heavy', layouts[0])
    for (const layout of layouts) {
      const b = playBoard(seed, 'business-heavy', layout)
      if (layout.types.length === 20) assert.deepEqual(b.run.path, a.run.path)
      assert.equal(b.run.completedLaps, 4)
      assert.equal(b.run.accountingResidual, 0)
      assert.equal(b.audit.rawLandings.length, layout.types.length)
      assert.equal(b.audit.terminalIgnoredLandings, Number(b.audit.finalRawPosition !== 0))
      assert.ok(b.audit.meaningfulEncounters <= b.run.eventDecisions)
      assert.equal(b.run.rolls, b.run.eventDecisions + b.audit.rawLandings[0] + b.audit.terminalIgnoredLandings)
      for (const type of ['bank','stocks','bonds','gold','business'] as const) {
        const item = b.audit.types[type]
        assert.equal(item.targeted, item.eligible + item.blockedCash + item.blockedHorizon + item.blockedCap)
      }
      assert.equal(b.audit.types.course.transactions, Number(b.run.course))
    }
  }
})
test('renewal calculation agrees with an analytically enumerable single six-tile circuit', () => {
  const expected = movementExpectation({ id: 'small', rationale: 'test', types: ['start','business','bank','stocks','living','macro'] },1)
  assert.ok(Math.abs(expected.expectedRolls - (7/6)**5) < 1e-12)
  assert.equal(expected.expectedResolvedVisitsByTile[1], 1/6)
  assert.ok(Math.abs(expected.neverRateByType.business - 5/6) < 1e-12)
})
