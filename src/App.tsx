import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { groupById, stackRules, techById } from './catalog'
import { GroupNode, REL, RelEdge, TechNode } from './components/nodes'
import { DeleteGuard, Drawer, Inspector, Legend, NeedsPanel, Palette, TopBar, UndoToast } from './components/panels'
import { NODE_H, NODE_W, layout } from './layout'
import { analyze } from './rules'
import { useStack } from './store'
import type { Tech } from './types'

const nodeTypes = { tech: TechNode, group: GroupNode } as unknown as NodeTypes
const edgeTypes = { rel: RelEdge } as unknown as EdgeTypes

/**
 * ReactFlow's own `fitView` prop fires at init, before the restored stack has been
 * measured, so it fits an empty canvas. Wait for the real measurements instead.
 */
function FitOnDemand({ tick }: { tick: number }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    // Nodes carry explicit width/height, which keeps `useNodesInitialized` false forever —
    // depending on it meant this never fired. Retry instead: the first attempt usually lands,
    // the later ones cover a slow first paint.
    const timers = [40, 180, 420].map((ms) =>
      setTimeout(() => void fitView({ padding: 0.08, duration: ms === 40 ? 0 : 200 }), ms),
    )
    return () => timers.forEach(clearTimeout)
  }, [tick, fitView])
  return null
}

function Canvas() {
  const { added, nodePos, groupPos, selected, highlight, fitTick, select, setNodePos, setGroupPos, requestRemove } =
    useStack()
  const [toast, setToast] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

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

  const matchesFilter = (t: Tech) => {
    if (!highlight) return true
    if (highlight.kind === 'lang') return t.langs.includes(highlight.value)
    if (highlight.kind === 'tag') return !!t.tags?.includes(highlight.value)
    return t.group === highlight.value
  }

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
          data: { rel: e.rel, card: e.card, both: style.both || e.both, active, dimmed: (!!selected && !active) || !bothEndsPass },
        }
      }),
    [rel, selected, highlight],
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
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={(_, n) => !n.id.startsWith('group:') && select(n.id)}
            onPaneClick={() => select(null)}
            onNodeDragStop={(_, n) =>
              n.id.startsWith('group:')
                ? setGroupPos(n.id.slice(6), n.position)
                : setNodePos(n.id, n.position)
            }
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
            fitView
            minZoom={0.15}
          >
            <FitOnDemand tick={fitTick + boxes.length * 1000 + Math.round(canvasSize.w / 40)} />
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
          <Legend />
          <Inspector
            tech={hovered ? techById.get(hovered) : undefined}
            problems={hovered ? problems.filter((p) => p.techId === hovered) : []}
          />

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
