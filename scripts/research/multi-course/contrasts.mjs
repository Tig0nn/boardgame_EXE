import {readdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import {paired} from './stats.mjs'
const phase=process.argv[2],root='docs/research/multi-course',phases=phase==='screen-all'?['screen','screen-control']:phase==='shortlist-all'?['shortlist','shortlist-control']:[phase],arms=new Map(),comparisons=[],checks=[]
for(const folder of phases)for(const name of readdirSync(join(root,folder)).filter(p=>p.endsWith('.rows.json.gz'))){
  const id=name.replace('.rows.json.gz',''),rows=JSON.parse(gunzipSync(readFileSync(join(root,folder,name)))),[system,layout]=id.split('__')
  arms.set(id,{system,layout,rows,policies:[...new Set(rows.map(r=>r.policy))]})
}
function compare(a,b,kind){
  for(const p of a.policies){
    let ar=a.rows.filter(r=>r.policy===p),br=b.rows.filter(r=>r.policy===p)
    if(!br.length)continue
    const aSeeds=new Set(ar.map(r=>r.seed)),bSeeds=new Set(br.map(r=>r.seed))
    ar=ar.filter(r=>bSeeds.has(r.seed));br=br.filter(r=>aSeeds.has(r.seed))
    for(const metric of ['proceeds','won','courseExhausted','courseProfitable','investmentSpend','personalShortfalls'])comparisons.push({kind,a:`${a.system}__${a.layout}`,b:`${b.system}__${b.layout}`,policy:p,metric,...paired(ar,br,metric)})
    if(kind==='curriculum-only'&&p.endsWith('-none')){
      const map=new Map(br.map(r=>[r.seed,r]))
      for(const r of ar)for(const k of ['proceeds','cash','debt','finalRng','marketHash','creditHash','personalCost'])assert.equal(r[k],map.get(r.seed)[k],`No-course invariance ${a.system}/${a.layout}/${p}/${k}`)
      checks.push({a:`${a.system}__${a.layout}`,policy:p,seeds:ar.length,matched:true})
    }
  }
}
for(const a of arms.values()){
  const base=arms.get(`A-baseline__${a.layout}`)
  if(a.system!=='A-baseline'&&base)compare(a,base,'curriculum-only')
  const original=arms.get(`${a.system}__L4-original`)
  if(a.layout!=='L4-original'&&original)compare(a,original,'layout-only')
  if(a.layout==='L2-spaced'&&arms.has(`${a.system}__L2-bond-bank`))compare(a,arms.get(`${a.system}__L2-bond-bank`),'same-counts-spacing')
  if(a.system==='M3-total24'||a.system==='M4-total24')compare(a,arms.get(`M2-total24__${a.layout}`),'matched-total-economics')
}
writeFileSync(join(root,`${phase}-contrasts.json`),JSON.stringify({comparisons,noCourseInvariance:checks},null,2)+'\n')
const keys=Object.keys(comparisons[0]??{}).filter(k=>k!=='ci95')
writeFileSync(join(root,`${phase}-contrasts.csv`),[...keys,'ciLow','ciHigh'].join(',')+'\n'+comparisons.map(r=>[...keys.map(k=>r[k]),...r.ci95].join(',')).join('\n')+'\n')
console.log(JSON.stringify({phase,pairedContrasts:comparisons.length,noCourseInvariantPairs:checks.length}))
