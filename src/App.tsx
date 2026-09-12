import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useReactFlow,
  useStore,
  useStoreApi,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { groupById, stackRules, techById } from './catalog'
import { GhostNode, GroupNode, REL, RelEdge, TechNode } from './components/nodes'
import { DeleteGuard, Drawer, Inspector, NeedsPanel, Palette, TopBar, UndoToast } from './components/panels'
import { NODE_H, NODE_W, layout } from './layout'
import { planRoutes, type Rect } from './routing'
import { analyze } from './rules'
import { snap, type Guide } from './snap'
import { matchesHighlight, useStack } from './store'
import type { Tech } from './types'

/** how close, in screen pixels, two edges get before the drag pulls them together */
const SNAP_PX = 6
/** the drag preview is a real node, so it needs an id no technology can collide with */
const GHOST_ID = '__ghost'

const nodeTypes = { tech: TechNode, group: GroupNode, ghost: GhostNode } as unknown as NodeTypes
const edgeTypes = { rel: RelEdge } as unknown as EdgeTypes

/**
 * ReactFlow's own `fitView` prop fires at init, before the restored stack has been
 * measured, so it fits an empty canvas. Wait for the real measurements instead.
 */
function FitOnDemand({ tick }: { tick: string }) {
  const { fitView } = useReactFlow()
  // React Flow's own measured pane size. Waiting on a timer after our ResizeObserver was a
  // race — if React Flow had not re-measured yet the fit used the old size and never retried,
  // which is how the bottom of the diagram ended up off-screen. Its store cannot be stale.
  const pane = useStore((s) => `${Math.round(s.width)}x${Math.round(s.height)}`)
  useEffect(() => {
    const id = requestAnimationFrame(() => void fitView({ padding: 0.08 }))
    return () => cancelAnimationFrame(id)
  }, [tick, pane, fitView])
  return null
}

/**
 * The lines that say *why* a drag snapped where it did. ViewportPortal puts them inside the
 * pan/zoom transform, so a guide stays welded to the blocks it relates as the canvas moves.
 * Thickness and overhang are divided by the zoom, so the line stays one crisp pixel whether
 * you are zoomed right in or looking at the whole stack.
 */
function AlignmentGuides({ guides }: { guides?: Guide[] }) {
  const zoom = useStore((s) => s.transform[2])
  if (!guides?.length) return null
  const thick = 1 / zoom
  const over = 10 / zoom

  return (
    <ViewportPortal>
      {guides.map((g) => (
        <div
          key={`${g.axis}${g.at}`}
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            background: '#22d3ee',
            boxShadow: `0 0 ${6 / zoom}px #22d3ee`,
            ...(g.axis === 'x'
              ? { left: g.at, top: g.from - over, width: thick, height: g.to - g.from + over * 2 }
              : { left: g.from - over, top: g.at, width: g.to - g.from + over * 2, height: thick }),
          }}
        />
      ))}
    </ViewportPortal>
  )
}

