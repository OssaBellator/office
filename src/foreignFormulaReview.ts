import { proposeForeignFormulaTranslations, type ForeignFormulaProposal } from './foreignFormulaTranslation.ts'
import { getImportedTables } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'

export type ForeignFormulaReviewStatus='ready'|'unsupported'|'missing-table'|'missing-field'|'requires-model-promotion'
export type ForeignFormulaReview={proposal:ForeignFormulaProposal;status:ForeignFormulaReviewStatus;reason:string;resolvedTable?:string;resolvedField?:string}

function normalize(value:string){return value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'')}
const coreTables=[
  {name:'Regions',fields:['Region','Revenue','Growth','Margin']},
  {name:'Plan',fields:['Region','Revenue']},
]

export function reviewForeignFormulaProposal(workspace:WorkspaceState,proposal:ForeignFormulaProposal):ForeignFormulaReview{
  const translation=proposal.translation
  if(translation.status!=='translatable'||!translation.tableName||!translation.fieldName)return{proposal,status:'unsupported',reason:translation.reason}
  const tableKey=normalize(translation.tableName),fieldKey=normalize(translation.fieldName)
  const core=coreTables.find((table)=>normalize(table.name)===tableKey)
  if(core){
    const field=core.fields.find((item)=>normalize(item)===fieldKey)
    if(!field)return{proposal,status:'missing-field',reason:`${core.name} exists in Frame, but ${translation.fieldName} is not a supported semantic field.`,resolvedTable:core.name}
    return{proposal,status:'ready',reason:'Structured aggregate resolves to an existing Frame semantic table and field.',resolvedTable:core.name,resolvedField:field}
  }
  const imported=getImportedTables(workspace).filter((table)=>normalize(table.label)===tableKey)
  if(imported.length){
    const field=imported.flatMap((table)=>table.columns).find((column)=>normalize(column.label)===fieldKey)
    if(!field)return{proposal,status:'missing-field',reason:`Imported Data table ${translation.tableName} exists, but field ${translation.fieldName} was not found.`,resolvedTable:translation.tableName}
    return{proposal,status:'requires-model-promotion',reason:'The reference resolves to retained imported Data. Promote/model this table before translating the formula into the executable Frame formula graph.',resolvedTable:translation.tableName,resolvedField:field.label}
  }
  return{proposal,status:'missing-table',reason:`Frame cannot resolve table ${translation.tableName} in the live semantic model or retained imported Data.`}
}

export function reviewForeignFormulaTranslations(workspace:WorkspaceState){return proposeForeignFormulaTranslations(workspace).map((proposal)=>reviewForeignFormulaProposal(workspace,proposal))}
export function readyForeignFormulaTranslations(workspace:WorkspaceState){return reviewForeignFormulaTranslations(workspace).filter((review)=>review.status==='ready')}
