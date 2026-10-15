import { mkdirSync, readdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { createAdapter, root } from '../core-mvp/adapter.mjs'

export function createTradingAdapter(config,arm){
  if(!['old','new'].includes(arm))throw Error('Unknown trading arm')
  const dir=createAdapter(config)
  mkdirSync(join(dir,'scripts/research/trading-ab'),{recursive:true})
  for(const file of ['policy.mjs','metrics.mjs','worker.mjs','stats.mjs'])if(readdirSync(join(root,'scripts/research/trading-ab')).includes(file))cpSync(join(root,'scripts/research/trading-ab',file),join(dir,'scripts/research/trading-ab',file))
  if(arm==='old')return dir
  const path=join(dir,'src/game/transactions.ts')
  let source=readFileSync(path,'utf8')
  const replace=(from,to)=>{if(source.split(from).length!==2)throw Error(`Trading substitution not unique: ${from}`);source=source.replace(from,to)}
  replace('export function transact(state: GameState, action: RebalanceAction): GameState {','function transactCore(state: GameState, action: RebalanceAction): GameState {')
  replace("const checkpoint = state.phase === 'rebalancing'",`const checkpoint = state.phase === 'rebalancing'\n  const researchTileSale = state.phase === 'event' && state.eventId === tile && action.kind === 'sell' && action.asset === tile && ['stocks', 'bonds', 'gold'].includes(tile)`)
  replace("if (!checkpoint || !asset || !['stocks', 'bonds', 'gold'].includes(asset))", "if ((!checkpoint && !researchTileSale) || !asset || !['stocks', 'bonds', 'gold'].includes(asset))")
  replace('const completeEncounter = action.completeEncounter || atomicInvestment','const completeEncounter = action.completeEncounter || atomicInvestment || researchTileSale')
  source+=`\n// Private research extension. Never copied into production or historical exports.\nexport function transact(state: GameState, action: RebalanceAction): GameState {\n  const financial = !!action.asset && ['stocks', 'bonds', 'gold'].includes(action.asset) && ['buy', 'sell'].includes(action.kind);\n  if (state.phase === 'event' && financial && state.log.some(e => e.kind === 'rebalancing' && e.turn === state.turn && e.before.phase === 'event' && e.action && ['buy', 'sell'].includes(e.action.kind) && e.action.asset && ['stocks', 'bonds', 'gold'].includes(e.action.asset))) throw new Error('Mỗi lượt ghé chỉ được một giao dịch thành công.');\n  return transactCore(state, action);\n}\n`
  writeFileSync(path,source)
  return dir
}
