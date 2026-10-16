import { boardFor } from '../data/board.ts'
import { validateLivingBoard } from './living-expenses.ts'
import { encounterRulesForGame } from './encounters.ts'
import { businessRulesForGame } from './business.ts'
import { bondRulesForGame } from './bond-credit.ts'
import { createSavingsProfile } from './savings.ts'
import { isCoreMvp, goalForGame } from './rules-profile.ts'
import { serializeLog } from './log.ts'
import type { GameState, Snapshot } from './types.ts'
import { stockCatalog } from '../data/stock-catalog.ts'
import { eventsForGame } from '../data/events.ts'

export const GAME_SAVE_KEY='xvtl:mobile:game:v1'
const metadata=['gameplayProfile','goalRulesVersion','livingExpenseRulesVersion','boardRevision','encounterRulesVersion','businessRulesVersion','bondRulesVersion','boardLayout','totalLaps'] as const
function validateSnapshot(s:Snapshot){
  validateLivingBoard(s);goalForGame(s);encounterRulesForGame(s);businessRulesForGame(s);bondRulesForGame(s)
  if(!['A20','C20','B18'].includes(s.boardLayout)||!['original','experimental-a','experimental-b'].includes(s.gameMode)||!['forecast','rolling','event','funding','summary','rebalancing','finished'].includes(s.phase))throw Error('Trạng thái ván không hợp lệ.')
  const board=boardFor(s)
  if(!Number.isInteger(s.position)||s.position<0||s.position>=board.length||!Number.isInteger(s.totalLaps)||s.totalLaps<1||s.totalLaps>12||!Number.isInteger(s.lap)||s.lap<1||s.lap>s.totalLaps)throw Error('Vị trí/vòng chơi không hợp lệ.')
  for(const key of ['cash','savings','stocks','bonds','gold','business','debt'] as const)if(!Number.isSafeInteger(s.portfolio?.[key])||s.portfolio[key]<0)throw Error('Số dư không hợp lệ.')
  if(!Number.isSafeInteger(s.obligations)||s.obligations<0||!Number.isSafeInteger(s.pendingCost)||s.pendingCost<0)throw Error('Nghĩa vụ không hợp lệ.')
  if(s.savingsProfile&&JSON.stringify(s.savingsProfile)!==JSON.stringify(createSavingsProfile(s.savingsProfile.id)))throw Error('Lãi tiết kiệm không khớp phiên bản.')
  if(isCoreMvp(s)&&(s.totalLaps!==4||s.encounterRulesVersion!=='b18-tile-trading-v1'||s.bondRulesVersion!=='v2.5-credit-risk'||s.businessRulesVersion!=='v2.4-customer-preferences'||s.market.catalogVersion!=='vn-v1'))throw Error('Metadata B18 không khớp.')
  if(!isCoreMvp(s)&&s.encounterRulesVersion==='b18-tile-trading-v1')throw Error('Thiếu profile giao dịch B18.')
  if(!Array.isArray(s.deposits)||!Array.isArray(s.bondLots)||!Array.isArray(s.market.stocks)||!s.business||!s.stockHoldings)throw Error('Thiếu dữ liệu tài sản.')
  const catalog=stockCatalog(s.market.catalogVersion)
  if(s.market.stocks.length!==catalog.length||s.market.stocks.some((stock,i)=>stock.id!==catalog[i].id||!Number.isFinite(stock.currentPrice)||stock.currentPrice<=0||!Array.isArray(stock.priceHistory)))throw Error('Danh mục hoặc giá cổ phiếu không hợp lệ.')
  if(!Array.isArray(s.market.gold?.priceHistory)||!Array.isArray(s.market.bond?.priceHistory)||!Array.isArray(s.market.appliedShocks)||!Array.isArray(s.market.normalLaps))throw Error('Thiếu lịch sử thị trường.')
  if(s.bondRulesVersion==='v2.5-credit-risk'&&(!Array.isArray(s.bondCredit?.issuers)||s.bondCredit.issuers.length!==2||!Array.isArray(s.bondCredit.processedLaps)||s.bondLots.some(lot=>!lot.credit)))throw Error('Thiếu dữ liệu tín dụng.')
  for(const key of ['coursePurchased','savingsEligible','savingsMatured'] as const)if(typeof s[key]!=='boolean')throw Error('Trạng thái tài sản không hợp lệ.')
}
// Local save/import boundary; no migration, code execution or financial rewrite.
// This validates shape/version consistency, not anti-cheat authenticity.
export function restoreSavedGame(text:string):GameState{
  if(text.length>20_000_000)throw Error('Nhật ký quá lớn.')
  const data=JSON.parse(text)
  // Local-only dictionary storage removes repeated market histories from snapshots.
  // Exported replay schemas remain unchanged; decoding restores the exact objects.
  if(data?.storageVersion!==undefined){
    if(data.storageVersion!==1||!Array.isArray(data.markets)||!data.state)throw Error('Không hỗ trợ phiên bản lưu cục bộ.')
    const unpack=(s:Record<string,unknown>)=>{
      if(!Number.isInteger(s.marketRef)||Number(s.marketRef)<0||Number(s.marketRef)>=data.markets.length)throw Error('Dữ liệu thị trường đã lưu không hợp lệ.')
      // Markets are immutable in recorded snapshots, as in the engine's snapshot().
      s.market=data.markets[Number(s.marketRef)];delete s.marketRef
    }
    if(!Array.isArray(data.state.log))throw Error('Thiếu nhật ký ván.')
    for(const e of data.state.log){unpack(e.before);unpack(e.after)}
    if(data.state.settlement)unpack(data.state.settlement.before)
  }
  if(![4,5,6].includes(data?.schemaVersion)||!data.state||!Array.isArray(data.state.log)||data.state.log.length>5000)throw Error('Không hỗ trợ định dạng ván này.')
  const s=data.state as GameState
  validateSnapshot(s)
  if(typeof s.seed!=='string'||!s.seed.length||s.seed.length>128||!Array.isArray(s.summaries)||!Number.isInteger(s.turn)||s.turn<0)throw Error('Thiếu thông tin ván chơi.')
  if(isCoreMvp(s)!==(data.schemaVersion===6))throw Error('Schema và profile không khớp.')
  for(const key of metadata)if(data[key]!==undefined&&data[key]!==s[key])throw Error('Metadata nhật ký và ván không khớp.')
  for(const e of s.log){validateSnapshot(e.before);validateSnapshot(e.after);for(const key of metadata)if(e.before[key]!==s[key]||e.after[key]!==s[key])throw Error('Phiên bản thay đổi giữa ván.')}
  if(s.phase==='event'&&!eventsForGame(s).some(event=>event.id===s.eventId)||s.phase==='funding'&&!(s.pendingPayment&&Number.isSafeInteger(s.pendingPayment.remaining)&&s.pendingPayment.remaining>0))throw Error('Thiếu encounter hoặc funding đang chờ.')
  return s
}
export function saveGameLocally(game:GameState,storage?:Pick<Storage,'setItem'>){
  try{
    const data=JSON.parse(serializeLog(game)),markets:unknown[]=[],indices=new Map<string,number>()
    const pack=(s:Record<string,unknown>)=>{
      const key=JSON.stringify(s.market)
      let index=indices.get(key)
      if(index===undefined){index=markets.length;indices.set(key,index);markets.push(s.market)}
      delete s.market;s.marketRef=index
    }
    for(const e of data.state.log){pack(e.before);pack(e.after)}
    if(data.state.settlement)pack(data.state.settlement.before)
    const local={storageVersion:1,schemaVersion:data.schemaVersion,state:data.state,markets}
    ;(storage??window.localStorage).setItem(GAME_SAVE_KEY,JSON.stringify(local));return true
  }catch{return false}
}
export function loadGameLocally(storage?:Pick<Storage,'getItem'>):GameState|null{
  try{const text=(storage??window.localStorage).getItem(GAME_SAVE_KEY);return text?restoreSavedGame(text):null}catch{return null}
}
