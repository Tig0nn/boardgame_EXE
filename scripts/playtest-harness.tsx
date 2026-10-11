// Development-only controlled states. Not an application entry point or production feature.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { advance, createGame, decide, fundPayment, roll, transact } from '../src/game/engine'
import { applyMacroShock } from '../src/game/market'
import { MACRO_EVENTS } from '../src/data/config'
import { beginSettlement } from '../src/game/settlement'
import type { GameState } from '../src/game/types'
import { PhaseDialog } from '../src/components/GameDialogs'
import { GameStatus } from '../src/components/GameStatus'
import { Board } from '../src/components/Board'
import { Portfolio } from '../src/components/Portfolio'
import { exportLog } from '../src/exportLog'
import '../src/index.css'
import '../src/App.css'
import '../src/finance.css'
import '../src/mobile.css'

function fixture(id:string):GameState {
  let s=createGame(`V21-FIXTURE-${id}`,0,1,'experimental-b')
  if (['bank', 'bank-later', 'stocks', 'bonds', 'gold', 'business', 'business-upgrade'].includes(id)) {
    const eventId = id === 'business-upgrade' ? 'business' : id === 'bank-later' ? 'bank' : id
    const position = ({ bank: 1, stocks: 2, bonds: 6, gold: 9, business: 8 } as Record<string, number>)[eventId]
    s = { ...s, phase: 'event', eventId, position, turn: 2 }
    if (id === 'business-upgrade') {
      s = transact(s, { kind: 'buy', asset: 'business', amount: 20_000_000 })
      s = { ...s, turn: 3 }
    }
    if (id === 'bank-later') {
      s = transact(s, { kind: 'deposit', amount: 1_000_000, term: 1 })
      s = { ...s, phase: 'event', eventId: 'bank', turn: 3, lap: 2 }
    }
    return s
  }
  if (id === 'start-sales') {
    for (const asset of ['stocks', 'bonds', 'gold'] as const) {
      s = transact({ ...s, phase: 'event', eventId: asset, position: { stocks: 2, bonds: 6, gold: 9 }[asset] }, { kind: 'buy', asset, amount: 2_000_000 })
    }
    return { ...s, phase: 'rebalancing', position: 0, portfolio: { ...s.portfolio, debt: 1_000_000 } }
  }
  if (['course', 'course-owned', 'course-poor', 'living', 'repair', 'family', 'bills', 'contract', 'bonus'].includes(id)) return { ...s, phase: 'event', eventId: id.startsWith('course') ? 'course' : id, position: id.startsWith('course') ? 4 : 3, turn: 2, coursePurchased: id === 'course-owned', portfolio: { ...s.portfolio, cash: id === 'course-poor' ? 1_000_000 : 50_000_000 } }
  if (id === 'macro') return applyMacroShock({ ...s, phase: 'event', eventId: MACRO_EVENTS[0].id, position: 5, turn: 2 }, MACRO_EVENTS[0].id)
  if(id==='funding'||id==='withdrawal') {
    s={...s,position:2,phase:'event',eventId:'stocks'}
    s=transact(s,{kind:'buy',asset:'stocks',amount:4_000_000})
    if(id==='withdrawal') {
      s={...s,position:1,eventId:'bank'}
      s=transact(s,{kind:'deposit',amount:2_000_000,term:3})
    }
    return {...s,phase:'event',position:7,eventId:'medical',portfolio:{...s.portfolio,cash:3_000_000}}
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
  return <><header className="app-header fixture-header"><strong>FIXTURE TỔNG HỢP, KHÔNG PHẢI VÁN TỰ NHIÊN</strong><select aria-label="Fixture" value={id} onChange={event=>setId(event.target.value)}>{['funding','withdrawal','insolvent','start-business','locked-final','victory','defeat','lap4','bank','bank-later','stocks','bonds','gold','business','business-upgrade','start-sales','course','course-owned','course-poor','living','repair','family','bills','contract','bonus','macro'].map(name=><option key={name}>{name}</option>)}</select><button onClick={()=>setGame(fixture(id))}>Nạp fixture</button></header>
    {game&&<main className="game-page"><p>Seed {game.seed} · {game.gameMode} · {game.boardLayout} · {game.totalLaps} vòng</p><GameStatus game={game}/><div className="game-layout"><Board game={game} onRoll={()=>setGame(state=>state===game?roll(state):state)} rolling={false}/><Portfolio game={game}/></div><PhaseDialog game={game} onAdvance={()=>setGame(state=>state===game?advance(state):state)} onChoose={option=>setGame(state=>state===game?decide(state,option):state)} onFund={(source,amount,lot)=>setGame(state=>state===game?fundPayment(state,source,amount,lot):state)} onTransaction={action=>setGame(state=>state===game?transact(state,action):state)} onRestart={()=>setGame(null)} onExport={()=>exportLog(game)}/></main>}</>
}
if(import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Harness/> )
