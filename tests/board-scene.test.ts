import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BOARD, C20_BOARD } from '../src/data/board.ts'
import { SCENE, tileCenter } from '../src/components/board-scene.ts'

test('both historical layouts keep all 20 tile faces and pawns inside the playable crop', () => {
  for (const board of [BOARD, C20_BOARD]) {
    const centers = board.map(tileCenter)
    assert.equal(new Set(centers.map(({ x, y }) => `${x},${y}`)).size, 20)
    for (const { x, y } of centers) {
      assert.ok(x - 57 > SCENE.crop.x && x + 57 < SCENE.crop.x + SCENE.crop.width)
      assert.ok(y - 44 > SCENE.crop.y && y + 46 < SCENE.crop.y + SCENE.crop.height)
    }
    for (let i = 0; i < centers.length; i++) {
      const a = centers[i], b = centers[(i + 1) % centers.length]
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 75, `Adjacent tile ${i} stays on the perimeter, including corners`)
    }
  }
})

test('the four board corners stay inside the approved lawn, in artwork coordinates', () => {
  const corners = [0, 5, 10, 15].map(i => tileCenter(C20_BOARD[i]))
  const bounds = [
    { x: [420, 490], y: [680, 730] },
    { x: [720, 790], y: [860, 920] },
    { x: [420, 500], y: [1040, 1100] },
    { x: [140, 210], y: [860, 930] },
  ]
  corners.forEach(({ x, y }, i) => {
    assert.ok(x >= bounds[i].x[0] && x <= bounds[i].x[1])
    assert.ok(y >= bounds[i].y[0] && y <= bounds[i].y[1])
  })
})
