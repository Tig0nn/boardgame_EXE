import { explanationClaim } from './orchestrator.ts'
import type { WhatIfProvider } from './orchestrator.ts'

const gold = /^(?:bo(?: qua)?(?: lan)? mua vang|khong mua vang|skip (?:the )?gold purchase)$/
const bank = /^(?:gui(?: tien)? tiet kiem(?: o ngan hang)?|gui ngan hang|deposit (?:at the )?bank)$/
const course = /^(?:hoc khoa co ban|hoc khoa hoc co ban|take (?:the )?basic course)$/

/** Deterministic DEV stand-in. Ambiguous or compound requests require a new, supported question. */
export const mockGemini: WhatIfProvider = {
  async propose({ question, catalog }, signal) {
    signal.throwIfAborted()
    const normalized = question.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replaceAll('đ', 'd')
      .replace(/[?.!]+$/, '').trim().replace(/\s+/g, ' ')
      .replace(/^(?:neu (?:toi )?|what if (?:i )?)/, '').replace(/ thi sao$/, '')
    const sequence = / tai quyet dinh ([1-9][0-9]{0,2})$/.exec(normalized)
    const intent = sequence ? normalized.slice(0, sequence.index) : normalized
    const parameterChoices = catalog.filter(choice => choice.parameters)
    if (parameterChoices.length) {
      const amount = /\bso tien ([1-9][0-9]*)\b/.exec(intent)
      const matches = parameterChoices.filter(choice => {
        const p = choice.parameters!
        if (sequence && choice.decisionId !== `${choice.kind}:${sequence[1]}`) return false
        if (!amount || String(p.amount) !== amount[1]) return false
        if (choice.kind === 'bank') return new RegExp(`^gui tiet kiem so tien ${p.amount} ky han ${p.term}$`).test(intent)
        if (choice.kind === 'stocks') return intent === `${p.operation === 'buy' ? 'mua' : 'ban'} co phieu ${p.symbolId!.toLowerCase()} so tien ${p.amount}`
        const target = p.operation === 'buy' ? p.issuerId === 'an-tam' ? 'an tam' : 'but pha' : `lot ${p.lotId}`
        return intent === `${p.operation === 'buy' ? 'mua' : 'ban'} trai phieu ${target} so tien ${p.amount}`
      })
      if (matches.length === 1) return { decisionId: matches[0].decisionId, alternativeId: matches[0].alternativeId }
      return { status: matches.length > 1 || !amount || parameterChoices.some(choice => String(choice.parameters!.amount) === amount[1])
        ? 'ambiguous' : 'unsupported' }
    }
    const financial = /^(mua|ban|bo mua|bo ban|bo nang cap|nang cap) (co phieu|trai phieu(?: an tam| but pha)?|co so|kinh doanh|gia ca hop ly|chat luong do uong|khong gian check-in)$/.exec(intent)
    const advanced = /^(hoc|bo hoc) khoa nang cao$/.exec(intent)
    let kind = gold.test(intent) ? 'gold' : bank.test(intent) ? 'bank' : course.test(intent) ? 'course' : advanced ? 'advanced' : null
    let alternative: string | undefined = advanced ? advanced[1] === 'hoc' ? 'course-advanced' : 'skip'
      : course.test(intent) ? 'course-basic' : undefined
    if ((kind === 'course' || kind === 'advanced') && catalog.every(entry => entry.kind === 'course' || entry.kind === 'advanced')) kind = catalog[0]?.kind ?? kind
    if (financial) {
      const [, action, asset] = financial
      kind = asset === 'co phieu' ? 'stocks' : asset.startsWith('trai phieu') ? 'bonds' : 'business'
      if (action.startsWith('bo ')) alternative = 'skip'
      else if (kind === 'stocks') alternative = action === 'mua' ? 'buy-stocks' : 'sell-stocks'
      else if (kind === 'bonds') alternative = action === 'mua' ? asset.endsWith('but pha') ? 'buy-bonds:but-pha' : 'buy-bonds:an-tam' : 'sell-bonds:'
      else if (action === 'nang cap') alternative = `upgrade-business:${asset === 'gia ca hop ly' ? 'budget' : asset === 'chat luong do uong' ? 'taste' : 'checkin'}`
      else alternative = action === 'mua' ? 'buy-business' : 'sell-business'
    }
    const matches = catalog.filter(entry => entry.kind === kind && (!sequence || entry.decisionId === `${kind}:${sequence[1]}`)
      && (!alternative || (alternative === 'sell-bonds:' ? entry.alternativeId.startsWith(alternative) : entry.alternativeId === alternative)))
    if (matches.length !== 1) return null
    const { decisionId, alternativeId } = matches[0]
    return { decisionId, alternativeId }
  },
  async explain(facts, signal) {
    signal.throwIfAborted()
    return { claimId: explanationClaim(facts) }
  },
}
