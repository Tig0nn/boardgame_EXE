// 128 bits of browser entropy; authoritative draws still use the unchanged seeded engine RNG.
// https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
export function generateGameSeed(): string {
  const words = globalThis.crypto.getRandomValues(new Uint32Array(4))
  return Array.from(words, word => word.toString(16).padStart(8, '0')).join('')
}
