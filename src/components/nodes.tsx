import {
  BaseEdge,
  Handle,
  Position,
  getSmoothStepPath,
  useInternalNode,
  type EdgeProps,
  type NodeProps,
} from '@xyflow/react'
import { useState } from 'react'
import { groupById } from '../catalog'
import { GROUP_HEADER, NODE_H, NODE_W, PAD } from '../layout'
import type { Card, Problem, Rel, Tech } from '../types'

/* ---------- relationship styling ----------
 * `dash` marks a *referential* link — Next.js is built on React, Vitest tests Vite.
 * Solid lines are real runtime dependencies: something requires, reads or deploys something else.
 * Direction is uniform: the arrow points at what you depend on.
 */

export const REL: Record<Rel, { color: string; label: string; dash?: boolean; both?: boolean }> = {
  extends: { color: '#a78bfa', label: 'builds on', dash: true },
  builds: { color: '#a78bfa', label: 'builds', dash: true },
  tests: { color: '#34d399', label: 'tests', dash: true },
  styles: { color: '#f472b6', label: 'styled with', dash: true },
  types: { color: '#60a5fa', label: 'typed by', dash: true },
  monitors: { color: '#fb923c', label: 'monitors', dash: true },
  tracks: { color: '#fb923c', label: 'tracks', dash: true },

  requires: { color: '#22d3ee', label: 'requires' },
  consumes: { color: '#22d3ee', label: 'reads from' },
  queries: { color: '#2dd4bf', label: 'queries', both: true },
  syncs: { color: '#2dd4bf', label: 'syncs with', both: true },
  deploys: { color: '#fbbf24', label: 'deploys' },
  hosts: { color: '#fbbf24', label: 'hosts' },
  orchestrates: { color: '#fbbf24', label: 'orchestrates' },
  automates: { color: '#e879f9', label: 'automates' },

  conflicts: { color: '#ef4444', label: 'incompatible', dash: true, both: true },
}

const CARD_ENDS: Record<Card, [string, string]> = {
  '1-1': ['1', '1'],
  '1-n': ['1', '∗'],
  'n-1': ['∗', '1'],
  'n-n': ['∗', '∗'],
}

/* ---------- brand icon, falls back to initials when the slug is wrong or offline ---------- */

function Icon({ tech }: { tech: Tech }) {
  const [failed, setFailed] = useState(false)
  const initials = tech.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()

  if (!tech.icon || failed)
    return (
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-[9px] font-bold"
        style={{ background: tech.color + '33', color: tech.color }}
      >
        {initials}
      </span>
    )

  return (
    <img
      src={`https://cdn.simpleicons.org/${tech.icon}/${tech.color.replace('#', '')}`}
      alt=""
      width={20}
      height={20}
      className="h-5 w-5 shrink-0"
      onError={() => setFailed(true)}
    />
  )
}

/* ---------- tech block ---------- */

export interface TechData extends Record<string, unknown> {
  tech: Tech
  problems: Problem[]
  dimmed: boolean
  active: boolean
  onHover: (id: string | null) => void
  onRemove: (id: string) => void
}

