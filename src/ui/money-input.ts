export function parseMoneyInput(text: string): number {
  if (text === '') return 0
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(text)) return NaN
  const amount = Number(text.replaceAll('.', ''))
  return Number.isSafeInteger(amount) ? amount : NaN
}

export const formatMoneyInput = (amount: number): string => Number.isSafeInteger(amount) && amount >= 0
  ? amount.toLocaleString('vi-VN') : ''
