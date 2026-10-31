import {invalid} from '../schema.ts'
import {ECONOMY} from '../../../data/config.ts'
import {eventsForGame} from '../../../data/events.ts'
import {BOND_ISSUERS} from '../../../data/bond-issuers.ts'
import {MULTI_COURSES} from '../../../data/courses.ts'
import {stockCatalog} from '../../../data/stock-catalog.ts'
import type {GameplayContext} from './types.ts'
/** Validate rule-derived relationships. Market/ownership observations remain client-unverified. */
export function validateGrounding(c:GameplayContext):void {
 const value=(code:string,subject='overall')=>c.facts.find(f=>f.code===code&&f.subject===subject)?.value
 const exact=(code:string,expected:number,subject='overall')=>{if(value(code,subject)!==expected)invalid()}
 const base=['cash','debt','obligations','worth','liquid','target','salary','living']
 const quotes=['gross','fee','spread','net'],claims=['outstanding','loss']
 const extra:Record<GameplayContext['domain'],string[]>={
  bank:['rate','principal','maturity','interest','lost'],
  stocks:['holding','price',...quotes],gold:['holding','price',...quotes],
  bonds:['holding','price','coupon','creditState',...claims,...quotes],
  business:['businessIncome','capital','recovery','purchaseCost','upgradeCost','incremental'],
  course:['owned','courseCost','courseBoost','courseNominal','courseNet'],
  personal:['immediate','future','total','after','shortfall','headroom','principal','lost',...claims,...quotes],
  funding:['paymentTotal','remaining','headroom','principal','lost',...claims,...quotes],
  macro:['observed','price','beforePrice','change'],summary:['received','debtPaid'],
  rebalancing:[...claims,...quotes],forecast:[],overview:[],
 }
 const stocks=stockCatalog('vn-v1').map(x=>x.id),issuers=BOND_ISSUERS.map(x=>x.id as string)
 const lot=(subject:string)=>/^lot-[1-9][0-9]{0,2}$/.test(subject)
 const overall=[...base,'headroom','businessIncome','capital','recovery','purchaseCost','upgradeCost','incremental','paymentTotal','remaining','received','debtPaid','observed']
 function subjectAllowed(code:string,subject:string):boolean {
  if(overall.includes(code))return subject==='overall'
  if(code==='rate')return ['term-1','term-2','term-3'].includes(subject)
  if(['principal','interest','lost','maturity',...claims].includes(code))return lot(subject)
  if(quotes.includes(code))return c.domain==='stocks'?subject==='stocks':c.domain==='gold'?subject==='gold':c.domain==='bonds'?lot(subject):subject==='stocks'||subject==='gold'||lot(subject)
  if(code==='holding')return subject===c.domain
  if(code==='coupon'||code==='creditState')return issuers.includes(subject)
  if(['price','beforePrice','change'].includes(code))return c.domain==='stocks'?stocks.includes(subject):c.domain==='gold'?subject==='gold':c.domain==='bonds'?issuers.includes(subject):subject==='gold'||stocks.includes(subject)||issuers.includes(subject)
  if(['owned','courseCost','courseBoost','courseNominal','courseNet'].includes(code))return c.profile==='core-mvp-b18-v1'?subject==='upgrade':['basic','advanced'].includes(subject)
  if(['immediate','future','total','after','shortfall'].includes(code))return (c.eventId==='repair'?['full','temporary']:['pay','defer']).includes(subject)
  return false
 }
 for(const f of c.facts)if(!base.includes(f.code)&&!extra[c.domain].includes(f.code)||!subjectAllowed(f.code,f.subject))invalid()
 const required=(code:string,subject='overall')=>{const amount=value(code,subject);if(amount===undefined)invalid();return amount}
 if(['stocks','gold','bonds'].includes(c.domain))required('holding',c.domain)
 if(c.domain==='stocks')for(const subject of stocks)required('price',subject)
 if(c.domain==='gold')required('price','gold')
 if(c.domain==='bonds')for(const subject of issuers){required('price',subject);required('creditState',subject)}
 if(c.domain==='business')for(const code of extra.business)required(code)
 if(c.domain==='summary')required('debtPaid')
 if(['personal','funding'].includes(c.domain)){
  required('headroom')
  for(const source of c.resources){
   if(source==='debt'&&value('headroom')!<=0)invalid()
   if(source==='savings'&&!c.facts.some(f=>f.code==='principal'&&f.value>0))invalid()
   if(['stocks','gold'].includes(source)&&!c.facts.some(f=>f.code==='net'&&f.subject===source&&f.value>0))invalid()
   if(source==='bonds'&&!c.facts.some(f=>f.code==='net'&&lot(f.subject)&&f.value>0))invalid()
  }
 }
 if(c.domain==='funding')required('paymentTotal')
 if(c.domain==='course')for(const subject of c.profile==='core-mvp-b18-v1'?['upgrade']:['basic','advanced'])required('owned',subject)
 if(c.domain==='bank')for(const subject of new Set(c.facts.filter(f=>['principal','interest','lost','maturity'].includes(f.code)).map(f=>f.subject)))for(const code of ['principal','interest','lost','maturity'])required(code,subject)
 if(['stocks','gold'].includes(c.domain)){
  const held=required('holding',c.domain)
  if(held>0)exact('gross',held,c.domain)
  else if(c.facts.some(f=>quotes.includes(f.code)))invalid()
 }
 if(c.domain==='macro'){
  const observed=required('observed'),subjects=new Set(c.facts.filter(f=>['price','beforePrice','change'].includes(f.code)).map(f=>f.subject))
  if(observed===0&&subjects.size)invalid()
  if(observed===1)for(const subject of [...stocks,...issuers,'gold']){
   const before=required('beforePrice',subject),after=required('price',subject);exact('change',after-before,subject)
  }
 }
 exact('target',90_000_000);exact('living',5_000_000)
 const allowed:Record<GameplayContext['domain'],string[]>={
  bank:['deposit','skip'],stocks:['buy','sell','skip'],bonds:['buy','sell','skip'],gold:['buy','sell','skip'],business:['buy','sell','upgrade','skip'],
  course:c.profile==='core-mvp-b18-v1'?['upgrade','skip']:['course-basic','course-advanced','skip'],personal:c.eventId==='repair'?['full','temporary']:['pay','defer'],macro:['acknowledge'],
  funding:c.resources.map(x=>`fund-${x}`),summary:['continue'],rebalancing:['sell','repay','continue'],forecast:['continue'],overview:[],
 }
 if(c.actions.some(a=>!allowed[c.domain].includes(a)))invalid()
 if(new Set(c.resources).size!==c.resources.length||!['personal','funding'].includes(c.domain)&&c.resources.length)invalid()
 if(c.domain==='bank')for(const [term,rate] of [[1,400],[2,500],[3,600]])exact('rate',rate,`term-${term}`)
 if(c.domain==='personal') {
  for(const o of eventsForGame({gameplayProfile:c.profile}).find(e=>e.id===c.eventId)!.options){
   const now=o.cost??0,later=o.obligation??0
   exact('immediate',now,o.id);exact('future',later,o.id);exact('total',now+later,o.id)
   if(value('cash')!>=now){exact('after',value('cash')!-now,o.id);if(value('shortfall',o.id)!==undefined)invalid()}
   else {exact('shortfall',now-value('cash')!,o.id);if(value('after',o.id)!==undefined)invalid()}
  }
 }
 if(c.domain==='course') {
  if(c.profile==='core-mvp-b18-multi-course-v1')for(const x of MULTI_COURSES){
   exact('courseCost',x.cost,x.id);exact('courseBoost',x.boost,x.id)
   exact('courseNominal',x.boost*(c.totalLaps-c.lap+1),x.id);exact('courseNet',x.boost*(c.totalLaps-c.lap+1)-x.cost,x.id)
   if(c.actions.includes(`course-${x.id}`)&&(value('owned',x.id)!==0||value('cash')!<x.cost))invalid()
  } else {exact('courseCost',8_000_000,'upgrade');exact('courseBoost',4_000_000,'upgrade')}
 }
 if(c.domain==='bonds')for(const issuer of BOND_ISSUERS)exact('coupon',Math.round(issuer.coupon*10000),issuer.id)
 for(const subject of new Set(c.facts.filter(f=>['gross','fee','spread','net'].includes(f.code)).map(f=>f.subject))){
  const gross=value('gross',subject);if(gross===undefined)invalid()
  const asset=subject==='stocks'?'stocks':subject==='gold'?'gold':subject.startsWith('lot-')?'bonds':null
  if(!asset)invalid()
  const spread=asset==='gold'?Math.round(gross*ECONOMY.goldSpread):0,fee=Math.round((gross-spread)*ECONOMY.tradeFees[asset])
  exact('spread',spread,subject);exact('fee',fee,subject);exact('net',gross-spread-fee,subject)
 }
 if(c.domain==='business'){exact('purchaseCost',ECONOMY.business.cost);exact('upgradeCost',ECONOMY.business.upgradeCost)}
 if(c.domain==='funding'&&(value('remaining')===undefined||value('remaining')!<=0||value('paymentTotal')!<value('remaining')!))invalid()
 if(c.domain==='summary'&&(value('received')===undefined||!c.entries.length))invalid()
 if(c.domain==='macro'&&![0,1].includes(value('observed')??-1))invalid()
}