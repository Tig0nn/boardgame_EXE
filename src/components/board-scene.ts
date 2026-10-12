// All coordinates are in the approved WebP's native space. Crop the entire
// scene (image, tiles and pawn) together; never size a CSS background separately.
export const SCENE = {
  width: 941,
  height: 1672,
  crop: { x: 65, y: 625, width: 810, height: 500 },
  tileScale: 1.16,
} as const

export function tileCenter({ row, col }: { row: number; col: number }) {
  return { x: 461 + (col - row) * 56, y: 705 + (col + row - 2) * 35 }
}
