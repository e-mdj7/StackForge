/**
 * Orthogonal wire router.
 *
 * React Flow's `getSmoothStepPath` only knows about the two points it is handed, so it
 * happily doubled a wire back over itself when two cards sat closer than its elbow offset,
 * ran straight through whatever card was in between, and gave every wire leaving a card the
 * same exit point. This plans all the wires together instead: it picks which sides to use by
 * cost (length, corners, blocks in the way), hands every wire its own socket on that side,
 * and separates wires that would otherwise share a corridor.
 *
 * No @xyflow import on purpose — this stays plain geometry so it can be unit-tested.
 */

export type Side = 'left' | 'right' | 'top' | 'bottom'
export interface Pt { x: number; y: number }
export interface Rect {
  x: number; y: number; w: number; h: number
  /** id of the group box this block sits in, so its own box is not treated as an obstacle */
  parent?: string
  /** true for group boxes, which are softer obstacles than the blocks themselves */
  box?: boolean
}
export interface Link { id: string; source: string; target: string }

export interface Route {
  sx: number; sy: number
  tx: number; ty: number
  path: string
  /** path length, so the travelling dot moves at one speed on long and short wires alike */
  len: number
  /** cardinality mark anchors, already pushed clear of the wire */
  ls: Pt
  lt: Pt
}

/** straight run off a block before the first corner */
const STUB = 18
/** gap between two wires that would otherwise share a corridor */
const LANE = 11
/** extra clearance when a wire has to double back past the block it left, so the detour
 *  reads as a deliberate loop instead of a line hugging the card edge */
const DODGE = 22
/** keep-out ring around a block */
const MARGIN = 7
/** radius of the little hop a wire makes where it crosses another */
const BRIDGE = 4
/** past this many crossings on one wire the hops read as noise, so it stays a plain line */
const MAX_BRIDGES = 6
/** a corner, priced in pixels of extra length */
const BEND = 70
const BLOCK_CARD = 6000
const BLOCK_BOX = 1600
const RADIUS = 10

const SIDES: Side[] = ['top', 'right', 'bottom', 'left']
const DX: Record<Side, number> = { left: -1, right: 1, top: 0, bottom: 0 }
const DY: Record<Side, number> = { left: 0, right: 0, top: -1, bottom: 1 }
const isH = (s: Side) => s === 'left' || s === 'right'
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const near = (a: number, b: number) => Math.abs(a - b) < 0.5

export function sidePoint(r: Rect, s: Side, along: number): Pt {
  switch (s) {
    case 'left': return { x: r.x, y: r.y + r.h * along }
    case 'right': return { x: r.x + r.w, y: r.y + r.h * along }
    case 'top': return { x: r.x + r.w * along, y: r.y }
    default: return { x: r.x + r.w * along, y: r.y + r.h }
  }
}

/** the range a shared corridor may sit in without either end doubling back over its block */
function interval(pv: number, dp: number, qv: number, dq: number): [number, number] | null {
  let lo = -Infinity, hi = Infinity
  for (const [v, d] of [[pv, dp], [qv, dq]] as const) {
    if (d > 0) lo = Math.max(lo, v)
    if (d < 0) hi = Math.min(hi, v)
  }
  return lo > hi ? null : [lo, hi]
}

function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && near(last.x, p.x) && near(last.y, p.y)) continue
    out.push(p)
  }
  for (let i = out.length - 2; i > 0; i--) {
    const a = out[i - 1], b = out[i], c = out[i + 1]
    if ((near(a.x, b.x) && near(b.x, c.x)) || (near(a.y, b.y) && near(b.y, c.y))) out.splice(i, 1)
  }
  return out
}

/**
 * `corridor` is the one segment of a wire that is free to slide sideways. `v` is where it
 * sits, `min`/`max` how far it may slide before it folds back over a block, and `lo`/`hi` how
 * far it runs — two corridors only need separating if their runs actually overlap.
 */
export interface Corridor { axis: 'x' | 'y'; v: number; min: number; max: number; lo: number; hi: number }
export interface Wire { pts: Pt[]; corridor?: Corridor }

const span = (a: number, b: number) => ({ lo: Math.min(a, b), hi: Math.max(a, b) })

