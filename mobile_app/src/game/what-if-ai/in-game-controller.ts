import { money, signedMoney } from '../../../../src/game/format.ts'
import { explanationReply, intentReply, proposalReply, WhatIfApiError } from '../../../../src/ai/what-if/contracts.ts'
import type { EndgameAppBinding } from '../endgame-analysis-app-binding.ts'
import { validateResponse } from '../endgame-analysis-protocol.ts'
import type { FinalCore, Response } from '../endgame-analysis-protocol.ts'
import type { GoldSelection, GoldResumeInput } from '../endgame-whatif-gold-contract.ts'
import { captureDataIntegrity } from '../endgame-whatif-integrity.ts'
import { digest, equalData } from '../endgame-whatif-identity.ts'
import { createDecisionClient } from './decision-client.ts'
import type { DecisionResult } from './decision.worker.ts'
import type { ReplayComparison } from './decision-replay.ts'
import type { CatalogPage, CatalogQuery, HistoricalDecision, DecisionControls } from './flexible-catalog.ts'
import type { DecisionParameters, WhatIfDecision, WhatIfProvider } from './orchestrator.ts'
import { alternativeLabel } from './orchestrator.ts'
import { decisionQuestion, historyLocator, intentAlternativeId, intentParameters, matchingHistory, requiredParameters } from './natural-language.ts'
import type { HistoryLocator, NaturalIntent } from './natural-language.ts'
import { blockedExplanation, groundedExplanation, verifiedSalaryChanges } from './grounded-explanation.ts'

type Kind = WhatIfDecision['kind']
type Stage = 'closed' | 'preparing' | 'question' | 'proposing' | 'proposal' | 'running' | 'followup' | 'final' | 'blocked'
type Row = { label: string; actual: string; alternative: string; delta: string }
export type InGameAiView = { stage: Stage; kind: Kind; catalog: WhatIfDecision[]; notice?: string;
  proposal?: WhatIfDecision; followUp?: string; rows?: Row[]; explanation?: string; explanationSource?: 'engine' | 'gemini-claim';
  history?: HistoricalDecision[]; historyOffset?: number; historyTotal?: number; historyNext?: number | null;
  selectedSequence?: number; controls?: DecisionControls; alternativesNext?: number | null; alternativesOffset?: number;
  natural?: NaturalIntent; missing?: string[]; original?: string; alternative?: string; confirmedFollowUps?: string[]; followUpDetail?: string;
  salaryChanges?: string[]; filteredHistory?: boolean; providerFailed?: boolean }
type ProviderRequest = { abort: AbortController; previous: InGameAiView }
type Active = { abort: AbortController; provider: WhatIfProvider; stamp?: string; sourceHash?: string; text?: string;
  session: string; request?: ProviderRequest; locator?: HistoryLocator;
  gold: GoldSelection[]; client?: ReturnType<typeof createDecisionClient>; goldPending?: GoldResumeInput;
  followUpId?: string; engineBusy: boolean; intent?: NaturalIntent; original?: string; selection?: WhatIfDecision;
  confirmed: string[]; pendingDetail?: string }
const metricKeys = [['cash', 'Tiền mặt'], ['totalWorth', 'Tổng tài sản ròng'], ['liquidatableFunds', 'Tiền có thể thu về']] as const
const eventNames: Record<string, string> = { course: 'Khóa học', stocks: 'Cổ phiếu', bonds: 'Trái phiếu', business: 'Kinh doanh',
  gold: 'Vàng', bank: 'Ngân hàng', checkpoint: 'Ô Xuất phát' }
const stamp = (binding: EndgameAppBinding) => {
  const s = binding.inspect()
  return JSON.stringify([s.controllerIncarnation, s.sessionIncarnation, s.sessionEpoch, s.captureId, s.captureRevision, s.terminal])
}
const sessionStamp = (binding: EndgameAppBinding) => {
  const s = binding.inspect()
  return JSON.stringify([s.controllerIncarnation, s.sessionIncarnation, s.sessionEpoch, s.terminalAt, s.terminal])
}

