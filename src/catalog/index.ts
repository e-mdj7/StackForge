import type { Group, StackRule, Tech } from '../types'

import groupsJson from './groups.json' with { type: 'json' }
import rulesJson from './rules.json' with { type: 'json' }

import language from './language.json' with { type: 'json' }
import frontend from './frontend.json' with { type: 'json' }
import mobile from './mobile.json' with { type: 'json' }
import backend from './backend.json' with { type: 'json' }
import auth from './auth.json' with { type: 'json' }
import data from './data.json' with { type: 'json' }
import ai from './ai.json' with { type: 'json' }
import automation from './automation.json' with { type: 'json' }
import testing from './testing.json' with { type: 'json' }
import devops from './devops.json' with { type: 'json' }
import observability from './observability.json' with { type: 'json' }
import analytics from './analytics.json' with { type: 'json' }
import design from './design.json' with { type: 'json' }
import pm from './pm.json' with { type: 'json' }
import business from './business.json' with { type: 'json' }

/** Add a file here and to the imports above — nothing else needs to change. */
const files = [
  language, frontend, mobile, backend, auth, data, ai, automation,
  testing, devops, observability, analytics, design, pm, business,
]

export const groups = groupsJson as Group[]
export const stackRules = rulesJson as StackRule[]
export const techs = files.flat() as unknown as Tech[]

export const techById = new Map(techs.map((t) => [t.id, t]))
export const groupById = new Map(groups.map((g) => [g.id, g]))

/** Every language family and tag actually present, for the filter bar. */
export const allLangs = [...new Set(techs.flatMap((t) => t.langs))].sort()
export const allTags = [...new Set(techs.flatMap((t) => t.tags ?? []))].sort()

/** Catalog integrity — run by catalog.test.ts and logged in dev. */
export function validateCatalog(): string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const t of techs) {
    if (seen.has(t.id)) errors.push(`duplicate id: ${t.id}`)
    seen.add(t.id)

    const g = groupById.get(t.group)
    if (!g) errors.push(`${t.id}: unknown group "${t.group}"`)
    else if (!g.sections.includes(t.section))
      errors.push(`${t.id}: section "${t.section}" is not one of ${g.name} sections`)

    for (const l of t.links ?? [])
      if (!techs.some((o) => o.id === l.to)) errors.push(`${t.id}: link target "${l.to}" does not exist`)
    for (const c of t.conflicts ?? [])
      if (!techs.some((o) => o.id === c)) errors.push(`${t.id}: conflict target "${c}" does not exist`)
  }

  // a `needs` nothing can satisfy is a typo, not a stack problem
  const provided = new Set(techs.flatMap((t) => t.provides ?? []))
  for (const t of techs)
    for (const n of t.needs ?? [])
      if (!provided.has(n)) errors.push(`${t.id}: needs "${n}" which no tech provides`)

  for (const r of stackRules)
    for (const c of [...r.when, ...r.requires])
      if (!provided.has(c)) errors.push(`rule ${r.id}: capability "${c}" is never provided`)

  return errors
}
