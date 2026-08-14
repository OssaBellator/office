import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { getImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { planOfficeImport } from '../src/officeImportPlanner.ts'
import { synchronizeOfficeImportPlan } from '../src/officeImportSync.ts'
import { getPresentationState } from '../src/presentationState.ts'
import { getSemanticDocument } from '../src/semanticDocument.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'

const args=process.argv.slice(2)
const json=args.includes('--json')
const fileArg=args.find((arg)=>!arg.startsWith('--'))
if(!fileArg){console.error('Usage: node --experimental-strip-types scripts/inspect-office-import.mjs <file.docx|file.pptx|file.xlsx> [--json]');process.exitCode=2}else{
  const path=resolve(fileArg),fileName=basename(path),bytes=new Uint8Array(await readFile(path)),workspace=cloneSeedWorkspace()
  try{
    const raw=await planOfficeImport(workspace,bytes,fileName)
    const plan=synchronizeOfficeImportPlan(workspace,raw,fileName)
    let session=createVersionedWorkspaceSession(workspace)
    for(const command of plan.commands)session=executeVersionedWorkspaceCommand(session,command)
    const semantic=getSemanticDocument(session.present),tables=getImportedTables(session.present),presentation=getPresentationState(session.present)
    const commandCounts=Object.fromEntries([...new Set(plan.commands.map((command)=>command.type))].sort().map((type)=>[type,plan.commands.filter((command)=>command.type===type).length]))
    const report={
      file:fileName,
      kind:plan.kind,
      label:plan.label,
      importedItems:plan.importedItems,
      warnings:plan.warnings,
      commandCounts,
      result:{
        semanticBlocks:semantic.blocks.length,
        importedDocumentBlocks:semantic.blocks.filter((block)=>block.type==='paragraph'&&block.source===fileName).length,
        importedTables:tables.map((table)=>({label:table.label,source:table.source,rows:table.rows.length,columns:table.columns.length,preservedFormulas:Object.keys(table.formulaByCell??{}).length})),
        importedScenes:(presentation.importedScenes??[]).map((scene)=>({title:scene.title,source:scene.source,bodyLines:scene.body.length,hasSpeakerNote:Boolean(scene.note)})),
      },
    }
    if(json)console.log(JSON.stringify(report,null,2))
    else{
      console.log(`${report.kind.toUpperCase()} · ${report.label}`)
      console.log(`Imported items: ${report.importedItems}`)
      console.log(`Commands: ${Object.entries(commandCounts).map(([type,count])=>`${type} × ${count}`).join(', ')||'none'}`)
      if(report.warnings.length){console.log('\nFidelity warnings:');for(const warning of report.warnings)console.log(`- ${warning}`)}else console.log('\nFidelity warnings: none')
      console.log(`\nResult: ${report.result.importedDocumentBlocks} imported document blocks · ${report.result.importedTables.length} imported tables · ${report.result.importedScenes.length} imported scenes`)
      for(const table of report.result.importedTables)console.log(`- Table ${table.label}: ${table.rows} rows × ${table.columns} columns · ${table.preservedFormulas} preserved formulas · ${table.source}`)
      for(const scene of report.result.importedScenes)console.log(`- Scene ${scene.title}: ${scene.bodyLines} body lines · ${scene.hasSpeakerNote?'speaker note':'no speaker note'} · ${scene.source}`)
    }
  }catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1}
}
