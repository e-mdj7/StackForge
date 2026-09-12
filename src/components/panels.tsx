import { useEffect, useMemo, useState } from 'react'
import { allLangs, allTags, buildById, builds, groups, techById, techs } from '../catalog'
import { decryptSecret, encryptSecret } from '../crypto'
import { blockedBy } from '../rules'
import { highlightChip, matchesHighlight, useStack, type Highlight } from '../store'
import type { Analysis } from '../rules'
import type { Problem, Rel, Tech } from '../types'
import { REL } from './nodes'

/* ---------- left palette: collapsible boxes, sections visible inside ---------- */

export function Palette({ onBlocked }: { onBlocked: (msg: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const { added, add, requestRemove, highlight } = useStack()
  const selected = useMemo(() => added.map((id) => techById.get(id)!).filter(Boolean), [added])

  const needle = q.trim().toLowerCase()
  const matches = useMemo(
    () =>
      techs.filter(
        (t) =>
          !needle ||
          t.name.toLowerCase().includes(needle) ||
          t.id.includes(needle) ||
          t.section.toLowerCase().includes(needle) ||
          t.desc.toLowerCase().includes(needle) ||
          t.tags?.some((g) => g.includes(needle)),
      ),
    [needle],
  )

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-[#0d1014]">
      <div className="shrink-0 p-3">
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 349 technologies…"
            className="w-full rounded-md border border-white/15 bg-white/5 py-1.5 pl-2.5 pr-7 text-[12px] text-white/90 outline-none placeholder:text-white/30 focus:border-white/30"
          />
          {q && (
            <button
              title="Clear search"
              onClick={() => setQ('')}
              className="absolute right-1.5 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 16 16" width="8" height="8" aria-hidden="true">
                <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => setOpen({})}
          title={needle ? 'Clear the search to see it take effect' : undefined}
          className="mt-1.5 text-[9px] uppercase tracking-wider text-white/30 hover:text-white/70"
        >
          Collapse all
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((g) => {
          const mine = matches.filter((t) => t.group === g.id)
          if (!mine.length) return null
          // searching forces everything open, otherwise respect the toggle
          const isOpen = needle ? true : (open[g.id] ?? false)
          const onCount = mine.filter((t) => added.includes(t.id)).length
          // how much of this box the active filter covers, so a closed box still says something
          const hits = highlight ? mine.filter((t) => matchesHighlight(t, highlight)).length : null

          return (
            <div key={g.id} className="mb-1">
              <button
                onClick={() => setOpen((o) => ({ ...o, [g.id]: !isOpen }))}
                className={`flex w-full items-center gap-1.5 rounded px-1 py-1.5 text-left hover:bg-white/5 ${
                  hits === 0 ? 'opacity-40' : ''
                }`}
              >
                <span className={`text-[9px] text-white/40 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: g.color }}>
                  {g.name}
                </span>
                {hits !== null && (
                  <span className={`text-[9px] ${hits ? 'text-cyan-300' : 'text-white/20'}`}>({hits})</span>
                )}
                <span className="ml-auto text-[9px] text-white/25">
                  {onCount ? `${onCount}/${mine.length}` : mine.length}
                </span>
              </button>

              {isOpen &&
                g.sections.map((section) => {
                  const items = mine.filter((t) => t.section === section)
                  if (!items.length) return null
                  return (
                    <div key={section} className="mb-1.5 ml-3 border-l border-white/[0.07] pl-2">
                      <div className="py-0.5 text-[9px] uppercase tracking-wider text-white/25">{section}</div>
                      {items.map((t) => {
                        const on = added.includes(t.id)
                        const reason = on ? null : blockedBy(t, selected)
                        const hit = !!highlight && matchesHighlight(t, highlight)
                        const chip = highlightChip(t, highlight)
                        return (
                          <button
                            key={t.id}
                            title={reason ?? t.desc}
                            onClick={() => {
                              if (on) return requestRemove(t.id)
                              if (reason) return onBlocked(reason)
                              add(t.id)
                            }}
                            className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] ${
                              reason
                                ? 'cursor-not-allowed text-white/25 line-through'
                                : on
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5'
                            } ${hit ? 'ring-1 ring-inset ring-cyan-400/40' : highlight ? 'opacity-45' : ''}`}
                          >
                            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: t.color }} />
                            <span className="truncate">{t.name}</span>
                            <span className="ml-auto flex shrink-0 items-center gap-1">
                              {chip && (
                                <span className="rounded bg-cyan-400/15 px-1 text-[9px] font-semibold text-cyan-300">
                                  {chip}
                                </span>
                              )}
                              {on && <span className="text-[10px] text-white/40">on</span>}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

/* ---------- highlight mega-menu ---------- */

const LANG_COLUMNS: { title: string; items: string[] }[] = [
  { title: 'Web', items: ['ts', 'js', 'css', 'html'] },
  { title: 'Backend', items: ['py', 'go', 'rust', 'java', 'kotlin', 'csharp', 'php', 'ruby', 'elixir', 'erlang', 'groovy'] },
  { title: 'Native & Mobile', items: ['swift', 'dart', 'cpp'] },
  { title: 'Data & Query', items: ['sql', 'dax', 'proto', 'apex', 'abap', 'liquid'] },
  { title: 'Config & Markup', items: ['yaml', 'hcl', 'json', 'md', 'xml', 'bash', 'none'] },
]

const TAG_COLUMNS: { title: string; items: string[] }[] = [
  { title: 'Platform', items: ['web', 'mobile', 'desktop', 'edge', 'embedded', 'systems', 'serverless'] },
  { title: 'Discipline', items: ['backend', 'data', 'ml', 'ai', 'design', 'a11y', 'pm', 'dev', 'devtool', 'infra', 'ci', 'research'] },
  { title: 'Delivery', items: ['cloud', 'saas', 'hosted', 'selfhost', 'oss', 'privacy'] },
  { title: 'Vendor', items: ['aws', 'google', 'microsoft', 'atlassian', 'enterprise'] },
  { title: 'Other', items: ['protocol', 'unix'] },
]

/** anything in the catalog the columns above forgot still shows up */
function withLeftovers(columns: { title: string; items: string[] }[], all: string[]) {
  const known = new Set(columns.flatMap((c) => c.items))
  const rest = all.filter((v) => !known.has(v))
  const cols = columns.map((c) => ({ ...c, items: c.items.filter((i) => all.includes(i)) })).filter((c) => c.items.length)
  return rest.length ? [...cols, { title: 'Uncategorised', items: rest }] : cols
}

/**
 * One dropdown per dimension. Each panel wraps its columns instead of scrolling
 * sideways, so it can never push the page wider than the window.
 */
function FilterMenu({
  kind,
  label,
  columns,
  upper,
  highlight,
  setHighlight,
}: {
  kind: 'lang' | 'tag'
  label: string
  columns: { title: string; items: string[] }[]
  upper?: boolean
  highlight: Highlight
  setHighlight: (h: Highlight) => void
}) {
  const [open, setOpen] = useState(false)
  const active = highlight?.kind === kind ? highlight.value : null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1 text-[11px] ${
          active ? 'border-white/50 bg-white/10 text-white' : 'border-white/15 text-white/60 hover:text-white/90'
        }`}
      >
        <span className="text-[9px] uppercase tracking-wider text-white/35">{label}</span>
        {active ? (upper ? active.toUpperCase() : active) : 'all'}
        <span className="text-[8px] text-white/40">▼</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-1.5 flex max-h-[70vh] w-[min(78vw,760px)] flex-wrap content-start gap-x-4 gap-y-3 overflow-y-auto rounded-lg border border-white/15 bg-[#12161c] p-3 shadow-2xl">
            {columns.map((c) => (
              <div key={c.title} className="w-[118px]">
                <div className="mb-1 border-b border-white/10 pb-1 text-[9px] font-bold uppercase tracking-wider text-white/30">
                  {c.title}
                </div>
                {c.items.map((v) => {
                  const on = active === v
                  return (
                    <button
                      key={v}
                      onClick={() => {
                        setHighlight(on ? null : { kind, value: v })
                        setOpen(false)
                      }}
                      className={`block w-full truncate rounded px-1.5 py-[3px] text-left text-[11px] ${
                        on ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/[0.07] hover:text-white/90'
                      }`}
                    >
                      {upper ? v.toUpperCase() : v}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * "What are you building?" — the other filters ask what a tech *is*, this one asks what it
 * would be *for*. Picking SaaS lights up every block that plays a part in one, each wearing
 * the part it plays: n8n turns up as Glue, Stripe as Billing.
 */
function BuildFilter({ highlight, setHighlight }: { highlight: Highlight; setHighlight: (h: Highlight) => void }) {
  const value = highlight?.kind === 'build' ? highlight.value : ''
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[9px] uppercase tracking-wider text-white/35">Build</span>
      <select
        value={value}
        title={value ? buildById.get(value)?.desc : 'Highlight what a kind of project needs'}
        onChange={(e) => setHighlight(e.target.value ? { kind: 'build', value: e.target.value } : null)}
        className={`rounded border bg-[#12161c] px-1.5 py-1 text-[11px] outline-none ${
          value ? 'border-cyan-400/60 text-white' : 'border-white/15 text-white/60'
        }`}
      >
        <option value="">anything</option>
        {builds.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </label>
  )
}

/** Box is a flat list of 15 — a plain select, not a mega-menu. */
function BoxFilter({ highlight, setHighlight }: { highlight: Highlight; setHighlight: (h: Highlight) => void }) {
  const value = highlight?.kind === 'group' ? highlight.value : ''
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[9px] uppercase tracking-wider text-white/35">Box</span>
      <select
        value={value}
        onChange={(e) => setHighlight(e.target.value ? { kind: 'group', value: e.target.value } : null)}
        className={`rounded border bg-[#12161c] px-1.5 py-1 text-[11px] outline-none ${
          value ? 'border-white/50 text-white' : 'border-white/15 text-white/60'
        }`}
      >
        <option value="">all</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
    </label>
  )
}

function Filters({ highlight, setHighlight }: { highlight: Highlight; setHighlight: (h: Highlight) => void }) {
  const langCols = useMemo(() => withLeftovers(LANG_COLUMNS, allLangs), [])
  const tagCols = useMemo(() => withLeftovers(TAG_COLUMNS, allTags), [])
  return (
    <div className="flex min-w-0 items-center gap-2">
      <BuildFilter highlight={highlight} setHighlight={setHighlight} />
      <FilterMenu kind="lang" label="Language" columns={langCols} upper highlight={highlight} setHighlight={setHighlight} />
      <FilterMenu kind="tag" label="Ecosystem" columns={tagCols} highlight={highlight} setHighlight={setHighlight} />
      <BoxFilter highlight={highlight} setHighlight={setHighlight} />
      {highlight && (
        <button onClick={() => setHighlight(null)} className="whitespace-nowrap text-[10px] text-white/35 hover:text-white">
          clear
        </button>
      )}
    </div>
  )
}

/* ---------- top bar ---------- */

export function TopBar({ problems }: { problems: Problem[] }) {
  const { highlight, setHighlight, added, nodePos, groupPos, creds, clear, load, resetPositions } = useStack()
  const errors = problems.filter((p) => p.severity === 'error').length
  const warns = problems.length - errors

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ added, nodePos, groupPos, creds }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'stack.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <header className="flex w-full shrink-0 items-center gap-3 overflow-visible border-b border-white/10 bg-[#0d1014] px-4 py-2">
      <span className="text-[13px] font-bold tracking-tight text-white">StackForge</span>
      <Filters highlight={highlight} setHighlight={setHighlight} />

      <div className="ml-auto flex shrink-0 items-center gap-2 text-[11px]">
        {errors > 0 && <span className="rounded bg-red-500/20 px-2 py-0.5 text-red-300">{errors} blocking</span>}
        {warns > 0 && <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">{warns} warning</span>}
        {!problems.length && added.length > 0 && (
          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300">stack is coherent</span>
        )}
        <button onClick={resetPositions} className="text-white/50 hover:text-white">Re-arrange</button>
        <button onClick={exportJson} className="text-white/50 hover:text-white">Export</button>
        <label className="cursor-pointer text-white/50 hover:text-white">
          Import
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && e.target.files[0].text().then((t) => load(JSON.parse(t)))}
          />
        </label>
        <button onClick={clear} className="text-white/50 hover:text-red-400">Clear</button>
      </div>
    </header>
  )
}

/* ---------- what the stack still needs, and what would fix it ---------- */

export function NeedsPanel({ analysis }: { analysis: Analysis }) {
  const { added, add } = useStack()
  const [open, setOpen] = useState(true)

  const suggestions = useMemo(
    () =>
      analysis.missing.map(({ cap, neededBy }) => ({
        cap,
        neededBy: neededBy.map((id) => techById.get(id)?.name ?? id),
        fixes: techs
          .filter((t) => !added.includes(t.id) && t.provides?.includes(cap) && !blockedBy(t, added.map((i) => techById.get(i)!)))
          .slice(0, 4),
      })),
    [analysis.missing, added],
  )

  if (!suggestions.length) return null

  return (
    <div className="absolute right-3 top-3 z-10 w-72 rounded-lg border border-amber-500/25 bg-[#12161c]/95 text-[11px] shadow-2xl backdrop-blur">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <span className="text-[9px] text-white/40">{open ? '▼' : '▶'}</span>
        <span className="font-bold uppercase tracking-wider text-amber-300">Needed / recommended</span>
        <span className="ml-auto rounded bg-amber-500/20 px-1.5 text-amber-200">{suggestions.length}</span>
      </button>

      {open && (
        <div className="max-h-[45vh] overflow-y-auto px-3 pb-3">
          {suggestions.map((s) => (
            <div key={s.cap} className="mb-2.5">
              <div className="text-white/80">
                Missing <span className="font-semibold text-amber-300">{s.cap}</span>
              </div>
              <div className="text-[10px] text-white/40">needed by {s.neededBy.join(', ')}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {s.fixes.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => add(f.id)}
                    title={f.desc}
                    className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-white/70 hover:border-white/40 hover:text-white"
                  >
                    + {f.name}
                  </button>
                ))}
                {!s.fixes.length && <span className="text-[10px] text-white/30">nothing compatible left to add</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- delete guard + undo ---------- */

export function DeleteGuard() {
  const { confirming, confirmRemove, cancelRemove, creds } = useStack()
  if (!confirming) return null
  const tech = techById.get(confirming)
  const c = creds[confirming] ?? {}
  const filled = [c.url && 'a console URL', c.username && 'a username', c.secret && 'a saved password', c.notes && 'notes']
    .filter(Boolean)
    .join(', ')

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-sm">
      <div className="w-80 rounded-xl border border-white/15 bg-[#12161c] p-4 text-[12px] shadow-2xl">
        <div className="text-[14px] font-bold text-white">Remove {tech?.name}?</div>
        <p className="mt-2 text-white/60">
          This block has {filled} saved on it. Removing it discards that too.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={cancelRemove} className="rounded px-3 py-1 text-white/60 hover:text-white">Cancel</button>
          <button onClick={confirmRemove} className="rounded bg-red-500/85 px-3 py-1 font-semibold text-white hover:bg-red-500">
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

export function UndoToast() {
  const { lastRemoved, undoRemove, dismissUndo } = useStack()

  useEffect(() => {
    if (!lastRemoved) return
    const t = setTimeout(dismissUndo, 8000)
    return () => clearTimeout(t)
  }, [lastRemoved, dismissUndo])

  if (!lastRemoved) return null
  return (
    <div className="absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-white/15 bg-[#12161c] px-4 py-2 text-[12px] shadow-2xl">
      <span className="text-white/70">Removed {techById.get(lastRemoved.id)?.name ?? lastRemoved.id}</span>
      <button onClick={undoRemove} className="font-semibold text-cyan-300 hover:text-cyan-200">Undo</button>
      <button onClick={dismissUndo} className="text-white/30 hover:text-white">✕</button>
    </div>
  )
}

/* ---------- hovering a block fills this strip instead of covering its neighbours ---------- */

export function Inspector({ tech, problems }: { tech?: Tech; problems: Problem[] }) {
  return (
    <div className="pointer-events-none flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 bg-[#0d1014] px-4 py-1.5 text-[11px]">
      {/* basis-64 + truncate: the hint stays one line and the legend drops below it when
          the window is too narrow for both, instead of the hint wrapping into a column */}
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3 overflow-hidden whitespace-nowrap">
        {tech ? (
          <>
            <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ background: tech.color }} />
            <span className="shrink-0 font-semibold text-white">{tech.name}</span>
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/30">{tech.section}</span>
            <span className="truncate text-white/55">{tech.desc}</span>
            {problems.map((p, i) => (
              <span
                key={i}
                className={`shrink-0 rounded px-1.5 py-0.5 ${
                  p.severity === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {p.message}
              </span>
            ))}
          </>
        ) : (
          <span className="truncate text-white/25">Hover a block for details · click it to trace its connections</span>
        )}
      </div>

      {/* the line legend lives here, in the fixed bar, so it is always on screen */}
      <LegendRow />
    </div>
  )
}

/** The legend. Docked in the bottom bar so it is always on screen and never covers a block. */
function LegendRow() {
  const shown: Rel[] = ['requires', 'consumes', 'queries', 'deploys', 'extends', 'tests', 'monitors', 'conflicts']
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-l border-white/10 pl-4">
      {shown.map((r) => (
        <span key={r} className="flex items-center gap-1.5 whitespace-nowrap">
          <svg width="20" height="6" className="shrink-0">
            <line
              x1="0" y1="3" x2="20" y2="3"
              stroke={REL[r].color}
              strokeWidth="2"
              strokeDasharray={REL[r].dash ? '4 3' : undefined}
            />
          </svg>
          <span className="text-[10px] text-white/45">{REL[r].label}</span>
        </span>
      ))}
      <span className="whitespace-nowrap text-[10px] text-white/25">1 ∗ cardinality</span>
    </div>
  )
}

