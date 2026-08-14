import { readOfficeXml, readOfficeZip } from './officeArchive.ts'
import { parseDocxDocumentXml, parsePptxSlideXml, parseXlsxSharedStrings, parseXlsxWorkbook, type ImportedSheet } from './officeParsers.ts'
import { getSemanticDocument, type SemanticParagraphStyle } from './semanticDocument.ts'
import { getPresentationState, type ImportedPresentationScene } from './presentationState.ts'
import type { WorkspaceState } from './model.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'

export type OfficeImportKind = 'docx' | 'pptx' | 'xlsx'
export type OfficeImportPlan = {
  kind: OfficeImportKind
  label: string
  commands: VersionedWorkspaceCommand[]
  warnings: string[]
  importedItems: number
}

function suffix() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}` }
function slug(value: string) { return value.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'office' }
function normalized(value: unknown) { return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '') }
function numberValue(value: unknown) { const result=typeof value==='number'?value:Number(String(value??'').replace(/[$,%\s]/g,'')); return Number.isFinite(result)?result:null }
function nearlyEqual(a: number, b: number) { return Math.abs(a-b) < 1e-9 }

export async function planDocxImport(workspace: WorkspaceState, input: ArrayBuffer | Uint8Array, fileName: string): Promise<OfficeImportPlan> {
  const entries = await readOfficeZip(input)
  const documentXml = readOfficeXml(entries, 'word/document.xml')
  if (!documentXml) throw new Error('DOCX is missing word/document.xml')
  const blocks = parseDocxDocumentXml(documentXml, readOfficeXml(entries, 'word/numbering.xml'))
  if (!blocks.length) throw new Error('DOCX contains no importable text blocks')
  const startIndex = getSemanticDocument(workspace).blocks.length
  const importSuffix = suffix()
  const commands: VersionedWorkspaceCommand[] = blocks.map((block,index) => ({
    type:'document.block.insert',
    index:startIndex+index,
    block:{ id:`block:import:${importSuffix}:${index+1}`, type:'paragraph', text:block.text, style:(block.kind === 'paragraph' ? 'body' : block.kind) as SemanticParagraphStyle },
  }))
  return { kind:'docx', label:`${fileName} · ${blocks.length} document blocks`, commands, warnings:[], importedItems:blocks.length }
}

function slidePaths(entries: Map<string, Uint8Array>) {
  return [...entries.keys()].flatMap((path) => {
    const match = path.match(/^ppt\/slides\/slide(\d+)\.xml$/i)
    return match ? [{ path, number:Number(match[1]) }] : []
  }).sort((a,b)=>a.number-b.number)
}

export async function planPptxImport(workspace: WorkspaceState, input: ArrayBuffer | Uint8Array, fileName: string): Promise<OfficeImportPlan> {
  const entries = await readOfficeZip(input)
  const paths = slidePaths(entries)
  if (!paths.length) throw new Error('PPTX contains no slides')
  const importId = suffix()
  const fileSlug = slug(fileName)
  const source = `${fileName} · imported from PowerPoint / Google Slides export`
  const importedScenes: ImportedPresentationScene[] = paths.map(({path,number}) => {
    const xml = readOfficeXml(entries,path)!
    const note = readOfficeXml(entries,`ppt/notesSlides/notesSlide${number}.xml`)
    const slide = parsePptxSlideXml(xml,note)
    return { id:`imported:${fileSlug}-${importId}-${number}`, title:slide.title, body:slide.body, note:slide.note || undefined, source }
  })
  const state = getPresentationState(workspace)
  const next = { ...state, importedScenes:[...(state.importedScenes ?? []),...importedScenes], order:[...state.order,...importedScenes.map((scene)=>scene.id)] }
  return { kind:'pptx', label:`${fileName} · ${importedScenes.length} slides`, commands:[{type:'presentation.replace',value:next}], warnings:[], importedItems:importedScenes.length }
}

function sheetHeader(sheet: ImportedSheet) {
  const rowIndex = sheet.rows.findIndex((row)=>row.some((cell)=>String(cell??'').trim()))
  if (rowIndex < 0) return null
  const headers = sheet.rows[rowIndex].map(normalized)
  return { rowIndex, headers, index:(name:string)=>headers.indexOf(normalized(name)) }
}
function findRegionId(workspace: WorkspaceState, value: unknown) {
  const key = normalized(value)
  return workspace.regions.find((row)=>normalized(row.id)===key||normalized(row.region)===key)?.id ?? null
}
function percentScale(values: Array<number | null>) {
  const present=values.filter((value):value is number=>value!==null)
  return present.length > 0 && present.every((value)=>Math.abs(value)<=1) ? 100 : 1
}

function planActualSheet(workspace: WorkspaceState, sheet: ImportedSheet, commands: VersionedWorkspaceCommand[], warnings: string[]) {
  const header=sheetHeader(sheet); if(!header)return 0
  const indexes={region:header.index('Region'),revenue:header.index('Revenue'),growth:header.index('Growth'),margin:header.index('Margin')}
  if(Object.values(indexes).some((index)=>index<0))return 0
  const data=sheet.rows.slice(header.rowIndex+1).filter((row)=>row.some((cell)=>cell!==null&&String(cell).trim()!==''))
  const growthScale=percentScale(data.map((row)=>numberValue(row[indexes.growth])))
  const marginScale=percentScale(data.map((row)=>numberValue(row[indexes.margin])))
  let matched=0
  for(const row of data){
    const regionId=findRegionId(workspace,row[indexes.region]); if(!regionId){warnings.push(`${sheet.name}: skipped unknown region ${String(row[indexes.region]??'')}`);continue}
    const current=workspace.regions.find((item)=>item.id===regionId)!; matched+=1
    const revenue=numberValue(row[indexes.revenue]),growth=numberValue(row[indexes.growth]),margin=numberValue(row[indexes.margin])
    if(revenue!==null&&!nearlyEqual(current.revenue,revenue))commands.push({type:'region.update',regionId,field:'revenue',value:revenue})
    if(growth!==null&&!nearlyEqual(current.growth,growth*growthScale))commands.push({type:'region.update',regionId,field:'growth',value:growth*growthScale})
    if(margin!==null&&!nearlyEqual(current.margin,margin*marginScale))commands.push({type:'region.update',regionId,field:'margin',value:margin*marginScale})
  }
  return matched
}

function planPlanSheet(workspace: WorkspaceState, sheet: ImportedSheet, commands: VersionedWorkspaceCommand[], warnings: string[]) {
  const header=sheetHeader(sheet); if(!header)return 0
  const regionIndex=header.index('Region'),revenueIndex=header.index('Revenue')
  if(regionIndex<0||revenueIndex<0)return 0
  const name=normalized(sheet.name)
  if(!/(plan|budget|forecast)/.test(name)&&header.headers.filter(Boolean).length>2)return 0
  let matched=0
  for(const row of sheet.rows.slice(header.rowIndex+1)){
    if(!row.some((cell)=>cell!==null&&String(cell).trim()!==''))continue
    const regionId=findRegionId(workspace,row[regionIndex]); if(!regionId){warnings.push(`${sheet.name}: skipped unknown plan region ${String(row[regionIndex]??'')}`);continue}
    const current=workspace.plans.find((item)=>item.id===regionId); if(!current)continue; matched+=1
    const revenue=numberValue(row[revenueIndex]); if(revenue!==null&&!nearlyEqual(current.revenue,revenue))commands.push({type:'plan.update',planId:regionId,field:'revenue',value:revenue})
  }
  return matched
}

export async function planXlsxImport(workspace: WorkspaceState, input: ArrayBuffer | Uint8Array, fileName: string): Promise<OfficeImportPlan> {
  const entries=await readOfficeZip(input)
  const workbook=readOfficeXml(entries,'xl/workbook.xml'),relationships=readOfficeXml(entries,'xl/_rels/workbook.xml.rels')
  if(!workbook||!relationships)throw new Error('XLSX is missing workbook metadata')
  const shared=parseXlsxSharedStrings(readOfficeXml(entries,'xl/sharedStrings.xml'))
  const xmlByPath=new Map<string,string>()
  for(const path of entries.keys())if(/^xl\/worksheets\/[^/]+\.xml$/i.test(path)){const xml=readOfficeXml(entries,path);if(xml)xmlByPath.set(path,xml)}
  const sheets=parseXlsxWorkbook(workbook,relationships,xmlByPath,shared)
  const commands:VersionedWorkspaceCommand[]=[],warnings:string[]=[]
  let matched=0
  for(const sheet of sheets){matched+=planActualSheet(workspace,sheet,commands,warnings);matched+=planPlanSheet(workspace,sheet,commands,warnings)}
  if(!matched)throw new Error('No compatible worksheet found. Frame currently recognises Region/Revenue/Growth/Margin actuals and Region/Revenue plan sheets.')
  return {kind:'xlsx',label:`${fileName} · ${sheets.length} sheets`,commands,warnings,importedItems:matched}
}

export async function planOfficeImport(workspace: WorkspaceState, input: ArrayBuffer | Uint8Array, fileName: string): Promise<OfficeImportPlan> {
  const extension=fileName.toLowerCase().split('.').pop()
  if(extension==='docx')return planDocxImport(workspace,input,fileName)
  if(extension==='pptx')return planPptxImport(workspace,input,fileName)
  if(extension==='xlsx')return planXlsxImport(workspace,input,fileName)
  if(extension==='gdoc'||extension==='gslides'||extension==='gsheet')throw new Error('Google Drive pointer files do not contain document content. In Google, use File → Download and choose DOCX, PPTX, or XLSX, then import that file into Frame.')
  throw new Error(`Unsupported Office import format: .${extension ?? ''}`)
}
