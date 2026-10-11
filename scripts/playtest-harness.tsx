// Development-only controlled states. Not an application entry point or production feature.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { advance, createGame, decide, fundPayment, roll, transact } from '../src/game/engine'
import { beginSettlement } from '../src/game/settlement'
import type { GameState } from '../src/game/types'
import { PhaseDialog } from '../src/components/GameDialogs'
import { Board } from '../src/components/Board'
import { Portfolio } from '../src/components/Portfolio'
import { exportLog } from '../src/exportLog'
import '../src/App.css'
import '../src/finance.css'

function fixture(id:string):GameState {
  let s=createGame(`V21-FIXTURE-${id}`,0,1,'experimental-b')
  if(id==='funding'||id==='withdrawal') {
    s={...s,position:2,phase:'event',eventId:'stocks'}
    s=transact(s,{kind:'buy',asset:'stocks',amount:4_000_000})
    if(id==='withdrawal') {
      s={...s,position:1,eventId:'bank'}
      s=transact(s,{kind:'deposit',amount:2_000_000,term:3})
    }
    return {...s,position:7,eventId:'medical',portfolio:{...s.portfolio,cash:3_000_000}}
  }
  if(id==='insolvent') return {...s,position:7,phase:'event',eventId:'medical',borrowingLimit:0,portfolio:{...s.portfolio,cash:0}}
  if(id==='start-business'||id==='locked-final') {
    s={...s,position:13,phase:'event',eventId:'business',turn:2}
    s=transact(s,{kind:'buy',asset:'business',amount:20_000_000})
    return id==='start-business'?{...s,position:0,phase:'rebalancing',turn:3}:
      {...s,position:0,phase:'finished',lap:4,termination:'completed',portfolio:{...s.portfolio,cash:89_000_000}}
  }
  if(id==='victory'||id==='defeat') return {...s,phase:'finished',lap:4,termination:'completed',portfolio:{...s.portfolio,cash:id==='victory'?90_000_000:89_999_999}}
  if(id==='lap4') {
    s={...s,lap:3,phase:'event',position:1,eventId:'bank'}
    s=transact(s,{kind:'deposit',amount:5_000_000,term:2})
    return beginSettlement({...s,lap:4,position:0,phase:'rolling',recurringIncome:17_000_000,coursePurchased:true})
  }
  throw Error('Unknown fixture')
}
export default function Harness() {
  const [id,setId]=useState('funding')
  const [game,setGame]=useState<GameState|null>(null)
  return <><header className="app-header"><strong>V2.1 · FIXTURE TỔNG HỢP, KHÔNG PHẢI VÁN TỰ NHIÊN</strong><select aria-label="Fixture" value={id} onChange={event=>setId(event.target.value)}>{['funding','withdrawal','insolvent','start-business','locked-final','victory','defeat','lap4'].map(name=><option key={name}>{name}</option>)}</select><button onClick={()=>setGame(fixture(id))}>Nạp fixture</button></header>
    {game&&<main className="game-page"><p>Seed {game.seed} · {game.gameMode} · {game.boardLayout} · {game.totalLaps} vòng</p><div className="game-layout"><Board game={game} onRoll={()=>setGame(roll(game))} rolling={false}/><Portfolio game={game}/></div><PhaseDialog game={game} onAdvance={()=>setGame(advance(game))} onChoose={option=>setGame(decide(game,option))} onFund={(source,amount,lot)=>setGame(fundPayment(game,source,amount,lot))} onTransaction={action=>setGame(transact(game,action))} onRestart={()=>setGame(null)} onExport={()=>exportLog(game)}/></main>}</>
}
if(import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Harness/> )
