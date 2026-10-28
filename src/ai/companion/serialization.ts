import { CompanionContractError } from './errors.ts'

/** Internal JSON normalization. Public context hashing additionally validates its DTO. */
export function canonicalJson(value: unknown): string {
  function sort(item: unknown, depth: number): unknown {
    if (depth > 20) throw new CompanionContractError('INVALID_REQUEST')
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return item
    if (typeof item === 'number' && Number.isSafeInteger(item)) return item
    if (Array.isArray(item)) return item.map(child => sort(child, depth + 1))
    if (item && typeof item === 'object') {
      const descriptors = Object.getOwnPropertyDescriptors(item)
      return Object.fromEntries(Object.keys(descriptors).sort().map(key => {
        if (!('value' in descriptors[key])) throw new CompanionContractError('INVALID_REQUEST')
        return [key, sort(descriptors[key].value, depth + 1)]
      }))
    }
    throw new CompanionContractError('INVALID_REQUEST')
  }
  return JSON.stringify(sort(value, 0))
}

export async function sha256(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new CompanionContractError('SERVICE_UNAVAILABLE')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`
}
