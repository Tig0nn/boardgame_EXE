import { money, signedMoney } from '../../../../src/game/format.ts'
import type { Metrics } from '../endgame-whatif-contract.ts'

/** Only verified engine deltas enter this deterministic narrative. No inferred market events or provider prose. */
export function groundedExplanation(delta: { cash: number; totalWorth: number; liquidatableFunds: number }): string {
  const metrics = [['Tiền mặt', delta.cash], ['Tài sản ròng', delta.totalWorth], ['Tiền có thể thu về', delta.liquidatableFunds]] as const
  const changes = metrics.map(([label, amount]) => `${label}: ${signedMoney(amount)}.`).join(' ')
  const signs = new Set(metrics.map(([, amount]) => Math.sign(amount)))
  const names = (direction: number) => metrics.filter(([, amount]) => Math.sign(amount) === direction).map(([label]) => label.toLowerCase()).join(', ')
  const tradeOff = signs.has(1) && signs.has(-1) ? `Các chỉ số thay đổi khác chiều: ${names(1)} tăng trong khi ${names(-1)} giảm.`
    : signs.size > 1 ? 'Một số chỉ số không đổi, những chỉ số còn lại thay đổi như bảng so sánh.'
      : signs.has(0) ? 'Ba chỉ số này không đổi.' : 'Ba chỉ số này cùng tăng hoặc cùng giảm như bảng so sánh.'
  return `${changes} ${tradeOff}`
}

/** The engine records this credit separately at each START. It is only one part of the final cash difference. */
export function verifiedSalaryChanges(actual: Metrics['salaryAtStarts'], alternative: Metrics['salaryAtStarts']): string[] {
  if (!Array.isArray(actual) || !Array.isArray(alternative)) return []
  return actual.flatMap(entry => {
    if (!entry || !Number.isInteger(entry.lap) || entry.lap < 1 || entry.lap > 4 || !Number.isFinite(entry.courseBoost)) return []
    const trial = alternative.find(candidate => candidate?.lap === entry.lap)
    if (!trial || !Number.isFinite(trial.courseBoost) || trial.courseBoost === entry.courseBoost) return []
    const change = trial.courseBoost - entry.courseBoost
    return [`Vòng ${entry.lap} tại START: khoản tăng lương từ khóa học ${change > 0 ? 'cao' : 'thấp'} hơn ${money(Math.abs(change))}.`]
  })
}

export function blockedExplanation(reason: string): string {
  if (/source-wire-cap|source-cap|source-too-large/.test(reason)) return 'Lịch sử ván vượt giới hạn dữ liệu để xác minh. Phương án này chưa thể mô phỏng.'
  if (/CAPTURE_INTEGRITY_GAP|source-changed|source-witness/.test(reason)) return 'Dữ liệu ván đã đổi hoặc không thể xác minh. Hãy mở lại phân tích từ kết quả ván hiện tại.'
  if (/bond-lot-origin-mismatch/.test(reason)) return 'Lot trái phiếu không còn cùng nguồn mua gốc. Hệ thống không tự chuyển giao dịch sang lot khác.'
  if (/funding|payment|settlement/.test(reason)) return 'Phương án đi vào tình huống cấp tiền hoặc thanh toán chưa được replay này hỗ trợ đầy đủ.'
  if (/insolven|early|ending|termination/.test(reason)) return 'Chưa chứng minh được hai nhánh kết thúc tại cùng mốc cuối ván để so sánh an toàn.'
  if (/rng|exogenous|external|diverged/.test(reason)) return 'Diễn biến ngoại sinh hoặc ngữ cảnh hai nhánh không còn khớp để so sánh an toàn.'
  if (/illegal-recorded-action|followup-unsupported/.test(reason)) return 'Một hành động trong lịch sử sau fork không còn hợp lệ và chưa có cách tiếp tục an toàn được hỗ trợ.'
  if (/step-budget|time-budget|timeout/.test(reason)) return 'Phân tích đã vượt giới hạn thời gian hoặc số bước. Hãy chọn quyết định khác.'
  if (/selection|catalog|stale/.test(reason)) return 'Lựa chọn không thuộc catalog hiện tại hoặc đã hết hiệu lực. Hãy xác minh lại phương án.'
  if (/alternative-illegal|fork-context|parameters/.test(reason)) return 'Hành động hoặc tham số không hợp lệ tại thời điểm lịch sử đã chọn.'
  return 'Engine chưa thể chứng minh đầy đủ phương án này. Không có số liệu so sánh được công bố.'
}
