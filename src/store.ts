import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Creds } from './types'

export type Highlight = { kind: 'lang' | 'tag' | 'group'; value: string } | null

interface State {
  /** ids of techs on the canvas */
  added: string[]
  /** manual drag overrides; anything absent is auto-placed by layout() */
  nodePos: Record<string, { x: number; y: number }>
  groupPos: Record<string, { x: number; y: number }>
  creds: Record<string, Creds>
  selected: string | null
  highlight: Highlight
  /** session only, never persisted */
  passphrase: string | null
  /** bumped to ask the canvas to refit */
  fitTick: number
  /** id awaiting a "you filled this in, really delete?" answer */
  confirming: string | null
  /** last deletion, kept so it can be put back exactly as it was */
  lastRemoved: { id: string; creds?: Creds; pos?: { x: number; y: number } } | null

  add: (id: string) => void
  /** asks first when the block has account details saved on it */
  requestRemove: (id: string) => void
  confirmRemove: () => void
  cancelRemove: () => void
  undoRemove: () => void
  dismissUndo: () => void
  remove: (id: string) => void
  setNodePos: (id: string, p: { x: number; y: number }) => void
  setGroupPos: (id: string, p: { x: number; y: number }) => void
  resetPositions: () => void
  bumpFit: () => void
  setCreds: (id: string, c: Creds) => void
  select: (id: string | null) => void
  setHighlight: (h: Highlight) => void
  setPassphrase: (p: string | null) => void
  clear: () => void
  load: (s: Pick<State, 'added' | 'nodePos' | 'groupPos' | 'creds'>) => void
}

/** Drops a block and keeps everything needed to put it back untouched. */
function removal(s: State, id: string): Partial<State> {
  const { [id]: goneCreds, ...creds } = s.creds
  const { [id]: gonePos, ...nodePos } = s.nodePos
  return {
    added: s.added.filter((x) => x !== id),
    creds,
    nodePos,
    selected: s.selected === id ? null : s.selected,
    lastRemoved: { id, creds: goneCreds, pos: gonePos },
  }
}

export const useStack = create<State>()(
  persist(
    (set) => ({
      added: [],
      nodePos: {},
      groupPos: {},
      creds: {},
      selected: null,
      highlight: null,
      passphrase: null,
      fitTick: 0,
      confirming: null,
      lastRemoved: null,

      add: (id) => set((s) => (s.added.includes(id) ? s : { added: [...s.added, id] })),

      requestRemove: (id) =>
        set((s) => {
          const c = s.creds[id]
          const filled = !!(c && (c.url || c.username || c.secret || c.notes))
          if (filled) return { confirming: id }
          return removal(s, id)
        }),
      confirmRemove: () => set((s) => (s.confirming ? { ...removal(s, s.confirming), confirming: null } : s)),
      cancelRemove: () => set({ confirming: null }),

      undoRemove: () =>
        set((s) => {
          const r = s.lastRemoved
          if (!r) return s
          return {
            added: s.added.includes(r.id) ? s.added : [...s.added, r.id],
            creds: r.creds ? { ...s.creds, [r.id]: r.creds } : s.creds,
            nodePos: r.pos ? { ...s.nodePos, [r.id]: r.pos } : s.nodePos,
            lastRemoved: null,
          }
        }),
      dismissUndo: () => set({ lastRemoved: null }),

      remove: (id) => set((s) => removal(s, id)),
      setNodePos: (id, p) => set((s) => ({ nodePos: { ...s.nodePos, [id]: p } })),
      setGroupPos: (id, p) => set((s) => ({ groupPos: { ...s.groupPos, [id]: p } })),
      resetPositions: () => set((s) => ({ nodePos: {}, groupPos: {}, fitTick: s.fitTick + 1 })),
      bumpFit: () => set((s) => ({ fitTick: s.fitTick + 1 })),
      setCreds: (id, c) => set((s) => ({ creds: { ...s.creds, [id]: c } })),
      select: (id) => set({ selected: id }),
      setHighlight: (h) => set({ highlight: h }),
      setPassphrase: (p) => set({ passphrase: p }),
      clear: () => set({ added: [], nodePos: {}, groupPos: {}, creds: {}, selected: null }),
      load: (s) => set({ ...s, selected: null }),
    }),
    {
      name: 'stackforge',
      partialize: ({ added, nodePos, groupPos, creds }) => ({ added, nodePos, groupPos, creds }),
    },
  ),
)
