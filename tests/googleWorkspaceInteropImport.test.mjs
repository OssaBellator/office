import assert from 'node:assert/strict'
import test from 'node:test'
import { planGoogleWorkspaceInteropImport } from '../src/googleWorkspaceInteropImport.ts'
import { getImportedTableFormula } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

const encoder=new TextEncoder()
function u16(value){return[value&255,(value>>8)&255]}
function u32(value){return[value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255]}
function zip(files){const locals=[],centrals=[];let offset=0;for(const[name,text]of Object.entries(files)){const n=encoder.encode(name),d=encoder.encode(text),local=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...n,...d]),central=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]);locals.push(local);centrals.push(central);offset+=local.length}const size=centrals.reduce((sum,item)=>sum+item.length,0),end=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(centrals.length),...u16(centrals.length),...u32(size),...u32(offset),...u16(0)]),out=new Uint8Array(offset+size+end.length);let cursor=0;for(const part of[...locals,...centrals,end]){out.set(part,cursor);cursor+=part.length}return out}

test('canonical Google Sheets import preserves compact shared-formula dependents',async()=>{
  const provider={exportFile:async()=>zip({
    'xl/workbook.xml':'<workbook><sheets><sheet name="Pipeline" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Account</t></is></c><c r="B1" t="inlineStr"><is><t>ARR</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Acme</t></is></c><c r="B2"><f t="shared" si="0">A2+1</f><v>2</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Nova</t></is></c><c r="B3"><f t="shared" si="0"/><v>3</v></c></row></sheetData></worksheet>',
  })}
  const plan=await planGoogleWorkspaceInteropImport(cloneSeedWorkspace(),{id:'sheet',name:'Pipeline model',kind:'spreadsheet'},provider)
  const command=plan.commands.find((item)=>item.type==='data.imported.replace')
  assert.ok(command)
  const table=command.tables.at(-1)
  assert.equal(getImportedTableFormula(table,table.rows[1].id,'arr'),'A3+1')
  assert.equal(plan.warnings.some((warning)=>/shared-formula dependent/.test(warning)),true)
})

test('direct Google imports reject macro-bearing exported packages before semantic planning',async()=>{
  const provider={exportFile:async()=>zip({
    'xl/workbook.xml':'<workbook><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Value</t></is></c></row></sheetData></worksheet>',
    'xl/vbaProject.bin':'not executed',
  })}
  await assert.rejects(
    ()=>planGoogleWorkspaceInteropImport(cloneSeedWorkspace(),{id:'unsafe',name:'Unsafe workbook',kind:'spreadsheet'},provider),
    /Office import rejected: VBA part xl\/vbaProject\.bin/,
  )
})
