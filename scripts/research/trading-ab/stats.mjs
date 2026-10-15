import { aggregate, distribution, paired, mean } from '../core-mvp/stats.mjs'
export { paired, mean, distribution }
export const EXTRA=['buys','sells','successfulFinancialTrades','tileSells','startSells','forcedSells','feesPaid','spreadPaid','transactionCosts','realizedGain','realizedLoss','netRealizedCapitalPnl','cashDuringRollMean','reserveBreachRollRate']
export function summarize(rows){
  return {...aggregate(rows),trading:Object.fromEntries(EXTRA.map(k=>[k,distribution(rows.map(r=>r[k]))])),
    assets:Object.fromEntries(['stocks','gold','bonds'].map(asset=>[asset,Object.fromEntries(Object.keys(rows[0].assets[asset]).map(k=>[k,mean(rows.map(r=>r.assets[asset][k]))]))])),
    reasons:Object.fromEntries([...new Set(rows.flatMap(r=>Object.keys(r.reasons)))].sort().map(reason=>[reason,Object.fromEntries(['count','gain','loss','netCapitalPnl'].map(k=>[k,mean(rows.map(r=>r.reasons[reason]?.[k]??0))]))]))}
}
export function compare(newRows,oldRows){
  const metrics=['won','proceeds','cash','funded','borrowed','capitalLoss','drawdown','creditLoss',...EXTRA]
  const old=new Map(oldRows.map(r=>[r.seed,r]))
  return {delta:Object.fromEntries(metrics.map(k=>[k,paired(newRows,oldRows,k)])),
    sameMarketRate:mean(newRows.map(r=>r.marketHash===old.get(r.seed).marketHash)),sameCreditMarketRate:mean(newRows.map(r=>r.creditMarketHash===old.get(r.seed).creditMarketHash)),
    newTail10:summarize(newRows).expectedShortfall10,oldTail10:summarize(oldRows).expectedShortfall10,
    improvedSeedRate:mean(newRows.map(r=>r.proceeds>old.get(r.seed).proceeds)),worsenedSeedRate:mean(newRows.map(r=>r.proceeds<old.get(r.seed).proceeds))}
}
