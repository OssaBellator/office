import { getImportedTableNumberFormat, getImportedTables, type ImportedDataTable, type ImportedDateSystem, type ImportedNumberFormat, type ImportedTableCell } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { createStoredZip, type OfficeExportFile } from './officeExportLegacy.ts'
import type { ImportedSheetVisibility } from './officeParsers.ts'

const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
function xml(value:unknown){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'workspace'}
function cellReference(column:number,row:number){let n=column+1,letters='';while(n){const r=(n-1)%26;letters=String.fromCharCode(65+r)+letters;n=Math.floor((n-1)/26)}return`${letters}${row}`}
function importedRows(table:ImportedDataTable):Array<Array<ImportedTableCell>>{return[table.columns.map((column)=>column.label),...table.rows.map((row)=>table.columns.map((column)=>row.values[column.id]??null))]}

type ExportTable={name:string;rows:Array<Array<ImportedTableCell>>;visibility?:ImportedSheetVisibility;sourceTable?:ImportedDataTable}
type StyleEntry={styleIndex:number;numFmtId:number;formatCode?:string}
type StyleCatalog={byKey:Map<string,StyleEntry>;customFormats:Array<{numFmtId:number;formatCode:string}>;dateSystem:ImportedDateSystem}
const builtinDateFormatIds=new Set([14,15,16,17,18,19,20,21,22,27,28,29,30,31,32,33,34,35,36,45,46,47,50,51,52,53,54,55,56,57,58])

function formatKey(format:ImportedNumberFormat){return format.formatCode!==undefined?`code:${format.formatCode}`:`id:${format.numFmtId}`}
function looksDateLike(format:ImportedNumberFormat){
  if(builtinDateFormatIds.has(format.numFmtId))return true
  if(!format.formatCode)return false
  const stripped=format.formatCode.replace(/"[^"]*"/g,'').replace(/\\./g,'').replace(/\[[^\]]*\]/g,'')
  return /(^|[^a-z])[ymdhis]+([^a-z]|$)/i.test(stripped)
}
function chooseExportDateSystem(tables:ImportedDataTable[]):ImportedDateSystem{
  const systems=new Set(tables.filter((table)=>Object.keys(table.numberFormatByCell??{}).length>0).map((table)=>table.sourceDateSystem??'1900'))
  return systems.size===1?[...systems][0]:'1900'
}
function canEmitFormat(table:ImportedDataTable,format:ImportedNumberFormat,dateSystem:ImportedDateSystem){
  const source=table.sourceDateSystem??'1900'
  return source===dateSystem||!looksDateLike(format)
}
function buildStyleCatalog(tables:ImportedDataTable[]):StyleCatalog{
  const dateSystem=chooseExportDateSystem(tables),byKey=new Map<string,StyleEntry>(),customFormats:Array<{numFmtId:number;formatCode:string}>=[]
  let nextStyleIndex=1,nextCustomId=164
  for(const table of tables)for(const format of Object.values(table.numberFormatByCell??{})){
    if(!canEmitFormat(table,format,dateSystem))continue
    const key=formatKey(format);if(byKey.has(key))continue
    const numFmtId=format.formatCode!==undefined?nextCustomId++:format.numFmtId
    const entry={styleIndex:nextStyleIndex++,numFmtId,...(format.formatCode!==undefined?{formatCode:format.formatCode}:{})}
    byKey.set(key,entry);if(entry.formatCode!==undefined)customFormats.push({numFmtId,formatCode:entry.formatCode})
  }
  return{byKey,customFormats,dateSystem}
}
function styleIndexFor(table:ImportedDataTable,rowIndex:number,columnIndex:number,catalog:StyleCatalog){
  if(rowIndex===0)return 0
  const row=table.rows[rowIndex-1],column=table.columns[columnIndex];if(!row||!column)return 0
  const format=getImportedTableNumberFormat(table,row.id,column.id);if(!format||!canEmitFormat(table,format,catalog.dateSystem))return 0
  return catalog.byKey.get(formatKey(format))?.styleIndex??0
}
function sheetXml(table:ExportTable,catalog:StyleCatalog){return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${table.rows.map((row,rowIndex)=>`<row r="${rowIndex+1}">${row.map((value,columnIndex)=>{if(value===null||value===undefined)return'';const ref=cellReference(columnIndex,rowIndex+1),styleIndex=table.sourceTable?styleIndexFor(table.sourceTable,rowIndex,columnIndex,catalog):0,style=styleIndex?` s="${styleIndex}"`:'';if(typeof value==='boolean')return`<c r="${ref}"${style} t="b"><v>${value?1:0}</v></c>`;return typeof value==='number'&&Number.isFinite(value)?`<c r="${ref}"${style}><v>${value}</v></c>`:`<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`}).join('')}</row>`).join('')}</sheetData></worksheet>`}

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

function sheetStateAttribute(visibility:ImportedSheetVisibility|undefined){return visibility&&visibility!=='visible'?` state="${visibility}"`:''}
function stylesXml(catalog:StyleCatalog){
  const custom=catalog.customFormats.length?`<numFmts count="${catalog.customFormats.length}">${catalog.customFormats.map((format)=>`<numFmt numFmtId="${format.numFmtId}" formatCode="${xml(format.formatCode)}"/>`).join('')}</numFmts>`:''
  const entries=[...catalog.byKey.values()].sort((left,right)=>left.styleIndex-right.styleIndex)
  return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${custom}<fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${entries.length+1}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>${entries.map((entry)=>`<xf numFmtId="${entry.numFmtId}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
}

export function exportWorkspaceXlsxSafe(workspace:WorkspaceState):OfficeExportFile{
  const imported=getImportedTables(workspace),catalog=buildStyleCatalog(imported)
  const tables:Array<ExportTable>=[
    {name:'Regions',rows:[['Region','Revenue','Growth','Margin'],...workspace.regions.map((row)=>[row.region,row.revenue,row.growth,row.margin] as Array<ImportedTableCell>)]},
    {name:'Plan',rows:[['Region','Revenue'],...workspace.plans.map((row)=>[row.region,row.revenue] as Array<ImportedTableCell>)]},
    ...imported.map((table)=>({name:table.label,rows:importedRows(table),visibility:table.sourceVisibility,sourceTable:table})),
  ]
  const names=safeExcelSheetNames(tables.map((table)=>table.name)),hasStyles=catalog.byKey.size>0
  const overrides=tables.map((_,index)=>`<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  const styleOverride=hasStyles?'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>':''
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${styleOverride}${overrides}</Types>`
  const rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
  const workbookPr=catalog.dateSystem==='1904'?'<workbookPr date1904="1"/>':''
  const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${workbookPr}<sheets>${names.map((name,index)=>`<sheet name="${xml(name)}" sheetId="${index+1}" r:id="rId${index+1}"${sheetStateAttribute(tables[index].visibility)}/>`).join('')}</sheets></workbook>`
  const styleRelationship=hasStyles?`<Relationship Id="rId${tables.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`:''
  const workbookRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables.map((_,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join('')}${styleRelationship}</Relationships>`
  const files:Record<string,string>={'[Content_Types].xml':contentTypes,'_rels/.rels':rootRels,'xl/workbook.xml':workbook,'xl/_rels/workbook.xml.rels':workbookRels}
  if(hasStyles)files['xl/styles.xml']=stylesXml(catalog)
  tables.forEach((table,index)=>{files[`xl/worksheets/sheet${index+1}.xml`]=sheetXml(table,catalog)})
  return{filename:`frame-${slug(workspace.title)}.xlsx`,mimeType:XLSX_MIME,bytes:createStoredZip(files)}
}
