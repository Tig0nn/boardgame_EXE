import type {GameState} from '../../../src/game/types.ts'
import {normalizeDraftInput} from '../../../src/ai/companion/draft-index.ts'
import type {DraftInput} from '../../../src/ai/companion/draft-index.ts'
export interface DraftFrame {owner:string;basis:GameState;input:DraftInput;revision:number}
export function createDraftStore(){
 let frame:DraftFrame|null=null,revision=0
 const listeners=new Set<()=>void>(),notify=()=>[...listeners].forEach(fn=>fn())
 return {
  getSnapshot:()=>frame,
  subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn)}},
  publish(owner:string,basis:GameState,input:DraftInput){frame=Object.freeze({owner,basis,input:Object.freeze(normalizeDraftInput(input)),revision:++revision});notify()},
  clear(owner?:string){if(frame&&(owner===undefined||owner===frame.owner)){frame=null;revision++;notify()}},
 }
}
export type DraftStore=ReturnType<typeof createDraftStore>
