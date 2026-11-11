import {GOLD_POLICY,GOLD_ENGINE_VERSION,GoldRejected} from './gold-historical-contract.ts'
import type {GoldCapture,GoldExecutor} from './gold-historical-worker-contract.ts'
export type GoldWorkerPort={postMessage(value:unknown):void;terminate():void;onmessage:((e:MessageEvent)=>void)|null;onerror:((e:ErrorEvent)=>void)|null;onmessageerror:((e:MessageEvent)=>void)|null}
/** Per-request native worker; deadline/abort/completion/error terminate and detach listeners. */
export function createGoldWorkerExecutor(factory:()=>GoldWorkerPort=()=>new Worker(new URL('./gold-historical.worker.ts',import.meta.url),{type:'module',name:'gold-historical-review'}),deadlineMs=25_000):GoldExecutor{
 if(!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>25_000)throw new GoldRejected('invalid-deadline')
 return(snapshot,sequence,signal,environment)=>new Promise<GoldCapture>((resolve,reject)=>{
  if(signal.aborted){reject(new GoldRejected('cancelled'));return}
  let worker:GoldWorkerPort;try{worker=factory()}catch{reject(new GoldRejected('worker-unavailable'));return}
  let done=false
  const finish=(value?:GoldCapture,reason='worker-failed')=>{if(done)return;done=true;clearTimeout(timeout);signal.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();if(value)resolve(value);else reject(new GoldRejected(reason))}
  const abort=()=>finish(undefined,'cancelled'),timeout=setTimeout(()=>finish(undefined,'execution-budget'),deadlineMs)
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return}
  worker.onmessage=e=>{const d=e.data as {ok?:boolean;value?:GoldCapture;reason?:string};if(d?.ok===true&&d.value?.context&&d.value.envelope?.context&&d.value.envelope.result)finish(d.value);else finish(undefined,typeof d?.reason==='string'&&d.reason.length<100?d.reason:'worker-response-invalid')}
  worker.onerror=()=>finish();worker.onmessageerror=()=>finish(undefined,'worker-response-invalid')
  try{worker.postMessage({snapshot,sequence,environment,policy:GOLD_POLICY,engine:GOLD_ENGINE_VERSION})}catch{finish(undefined,'capture-failed')}
 })
}
