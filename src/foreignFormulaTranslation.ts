import { getImportedTables, importedTableCellKey, type ImportedDataTable } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'

export type ForeignFormulaTranslation={
  status:'translatable'|'unsupported'
  sourceFormula:string
  frameFormula?:string
  functionName?:'SUM'|'AVERAGE'|'MIN'|'MAX'|'COUNT'
  tableName?:string
  fieldName?:string
  reason:string
}
export type ForeignFormulaProposal={
  tableId:string
  tableLabel:string
  rowId:string
  columnId:string
  columnLabel:string
  source:string
  sourceFormula:string
  translation:ForeignFormulaTranslation
}

const aggregates=new Set(['SUM','AVERAGE','MIN','MAX','COUNT'])
function cleanName(value:string){return value.trim().replace(/^'+|'+$/g,'')}
function safeSemanticName(value:string){return /^[A-Za-z_][A-Za-z0-9 _.-]*$/.test(value)&&!/[\[\]!]/.test(value)}

/**
 * Translate only a deliberately small Excel structured-reference subset.
 * Examples:
 *   SUM(Regions[Revenue]) -> SUM(Regions.Revenue)
 *   =AVERAGE('Pipeline'[ARR]) -> AVERAGE(Pipeline.ARR)
 * Everything with cell/range refs, arithmetic, external refs or nesting stays inert.
 */
export function translateForeignFormula(formula:string):ForeignFormulaTranslation{
  const sourceFormula=formula.trim(),expression=sourceFormula.replace(/^=/,'').trim()
  if(!expression)return{status:'unsupported',sourceFormula,reason:'Formula is blank.'}
  if(/[!]/.test(expression))return{status:'unsupported',sourceFormula,reason:'Sheet/range references require workbook context and are not translated automatically.'}
  if(/\[[^\]]+\][!]/.test(expression)||/https?:|\\\\|file:/i.test(expression))return{status:'unsupported',sourceFormula,reason:'External references are never translated automatically.'}
  if(/\b(?:NOW|TODAY|RAND|RANDBETWEEN|OFFSET|INDIRECT|CELL|INFO)\s*\(/i.test(expression))return{status:'unsupported',sourceFormula,reason:'Volatile or indirect spreadsheet functions are not translated automatically.'}
  const match=expression.match(/^([A-Za-z]+)\s*\(\s*('?[A-Za-z_][A-Za-z0-9 _.-]*'?)\s*\[\s*([^\[\]]+?)\s*\]\s*\)$/)
  if(!match)return{status:'unsupported',sourceFormula,reason:'Only one aggregate over one Excel structured table column is currently translatable.'}
  const fn=match[1].toUpperCase();if(!aggregates.has(fn))return{status:'unsupported',sourceFormula,reason:`${fn} is not in Frame's safe aggregate translation subset.`}
  const tableName=cleanName(match[2]),fieldName=cleanName(match[3])
  if(!safeSemanticName(tableName)||!safeSemanticName(fieldName))return{status:'unsupported',sourceFormula,reason:'Structured reference names contain unsupported characters.'}
  const frameFormula=`${fn}(${tableName}.${fieldName})`
  return{status:'translatable',sourceFormula,frameFormula,functionName:fn as ForeignFormulaTranslation['functionName'],tableName,fieldName,reason:'Simple structured aggregate can map directly to a Frame semantic aggregate.'}
}

function proposalsForTable(table:ImportedDataTable):ForeignFormulaProposal[]{
  const proposals:ForeignFormulaProposal[]=[]
  for(const row of table.rows)for(const column of table.columns){
    const formula=table.formulaByCell?.[importedTableCellKey(row.id,column.id)];if(!formula)continue
    proposals.push({tableId:table.id,tableLabel:table.label,rowId:row.id,columnId:column.id,columnLabel:column.label,source:table.source,sourceFormula:formula,translation:translateForeignFormula(formula)})
  }
  return proposals
}

export function proposeForeignFormulaTranslations(workspace:WorkspaceState){return getImportedTables(workspace).flatMap(proposalsForTable)}
export function translatableForeignFormulaProposals(workspace:WorkspaceState){return proposeForeignFormulaTranslations(workspace).filter((proposal)=>proposal.translation.status==='translatable')}
