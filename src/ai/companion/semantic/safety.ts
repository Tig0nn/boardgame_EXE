import {words,mentionedMoney} from './safety-lexical.ts'
import {operationReferences} from './question-signals.ts'
import {canonicalJson} from '../serialization.ts'
import {invalid} from '../schema.ts'
import type {SemanticContext,SemanticRoute,SemanticResponse,SemanticRequest} from './types.ts'
export interface ExplicitSlots {
 terms:number[];symbols:string[];issuers:string[];preferences:string[];sources:string[];assets:string[];operations:string[]
 amount:number|null;ambiguousAmount:boolean;explicitDraft:boolean;quoteTarget:boolean;malformed:boolean
}
const unique=(values:string[])=>[...new Set(values)]
const numbers:Record<string,number>={'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'12':12,một:1,hai:2,ba:3,bốn:4,năm:5,sáu:6,bảy:7,tám:8,chín:9,mười:10}
/** Explicit references only, NFC + whole tokens. No inferred amount/quote or model-supplied slot is authoritative. */
export function extractExplicitSlots(question:string,c:SemanticContext):ExplicitSlots {
 const w=words(question),h=w.has,list=w.list,terms:number[]=[],symbols:string[]=[],money=mentionedMoney(question)
 const ordinaryIncomeCycle=c.actual.domain!=='bank'&&money.value===null&&!money.ambiguous&&h('thu nhập','lương','sinh hoạt','nghĩa vụ')&&!h('gửi','tiết kiệm','kỳ hạn','đang nhập','đang điền','đang chọn','bản nháp','draft','bao nhiêu','tính','chính xác','báo giá')
 let malformed=false
 for(let i=0;i<list.length;i++){
  if(['kỳ','vòng'].includes(list[i+1])){
   if(list[i+1]==='vòng'&&list[i-1]==='trong'&&ordinaryIncomeCycle)continue
   const value=numbers[list[i]]??(/^\d+(?:[.,]\d+)?$/u.test(list[i])?Number(list[i].replace(',','.')):undefined)
   if(value!==undefined){if(!Number.isSafeInteger(value)||numbers[list[i-1]]!==undefined||['mươi','trăm','nghìn','ngàn'].includes(list[i-1]))malformed=true;else terms.push(value)}else if(numbers[list[i-1]]!==undefined||['mươi','trăm','nghìn','ngàn'].includes(list[i]))malformed=true
  }
  if(list[i]==='kỳ'&&list[i+1]==='hạn'){
   let j=i+2;if(['là','bằng','số'].includes(list[j]))j++
   if(numbers[list[j]]!==undefined){terms.push(numbers[list[j]]);if(numbers[list[j+1]]!==undefined||['mươi','trăm','nghìn','ngàn'].includes(list[j+1]))malformed=true}
   else if(/^\d/u.test(list[j]??''))malformed=true
  }
  if(['mã','symbol','symbolid','ticker'].includes(list[i])){
   const value=list[i+1]==='cổ'&&list[i+2]==='phiếu'?list[i+3]:list[i+1];if(value&&!['đang','hiện','cổ','nào'].includes(value))symbols.push(value)
  }
 }
 if(h('kỳ','kỳ hạn','vòng'))for(let i=1;i<list.length-1;i++){if(['hay','hoặc','và'].includes(list[i])&&numbers[list[i-1]]!==undefined&&numbers[list[i+1]]!==undefined)terms.push(numbers[list[i-1]],numbers[list[i+1]])}
 const knownSymbols=c.actual.facts.filter(f=>f.code==='price'&&!['gold','an-tam','but-pha','bonds'].includes(f.subject)).map(f=>f.subject.toLocaleLowerCase('vi'))
 for(const id of knownSymbols)if(list.includes(id))symbols.push(id)
 const issuers=[h('an tâm','an-tam')?'an-tam':null,h('bứt phá','but-pha')?'but-pha':null].filter((v):v is string=>v!==null)
 const preferences=[h('checkin','check in','check-in','không gian check-in','chụp ảnh')?'checkin':null,h('budget','giá cả hợp lý','hợp túi tiền')?'budget':null,h('taste','chất lượng đồ uống','hương vị')?'taste':null].filter((v):v is string=>v!==null)
 const op=words(operationReferences(question)).has
 const sources=[op('nguồn vàng','bán vàng','source gold')?'gold':null,op('nguồn cổ phiếu','bán cổ phiếu','source stocks')?'stocks':null,op('nguồn trái phiếu','bán trái phiếu','source bonds')?'bonds':null,op('rút tiết kiệm','nguồn tiết kiệm','source savings')?'savings':null,op('vay','nguồn nợ','source debt')?'debt':null].filter((v):v is string=>v!==null)
 for(let i=0;i<list.length;i++){
  if(['source','issuerid','preferenceid','hướng'].includes(list[i])){
   const key=list[i],value=list[i+1],allowed=key==='source'?['gold','stocks','bonds','savings','debt']:key==='issuerid'?['an','but']:['checkin','check','taste','budget','không','giá','chất','hương','cho','phát']
   if(value&&!allowed.includes(value))malformed=true
  }
 }
 const assets=[h('vàng')?'gold':null,h('cổ phiếu','chứng khoán')?'stocks':null,h('trái phiếu')?'bonds':null,h('ngân hàng','khoản gửi','tiết kiệm')?'bank':null,h('quán','kinh doanh')?'business':null,h('khóa học','khoá học')?'course':null].filter((v):v is string=>v!==null)
 const operations=[op('mua')?'buy':null,op('bán')?'sell':null,op('gửi')&&!op('rút tiết kiệm')?'deposit':null,op('nâng cấp')?'upgrade':null,op('vay','rút','huy động')?'fund':null].filter((v):v is string=>v!==null)
 const explicitDraft=h('đang nhập','đang điền','đang chọn','bản nháp','draft','số vừa nhập','số vừa điền','giá trị này','phương án này')
 const quoteTarget=explicitDraft||money.value!==null||money.ambiguous||terms.length>0||symbols.length>0||h('source','issuerid','symbolid','hướng')||h('bao nhiêu','nhiêu','còn mấy')&&operations.length>0
 return {terms:[...new Set(terms)],symbols:unique(symbols),issuers:unique(issuers),preferences:unique(preferences),sources:unique(sources),assets:unique(assets),operations:unique(operations),amount:money.value,ambiguousAmount:money.ambiguous,explicitDraft,quoteTarget,malformed}
}
export interface SafetyDecision {status:'reject'|'clarify';reason:SemanticRoute['reason']}
/** Abstention has priority over any classifier, including a future model candidate. */
export function semanticSafetyDecision(question:string,c:SemanticContext,scope?:SemanticRoute['scope']):SafetyDecision|null {
 const h=words(question).has,s=extractExplicitSlots(question,c),d=c.draft?.selection
 const decline=(reason:SemanticRoute['reason']):SafetyDecision=>({status:'clarify',reason})
 if(h('chọn hộ','chọn giúp','quyết định hộ','mua hộ','bán hộ','gửi hộ','tự mua','tự bán','hãy mua','hãy bán','tự bấm'))return {status:'reject',reason:'unsupported'}
 const override=h('bỏ','bỏ qua','loại bỏ','không cần','vô hiệu','quên','ignore','disregard','override')&&h('quy tắc','luật','giới hạn','policy','hướng dẫn','chỉ dẫn','instructions','rules','system')
 if(override||h('làm theo lời mình','làm theo lời tôi','disregard all prior instructions'))return {status:'reject',reason:'policy'}
 const lack=h('chưa có','chưa biết','thiếu','không biết','không có')&&h('doanh thu','chi phí','dòng tiền','lãi mỗi kỳ','chi phí đầu vào','thu nhập')
 const exact=h('chính xác','cụ thể','tính ra','tính luôn','tính','bao nhiêu kỳ','bao lâu')
 if(lack&&exact&&h('hòa vốn','hoà vốn','hoàn vốn','lấy lại vốn'))return decline('breakeven-unknown')
 if(exact&&h('lợi nhuận','doanh thu')&&(lack||h('lợi nhuận')))return decline('missing-data')
 const clauses=question.normalize('NFC').toLocaleLowerCase('vi').split(/[,;?]|\s+(?:rồi|đồng thời)\s+/u).filter(p=>p.trim())
 const requests=clauses.filter(p=>{const ph=words(p).has;return ph('giải thích','so sánh','phân biệt','tính','cho biết','nói','rút ra','bài học','bao nhiêu','bao lâu')})
 if(requests.length>1&&requests.some(p=>words(p).has('giải thích'))&&requests.some(p=>words(p).has('so sánh','phân biệt')))return decline('multi-intent')
 if(requests.length>1&&requests.some(p=>words(p).has('tính','bao nhiêu','bao lâu'))&&requests.some(p=>words(p).has('giải thích','so sánh','phân biệt','bài học','rút ra')))return decline('multi-intent')
 if(h('ngoài đời','tiền thật','đầu tư thật','bất động sản','bitcoin','crypto'))return {status:'reject',reason:'outside-game'}
 if(h('lượt tới','lượt sau','kỳ tiếp theo','vòng tiếp theo')&&h('giá','tiết lộ','xúc xắc','sự kiện'))return {status:'reject',reason:'future'}
 if(h('rng','seed','ngày mai','tuần sau','sự kiện tiếp theo')||h('giá')&&h('sẽ tăng','sẽ giảm','sắp tăng','sắp giảm'))return {status:'reject',reason:'future'}
 if(!s.quoteTarget&&scope!=='draft')return null
 if(s.ambiguousAmount)return decline('ambiguous')
 if(s.malformed||s.terms.length>1||s.symbols.length>1||s.issuers.length>1||s.preferences.length>1||s.sources.length>1)return decline('draft-mismatch')
 if(s.terms.some(t=>![1,2,3].includes(t)))return decline('draft-mismatch')
 if(!d)return decline('draft-missing')
 const draftAsset=d.asset??(d.form==='bank'?'bank':d.form==='business'?'business':d.source==='savings'?'bank':d.source)
 if(s.assets.some(asset=>asset!==draftAsset))return decline('draft-mismatch')
 if(s.terms.length&&s.terms[0]!==d.term||s.symbols.some(id=>id!==d.symbolId?.toLocaleLowerCase('vi'))||s.issuers.some(id=>id!==d.issuerId)||s.preferences.some(id=>id!==d.preferenceId))return decline('draft-mismatch')
 if(d.form==='funding'&&s.sources.some(source=>source!==d.source))return decline('draft-mismatch')
 if(d.form!=='funding'&&s.sources.length&&s.operations.includes('fund'))return decline('draft-mismatch')
 if(s.operations.some(op=>op!==d.operation&&!(d.form==='funding'&&['fund','sell'].includes(op))))return decline('draft-mismatch')
 if(s.amount!==null&&s.amount!==d.amount)return decline('amount-mismatch')
 return null
}
/** Final defense: a financial payload must use this question's validated context/quote and correlation. */
export function assertSemanticPayloadConsistency(r:SemanticRequest,route:SemanticRoute,p:SemanticResponse['gameplay'],d:SemanticResponse['draft']):void {
 if((p||d)&&semanticSafetyDecision(r.question,r.context,route.scope))invalid()
 if(p&&d)invalid()
 if(d){const c=r.context.draft;if(!c||route.scope!=='draft'||d.draftId!==c.draftId||d.draftRevision!==c.draftRevision||d.sessionEpoch!==r.sessionEpoch||d.revision!==r.revision||d.requestId!==r.requestId)invalid();if(d.status==='answered'&&canonicalJson(d.lines)!==canonicalJson(c.preview.lines))invalid()}
 if(p&&(route.scope!=='actual'||p.sessionEpoch!==r.sessionEpoch||p.revision!==r.revision||p.requestId!==r.requestId))invalid()
}