function Canvas() {
  const { added, nodePos, groupPos, selected, highlight, fitTick, select, setNodePos, setGroupPos, requestRemove } =
    useStack()
  const [toast, setToast] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  /** where the block being dragged would land — null whenever no drag is in flight */
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number; guides: Guide[] } | null>(null)
  const dragging = !!ghost

  const techs = useMemo(() => added.map((id) => techById.get(id)).filter(Boolean) as Tech[], [added])
  const analysis = useMemo(() => analyze(techs, stackRules), [techs])
  const { problems, edges: rel } = analysis
  const canvasRef = useRef<HTMLElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 1600, h: 900 })
  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) =>
      setCanvasSize({ w: e.contentRect.width, h: e.contentRect.height }),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { boxes, placed } = useMemo(
    () => layout(techs, canvasSize.w, canvasSize.h),
    [techs, canvasSize.w, canvasSize.h],
  )

  /** ids connected to the clicked block — everything else fades out */
  const neighbours = useMemo(() => {
    if (!selected) return null
    const set = new Set([selected])
    for (const e of rel) {
      if (e.source === selected) set.add(e.target)
      if (e.target === selected) set.add(e.source)
    }
    return set
  }, [selected, rel])

  const matchesFilter = (t: Tech) => matchesHighlight(t, highlight)

  const isDim = (t: Tech) => !matchesFilter(t) || (!!neighbours && !neighbours.has(t.id))

  const nodes = useMemo<Node[]>(() => {
    const groupNodes: Node[] = boxes.map((b) => {
      const members = techs.filter((t) => t.group === b.groupId)
      return {
        id: `group:${b.groupId}`,
        type: 'group',
        position: groupPos[b.groupId] ?? { x: b.x, y: b.y },
        width: b.w,
        height: b.h,
        style: { width: b.w, height: b.h },
        draggable: true,
        selectable: false,
        /* box 0 < wires 1 < card 2: lines cross the boxes but never the cards */
        zIndex: 0,
        data: { groupId: b.groupId, sections: b.sections, dimmed: members.every(isDim) },
      }
    })

    const techNodes: Node[] = placed.map((p) => {
      const tech = techById.get(p.techId)!
      return {
        id: p.techId,
        type: 'tech',
        parentId: `group:${p.groupId}`,
        extent: 'parent' as const,
        position: nodePos[p.techId] ?? { x: p.x, y: p.y },
        width: NODE_W,
        height: NODE_H,
        zIndex: 2,
        data: {
          tech,
          problems: problems.filter((pr) => pr.techId === p.techId),
          dimmed: isDim(tech),
          active: selected === p.techId,
          onHover: setHovered,
          onRemove: requestRemove,
        },
      }
    })

    return [...groupNodes, ...techNodes]
  }, [boxes, placed, groupPos, nodePos, problems, selected, highlight, techs])

  /**
   * The ghost is appended in its own memo rather than built into `nodes` above, so the real
   * blocks keep their object identity while a drag runs: React Flow then only has to adopt
   * the one node that actually changed each frame instead of all of them.
   */
  const nodesWithGhost = useMemo<Node[]>(() => {
    if (!ghost) return nodes
    const isGroup = ghost.id.startsWith('group:')
    const box = isGroup ? boxes.find((b) => `group:${b.groupId}` === ghost.id) : undefined
    const tech = isGroup ? undefined : techById.get(ghost.id)
    if (isGroup ? !box : !tech) return nodes

    const group = groupById.get(isGroup ? box!.groupId : tech!.group)
    return [
      ...nodes,
      {
        id: GHOST_ID,
        type: 'ghost',
        // a block's drag position is relative to its box, exactly like its resting position
        parentId: isGroup ? undefined : `group:${tech!.group}`,
        position: { x: ghost.x, y: ghost.y },
        width: isGroup ? box!.w : NODE_W,
        height: isGroup ? box!.h : NODE_H,
        style: { width: isGroup ? box!.w : NODE_W, height: isGroup ? box!.h : NODE_H },
        draggable: false,
        selectable: false,
        /* above the cards, so the landing spot is never hidden behind one */
        zIndex: 6,
        data: {
          color: (isGroup ? group?.color : tech!.color) ?? '#8b93a1',
          label: isGroup ? (group?.name ?? '') : tech!.name,
        },
      },
    ]
  }, [nodes, ghost, boxes])

  /**
   * Wires are planned against every block at once — see routing.ts. React Flow keeps node
   * geometry in its own store, so subscribe to a cheap position signature to know when to
   * re-plan.
   *
   * That signature is frozen for the length of a drag. planRoutes() costs a full orthogonal
   * search over every wire against every block, and paying it on each drag frame re-rendered
   * the whole canvas at 60fps — the card trailed the cursor so far behind that you could not
   * tell where it would land. Held constant, the selector returns early, nothing downstream
   * re-renders, and the card moves at React Flow's own speed as a preview of its landing spot
   * (index.css gives it the dashed outline and fades the stale wires). One re-plan on drop.
   */
  const store = useStoreApi()
  const posKey = useStore((s) => {
    if (dragging) return 'dragging'
    let k = ''
    for (const [id, n] of s.nodeLookup) k += `${id}:${n.internals.positionAbsolute.x},${n.internals.positionAbsolute.y};`
    return k
  })
  const routes = useMemo(() => {
    const rects = new Map<string, Rect>()
    for (const [id, n] of store.getState().nodeLookup) {
      rects.set(id, {
        x: n.internals.positionAbsolute.x,
        y: n.internals.positionAbsolute.y,
        w: n.measured.width ?? (id.startsWith('group:') ? 0 : NODE_W),
        h: n.measured.height ?? (id.startsWith('group:') ? 0 : NODE_H),
        parent: n.parentId,
        box: id.startsWith('group:'),
      })
    }
    return planRoutes(rects, rel)
  }, [posKey, rel, store])

  /**
   * Where a drag actually lands. React Flow hands us the raw position; this pulls it onto any
   * neighbour it is nearly aligned with and reports the guides to draw. Both drag handlers go
   * through here, so the ghost you see and the position committed on drop cannot disagree.
   *
   * A block aligns against its own box-mates and a box against the other boxes — aligning a
   * block to something in a different box would be meaningless, since `extent: 'parent'`
   * means it can never get there. Hold Alt to drop exactly where the cursor is.
   */
  const resolveDrag = useCallback(
    (n: Node, free: boolean) => {
      const raw = { x: n.position.x, y: n.position.y, guides: [] as Guide[] }
      if (free) return raw

      const { nodeLookup, transform } = store.getState()
      const self = nodeLookup.get(n.id)
      if (!self) return raw

      const isGroup = n.id.startsWith('group:')
      const parent = n.parentId ? nodeLookup.get(n.parentId) : undefined
      // a block's position is relative to its box, so snap in absolute space and convert back
      const origin = parent?.internals.positionAbsolute ?? { x: 0, y: 0 }
      const size = (m: typeof self) => ({
        w: m.measured.width ?? NODE_W,
        h: m.measured.height ?? NODE_H,
      })

      const peers = []
      for (const [id, m] of nodeLookup) {
        if (id === n.id || id === GHOST_ID) continue
        if (isGroup !== id.startsWith('group:')) continue
        if (!isGroup && m.parentId !== n.parentId) continue
        peers.push({ x: m.internals.positionAbsolute.x, y: m.internals.positionAbsolute.y, ...size(m) })
      }
      if (!peers.length) return raw

      const me = { x: origin.x + n.position.x, y: origin.y + n.position.y, ...size(self) }
      // tolerance in flow units, so the pull feels the same at every zoom level
      const hit = snap(me, peers, SNAP_PX / transform[2])

      const x = hit.x - origin.x
      const y = hit.y - origin.y
      if (!parent) return { x, y, guides: hit.guides }

      // A snap must never push a block past the box edge React Flow already clamped it to.
      // Where the clamp wins, that axis did not really align, so its guide has to go too.
      const box = size(parent)
      const cx = Math.min(Math.max(x, 0), box.w - me.w)
      const cy = Math.min(Math.max(y, 0), box.h - me.h)
      const guides = hit.guides.filter((g) => (g.axis === 'x' ? cx === x : cy === y))
      return { x: cx, y: cy, guides }
    },
    [store],
  )

  const edges = useMemo<Edge[]>(
    () =>
      rel.map((e) => {
        const style = REL[e.rel]
        const active = !!selected && (e.source === selected || e.target === selected)
        const bothEndsPass = matchesFilter(techById.get(e.source)!) && matchesFilter(techById.get(e.target)!)
        const marker = { type: MarkerType.ArrowClosed, color: style.color, width: 16, height: 16 }
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'rel',
          markerEnd: marker,
          markerStart: style.both || e.both ? marker : undefined,
          zIndex: active ? 5 : 1,
          data: {
            rel: e.rel, card: e.card, both: style.both || e.both, active,
            dimmed: (!!selected && !active) || !bothEndsPass,
            route: routes.get(e.id),
          },
        }
      }),
    [rel, selected, highlight, routes],
  )

  const undoRemove = useStack((s) => s.undoRemove)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '')
      if (typing) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undoRemove()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoRemove])

  const selectedTech = selected ? techById.get(selected) : undefined

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0b0d10] text-white">
      <TopBar problems={problems} />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <Palette onBlocked={(m) => { setToast(m); setTimeout(() => setToast(null), 3500) }} />

        {/* the canvas owns its own box: the strip below is a sibling, not an overlay, so
            the measured height is the height that is actually visible and fitView lands right */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main ref={canvasRef} className="stack-canvas relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {!added.length && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-center text-white/35">
              <div>
                <div className="text-[15px] font-semibold text-white/60">Add a technology to start</div>
                <div className="mt-1 text-[12px]">Its box appears on its own. Click any block to trace what it connects to.</div>
              </div>
            </div>
          )}

          <ReactFlow
            className={dragging ? 'is-dragging' : undefined}
            nodes={nodesWithGhost}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={(_, n) => !n.id.startsWith('group:') && select(n.id)}
            onPaneClick={() => select(null)}
            /* n.position is the position the block *would* take, already clamped to its box */
            onNodeDragStart={(e, n) => setGhost({ id: n.id, ...resolveDrag(n, e.altKey) })}
            onNodeDrag={(e, n) => setGhost({ id: n.id, ...resolveDrag(n, e.altKey) })}
            onNodeDragStop={(e, n) => {
              setGhost(null)
              // resolve once more rather than trusting state: same inputs, same answer, and
              // the block lands exactly where the ghost was standing
              const { x, y } = resolveDrag(n, e.altKey)
              if (n.id.startsWith('group:')) setGroupPos(n.id.slice(6), { x, y })
              else setNodePos(n.id, { x, y })
            }}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
            fitView
            minZoom={0.15}
          >
            {/* the boxes' own extent, so a re-column refits even when the pane size did not change */}
            <AlignmentGuides guides={ghost?.guides} />
            <FitOnDemand tick={`${fitTick}|${boxes.map((b) => `${b.x},${b.y},${b.w},${b.h}`).join(';')}`} />
            <Background color="#212631" gap={26} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              maskColor="rgba(0,0,0,0.7)"
              nodeColor={(n) =>
                n.id.startsWith('group:')
                  ? (groupById.get(n.id.slice(6))?.color ?? '#333') + '55'
                  : techById.get(n.id)?.color ?? '#666'
              }
              style={{ background: '#0d1014' }}
            />
          </ReactFlow>

          <NeedsPanel analysis={analysis} />
          <UndoToast />
          <DeleteGuard />

          {selectedTech && (
            <div className="absolute right-0 top-0 bottom-0 z-30 flex">
              <Drawer tech={selectedTech} problems={problems.filter((p) => p.techId === selectedTech.id)} />
            </div>
          )}

          {toast && (
            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-red-500/50 bg-red-500/15 px-4 py-2 text-[12px] text-red-200 backdrop-blur">
              {toast}
            </div>
          )}
        </main>

        <Inspector
          tech={hovered ? techById.get(hovered) : undefined}
          problems={hovered ? problems.filter((p) => p.techId === hovered) : []}
        />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
