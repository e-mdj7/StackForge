export type Rel =
  | 'extends' | 'tests' | 'styles' | 'types' | 'builds'
  | 'requires' | 'consumes' | 'queries' | 'syncs'
  | 'deploys' | 'hosts' | 'orchestrates'
  | 'monitors' | 'tracks' | 'automates'
  | 'conflicts'

/**
 * Cardinality, read source-to-target. `n-1` means many of the source lean on one
 * of the target — many services, one database.
 */
export type Card = '1-1' | '1-n' | 'n-1' | 'n-n'

/**
 * Direction is always the same promise: the arrow points from the thing that
 * depends on, acts on, or reads from — to the thing it depends on.
 * Next.js → React. Prisma → PostgreSQL. Stripe → the database it records orders in.
 */
export interface Link {
  to: string
  rel: Rel
  card?: Card
}

export interface Tech {
  id: string
  name: string
  group: string
  /** lane inside the group box — must be one of that group's `sections` */
  section: string
  /** simpleicons.org slug; falls back to initials when absent */
  icon?: string
  color: string
  /** language families this belongs to — drives the flag badge and the highlight filter */
  langs: string[]
  /** "used for X when Y" */
  desc: string
  /** capabilities this tech supplies to the stack */
  provides?: string[]
  /** capabilities this tech cannot work without — unmet = red ring */
  needs?: string[]
  /** hard incompatibilities (symmetric, you only declare it once) */
  conflicts?: string[]
  /** only one selected tech may claim each key here (e.g. one bundler, one BaaS) */
  exclusive?: string[]
  /** explicit typed arrows to other techs */
  links?: Link[]
  /** ecosystem tags for filtering */
  tags?: string[]
  url?: string
}

export interface Group {
  id: string
  name: string
  color: string
  /** left-to-right dataflow order on the canvas */
  order: number
  /** lanes inside the box, rendered top-to-bottom in this order */
  sections: string[]
}

/**
 * A thing you might be building (catalog/builds.json). Each role names the part it plays in
 * that build and the `group:Section` slots that fill it — `group:*` for a whole box. A tech
 * that lands in one of those slots is relevant to the build, and wears the role as its chip.
 */
export interface Build {
  id: string
  name: string
  desc: string
  roles: Record<string, string[]>
}

/** Declarative stack-wide completeness check (catalog/rules.json) */
export interface StackRule {
  id: string
  /** fires only when every one of these capabilities is present */
  when: string[]
  /** ...and none of these is present */
  requires: string[]
  severity: 'error' | 'warn'
  message: string
}

export interface Creds {
  url?: string
  username?: string
  /** AES-GCM ciphertext, base64. Never plaintext on disk. */
  secret?: string
  notes?: string
}

export interface Problem {
  techId: string
  severity: 'error' | 'warn'
  message: string
}
