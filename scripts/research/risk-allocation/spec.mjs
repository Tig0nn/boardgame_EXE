import { readFileSync } from 'node:fs'

export const STRATEGIES=['cash','savings','stocks','gold','bond-a','bond-b','business','diversified','liquidity','risk-aware','novice']
export function studyConfigs(replacements={}){
  const old=JSON.parse(readFileSync('docs/research/core-mvp/frozen-configs.json','utf8')).configs
  const B=structuredClone(old.find(c=>c.id==='interaction-learning-liquidity'))
  const D=structuredClone(old.find(c=>c.id==='n20-h5-learning-p1'))
  const out={B,D}
  for(const name of ['B','D']){
    const v=structuredClone(out[name]);v.id=`risk-${name}-personal`
    const index=replacements[name]??(name==='B'?15:17)
    if(v.board.tiles[index]!=='course')throw Error('Replacement must be an existing course')
    v.board.tiles[index]='personal';v.board.countProfile='learning-personal-variant'
    v.researchChange={kind:'one-course-to-personal',index0:index}
    out[`${name}-personal`]=v
  }
  const common=structuredClone(D),laps=D.economy.rules.laps
  common.id='risk-D-common-B';common.economy=structuredClone(B.economy)
  common.economy.rules.laps=laps;common.economy.rules.tiles=D.board.tiles.length
  common.researchChange={kind:'common-B-economy',retained:['D-board','D-laps']}
  out['D-common-B']=common
  return out
}
export function reserveConfig(c,reserve){
  if(![0,5e6,10e6,15e6].includes(reserve))throw Error('Unknown reserve')
  const x=structuredClone(c);x.policy.reserve=reserve;x.policy.liquidityReserve=reserve
  return x
}