/** every ordering of n slots — only ever called with n <= 4 */
function permutations(n: number): number[][] {
  if (n <= 1) return [[0]]
  const out: number[][] = []
  for (const rest of permutations(n - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n - 1, ...rest.slice(i)])
  return out
}

/**
 * One wire between two sockets. `lane` overrides the shared corridor's position — that is
 * how two wires running the same way get pulled apart.
 */
export function wire(a: Pt, sa: Side, b: Pt, sb: Side, lane?: number): Wire {
  const p = { x: a.x + DX[sa] * STUB, y: a.y + DY[sa] * STUB }
  const q = { x: b.x + DX[sb] * STUB, y: b.y + DY[sb] * STUB }
  const ha = isH(sa), hb = isH(sb)

  if (ha === hb) {
    // both sideways or both up/down: one shared corridor across the middle
    const pv = ha ? p.x : p.y
    const qv = ha ? q.x : q.y
    const iv = interval(pv, ha ? DX[sa] : DY[sa], qv, ha ? DX[sb] : DY[sb])
    if (iv) {
      // Both ends leaving the same way puts the ideal corridor exactly on its own bound, i.e.
      // hugging the blocks. Push it clear so the loop looks deliberate.
      const oneSided = iv[0] === -Infinity || iv[1] === Infinity
      const wanted = oneSided
        ? iv[1] === Infinity ? iv[0] + DODGE : iv[1] - DODGE
        : (pv + qv) / 2
      const v = clamp(lane ?? wanted, iv[0], iv[1])
      const pts = ha
        ? [a, p, { x: v, y: p.y }, { x: v, y: q.y }, q, b]
        : [a, p, { x: p.x, y: v }, { x: q.x, y: v }, q, b]
      const run = ha ? span(p.y, q.y) : span(p.x, q.x)
      return { pts: simplify(pts), corridor: { axis: ha ? 'x' : 'y', v, min: iv[0], max: iv[1], ...run } }
    }
    // sides face apart: step off both blocks first, then meet on a lane between them
    const bounds = ha ? span(p.y, q.y) : span(p.x, q.x)
    const w = clamp(lane ?? (bounds.lo + bounds.hi) / 2, bounds.lo, bounds.hi)
    const pts = ha
      ? [a, p, { x: p.x, y: w }, { x: q.x, y: w }, q, b]
      : [a, p, { x: w, y: p.y }, { x: w, y: q.y }, q, b]
    return {
      pts: simplify(pts),
      corridor: {
        axis: ha ? 'y' : 'x', v: w, min: bounds.lo, max: bounds.hi,
        ...(ha ? span(p.x, q.x) : span(p.y, q.y)),
      },
    }
  }

  // one sideways, one up/down: a single corner, when it lies ahead of both ends
  const corner = ha ? { x: q.x, y: p.y } : { x: p.x, y: q.y }
  const okA = ha ? (q.x - p.x) * DX[sa] >= 0 : (q.y - p.y) * DY[sa] >= 0
  const okB = ha ? (p.y - q.y) * DY[sb] >= 0 : (p.x - q.x) * DX[sb] >= 0
  if (okA && okB && lane === undefined) return { pts: simplify([a, p, corner, q, b]) }

  // otherwise step clear of both blocks and cross on a lane
  const out = ha ? DX[sa] : DY[sa]
  const base = (ha ? p.x : p.y) + out * DODGE
  const v = lane ?? base
  const w = ha ? q.y + DY[sb] * STUB : q.x + DX[sb] * STUB
  const pts = ha
    ? [a, p, { x: v, y: p.y }, { x: v, y: w }, { x: q.x, y: w }, q, b]
    : [a, p, { x: p.x, y: v }, { x: w, y: v }, { x: w, y: q.y }, q, b]
  return {
    pts: simplify(pts),
    corridor: {
      axis: ha ? 'x' : 'y', v,
      min: out > 0 ? ha ? p.x : p.y : -Infinity,
      max: out > 0 ? Infinity : ha ? p.x : p.y,
      ...(ha ? span(p.y, w) : span(p.x, w)),
    },
  }
}

