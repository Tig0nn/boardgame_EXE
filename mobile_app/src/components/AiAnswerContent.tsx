import type {AnswerPresentation,AnswerDetail} from './ai-answer-presentation.ts'
import './ai-answer.css'

function AnswerFacts({facts}:{facts:AnswerDetail[]}){
 return <dl>{facts.map(f=><div className="gameplay-fact" key={f.key}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
}
export function AiAnswerContent({answer}:{answer:AnswerPresentation}){
 const primary=answer.lead?[]:answer.details.slice(0,4),more=answer.lead?answer.details:answer.details.slice(4)
 return <div className="ai-answer">
  {answer.lead?<p className="ai-answer-lead">{answer.lead}</p>:answer.paragraphs.map(p=><p key={p}>{p}</p>)}
  {primary.length>0&&<AnswerFacts facts={primary}/>}
  {(more.length>0||answer.lead&&answer.paragraphs.length>0)&&<details><summary>Xem thêm dữ kiện liên quan</summary>{answer.lead&&answer.paragraphs.map(p=><p key={p}>{p}</p>)}{more.length>0&&<AnswerFacts facts={more}/>}</details>}
 </div>
}
