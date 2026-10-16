import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { out, load, save, sources, verifyProtected } from './research/risk-allocation/run.mjs'
import { reserveConfig } from './research/risk-allocation/spec.mjs'
import { hash } from './research/core-mvp/adapter.mjs'

if(existsSync(join(out,'holdout-freeze.json')))throw Error('Holdout already frozen; never tune after reading it')
const screen=load('screen-analysis.json'),reserve=load('reserve-variant-analysis.json'),freeze=load('screen-freeze.json')
const candidates=['B-personal','D-personal','D'],reasons={}
for(const id of ['B-personal','D-personal']){
  const base=id[0],exposure=screen.groups[base].purposeful.learning.personal0.rate-screen.groups[id].purposeful.learning.personal0.rate
  if(exposure<.10)throw Error('Exposure expansion gate not met')
  reasons[id]={exposureGain:exposure,tailTradeoff:screen.groups[id].purposeful.expectedShortfall10-screen.groups[base].purposeful.expectedShortfall10,
    rationale:id==='B-personal'?'Shorter allocation/reserve candidate with fewer dead course visits':'Longer candidate with more Business/market exposure; stronger personal cost pressure'}
}
reasons.D={rationale:'Gentler native-economy control with more Business/market opportunities than B in screening; retains educational coverage gaps. Not selected on win rate alone.'}
const shortage0=reserve.groups['D-personal-r0'].policies.savings.learning.shortfallGame.rate,shortage5=reserve.groups['D-personal-r5'].policies.savings.learning.shortfallGame.rate
if(shortage0-shortage5<.05)throw Error('Selective reserve expansion gate not met')
save('holdout-freeze.json',{version:'risk-allocation-holdout-v1',frozenAt:new Date().toISOString(),sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHashes:sources(),
  analysisSourceHashes:{'scripts/analyze-core-mvp-risk-allocation.mjs':hash(readFileSync('scripts/analyze-core-mvp-risk-allocation.mjs','utf8').replace(/\r\n/g,'\n'))},
  candidates,configs:Object.fromEntries(candidates.map(id=>[id,freeze.configs[id]])),reasons,
  reserveJobs:[0,5e6].map(r=>({id:`D-personal-r${r/1e6}`,config:reserveConfig(freeze.configs['D-personal'],r),strategies:['savings'],parentCandidate:'D-personal'})),
  reserveExpansion:{strategy:'savings',shortage0,shortage5,reason:'>=5pp observed shortage reduction; decision-relevant reserve tradeoff on D variant only; no extra sweep'},
  seeds:Array.from({length:400},(_,i)=>`RISK-ALLOCATION-HOLDOUT-${i}`),
  endpoints:freeze.primaryEndpoints,selection:'Max three board candidates; same native economy and all 11 frozen strategies; cash-course diagnostic remains screening only; no winner',
  stopRule:'No parameter, position, strategy or candidate tuning after seeing holdout. Report all frozen candidates and reserve jobs, including adverse or null findings.',protected:verifyProtected()})
console.log(JSON.stringify({candidates,reserveJobs:['D-personal-r0/savings','D-personal-r5/savings'],seeds:400,games:14000}))
