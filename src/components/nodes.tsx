import {
  BaseEdge,
  Handle,
  Position,
  type EdgeProps,
  type NodeProps,
} from '@xyflow/react'
import { useState } from 'react'
import { groupById } from '../catalog'
import { GROUP_HEADER, NODE_H, NODE_W, PAD } from '../layout'
import type { Route } from '../routing'
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

  /* The three solid data links used to be cyan, the same cyan, and a teal ten degrees off it,
     which made them unreadable side by side. They are a hue apart each now — cyan, lime,
     indigo — and no closer than 50° to any other solid line (amber deploys, fuchsia
     automates). The dashed families keep their colours; a dash already separates them. */
  requires: { color: '#22d3ee', label: 'requires' },
  consumes: { color: '#a3e635', label: 'reads from' },
  queries: { color: '#818cf8', label: 'queries', both: true },
  syncs: { color: '#818cf8', label: 'syncs with', both: true },
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

/* ---------- drag ghost ----------
 * The block you grab never moves. React Flow reports the position it *would* take — already
 * clamped to its parent box — and App renders that spot as this outline. On release the real
 * block is committed here and the ghost goes away.
 */

export interface GhostData extends Record<string, unknown> {
  color: string
  label: string
}

export function GhostNode({ data }: NodeProps & { data: GhostData }) {
  return (
    <div
      className="pointer-events-none flex h-full w-full items-center justify-center rounded-md"
      style={{
        border: `2px dashed ${data.color}`,
        background: `${data.color}1f`,
        boxShadow: `0 0 22px -6px ${data.color}`,
      }}
    >
      <span
        className="truncate px-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: data.color }}
      >
        {data.label}
      </span>
    </div>
  )
}

/* ---------- wires: geometry comes from planRoutes(), this only paints it ---------- */

export interface RelEdgeData extends Record<string, unknown> {
  rel: Rel
  card?: Card
  /** mutual dependency: arrowheads and travelling dots in both directions */
  both?: boolean
  active: boolean
  dimmed: boolean
  /** geometry planned in App against every block and every other wire */
  route?: Route
}

export function RelEdge({ id, markerStart, markerEnd, data }: EdgeProps & { data?: RelEdgeData }) {
  if (!data?.route) return null
  const { route } = data
  const style = REL[data.rel]
  const ends = data.card ? CARD_ENDS[data.card] : null
  const opacity = data.dimmed ? 0.06 : data.active ? 1 : 0.4
  // one speed for every wire: a short hop no longer looks like the dot bouncing on the spot
  const dur = Math.min(3.4, Math.max(0.7, route.len / 190)).toFixed(2) + 's'

  return (
    <>
      <BaseEdge
        id={id}
        path={route.path}
        /* a mutual link is arrowed at both ends — queries, syncs, incompatible */
        markerStart={markerStart}
        markerEnd={markerEnd}
        /* without this React Flow lays a 20px invisible hit path over the blocks and eats their clicks */
        interactionWidth={0}
        style={{
          stroke: style.color,
          strokeWidth: data.active ? 2.2 : 1.2,
          strokeDasharray: style.dash ? '6 4' : undefined,
          opacity,
          fill: 'none',
        }}
      />

      {ends && !data.dimmed && (
        /* the halo keeps the mark readable even where a wire does pass under it */
        <g
          fill={style.color}
          stroke="#0b0d10"
          strokeWidth="3"
          paintOrder="stroke"
          fontSize="10"
          fontWeight="700"
          textAnchor="middle"
          opacity={opacity}
        >
          <text x={route.ls.x} y={route.ls.y}>{ends[0]}</text>
          <text x={route.lt.x} y={route.lt.y}>{ends[1]}</text>
        </g>
      )}

      {/* travelling dots exist only while this edge is selected; a mutual link flows both ways */}
      {data.active && (
        <>
          <circle r="4" fill={style.color}>
            <animateMotion dur={dur} repeatCount="indefinite" path={route.path} />
          </circle>
          {data.both && (
            <circle r="4" fill={style.color}>
              <animateMotion
                dur={dur}
                repeatCount="indefinite"
                path={route.path}
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

export const nodeTypes = { tech: TechNode, group: GroupNode, ghost: GhostNode }
export const edgeTypes = { rel: RelEdge }
