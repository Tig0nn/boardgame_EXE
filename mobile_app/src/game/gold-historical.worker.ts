import {runGoldCapture,goldWorkerReason} from './gold-historical-worker-job.ts'
import type {GoldWorkerInput} from './gold-historical-worker-contract.ts'
const scope=self as unknown as {onmessage:((e:MessageEvent<GoldWorkerInput>)=>void)|null;postMessage(value:unknown):void}
scope.onmessage=({data})=>{void runGoldCapture(data).then(value=>scope.postMessage({ok:true,value}),error=>scope.postMessage({ok:false,reason:goldWorkerReason(error)}))}
