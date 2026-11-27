export const MASCOT_VERSION = 1
export type Facts = Readonly<Record<string, number | string>>
const amounts = {
  concentration: ['value', 'gross', 'share', 'group', 'cash', 'knownPayments'],
  'payment-gap': ['cash', 'knownPayments', 'pending'],
  'cash-drop': ['cash', 'cashDrop'],
  'cash-exhaustion': ['asset', 'amount', 'cashBefore', 'cash', 'knownPayments'],
  debt: ['cash', 'debt'],
  deposit: ['amount', 'cashBefore', 'cash', 'knownPayments', 'term', 'maturityLap', 'rate'],
  buy: ['amount', 'cashBefore', 'cash', 'knownPayments'],
  upgrade: ['amount', 'cashBefore', 'cash'],
  sell: ['amount', 'cashBefore', 'cash'],
  repay: ['amount', 'cashBefore', 'cash', 'debtReduced'],
  borrow: ['amount', 'debt', 'paid'],
  'debt-reduced': ['debtReduced', 'debt', 'cash'],
  'coverage-restored': ['cash', 'knownPayments'],
  'goal-progress': ['improvement', 'remaining', 'target'],
} as const

export type Topic = keyof typeof amounts
export type ExplanationContext = { version: typeof MASCOT_VERSION; topic: Topic; facts: Facts }

const purchaseAssets = ['stocks', 'bonds', 'gold', 'business'] as const
const assetGroups = [...purchaseAssets, 'savings']

export function isMascotPurchaseAsset(value: unknown): value is typeof purchaseAssets[number] {
  return purchaseAssets.some(asset => asset === value)
}

// Coaching threshold only. This does not determine whether the engine accepts a purchase.
export function exhaustsCash(before: number, cash: number, amount: number) {
  return amount >= 2_000_000 && before - cash === amount && cash >= 0 && cash <= 500_000 && cash <= before * 0.05
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

function validRelationships(topic: Topic, facts: Facts) {
  const n = (key: string) => Number(facts[key])
  const cash = n('cash'), before = n('cashBefore'), amount = n('amount')
  switch (topic) {
    case 'concentration':
      return n('value') >= 5_000_000 && n('value') <= n('gross') && n('value') / n('gross') >= 0.65
        && Math.floor(n('value') / n('gross') * 100) === n('share')
        && cash + n('value') <= n('gross') && n('knownPayments') > cash / 2 && n('knownPayments') <= cash
    case 'payment-gap': return n('knownPayments') > cash && n('pending') <= n('knownPayments')
    case 'cash-drop': return n('cashDrop') >= 2_000_000 && n('cashDrop') >= cash
    case 'cash-exhaustion': return exhaustsCash(before, cash, amount) && n('knownPayments') <= cash
    case 'debt': return n('debt') >= 2_000_000 && n('debt') >= cash
    case 'deposit': return amount > 0 && before - cash === amount && n('term') >= 1 && n('term') <= 3
      && n('maturityLap') >= n('term') && n('maturityLap') <= 12
    case 'buy':
    case 'upgrade': return amount > 0 && before - cash === amount
    case 'sell': return amount > 0 && cash - before === amount
    case 'repay': return n('debtReduced') > 0 && n('debtReduced') <= amount && before - cash === amount
    case 'borrow': return amount > 0 && n('debt') >= amount && n('paid') > 0
    case 'debt-reduced': return n('debtReduced') > 0
    case 'coverage-restored': return n('knownPayments') > 0 && cash >= n('knownPayments')
    case 'goal-progress': return n('improvement') > 0 && n('target') > 0
  }
}

export function readExplanationContext(value: unknown): ExplanationContext | null {
  if (!record(value) || !exact(value, ['version', 'topic', 'facts']) || value.version !== MASCOT_VERSION
    || typeof value.topic !== 'string' || !Object.hasOwn(amounts, value.topic) || !record(value.facts)) return null
  const topic = value.topic as Topic
  const facts = value.facts
  if (!exact(facts, amounts[topic])) return null
  for (const [key, fact] of Object.entries(facts)) {
    if (key === 'group') {
      if (typeof fact !== 'string' || !assetGroups.includes(fact)) return null
    } else if (key === 'asset') {
      if (!isMascotPurchaseAsset(fact)) return null
    } else if (typeof fact !== 'number' || !Number.isFinite(fact) || fact < 0
      || (key === 'rate' ? fact > 1 : !Number.isSafeInteger(fact))) return null
  }
  const validated = facts as Facts
  return validRelationships(topic, validated) ? { version: MASCOT_VERSION, topic, facts: validated } : null
}
