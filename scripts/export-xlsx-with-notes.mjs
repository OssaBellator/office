import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import { importWorkspaceSession } from '../src/workspaceIO.ts'
import { exportWorkspaceXlsxWithClassicNotes } from '../src/officeXlsxNotesExport.ts'
import { validateOfficePackage } from '../src/officePackageValidator.ts'

const input=process.argv[2],output=process.argv[3]
if(!input){
  console.error('Usage: node --experimental-strip-types scripts/export-xlsx-with-notes.mjs <frame-workspace.json> [output.xlsx]')
  process.exitCode=2
}else{
  try{
    const session=importWorkspaceSession(await readFile(input,'utf8'))
    const file=await exportWorkspaceXlsxWithClassicNotes(session.present)
    const target=resolve(output||file.filename)
    const validation=await validateOfficePackage(file.bytes)
    if(!validation.valid)throw new Error(`Generated package failed Frame OPC validation: ${validation.issues.map((issue)=>issue.detail).join('; ')}`)
    await writeFile(target,file.bytes)
    console.log(`Wrote ${basename(target)} with classic Excel note parts. Open this file in current Microsoft Excel and verify that comments/notes render without a repair prompt before promoting this writer into normal product export.`)
  }catch(error){
    console.error(error instanceof Error?error.message:String(error))
    process.exitCode=1
  }
}
