import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { groups, stackRules, techs, validateCatalog } from './index.ts'

test('catalog is internally consistent', () => {
  assert.deepEqual(validateCatalog(), [])
})

test('catalog is not empty', () => {
  assert.ok(techs.length > 150, 'expected a broad catalog, got ' + techs.length)
  assert.equal(groups.length, 15)
  assert.ok(stackRules.length > 0)
})
