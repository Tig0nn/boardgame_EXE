import {useEffect,useRef} from 'react'
import './draft-ai.css'
import type {DraftView} from '../game/draft-ai.ts'
import {AiAnswerContent} from './AiAnswerContent.tsx'
import {presentDraft} from './ai-answer-presentation.ts'
export function DraftAiResult({view,active}:{view:DraftView;active:boolean}){
 const response=view.isCurrent()?view.response:null,region=useRef<HTMLElement>(null)
 useEffect(()=>{if(active&&(response||view.status==='error')&&view.isCurrent())region.current?.scrollIntoView({block:'start',behavior:'instant'})},[response,view,active])
 if(!response&&view.status!=='loading'&&!(view.status==='error'&&view.isCurrent()))return null
 return <section ref={region} className="draft-ai-result" aria-label="Giải thích bản nháp" aria-live="polite" aria-busy={view.status==='loading'}>
  {view.status==='loading'&&<p role="status">Đang đối chiếu giá trị đang nhập…</p>}
  {response&&<AiAnswerContent answer={presentDraft(response,undefined,'',view.context??undefined)}/>}
  {view.status==='error'&&view.isCurrent()&&<p role="alert">Chưa thể giải thích bản nháp. Chưa có giao dịch được thực hiện; thử lại hoặc quay về Quyết định.</p>}
 </section>
}
