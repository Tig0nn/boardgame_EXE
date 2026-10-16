import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { sourceManifest, hash, cleanupAdapter } from '../core-mvp/adapter.mjs'
import { createStudyAdapter } from './adapter.mjs'
import { studyConfigs, reserveConfig, STRATEGIES } from './spec.mjs'

export const out=resolve(process.env.RISK_STUDY_OUT??'docs/research/risk-allocation')
export const load=p=>JSON.parse(readFileSync(join(out,p),'utf8'))
export const save=(p,v)=>writeFileSync(join(out,p),JSON.stringify(v,null,2)+'\n')
export function sources(){
  const m=sourceManifest()
  for(const sub of ['trading-ab','risk-allocation'])for(const f of readdirSync(`scripts/research/${sub}`))if(f.endsWith('.mjs')){const p=`scripts/research/${sub}/${f}`;m[p]=hash(readFileSync(p,'utf8').replace(/\r\n/g,'\n'))}
  return m
}
export function verifyProtected(){
  const counts={}
  for(const sub of ['core-mvp','trading-ab']){
    const root=`docs/research/${sub}`,manifest=JSON.parse(readFileSync(`${root}/artifact-manifest.json`,'utf8'))
    for(const f of manifest.files){const b=readFileSync(join(root,f.path));if(hash((f.normalization??f.hashNormalization)==='UTF-8 LF'?b.toString('utf8').replace(/\r\n/g,'\n'):b)!==f.sha256)throw Error(`Protected artifact changed: ${sub}/${f.path}`)}
    counts[sub]=manifest.files.length
  }
  const modified=execFileSync('git',['diff','33de122','--name-only','--diff-filter=MDR'],{encoding:'utf8'}).trim()
  if(modified)throw Error(`Existing file modified: ${modified}`)
  if(execFileSync('git',['rev-parse','codex/core-mvp-trading-ab'],{encoding:'utf8'}).trim()!=='33de1229e36fb5fb8a0df63cf4cf6899720cd3f4')throw Error('Trading source ref changed')
  return {artifacts:counts,allExistingTrackedFilesUnchanged:true,tradingCommitPreserved:true}
}
export function jobsFor(phase,replacements){
  const cs=studyConfigs(replacements),job=(id,config,strategies=STRATEGIES)=>({id,config,strategies,mode:phase==='audit'?'audit':'allocation'})
  if(phase==='audit')return ['B','D'].map(id=>job(id,cs[id],STRATEGIES.filter(p=>p!=='risk-aware')))
  if(phase==='screen')return Object.entries(cs).map(([id,c])=>job(id,c))
  if(phase==='course-control')return ['B','D','B-personal','D-personal'].map(id=>job(id,cs[id],['cash-course']))
  if(phase==='reserve')return ['B','D'].flatMap(id=>[0,5e6,15e6].map(r=>job(`${id}-r${r/1e6}`,reserveConfig(cs[id],r),['savings','stocks','diversified'])))
  if(phase==='reserve-variant')return ['B-personal','D-personal'].flatMap(id=>[0,5e6,15e6].map(r=>job(`${id}-r${r/1e6}`,reserveConfig(cs[id],r),['savings','stocks','diversified'])))
  if(phase==='holdout'){const freeze=load('holdout-freeze.json');return [...freeze.candidates.map(id=>job(id,freeze.configs[id])),...freeze.reserveJobs.map(j=>job(j.id,j.config,j.strategies))]}
  throw Error('Unknown phase')
}
export async function run(phase,count=120){
  if(!Number.isInteger(count)||count<1||count>1000)throw Error('Small study only: 1..1000 seeds')
  mkdirSync(out,{recursive:true});verifyProtected()
  if(existsSync(join(out,`${phase}-manifest.json`)))throw Error('Phase exists; reproduce in fresh RISK_STUDY_OUT')
  const replacements=phase==='audit'?undefined:load('screen-freeze.json').replacements
  const jobs=jobsFor(phase,replacements),seeds=Array.from({length:count},(_,i)=>`RISK-ALLOCATION-${phase.startsWith('reserve')||phase==='course-control'?'SCREEN':phase.toUpperCase()}-${i}`)
  if(phase==='holdout'&&JSON.stringify(seeds)!==JSON.stringify(load('holdout-freeze.json').seeds))throw Error('Holdout seeds must match freeze')
  if((phase.startsWith('reserve')||phase==='course-control')&&count!==load('screen-manifest.json').count)throw Error('Control seed count must match screen')
  const sourceHashes=sources(),sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),started=new Date().toISOString()
  if(phase==='holdout')for(const [p,expected]of Object.entries(load('holdout-freeze.json').sourceHashes))if(sourceHashes[p]!==expected)throw Error(`Frozen source changed before holdout: ${p}`)
  save(`${phase}-manifest.json`,{version:'risk-allocation-v1',phase,count,seeds,started,node:process.version,sourceSha,sourceBase:'33de122',sourceHashes,jobs,configHashes:Object.fromEntries(jobs.map(j=>[j.id,hash(JSON.stringify(j.config))])),rules:'new trading rights; business tile exits only; unchanged personal events/economics; research clone only',freeze:phase==='holdout'?load('holdout-freeze.json'):phase==='audit'?null:load('screen-freeze.json')})
  writeFileSync(join(out,`${phase}-source.json.gz`),gzipSync(JSON.stringify({sourceSha,files:Object.fromEntries(Object.keys(sourceHashes).map(p=>[p,readFileSync(p,'utf8').replace(/\r\n/g,'\n')]))})))
  mkdirSync(join(out,phase),{recursive:true});let next=0
  async function worker(){while(next<jobs.length){const job=jobs[next++],dir=createStudyAdapter(job.config),target=join(out,phase,job.id)
    writeFileSync(join(dir,'job.json'),JSON.stringify({...job,seeds}));save(`${phase}/${job.id}.config.json`,job.config)
    try{await new Promise((ok,fail)=>{const child=spawn(process.execPath,['--experimental-strip-types',join(dir,'scripts/research/risk-allocation/worker.mjs'),join(dir,'config.json'),join(dir,'job.json'),target],{windowsHide:true,stdio:['ignore','pipe','pipe']});let err='';child.stdout.on('data',x=>process.stdout.write(x));child.stderr.on('data',x=>err+=x);child.on('error',fail);child.on('exit',code=>code===0?ok():fail(Error(err)))})}finally{cleanupAdapter(dir)}
  }}
  await Promise.all(Array.from({length:4},worker))
  if(JSON.stringify(sourceHashes)!==JSON.stringify(sources()))throw Error('Source changed during run')
  save(`${phase}-results.json`,{phase,started,finished:new Date().toISOString(),games:jobs.reduce((n,j)=>n+j.strategies.length*count,0),summaries:jobs.map(j=>load(`${phase}/${j.id}.summary.json`)),protected:verifyProtected()})
  console.log(JSON.stringify({phase,games:jobs.reduce((n,j)=>n+j.strategies.length*count,0),seconds:(Date.now()-Date.parse(started))/1000}))
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await run(process.argv[2],Number(process.argv[3]??120))
