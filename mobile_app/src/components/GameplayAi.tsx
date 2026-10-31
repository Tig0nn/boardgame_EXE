import {useId} from 'react'
import {universalAiFeature} from '../game/universal-ai-feature.ts'
import {factLabel,factValue,suggestions,actionLabel,resourceLabel} from '../../../src/ai/companion/universal-index.ts'
import type {createGameplayBinding,GameplayView} from '../game/universal-ai.ts'
import './universal-ai.css'
export function GameplayAiContent({binding,view}:{binding:ReturnType<typeof createGameplayBinding>;view:GameplayView}) {
 const id=useId(),response=view.isCurrent()?view.response:null
 return <section className="gameplay-ai" data-domain={view.context!.domain}>
  <p>AI giải thích tình huống đang mở; bạn tự quyết định. Chỉ hỗ trợ các cách hỏi đã kiểm chứng.</p>
  <div className="gameplay-samples" aria-label="Câu hỏi mẫu">{suggestions(view.context!.domain,view.context!.profile,view.context!).map(q=><button type="button" key={q} onClick={()=>binding.edit(q)}>{q}</button>)}</div>
  <form onSubmit={e=>{e.preventDefault();void binding.ask()}}><label htmlFor={id}>Bạn muốn hiểu điều gì?</label><input id={id} value={view.question} maxLength={400} autoComplete="off" onChange={e=>binding.edit(e.target.value)}/><button type="submit" disabled={!view.question.trim()||view.status==='loading'}>Gửi câu hỏi</button></form>
  <div aria-live="polite" aria-atomic="true" aria-busy={view.status==='loading'} className="gameplay-result">
   {view.status==='loading'&&<p role="status">Đang đối chiếu dữ kiện hiện tại…</p>}
   {response&&<><h3>{response.conclusion}</h3><p>{response.explanation}</p>
    {response.status==='answered'&&<>{response.actions.length>0&&<><h4>Quyền quyết định hiện tại</h4><ul>{response.actions.map(a=><li key={a}>{actionLabel(a,view.context!.domain)}</li>)}</ul></>}{response.resources.length>0&&<><h4>Nguồn huy động hiện có nếu thiếu tiền bắt buộc</h4><ul>{response.resources.map(r=><li key={r}>{resourceLabel(r)}</li>)}</ul></>}<h4>Dữ kiện / báo giá chưa thực hiện</h4><dl>{response.facts.map(f=><div className="gameplay-fact" key={`${f.code}:${f.subject}`}><dt>{factLabel(f)}</dt><dd>{factValue(f)}</dd></div>)}</dl>
     {response.entries.length>0&&<><h4>Thu/chi/nghĩa vụ đã ghi nhận</h4>{response.entries.map((entry,i)=><p key={i}>{entry.label}: <strong>{entry.amount.toLocaleString('vi-VN')} đ</strong></p>)}</>}
     <p className="gameplay-reflection">{response.reflection}</p></>}
    <ul className="gameplay-limitations">{response.limitations.map(l=><li key={l}>{l}</li>)}</ul></>}
   {view.status==='error'&&view.isCurrent()&&<p role="alert">Chưa thể tạo giải thích. Bạn có thể thử lại hoặc quay lại Quyết định.</p>}
  </div>
  <button type="button" onClick={()=>{binding.close();universalAiFeature.setEnabled(false)}}>Tắt AI ở phiên này</button>
 </section>
}
