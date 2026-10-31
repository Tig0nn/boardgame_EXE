import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoreMvpGame, createPlayerGame } from '../src/game/new-game.ts'
import { serializeLog } from '../src/game/log.ts'
import { restoreSavedGame, saveGameLocally, loadGameLocally } from '../src/game/saved-game.ts'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import type { GameState } from '../src/game/types.ts'
test('complete B18 log fits browser storage and restores every historical snapshot exactly',()=>{
  const s=restoreSavedGame(gunzipSync(readFileSync('docs/playtests/core-mvp-b18/frozen-B-diversified.json.gz')).toString())
  const storage={value:'',setItem(_k:string,v:string){assert.ok(v.length<1_500_000,'local save must fit UTF-16 storage quota');this.value=v},getItem(){return this.value}}
  assert.equal(saveGameLocally(s,storage),true)
  assert.deepEqual(loadGameLocally(storage),s)
})
test('save/load keeps B18 and C20 exact, never migrates an in-progress old game',()=>{
  for(const s of [createCoreMvpGame('SAVE',0),createPlayerGame('OLD-SAVE',20e6,3,'experimental-b','v2.5-credit-risk','v2.6-periodic-start')]){
    assert.deepEqual(restoreSavedGame(serializeLog(s)),s)
    const storage={value:'',setItem(_k:string,v:string){this.value=v},getItem(){return this.value}}
    assert.equal(saveGameLocally(s,storage),true);assert.deepEqual(loadGameLocally(storage),s)
  }
})
test('unknown/mixed version and invalid position rejected; denied storage leaves game intact',()=>{
  const s=createCoreMvpGame('BAD-SAVE',0),data=JSON.parse(serializeLog(s))
  data.state.boardLayout='C20';assert.throws(()=>restoreSavedGame(JSON.stringify(data)))
  data.state.boardLayout='B18';data.state.log[0].before.goalRulesVersion=undefined;assert.throws(()=>restoreSavedGame(JSON.stringify(data)))
  assert.throws(()=>restoreSavedGame('{bad'))
  assert.equal(saveGameLocally(s,{setItem(){throw Error('quota')}}),false)
  assert.equal(loadGameLocally({getItem(){throw Error('denied')}}),null)
})
test('save import rejects missing balances, empty market and absent credit data before rendering',()=>{
  for(const corrupt of [
    (s:GameState)=>{s.portfolio.cash=undefined as never},
    (s:GameState)=>{s.market.stocks=[]},
    (s:GameState)=>{delete s.bondCredit},
  ]){
    const data=JSON.parse(serializeLog(createCoreMvpGame('MALFORMED',0)))
    corrupt(data.state)
    assert.throws(()=>restoreSavedGame(JSON.stringify(data)))
  }
})
test('all actual B18 browser games and partial funding/trade flows survive compact save continuation',()=>{
  for(const name of ['390-savings','320-cash','390-trades','funding-savings','funding-debt','tile-sale-stocks','tile-sale-bonds']){
    const s=restoreSavedGame(gunzipSync(readFileSync(`docs/playtests/core-mvp-b18/browser-${name}.json.gz`)).toString())
    const storage={value:'',setItem(_k:string,v:string){this.value=v},getItem(){return this.value}}
    assert.equal(saveGameLocally(s,storage),true)
    assert.deepEqual(loadGameLocally(storage),s)
  }
})