const overlaps = (a: Pt, b: Pt, r: Rect) =>
  Math.max(a.x, b.x) > r.x - MARGIN && Math.min(a.x, b.x) < r.x + r.w + MARGIN &&
  Math.max(a.y, b.y) > r.y - MARGIN && Math.min(a.y, b.y) < r.y + r.h + MARGIN

export function cost(pts: Pt[], obstacles: { r: Rect; w: number }[]): number {
  let c = (pts.length - 2) * BEND
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    c += Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
    for (const o of obstacles) if (overlaps(a, b, o.r)) c += o.w
  }
  return c
}

export function length(pts: Pt[]): number {
  let n = 0
  for (let i = 1; i < pts.length; i++) n += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y)
  return n
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * Rounded orthogonal path; a straight run stays one straight line. `hops` are points where
 * this wire crosses another and should arc over it — the little bridge that tells you the two
 * lines do not meet. Hops are only honoured on horizontal runs, which keeps the choice of who
 * hops over whom consistent across the whole diagram.
 */
export function toPath(pts: Pt[], hops: Pt[] = []): string {
  const corner = (a: Pt, c: Pt, b: Pt) =>
    Math.min(RADIUS, Math.hypot(c.x - a.x, c.y - a.y) / 2, Math.hypot(b.x - c.x, b.y - c.y) / 2)

  let d = 'M' + round(pts[0].x) + ',' + round(pts[0].y)
  let from = pts[0]

  for (let i = 1; i < pts.length; i++) {
    const c = pts[i]
    const last = i === pts.length - 1
    const r = last ? 0 : corner(pts[i - 1], c, pts[i + 1])
    // where this straight run ends: short of the corner by its radius
    const len = Math.hypot(c.x - from.x, c.y - from.y) || 1
    const ux = (c.x - from.x) / len, uy = (c.y - from.y) / len
    const stop = { x: c.x - ux * r, y: c.y - uy * r }

    if (uy === 0 && hops.length) {
      const dir = Math.sign(ux)
      const on = hops
        .filter((h) => near(h.y, from.y) && (h.x - from.x) * dir > BRIDGE && (stop.x - h.x) * dir > BRIDGE)
        .sort((p, q) => (p.x - q.x) * dir)
      for (const h of on) {
        d += 'L' + round(h.x - dir * BRIDGE) + ',' + round(h.y)
        // sweep chosen so the arc always bulges upward, whichever way the wire runs
        d += 'A' + BRIDGE + ' ' + BRIDGE + ' 0 0 ' + (dir > 0 ? 1 : 0) + ' ' + round(h.x + dir * BRIDGE) + ',' + round(h.y)
      }
    }

    d += 'L' + round(stop.x) + ',' + round(stop.y)
    if (!last) {
      const nx = pts[i + 1]
      const nl = Math.hypot(nx.x - c.x, nx.y - c.y) || 1
      const out = { x: c.x + ((nx.x - c.x) / nl) * r, y: c.y + ((nx.y - c.y) / nl) * r }
      d += 'Q' + round(c.x) + ',' + round(c.y) + ' ' + round(out.x) + ',' + round(out.y)
      from = out
    }
  }
  return d
}

/**
 * Where each wire crosses another. Horizontal runs hop over vertical ones — one rule, applied
 * everywhere, so a crossing never gets two bridges or none.
 */
export function bridges(wires: { id: string; pts: Pt[] }[]): Map<string, Pt[]> {
  const hs: { id: string; y: number; lo: number; hi: number }[] = []
  const vs: { id: string; x: number; lo: number; hi: number }[] = []
  for (const w of wires)
    for (let i = 1; i < w.pts.length; i++) {
      const a = w.pts[i - 1], b = w.pts[i]
      if (near(a.y, b.y)) hs.push({ id: w.id, y: a.y, ...span(a.x, b.x) })
      else if (near(a.x, b.x)) vs.push({ id: w.id, x: a.x, ...span(a.y, b.y) })
    }

  const out = new Map<string, Pt[]>()
  for (const h of hs)
    for (const v of vs) {
      if (v.id === h.id) continue
      // a proper crossing only: touching at a shared endpoint is not something to hop over
      if (v.x <= h.lo + BRIDGE || v.x >= h.hi - BRIDGE) continue
      if (h.y <= v.lo + BRIDGE || h.y >= v.hi - BRIDGE) continue
      const list = out.get(h.id)
      if (list) list.push({ x: v.x, y: h.y })
      else out.set(h.id, [{ x: v.x, y: h.y }])
    }

  // A wire crossing a handful of others reads better with hops. One crossing twenty of them
  // turns into a comb of bumps that hides the line itself — leave those plain.
  for (const [id, hops] of out) if (hops.length > MAX_BRIDGES) out.delete(id)
  return out
}

