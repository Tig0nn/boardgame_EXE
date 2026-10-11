// FNV-1a seed hash + Mulberry32; all random draws are explicit state transitions.
export function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619)
  return hash >>> 0
}
export function random(rng: number): [number, number] {
  const next = (rng + 0x6D2B79F5) >>> 0
  let value = Math.imul(next ^ (next >>> 15), next | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return [((value ^ (value >>> 14)) >>> 0) / 4294967296, next]
}
