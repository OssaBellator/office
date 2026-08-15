import assert from 'node:assert/strict'
import test from 'node:test'
import { compareSourceRevisions, summarizeSourceRevisionDiff } from '../src/sourceRevisionDiff.ts'

function receipt({name='model.xlsx',sha='a'.repeat(64),bytes=100,items=2,warnings=1,commands={'data.imported.replace':1},kind='xlsx'}={}){return{version:1,fileName:name,kind,byteLength:bytes,sha256:sha,sourceIdentity:`${kind}:${sha}`,importedItems:items,warningCount:warnings,commandTypes:commands,createdAt:'2026-08-15T00:00:00.000Z'}}

test('source revision diff identifies byte-identical content even after rename',()=>{
  const previous=receipt(),next=receipt({name:'copy.xlsx'})
  const diff=compareSourceRevisions(previous,next)
  assert.equal(diff.relation,'identical-content')
  assert.equal(diff.fileNameChanged,true)
  assert.equal(diff.byteDelta,0)
  assert.deepEqual(diff.commandTypeDeltas,{})
  assert.match(summarizeSourceRevisionDiff(diff),/byte-identical/)
})

test('source revision diff exposes semantic plan-shape deltas for same-name revision',()=>{
  const previous=receipt(),next=receipt({sha:'b'.repeat(64),bytes:125,items:4,warnings:3,commands:{'data.imported.replace':1,'region.update':2}})
  const diff=compareSourceRevisions(previous,next)
  assert.equal(diff.relation,'same-name-revision')
  assert.equal(diff.byteDelta,25)
  assert.equal(diff.importedItemDelta,2)
  assert.equal(diff.warningDelta,2)
  assert.deepEqual(diff.commandTypeDeltas,{'region.update':2})
  assert.match(summarizeSourceRevisionDiff(diff),/\+25 bytes/)
  assert.match(summarizeSourceRevisionDiff(diff),/\+2 region\.update/)
})

test('source revision diff distinguishes genuinely different source identity',()=>{
  const diff=compareSourceRevisions(receipt(),receipt({name:'board.pptx',kind:'pptx',sha:'c'.repeat(64)}))
  assert.equal(diff.relation,'different-source')
  assert.equal(diff.kindChanged,true)
  assert.equal(diff.fileNameChanged,true)
})
