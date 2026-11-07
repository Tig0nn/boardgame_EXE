/** Pure presentation helpers: identifiers and game state remain unchanged. */
export function investmentLotLabel(kind: 'savings' | 'bonds', id: string): string {
  const label = kind === 'savings' ? 'Khoản tiết kiệm' : 'Khoản trái phiếu'
  const match = /^(?:deposit|bond|lot)-([1-9]\d*)$/.exec(id)
  return match ? `${label} ${match[1]}` : label
}

/** maturityLap is an absolute passage index, never the current lap or duration. */
export function maturityLabel(maturityLap: number): string {
  return `Đáo hạn khi qua ô Xuất phát lần thứ ${maturityLap}`
}

export const savingsPeriodExplanation = 'Một kỳ được tính theo mỗi lần qua ô Xuất phát. Lãi đơn được nhận cùng gốc vào cuối kỳ hạn; rút sớm toàn khoản mất lãi chưa nhận.'

/** Apply only to human narrative at render time, never IDs, JSON or saved logs. */
export function localizePlayerText(text: string): string {
  return text
    .replace(/\b(deposit|bond|lot)-([1-9]\d*)\b/g, (_match, kind: string, n: string) => `${kind === 'deposit' ? 'Khoản tiết kiệm' : kind === 'bond' ? 'Khoản trái phiếu' : 'Khoản'} ${n}`)
    .replace(/(đáo hạn|Đáo hạn|đến hạn|Đến hạn|hoàn gốc|Hoàn gốc)\s+(?:tại\s+)?START(?:\s+vòng)?\s+(\d+)\b/g, '$1 khi qua ô Xuất phát lần thứ $2')
    .replace(/\bSTART(?:\s+vòng)?\s+(\d+)\b/g, 'ô Xuất phát lần thứ $1')
    .replace(/\bSTART\b/g, 'ô Xuất phát')
}

export function tileDisplayLabel(label: string): string {
  return label === 'START' ? 'Xuất phát' : label
}
