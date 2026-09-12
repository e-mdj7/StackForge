import type { Link, Problem, StackRule, Tech } from './types'

export interface Analysis {
  problems: Problem[]
  /** resolved arrows between selected techs — one per pair of blocks */
  edges: {
    id: string
    source: string
    target: string
    rel: Link['rel']
    card?: Link['card']
    /** the two blocks depend on each other: one line, an arrowhead at each end */
    both?: boolean
  }[]
  /** every capability the selection supplies */
  caps: Set<string>
  /** capabilities the stack is asking for but nobody supplies */
  missing: { cap: string; neededBy: string[] }[]
}

const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** Why `candidate` cannot join `selected`, or null if it can. */
export function blockedBy(candidate: Tech, selected: Tech[]): string | null {
  for (const s of selected) {
    if (s.id === candidate.id) continue
    if (candidate.conflicts?.includes(s.id) || s.conflicts?.includes(candidate.id))
      return `${candidate.name} is not compatible with ${s.name}`
    const clash = candidate.exclusive?.find((k) => s.exclusive?.includes(k))
    if (clash) return `${candidate.name} and ${s.name} both fill the "${clash}" slot — pick one`
  }
  return null
}

export function analyze(selected: Tech[], stackRules: StackRule[]): Analysis {
  const byId = new Map(selected.map((t) => [t.id, t]))
  const caps = new Set<string>()
  for (const t of selected) t.provides?.forEach((c) => caps.add(c))

  const problems: Problem[] = []
  const edges: Analysis['edges'] = []
  const seenEdge = new Set<string>()
  const seenConflict = new Set<string>()
  const missing = new Map<string, string[]>()

  const push = (source: string, target: string, rel: Link['rel'], card?: Link['card']) => {
    const id = `${source}->${target}:${rel}`
    if (seenEdge.has(id)) return
    seenEdge.add(id)
    edges.push({ id, source, target, rel, card })
  }

  for (const t of selected) {
    // explicit arrows, only when the other end is on the canvas
    for (const l of t.links ?? []) if (byId.has(l.to)) push(t.id, l.to, l.rel, l.card)

    // A need is a real dependency: draw it to every provider, because that is the
    // relationship the user is trying to see. Many needers, one provider -> n-1.
    for (const need of t.needs ?? []) {
      const providers = selected.filter((o) => o.id !== t.id && o.provides?.includes(need))
      for (const p of providers) push(t.id, p.id, 'requires', 'n-1')
      if (!providers.length) {
        problems.push({ techId: t.id, severity: 'error', message: `Missing: nothing in this stack provides "${need}"` })
        missing.set(need, [...(missing.get(need) ?? []), t.id])
      }
    }

    // incompatibilities, reported on both blocks but drawn once
    for (const other of selected) {
      if (other.id === t.id) continue
      const explicit = t.conflicts?.includes(other.id)
      const clash = t.exclusive?.find((k) => other.exclusive?.includes(k))
      if (!explicit && !clash) continue
      problems.push({
        techId: t.id,
        severity: 'error',
        message: explicit
          ? `${t.name} is not compatible with ${other.name}`
          : `${t.name} and ${other.name} both fill the "${clash}" slot`,
      })
      const key = pair(t.id, other.id)
      if (!seenConflict.has(key)) {
        seenConflict.add(key)
        push(t.id, other.id, 'conflicts')
      }
    }
  }

  // stack-wide completeness (self-hosted with no DB, users with no auth, RAG with no vector store, ...)
  for (const r of stackRules) {
    if (!r.when.every((c) => caps.has(c))) continue
    const blame = selected.filter((t) => t.provides?.some((c) => r.when.includes(c)))
    const satisfied = r.requires.filter((c) => caps.has(c))

    if (satisfied.length) {
      // the rule describes a real dependency — now that both ends are present, draw it.
      // This is why adding Pinecone finally wires LangChain to it.
      for (const cap of satisfied)
        for (const provider of selected.filter((o) => o.provides?.includes(cap)))
          for (const t of blame) if (t.id !== provider.id) push(t.id, provider.id, 'requires', 'n-1')
      continue
    }

    for (const t of blame) problems.push({ techId: t.id, severity: r.severity, message: r.message })
    // one of `requires` would satisfy the rule — offer them all as candidates
    missing.set(r.requires[0], [...(missing.get(r.requires[0]) ?? []), ...blame.map((t) => t.id)])
  }

  return {
    problems,
    edges: mergePairs(edges),
    caps,
    missing: [...missing].map(([cap, neededBy]) => ({ cap, neededBy: [...new Set(neededBy)] })),
  }
}

/** An explicit relationship beats one merely derived from a capability. A conflict beats both. */
const rank = (r: Link['rel']) => (r === 'conflicts' ? 3 : r === 'requires' || r === 'consumes' ? 1 : 2)

/**
 * Two blocks get exactly one line. If each depends on the other, that line carries an
 * arrowhead at both ends rather than two separate arrows lying on top of each other.
 */
function mergePairs(edges: Analysis['edges']): Analysis['edges'] {
  const byPair = new Map<string, Analysis['edges'][number]>()

  for (const e of edges) {
    const key = pair(e.source, e.target)
    const prev = byPair.get(key)
    if (!prev) {
      byPair.set(key, { ...e, id: `${key}:${e.rel}` })
      continue
    }
    const winner = rank(e.rel) > rank(prev.rel) ? e : prev
    byPair.set(key, {
      ...winner,
      id: `${key}:${winner.rel}`,
      // opposing directions collapse into one bidirectional line
      both: prev.both || winner.both || prev.source !== e.source,
    })
  }

  return [...byPair.values()]
}
