import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {spawn,execFileSync} from 'node:child_process'
import {gzipSync} from 'node:zlib'
import {createAdapter,cleanup,sources,hash} from './adapter.mjs'
import {config,systems,layouts,policies,screenPolicies,BASE_SHA} from './spec.mjs'
const phase=process.argv[2],root=resolve(process.env.MULTI_COURSE_OUTPUT??'docs/research/multi-course')
if(!['screen','shortlist','holdout'].includes(phase))throw Error('Usage: node run.mjs screen|shortlist|holdout')
const lock=phase==='screen'?{configs:systems.flatMap(s=>layouts.map(l=>({system:s.id,layout:l.id}))),seeds:32,policies:screenPolicies.map(p=>p.id)}:JSON.parse(readFileSync(`docs/research/multi-course/${phase}-lock.json`))
if(execFileSync('git',['diff',BASE_SHA,'--','src','mobile_app/src'],{encoding:'utf8'}).trim())throw Error('Protected production source changed')
const stage=join(root,phase);mkdirSync(stage,{recursive:true})
if(existsSync(join(root,`${phase}-manifest.json`)))throw Error('Completed phase exists; use MULTI_COURSE_OUTPUT for an independent reproduction')
const n=lock.configs.length*lock.seeds*lock.policies.length
let completedGames=0
for(const p of ['screen','shortlist','holdout'])if(existsSync(join(root,`${p}-manifest.json`)))completedGames+=JSON.parse(readFileSync(join(root,`${p}-manifest.json`))).games
if(completedGames+n>170000)throw Error('Study budget cap170000 exceeded')
const bundle=sources(),configs=lock.configs.map(x=>config(x.system,x.layout)),started=performance.now(),results=[]
writeFileSync(join(root,`${phase}-source.json.gz`),gzipSync(JSON.stringify(bundle)))
writeFileSync(join(root,`${phase}-protocol.json`),JSON.stringify({phase,lock,games:n,sourceHashes:bundle.hashes,preregisteredBeforeRunning:true,base:BASE_SHA,initialSavings:0,initialTerm:3,seedPrefix:`B18-MULTICOURSE-${phase.toUpperCase()}-`,ci:'Wilson for win/funding; normal paired mean CI; tail bootstrap on holdout; pooled policies cluster by seed.',selection:'Exposure, ROI timing, tail/liquidity, dominance and simplicity; never highest win alone.'},null,2)+'\n')
let cursor=0,failed=false
async function pool(){
  while(cursor<configs.length&&!failed){
    const c=configs[cursor++],dir=createAdapter(c),target=join(stage,c.id)
    const examplePolicies=phase==='screen'?['cash-roi']:['cash-roi','savings-all','diversified-roi','business-roi','risk-aware-roi','novice'].filter(p=>lock.policies.includes(p))
    writeFileSync(`${target}.config.json`,JSON.stringify(c,null,2)+'\n')
    writeFileSync(join(dir,'job.json'),JSON.stringify({phase,seeds:lock.seeds,policies:lock.policies,examplePolicies}))
    try{
      const output=await new Promise((res,rej)=>{
        const child=spawn(process.execPath,['--experimental-strip-types',join(dir,'scripts/research/multi-course/worker.mjs'),join(dir,'config.json'),join(dir,'job.json'),target],{windowsHide:true})
        let stdout='',stderr=''
        child.stdout.on('data',b=>{stdout+=b});child.stderr.on('data',b=>{if(stderr.length<12000)stderr+=b})
        child.on('error',rej);child.on('exit',code=>code===0?res(stdout):rej(Error(`${c.id}: exit${code}: ${stderr}`)))
      })
      results.push(JSON.parse(output.trim()));console.log(JSON.stringify({...results.at(-1),completed:results.length,total:configs.length}))
    }catch(error){failed=true;throw error}finally{cleanup(dir)}
  }
}
const jobs=await Promise.allSettled(Array.from({length:Math.min(4,configs.length)},pool))
const errors=jobs.filter(x=>x.status==='rejected')
if(errors.length)throw Error(errors.map(x=>x.reason.message).join('\n'))
const manifest={phase,games:n,configs:configs.length,seedsPerPolicy:lock.seeds,policies:lock.policies,elapsedSeconds:(performance.now()-started)/1000,base:BASE_SHA,
  sourceBundleSha256:hash(readFileSync(join(root,`${phase}-source.json.gz`))),sourceHashes:bundle.hashes,results:results.sort((a,b)=>a.id.localeCompare(b.id)),noProductionChanges:true}
writeFileSync(join(root,`${phase}-manifest.json`),JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify({phase,complete:true,games:n,seconds:manifest.elapsedSeconds}))
