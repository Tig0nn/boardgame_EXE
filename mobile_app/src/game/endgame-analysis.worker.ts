import {createWorkerJob} from './endgame-analysis-worker-job.ts'
const scope=self as unknown as {onmessage:((event:MessageEvent<unknown>)=>void)|null;postMessage(value:unknown):void}
const job=createWorkerJob(value=>scope.postMessage(value))
scope.onmessage=event=>{void job.receive(event.data)}