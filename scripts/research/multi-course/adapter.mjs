import {cpSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,readdirSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve,dirname,basename} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {BASE_SHA,UPSTREAM_SHA} from './spec.mjs'
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
export const upstreamPaths=['core-mvp/policy.mjs','core-mvp/metrics.mjs','trading-ab/policy.mjs','trading-ab/metrics.mjs','risk-allocation/policy.mjs','risk-allocation/metrics.mjs']
export function sources(){
  const files={}
  for(const sub of ['src/game','src/data','scripts/research/multi-course'])for(const f of readdirSync(sub))if(/\.(ts|mjs)$/.test(f))files[`${sub}/${f}`]=readFileSync(join(sub,f),'utf8').replaceAll('\r\n','\n')
  for(const p of upstreamPaths)files[`upstream/${p}`]=execFileSync('git',['show',`${UPSTREAM_SHA}:scripts/research/${p}`],{encoding:'utf8'}).replaceAll('\r\n','\n')
  return {base:BASE_SHA,upstream:UPSTREAM_SHA,files,hashes:Object.fromEntries(Object.entries(files).map(([p,v])=>[p,hash(v)]))}
}
export function createAdapter(c){
  const dir=mkdtempSync(join(tmpdir(),'b18-course-lab-'))
  for(const sub of ['src/game','src/data','scripts/research/multi-course'])cpSync(sub,join(dir,sub),{recursive:true})
  for(const p of upstreamPaths){const target=join(dir,'scripts/research',p);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,execFileSync('git',['show',`${UPSTREAM_SHA}:scripts/research/${p}`]))}
  writeFileSync(join(dir,'package.json'),'{"type":"module"}')
  writeFileSync(join(dir,'config.json'),JSON.stringify(c,null,2))
  const path=join(dir,'src/data/board.ts'),text=readFileSync(path,'utf8')
  if(text.split('export function boardFor(').length!==2)throw Error('Board adapter substitution not unique')
  // Only private clone is changed. B18 version metadata lives inside a distinct
  // research wrapper and is never exported as a production schema6 replay.
  writeFileSync(path,text.replace('export function boardFor(','export function productionBoardFor(')+`\nconst researchTypes=${JSON.stringify(c.board.tiles)};\nexport function boardFor(game:Parameters<typeof productionBoardFor>[0]){const board=productionBoardFor(game);return board.map((t,i)=>({...board.find(x=>x.type===researchTypes[i])!,index:i,row:t.row,col:t.col}));}\n`)
  return dir
}
export function cleanup(dir){
  const target=resolve(dir)
  if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('b18-course-lab-'))throw Error('Refusing cleanup outside verified temporary prefix/parent')
  rmSync(target,{recursive:true,force:true})
}
