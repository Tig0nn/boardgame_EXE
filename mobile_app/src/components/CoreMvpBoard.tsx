import { tileDisplayLabel } from '../../../src/components/player-language'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { GameState } from '../../../src/game/types'
import { boardFor, MULTI_COURSE_B18_BOARD } from '../../../src/data/board'
import { Modal } from '../../../src/components/Modal'
import { Character3D } from './Character3D'
import { tileInformation } from '../../../src/components/tile-information'
import { GlossaryText } from '../../../src/components/FinancialTerm'

const labels:Record<string,string[]>={start:['Xuất','phát'],macro:['Sự','kiện'],bonds:['Trái','phiếu'],personal:['Biến cố','cá nhân'],course:['Đầu tư','bản thân'],gold:['Vàng'],bank:['Ngân','hàng'],business:['Kinh','doanh'],stocks:['Cổ','phiếu']}
const colors:Record<string,string>={start:'#f5d575',macro:'#f6b49b',bonds:'#b5dff0',personal:'#f6b49b',course:'#dfd0f3',gold:'#ffe09a',bank:'#b6e2cb',business:'#edccb1',stocks:'#b5dff0'}

export function CoreMvpBoard({game,position=0,lap=1,totalLaps=4,moving=false,dancing=false,children}:{game?:GameState;position?:number;lap?:number;totalLaps?:number;moving?:boolean;dancing?:boolean;children?:ReactNode}){
  const board=game?boardFor(game):MULTI_COURSE_B18_BOARD
  const b18Coordinates=board.map(t=>({...t,x:90+(t.col-1)*152,y:390+(t.row-1)*210}))
  const [selected,setSelected]=useState<number|null>(null),current=b18Coordinates[position]
  return <div className="core-mvp-board">
    <svg viewBox="0 0 940 1672" role="group" aria-label="Bàn B18 · 18 ô theo thứ tự">
      <defs><radialGradient id="b18-grass"><stop stopColor="#e1efd6"/><stop offset="1" stopColor="#8ebf99"/></radialGradient></defs>
      <rect width="940" height="1672" fill="url(#b18-grass)"/>
      <rect x="170" y="490" width="600" height="660" rx="75" fill="#345a49" stroke="#5b8166" strokeWidth="12"/>
      <text x="470" y="630" textAnchor="middle" fill="#f5ead0" fontSize="38" fontWeight="800">XOAY VÒNG TIẾN LUI</text>
      <text x="470" y="700" textAnchor="middle" fill="#d8e8d5" fontSize="32">18 ô · 4 vòng · 90 triệu</text>
      <text x="470" y="790" textAnchor="middle" fill="#ffe6a3" fontSize="52" fontWeight="800">Vòng {lap} / {totalLaps}</text>
      <text x="470" y="860" textAnchor="middle" fill="#d8e8d5" fontSize="28">Phân bổ tài chính</text>
      <text x="470" y="905" textAnchor="middle" fill="#d8e8d5" fontSize="28">&amp; quản lý rủi ro</text>
      {b18Coordinates.map(t=><g key={t.index} transform={`translate(${t.x} ${t.y})`} role="button" tabIndex={0} data-b18-tile={t.index} aria-current={position===t.index?'step':undefined} aria-label={`Ô ${t.index+1}: ${tileDisplayLabel(t.label)}`} onClick={()=>setSelected(t.index)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(t.index)}}}>
        <rect x="-68" y="-75" width="136" height="160" rx="24" fill="#466450"/>
        <rect x="-68" y="-85" width="136" height="160" rx="24" fill={colors[t.type]} stroke={position===t.index?'#fff':'#45624e'} strokeWidth={position===t.index?10:3}/>
        <text y="-45" textAnchor="middle" fontSize="28" fill="#35483c" fontWeight="800">{String(t.index+1).padStart(2,'0')}</text>
        {labels[t.type].map((line,i)=><text key={line} y={i*35} textAnchor="middle" fill="#23392e" fontSize="28" fontWeight="800">{line}</text>)}
        {position===t.index&&<circle cx="49" cy="51" r="10" fill="#bb3e27"/>}
      </g>)}
    </svg>
    <Character3D x={current.x} y={current.y} currentTileIndex={position} tileCoordinates={b18Coordinates} isMoving={moving} isDancing={dancing}/>
    {children}
    <div className="b18-location">Ô {position+1} · {tileDisplayLabel(current.label)}</div>
    {selected!==null&&<Modal title={`Ô ${selected+1}: ${tileDisplayLabel(board[selected].label)}`} onClose={()=>setSelected(null)}><h2>{board[selected].type==='start'?'Ô Xuất phát':tileDisplayLabel(board[selected].label)}</h2><p><GlossaryText text={tileInformation(board[selected].type,game)} /></p><button className="button primary full-button" onClick={()=>setSelected(null)}>Trở về bàn</button></Modal>}
  </div>
}
