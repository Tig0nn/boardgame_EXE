import assert from 'node:assert/strict'

// Inject observation into the direct Gold C1 process only. No runtime source or clock is changed.
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context)
  const file = url.split('/').at(-1)
  if (!['endgame-whatif-contract.ts', 'endgame-whatif-gold-resume.ts', 'endgame-whatif-gold-c1.test.ts', 'endgame-whatif-paired.ts'].includes(file)) return result
  let source = Buffer.from(result.source).toString()
  const replace = (anchor, patch) => {
    assert(source.includes(anchor), `Trace anchor missing in ${file}: ${anchor}`)
    source = source.replace(anchor, patch)
  }
  if (file === 'endgame-whatif-contract.ts') {
    replace("if (Date.now() > this.deadline) throw new EndgameRejected('time-budget', 'limited')",
      "if (Date.now() > this.deadline) { this.eg3Trace?.('budget-exhausted'); throw new EndgameRejected('time-budget', 'limited') }")
    replace("if (++this.steps > this.maxSteps) throw new EndgameRejected('step-budget', 'limited')",
      "if (++this.steps > this.maxSteps) { this.eg3Trace?.('budget-exhausted'); throw new EndgameRejected('step-budget', 'limited') }")
  }
  if (file === 'endgame-whatif-gold-resume.ts') {
    const start = ' const inputCurrent=captureDataIntegrity({request,transcript})'
    replace(start, ` const traceEnabled = globalThis.eg3GoldC1Trace === true
 const stages = []
 const operation = submission ? 'resume' : 'create'
 let stage = 'setup', startWall = performance.now(), startCpu = process.cpuUsage()
 const mark = next => {
   if (!traceEnabled) return
   const cpu = process.cpuUsage(startCpu)
   const now = performance.now()
   stages.push({ stage, wallMs: Math.round(now - startWall), cpuMs: Math.round((cpu.user + cpu.system) / 1000),
     remainingMs: work.deadline - Date.now(), steps: work.steps, remainingSteps: work.maxSteps - work.steps })
   stage = next
   startWall = now
   startCpu = process.cpuUsage()
 }
 if (traceEnabled) {
   work.eg3Trace = mark
   work.eg3Witness = { calls: 0, wallMs: 0, cpuMs: 0 }
 }
 try {
${start}`)
    replace(' const expected=await ', " mark('identify'); const expected=await ")
    const parseAgain = ' const source=goldSource(request)'
    if (source.includes(parseAgain)) replace(parseAgain, " mark('duplicate-parse');" + parseAgain)
    replace(' let verified:Awaited', " mark('actual-replay'); let verified:Awaited")
    replace(' const fork=forkGold', " mark('paired-replay'); const fork=forkGold")
    replace(' const exportText=serializeLog', " mark('independent-verification'); const exportText=serializeLog")
    replace(' const alternativeExportHash=await', " mark('final-proof'); const alternativeExportHash=await")
    replace('\n}\n/** Isolated', `
 } catch (error) {
   if (traceEnabled) console.log('EG3-GOLD-ERROR', JSON.stringify({ operation, reason: error.message }))
   throw error
 } finally {
   if (traceEnabled) {
     mark('returned')
     console.log('EG3-GOLD-STAGES', JSON.stringify({ operation, stages, rejectionWitness: work.eg3Witness }))
   }
 }
}
/** Isolated`)
  }
  if (file === 'endgame-whatif-paired.ts') {
    if (process.env.EG3_GOLD_TRIAL_ORDERED_WITNESS === '1' && source.includes('const original = canonical(b)')) {
      replace('const original = canonical(b)', 'const original = JSON.stringify(b)')
      replace('canonical(b) === original', 'equalData(JSON.parse(original), b)')
    }
    const witness = /  const original = (?:canonical|JSON\.stringify)\(b\)/.exec(source)?.[0]
    assert(witness)
    replace(witness, `  const witnessWall = work.eg3Witness && performance.now()
  const witnessCpu = work.eg3Witness && process.cpuUsage()
${witness}
  if (work.eg3Witness) {
    const cpu = process.cpuUsage(witnessCpu)
    work.eg3Witness.calls++
    work.eg3Witness.wallMs += performance.now() - witnessWall
    work.eg3Witness.cpuMs += (cpu.user + cpu.system) / 1000
  }`)
  }
  if (file === 'endgame-whatif-gold-c1.test.ts') {
    const testName = "test('public pending rejects invalid inputs, preserves head, then valid retry commits once',async()=>{"
    replace(testName, testName + `
 globalThis.eg3GoldC1Trace = true
 try {
 const begin = performance.now()`)
    const create = ' const handle=await createGoldContinuation(await prepareGoldRequest(source(),4)),pending=handle.result'
    const offset = source.indexOf(testName)
    const prefix = source.slice(0, offset)
    source = source.slice(offset)
    replace(create, ` const request = await prepareGoldRequest(source(),4)
 console.log('EG3-GOLD-PREPARE', Math.round(performance.now() - begin))
 const handle = await createGoldContinuation(request), pending = handle.result`)
    replace(' const final=await handle.resume(input);',
      " console.log('EG3-GOLD-PRE-RESUME', Math.round(performance.now() - begin)); const final=await handle.resume(input);console.log('EG3-GOLD-RESULT', JSON.stringify({ status: final.status, reason: final.reason }));")
    replace("\n})\n\ntest('genuine concurrent", "\n } finally { globalThis.eg3GoldC1Trace = false }\n})\n\ntest('genuine concurrent")
    source = prefix + source
  }
  return { ...result, source }
}
