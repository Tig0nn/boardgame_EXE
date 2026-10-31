import type { CoachEvidence, CoachEvidenceKind, CoachFacts, CoachOutput } from './types.ts'

const VALID_EVIDENCE_KINDS: Set<CoachEvidenceKind> = new Set([
  'bond-credit',
  'bond-choice',
  'goal-result',
  'liquidity-gap',
  'business-locked',
  'savings-withdrawal',
  'savings-maturity',
  'borrowing',
  'business-buy',
  'business-upgrade',
  'business-sale',
  'course',
  'asset-trade',
  'macro-shock',
  'expense',
  'insolvency',
])

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>?/gm, '').trim()
}

/**
 * Xác thực dữ liệu CoachFacts nhận được từ client.
 * Đảm bảo payload kích thước <= 10 KB, đúng version, các trường số là Safe Integer.
 */
export function validateCoachFacts(
  data: unknown,
  rawPayloadSize?: number
): { valid: boolean; error?: string; facts?: CoachFacts } {
  if (rawPayloadSize !== undefined && rawPayloadSize > 10240) {
    return { valid: false, error: 'Kích thước dữ liệu vượt quá giới hạn 10 KB.' }
  }

  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Dữ liệu không phải là JSON object hợp lệ.' }
  }

  const obj = data as Partial<CoachFacts>

  if (obj.version !== 1) {
    return { valid: false, error: 'Phiên bản dữ liệu không hợp lệ (yêu cầu version=1).' }
  }

  if (obj.completed !== true) {
    return { valid: false, error: 'Ván chơi chưa hoàn thành (yêu cầu completed=true).' }
  }

  if (typeof obj.won !== 'boolean' || typeof obj.insolvent !== 'boolean') {
    return { valid: false, error: 'Trạng thái thắng/thua hoặc phá sản không hợp lệ.' }
  }

  const numberFields: Array<keyof CoachFacts> = [
    'goalCostVnd',
    'requiredReserveVnd',
    'targetProceedsVnd',
    'lawfulProceedsVnd',
    'netWorthVnd',
    'cashVnd',
    'debtVnd',
    'obligationsVnd',
    'businessLockedQuoteVnd',
  ]

  for (const field of numberFields) {
    const val = obj[field]
    if (typeof val !== 'number' || !Number.isSafeInteger(val)) {
      return { valid: false, error: `Trường ${field} phải là số nguyên VND an toàn.` }
    }
  }

  if (!Array.isArray(obj.evidence) || obj.evidence.length > 8) {
    return { valid: false, error: 'Mảng bằng chứng (evidence) phải có tối đa 8 phần tử.' }
  }

  for (let i = 0; i < obj.evidence.length; i++) {
    const ev = obj.evidence[i] as Partial<CoachEvidence>
    if (!ev || typeof ev.id !== 'string' || !ev.id.trim()) {
      return { valid: false, error: `Bằng chứng thứ ${i + 1} thiếu id hợp lệ.` }
    }
    if (!ev.kind || !VALID_EVIDENCE_KINDS.has(ev.kind as CoachEvidenceKind)) {
      return { valid: false, error: `Bằng chứng thứ ${i + 1} có kind không hợp lệ (${ev.kind}).` }
    }
    if (typeof ev.fact !== 'string' || !ev.fact.trim() || ev.fact.length > 500) {
      return { valid: false, error: `Bằng chứng thứ ${i + 1} có nội dung fact không hợp lệ.` }
    }
  }

  return { valid: true, facts: obj as CoachFacts }
}

/**
 * Kiểm tra tính hợp lệ và ràng buộc đối chiếu bằng chứng (Grounding Check)
 * của phản hồi nhận được từ LLM.
 */
export function validateAndGroundCoachOutput(
  rawOutput: unknown,
  inputFacts: CoachFacts
): { valid: boolean; error?: string; output?: CoachOutput } {
  if (!rawOutput || typeof rawOutput !== 'object') {
    return { valid: false, error: 'Phản hồi từ AI không phải JSON object.' }
  }

  const obj = rawOutput as Partial<CoachOutput>

  if (obj.version !== 1) {
    return { valid: false, error: 'Phiên bản phản hồi AI không hợp lệ (yêu cầu version=1).' }
  }

  const headline = typeof obj.headline === 'string' ? stripHtml(obj.headline) : ''
  if (!headline || headline.length < 3 || headline.length > 200) {
    return { valid: false, error: 'Tiêu đề (headline) không hợp lệ.' }
  }

  const tryNext = typeof obj.tryNext === 'string' ? stripHtml(obj.tryNext) : ''
  if (!tryNext || tryNext.length < 3 || tryNext.length > 300) {
    return { valid: false, error: 'Đề xuất ván sau (tryNext) không hợp lệ.' }
  }

  if (!Array.isArray(obj.insights) || obj.insights.length === 0 || obj.insights.length > 3) {
    return { valid: false, error: 'Danh sách nhận xét (insights) phải từ 1 đến 3 mục.' }
  }

  const validEvidenceIds = new Set(inputFacts.evidence.map(e => e.id))
  const groundedInsights: CoachOutput['insights'] = []

  for (let i = 0; i < obj.insights.length; i++) {
    const item = obj.insights[i]
    if (!item || typeof item !== 'object') continue

    const title = typeof item.title === 'string' ? stripHtml(item.title) : ''
    const explanation = typeof item.explanation === 'string' ? stripHtml(item.explanation) : ''

    if (!title || !explanation) continue

    const candidateIds = Array.isArray(item.evidenceIds) ? item.evidenceIds : []
    // Lọc chỉ giữ các evidenceId thực sự tồn tại trong inputFacts
    const groundedIds = candidateIds.filter(id => typeof id === 'string' && validEvidenceIds.has(id))

    // Nếu nhận xét này không trích dẫn được bất kỳ evidenceId hợp lệ nào, bỏ qua nhận xét đó
    if (groundedIds.length > 0) {
      groundedInsights.push({
        title,
        explanation,
        evidenceIds: groundedIds,
      })
    }
  }

  if (groundedInsights.length === 0) {
    return {
      valid: false,
      error: 'Toàn bộ nhận xét của AI không trích dẫn bằng chứng hợp lệ từ ván chơi.',
    }
  }

  return {
    valid: true,
    output: {
      version: 1,
      headline,
      insights: groundedInsights,
      tryNext,
    },
  }
}
