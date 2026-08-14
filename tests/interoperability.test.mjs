import assert from 'node:assert/strict'
import test from 'node:test'
import { canDirectlyImportLocalFile, findInteropCapability, INTEROP_CAPABILITIES, supportedLocalOfficeAccept } from '../src/interoperability.ts'

test('interoperability registry has one capability owner per extension',()=>{
  const extensions=INTEROP_CAPABILITIES.flatMap((item)=>item.extensions)
  assert.equal(new Set(extensions).size,extensions.length)
})

test('current Office formats are direct semantic projections while legacy and macro formats require conversion',()=>{
  assert.equal(findInteropCapability('strategy.docx').import,'projection')
  assert.equal(findInteropCapability('board.PPTX').semanticTarget,'present')
  assert.equal(findInteropCapability('.xlsx').semanticTarget,'data')
  assert.equal(findInteropCapability('old.xls').import,'convert-first')
  assert.equal(findInteropCapability('macro.xlsm').import,'convert-first')
})

test('Google pointer formats are provider imports rather than local file content',()=>{
  assert.equal(findInteropCapability('strategy.gdoc').import,'provider')
  assert.equal(findInteropCapability('model.gsheet').import,'provider')
  assert.equal(canDirectlyImportLocalFile('strategy.gdoc'),false)
})

test('local Office accept metadata is generated from the capability registry',()=>{
  const accept=supportedLocalOfficeAccept().split(',').sort()
  assert.deepEqual(accept,['.docx','.pptx','.xlsx'])
  assert.equal(canDirectlyImportLocalFile('strategy.docx'),true)
  assert.equal(canDirectlyImportLocalFile('deck.pptx'),true)
  assert.equal(canDirectlyImportLocalFile('model.xlsx'),true)
  assert.equal(canDirectlyImportLocalFile('legacy.doc'),false)
})
