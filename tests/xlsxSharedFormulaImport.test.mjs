import assert from 'node:assert/strict'
import test from 'node:test'
import { expandXlsxSharedFormulas } from '../src/xlsxSharedFormulaImport.ts'
import { planOfficeInteropImport } from '../src/officeInteropImport.ts'
import { getImportedTableFormula } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

const encoder=new TextEncoder()
function u16(value){return[value&255,(value>>8)&255]}
function u32(value){return[value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255]}
function zip(files){const locals=[],centrals=[];let offset=0;for(const[name,text]of Object.entries(files)){const n=encoder.encode(name),d=encoder.encode(text),local=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...n,...d]),central=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]);locals.push(local);centrals.push(central);offset+=local.length}const size=centrals.reduce((sum,item)=>sum+item.length,0),end=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(centrals.length),...u16(centrals.length),...u32(size),...u32(offset),...u16(0)]),out=new Uint8Array(offset+size+end.length);let cursor=0;for(const part of[...locals,...centrals,end]){out.set(part,cursor);cursor+=part.length}return out}

test('shared formula dependents translate relative A1 references while keeping absolute references fixed',()=>{
  const formulas=expandXlsxSharedFormulas('<worksheet><sheetData><row r="2"><c r="B2"><f t="shared" si="0" ref="B2:B4">A2*$D$1+SUM(C2:C3)+"A2"</f><v>5</v></c></row><row r="3"><c r="B3"><f t="shared" si="0"/><v>6</v></c></row><row r="4"><c r="B4"><f t="shared" si="0"/><v>7</v></c></row></sheetData></worksheet>')
  assert.equal(formulas.get('B2'),'A2*$D$1+SUM(C2:C3)+"A2"')
  assert.equal(formulas.get('B3'),'A3*$D$1+SUM(C3:C4)+"A2"')
  assert.equal(formulas.get('B4'),'A4*$D$1+SUM(C4:C5)+"A2"')
})

test('shared formula translation handles column movement and sheet-qualified references',()=>{
  const formulas=expandXlsxSharedFormulas('<worksheet><sheetData><row r="2"><c r="C2"><f t="shared" si="4">B2+Sheet2!D2+\'Plan FY\'!$E2</f><v>1</v></c><c r="D2"><f t="shared" si="4"/><v>2</v></c></row></sheetData></worksheet>')
  assert.equal(formulas.get('D2'),'C2+Sheet2!E2+\'Plan FY\'!$E2')
})

test('canonical Office pipeline preserves shared formula text on imported table cells',async()=>{
  const bytes=zip({
    'xl/workbook.xml':'<workbook><sheets><sheet name="Pipeline" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Account</t></is></c><c r="B1" t="inlineStr"><is><t>ARR</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Acme</t></is></c><c r="B2"><f t="shared" si="0" ref="B2:B3">A2+1</f><v>2</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Nova</t></is></c><c r="B3"><f t="shared" si="0"/><v>3</v></c></row></sheetData></worksheet>',
  })
  const plan=await planOfficeInteropImport(cloneSeedWorkspace(),bytes,'pipeline.xlsx')
  const command=plan.commands.find((item)=>item.type==='data.imported.replace')
  assert.ok(command)
  const table=command.tables.at(-1)
  assert.equal(getImportedTableFormula(table,table.rows[0].id,'arr'),'A2+1')
  assert.equal(getImportedTableFormula(table,table.rows[1].id,'arr'),'A3+1')
  assert.equal(plan.warnings.some((warning)=>/shared-formula dependent cell/.test(warning)),true)
})
