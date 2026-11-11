/** Build availability only. The caller must also opt in explicitly. */
export const ENDGAME_ANALYSIS_DEV=import.meta.env?.DEV===true
export const ENDGAME_ANALYSIS_BETA=import.meta.env?.PROD===true&&import.meta.env?.VITE_ENDGAME_WHAT_IF_BETA==='1'
export const endgameAnalysisEnabled=(dev:boolean,explicitOptIn:boolean)=>(dev||ENDGAME_ANALYSIS_BETA)&&explicitOptIn