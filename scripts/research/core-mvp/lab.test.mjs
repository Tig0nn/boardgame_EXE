import test from 'node:test'
import assert from 'node:assert/strict'
import { validateConfig, baselineConfig, makeLayouts, dicePath, opportunityMetrics } from './spec.mjs'
import { createAdapter, sourceManifest } from './adapter.mjs'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { createGame } from '../../../src/game/engine.ts'

test('candidate has exactly the approved types and one START', () => {
  const configs = makeLayouts()
  assert.ok(configs.some(c => c.board.tiles.length === 16))
  assert.ok(configs.some(c => c.board.tiles.length === 24))
  for (const c of configs) validateConfig(c)
  const bad = structuredClone(configs[0]); bad.board.tiles[1] = 'obligation'
  assert.throws(() => validateConfig(bad), /tile/)
})
test('counts and permutations are independent experimental factors', () => {
  const layouts = makeLayouts().filter(c => c.board.tiles.length === 20 && c.board.countProfile === 'balanced')
  const count = c => Object.fromEntries([...new Set(c.board.tiles)].sort().map(k => [k, c.board.tiles.filter(x => x === k).length]))
  assert.deepEqual(count(layouts[0]), count(layouts[1]))
  assert.notDeepEqual(layouts[0].board.tiles, layouts[1].board.tiles)
})
test('D6 wraps overflow and omits terminal landing', () => {
  const path = dicePath(16, 3, () => 6)
  assert.equal(path.rolls, 8)
  assert.equal(path.landings.length, 7)
  assert.deepEqual(path.landings.map(x => x.position), [6, 12, 2, 8, 14, 4, 10])
  assert.equal(path.completedStarts, 3)
})
test('START landing has no decision; first encounter and Business revisit use processed landings', () => {
  const c = baselineConfig()
  c.board.tiles = ['start','business','course','bank','stocks','macro','bonds','personal','gold','business','course','bank','stocks','macro','bonds','gold']
  const m = opportunityMetrics(c.board.tiles, { rolls: 5, landings: [{ position: 1, turn: 1, lap: 1 }, {position: 0, turn: 2, lap: 2}, {position: 9, turn: 4, lap: 2}], completedStarts: 3 })
  assert.equal(m.decisions, 2)
  assert.equal(m.encounters.business, 2)
  assert.deepEqual(m.businessGaps, [3])
  assert.equal(m.first.course, null)
})
test('config rejects invalid allocation and non-finite parameters', () => {
  const c = baselineConfig(); c.economy.initialSavings = c.economy.rules.startingCapital + 1
  assert.throws(() => validateConfig(c), /allocation/)
})

test('pristine isolated engine produces the exact production setup, including RNG', async () => {
  const dir=createAdapter(baselineConfig(),true)
  try{
    const engine=await import(pathToFileURL(join(dir,'src/game/engine.ts')))
    assert.deepEqual(engine.createGame('CLONE',20e6,3,'experimental-b'),createGame('CLONE',20e6,3,'experimental-b'))
  }finally{rmSync(dir,{recursive:true,force:true})}
})
test('modified engine runs all policies, final START count and replay deterministically; production unchanged', async () => {
  const before=sourceManifest(),c=baselineConfig();c.economy.rules.laps=5;c.economy.rules.startingCapital=55e6;c.economy.initialSavings=0
  const dir=createAdapter(c)
  try{
    const {play,POLICIES}=await import(pathToFileURL(join(dir,'scripts/research/core-mvp/policy.mjs')))
    const {replayResearch}=await import(pathToFileURL(join(dir,'scripts/research/core-mvp/replay.mjs')))
    for(const policy of POLICIES){const a=play('ADAPTER-1',policy,c,{trace:true}),b=play('ADAPTER-1',policy,c,{trace:true});assert.deepEqual(a,b);assert.equal(a.state.summaries.length,5);assert.ok(a.row.proceeds>=0);replayResearch(a.state,c)}
    assert.deepEqual(sourceManifest(),before)
  }finally{rmSync(dir,{recursive:true,force:true})}
})
