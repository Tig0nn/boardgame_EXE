import { SLOT_IDS } from './contracts.ts'
import type { OfflineProvider } from './claims.ts'
/** Pure offline fixture: selects reviewed IDs after one event-loop turn. No game outcomes or network. */
export const offlineMock:OfflineProvider=(_input,signal)=>new Promise((resolve,reject)=>{
 const cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(new Error('offline-cancelled'))}
 const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve({summary:SLOT_IDS.summary[1],interpretation:SLOT_IDS.interpretation[1],tradeoff:SLOT_IDS.tradeoff[1],takeaway:SLOT_IDS.takeaway[1]})},0)
 signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel()
})
