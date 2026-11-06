import type { EducationalAnswer } from './educational-ai-presentation.ts'
import './educational-answer.css'

export function EducationalAnswerContent({ answer }: { answer: EducationalAnswer }) {
  return <div className="educational-answer">
    <p className="educational-lead">{answer.lead}</p>
    {answer.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
    {answer.details.length > 0 && <details>
      <summary>Xem thêm dữ kiện</summary>
      <dl>{answer.details.map(detail => <div key={detail.key}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
    </details>}
  </div>
}
