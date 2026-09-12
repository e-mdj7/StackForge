import { groups } from './catalog'
import type { Tech } from './types'

export const NODE_W = 168
export const NODE_H = 62
export const GAP = 14
export const COLS = 2
export const PAD = 22
export const GROUP_HEADER = 38
export const SECTION_HEADER = 24
export const GROUP_W = COLS * NODE_W + (COLS - 1) * GAP + PAD * 2
export const GROUP_GAP = 64
/** group boxes per canvas row */
export const ROW_LEN = 5

export interface Box {
  groupId: string
  x: number
  y: number
  w: number
  h: number
  /** section label + its y offset inside the box, for the group node to render */
  sections: { name: string; y: number }[]
}

export interface Placed {
  techId: string
  groupId: string
  /** relative to the parent box */
  x: number
  y: number
}

/**
 * How many boxes per row best matches the shape of the canvas. A fixed count left a
 * huge dead margin on wide screens; this tries every option and keeps the closest fit.
 */
function bestColumns(count: number, boxHeights: number[], canvasW: number, canvasH: number): number {
  if (count <= 1) return 1

  // Pick the arrangement the viewport can show LARGEST. Matching the aspect ratio was the
  // wrong objective: on an ultrawide it chose a tall grid that fitView then had to shrink to
  // fit vertically, leaving hundreds of dead pixels down the right-hand side.
  let best = 1
  let bestScale = 0

  for (let cols = 1; cols <= count; cols++) {
    const w = cols * GROUP_W + (cols - 1) * GROUP_GAP
    let h = 0
    for (let i = 0; i < count; i += cols) h += Math.max(...boxHeights.slice(i, i + cols)) + GROUP_GAP
    h -= GROUP_GAP

    const scale = Math.min(canvasW / Math.max(w, 1), canvasH / Math.max(h, 1))
    if (scale > bestScale + 0.001) {
      bestScale = scale
      best = cols
    }
  }
  return best
}

/**
 * Auto-arranges only the boxes and blocks that exist. Groups keep their declared
 * dataflow order left to right so arrows mostly run one way instead of tangling.
 */
export function layout(
  added: Tech[],
  canvasW = 1600,
  canvasH = 900,
): { boxes: Box[]; placed: Placed[] } {
  const byGroup = new Map<string, Tech[]>()
  for (const t of added) {
    const list = byGroup.get(t.group)
    if (list) list.push(t)
    else byGroup.set(t.group, [t])
  }

  const active = groups.filter((g) => byGroup.has(g.id)).sort((a, b) => a.order - b.order)

  // measure every box once, so the column count can be chosen from real heights
  const measured = active.map((g) => {
    const members = byGroup.get(g.id)!
    let y = GROUP_HEADER
    const sections: Box['sections'] = []
    const slots: { techId: string; x: number; y: number }[] = []

    for (const name of g.sections) {
      const inSection = members.filter((t) => t.section === name)
      if (!inSection.length) continue

      sections.push({ name, y })
      y += SECTION_HEADER

      inSection.forEach((t, n) => {
        slots.push({
          techId: t.id,
          x: PAD + (n % COLS) * (NODE_W + GAP),
          y: y + Math.floor(n / COLS) * (NODE_H + GAP),
        })
      })
      y += Math.ceil(inSection.length / COLS) * (NODE_H + GAP)
    }

    // drop the trailing gap so the bottom margin equals the left/right one exactly
    return { group: g, sections, slots, h: y - GAP + PAD }
  })

  const cols = bestColumns(measured.length, measured.map((m) => m.h), canvasW, canvasH)

  const boxes: Box[] = []
  const placed: Placed[] = []
  let rowY = 0

  for (let i = 0; i < measured.length; i += cols) {
    const row = measured.slice(i, i + cols)
    let rowH = 0

    row.forEach((m, col) => {
      boxes.push({
        groupId: m.group.id,
        x: col * (GROUP_W + GROUP_GAP),
        y: rowY,
        w: GROUP_W,
        h: m.h,
        sections: m.sections,
      })
      for (const s of m.slots) placed.push({ ...s, groupId: m.group.id })
      rowH = Math.max(rowH, m.h)
    })

    rowY += rowH + GROUP_GAP
  }

  return { boxes, placed }
}
