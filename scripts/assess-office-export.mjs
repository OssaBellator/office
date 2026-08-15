import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { importWorkspaceSession } from '../src/workspaceIO.ts'
import { assessOfficeReviewExport } from '../src/officeReviewAssessment.ts'

const input=process.argv[2]
if(!input){console.error('Usage: node --experimental-strip-types scripts/assess-office-export.mjs <frame-workspace.json>');process.exitCode=2}else{
  try{
    const raw=await readFile(input,'utf8')
    const session=importWorkspaceSession(raw)
    const assessment=assessOfficeReviewExport(session.present)
    console.log(JSON.stringify(assessment,null,2))
  }catch(error){
    console.error(error instanceof Error?error.message:String(error))
    process.exitCode=1
  }
}
