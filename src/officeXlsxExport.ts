import { getImportedTables, type ImportedDataTable } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { createStoredZip, type OfficeExportFile } from './officeExportLegacy.ts'

const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
function xml(value:unknown){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'workspace'}
function cellReference(column:number,row:number){let n=column+1,letters='';while(n){const r=(n-1)%26;letters=String.fromCharCode(65+r)+letters;n=Math.floor((n-1)/26)}return`${letters}${row}`}
function sheetXml(rows:Array<Array<string|number|null>>){return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row,rowIndex)=>`<row r="${rowIndex+1}">${row.map((value,columnIndex)=>{if(value===null||value===undefined)return'';const ref=cellReference(columnIndex,rowIndex+1);return typeof value==='number'&&Number.isFinite(value)?`<c r="${ref}"><v>${value}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`}).join('')}</row>`).join('')}</sheetData></worksheet>`}
function importedRows(table:ImportedDataTable):Array<Array<string|number|null>>{return[table.columns.map((column)=>column.label),...table.rows.map((row)=>table.columns.map((column)=>row.values[column.id]??null))]}

export function safeExcelSheetNames(labels:string[]){
  const names:string[]=[],used=new Set<string>()
  for(const label of labels){
    const cleaned=label.replace(/[\\/*?:[\]]/g,' ').replace(/^'+|'+$/g,'').trim()||'Sheet'
    const base=cleaned.slice(0,31)||'Sheet'
    let candidate=base,index=2
    while(used.has(candidate.toLocaleLowerCase('en-US'))){const suffix=` ${index++}`;candidate=`${base.slice(0,31-suffix.length)}${suffix}`}
    names.push(candidate);used.add(candidate.toLocaleLowerCase('en-US'))
  }
  return names
}

export function exportWorkspaceXlsxSafe(workspace:WorkspaceState):OfficeExportFile{
  const tables=[
    {name:'Regions',rows:[['Region','Revenue','Growth','Margin'],...workspace.regions.map((row)=>[row.region,row.revenue,row.growth,row.margin] as Array<string|number|null>)]},
    {name:'Plan',rows:[['Region','Revenue'],...workspace.plans.map((row)=>[row.region,row.revenue] as Array<string|number|null>)]},
    ...getImportedTables(workspace).map((table)=>({name:table.label,rows:importedRows(table)})),
  ]
  const names=safeExcelSheetNames(tables.map((table)=>table.name))
  const overrides=tables.map((_,index)=>`<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`
  const rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
  const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name,index)=>`<sheet name="${xml(name)}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join('')}</sheets></workbook>`
  const workbookRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables.map((_,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join('')}</Relationships>`
  const files:Record<string,string>={'[Content_Types].xml':contentTypes,'_rels/.rels':rootRels,'xl/workbook.xml':workbook,'xl/_rels/workbook.xml.rels':workbookRels}
  tables.forEach((table,index)=>{files[`xl/worksheets/sheet${index+1}.xml`]=sheetXml(table.rows)})
  return{filename:`frame-${slug(workspace.title)}.xlsx`,mimeType:XLSX_MIME,bytes:createStoredZip(files)}
}
