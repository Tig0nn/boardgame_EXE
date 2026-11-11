import {advance,canChoose,transact} from '../../../src/game/engine.ts'
import {snapshot} from '../../../src/game/state.ts'
import {serializeLog} from '../../../src/game/log.ts'
import {saleQuote,liquidatableFunds} from '../../../src/game/selectors.ts'
import {ECONOMY} from '../../../src/data/config.ts'
import {GOLD_POLICY,GOLD_PRINCIPAL,GOLD_ENGINE_VERSION,goldContextFor,parseGoldSource,goldCommand,goldEqual,requireGold,publicGoldDTO} from './gold-historical-contract.ts'
import type {GoldEnvelope,GoldKnown} from './gold-historical-contract.ts'
import {replayGoldActual,alignGold,continueGoldPair,goldExternal,goldHealthy} from './gold-historical-replay.ts'
/** Worker-only financial proof. No Node, diagnostic imports, live session, storage or network. */
export async function verifyGold(text:string,selected:number|undefined,signal:AbortSignal,policy:typeof GOLD_POLICY=GOLD_POLICY,engine:string=GOLD_ENGINE_VERSION):Promise<GoldEnvelope>{
 const deadline=Date.now()+20_000,check=()=>{requireGold(!signal.aborted,'cancelled');requireGold(Date.now()<=deadline,'execution-budget')};check();requireGold(policy===GOLD_POLICY,'policy-unsupported');requireGold(engine===GOLD_ENGINE_VERSION,'engine-version-unsupported')
 const d=parseGoldSource(text),context=await goldContextFor(text,selected);check();const sequence=context.decision.sequence
 const {before,after,summary}=replayGoldActual(d,sequence,context.checkpoint?.sequence??null,check);goldHealthy(before)
 requireGold(before.phase==='event'&&before.eventId==='gold'&&before.log.length===sequence-1&&goldEqual(snapshot(before),d.entries[sequence-1].before)&&before.turn===context.decision.turn&&before.lap===context.decision.lap&&before.position===context.decision.tileId,'decision-identity-mismatch')
 requireGold(canChoose(before,'skip')&&before.portfolio.cash>=GOLD_PRINCIPAL&&before.goldUnits===0&&before.goldCostBasis===0,'alternative-illegal')
 requireGold(['stocks','bonds','gold','business','savings','debt'].every(k=>before.portfolio[k as keyof typeof before.portfolio]===0)&&before.obligations===0&&before.lap<4,'boundary-unsupported')
 let alternative=transact(structuredClone(before),{kind:'buy',asset:'gold',amount:GOLD_PRINCIPAL,completeEncounter:true}),actual=after
 goldHealthy(actual);goldHealthy(alternative);requireGold(goldEqual(goldExternal(actual),goldExternal(alternative))&&actual.rng===before.rng&&actual.portfolio.cash-alternative.portfolio.cash===GOLD_PRINCIPAL&&alternative.goldCostBasis===GOLD_PRINCIPAL,'allocation-mismatch')
 const known:GoldKnown={policy:GOLD_POLICY,principal:GOLD_PRINCIPAL,assumption:'analysis-budget-not-recorded-intent',actualImmediateCash:actual.portfolio.cash,alternativeImmediateCash:alternative.portfolio.cash,priceAtDecision:before.market.gold.currentPrice,units:alternative.goldUnits,buyFee:0,spreadRate:ECONOMY.goldSpread,saleFeeRate:ECONOMY.tradeFees.gold,liquidity:'cash-reduced-until-legal-sale'}
 if(!context.checkpoint)return{context,result:publicGoldDTO({status:'known',...known})}
 const horizon=context.checkpoint;requireGold(summary&&summary.phase==='summary'&&summary.lap===before.lap&&horizon.lap===before.lap,'checkpoint-unmatched')
 for(const e of d.entries.filter(e=>goldCommand(e)&&e.sequence>sequence&&e.sequence<=horizon.sequence)){
  check();({actual,alternative}=continueGoldPair(actual,alternative,e))
 }
 requireGold(goldEqual(actual,summary)&&alternative.phase==='summary'&&alternative.log.length===horizon.sequence,'checkpoint-unmatched')
 const a=actual.summaries.at(-1)!,b=alternative.summaries.at(-1)!;requireGold(goldEqual(a.lines,b.lines)&&goldEqual(a.fundingNotes,b.fundingNotes)&&a.incomeTotal===b.incomeTotal&&a.debtPrincipalPaid===b.debtPrincipalPaid,'settlement-diverged')
 requireGold(['stocks','bonds','business','savings','debt'].every(k=>actual.portfolio[k as keyof typeof actual.portfolio]===0&&alternative.portfolio[k as keyof typeof alternative.portfolio]===0)&&actual.obligations===0&&alternative.obligations===0,'net-value-unproved')
 actual=advance(actual);alternative=advance(alternative);requireGold(actual.phase==='rebalancing'&&alternative.phase==='rebalancing'&&goldEqual(goldExternal(actual),goldExternal(alternative)),'sale-access-unproved')
 if(horizon.witnessKind==='recorded-current-state')requireGold(goldEqual(actual,d.state),'horizon-witness-mismatch')
 else{const witness=d.entries[horizon.witnessSequence-1];requireGold(witness&&goldEqual(snapshot(alignGold(actual,witness)),witness.before),'horizon-witness-mismatch')}
 const quote=saleQuote(alternative,'gold'),cashBeforeSale=alternative.portfolio.cash,gross=alternative.portfolio.gold,sold=transact(alternative,{kind:'sell',asset:'gold',amount:gross})
 goldHealthy(sold);requireGold(sold.phase==='rebalancing'&&goldEqual(goldExternal(actual),goldExternal(sold))&&sold.goldUnits===0&&sold.goldCostBasis===0&&sold.portfolio.gold===0&&sold.portfolio.cash-cashBeforeSale===quote.net&&sold.log.at(-1)?.cashProceeds===quote.net,'sale-incomplete')
 const difference=sold.portfolio.cash-actual.portfolio.cash;requireGold(difference===quote.net-GOLD_PRINCIPAL&&liquidatableFunds(actual)===actual.portfolio.cash&&liquidatableFunds(sold)===sold.portfolio.cash,'net-value-unproved')
 // Independent replay of the hypothetical transcript includes the exact full engine sale action.
 const branch=parseGoldSource(serializeLog(sold));replayGoldActual(branch,sequence,horizon.sequence,check);check()
 return{context,result:publicGoldDTO({status:'supported',...known,actualCash:actual.portfolio.cash,alternativeCashBeforeSale:cashBeforeSale,heldGoldGross:gross,spread:quote.spread,saleFee:quote.fee,netSaleProceeds:quote.net,alternativeCashAfterSale:sold.portfolio.cash,difference,bookGain:gross-GOLD_PRINCIPAL,debt:0,obligations:0,checkpoint:horizon,saleAssumption:'hypothetical-full-new-gold-sale-at-next-start'})}
}
