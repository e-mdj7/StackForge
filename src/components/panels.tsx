import {
  AlertDialog,
  Button,
  Chip,
  CloseButton,
  Description,
  Input,
  InputGroup,
  Label,
  ListBox,
  Popover,
  SearchField,
  Select,
  TextArea,
  TextField,
} from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'
import { allLangs, allTags, builds, groups, techById, techs } from '../catalog'
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
        {/* HeroUI's SearchField brings its own magnifier and clear button */}
        <SearchField aria-label="Search technologies" value={q} onChange={setQ} variant="secondary">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={`Search ${techs.length} technologies…`} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Button
          size="sm"
          variant="ghost"
          onPress={() => setOpen({})}
          className="mt-1.5 text-[9px] uppercase tracking-wider"
        >
          Collapse all
        </Button>
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
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant={active ? 'secondary' : 'ghost'}
        className="shrink-0 whitespace-nowrap"
        render={(props) => <button {...props} />}
      >
        <span className="text-[9px] uppercase tracking-wider text-muted">{label}</span>
        <span className="ml-1.5">{active ? (upper ? active.toUpperCase() : active) : 'all'}</span>
        <span className="ml-1 text-[8px] text-muted">▼</span>
      </Button>

      {/* one wide panel of wrapped columns rather than a long scrolling menu, so the whole
          vocabulary is visible at once and it can never push the page wider than the window */}
      <Popover.Content className="w-[min(78vw,760px)] max-h-[70vh] overflow-y-auto">
        <div className="flex flex-wrap content-start gap-x-4 gap-y-3">
          {columns.map((c) => (
            <div key={c.title} className="w-[118px]">
              <div className="mb-1 border-b border-border pb-1 text-[9px] font-bold uppercase tracking-wider text-muted">
                {c.title}
              </div>
              {c.items.map((v) => {
                const on = active === v
                return (
                  <Button
                    key={v}
                    size="sm"
                    variant={on ? 'secondary' : 'ghost'}
                    fullWidth
                    className="justify-start truncate px-1.5 text-[11px]"
                    onPress={() => {
                      setHighlight(on ? null : { kind, value: v })
                      setOpen(false)
                    }}
                  >
                    {upper ? v.toUpperCase() : v}
                  </Button>
                )
              })}
            </div>
          ))}
        </div>
      </Popover.Content>
    </Popover>
  )
}

/**
 * "What are you building?" — the other filters ask what a tech *is*, this one asks what it
 * would be *for*. Picking SaaS lights up every block that plays a part in one, each wearing
 * the part it plays: n8n turns up as Glue, Stripe as Billing.
 */
