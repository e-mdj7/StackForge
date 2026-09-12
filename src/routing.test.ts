import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bridges, planRoutes, toPath, wire, type Link, type Rect } from './routing.ts'

const card = (x: number, y: number, parent = 'group:g'): Rect => ({ x, y, w: 168, h: 62, parent })

/** every corner of a rounded orthogonal path, in order */
const corners = (d: string): [number, number][] =>
  [...d.matchAll(/[MLQ]\s*(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])

test('two blocks stacked vertically get one straight wire, never an S', () => {
  const rects = new Map<string, Rect>([['prisma', card(100, 100)], ['pg', card(100, 240)]])
  const routes = planRoutes(rects, [{ id: 'e1', source: 'pg', target: 'prisma' }])
  const r = routes.get('e1')!
  assert.equal(r.sx, r.tx, 'both ends share an x')
  const ys = corners(r.path).map(([, y]) => y)
  // monotone: the old smoothstep path went up, back down past the target, then up again
  const down = ys.every((y, i) => i === 0 || y >= ys[i - 1])
  const up = ys.every((y, i) => i === 0 || y <= ys[i - 1])
  assert.ok(down || up, 'path doubles back: ' + ys.join(','))
})

test('two wires between the same pair leave from different points', () => {
  const rects = new Map<string, Rect>([
    ['next', card(0, 100, 'group:fe')],
    ['pg', card(600, 100, 'group:data')],
  ])
  const links: Link[] = [
    { id: 'a', source: 'next', target: 'pg' },
    { id: 'b', source: 'next', target: 'pg' },
  ]
  const r = planRoutes(rects, links)
  const a = r.get('a')!, b = r.get('b')!
  assert.ok(a.sx !== b.sx || a.sy !== b.sy, 'both wires start at the same socket')
  assert.ok(a.tx !== b.tx || a.ty !== b.ty, 'both wires end at the same socket')
})

test('a wire routes around a block sitting between its ends', () => {
  const rects = new Map<string, Rect>([
    ['react', card(100, 100)],
    ['next', card(100, 200)], // directly in the way
    ['tw', card(100, 300)],
  ])
  const r = planRoutes(rects, [{ id: 'e', source: 'react', target: 'tw' }]).get('e')!
  const through = corners(r.path).some(([x, y]) => x > 100 && x < 268 && y > 195 && y < 267)
  assert.ok(!through, 'wire still passes through the middle block: ' + r.path)
})

test('two wires dodging the same way keep a full lane apart', () => {
  // react and tailwind stacked with next.js between them, plus next.js -> a block below:
  // both detours leave rightwards, and the clamp used to collapse them onto each other
  const rects = new Map<string, Rect>([
    ['react', card(100, 100)],
    ['next', card(100, 200)],
    ['tw', card(100, 300)],
    ['test', card(100, 500)],
  ])
  const r = planRoutes(rects, [
    { id: 'a', source: 'react', target: 'tw' },
    { id: 'b', source: 'next', target: 'test' },
  ])
  const vertical = (d: string) => {
    const xs = corners(d).map(([x]) => x)
    return Math.max(...xs)
  }
  const gap = Math.abs(vertical(r.get('a')!.path) - vertical(r.get('b')!.path))
  assert.ok(gap >= 10, `detour corridors only ${gap.toFixed(1)}px apart`)
})

test('two wires out of one block into stacked targets do not cross', () => {
  // the Mercado Pago case: both wires leave the same block leftwards and peel off at
  // different heights. Lane order decides whether the lower one cuts across the higher one.
  const rects = new Map<string, Rect>([
    ['django', card(22, 62, 'group:backend')],
    ['pocketbase', card(22, 162, 'group:backend')],
    ['mercadopago', card(480, 472, 'group:business')],
    ['group:backend', { x: 0, y: 0, w: 394, h: 246, box: true }],
    ['group:business', { x: 458, y: 310, w: 394, h: 246, box: true }],
  ])
  const routes = planRoutes(rects, [
    { id: 'a', source: 'mercadopago', target: 'django' },
    { id: 'b', source: 'mercadopago', target: 'pocketbase' },
  ])
  const segs = (id: string) => {
    const pts = corners(routes.get(id)!.path)
    return pts.slice(1).map((p, i) => [pts[i], p] as const)
  }
  let crossings = 0
  for (const [a1, a2] of segs('a'))
    for (const [b1, b2] of segs('b')) {
      const aH = Math.abs(a1[1] - a2[1]) < 1, bV = Math.abs(b1[0] - b2[0]) < 1
      if (!aH || !bV) continue
      const x = b1[0], y = a1[1]
      if (x > Math.min(a1[0], a2[0]) + 2 && x < Math.max(a1[0], a2[0]) - 2 &&
          y > Math.min(b1[1], b2[1]) + 2 && y < Math.max(b1[1], b2[1]) - 2) crossings++
    }
  assert.equal(crossings, 0, 'the two wires still cross each other')
})

test('a horizontal wire bridges over a vertical one it crosses', () => {
  const hits = bridges([
    { id: 'h', pts: [{ x: 0, y: 50 }, { x: 200, y: 50 }] },
    { id: 'v', pts: [{ x: 100, y: 0 }, { x: 100, y: 100 }] },
  ])
  assert.deepEqual(hits.get('h'), [{ x: 100, y: 50 }], 'horizontal wire got no hop')
  assert.equal(hits.get('v'), undefined, 'vertical wire should not also hop')
  assert.match(toPath([{ x: 0, y: 50 }, { x: 200, y: 50 }], hits.get('h')), /A4 4 0 0 1 104,50/)
})

test('wires that only touch at a shared point get no bridge', () => {
  const hits = bridges([
    { id: 'h', pts: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
    { id: 'v', pts: [{ x: 100, y: 50 }, { x: 100, y: 150 }] },
  ])
  assert.equal(hits.size, 0)
})

test('a wire that has to turn back does not cross the block it left', () => {
  // both ends leave rightwards, so the corridor must sit clear of both cards
  const w = wire({ x: 168, y: 130 }, 'right', { x: 168, y: 330 }, 'right')
  assert.ok(w.pts.every((p) => p.x >= 168), 'wire re-enters the block it left')
})
