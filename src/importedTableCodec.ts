import type { ImportedCellComment, ImportedCellLink, ImportedDataTable, ImportedNumberFormat, ImportedTableCell } from './importedTables.ts'

function record(value:unknown,field:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${field} must be a JSON object`);return value as Record<string,unknown>}
function text(value:unknown,field:string){if(typeof value!=='string')throw new Error(`${field} must be a string`);return value}
function number(value:unknown,field:string){if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`${field} must be a finite number`);return value}
function oneOf<T extends string>(value:unknown,field:string,allowed:readonly T[]):T{const result=text(value,field) as T;if(!allowed.includes(result))throw new Error(`${field} must be one of: ${allowed.join(', ')}`);return result}
function array(value:unknown,field:string){if(!Array.isArray(value))throw new Error(`${field} must be an array`);return value}
function importedCell(value:unknown,field:string):ImportedTableCell{if(value===null||typeof value==='string'||typeof value==='boolean')return value;if(typeof value==='number'&&Number.isFinite(value))return value;throw new Error(`${field} must be text, a finite number, a boolean, or null`)}
function parseImportedNumberFormat(value:unknown,field:string):ImportedNumberFormat{const input=record(value,field),numFmtId=number(input.numFmtId,`${field}.numFmtId`);if(!Number.isInteger(numFmtId)||numFmtId<0)throw new Error(`${field}.numFmtId must be a non-negative integer`);const formatCode=input.formatCode===undefined?undefined:text(input.formatCode,`${field}.formatCode`);return{numFmtId,...(formatCode!==undefined?{formatCode}:{})}}
function parseImportedCellLink(value:unknown,field:string):ImportedCellLink{const input=record(value,field),kind=oneOf(input.kind,`${field}.kind`,['external','internal'] as const),target=text(input.target,`${field}.target`);if(!target.trim())throw new Error(`${field}.target must not be blank`);const display=input.display===undefined?undefined:text(input.display,`${field}.display`),tooltip=input.tooltip===undefined?undefined:text(input.tooltip,`${field}.tooltip`);return{kind,target,...(display!==undefined?{display}:{}),...(tooltip!==undefined?{tooltip}:{})}}
function parseImportedCellComment(value:unknown,field:string):ImportedCellComment{const input=record(value,field),commentText=text(input.text,`${field}.text`);if(!commentText.trim())throw new Error(`${field}.text must not be blank`);const author=input.author===undefined?undefined:text(input.author,`${field}.author`);return{text:commentText,...(author!==undefined?{author}:{})}}

export function parseImportedDataTable(value:unknown):ImportedDataTable{
  const input=record(value,'table')
  const columns=array(input.columns,'table.columns').map((item,index)=>{const column=record(item,`table.columns[${index}]`);return{id:text(column.id,`table.columns[${index}].id`),label:text(column.label,`table.columns[${index}].label`),type:oneOf(column.type,`table.columns[${index}].type`,['text','number','boolean'] as const)}})
  const columnIds=new Set(columns.map((column)=>column.id))
  const rows=array(input.rows,'table.rows').map((item,rowIndex)=>{const row=record(item,`table.rows[${rowIndex}]`),values=record(row.values,`table.rows[${rowIndex}].values`);for(const key of Object.keys(values))if(!columnIds.has(key))throw new Error(`table.rows[${rowIndex}].values contains unknown column ${key}`);return{id:text(row.id,`table.rows[${rowIndex}].id`),values:Object.fromEntries(columns.map((column)=>[column.id,importedCell(values[column.id]??null,`table.rows[${rowIndex}].values.${column.id}`)]))}})
  const validKeys=new Set(rows.flatMap((row)=>columns.map((column)=>`${row.id}\u0000${column.id}`)))
  const parseCellMap=<T>(rawValue:unknown|undefined,field:string,parser:(value:unknown,field:string)=>T):Record<string,T>|undefined=>{
    if(rawValue===undefined)return undefined
    const raw=record(rawValue,field),parsed:Record<string,T>={}
    for(const [key,value] of Object.entries(raw)){if(!validKeys.has(key))throw new Error(`${field} contains unknown cell ${key}`);parsed[key]=parser(value,`${field}.${key}`)}
    return Object.keys(parsed).length?parsed:undefined
  }
  const formulaByCell=parseCellMap(input.formulaByCell,'table.formulaByCell',(value,field)=>text(value,field))
  const numberFormatByCell=parseCellMap(input.numberFormatByCell,'table.numberFormatByCell',parseImportedNumberFormat)
  const linkByCell=parseCellMap(input.linkByCell,'table.linkByCell',parseImportedCellLink)
  const commentByCell=parseCellMap(input.commentByCell,'table.commentByCell',parseImportedCellComment)
  const sourceVisibility=input.sourceVisibility===undefined?undefined:oneOf(input.sourceVisibility,'table.sourceVisibility',['visible','hidden','veryHidden'] as const)
  const sourceDateSystem=input.sourceDateSystem===undefined?undefined:oneOf(input.sourceDateSystem,'table.sourceDateSystem',['1900','1904'] as const)
  return{id:text(input.id,'table.id'),label:text(input.label,'table.label'),source:text(input.source,'table.source'),columns,rows,importedAt:text(input.importedAt,'table.importedAt'),...(formulaByCell?{formulaByCell}:{}),...(numberFormatByCell?{numberFormatByCell}:{}),...(linkByCell?{linkByCell}:{}),...(commentByCell?{commentByCell}:{}),...(sourceVisibility?{sourceVisibility}:{}),...(sourceDateSystem?{sourceDateSystem}:{})}
}
