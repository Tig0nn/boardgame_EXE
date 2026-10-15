import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { validateConfig, LABELS } from './spec.mjs'

export const root=resolve('.')
export const hash=value=>createHash('sha256').update(value).digest('hex')
export function sourceManifest() {
  const paths=[]
  for(const dir of ['src/game','src/data','scripts/research/core-mvp'])for(const file of readdirSync(join(root,dir)))if(/\.(ts|mjs)$/.test(file))paths.push(`${dir}/${file}`)
  return Object.fromEntries(paths.sort().map(p=>[p,hash(readFileSync(join(root,p),'utf8').replace(/\r\n/g,'\n'))]))
}
export function createAdapter(config, pristine=false) {
  if(!pristine)validateConfig(config)
  const dir=mkdtempSync(join(tmpdir(),'core-mvp-lab-'))
  for(const sub of ['game','data'])cpSync(join(root,'src',sub),join(dir,'src',sub),{recursive:true})
  mkdirSync(join(dir,'scripts/research/core-mvp'),{recursive:true})
  for(const name of ['worker.mjs','policy.mjs','metrics.mjs','stats.mjs','replay.mjs'])if(readdirSync(join(root,'scripts/research/core-mvp')).includes(name))cpSync(join(root,'scripts/research/core-mvp',name),join(dir,'scripts/research/core-mvp',name))
  writeFileSync(join(dir,'package.json'),'{"type":"module"}')
  writeFileSync(join(dir,'config.json'),JSON.stringify(config,null,2))
  if(pristine)return dir
  const append=(p,text)=>writeFileSync(join(dir,p),readFileSync(join(dir,p),'utf8')+'\n'+text+'\n')
  const replace=(p,from,to)=>{
    const text=readFileSync(join(dir,p),'utf8');if(text.split(from).length!==2)throw Error(`Adapter substitution not unique: ${p}: ${from}`)
    writeFileSync(join(dir,p),text.replace(from,to))
  }
  const e=config.economy
  append('src/data/config.ts',`// ISOLATED RESEARCH COPY; never imported by production.\nObject.assign(RULES, ${JSON.stringify({...e.rules,goal:config.goal.amount,cashGoal:config.goal.reserve,tiles:config.board.tiles.length})});\nObject.assign(ECONOMY, ${JSON.stringify(e.economy)});\nSCENARIOS.splice(0, SCENARIOS.length, ...${JSON.stringify(e.scenarios)});\nMACRO_EVENTS.splice(0, MACRO_EVENTS.length, ...${JSON.stringify(e.macroEvents)});`)
  append('src/data/bond-issuers.ts',e.issuers.map((x,i)=>`Object.assign(BOND_ISSUERS[${i}], ${JSON.stringify(x)});`).join('\n'))
  replace('src/game/savings.ts',"{ id, rates: { 1: .04, 2: .05, 3: .06 } }",`{ id, rates: ${JSON.stringify(e.savingsRates)} }`)
  replace('src/game/living-expenses.ts','PERIODIC_LIVING_COST = 7_000_000',`PERIODIC_LIVING_COST = ${e.livingCost}`)
  replace('src/game/engine.ts','totalLaps:mode ? selected.totalLaps : RULES.laps','totalLaps:RULES.laps')
  // Board layout IDs remain private implementation details inside the clone.
  // Research evidence is wrapped with its own version/config, never schema5.
  replace('src/data/board.ts','export function boardFor(','export function historicalBoardFor(')
  const board=config.board.tiles.map((type,index)=>({index,type,label:LABELS[type],category:['start','course'].includes(type)?'income':['macro','personal'].includes(type)?'shock':'investment',icon:'research',row:0,col:index}))
  append('src/data/board.ts',`export const RESEARCH_BOARD = ${JSON.stringify(board)};\nexport function boardFor(_game: unknown) { return RESEARCH_BOARD; }`)
  // Keep the original one-draw encounter behavior at equal weights; vary only
  // explicit candidate probabilities. A no-op is still a personal encounter.
  replace('src/game/engine.ts','next.eventId = candidates[Math.floor(draw(next) * candidates.length)].id',`const weights = tile === 'macro' ? ${JSON.stringify(e.macroWeights)} : tile === 'personal' ? ${JSON.stringify(e.personalWeights)} : candidates.map(() => 1)\n  const u = draw(next)\n  let pick = u * weights.reduce((a, b) => a + b, 0)\n  next.eventId = candidates.at(-1)!.id\n  for (let i = 0; i < candidates.length; i++) { pick -= weights[i]; if (pick < 0) { next.eventId = candidates[i].id; break } }\n  if (tile === 'personal' && ${e.personalActivation} < 1 && draw(next) >= ${e.personalActivation}) next.eventId = 'research-personal-noop'`)
  append('src/data/events.ts',`EVENTS.push({id:'research-personal-noop',category:'shock',title:'Không phát sinh chi phí',description:'Research activation only',options:[{id:'acknowledge',label:'Tiếp tục',detail:'Không phát sinh chi phí.'}]});`)
  return dir
}
