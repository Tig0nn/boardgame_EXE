import {useEffect,useRef,useState} from 'react'
import type {RefObject} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from '../../../src/components/Modal'
import type {GameState} from '../../../src/game/types'
import type {GoldSession,GoldReadDTO} from '../game/gold-historical-contract'
import {createGoldBinding} from '../game/gold-historical-review'
import {goldEntrySequence,goldModalTarget,goldPresentation} from './gold-historical-presentation'
import './gold-historical-review.css'

/** Synchronous display helper; no hooks, retained DTO or financial simulation. */
function renderGoldResult(result:GoldReadDTO|null,pending:boolean){
 if(pending&&!result)return <p role="status">Đang kiểm chứng lựa chọn vàng… Bạn có thể đóng bất cứ lúc nào.</p>
 const view=goldPresentation(result)
 if(!view)return <p role="status">{result?.status==='known'?'Chưa có mốc bán được xác minh. Chưa hiển thị kết quả ròng.':'Chưa đủ lịch sử còn hiệu lực để so sánh. Hãy quay lại và mở lại khi đủ điều kiện.'}</p>
 return <>
  <p className="gold-review-checkpoint">{view.checkpoint} · đã hoàn tất · cùng mốc so sánh</p>
  <div className="gold-review-choices">
   <section className="gold-review-actual" aria-label="Bạn đã chọn"><h3>Bạn đã chọn</h3><p>{view.actualChoice}</p><span>Tiền mặt tại mốc so sánh</span><strong>{view.actualCash}</strong></section>
   <section className="gold-review-alternative" aria-label="Nếu chọn khác"><h3>Nếu chọn khác</h3><p>{view.alternativeChoice}</p><span>Tiền mặt sau bán trong mô phỏng</span><strong>{view.alternativeCash}</strong></section>
  </div>
  <section className="gold-review-delta" aria-label="Chênh lệch ròng"><h3>Chênh lệch ròng tại START</h3><strong>{view.signedDifference}</strong><span>Nếu chọn khác − Bạn đã chọn</span></section>
  <details className="gold-review-ledger"><summary>Chi tiết vàng và tiền bán</summary><dl>{view.rows.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><p>{view.liquidity}</p><p className="gold-review-note">Tiền bán trong mô phỏng đã trừ chênh lệch mua–bán và phí. Giá trị vàng đang giữ không được cộng như tiền mặt.</p></details>
  <p className="gold-review-assumption">{view.assumption}</p>
  <section className="gold-review-lesson" aria-label="Bài học"><h3>Bài học từ lựa chọn</h3><p>{view.lesson}</p></section>
 </>
}

/** Pure DTO renderer is exported for explicitly labelled presentation fixtures. */
export function GoldReviewResult({result,pending}:{result:GoldReadDTO|null;pending:boolean}){return renderGoldResult(result,pending)}
function BoundGoldResult({controller,pending}:{controller:ReturnType<typeof createGoldBinding>;pending:boolean}){
 // Read at the financial consumption point; never carry a DTO through React state/ownership props.
 return renderGoldResult(controller.read(),pending)
}
/** Proposal only: read-only Gold adjunct; App owns the stable gameplay scope. */
export default function GoldHistoricalReview({session,game,root}:{session:GoldSession;game:GameState;root:RefObject<HTMLDivElement|null>}){
 const enabled=import.meta.env.DEV&&typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('goldHistoricalWhatIf')==='1'
 const[controller]=useState(()=>createGoldBinding())
 const generation=useRef(0)
 const[entry]=useState(()=>{if(typeof document==='undefined')return null;const node=document.createElement('div');node.className='gold-review-entry';return node})
 const[opened,setOpened]=useState<{owner:typeof controller;session:GoldSession;snapshot:GameState;sequence:number;pending:boolean}|null>(null)
 const sequence=enabled?goldEntrySequence(game,session.getSnapshot()):null
 const open=!!opened&&opened.owner===controller&&opened.session===session&&opened.snapshot===game&&game===session.getSnapshot()&&opened.sequence===sequence
 useEffect(()=>{
  if(!enabled)return
  controller.activate(session,'gold-ui-mount')
  const viewGeneration=generation
  const stop=session.subscribe(()=>{viewGeneration.current++;setOpened(null)})
  return()=>{stop();viewGeneration.current++;controller.dispose()}
 },[controller,enabled,session])
 useEffect(()=>{
  if(!enabled||!entry||!root.current||sequence===null)return
  const target=goldModalTarget(root.current,game,session.getSnapshot());if(!target)return
  target.append(entry)
  return()=>entry.remove()
 },[enabled,entry,game,sequence,session,root])
 const close=()=>{generation.current++;controller.dispose();controller.activate(session,'gold-ui-close');setOpened(null)}
 const launch=()=>{
  if(sequence===null||!root.current||entry?.parentElement!==goldModalTarget(root.current,game,session.getSnapshot()))return
  const ordinal=++generation.current
  setOpened({owner:controller,session,snapshot:game,sequence,pending:true})
  void controller.request(sequence).then(()=>{
   if(ordinal!==generation.current||session.getSnapshot()!==game)return
   setOpened(current=>current?.session===session&&current.snapshot===game&&current.sequence===sequence?{...current,pending:false}:current)
  })
 }
 return <>

  {enabled&&entry&&sequence!==null&&createPortal(<button type="button" data-gold-review-entry="" className="gold-review-launch" onClick={launch}>Nhìn lại lựa chọn vàng · DEV</button>,entry)}
  {enabled&&open&&<Modal title="Nhìn lại lựa chọn vàng" className="gold-historical-modal" onClose={close}>
   <span className="gold-review-kicker">DEV · CHỈ XEM · MÔ PHỎNG LỊCH SỬ</span><h2>Nhìn lại lựa chọn vàng</h2>
   <BoundGoldResult controller={controller} pending={!!opened?.pending}/>
   <button type="button" className="gold-review-return" onClick={close}>Quay lại tái cân bằng</button>
  </Modal>}
 </>
}




