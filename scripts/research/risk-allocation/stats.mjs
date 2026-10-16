import { summarize as tradingSummary } from '../trading-ab/stats.mjs'
import { distribution, mean, paired, rate } from '../core-mvp/stats.mjs'
export { distribution, mean }
export const VALUES=['personalEncounters','courseRepeatVisits','decisionSteps','decisionEncounters','startDecisionCheckpoints','fundingDecisionSteps','mandatoryCashShortfalls','earlySavingsWithdrawals','earlyWithdrawalPrincipal','lostSavingsInterest','fundingSaleAmount','borrowedPrincipal','personalCommittedCost','personalDeferralPremium','personalImmediateShortfalls','personalDeferred','personalFundingSteps','lockedCapitalDuringRollMean','lockedSavingsFinal','rawDrawdown','livingAdjustedDrawdown','livingIncurred']
export const RATES=['personal0','personal1','personal2plus','macroWhileInvested','businessOpenOpportunity','businessOpenUpgradeExitPath','businessUpgradeOpportunity']
export function summarize(rows){
  if(!rows.length)throw Error('Empty group')
  const base=tradingSummary(rows)
  return {...base,learning:{...Object.fromEntries(VALUES.map(k=>[k,distribution(rows.map(r=>r[k]))])),...Object.fromEntries(RATES.map(k=>[k,rate(rows.map(r=>r[k]))])),
    shortfallGame:rate(rows.map(r=>r.mandatoryCashShortfalls>0)),earlyWithdrawalGame:rate(rows.map(r=>r.earlySavingsWithdrawals>0)),fundingSaleGame:rate(rows.map(r=>r.forcedSells>0)),
    encounterCoverage:Object.fromEntries(Object.keys(rows[0].coverage).map(t=>[t,rate(rows.map(r=>r.coverage[t]>0))])),
    courseRepeatByPosition:Object.fromEntries(Object.keys(rows[0].courseRepeatByPosition).map(i=>[i,mean(rows.map(r=>r.courseRepeatByPosition[i]))])),
    ...Object.fromEntries(['financialAccess','accessThenSale','ownedSaleOpportunity'].map(k=>[k,Object.fromEntries(Object.keys(rows[0][k]).map(a=>[a,rate(rows.map(r=>r[k][a]))]))])),
    macroOwned:Object.fromEntries(Object.keys(rows[0].macroOwned).map(a=>[a,{any:rate(rows.map(r=>r.macroOwned[a]>0)),mean:mean(rows.map(r=>r.macroOwned[a]))}]))}}
}
export function compare(fresh,old){
  if(!fresh.length||fresh.length!==old.length||new Set(fresh.map(r=>r.seed)).size!==fresh.length||new Set(old.map(r=>r.seed)).size!==old.length)throw Error('Pairs require unique matched seeds within strategy')
  const prior=new Map(old.map(r=>[r.seed,r]))
  for(const r of fresh)if(!prior.has(r.seed))throw Error('Unmatched seed')
  const keys=['won','proceeds','funded','borrowed','insolvent','creditLoss','transactionCosts','lockedBusiness','lockedBond',...VALUES,...RATES]
  return {n:fresh.length,delta:Object.fromEntries(keys.map(k=>[k,paired(fresh,old,k)])),
    paths:Object.fromEntries(['diceHash','encounterHash','marketHash','creditMarketHash','rngPathHash'].map(k=>[k,mean(fresh.map(r=>r[k]===prior.get(r.seed)[k]))]))}
}
