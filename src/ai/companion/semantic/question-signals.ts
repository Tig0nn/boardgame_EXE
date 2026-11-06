import {words} from './safety-lexical.ts'
import {normalizeQuestion} from '../universal/questions.ts'

/** Only a conditional mechanism/risk question, never a withdrawal quote or command. */
export function earlyWithdrawalRisk(question:string):boolean {
 const h=words(question).has
 return h('nếu','khi','trường hợp')&&h('rút sớm','rút trước hạn','rút tiết kiệm trước hạn')&&h('rủi ro','mất lãi','bất lợi','dè chừng')
  &&!h('bao nhiêu','số tiền','thực nhận','báo giá','tính','thực hiện','hãy','tự','cho tôi rút','đổi sang','chuyển sang')&&!asksCashOutcome(question)
}
export function operationReferences(question:string):string {
 // A spread noun phrase names a price difference, not two requested trades.
 // Only that phrase is collapsed; independent buy/sell verbs elsewhere stay visible.
 const operations=question.normalize('NFC').toLocaleLowerCase('vi').replace(/(?<!\p{L})(?:chênh lệch|spread)(?:\s+giá)?\s+(?:giữa\s+)?(?:giá\s+)?mua(?:\s*(?:[-–—‑/]|và)\s*|\s+)(?:giá\s+)?bán(?!\p{L})/gu,'spread')
 if(!earlyWithdrawalRisk(question))return operations
 // Remove only the educational early-withdrawal phrase. Other operations/slots remain constraints.
 return operations.replace(/(?<!\p{L})rút\s+(?:tiết kiệm\s+)?(?:sớm|trước hạn)(?!\p{L})/gu,' ')
}
/** Explicit monetary outcomes have priority over generic “explain/how” wording. */
export function asksCashOutcome(question:string):boolean {
 const n=normalizeQuestion(question)
 const target=/\bvi\b|tien mat|khoan (?:bat buoc|thieu)|con thieu|nghia vu|\bphi\b|chi phi|spread|chenh lech|tien (?:tra|nhan)/.test(n)
 const outcome=/bao nhieu|con lai|con thieu|bot di|\bbot\b|tang giam|thay doi|giam (?:ra sao|the nao)|con (?:ra sao|the nao)|con lai (?:ra sao|the nao)/.test(n)
 return target&&outcome
}
