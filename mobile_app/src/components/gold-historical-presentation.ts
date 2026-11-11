import {money,signedMoney} from '../../../src/game/format.ts'
import type {GameState} from '../../../src/game/types.ts'
import {firstGoldSequence,publicGoldDTO} from '../game/gold-historical-contract.ts'
import type {GoldReadDTO} from '../game/gold-historical-contract.ts'
/** Presentation eligibility only. The existing worker must still prove the full historical source. */
export function goldEntrySequence(game:GameState,current:GameState):number|null{
 try{
 if(game!==current||game.phase!=='rebalancing'||game.pendingPayment||game.settlement||game.termination)return null
 const sequence=firstGoldSequence(game);if(sequence===null)return null
 const decision=game.log[sequence-1],checkpoint=game.log.find(e=>e.kind==='settlement'&&e.sequence>sequence)
 return checkpoint&&game.log.at(-1)===checkpoint&&checkpoint.lap===decision.lap&&game.lap===checkpoint.lap&&game.turn===checkpoint.after.turn?sequence:null
 }catch{return null}
}
/** Fail closed if the scoped host has an ambiguous modal, wrong phase, heading or body. */
export function goldModalTarget(root:HTMLElement,game:GameState,current:GameState):HTMLElement|null{
 if(goldEntrySequence(game,current)===null)return null
 const cards=[...root.querySelectorAll<HTMLElement>('.gamified-modal-card')].filter(el=>el.closest('[data-gold-review-host]')===root)
 if(cards.length!==1)return null
 const card=cards[0];if(card.querySelector('h2')?.textContent?.trim()!=='Ghé ví tại ô Xuất phát')return null
 const bodies=[...card.querySelectorAll<HTMLElement>('.anime-slim-scroll')].filter(el=>el.closest('.gamified-modal-card')===card)
 return bodies.length===1?bodies[0]:null
}
/** Formats a current bound DTO; this helper is not an authority or a second financial engine. */
export function goldPresentation(input:GoldReadDTO|null){
 if(input?.status!=='supported')return null
 try{
  const r=publicGoldDTO(input);if(r.status!=='supported')return null
  const outcome=r.difference<0?'Giữ tiền đã tránh một khoản lỗ ròng giả định ở mốc này.':r.difference>0?'Nhánh mua rồi bán vàng có kết quả ròng cao hơn tại START đã ghi nhận.':'Không có chênh lệch ròng giữa hai phương án tại mốc này.'
  return{
   actualChoice:'Bỏ qua mua vàng tại ô giao dịch.',
   alternativeChoice:`Giả sử mua ${money(r.principal)} vàng, rồi bán toàn bộ khoản vàng mới tại START kế tiếp.`,
   assumption:`${money(r.principal)} là ngân sách phân tích giả định. Lịch sử không chứng minh bạn chủ động giữ đúng khoản này. Giao dịch bán chỉ xảy ra trong nhánh mô phỏng.`,
   checkpoint:`START vòng ${r.checkpoint.lap} · lượt ${r.checkpoint.turn}`,
   actualCash:money(r.actualCash),alternativeCash:money(r.alternativeCashAfterSale),signedDifference:signedMoney(r.difference),
   rows:[
    {label:'Tiền mặt nhánh mua trước bán',value:money(r.alternativeCashBeforeSale)},
    {label:'Giá trị vàng đang giữ · chưa phải tiền mặt',value:money(r.heldGoldGross)},
    {label:'Trừ chênh lệch mua–bán (spread)',value:signedMoney(-r.spread)},
    {label:'Phí bán',value:signedMoney(-r.saleFee)},
    {label:'Tiền bán thực nhận trong mô phỏng',value:money(r.netSaleProceeds)},
   ],
   liquidity:`Ngay sau lựa chọn, bạn còn ${money(r.actualImmediateCash)} dùng ngay; nhánh mua còn ${money(r.alternativeImmediateCash)}.`,
   outcome,
   lesson:`${outcome} Giá vàng có thể tăng hoặc giảm. Giá trị đang nắm giữ chưa phải tiền bán thực nhận; chênh lệch mua–bán và phí có thể khiến giá tăng mà vẫn lỗ ròng. Giữ tiền mặt giúp sẵn tiền khi cần chi. Kết quả quá khứ không chứng minh bạn chọn sai hay bảo đảm kết quả tương lai.`,
  }
 }catch{return null}
}

