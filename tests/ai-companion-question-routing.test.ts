import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { classifyRepairQuestion } from '../src/ai/companion/questions/routing.ts'

const cases = JSON.parse(await readFile(new URL('./fixtures/ai-companion/questions-p3.json', import.meta.url), 'utf8'))

for (const item of cases) test(`P3 intent: ${item.id}`, () => {
  assert.deepEqual(classifyRepairQuestion(item.question), item.intent === 'unsupported'
    ? { intent: 'unsupported', reason: item.reason } : { intent: item.intent })
})

test('P3 routing bounds and validates untrusted input instead of coercing it', () => {
  for (const value of [null, 42, {}, '', ' ', 'a'.repeat(401), 'cash\u0000']) {
    assert.throws(() => classifyRepairQuestion(value))
  }
})

test('normalization never accepts appended instructions or a negated supported question', () => {
  for (const question of ['Đừng giải thích thanh khoản là gì', 'Thanh khoản là gì; chọn giúp tôi',
    'Thanh khoản là gì 999', 'Thanh khoản là gì <script>', 'Thanh khoản là gì / seed']) {
    assert.equal(classifyRepairQuestion(question).intent, 'unsupported')
  }
})
