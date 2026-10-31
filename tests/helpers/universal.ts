import {createMultiCourseGame} from '../../src/game/new-game.ts'
import {advance,roll,decide} from '../../src/game/engine.ts'
import {eventsForGame} from '../../src/data/events.ts'
export function encounter(id: string) {
  for (let seed=0; seed<100; seed++) {
    let s=advance(createMultiCourseGame(`universal-${seed}`,0))
    for(let i=0;i<200 && s.phase!=='finished';i++) {
      if(s.phase==='event' && s.eventId===id)return s
      if(s.phase==='funding')break
      if(s.phase==='rolling')s=roll(s)
      else if(s.phase==='event') {const e=eventsForGame(s).find(e=>e.id===s.eventId)!;s=decide(s,e.options.find(o=>['skip','acknowledge','full','pay'].includes(o.id))?.id??e.options[0].id)}
      else s=advance(s)
    }
  }
  throw Error(`Missing natural encounter ${id}`)
}

export function phaseState(phase:string) {
 for(let seed=0;seed<100;seed++) {
  let s=createMultiCourseGame(`universal-phase-${seed}`,phase.startsWith('funding')?49_000_000:0,3)
  for(let step=0;step<250&&s.phase!=='finished';step++) {
   if(s.phase===phase||phase==='funding-settlement'&&s.phase==='funding'&&s.pendingPayment?.origin==='settlement')return s
   if(s.phase==='funding')break
   if(s.phase==='rolling')s=roll(s)
   else if(s.phase==='event'){const e=eventsForGame(s).find(e=>e.id===s.eventId)!;s=decide(s,e.options.find(o=>['skip','acknowledge','full','pay'].includes(o.id))?.id??e.options[0].id)}
   else s=advance(s)
  }
 }
 throw Error(`No natural phase ${phase}`)
}