/* ---------- right drawer ---------- */

export function Drawer({ tech, problems }: { tech: Tech; problems: Problem[] }) {
  const { creds, setCreds, select, requestRemove, passphrase, setPassphrase } = useStack()
  const saved = creds[tech.id] ?? {}

  const [url, setUrl] = useState(saved.url ?? '')
  const [username, setUsername] = useState(saved.username ?? '')
  const [notes, setNotes] = useState(saved.notes ?? '')
  const [secret, setSecret] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [pass, setPass] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const c = creds[tech.id] ?? {}
    setUrl(c.url ?? '')
    setUsername(c.username ?? '')
    setNotes(c.notes ?? '')
    setSecret('')
    setRevealed(false)
    setStatus(null)
  }, [tech.id, creds])

  const save = async () => {
    const next = { ...saved, url, username, notes }
    if (secret) {
      if (!passphrase) return setStatus('Set a passphrase first to encrypt the password.')
      next.secret = await encryptSecret(secret, passphrase)
    }
    setCreds(tech.id, next)
    setStatus('Saved.')
  }

  const reveal = async () => {
    if (!saved.secret) return
    if (!passphrase) return setStatus('Enter your passphrase to decrypt.')
    const plain = await decryptSecret(saved.secret, passphrase)
    if (plain === null) return setStatus('Wrong passphrase.')
    setSecret(plain)
    setRevealed(true)
    setStatus(null)
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-[#0d1014] p-4 text-[12px]">
      <div className="flex items-start gap-2">
        <span className="mt-1 h-3 w-3 shrink-0 rounded" style={{ background: tech.color }} />
        <div className="flex-1">
          <div className="text-[14px] font-bold text-white">{tech.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/35">{tech.section}</div>
        </div>
        <button onClick={() => select(null)} className="text-white/40 hover:text-white">✕</button>
      </div>

      <p className="mt-3 text-white/60">{tech.desc}</p>

      {problems.map((p, i) => (
        <div
          key={i}
          className={`mt-2 rounded border px-2 py-1.5 ${
            p.severity === 'error'
              ? 'border-red-500/40 bg-red-500/10 text-red-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
          }`}
        >
          {p.message}
        </div>
      ))}

      {!!tech.provides?.length && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wider text-white/35">Provides</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {tech.provides.map((c) => (
              <span key={c} className="rounded bg-emerald-500/15 px-1.5 py-px text-[10px] text-emerald-300">{c}</span>
            ))}
          </div>
        </div>
      )}

      {!!tech.needs?.length && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wider text-white/35">Requires</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {tech.needs.map((c) => (
              <span key={c} className="rounded bg-cyan-500/15 px-1.5 py-px text-[10px] text-cyan-300">{c}</span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-white/10 pt-3">
        <div className="text-[10px] uppercase tracking-wider text-white/35">Account</div>

        <label className="mt-2 block text-white/40">Console URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={tech.url ?? 'https://…'}
          className="mt-1 w-full rounded border border-white/15 bg-white/5 px-2 py-1 text-white/90 outline-none focus:border-white/30" />

        <label className="mt-2 block text-white/40">Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded border border-white/15 bg-white/5 px-2 py-1 text-white/90 outline-none focus:border-white/30" />

        <label className="mt-2 block text-white/40">Password</label>
        <div className="mt-1 flex gap-1">
          <input
            type={revealed ? 'text' : 'password'}
            value={revealed ? secret : saved.secret ? '••••••••••' : secret}
            onChange={(e) => { setSecret(e.target.value); setRevealed(true) }}
            className="w-full rounded border border-white/15 bg-white/5 px-2 py-1 font-mono text-white/90 outline-none focus:border-white/30"
          />
          <button
            onClick={() => (revealed ? (setRevealed(false), setSecret('')) : reveal())}
            title={revealed ? 'Hide' : 'Decrypt and show'}
            className="rounded border border-white/15 px-2 text-white/50 hover:text-white"
          >
            {revealed ? '🙈' : '👁'}
          </button>
        </div>

        <label className="mt-2 block text-white/40">Passphrase (this session only)</label>
        <div className="mt-1 flex gap-1">
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder={passphrase ? 'set' : 'not set'}
            className="w-full rounded border border-white/15 bg-white/5 px-2 py-1 text-white/90 outline-none focus:border-white/30"
          />
          <button
            onClick={() => { setPassphrase(pass || null); setPass(''); setStatus(pass ? 'Passphrase set.' : 'Passphrase cleared.') }}
            className="rounded border border-white/15 px-2 text-white/50 hover:text-white"
          >
            Set
          </button>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-white/30">
          AES-GCM in your browser. The passphrase is never stored — clear it and the saved password is unreadable.
        </p>

        <label className="mt-2 block text-white/40">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="mt-1 w-full resize-none rounded border border-white/15 bg-white/5 px-2 py-1 text-white/90 outline-none focus:border-white/30" />

        <div className="mt-2 flex items-center gap-2">
          <button onClick={save} className="rounded bg-white/15 px-3 py-1 text-white hover:bg-white/25">Save</button>
          {url && <a href={url} target="_blank" rel="noreferrer" className="text-white/50 hover:text-white">Open ↗</a>}
          {status && <span className="text-[10px] text-white/50">{status}</span>}
        </div>
      </div>

      <button onClick={() => requestRemove(tech.id)} className="mt-6 text-left text-[11px] text-white/30 hover:text-red-400">
        Remove from stack
      </button>
    </aside>
  )
}
