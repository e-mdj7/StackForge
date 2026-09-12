/**
 * Alignment snapping for a dragged box.
 *
 * Every box offers three lines per axis — near edge, centre, far edge. While something is
 * being dragged we look for the closest pairing between its three and every other box's
 * three; if the best one lands within `tol` the box moves onto that line and we report the
 * guide to draw. Both axes are decided independently, so a box can snap left-aligned to one
 * neighbour and centred against another at the same time.
 *
 * No @xyflow import on purpose — same reason as routing.ts: this stays plain geometry so it
 * can be unit-tested without a DOM.
 */

export interface Box { x: number; y: number; w: number; h: number }

export interface Guide {
  axis: 'x' | 'y'
  /** flow coordinate of the line */
  at: number
  /** drawn only across the boxes it actually relates, not the full width of the canvas */
  from: number
  to: number
}

export interface Snapped {
  x: number
  y: number
  guides: Guide[]
}

/** the three lines a box offers on each axis */
const linesX = (b: Box) => [b.x, b.x + b.w / 2, b.x + b.w]
const linesY = (b: Box) => [b.y, b.y + b.h / 2, b.y + b.h]

/** a line counts as sitting "on" a guide when it is within half a pixel of it */
const ON = 0.5

/** the closest edge pairing within tolerance, or null when nothing is near enough */
function closest(mine: number[], peers: Box[], lines: (b: Box) => number[], tol: number) {
  let hit: { delta: number; at: number } | null = null
  for (const peer of peers) {
    for (const theirs of lines(peer)) {
      for (const own of mine) {
        const delta = theirs - own
        if (Math.abs(delta) <= tol && (!hit || Math.abs(delta) < Math.abs(hit.delta))) {
          hit = { delta, at: theirs }
        }
      }
    }
  }
  return hit
}

/** how far the guide has to reach to touch every box sitting on it */
function span(
  axis: 'x' | 'y',
  at: number,
  boxes: Box[],
  lines: (b: Box) => number[],
  extent: (b: Box) => [number, number],
): Guide {
  let from = Infinity
  let to = -Infinity
  for (const b of boxes) {
    if (!lines(b).some((l) => Math.abs(l - at) < ON)) continue
    const [a, z] = extent(b)
    from = Math.min(from, a)
    to = Math.max(to, z)
  }
  return { axis, at, from, to }
}

/**
 * Snap `moving` onto whichever of `peers` it is nearly aligned with.
 * `tol` is in the same units as the boxes — callers working in flow space should divide
 * their pixel tolerance by the zoom, so the pull feels the same however far you are zoomed in.
 */
export function snap(moving: Box, peers: Box[], tol: number): Snapped {
  const hx = closest(linesX(moving), peers, linesX, tol)
  const hy = closest(linesY(moving), peers, linesY, tol)

  const moved: Box = { ...moving, x: moving.x + (hx?.delta ?? 0), y: moving.y + (hy?.delta ?? 0) }
  const all = [moved, ...peers]

  const guides: Guide[] = []
  if (hx) guides.push(span('x', hx.at, all, linesX, (b) => [b.y, b.y + b.h]))
  if (hy) guides.push(span('y', hy.at, all, linesY, (b) => [b.x, b.x + b.w]))

  return { x: moved.x, y: moved.y, guides }
}
