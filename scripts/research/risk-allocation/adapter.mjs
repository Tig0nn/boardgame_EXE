import { cpSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createTradingAdapter } from '../trading-ab/adapter.mjs'
export function createStudyAdapter(c){
  const dir=createTradingAdapter(c,'new'),sub='scripts/research/risk-allocation'
  mkdirSync(join(dir,sub),{recursive:true})
  for(const file of readdirSync(sub))if(file.endsWith('.mjs'))cpSync(join(sub,file),join(dir,sub,file))
  return dir
}
