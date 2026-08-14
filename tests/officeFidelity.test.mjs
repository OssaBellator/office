import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { parsePptxSlideXml } from '../src/officeParsers.ts'
import { planDocxImport, planPptxImport, planXlsxImport } from '../src/officeImportPlanner.ts'

const encoder=new TextEncoder()
function u16(value){return[value&255,(value>>8)&255]}
function u32(value){return[value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255]}
function zip(files){
  const locals=[],centrals=[];let offset=0
  for(const [name,text] of Object.entries(files)){
    const nameBytes=encoder.encode(name),data=encoder.encode(text)
    const local=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(data.length),...u32(data.length),...u16(nameBytes.length),...u16(0),...nameBytes,...data])
    const central=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(data.length),...u32(data.length),...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...nameBytes])
    locals.push(local);centrals.push(central);offset+=local.length
  }
  const centralSize=centrals.reduce((sum,item)=>sum+item.length,0)
  const end=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(centrals.length),...u16(centrals.length),...u32(centralSize),...u32(offset),...u16(0)])
  const bytes=new Uint8Array(offset+centralSize+end.length);let cursor=0
  for(const item of [...locals,...centrals,end]){bytes.set(item,cursor);cursor+=item.length}
  return bytes
}

test('PowerPoint tables become editable semantic slide rows and note metadata placeholders are ignored',()=>{
  const slide='<p:sld><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><a:p><a:r><a:t>Pipeline</a:t></a:r></a:p></p:sp><p:graphicFrame><a:tbl><a:tr><a:tc><a:p><a:r><a:t>Region</a:t></a:r></a:p></a:tc><a:tc><a:p><a:r><a:t>ARR</a:t></a:r></a:p></a:tc></a:tr><a:tr><a:tc><a:p><a:r><a:t>APAC</a:t></a:r></a:p></a:tc><a:tc><a:p><a:r><a:t>12.4</a:t></a:r></a:p></a:tc></a:tr></a:tbl></p:graphicFrame></p:sld>'
  const notes='<p:notes><p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><a:p><a:r><a:t>Lead with APAC</a:t></a:r></a:p></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><a:p><a:r><a:t>7</a:t></a:r></a:p></p:sp></p:notes>'
  const parsed=parsePptxSlideXml(slide,notes)
  assert.equal(parsed.title,'Pipeline')
  assert.deepEqual(parsed.body,['Region | ARR','APAC | 12.4'])
  assert.equal(parsed.flattenedTables,1)
  assert.equal(parsed.note,'Lead with APAC')
})

test('PowerPoint planner exposes layout, table, and motion fidelity warnings before apply',async()=>{
  const bytes=zip({'ppt/slides/slide1.xml':'<p:sld><p:transition/><p:sp><a:p><a:r><a:t>Slide title</a:t></a:r></a:p></p:sp><p:graphicFrame><a:tbl><a:tr><a:tc><a:p><a:r><a:t>A</a:t></a:r></a:p></a:tc></a:tr></a:tbl></p:graphicFrame></p:sld>'})
  const plan=await planPptxImport(cloneSeedWorkspace(),bytes,'story.pptx')
  assert.equal(plan.warnings.some((warning)=>/pixel-for-pixel/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/table/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/transitions and animations/.test(warning)),true)
})

test('Word planner warns when review and ancillary document parts cannot be preserved',async()=>{
  const bytes=zip({
    'word/document.xml':'<w:document><w:body><w:p><w:ins><w:r><w:t>Inserted text</w:t></w:r></w:ins></w:p></w:body></w:document>',
    'word/footnotes.xml':'<w:footnotes/>',
    'word/comments.xml':'<w:comments/>',
    'word/header1.xml':'<w:hdr><w:p><w:r><w:t>Confidential</w:t></w:r></w:p></w:hdr>',
  })
  const plan=await planDocxImport(cloneSeedWorkspace(),bytes,'reviewed.docx')
  assert.equal(plan.warnings.some((warning)=>/footnotes and endnotes/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/comments and comment threads/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/headers and footers/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/Tracked Word revisions/.test(warning)),true)
})

test('Excel planner warns about style, merged-cell, and comment fidelity while retaining values',async()=>{
  const bytes=zip({
    'xl/workbook.xml':'<workbook><sheets><sheet name="Pipeline" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Account</t></is></c><c r="B1" t="inlineStr"><is><t>Close date</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>Acme</t></is></c><c r="B2" s="1"><v>45500</v></c></row></sheetData><mergeCells><mergeCell ref="A3:B3"/></mergeCells></worksheet>',
    'xl/styles.xml':'<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
    'xl/comments1.xml':'<comments/>',
  })
  const plan=await planXlsxImport(cloneSeedWorkspace(),bytes,'pipeline.xlsx')
  const table=plan.commands.find((command)=>command.type==='data.imported.replace').tables.at(-1)
  assert.equal(table.rows[0].values['close-date'],45500)
  assert.equal(plan.warnings.some((warning)=>/date\/number display formats/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/Merged Excel cells/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/cell comments/.test(warning)),true)
})