/** the cardinality mark, pushed along and off the wire so the line never crosses the glyph */
function mark(pts: Pt[], start: boolean): Pt {
  const a = start ? pts[0] : pts[pts.length - 1]
  const b = start ? pts[1] : pts[pts.length - 2]
  const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y)
  return dx !== 0
    ? { x: a.x + dx * 16, y: a.y - 7 }
    : { x: a.x + 10, y: a.y + dy * 16 + 3.5 }
}

/**
 * Plans every wire at once. Blocks that are not this wire's own ends are obstacles; group
 * boxes are softer obstacles, except the two the wire's ends live in.
 */
export function planRoutes(rects: Map<string, Rect>, links: Link[]): Map<string, Route> {
  const live = links.filter((l) => rects.has(l.source) && rects.has(l.target))
  const entries = [...rects]

  const obstaclesFor = (l: Link) => {
    const sp = rects.get(l.source)!.parent, tp = rects.get(l.target)!.parent
    const list: { r: Rect; w: number }[] = []
    for (const [id, r] of entries) {
      if (r.box) {
        if (id !== sp && id !== tp) list.push({ r, w: BLOCK_BOX })
      } else if (id !== l.source && id !== l.target) {
        list.push({ r, w: BLOCK_CARD })
      }
    }
    return list
  }

  // 1. which side of each block to use — decided by what the wire would actually cost
  const chosen = new Map<string, { sa: Side; sb: Side }>()
  for (const l of live) {
    const A = rects.get(l.source)!, B = rects.get(l.target)!
    const obs = obstaclesFor(l)
    let best: { sa: Side; sb: Side } = { sa: 'right', sb: 'left' }
    let bestCost = Infinity
    for (const sa of SIDES) {
      for (const sb of SIDES) {
        const c = cost(wire(sidePoint(A, sa, 0.5), sa, sidePoint(B, sb, 0.5), sb).pts, obs)
        if (c < bestCost - 0.001) { bestCost = c; best = { sa, sb } }
      }
    }
    chosen.set(l.id, best)
  }

  // 2. one socket per wire on each side, ordered by where the far end lies, so wires leaving
  //    the same block neither share a point nor cross each other on the way out
  const buckets = new Map<string, { id: string; end: 'a' | 'b'; key: number }[]>()
  for (const l of live) {
    const { sa, sb } = chosen.get(l.id)!
    const A = rects.get(l.source)!, B = rects.get(l.target)!
    const push = (node: string, side: Side, other: Rect, end: 'a' | 'b') => {
      const k = node + '|' + side
      const key = isH(side) ? other.y + other.h / 2 : other.x + other.w / 2
      const list = buckets.get(k)
      if (list) list.push({ id: l.id, end, key })
      else buckets.set(k, [{ id: l.id, end, key }])
    }
    push(l.source, sa, B, 'a')
    push(l.target, sb, A, 'b')
  }

  const along = new Map<string, number>()
  for (const list of buckets.values()) {
    list.sort((x, y) => x.key - y.key || x.id.localeCompare(y.id))
    list.forEach((e, i) => along.set(e.id + '|' + e.end, (i + 1) / (list.length + 1)))
  }

  // 3. build the wires, then pull apart any that ended up sharing a corridor
  const built = live.map((l) => {
    const sides = chosen.get(l.id)!
    const a = sidePoint(rects.get(l.source)!, sides.sa, along.get(l.id + '|a') ?? 0.5)
    const b = sidePoint(rects.get(l.target)!, sides.sb, along.get(l.id + '|b') ?? 0.5)
    return { l, sa: sides.sa, sb: sides.sb, a, b, w: wire(a, sides.sa, b, sides.sb) }
  })

  /*
   * Pull apart corridors that run alongside each other. Bucketing by `round(v / LANE)` missed
   * pairs that straddled a bucket edge, and spreading symmetrically around the mean was undone
   * by the clamp whenever a corridor could only move one way — two wires 5px apart stayed 5px
   * apart. Cluster by real proximity instead, and spread in the direction they can actually go.
   */
  for (const axis of ['x', 'y'] as const) {
    const onAxis = built
      .filter((e) => e.w.corridor?.axis === axis)
      .sort((p, q) => p.w.corridor!.v - q.w.corridor!.v)

    let i = 0
    while (i < onAxis.length) {
      // grow a cluster while the next corridor is within a lane AND its run overlaps one already in
      const cluster = [onAxis[i]]
      let j = i + 1
      while (j < onAxis.length) {
        const c = onAxis[j].w.corridor!
        const near = c.v - cluster[cluster.length - 1].w.corridor!.v < LANE
        const overlaps = cluster.some((e) => c.lo < e.w.corridor!.hi && c.hi > e.w.corridor!.lo)
        if (!near || !overlaps) break
        cluster.push(onAxis[j])
        j++
      }
      i = j
      if (cluster.length < 2) continue

      // a corridor pinned on one side can only spread away from that side
      const upOnly = cluster.every((e) => e.w.corridor!.max === Infinity)
      const downOnly = cluster.every((e) => e.w.corridor!.min === -Infinity)
      const vs = cluster.map((e) => e.w.corridor!.v)
      const start = upOnly ? Math.max(...vs) : downOnly ? Math.min(...vs) : (Math.min(...vs) + Math.max(...vs)) / 2
      const step = downOnly ? -LANE : LANE
      const from = upOnly || downOnly ? start : start - (step * (cluster.length - 1)) / 2

      /*
       * Which wire gets which lane decides whether they cross. Two wires leaving the same
       * block and peeling off at different heights only stay apart if the one travelling
       * furthest takes the lane nearest its source — put them the other way round and the
       * shorter one has to cut across the longer one's corridor. Rather than encode that as a
       * rule, try the orderings and keep the one that actually crosses least.
       * ponytail: brute force, capped at 4 wires a cluster (24 orders); needs a real bus
       * router only if clusters ever get big enough for that to show up in a frame.
       */
      const slots = cluster.map((_, n) => from + n * step)
      const rest = built.filter((e) => !cluster.includes(e)).map((e) => ({ id: e.l.id, pts: e.w.pts }))
      const orders = cluster.length <= 4 ? permutations(cluster.length) : [cluster.map((_, n) => n)]

      let bestPts: Pt[][] | null = null
      let bestScore = Infinity
      for (const order of orders) {
        const made = cluster.map((e, n) => wire(e.a, e.sa, e.b, e.sb, slots[order[n]]).pts)
        // a lane that shoves a wire into a block is never worth a saved crossing
        const intoBlock = made.some((pts, n) => {
          const obs = obstaclesFor(cluster[n].l)
          return cost(pts, obs) > cost(cluster[n].w.pts, obs) + LANE * 4
        })
        if (intoBlock) continue
        const wires = [...rest, ...made.map((pts, n) => ({ id: cluster[n].l.id, pts }))]
        let score = 0
        for (const hops of bridges(wires).values()) score += hops.length
        // tie-break on total length so a pointless reshuffle keeps the tidier layout
        for (const pts of made) score += length(pts) / 100000
        if (score < bestScore) { bestScore = score; bestPts = made }
      }
      if (bestPts) cluster.forEach((e, n) => { e.w = { ...e.w, pts: bestPts![n] } })
    }
  }

  const hops = bridges(built.map((e) => ({ id: e.l.id, pts: e.w.pts })))

  const out = new Map<string, Route>()
  for (const e of built) {
    const pts = e.w.pts
    out.set(e.l.id, {
      sx: e.a.x, sy: e.a.y, tx: e.b.x, ty: e.b.y,
      path: toPath(pts, hops.get(e.l.id)), len: length(pts),
      ls: mark(pts, true), lt: mark(pts, false),
    })
  }
  return out
}
