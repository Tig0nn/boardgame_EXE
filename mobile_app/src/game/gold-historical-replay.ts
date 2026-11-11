import {advance,canChoose,decide,roll,transact,fundPayment} from '../../../src/game/engine.ts'
import {createMultiCourseGame} from '../../../src/game/new-game.ts'
import {snapshot} from '../../../src/game/state.ts'
import {serializeLog} from '../../../src/game/log.ts'
import type {GameState,LogEntry,Term,FundingSource} from '../../../src/game/types.ts'
import {goldCommand,goldEqual,requireGold} from './gold-historical-contract.ts'
import type {GoldSource} from './gold-historical-contract.ts'
export function alignGold(s:GameState,e:LogEntry){for(let i=0;i<4&&(s.phase!==e.before.phase||s.lap!==e.before.lap);i++){const next=advance(s);requireGold(next!==s,'phase-unreachable');s=next}requireGold(s.phase===e.before.phase&&s.lap===e.before.lap,'phase-unreachable');return s}
export function applyGold(s:GameState,e:LogEntry){
 let next:GameState
 if(e.kind==='roll'){requireGold(s.phase==='rolling','continuation-illegal');next=roll(s)}
 else if(e.kind==='decision'){requireGold(s.eventId===e.eventId&&e.decisionId&&canChoose(s,e.decisionId),'continuation-illegal');next=decide(s,e.decisionId)}
 else if(e.kind==='rebalancing'){requireGold(e.action,'action-missing');next=transact(s,e.action)}
 else{requireGold(e.kind==='funding'&&e.decisionId?.startsWith('fund-'),'funding-invalid');const source=e.decisionId!.slice(5) as FundingSource,lot=e.before.deposits.find(l=>l.status==='active'&&e.after.deposits.find(a=>a.id===l.id)?.status==='withdrawn');const amount=source==='debt'?e.after.portfolio.debt-e.before.portfolio.debt:source==='savings'?lot?.principal:e.forcedAssetSaleAmount;requireGold(amount!==undefined,'funding-invalid');next=fundPayment(s,source,amount,source==='bonds'?e.fundingLotId:lot?.id)}
 requireGold(next!==s&&next.log.length>s.log.length,'continuation-illegal');return next
}
const keys=['schemaVersion','rulesVersion','seed','gameplayProfile','goalRulesVersion','courseRulesVersion','courseConfig','livingExpenseRulesVersion','livingExpenseConfig','boardRevision','board','bondRulesVersion','bondCreditConfig','stockCatalogVersion','savingsProfile','businessRulesVersion','encounterRulesVersion','financialConfig','mode']
/** One independent Actual genesis replay. Captures full states only inside the worker. */
export function replayGoldActual(d:GoldSource,sequence:number,checkpoint:number|null,check:()=>void){
 const initial=d.entries[0].after,lot=initial.deposits[0],term=lot?lot.maturityLap-lot.startLap+1:1
 let s=createMultiCourseGame(d.seed,initial.portfolio.savings,term as Term);const setup=JSON.parse(serializeLog(s)) as Record<string,unknown>
 requireGold(keys.every(k=>goldEqual(d[k],setup[k])),'engine-config-mismatch');requireGold(goldEqual(s.log,d.entries.slice(0,s.log.length)),'setup-mismatch')
 let before:GameState|undefined,after:GameState|undefined,summary:GameState|undefined
 for(const e of d.entries){check();if(!goldCommand(e))continue;s=alignGold(s,e);requireGold(goldEqual(snapshot(s),e.before),'actual-replay-mismatch');if(e.sequence===sequence)before=structuredClone(s);const count=s.log.length;s=applyGold(s,e);requireGold(goldEqual(s.log.slice(count),d.entries.slice(count,s.log.length)),'history-mismatch');if(e.sequence===sequence)after=structuredClone(s);if(checkpoint&&s.log.length===checkpoint)summary=structuredClone(s)}
 for(let i=0;i<4&&(s.phase!==d.state.phase||s.lap!==d.state.lap);i++){const next=advance(s);requireGold(next!==s,'complete-actual-mismatch');s=next}
 requireGold(goldEqual(s,d.state),'complete-actual-mismatch');requireGold(before&&after,'decision-missing');return{before,after,summary}
}
export function goldExternal(s:GameState){return{seed:s.seed,rng:s.rng,dice:s.dice,turn:s.turn,lap:s.lap,position:s.position,phase:s.phase,eventId:s.eventId,pendingLanding:s.pendingLanding,scenarioId:s.scenarioId,market:s.market,bondCredit:s.bondCredit,customerPreferenceId:s.customerPreferenceId,businessEconomicMultiplier:s.business.economicMultiplier}}
export function goldHealthy(s:GameState){requireGold(!s.pendingPayment&&!s.settlement&&!s.termination&&s.phase!=='funding','funding-or-termination-unsupported')}

/** Coupled recorded command, exported for controlled rejection tests as well as the verifier. */
export function continueGoldPair(actual:GameState,alternative:GameState,e:LogEntry){
 requireGold(e.kind!=='funding'&&e.kind!=='rebalancing','unsupported-historical-transaction')
 actual=alignGold(actual,e);alternative=alignGold(alternative,e);goldHealthy(actual);goldHealthy(alternative)
 requireGold(goldEqual(snapshot(actual),e.before)&&goldEqual(goldExternal(actual),goldExternal(alternative)),'exogenous-diverged')
 actual=applyGold(actual,e);alternative=applyGold(alternative,e);goldHealthy(actual);goldHealthy(alternative)
 requireGold(goldEqual(goldExternal(actual),goldExternal(alternative)),'exogenous-diverged');return{actual,alternative}
}
