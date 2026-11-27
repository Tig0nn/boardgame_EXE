import { money } from '../../../src/game/format'
import { localizeNarrative } from '../../../src/components/glossary'
import { investmentLotLabel } from '../../../src/components/player-language'
import type { Term } from '../../../src/game/types'
import type { WhatIfCatalog, WhatIfRequest } from './cloud-contract'

type Decision = WhatIfCatalog['decisions'][number]
type Choice = { label: string; detail?: string; alternative: WhatIfRequest['alternative'] }
const fundingLabels = { savings: 'Rút tiết kiệm', stocks: 'Bán cổ phiếu', bonds: 'Bán trái phiếu', gold: 'Bán vàng', debt: 'Vay nợ' }

export function choicesFor(decision: Decision): Choice[] {
  const choices: Choice[] = decision.eventChoices.map(option => ({
    label: localizeNarrative(option.label), detail: localizeNarrative(option.detail),
    alternative: { mode: 'replace', action: { actionId: 'choose', payload: { optionId: option.optionId } } },
  }))
  for (const { label, payload } of decision.tradeAlternatives) {
    choices.push({ label: label + ' · ' + money(payload.amount), alternative: { mode: 'replace', action: { actionId: 'trade', payload } } })
  }
  if (decision.canOmit) choices.push({ label: 'Bỏ giao dịch này', alternative: { mode: 'omit' } })
  const { actionId, payload } = decision.original
  if (actionId === 'trade' && 'kind' in payload && payload.kind === 'deposit') {
    const terms: Term[] = [1, 2, 3]
    for (const term of terms.filter(term => term !== (payload.term ?? 1))) {
      choices.push({ label: 'Gửi ' + money(payload.amount) + ' · Kỳ hạn ' + term + ' vòng',
        alternative: { mode: 'replace', action: { actionId: 'trade', payload: { ...payload, term } } } })
    }
  }
  if (actionId === 'fund' && 'source' in payload) {
    for (const { source, lotId, maxAmount: amount, minAmount } of decision.fundingOptions) {
      if (amount < minAmount || (source === payload.source && amount === payload.amount &&
          lotId === ('lotId' in payload ? payload.lotId : undefined))) continue
      const funding = source === 'bonds' ? lotId && { source, amount, lotId }
        : source === 'savings' ? { source, amount, lotId } : { source, amount }
      if (!funding) continue
      const detail = lotId && (source === 'savings' || source === 'bonds') ? investmentLotLabel(source, lotId) : undefined
      choices.push({ label: fundingLabels[source] + ' · ' + money(amount), detail,
        alternative: { mode: 'replace', action: { actionId: 'fund', payload: funding } } })
    }
  }
  return choices
}

export function originalLabel(decision: Decision) {
  const { payload } = decision.original
  const label = localizeNarrative(decision.label || decision.title || 'Quyết định đã thực hiện')
  if ('kind' in payload && payload.kind === 'deposit') return 'Gửi ' + money(payload.amount) + ' · Kỳ hạn ' + (payload.term ?? 1) + ' vòng'
  if ('amount' in payload && !/\d/.test(label)) return label + ' · ' + money(payload.amount)
  return label
}
