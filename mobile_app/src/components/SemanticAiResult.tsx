import {useEffect,useRef} from 'react'
import type {SemanticView} from '../game/semantic-ai.ts'
import {AiAnswerContent} from './AiAnswerContent.tsx'
import {presentDraft,presentGameplay} from './ai-answer-presentation.ts'
export function SemanticAiResult({view,active}:{view:SemanticView;active:boolean}){
 const response=view.isCurrent()?view.response:null,region=useRef<HTMLElement>(null)
 useEffect(()=>{if(active&&(response||view.status==='error')&&view.isCurrent())region.current?.scrollIntoView({block:'start',behavior:'instant'})},[response,view,active])
 const p=response?.gameplay,d=response?.draft
 if(!response&&view.status!=='loading'&&!(view.status==='error'&&view.isCurrent()))return null
 return <section ref={region} className="semantic-result" aria-label="Giải thích câu hỏi tự nhiên" aria-live="polite" aria-busy={view.status==='loading'}>
  {view.status==='loading'&&<p role="status">Đang đối chiếu ý hỏi và dữ kiện…</p>}
  {response&&(p?<AiAnswerContent answer={presentGameplay(p,response.route,response.notice)}/>:d?<AiAnswerContent answer={presentDraft(d,response.route,response.notice,view.context?.draft??undefined)}/>:<p className="semantic-notice">{response.notice}</p>)}
  {view.status==='error'&&view.isCurrent()&&<p role="alert">Chưa thể giải thích câu hỏi. Chưa có lựa chọn hoặc giao dịch nào được thực hiện; thử lại hoặc quay về Quyết định.</p>}
 </section>
}
