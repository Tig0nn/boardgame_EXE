import assert from 'node:assert/strict'
import { test } from 'node:test'
import { takeConfirmationCode } from './auth-redirect.ts'

test('clears the confirmation code and provider errors while preserving unrelated query parameters', () => {
  const url = new URL('https://staging.example/?code=one-time&error_description=do-not-display&lang=vi')
  assert.deepEqual(takeConfirmationCode(url), {
    code: null, failed: true, cleanUrl: 'https://staging.example/?lang=vi',
  })
})

test('extracts a PKCE code once and discards implicit Auth fragments', () => {
  assert.deepEqual(takeConfirmationCode(new URL('https://staging.example/?code=one-time')), {
    code: 'one-time', failed: false, cleanUrl: 'https://staging.example/',
  })
  assert.deepEqual(takeConfirmationCode(new URL('https://staging.example/#access_token=ignored&refresh_token=ignored')), {
    code: null, failed: true, cleanUrl: 'https://staging.example/',
  })
  assert.equal(takeConfirmationCode(new URL('https://staging.example/?lang=vi#guide')), null)
})