function BuildFilter({ highlight, setHighlight }: { highlight: Highlight; setHighlight: (h: Highlight) => void }) {
  const value = highlight?.kind === 'build' ? highlight.value : null
  return (
    <div className="flex shrink-0 items-center gap-1.5">
    <span className="text-[9px] uppercase tracking-wider text-muted">Build</span>
    <Select
      aria-label="Build"
      variant="secondary"
      placeholder="anything"
      value={value}
      onChange={(v) => setHighlight(v ? { kind: 'build', value: String(v) } : null)}
      className="shrink-0"
    >
      <Select.Trigger className={value ? 'border-cyan-400/60' : undefined}>
        <Select.Value />
        <Select.ClearButton />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {builds.map((b) => (
            <ListBox.Item key={b.id} id={b.id} textValue={b.name}>
              <Label>{b.name}</Label>
              <Description>{b.desc}</Description>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
    </div>
  )
}

/** Box is a flat list of 15 — a plain select, not a mega-menu. */
function BoxFilter({ highlight, setHighlight }: { highlight: Highlight; setHighlight: (h: Highlight) => void }) {
  const value = highlight?.kind === 'group' ? highlight.value : null
  return (
    <div className="flex shrink-0 items-center gap-1.5">
    <span className="text-[9px] uppercase tracking-wider text-muted">Box</span>
    <Select
      aria-label="Box"
      variant="secondary"
      placeholder="all"
      value={value}
      onChange={(v) => setHighlight(v ? { kind: 'group', value: String(v) } : null)}
      className="shrink-0"
    >
      <Select.Trigger className={value ? 'border-white/50' : undefined}>
        <Select.Value />
        <Select.ClearButton />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {groups.map((g) => (
            <ListBox.Item key={g.id} id={g.id} textValue={g.name}>
              <Label>
                <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: g.color }} />
                {g.name}
              </Label>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
    </div>
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
    <header className="flex w-full shrink-0 items-center gap-2 overflow-visible border-b border-white/10 bg-[#0d1014] px-4 py-1.5">
      {/* forge, not nebula: warm ember on the second half, so the wordmark reads as a name
          rather than a label and does not compete with the violet mark in the favicon */}
      <span className="shrink-0 select-none text-[23px] font-bold leading-none tracking-tight">
        <span className="text-white/85">Stack</span>
        <span className="bg-gradient-to-r from-[#ffb020] via-[#ff7a2f] to-[#ff4d36] bg-clip-text text-transparent">
          Forge
        </span>
      </span>
      <Filters highlight={highlight} setHighlight={setHighlight} />

      <div className="ml-auto flex shrink-0 items-center gap-2 text-[11px]">
        {errors > 0 && <Chip color="danger" size="sm">{errors} blocking</Chip>}
        {warns > 0 && <Chip color="warning" size="sm">{warns} warning</Chip>}
        {!problems.length && added.length > 0 && <Chip color="success" size="sm">stack is coherent</Chip>}

        <Button size="sm" variant="ghost" onPress={resetPositions}>Re-arrange</Button>
        <Button size="sm" variant="ghost" onPress={exportJson}>Export</Button>
        {/* a file input needs a real label around it, so this one keeps the button styling
            rather than the Button component */}
        <label className="inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-sm text-muted hover:bg-default hover:text-foreground">
          Import
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && e.target.files[0].text().then((t) => load(JSON.parse(t)))}
          />
        </label>
        <Button size="sm" variant="ghost" className="text-danger" onPress={clear}>Clear</Button>
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
    <AlertDialog.Backdrop isOpen variant="blur" onOpenChange={(open) => !open && cancelRemove()}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Remove {tech?.name}?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>This block has {filled} saved on it. Removing it discards that too.</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" onPress={cancelRemove}>Cancel</Button>
            <Button variant="danger" onPress={confirmRemove}>Remove</Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
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
        <CloseButton aria-label="Close" onPress={() => select(null)} />
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

        <TextField aria-label="Console URL" value={url} onChange={setUrl} variant="secondary" className="mt-2">
          <Label>Console URL</Label>
          <Input placeholder={tech.url ?? 'https://…'} />
        </TextField>

        <TextField aria-label="Username" value={username} onChange={setUsername} variant="secondary" className="mt-2">
          <Label>Username</Label>
          <Input />
        </TextField>

        <TextField
          aria-label="Password"
          type={revealed ? 'text' : 'password'}
          value={revealed ? secret : saved.secret ? '••••••••••' : secret}
          onChange={(v) => { setSecret(v); setRevealed(true) }}
          variant="secondary"
          className="mt-2"
        >
          <Label>Password</Label>
          <InputGroup>
            <Input className="font-mono" />
            <InputGroup.Suffix>
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                aria-label={revealed ? 'Hide password' : 'Decrypt and show password'}
                onPress={() => (revealed ? (setRevealed(false), setSecret('')) : reveal())}
              >
                {revealed ? '🙈' : '👁'}
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
        </TextField>

        <TextField aria-label="Passphrase" type="password" value={pass} onChange={setPass} variant="secondary" className="mt-2">
          <Label>Passphrase (this session only)</Label>
          <InputGroup>
            <Input placeholder={passphrase ? 'set' : 'not set'} />
            <InputGroup.Suffix>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => { setPassphrase(pass || null); setPass(''); setStatus(pass ? 'Passphrase set.' : 'Passphrase cleared.') }}
              >
                Set
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
          <Description>
            AES-GCM in your browser. The passphrase is never stored — clear it and the saved password is unreadable.
          </Description>
        </TextField>

        <TextField aria-label="Notes" value={notes} onChange={setNotes} variant="secondary" className="mt-2">
          <Label>Notes</Label>
          <TextArea rows={2} className="resize-none" />
        </TextField>

        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onPress={save}>Save</Button>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="text-[11px] text-muted hover:text-foreground">
              Open ↗
            </a>
          )}
          {status && <span className="text-[10px] text-muted">{status}</span>}
        </div>
      </div>

      <Button
        size="sm"
        variant="danger"
        onPress={() => requestRemove(tech.id)}
        className="mt-6 self-start text-[11px]"
      >
        Remove from stack
      </Button>
    </aside>
  )
}
