import { signedMoney } from '../../../../src/game/format.ts'
import { foxCoachVersion } from './fox-evidence.ts'
import type { evaluateWhatIf } from './what-if-replay.ts'

type Evaluation = Awaited<ReturnType<typeof evaluateWhatIf>>
const outcomeLabels = { victory: 'đạt mục tiêu', defeat: 'chưa đạt mục tiêu', insolvent: 'mất khả năng thanh toán' }

function formatVnd(value: string, signed = false) {
  const amount = BigInt(value)
  return (signed && amount > 0n ? '+' : '') + amount.toLocaleString('vi-VN') + ' ₫'
}

export function explainFoxWhatIf(evaluation: Evaluation, sequence: number) {
  const { continuation } = evaluation
  const base = {
    version: foxCoachVersion, source: 'verified-what-if-replay' as const, sequence,
    continuation: { retained: continuation.retained, notRetained: continuation.notRetained, fallbackCount: continuation.fallback.length },
  }
  const decision = evaluation.status === 'completed' ? evaluation.explanation.decision : evaluation.decision
  const labels = (entries: typeof decision.actual, fallback: string) =>
    entries.map(entry => [entry.decision, entry.consequence].filter(Boolean).join(' — ')).join(' ') || fallback
  const decisionCards = [
    { id: 'original', title: 'Quyết định gốc', text: labels(decision.actual, 'Xem hành động gốc trong nhật ký.') },
    { id: 'alternative', title: 'Quyết định thay thế', text: labels(decision.alternative, 'Bỏ giao dịch đã chọn.') },
  ]

  if (evaluation.status === 'limited') return {
    ...base, status: 'limited' as const,
    cards: [...decisionCards, { id: 'limit', title: 'Giới hạn so sánh', text: evaluation.reason === 'EARLY_INSOLVENCY'
      ? 'Nhánh giả lập mất khả năng thanh toán sau khi hoàn tất ' + evaluation.completedLaps.length +
        ' vòng. Cáo chưa có kết quả hai nhánh tại cùng mốc cuối vòng 4 để so sánh.'
      : 'Hai nhánh có đường đi hoặc diễn biến thị trường khác nhau. Cáo chưa thể quy chênh lệch cuối ván cho quyết định đã chọn.' }],
    evidence: {
      decisions: { actual: decision.actual, alternative: decision.alternative },
      reason: evaluation.reason, completedLaps: evaluation.completedLaps,
    },
  }

  const { actual, alternative, delta, explanation } = evaluation
  const cards = [...decisionCards, {
    id: 'result', title: 'Nguồn huy động ở cuối vòng 4',
    text: 'Ván thật ' + outcomeLabels[actual.outcome] + ' với ' + formatVnd(actual.lawfulProceedsVnd) +
      '. Nhánh giả lập ' + outcomeLabels[alternative.outcome] + ' với ' + formatVnd(alternative.lawfulProceedsVnd) +
      '. Chênh lệch là ' + formatVnd(delta.lawfulProceedsVnd, true) + '.',
  }, {
    id: 'cash-at-decision', title: 'Ảnh hưởng ngay sau quyết định',
    text: 'Tiền mặt của nhánh giả lập so với ván thật thay đổi ' + signedMoney(decision.cashDeltaVnd) + ' tại điểm rẽ nhánh.',
  }]
  if (explanation.startDifferences.length) {
    cards.push({ id: 'start', title: 'Các dòng tiền thay đổi tại START', text: 'Các dòng dưới đây cho thấy những khoản đã thay đổi khi quyết toán. Chênh lệch nguồn huy động cuối ván còn phụ thuộc danh mục, nợ và nghĩa vụ còn lại.' })
  }
  if (continuation.notRetained || continuation.fallback.length) {
    cards.push({ id: 'continuation', title: 'Các bước sau điểm rẽ nhánh', text: 'Một số hành động cũ không còn áp dụng. Kết quả phản ánh cả quyết định thay thế lẫn những bước tiếp tục do mô phỏng ghi nhận.' })
  }
  return {
    ...base, status: 'completed' as const, cards,
    evidence: { decisions: decision, actual, alternative, delta, startDifferences: explanation.startDifferences },
  }
}

export type FoxWhatIfReply = ReturnType<typeof explainFoxWhatIf>