/** Owns one App capture, its provider requests and native branches. Public views contain only detached UI facts. */
export function createInGameAiController(binding: EndgameAppBinding, provider: () => WhatIfProvider, geminiExplanation = false) {
  let active: Active | undefined
  let view: InGameAiView = { stage: 'closed', kind: 'gold', catalog: [] }
  let viewCurrent = captureDataIntegrity(view)
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(listener => listener())
  function publish(next: InGameAiView) { view = structuredClone(next); viewCurrent = captureDataIntegrity(view); notify() }
  function release() {
    const old = active
    active = undefined
    old?.abort.abort()
    old?.client?.dispose()
    if (old) binding.cancel()
  }
  function close(deferred = false) {
    release()
    view = { stage: 'closed', kind: 'gold', catalog: [] }
    viewCurrent = captureDataIntegrity(view)
    if (deferred) queueMicrotask(notify)
    else notify()
  }
  function sameSession(owner: Active) {
    return active === owner && !owner.abort.signal.aborted && owner.session === sessionStamp(binding)
  }
  function valid(owner: Active) {
    if (!sameSession(owner) || owner.stamp !== stamp(binding)) return false
    return owner.engineBusy || !!binding.read()
  }
  function check(owner: Active) {
    if (!valid(owner)) throw new DOMException('Capture expired', 'AbortError')
  }
  function blocked(owner: Active, notice: string) {
    if (active !== owner) return
    if (!sameSession(owner)) { close(); return }
    owner.client?.dispose()
    owner.client = undefined
    owner.text = undefined
    binding.cancel()
    publish({ stage: 'blocked', kind: view.kind, catalog: [], notice, original: owner.original,
      alternative: owner.selection ? alternativeLabel(owner.selection) : undefined, confirmedFollowUps: owner.confirmed })
  }
  function failure(owner: Active, error?: unknown) {
    const reason = error instanceof DOMException && error.message === 'decision-worker-timeout' ? error.message : binding.inspect().reason
    blocked(owner, blockedExplanation(reason ?? ''))
  }
  function beginProvider(owner: Active): ProviderRequest {
    const request = { abort: new AbortController(), previous: view }
    owner.request = request
    publish({ ...view, stage: 'proposing', notice: undefined, proposal: undefined, providerFailed: undefined })
    return request
  }
  function completeProvider(owner: Active, request: ProviderRequest) {
    if (active !== owner || owner.request !== request) return false
    owner.request = undefined
    if (!valid(owner)) { close(); return false }
    return true
  }
  function providerFailure(owner: Active, request: ProviderRequest, error: unknown) {
    if (!completeProvider(owner, request)) return
    const code = error instanceof WhatIfApiError ? error.code : null
    const notice = code === 'PROVIDER_TIMEOUT' ? 'AI chưa phản hồi kịp. Bạn có thể gửi lại câu hỏi hoặc chọn phương án thủ công.'
      : code === 'RATE_LIMITED' ? 'Đã chạm giới hạn yêu cầu AI. Bạn có thể chọn phương án thủ công ngay hoặc thử hỏi lại sau.'
        : code === 'INVALID_REQUEST' ? 'Hãy nhập câu hỏi ngắn, chỉ gồm thông tin về quyết định và số tiền trong ván.'
        : 'Chưa thể xác minh phản hồi AI. Bạn có thể gửi lại hoặc chọn phương án thủ công.'
    publish({ ...request.previous, notice, providerFailed: true })
  }
  async function catalog(owner: Active, kind: Kind, locator: HistoryLocator = {}) {
    if (kind === 'gold') {
      const choices = owner.gold.map(({ decision }) => ({ kind, decisionId: `gold:${decision.sequence}`, alternativeId: 'skip',
        lap: decision.lap, turn: decision.turn } satisfies WhatIfDecision))
      const history = matchingHistory(locator, choices.map(choice => ({ sequence: Number(choice.decisionId.split(':')[1]),
        lap: choice.lap, turn: choice.turn, action: 'buy-gold', description: `Mua vàng · ${money(owner.gold.find(g => g.decision.sequence === Number(choice.decisionId.split(':')[1]))!.decision.action!.amount)}` })))
      return { catalog: choices.filter(choice => history.some(row => choice.decisionId === `gold:${row.sequence}`)), history,
        historyOffset: 0, historyTotal: history.length, historyNext: null }
    }
    owner.text ??= binding.replayText() ?? undefined
    if (!owner.text || await digest(owner.text) !== owner.sourceHash) throw new Error('Source unavailable')
    check(owner)
    owner.client?.dispose()
    owner.client = createDecisionClient(owner.abort.signal)
    const result = await owner.client.request({ kind: 'catalog', text: owner.text, scenario: kind, query: { mode: 'history', offset: 0, locator } })
    check(owner)
    if (result.status !== 'catalog-page') throw new Error('Catalog unavailable')
    return historyPage(result.page)
  }
  function historyPage(page: CatalogPage) {
    return { catalog: [], history: page.history, historyOffset: page.offset, historyTotal: page.total, historyNext: page.nextOffset }
  }
  async function loadPage(owner: Active, query: CatalogQuery) {
    const previous = view
    const kind = previous.kind
    if (kind === 'gold' || !owner.client) return
    publish({ ...previous, stage: 'preparing', catalog: [], proposal: undefined, rows: undefined, notice: undefined })
    try {
      check(owner)
      const result = await owner.client.request({ kind: 'catalog', scenario: kind, query })
      check(owner)
      if (result.status === 'blocked' || result.status === 'cancelled') { blocked(owner, blockedExplanation(result.reason)); return }
      if (result.status !== 'catalog-page') throw new Error('Catalog unavailable')
      if (query.mode === 'history') publish({ stage: 'question', kind: previous.kind, ...historyPage(result.page), natural: owner.intent,
        filteredHistory: previous.filteredHistory })
      else publish({ ...previous, stage: 'question', catalog: result.page.decisions, selectedSequence: query.sequence,
        natural: owner.intent, missing: undefined,
        controls: result.page.controls, alternativesNext: result.page.nextOffset, alternativesOffset: result.page.offset,
        notice: result.page.decisions.length ? undefined : query.parameters ? 'Phương án này chưa qua kiểm tra hợp lệ. Hãy đổi tham số.'
          : 'Chọn tham số và xác minh để xem phương án hợp lệ.' })
    } catch (error) { failure(owner, error) }
  }
  async function resolveNatural(owner: Active, alreadyProbed = false) {
    if (!valid(owner) || view.stage !== 'question' || !owner.intent || !view.selectedSequence) return
    const intent = owner.intent, missing = requiredParameters(intent)
    if (missing.length) {
      const catalog = intent.action === 'upgrade' ? view.catalog.filter(choice => choice.alternativeId.startsWith('upgrade-business:')) : []
      publish({ ...view, catalog, natural: intent, missing, notice: 'Hãy bổ sung các tham số còn thiếu bên dưới; hệ thống sẽ kiểm tra bằng engine.' })
      return
    }
    const parameters = intentParameters(intent)
    if (parameters && !alreadyProbed) {
      await loadPage(owner, { mode: 'alternatives', sequence: view.selectedSequence, offset: 0, parameters })
      if (!valid(owner)) return
    }
    if (view.stage !== 'question') return
    const wanted = intentAlternativeId(intent), choice = view.catalog.find(candidate => candidate.alternativeId === wanted)
    if (!choice) { publish({ ...view, missing: [], notice: 'Phương án được hỏi không hợp lệ tại quyết định này. Hãy đổi tham số hoặc chọn quyết định khác.' }); return }
    await controller.propose(decisionQuestion(choice), choice)
  }
  function finish(owner: Active, facts: Pick<ReplayComparison, 'actual' | 'alternative' | 'delta'>) {
    check(owner)
    const rows = metricKeys.map(([key, label]) => ({ label, actual: money(facts.actual[key]),
      alternative: money(facts.alternative[key]), delta: signedMoney(facts.delta[key]) }))
    owner.client?.dispose()
    owner.client = undefined
    publish({ stage: 'final', kind: view.kind, catalog: [], rows, original: owner.original,
      alternative: owner.selection ? alternativeLabel(owner.selection) : undefined, confirmedFollowUps: owner.confirmed,
      salaryChanges: verifiedSalaryChanges(facts.actual.salaryAtStarts, facts.alternative.salaryAtStarts),
      explanation: groundedExplanation(facts.delta), explanationSource: 'engine' })
    if (geminiExplanation) void verifyExplanation(owner, view, facts.delta.cash)
  }
  async function verifyExplanation(owner: Active, result: InGameAiView, cashDelta: number) {
    const direction = cashDelta > 0 ? 'up' : cashDelta < 0 ? 'down' : 'unchanged'
    const facts = { kind: result.kind, direction, confirmedFollowUp: owner.confirmed.length > 0 } as const
    try {
      if (!valid(owner) || view !== result || result.stage !== 'final') return
      const signal = AbortSignal.any([owner.abort.signal, AbortSignal.timeout(7000)])
      explanationReply(await owner.provider.explain(facts, signal), facts)
      if (!signal.aborted && valid(owner) && view === result) publish({ ...result, explanationSource: 'gemini-claim' })
    } catch {
      // The result already includes the engine explanation. A provider failure cannot change it.
    }
  }
  async function acceptGold(owner: Active, response: Response | null) {
    if (!sameSession(owner)) return
    if (!response) throw new Error('No result')
    validateResponse(response)
    if (['BLOCKED', 'ERROR', 'LIMITED', 'CANCELLED'].includes(response.kind)) {
      blocked(owner, blockedExplanation(String(response.body.reason ?? '')))
      return
    }
    check(owner)
    const current = binding.read()
    if (!current || !equalData(current, response)) throw new Error('Result replaced')
    if (response.kind === 'NEEDS_FOLLOWUP') {
      const pending = response.body as unknown as Omit<GoldResumeInput, 'choice'>
      const choice = pending.blocker.choices[0]?.action
      if (!choice) throw new Error('Unsupported follow-up')
      owner.goldPending = { continuation: pending.continuation, blocker: pending.blocker, choice }
      owner.pendingDetail = `Quyết định ${pending.blocker.command.sequence} · Vòng ${pending.blocker.command.lap}, lượt ${pending.blocker.command.turn}: bỏ qua lần bán vàng sau đó`
      publish({ stage: 'followup', kind: 'gold', catalog: [], followUp: 'Bỏ qua lần bán vàng sau đó', followUpDetail: owner.pendingDetail,
        original: owner.original, confirmedFollowUps: owner.confirmed })
    } else if (response.kind === 'SUPPORTED_FINAL') {
      const final = response.body as FinalCore
      owner.goldPending = undefined
      finish(owner, final)
    } else throw new Error('Unexpected Gold response')
  }
  async function acceptDecision(owner: Active, result: DecisionResult) {
    check(owner)
    if (result.status === 'needs-followup') {
      owner.followUpId = result.followUp.id
      owner.pendingDetail = `Quyết định ${result.followUp.sequence} · ${eventNames[result.followUp.event] ?? 'Giao dịch sau'}: ${result.followUp.options[0]?.label}`
      publish({ stage: 'followup', kind: view.kind, catalog: [], followUp: result.followUp.options[0]?.label,
        followUpDetail: owner.pendingDetail, original: owner.original, confirmedFollowUps: owner.confirmed })
    } else if (result.status === 'supported-final') {
      // Generic metrics have the same monetary fields used by the existing comparison projection.
      finish(owner, result.comparison)
    } else blocked(owner, blockedExplanation('reason' in result ? result.reason : ''))
  }
  const controller = {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot() {
      if (!viewCurrent() || active && (!sameSession(active) || (view.stage !== 'blocked' && active.stamp && !valid(active)))) close(true)
      return view
    },
    watch: () => close(),
    close,
    async open(kind: Kind = 'gold') {
      if (active || !binding.inspect().terminal) return
      const owner: Active = { abort: new AbortController(), provider: provider(), session: sessionStamp(binding), gold: [], engineBusy: true, confirmed: [] }
      active = owner
      publish({ stage: 'preparing', kind, catalog: [] })
      try {
        const source = await binding.prepare()
        if (active !== owner) return
        if (source?.kind !== 'SOURCE_VERIFIED') throw new Error('Source unavailable')
        validateResponse(source)
        owner.sourceHash = (source.body.identity as { sourceHash: string }).sourceHash
        owner.stamp = stamp(binding)
        const listed = await binding.list()
        owner.engineBusy = false
        check(owner)
        if (listed?.kind !== 'DECISIONS_READY') throw new Error('Catalog unavailable')
        validateResponse(listed)
        owner.gold = listed.body.decisions as GoldSelection[]
        const page = await catalog(owner, kind)
        check(owner)
        publish({ stage: 'question', kind, ...page })
      } catch (error) { owner.engineBusy = false; failure(owner, error) }
    },
    async selectKind(kind: Kind) {
      const owner = active
      if (!owner || view.stage !== 'question') return
      owner.intent = undefined
      owner.locator = undefined
      publish({ stage: 'preparing', kind, catalog: [] })
      try {
        check(owner)
        owner.client?.dispose()
        owner.client = undefined
        const page = await catalog(owner, kind)
        check(owner)
        publish({ stage: 'question', kind, ...page })
      } catch (error) { failure(owner, error) }
    },
    async ask(question: string) {
      const owner = active
      if (!owner || view.stage !== 'question') return
      const request = beginProvider(owner)
      const previous = request.previous
      let reply
      try {
        check(owner)
        if (!owner.provider.interpret) throw new WhatIfApiError('PROVIDER_UNAVAILABLE')
        const normalizedQuestion = question.trim().replace(/\s+/g, ' ')
        reply = intentReply(await owner.provider.interpret({ question: normalizedQuestion }, AbortSignal.any([owner.abort.signal, request.abort.signal])), normalizedQuestion)
      } catch (error) { providerFailure(owner, request, error); return }
      if (!completeProvider(owner, request)) return
      try {
        if (reply.status !== 'intent') {
          publish({ ...previous, providerFailed: undefined,
            notice: reply.status === 'multiple-changes' ? 'Câu hỏi có nhiều thay đổi. Hãy tách thành một thay đổi cho mỗi lần mô phỏng.'
            : reply.status === 'ambiguous' ? 'Hãy nêu rõ nhóm, hành động và một phương án duy nhất, ví dụ mua cổ phiếu hoặc gửi tiết kiệm.'
              : 'Câu hỏi này chưa được hỗ trợ. Hãy chọn một hành động B18; kỳ hạn ngân hàng dùng START, không đổi từ tháng hoặc ngày.' })
          return
        }
        owner.intent = reply.intent
        owner.locator = historyLocator(reply.intent)
        publish({ stage: 'preparing', kind: reply.intent.kind, catalog: [], natural: reply.intent })
        const page = await catalog(owner, reply.intent.kind, owner.locator)
        check(owner)
        publish({ stage: 'question', kind: reply.intent.kind, ...page, natural: reply.intent, filteredHistory: Object.keys(owner.locator).length > 0,
          notice: page.historyTotal === 0 ? 'Không có quyết định lịch sử khớp câu hỏi. Hãy đổi vòng, lượt hoặc số quyết định.'
            : page.historyTotal > 1 ? 'Có nhiều quyết định phù hợp. Hãy chọn đúng lần bạn muốn thay đổi.' : undefined })
        if (page.historyTotal === 1) await controller.selectHistory(page.history[0].sequence)
      } catch (error) { failure(owner, error) }
    },
    async propose(question: string, expected?: WhatIfDecision) {
      const owner = active, previous = view
      if (!owner || view.stage !== 'question' || !view.catalog.length || !view.selectedSequence) return
      const request = beginProvider(owner)
      try {
        check(owner)
        const catalog = expected ? previous.catalog.filter(choice => equalData(choice, expected)) : previous.catalog
        if (!catalog.length) throw new WhatIfApiError('OUTPUT_REJECTED')
        const reply = proposalReply(await owner.provider.propose({ question: question.trim(), catalog: structuredClone(catalog) }, AbortSignal.any([owner.abort.signal, request.abort.signal])), catalog)
        if (!completeProvider(owner, request)) return
        if (reply.status !== 'proposal') {
          publish({ ...previous, notice: reply.status === 'ambiguous' ? 'Câu hỏi còn mơ hồ. Hãy chọn rõ quyết định và các tham số rồi xác minh lại.' : 'Câu hỏi chưa khớp lựa chọn được hỗ trợ.' })
          return
        }
        const proposal = catalog.find(choice => choice.decisionId === reply.decisionId && choice.alternativeId === reply.alternativeId)!
        publish({ ...previous, stage: 'proposal', proposal, providerFailed: undefined })
      } catch (error) { providerFailure(owner, request, error) }
    },
    cancelProvider() {
      const owner = active
      const request = owner?.request
      if (!owner || !request) return
      owner.request = undefined
      request.abort.abort()
      if (!valid(owner)) { close(); return }
      publish({ ...request.previous, notice: 'Đã hủy yêu cầu. Bạn có thể sửa câu hỏi hoặc chọn phương án thủ công.' })
    },
    editQuestion() {
      if (active?.request) controller.cancelProvider()
      const owner = active
      if (!owner || !['proposal', 'question'].includes(view.stage)) return
      const previous = view
      if (owner.intent) {
        owner.intent = undefined
        publish({ ...previous, stage: 'question', natural: undefined, missing: undefined, proposal: undefined, catalog: [],
          providerFailed: undefined, notice: 'Hãy phân tích câu hỏi mới hoặc mở toàn bộ lịch sử để chọn thủ công.' })
      } else if (view.stage === 'proposal' || view.notice) {
        publish({ ...previous, stage: 'question', proposal: undefined, notice: undefined, providerFailed: undefined })
      }
    },
    invalidateChoices() {
      if (view.stage === 'question') publish({ ...view, catalog: [], proposal: undefined, notice: 'Hãy xác minh bộ tham số mới trước khi chọn.' })
    },
    async historyPage(offset: number) {
      const owner = active
      if (owner && view.stage === 'question') await loadPage(owner, { mode: 'history', offset, ...(owner.locator ? { locator: owner.locator } : {}) })
    },
    async selectHistory(sequence: number) {
      const owner = active
      if (!owner || view.stage !== 'question' || !view.history?.some(entry => entry.sequence === sequence)) return
      const history = view.history.find(entry => entry.sequence === sequence)!
      owner.original = `Quyết định ${sequence} · Vòng ${history.lap}, lượt ${history.turn}: ${history.description ?? history.action}`
      if (view.kind === 'gold') {
        publish({ ...view, selectedSequence: sequence, catalog: owner.gold.filter(choice => choice.decision.sequence === sequence).map(({ decision }) => ({
          kind: 'gold', decisionId: `gold:${sequence}`, alternativeId: 'skip', lap: decision.lap, turn: decision.turn,
        })) })
      } else await loadPage(owner, { mode: 'alternatives', sequence, offset: 0 })
      await resolveNatural(owner)
    },
    async alternativesPage(offset: number) {
      const owner = active
      if (owner && view.stage === 'question' && view.selectedSequence) await loadPage(owner, { mode: 'alternatives', sequence: view.selectedSequence, offset })
    },
    async probe(parameters: DecisionParameters) {
      const owner = active
      if (owner && view.stage === 'question' && view.selectedSequence) {
        const natural = owner.intent
        if (natural) owner.intent = { kind: view.kind, action: parameters.operation, ...historyLocator(natural),
          ...Object.fromEntries(Object.entries(parameters).filter(([key]) => key !== 'operation')) }
        await loadPage(owner, { mode: 'alternatives', sequence: view.selectedSequence, offset: 0, parameters })
        if (natural) await resolveNatural(owner, true)
      }
    },
    choose(choice: WhatIfDecision) {
      const owner = active
      if (!owner || view.stage !== 'question' || !view.catalog.some(candidate => equalData(choice, candidate))) return
      try { check(owner); publish({ ...view, stage: 'proposal', proposal: structuredClone(choice) }) }
      catch { failure(owner) }
    },
    async restart(kind = view.kind): Promise<void> {
      if (!['final', 'followup', 'blocked'].includes(view.stage)) return
      release()
      await controller.open(kind)
    },
    async confirm() {
      const owner = active, proposal = view.proposal
      if (!owner || view.stage !== 'proposal' || !proposal) return
      owner.selection = structuredClone(proposal)
      publish({ stage: 'running', kind: view.kind, catalog: [] })
      try {
        check(owner)
        if (proposal.kind === 'gold') {
          const selection = owner.gold.find(choice => `gold:${choice.decision.sequence}` === proposal.decisionId)
          if (!selection || proposal.alternativeId !== 'skip') throw new Error('Selection unavailable')
          owner.engineBusy = true
          const result = await binding.create(selection)
          owner.engineBusy = false
          await acceptGold(owner, result)
        } else {
          if (!owner.client) throw new Error('Worker unavailable')
          await acceptDecision(owner, await owner.client.request({ kind: 'create', selection: proposal }))
        }
      } catch (error) { owner.engineBusy = false; failure(owner, error) }
    },
    async followUp() {
      const owner = active
      if (!owner || view.stage !== 'followup') return
      if (owner.pendingDetail) owner.confirmed.push(owner.pendingDetail)
      publish({ stage: 'running', kind: view.kind, catalog: [] })
      try {
        check(owner)
        if (view.kind === 'gold' && owner.goldPending) {
          owner.engineBusy = true
          const result = await binding.followUp(owner.goldPending)
          owner.engineBusy = false
          await acceptGold(owner, result)
        } else if (owner.client && owner.followUpId) {
          await acceptDecision(owner, await owner.client.request({ kind: 'followup', choice: { id: owner.followUpId, optionId: 'skip' } }))
        } else throw new Error('Follow-up unavailable')
      } catch (error) { owner.engineBusy = false; failure(owner, error) }
    },
  }
  return controller
}
