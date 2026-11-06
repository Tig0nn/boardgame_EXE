import {SemanticAiContext,emptySemanticSnapshot,emptySemanticSubscribe} from './semantic-ai-context.ts'
import {SemanticAiResult} from './SemanticAiResult.tsx'
import {useContext,useId,useSyncExternalStore} from 'react'
import {universalAiFeature} from '../game/universal-ai-feature.ts'
import {suggestions} from '../../../src/ai/companion/universal-index.ts'
import {AiAnswerContent} from './AiAnswerContent.tsx'
import {presentGameplay} from './ai-answer-presentation.ts'
import type {createGameplayBinding,GameplayView} from '../game/universal-ai.ts'
import {DraftAiContext,emptyDraftSnapshot,emptyDraftSubscribe} from './draft-ai-context.ts'
import {DraftAiResult} from './DraftAiResult.tsx'
import {DRAFT_QUESTIONS,isDraftQuestion} from '../../../src/ai/companion/draft-index.ts'
import './universal-ai.css'
export function GameplayAiContent({binding,view,active=true}:{binding:ReturnType<typeof createGameplayBinding>;view:GameplayView;active?:boolean}) {
 const id=useId(),response=view.isCurrent()?view.response:null,draft=useContext(DraftAiContext)
 const draftView=useSyncExternalStore(draft?.subscribe??emptyDraftSubscribe,draft?.getSnapshot??emptyDraftSnapshot,emptyDraftSnapshot)
 const semantic=useContext(SemanticAiContext),semanticView=useSyncExternalStore(semantic?.subscribe??emptySemanticSubscribe,semantic?.getSnapshot??emptySemanticSnapshot,emptySemanticSnapshot)
 const edit=(q:string)=>{semantic?.cancel();draft?.cancel();binding.edit(q)}
 const loading=view.status==='loading'||draftView.status==='loading'||semanticView.status==='loading'
 const selection=draftView.context?.selection
 const general=suggestions(view.context!.domain,view.context!.profile,view.context!),samples=selection?DRAFT_QUESTIONS:general
 const ask=()=>{if(semantic){draft?.cancel();binding.edit(view.question);void semantic.ask(view.question)}else if(draft&&isDraftQuestion(view.question)){binding.edit(view.question);void draft.ask(view.question)}else{draft?.cancel();void binding.ask()}}
 return <section className="gameplay-ai" data-domain={view.context!.domain}>
  {selection&&<p className="draft-selection">Đang xem bản nháp: {selection.operation==='deposit'?'gửi tiết kiệm':selection.operation==='fund'?'huy động/thanh toán':selection.operation==='upgrade'?'nâng cấp quán':selection.operation==='buy'?'mua':'bán'} {selection.asset==='gold'?'Vàng':selection.asset==='stocks'?('Cổ phiếu '+(selection.symbolId??'(toàn danh mục)')):selection.asset==='bonds'?('Trái phiếu '+(selection.issuerId??selection.lotId??'')):''} {selection.source?({savings:'Tiết kiệm',stocks:'Cổ phiếu',gold:'Vàng',bonds:'Trái phiếu',debt:'Vay nợ'}[selection.source]):''} {selection.preferenceId?({checkin:'Không gian chụp ảnh',budget:'Giá hợp túi tiền',taste:'Hương vị'}[selection.preferenceId]):''}. Giá trị {selection.amount===null?'chưa hợp lệ':(selection.amount.toLocaleString('vi-VN')+' đ')}{selection.term?(' · '+selection.term+' kỳ'):''}. Chưa thực hiện.</p>}
  <div className="gameplay-samples" aria-label="Câu hỏi mẫu">{samples.map(q=><button type="button" key={q} onClick={()=>edit(q)}>{q}</button>)}{selection&&<details className="draft-general-samples"><summary>Câu hỏi về tình huống chung</summary><p>Các câu hỏi này dùng trạng thái hiện tại, không phân tích bản nháp.</p>{general.map(q=><button type="button" key={q} onClick={()=>edit(q)}>{q}</button>)}</details>}</div>
  <form onSubmit={e=>{e.preventDefault();ask()}}><label htmlFor={id}>Bạn muốn hiểu điều gì?</label><input id={id} value={view.question} maxLength={400} autoComplete="off" onChange={e=>edit(e.target.value)}/><button type="submit" disabled={!view.question.trim()||loading}>Gửi câu hỏi</button></form>
  <SemanticAiResult view={semanticView} active={active}/>
  <DraftAiResult view={draftView} active={active}/>
  <div aria-live="polite" aria-atomic="true" aria-busy={view.status==='loading'} className="gameplay-result">
   {view.status==='loading'&&<p role="status">Đang đối chiếu dữ kiện hiện tại…</p>}
   {response&&<AiAnswerContent answer={presentGameplay(response)}/>}
   {view.status==='error'&&view.isCurrent()&&<p role="alert">Chưa thể tạo giải thích. Bạn có thể thử lại hoặc quay lại Quyết định.</p>}
  </div>
  <button type="button" onClick={()=>{semantic?.cancel();draft?.cancel();binding.close();universalAiFeature.setEnabled(false)}}>Tắt AI ở phiên này</button>
 </section>
}
