import assert from 'node:assert/strict'
import { test } from 'node:test'
import { snap, type Box } from './snap.ts'

const card = (x: number, y: number): Box => ({ x, y, w: 168, h: 62 })

test('a near-miss on the left edge snaps flush and reports a vertical guide', () => {
  const out = snap(card(104, 300), [card(100, 100)], 6)

  assert.equal(out.x, 100, 'pulled onto the peer left edge')
  assert.equal(out.y, 300, 'the other axis is left alone')

  const g = out.guides.find((g) => g.axis === 'x')
  assert.ok(g, 'a vertical guide is reported')
  assert.equal(g.at, 100)
  // the line reaches from the top of the higher box to the bottom of the lower one
  assert.equal(g.from, 100)
  assert.equal(g.to, 362)
})

test('centres snap to each other, not just edges', () => {
  // peer centre x is 100 + 84 = 184; a 40-wide box at 161 is centred on 181, 3px off
  const moving: Box = { x: 161, y: 400, w: 40, h: 40 }
  const out = snap(moving, [card(100, 100)], 6)

  assert.equal(out.x + 20, 184, 'centres line up')
  assert.equal(out.guides.find((g) => g.axis === 'x')?.at, 184)
})

test('both axes snap independently, against different neighbours', () => {
  const left = card(200, 100) // gives the x line
  const top: Box = { x: 900, y: 300, w: 168, h: 62 } // gives the y line
  const out = snap(card(203, 303), [left, top], 6)

  assert.equal(out.x, 200)
  assert.equal(out.y, 300)
  assert.equal(out.guides.length, 2)
})

test('nothing within tolerance leaves the box exactly where it was', () => {
  const out = snap(card(140, 300), [card(100, 100)], 6)

  assert.equal(out.x, 140)
  assert.equal(out.y, 300)
  assert.deepEqual(out.guides, [], 'no guide is drawn when nothing aligned')
})

test('the closest candidate wins when several are in range', () => {
  // far's right edge sits at 108, near's left edge at 105; the dragged left edge is 104
  const far: Box = { x: -60, y: 100, w: 168, h: 62 }
  const near = card(105, 200)
  const out = snap(card(104, 500), [far, near], 6)

  assert.equal(out.x, 105, 'snapped to the nearer line, not the first one found')
})

test('a guide spans every box that shares the line, not only the dragged one', () => {
  const out = snap(card(102, 500), [card(100, 100), card(100, 300)], 6)
  const g = out.guides.find((g) => g.axis === 'x')!

  assert.equal(g.at, 100)
  assert.equal(g.from, 100, 'starts at the topmost aligned box')
  assert.equal(g.to, 562, 'ends at the bottom of the dragged one')
})

test('a box already flush stays put and still shows the guide', () => {
  const out = snap(card(100, 400), [card(100, 100)], 6)

  assert.equal(out.x, 100)
  assert.equal(out.guides.find((g) => g.axis === 'x')?.at, 100)
})
