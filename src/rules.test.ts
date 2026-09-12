/* Run: pnpm check  —  plain node:test, no framework. */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { analyze, blockedBy } from './rules.ts'
import type { StackRule, Tech } from './types.ts'

const t = (id: string, extra: Partial<Tech> = {}): Tech => ({
  id, name: id, group: 'x', section: 'x', color: '#fff', langs: ['ts'], desc: '', ...extra,
})

const firebase = t('firebase', { provides: ['db', 'auth'], exclusive: ['baas'], conflicts: ['postgresql'] })
const supabase = t('supabase', { provides: ['db', 'auth'], exclusive: ['baas'] })
const postgres = t('postgresql', { provides: ['db'] })
const prisma = t('prisma', { needs: ['db'], links: [{ to: 'postgresql', rel: 'queries' }] })
const vite = t('vite', { provides: ['bundler'] })
const vitest = t('vitest', { links: [{ to: 'vite', rel: 'tests' }] })
const noRules: StackRule[] = []

test('exclusive slot: supabase blocked by firebase', () => {
  assert.match(blockedBy(supabase, [firebase])!, /both fill the "baas" slot/)
  assert.equal(blockedBy(supabase, [postgres]), null)
})

test('explicit conflict is symmetric — declared on firebase only', () => {
  assert.match(blockedBy(postgres, [firebase])!, /not compatible/)
  assert.match(blockedBy(firebase, [postgres])!, /not compatible/)
})

test('unmet need is an error, met need becomes an arrow instead', () => {
  const alone = analyze([prisma], noRules)
  assert.equal(alone.problems.length, 1)
  assert.match(alone.problems[0].message, /provides "db"/)

  const paired = analyze([prisma, postgres], noRules)
  assert.deepEqual(paired.problems, [])
  // one line per pair: the explicit `queries` link outranks the derived `requires`
  const between = paired.edges.filter(
    (e) => (e.source === 'prisma' && e.target === 'postgresql') || (e.source === 'postgresql' && e.target === 'prisma'),
  )
  assert.equal(between.length, 1)
  assert.equal(between[0].rel, 'queries')
})

test('a derived dependency keeps its n-1 cardinality when nothing more specific exists', () => {
  const app = t('app', { needs: ['db'] })
  const edge = analyze([app, postgres], noRules).edges[0]
  assert.equal(edge.rel, 'requires')
  assert.equal(edge.card, 'n-1')
})

test('opposing dependencies collapse into one bidirectional line', () => {
  const a = t('a', { provides: ['api'], needs: ['db'] })
  const b = t('b', { provides: ['db'], needs: ['api'] })
  const edges = analyze([a, b], noRules).edges
  assert.equal(edges.length, 1, 'two arrows between the same pair make no sense')
  assert.equal(edges[0].both, true)
})

test('a need draws an arrow to every provider that satisfies it', () => {
  const paypal = t('paypal', { needs: ['db', 'auth'] })
  const authjs = t('authjs', { provides: ['auth'] })
  const a = analyze([paypal, postgres, authjs], noRules)
  assert.deepEqual(a.problems, [])
  assert.ok(a.edges.some((e) => e.source === 'paypal' && e.target === 'postgresql'))
  assert.ok(a.edges.some((e) => e.source === 'paypal' && e.target === 'authjs'))

  // and when nothing satisfies it, the gap is reported for the recommendations panel
  const alone = analyze([paypal], noRules)
  assert.deepEqual(alone.missing.map((m) => m.cap).sort(), ['auth', 'db'])
})

test('explicit link only drawn when both ends are on the canvas', () => {
  assert.equal(analyze([vitest], noRules).edges.length, 0)
  assert.ok(analyze([vitest, vite], noRules).edges.some((e) => e.rel === 'tests'))
})

test('conflict drawn once, reported on both blocks', () => {
  const a = analyze([firebase, supabase], noRules)
  assert.equal(a.edges.filter((e) => e.rel === 'conflicts').length, 1)
  assert.equal(a.problems.length, 2)
})

test('a satisfied stack rule draws the dependency instead of complaining', () => {
  const rule: StackRule = {
    id: 'rag-no-vector', when: ['rag'], requires: ['vector'],
    severity: 'warn', message: 'RAG without a vector store',
  }
  const langchain = t('langchain', { provides: ['rag'] })
  const pinecone = t('pinecone', { provides: ['vector'] })

  // alone it complains
  assert.equal(analyze([langchain], [rule]).problems[0].message, 'RAG without a vector store')

  // together the complaint becomes an arrow
  const both = analyze([langchain, pinecone], [rule])
  assert.deepEqual(both.problems, [])
  assert.ok(both.edges.some((e) => e.source === 'langchain' && e.target === 'pinecone' && e.rel === 'requires'))
})

test('stack rule fires only when trigger present and requirement absent', () => {
  const rule: StackRule = {
    id: 'users-need-auth', when: ['users'], requires: ['auth'],
    severity: 'error', message: 'Users but no auth provider',
  }
  const app = t('app', { provides: ['users'] })
  assert.equal(analyze([app], [rule]).problems[0].message, 'Users but no auth provider')
  assert.deepEqual(analyze([app, supabase], [rule]).problems, [])
  assert.deepEqual(analyze([postgres], [rule]).problems, [])
})
