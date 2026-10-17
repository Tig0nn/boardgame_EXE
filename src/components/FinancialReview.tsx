import {financialReview} from './financial-review'
import type {GameState} from '../game/types'

export function FinancialReview({game}:{game:GameState}){
  const facts=financialReview(game)
  if(!facts.length)return null
  return <section className="financial-review" aria-label="Nhìn lại quyết định tài chính">
    <h3>Quyết định trong ván</h3>
    <ul>{facts.slice(0,3).map(f=><li key={f.id} data-financial-fact={f.id}>{f.text}</li>)}</ul>
    {facts.length>3&&<details><summary>Các khoản khác</summary><ul>{facts.slice(3).map(f=><li key={f.id} data-financial-fact={f.id}>{f.text}</li>)}</ul></details>}
  </section>
}
