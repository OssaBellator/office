import { readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import process from 'node:process'
import { cloneSeedWorkspace } from '../src/model.ts'
import { simulateOfficeMigration } from '../src/officeMigrationSimulation.ts'
import { importWorkspaceSession } from '../src/workspaceIO.ts'

const directory=process.argv[2]
const workspacePath=process.argv.find((value)=>value.startsWith('--workspace='))?.slice('--workspace='.length)
const outputPath=process.argv.find((value)=>value.startsWith('--output='))?.slice('--output='.length)
if(!directory){
  console.error('Usage: node --experimental-strip-types scripts/simulate-office-migration.mjs <directory> [--workspace=frame.json] [--output=report.json]')
  process.exitCode=2
}else{
  try{
    const root=resolve(directory),workspace=workspacePath?importWorkspaceSession(await readFile(resolve(workspacePath),'utf8')).present:cloneSeedWorkspace()
    const files=(await readdir(root,{withFileTypes:true})).filter((entry)=>entry.isFile()&&['.docx','.pptx','.xlsx'].includes(extname(entry.name).toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name))
    const inputs=[];for(const file of files)inputs.push({name:file.name,bytes:new Uint8Array(await readFile(resolve(root,file.name)))})
    const simulation=await simulateOfficeMigration(workspace,inputs)
    const report={files:simulation.files,formulaTranslation:simulation.formulaTranslation,importedReview:simulation.importedReview,exportReview:simulation.exportReview,revisionLedger:simulation.ledger,simulatedTransactions:simulation.session.past.length}
    console.log(`Frame migration rehearsal: ${simulation.files.filter((item)=>item.status==='applied').length} applied in memory · ${simulation.files.filter((item)=>item.status==='duplicate-skipped').length} duplicate-skipped · ${simulation.files.filter((item)=>item.status==='failed').length} failed · ${simulation.session.past.length} simulated semantic transactions`)
    console.log(`Formula translation: ${simulation.formulaTranslation.ready}/${simulation.formulaTranslation.total} ready · ${simulation.formulaTranslation.requiresModelPromotion} need model promotion · ${simulation.formulaTranslation.unsupported} unsupported`)
    console.log(`Imported review notes: ${simulation.importedReview.total}`)
    for(const file of simulation.files){console.log(`${file.status.toUpperCase().padEnd(17)} ${file.name}${file.error?` — ${file.error}`:''}`)}
    if(outputPath)await writeFile(resolve(outputPath),JSON.stringify(report,null,2))
  }catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1}
}
