// Presentation mapping from Web Dice3D. The top always displays the supplied
// canonical roll; this module never rolls or reads the gameplay RNG.
export function diceFaces(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 6) return null
  const front = value === 1 || value === 6 ? 2 : 1
  const right = value === 3 || value === 4 ? 2 : 3
  return { top: value, bottom: 7 - value, front, back: 7 - front, right, left: 7 - right }
}

const pips: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [], [[0, 0]], [[-.5, .5], [.5, -.5]], [[-.56, .56], [0, 0], [.56, -.56]],
  [[-.52, .52], [.52, .52], [-.52, -.52], [.52, -.52]],
  [[-.56, .56], [.56, .56], [0, 0], [-.56, -.56], [.56, -.56]],
  [[-.44, .6], [-.44, 0], [-.44, -.6], [.44, .6], [.44, 0], [.44, -.6]],
]
export function pipPositions(value: number) { return Number.isInteger(value) ? pips[value] ?? [] : [] }

export function diceRotation(progress: number): [number, number, number] {
  const remaining = (1 - Math.max(0, Math.min(1, progress))) ** 3
  return [Math.PI * 4 * remaining, Math.PI * 6 * remaining, Math.PI * 2 * remaining]
}
