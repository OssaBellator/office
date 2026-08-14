import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateSemanticExpression } from '../src/expressions.ts'
import { cloneSeedWorkspace, workspaceTables } from '../src/model.ts'

test('LOOKUP expressions delegate to a relationship resolver with semantic dimensions', () => {
  const workspace = cloneSeedWorkspace()
  const calls = []
  const result = evaluateSemanticExpression('LOOKUP(relationship:regions-plan, "APAC", Plan.Revenue)', workspaceTables(workspace), {
    resolveLookup:(relationshipId,key,tableId,fieldId) => {
      calls.push({ relationshipId,key,tableId,fieldId })
      return { value:9.5, dimension:'currency', dependencies:['field:Plan.Revenue'], objectDependencies:['relationship:regions-plan','plan:apac'] }
    },
  })
  assert.equal(result.value, 9.5)
  assert.equal(result.dimension, 'currency')
  assert.deepEqual(calls, [{ relationshipId:'relationship:regions-plan', key:'APAC', tableId:'Plan', fieldId:'Revenue' }])
  assert.equal(result.dependencies.includes('field:Plan.Revenue'), true)
  assert.deepEqual(new Set(result.objectDependencies), new Set(['relationship:regions-plan','plan:apac']))
})

test('LOOKUP expressions compose with semantic arithmetic', () => {
  const workspace = cloneSeedWorkspace()
  const result = evaluateSemanticExpression('LOOKUP(relationship:regions-plan, "APAC", Plan.Revenue) * 2', workspaceTables(workspace), {
    resolveLookup:() => ({ value:9.5, dimension:'currency' }),
  })
  assert.equal(result.value, 19)
  assert.equal(result.dimension, 'currency')
})

test('LOOKUP requires explicit workspace relationship resolution', () => {
  const workspace = cloneSeedWorkspace()
  assert.throws(() => evaluateSemanticExpression('LOOKUP(relationship:regions-plan, "APAC", Plan.Revenue)', workspaceTables(workspace)), /workspace relationship resolver/)
  assert.throws(() => evaluateSemanticExpression('LOOKUP(relationship:regions-plan, APAC, Plan.Revenue)', workspaceTables(workspace), { resolveLookup:()=>({value:9.5,dimension:'currency'}) }), /Invalid LOOKUP expression/)
})
