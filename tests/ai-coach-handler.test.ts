import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAICoachRequest, FALLBACK_MESSAGE } from '../src/ai/server/handler.ts'
import { checkRateLimit, resetRateLimiter } from '../src/ai/server/rateLimiter.ts'
import { validateAndGroundCoachOutput, validateCoachFacts } from '../src/ai/schema.ts'
import type { CoachFacts, CoachOutput } from '../src/ai/types.ts'

const sampleValidFacts: CoachFacts = {
  version: 1,
  mode: 'experimental-b',
  board: 'C20',
  totalLaps: 4,
  completed: true,
  won: true,
  insolvent: false,
  goalCostVnd: 80_000_000,
  requiredReserveVnd: 10_000_000,
  targetProceedsVnd: 90_000_000,
  lawfulProceedsVnd: 95_000_000,
  netWorthVnd: 95_000_000,
  cashVnd: 95_000_000,
  debtVnd: 0,
  obligationsVnd: 0,
  businessLockedQuoteVnd: 0,
  savingsProfileId: 'v2.2-c20',
  evidence: [
    {
      id: 'ev:goal-achieved',
      kind: 'goal-result',
      fact: 'Đạt mục tiêu thành công với 95.000.000 VND nguồn tiền hợp lệ.',
    },
    {
      id: 'ev:course-purchased',
      kind: 'course',
      lap: 1,
      fact: 'Đầu tư khóa học ở vòng 1 tăng lương định kỳ.',
    },
  ],
}

test('AI Rate Limiter: giới hạn tối đa 5 requests trong 60 giây', () => {
  resetRateLimiter()
  const testIp = '192.168.1.100'

  for (let i = 1; i <= 5; i++) {
    const res = checkRateLimit(testIp, 5, 60_000)
    assert.equal(res.allowed, true, `Request ${i} phải được chấp thuận`)
    assert.equal(res.remaining, 5 - i)
  }

  // Request thứ 6 bị chặn
  const blocked = checkRateLimit(testIp, 5, 60_000)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.remaining, 0)
  assert.ok(blocked.retryAfterSeconds > 0)
})

test('AI Handler: trả về 429 khi bị chặn bởi Rate Limiter', async () => {
  resetRateLimiter()
  const ip = '10.0.0.5'

  // Gửi 5 request hợp lệ
  for (let i = 0; i < 5; i++) {
    checkRateLimit(ip, 5, 60_000)
  }

  // Request thứ 6 qua handler
  const result = await handleAICoachRequest(sampleValidFacts, ip)
  assert.equal(result.status, 429)
  assert.equal(result.body.fallback, FALLBACK_MESSAGE)
  assert.ok(typeof result.body.retryAfter === 'number')
})

test('AI Schema: validateCoachFacts từ chối payload sai format hoặc vượt quá 10KB', () => {
  // Sai version
  const badVersion = { ...sampleValidFacts, version: 2 }
  assert.equal(validateCoachFacts(badVersion).valid, false)

  // Chưa completed
  const notCompleted = { ...sampleValidFacts, completed: false }
  assert.equal(validateCoachFacts(notCompleted).valid, false)

  // Số lượng evidence > 8
  const tooManyEvidences = {
    ...sampleValidFacts,
    evidence: new Array(9).fill(sampleValidFacts.evidence[0]),
  }
  assert.equal(validateCoachFacts(tooManyEvidences).valid, false)

  // Payload vượt quá 10 KB
  const hugePayloadSize = 10241
  assert.equal(validateCoachFacts(sampleValidFacts, hugePayloadSize).valid, false)

  // Hợp lệ
  assert.equal(validateCoachFacts(sampleValidFacts, 1000).valid, true)
})