export function TechNode({ data }: NodeProps & { data: TechData }) {
  const { tech, problems, dimmed, active, onHover, onRemove } = data
  const error = problems.some((p) => p.severity === 'error')
  const warn = !error && problems.length > 0

  // opaque on purpose: wires pass behind the card, never through the text
  const ring = error ? '#ef4444' : warn ? '#f59e0b' : active ? tech.color : null

  return (
    <div
      className="group relative rounded-lg px-2.5 py-2 transition-opacity"
      onMouseEnter={() => onHover(tech.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        width: NODE_W,
        height: NODE_H,
        opacity: dimmed ? 0.14 : 1,
        background: '#171b22',
        boxShadow: ring
          ? `0 0 0 1.5px ${ring}, 0 0 16px -3px ${ring}, 0 2px 6px rgba(0,0,0,0.6)`
          : '0 2px 6px rgba(0,0,0,0.5)',
      }}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />

      <button
        title={`Remove ${tech.name}`}
        onClick={(e) => { e.stopPropagation(); onRemove(tech.id) }}
        className="absolute -right-2 -top-2 z-20 hidden h-[18px] w-[18px] items-center justify-center rounded-full bg-[#2a3038] text-white/70 shadow-md ring-1 ring-black/40 hover:bg-red-500 hover:text-white group-hover:flex"
      >
        <svg viewBox="0 0 16 16" width="9" height="9" aria-hidden="true">
          <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      <div className="flex items-center gap-2">
        <Icon tech={tech} />
        <span className="truncate text-[12px] font-semibold text-white/90">{tech.name}</span>
        {(error || warn) && (
          <span className={`ml-auto text-[11px] leading-none ${error ? 'text-red-400' : 'text-amber-400'}`}>!</span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {tech.langs.slice(0, 3).map((l) => (
          <span key={l} className="rounded bg-white/[0.07] px-1 py-px text-[9px] uppercase tracking-wide text-white/45">
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------- group box ---------- */

export interface GroupData extends Record<string, unknown> {
  groupId: string
  sections: { name: string; y: number }[]
  dimmed: boolean
}

export function GroupNode({ data }: NodeProps & { data: GroupData }) {
  const group = groupById.get(data.groupId)!
  return (
    <div
      className="h-full w-full rounded-2xl transition-opacity"
      style={{
        // one box only: black fill, coloured edge, coloured glow. Translucent so wires
        // crossing underneath stay traceable instead of vanishing.
        background: 'rgba(4, 6, 9, 0.82)',
        border: `1px solid ${group.color}66`,
        boxShadow: `0 0 26px -4px ${group.color}55`,
        opacity: data.dimmed ? 0.28 : 1,
      }}
    >
      <div
        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest"
        style={{ height: GROUP_HEADER, paddingLeft: PAD, color: group.color }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: group.color }} />
        {group.name}
      </div>
      {data.sections.map((s) => (
        <div
          key={s.name}
          className="absolute text-[9px] font-semibold uppercase tracking-wider text-white/30"
          style={{ left: PAD, top: s.y + 6 }}
        >
          {s.name}
        </div>
      ))}
    </div>
  )
}

/* ---------- floating edge: attaches to whichever side faces the other block ---------- */

interface Rect { x: number; y: number; w: number; h: number }

const rectOf = (n: {
  internals: { positionAbsolute: { x: number; y: number } }
  measured?: { width?: number | null; height?: number | null }
}): Rect => ({
  x: n.internals.positionAbsolute.x,
  y: n.internals.positionAbsolute.y,
  w: n.measured?.width ?? NODE_W,
  h: n.measured?.height ?? NODE_H,
})

/**
 * Connection points per side, DaVinci style: a card exposes 7 sockets along the top and
 * bottom and 3 down each side. Each edge lands on its own socket, so two wires leaving the
 * same card no longer trace the same line.
 */
const SLOTS: Record<Position, number> = {
  [Position.Top]: 7,
  [Position.Bottom]: 7,
  [Position.Left]: 3,
  [Position.Right]: 3,
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** how far apart two blocks must be before a wire uses the outermost socket */
const SPREAD = 460

/**
 * Which side of `a` faces `b`, then which socket on that side — chosen by *proximity*, not
 * at random: a block up and to the right attaches near the top of the right edge, one below
 * attaches near the bottom. Wires to different places therefore leave from different points
 * in the same order as their destinations, which is what stops them crossing each other.
 */
function anchor(a: Rect, b: Rect): [number, number, Position] {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2
  const bx = b.x + b.w / 2, by = b.y + b.h / 2
  const dx = bx - ax, dy = by - ay

  const side: Position =
    Math.abs(dx) * a.h > Math.abs(dy) * a.w
      ? dx > 0 ? Position.Right : Position.Left
      : dy > 0 ? Position.Bottom : Position.Top

  const n = SLOTS[side]
  const vertical = side === Position.Left || side === Position.Right
  const t = 0.5 + clamp((vertical ? dy : dx) / SPREAD, -0.5, 0.5)
  const slot = Math.round(t * (n - 1)) // 0 … n-1, ordered by where the other block lies
  const along = (slot + 1) / (n + 1)

  switch (side) {
    case Position.Right: return [a.x + a.w, a.y + a.h * along, side]
    case Position.Left: return [a.x, a.y + a.h * along, side]
    case Position.Bottom: return [a.x + a.w * along, a.y + a.h, side]
    default: return [a.x + a.w * along, a.y, side]
  }
}

/** nudge the cardinality mark just off the block edge */
const nudge = (p: Position, x: number, y: number): [number, number] =>
  p === Position.Left ? [x - 9, y - 4] : p === Position.Right ? [x + 9, y - 4] : p === Position.Top ? [x, y - 7] : [x, y + 13]

export interface RelEdgeData extends Record<string, unknown> {
  rel: Rel
  card?: Card
  /** mutual dependency: arrowheads and travelling dots in both directions */
  both?: boolean
  active: boolean
  dimmed: boolean
}

export function RelEdge({ id, source, target, markerEnd, data }: EdgeProps & { data?: RelEdgeData }) {
  const s = useInternalNode(source)
  const t = useInternalNode(target)
  if (!s || !t || !data) return null

  // Deterministic per-edge seed: picks the socket on each card and fans the elbow out, so two
  // links between the same pair of boxes never trace the identical polyline.
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0

  const sr = rectOf(s), tr = rectOf(t)
  const [sx, sy, sourcePosition] = anchor(sr, tr)
  const [tx, ty, targetPosition] = anchor(tr, sr)
  // small deterministic variation in the elbow distance, so two wires that do share a
  // corridor still separate rather than overprinting
  const offset = 16 + (Math.abs(h) % 5) * 9

  const [path] = getSmoothStepPath({
    sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
    sourcePosition, targetPosition, borderRadius: 12, offset,
  })
  const style = REL[data.rel]
  const ends = data.card ? CARD_ENDS[data.card] : null
  const [slx, sly] = nudge(sourcePosition, sx, sy)
  const [tlx, tly] = nudge(targetPosition, tx, ty)
  const opacity = data.dimmed ? 0.06 : data.active ? 1 : 0.4

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        /* without this React Flow lays a 20px invisible hit path over the blocks and eats their clicks */
        interactionWidth={0}
        style={{
          stroke: style.color,
          strokeWidth: data.active ? 2.2 : 1.2,
          strokeDasharray: style.dash ? '6 4' : undefined,
          opacity,
        }}
      />

      {ends && !data.dimmed && (
        <g fill={style.color} fontSize="10" fontWeight="700" textAnchor="middle" opacity={opacity}>
          <text x={slx} y={sly}>{ends[0]}</text>
          <text x={tlx} y={tly}>{ends[1]}</text>
        </g>
      )}

      {/* travelling dots exist only while this edge is selected; a mutual link flows both ways */}
      {data.active && (
        <>
          <circle r="4" fill={style.color}>
            <animateMotion dur="1.6s" repeatCount="indefinite" path={path} />
          </circle>
          {data.both && (
            <circle r="4" fill={style.color}>
              <animateMotion
                dur="1.6s"
                repeatCount="indefinite"
                path={path}
                keyPoints="1;0"
                keyTimes="0;1"
                calcMode="linear"
              />
            </circle>
          )}
        </>
      )}
    </>
  )
}

export const nodeTypes = { tech: TechNode, group: GroupNode }
export const edgeTypes = { rel: RelEdge }
