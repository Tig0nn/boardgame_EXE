import {extractExplicitSlots,semanticSafetyDecision} from './safety.ts'
import {mentionedMoney} from './safety-lexical.ts'
import {asksCashOutcome,earlyWithdrawalRisk} from './question-signals.ts'
import {parseQuestionText} from '../question-contract.ts'
import {parseSemanticContext} from './contract.ts'
import {DRAFT_QUESTIONS} from '../draft/answer.ts'
import {normalizeQuestion,classifyGameplay} from '../universal/questions.ts'
import type {SemanticContext,SemanticRoute} from './types.ts'
const names={gold:/\bvang\b/,stocks:/co phieu|chung khoan/,bonds:/trai phieu|coupon/,bank:/ngan hang|tiet kiem|so tiet kiem/,business:/\bquan\b(?! sat)|kinh doanh/,course:/khoa hoc|hoc phi/} as const
const pattern={
 learn:/hoc duoc|rut ra|bai hoc|kinh nghiem|can nho|luu y|de y|nen quan sat/,
 compare:/so sanh|khac nhau|khac gi|khac cho|phan biet|cach nao|nguon nao|lua chon nao|dang can nhac|co dang|tra ngay hay|tam hay|ky han nao/,
 risk:/rui ro|\blo\b|mat lai|mat tien|ket tien|an toan|bao dam|dam bao|chac chan|cham tra|vo no|hoa von|lay lai von|mien phi|khong.*phi|ban ngay/,
 cashflow:/tien mat|(?:trong|vao|vo|ve) vi|vi (?:toi|minh|con|hien|dang)|con nhieu|con bao|con may|thu nhap|luong|sinh hoat|nghia vu|dong tien|chi phi|thu chi|dao han|khi nao.*nhan|thieu tien|tra duoc|lay tien/,
 explain:/giai thich|la (khoan )?gi|nghia (la )?(gi|sao)|hoat dong|van hanh|co che|vi sao|tai sao|sao lai|the nao|ra sao|lam gi|chuyen gi|da xay ra|xu ly gi|dung de/,
} as const
/** Lexical/compositional rules, not probability estimates or a list of held-out sentences. */
export function classifySemantic(question:string,c:SemanticContext):SemanticRoute {
 question=parseQuestionText(question);c=parseSemanticContext(c)
 const n=normalizeQuestion(question),amount=mentionedMoney(question),a=c.actual,d=c.draft?.selection
 const assets=(Object.entries(names) as [keyof typeof names,RegExp][]).filter(([,re])=>re.test(n)).map(([id])=>id)
 const explicit=extractExplicitSlots(question,c),term=explicit.terms.length===1&&[1,2,3].includes(explicit.terms[0])?explicit.terms[0] as 1|2|3:null
 const symbolId=a.domain==='stocks'?a.facts.find(f=>f.code==='price'&&new RegExp('\\b'+f.subject.toLowerCase()+'\\b').test(n))?.subject??null:null
 const issuerId=/an tam/.test(n)?'an-tam':/but pha/.test(n)?'but-pha':null
 const polarity=/khong (mua|ban|gui|nang cap)|chua (mua|ban|gui)/.test(n)?'negative':'positive'
 const base:SemanticRoute={status:'reject',reason:'unsupported',scope:null,intent:null,focus:'general',polarity,mentionedAmount:amount.value,term,asset:assets.length===1?assets[0]:null,symbolId,issuerId}
 const stop=(status:'reject'|'clarify',reason:SemanticRoute['reason'])=>({...base,status,reason})
 const safety=semanticSafetyDecision(question,c);if(safety)return stop(safety.status,safety.reason)
 if(/bo qua|ignore|system prompt|api key|developer message|doi (luat|policy)|thay (luat|policy)|tiet lo.*(key|prompt)|lam theo lenh|in ra.*seed/.test(n))return stop('reject','policy')
 if(/ngoai doi|tien that|dau tu that|bat dong san|bitcoin|crypto|thoi tiet|bong da|\ban gi\b/.test(n))return stop('reject','outside-game')
 if(/ngay mai|tuan sau|rng|\bseed\b|su kien (ke|tiep)|xuc xac.*(ra|may|bao)|gia.*(se|sap) (tang|giam)|du doan/.test(n))return stop('reject','future')
 if(assets.length>1)return stop('reject','cross-domain')
 const funding=a.domain==='funding',rebalance=a.domain==='rebalancing'
 if(base.asset&&a.domain!==base.asset&&!(funding||rebalance)&&!(a.domain==='personal'&&base.asset===null))return stop('reject','cross-domain')
 if(/sua (xe|tam)|chiec xe/.test(n)&&!(a.domain==='personal'&&a.eventId==='repair'))return stop('reject','cross-domain')
 const clauses=question.split(/[;?]/).flatMap(s=>normalizeQuestion(s).split(/\s+(?:va|dong thoi|roi)\s+/)).filter(Boolean)
 if(clauses.length>1&&clauses.every(s=>Object.values(pattern).some(re=>re.test(s)))&&new Set(clauses.map(s=>Object.entries(pattern).find(([,re])=>re.test(s))?.[0])).size>1)return stop('clarify','multi-intent')
 if(amount.ambiguous)return stop('clarify','ambiguous')
 const focus:SemanticRoute['focus']=/hoa von|lay lai von/.test(n)?'breakeven':/phi|spread|chenh lech|ban ngay/.test(n)?'fees':/dao han|khi nao.*nhan/.test(n)?'maturity':/nghia vu|khoan bat buoc|tra sau/.test(n)?'obligation':/ban.*(nhan|thu|bao nhieu|con nhieu)|bao gia ban/.test(n)?'sale':/luong|thu nhap/.test(n)?'income':/tien mat|\bvi\b|thieu tien/.test(n)?'liquidity':'general'
 const legacy=classifyGameplay(question,a.domain,a.eventId)
 const legacyDraft=DRAFT_QUESTIONS.findIndex(q=>normalizeQuestion(q)===n)
 let intent:SemanticRoute['intent']=legacy??(legacyDraft===1?'cashflow':legacyDraft>=0?'explain':null)
 if(legacyDraft<0){
  if(earlyWithdrawalRisk(question))intent='risk'
  else if(asksCashOutcome(question)&&!pattern.risk.test(n)&&!pattern.learn.test(n)&&!pattern.compare.test(n))intent='cashflow'
 }
 if(!intent){for(const key of ['learn','compare','risk','cashflow','explain'] as const)if(pattern[key].test(n)){intent=key;break}}
 if(!intent&&/co lai|lai suat|ky han|tin kinh te|ban tin|o nay/.test(n))intent='explain'
 if(!intent){const ambiguous=/^(sao|the nao|lam sao|cai nay|co nen|duoc khong)/.test(n);return stop(ambiguous?'clarify':'reject',ambiguous?'ambiguous':'unsupported')}
 const financial=/phi|lai|von|gia|tien|\btra\b|\bnhan\b|\bmua\b|\bban\b|\bgui\b|\bvay\b|\bno\b|thu nhap|thu chi|luong|nghia vu|thanh khoan|start|ban tin|tin kinh te|tai san|muc tieu|o nay|tai day|toi day|tinh huong|lua chon|phuong an|ban nhap|dang nhap|bai hoc|hoc duoc|rut ra|kinh nghiem|can nho|luu y|de y|quan sat|truoc khi gieo|tinh hinh/.test(n)
 if(!legacy&&legacyDraft<0&&!assets.length&&!financial&&!/(?:trong|vao|vo|ve) vi|vi (?:toi|minh|con|hien|dang)/.test(n))return stop('reject','unsupported')
 if(/nen mua (gi|ma nao)|chon ho|quyet dinh ho|mua ho|ban ho|tu (mua|ban)|gui ho/.test(n))return stop('reject','unsupported')
 const explicitDraft=/dang (nhap|dien|chon)|ban nhap|\bdraft\b|so vua (nhap|dien)|gia tri nay|phuong an nay/.test(n)
 const enteredFlow=polarity==='positive'&&explicit.operations.length>0&&/con (nhieu|bao|may)|bao nhieu|may dong|tra (bao|nhieu)|nhan (bao|nhieu)|vi toi/.test(n)
 const wantsDraft=legacyDraft>=0||explicitDraft||amount.value!==null||term!==null&&!legacy||enteredFlow
 let scope:'actual'|'draft'=wantsDraft?'draft':'actual'
 if(wantsDraft){
  if(!d)return stop('clarify','draft-missing')
  if(base.asset&&base.asset!==(d.asset??(d.form==='bank'?'bank':d.form==='business'?'business':d.source)))return stop('clarify','draft-mismatch')
  if(symbolId&&symbolId!==d.symbolId||issuerId&&issuerId!==d.issuerId||term!==null&&term!==d.term)return stop('clarify','draft-mismatch')
  const operation=explicit.operations.length===1?explicit.operations[0]:null
  if(operation&&operation!==d.operation&&d.form!=='funding')return stop('clarify','draft-mismatch')
  if(amount.value!==null&&amount.value!==d.amount)return stop('clarify','amount-mismatch')
 }
 // A requested sale amount or maturity cannot be silently replaced by an aggregate mechanism.
 if(focus==='sale'&&scope==='actual'&&d&&polarity==='positive')scope='draft'
 const reason=focus==='breakeven'?'breakeven-unknown':'supported'
 const deliverySafety=semanticSafetyDecision(question,c,scope);if(deliverySafety)return stop(deliverySafety.status,deliverySafety.reason)
 return {...base,status:'route',reason,scope,intent,focus}
}