test('AI Schema: validateAndGroundCoachOutput loại bỏ bằng chứng giả mạo (Hallucination)', () => {
  // Output chứa cả evidenceId thật ('ev:goal-achieved') và bịa đặt ('ev:fake-id')
  const rawOutput: CoachOutput = {
    version: 1,
    headline: 'Chiến thuật tài chính tốt',
    insights: [
      {
        title: 'Đạt đích ấn tượng',
        explanation: 'Bạn đã hoàn thành mục tiêu 95 triệu.',
        evidenceIds: ['ev:goal-achieved', 'ev:fake-id'],
      },
      {
        title: 'Lời khuyên bịa',
        explanation: 'Ảo giác không có chứng cứ.',
        evidenceIds: ['ev:non-existent'],
      },
    ],
    tryNext: 'Thử gửi tiết kiệm kỳ hạn dài hơn ở ván sau.',
  }

  const result = validateAndGroundCoachOutput(rawOutput, sampleValidFacts)
  assert.equal(result.valid, true)
  assert.ok(result.output)
  // Chỉ còn 1 insight vì insight thứ 2 bị loại hoàn toàn (không còn evidenceId hợp lệ)
  assert.equal(result.output.insights.length, 1)
  // Insight 1 đã bị lọc mất 'ev:fake-id'
  assert.deepEqual(result.output.insights[0].evidenceIds, ['ev:goal-achieved'])
})

test('AI Schema: từ chối phản hồi nếu 100% insights đều không có bằng chứng hợp lệ', () => {
  const allFakeOutput = {
    version: 1,
    headline: 'Hoàn toàn bịa đặt',
    insights: [
      {
        title: 'Nhận xét ảo',
        explanation: 'Không có trong facts.',
        evidenceIds: ['ev:completely-fake'],
      },
    ],
    tryNext: 'Thử lại ván sau.',
  }

  const result = validateAndGroundCoachOutput(allFakeOutput, sampleValidFacts)
  assert.equal(result.valid, false)
  assert.match(result.error ?? '', /không trích dẫn bằng chứng hợp lệ/)
})

test('AI Handler: trả về 503 khi chưa có API Key', async () => {
  resetRateLimiter()
  const originalKey = process.env.GEMINI_API_KEY
  delete process.env.GEMINI_API_KEY

  try {
    const result = await handleAICoachRequest(sampleValidFacts, '127.0.0.1')
    assert.equal(result.status, 503)
    assert.equal(result.body.fallback, FALLBACK_MESSAGE)
    assert.match(String(result.body.error), /chưa được cấu hình API Key/)
  } finally {
    if (originalKey) process.env.GEMINI_API_KEY = originalKey
  }
})

test('AI Handler: xử lý phản hồi thành công khi gọi với custom Mock API', async () => {
  resetRateLimiter()

  // Mock global.fetch để giả lập phản hồi của Gemini API
  const originalFetch = global.fetch
  const mockGeminiResponse: CoachOutput = {
    version: 1,
    headline: 'Hành trình quản lý dòng tiền xuất sắc',
    insights: [
      {
        title: 'Chạm đích thành công',
        explanation: 'Tích lũy đủ 95.000.000 VND nguồn tiền hợp lệ.',
        evidenceIds: ['ev:goal-achieved'],
      },
      {
        title: 'Tăng thu nhập sớm',
        explanation: 'Mua khóa học ở vòng 1 đem lại dòng tiền lương lớn.',
        evidenceIds: ['ev:course-purchased'],
      },
    ],
    tryNext: 'Thử đầu tư thêm vào vàng hoặc trái phiếu ở ván tới.',
  }

  global.fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockGeminiResponse) }],
            },
          },
        ],
      }),
    } as unknown as Response
  }

  try {
    const result = await handleAICoachRequest(sampleValidFacts, '127.0.0.1', 'mock-test-key')
    assert.equal(result.status, 200)
    const body = result.body as unknown as CoachOutput
    assert.equal(body.headline, 'Hành trình quản lý dòng tiền xuất sắc')
    assert.equal(body.insights.length, 2)
    assert.equal(body.insights[0].evidenceIds[0], 'ev:goal-achieved')
  } finally {
    global.fetch = originalFetch
  }
})
