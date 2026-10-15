import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { gzipSync, gunzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { sourceManifest, hash, cleanupAdapter } from '../core-mvp/adapter.mjs'
import { createTradingAdapter } from './adapter.mjs'
import { STRATEGIES, HEURISTICS } from './policy.mjs'
import { compare } from './stats.mjs'

export const out=resolve(process.env.TRADING_AB_OUT??'docs/research/trading-ab')
export const load=p=>JSON.parse(readFileSync(join(out,p),'utf8'))
export const save=(p,v)=>writeFileSync(join(out,p),JSON.stringify(v,null,2)+'\n')
export function sources(){
  const manifest=sourceManifest()
  for(const file of readdirSync('scripts/research/trading-ab'))if(file.endsWith('.mjs')){const p=`scripts/research/trading-ab/${file}`;manifest[p]=hash(readFileSync(p,'utf8').replace(/\r\n/g,'\n'))}
  return manifest
}
export function verifyProtected(){
  const old=JSON.parse(readFileSync('docs/research/core-mvp/artifact-manifest.json','utf8'))
  for(const item of old.files){const bytes=readFileSync(join('docs/research/core-mvp',item.path));if(hash(item.hashNormalization==='UTF-8 LF'?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes)!==item.sha256)throw Error(`Old evidence changed: ${item.path}`)}
  const modified=execFileSync('git',['diff','45b0c4d','--name-only','--diff-filter=MDR'],{encoding:'utf8'}).trim()
  if(modified)throw Error(`Pre-existing file changed: ${modified}`)
  return {oldArtifactsVerified:old.files.length,allExistingTrackedFilesUnchanged:true}
}
export async function run(phase,count){
  if(!Number.isSafeInteger(count)||count<1||count>10000)throw Error('Seed count must be an integer from 1 to 10000')
  mkdirSync(out,{recursive:true})
  if(existsSync(join(out,`${phase}-manifest.json`)))throw Error('Phase already exists; reproduce in a fresh TRADING_AB_OUT folder')
  verifyProtected()
  const c=JSON.parse(readFileSync('docs/research/core-mvp/frozen-configs.json','utf8')).configs.filter(c=>c.economy.rules.laps!==3),heuristic=phase==='control'?'legacy':phase==='sensitivity'?'wide':'disciplined'
  const seeds=Array.from({length:count},(_,i)=>`TRADING-AB-${phase.toUpperCase()}-${i}`),source=sources(),sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),started=new Date().toISOString()
  const manifest={version:'trading-ab-v1',phase,started,sourceSha,sourceHashes:source,sourceBase:'45b0c4d',oldResearchBranchPushed:true,node:process.version,count,heuristic,heuristicParameters:HEURISTICS[heuristic]??'original visible-v1, no tile sell intent',strategies:STRATEGIES,seeds,
    configs:c,configHashes:Object.fromEntries(c.map(x=>[x.id,hash(JSON.stringify(x))])),arms:['old','new'],
    intentRule:'Same visible sell intents and buy rules. Old-arm illegal tile sell intent becomes skip until START. Counter-based synthetic intent noise. Both retain START/funding sales.',
    expansionGate:'Only if potentially choice-changing paired effect >3 percentage points or >1M VND and uncertainty/ranking ambiguity remains; new seeds, affected pairs only.'}
  save(`${phase}-manifest.json`,manifest)
  writeFileSync(join(out,`${phase}-source.json.gz`),gzipSync(JSON.stringify({sourceSha,files:Object.fromEntries(Object.keys(source).map(p=>[p,readFileSync(p,'utf8').replace(/\r\n/g,'\n')]))})))
  const jobs=c.flatMap(config=>['old','new'].map(arm=>({config,arm}))),phaseDir=join(out,phase);mkdirSync(phaseDir,{recursive:true});let next=0
  async function worker(){while(next<jobs.length){const {config,arm}=jobs[next++],dir=createTradingAdapter(config,arm),target=join(phaseDir,`${config.id}.${arm}`)
    const job={arm,heuristic,strategies:STRATEGIES,seeds}
    writeFileSync(join(dir,'job.json'),JSON.stringify(job));writeFileSync(`${target}.config.json`,JSON.stringify(config,null,2)+'\n')
    try{
      await new Promise((ok,fail)=>{const child=spawn(process.execPath,['--experimental-strip-types',join(dir,'scripts/research/trading-ab/worker.mjs'),join(dir,'config.json'),join(dir,'job.json'),target],{windowsHide:true,stdio:['ignore','pipe','pipe']});let err='';child.stdout.on('data',x=>process.stdout.write(x));child.stderr.on('data',x=>err+=x);child.on('error',fail);child.on('exit',code=>code===0?ok():fail(Error(err)))})
    }finally{cleanupAdapter(dir)}
  }}
  await Promise.all(Array.from({length:4},worker))
  if(JSON.stringify(source)!==JSON.stringify(sources()))throw Error('Research source changed while running')
  const summaries=jobs.map(({config,arm})=>load(`${phase}/${config.id}.${arm}.summary.json`)),pairs=[]
  for(const config of c){
    const raw=arm=>JSON.parse(gunzipSync(readFileSync(join(phaseDir,`${config.id}.${arm}.rows.json.gz`))))
    const old=raw('old'),fresh=raw('new')
    pairs.push({id:config.id,strategies:Object.fromEntries(STRATEGIES.map(p=>[p,compare(fresh.filter(r=>r.policy===p),old.filter(r=>r.policy===p))]))})
    if(phase==='control')for(let i=0;i<old.length;i++){
      const {arm:a,...x}=old[i],{arm:b,...y}=fresh[i]
      if(JSON.stringify(x)!==JSON.stringify(y))throw Error(`Negative control changed: ${config.id}/${x.policy}/${x.seed}`)
    }
  }
  save(`${phase}-results.json`,{phase,games:jobs.length*STRATEGIES.length*count,started,finished:new Date().toISOString(),elapsedSeconds:(Date.now()-Date.parse(started))/1000,summaries,pairs,protected:verifyProtected()})
  console.log(JSON.stringify({phase,games:jobs.length*STRATEGIES.length*count,seconds:(Date.now()-Date.parse(started))/1000}))
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const phase=process.argv[2];if(!['control','main','sensitivity'].includes(phase))throw Error('Use control|main|sensitivity');await run(phase,Number(process.argv[3]??(phase==='control'?30:500)))}
