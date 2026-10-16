import { boardFor } from '../data/board.ts'
import { validateLivingBoard } from './living-expenses.ts'
import { encounterRulesForGame } from './encounters.ts'
import { businessRulesForGame } from './business.ts'
import { bondRulesForGame } from './bond-credit.ts'
import { createSavingsProfile } from './savings.ts'
import { isCoreMvp, goalForGame } from './rules-profile.ts'
import { serializeLog } from './log.ts'
import type { GameState, Snapshot } from './types.ts'

export const GAME_SAVE_KEY='xvtl:mobile:game:v1'
const metadata=['gameplayProfile','goalRulesVersion','livingExpenseRulesVersion','boardRevision','encounterRulesVersion','businessRulesVersion','bondRulesVersion','boardLayout','totalLaps'] as const
function validateSnapshot(s:Snapshot){
  validateLivingBoard(s);goalForGame(s);encounterRulesForGame(s);businessRulesForGame(s);bondRulesForGame(s)
  if(!['A20','C20','B18'].includes(s.boardLayout)||!['original','experimental-a','experimental-b'].includes(s.gameMode)||!['forecast','rolling','event','funding','summary','rebalancing','finished'].includes(s.phase))throw Error('Trạng thái ván không hợp lệ.')
  const board=boardFor(s)
  if(!Number.isInteger(s.position)||s.position<0||s.position>=board.length||!Number.isInteger(s.totalLaps)||s.totalLaps<1||s.totalLaps>12||!Number.isInteger(s.lap)||s.lap<1||s.lap>s.totalLaps)throw Error('Vị trí/vòng chơi không hợp lệ.')
  for(const n of Object.values(s.portfolio))if(!Number.isSafeInteger(n)||n<0)throw Error('Số dư không hợp lệ.')
  if(!Number.isSafeInteger(s.obligations)||s.obligations<0||!Number.isSafeInteger(s.pendingCost)||s.pendingCost<0)throw Error('Nghĩa vụ không hợp lệ.')
  if(s.savingsProfile&&JSON.stringify(s.savingsProfile)!==JSON.stringify(createSavingsProfile(s.savingsProfile.id)))throw Error('Lãi tiết kiệm không khớp phiên bản.')
  if(isCoreMvp(s)&&(s.totalLaps!==4||s.encounterRulesVersion!=='b18-tile-trading-v1'||s.bondRulesVersion!=='v2.5-credit-risk'||s.businessRulesVersion!=='v2.4-customer-preferences'||s.market.catalogVersion!=='vn-v1'))throw Error('Metadata B18 không khớp.')
  if(!Array.isArray(s.deposits)||!Array.isArray(s.bondLots)||!Array.isArray(s.market.stocks)||!s.business||!s.stockHoldings)throw Error('Thiếu dữ liệu tài sản.')
}
// Local save/import boundary; no migration, code execution or financial rewrite.
// This validates shape/version consistency, not anti-cheat authenticity.
export function restoreSavedGame(text:string):GameState{
  if(text.length>20_000_000)throw Error('Nhật ký quá lớn.')
  const data=JSON.parse(text)
  if(![4,5,6].includes(data?.schemaVersion)||!data.state||!Array.isArray(data.state.log)||data.state.log.length>5000)throw Error('Không hỗ trợ định dạng ván này.')
  const s=data.state as GameState
  validateSnapshot(s)
  if(typeof s.seed!=='string'||!s.seed.length||s.seed.length>128||!Array.isArray(s.summaries)||!Number.isInteger(s.turn)||s.turn<0)throw Error('Thiếu thông tin ván chơi.')
  if(isCoreMvp(s)!==(data.schemaVersion===6))throw Error('Schema và profile không khớp.')
  for(const key of metadata)if(data[key]!==undefined&&data[key]!==s[key])throw Error('Metadata nhật ký và ván không khớp.')
  for(const e of s.log){validateSnapshot(e.before);validateSnapshot(e.after);for(const key of metadata)if(e.before[key]!==s[key]||e.after[key]!==s[key])throw Error('Phiên bản thay đổi giữa ván.')}
  if(s.phase==='event'&&typeof s.eventId!=='string'||s.phase==='funding'&&!(s.pendingPayment&&s.pendingPayment.remaining>0))throw Error('Thiếu encounter hoặc funding đang chờ.')
  return s
}
export function saveGameLocally(game:GameState,storage?:Pick<Storage,'setItem'>){
  try{(storage??window.localStorage).setItem(GAME_SAVE_KEY,serializeLog(game));return true}catch{return false}
}
export function loadGameLocally(storage?:Pick<Storage,'getItem'>):GameState|null{
  try{const text=(storage??window.localStorage).getItem(GAME_SAVE_KEY);return text?restoreSavedGame(text):null}catch{return null}
}
