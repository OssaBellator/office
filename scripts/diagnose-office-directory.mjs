import { readdir, readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import process from 'node:process'
import { cloneSeedWorkspace } from '../src/model.ts'
import { diagnoseOfficeBatch } from '../src/officeBatchDiagnostics.ts'

const directory=process.argv[2]
const jsonOnly=process.argv.includes('--json')
if(!directory){
  console.error('Usage: node --experimental-strip-types scripts/diagnose-office-directory.mjs <directory> [--json]')
  process.exitCode=2
}else{
  try{
    const root=resolve(directory),entries=(await readdir(root,{withFileTypes:true})).filter((entry)=>entry.isFile()&&['.docx','.pptx','.xlsx'].includes(extname(entry.name).toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name))
    const inputs=[]
    for(const entry of entries)inputs.push({name:entry.name,bytes:new Uint8Array(await readFile(resolve(root,entry.name)))})
    const report=await diagnoseOfficeBatch(cloneSeedWorkspace(),inputs)
    if(jsonOnly)console.log(JSON.stringify(report,null,2))
    else{
      console.log(`Frame Office migration diagnostics: ${report.totals.ok}/${report.totals.files} planned · ${report.totals.failed} failed · ${report.totals.warnings} warnings · ${report.totals.duplicates} duplicates · ${report.totals.filenameRevisions} same-name revisions`)
      for(const file of report.files){
        if(!file.ok){console.log(`FAIL  ${file.name} — ${file.error}`);continue}
        console.log(`${file.classification==='duplicate-content'?'DUP ':'OK  '} ${file.name} — ${file.kind?.toUpperCase()} · ${file.importedItems} items · ${file.warningCount} warnings · ${file.sourceIdentity?.slice(0,22)}…`)
        for(const warning of file.warnings??[])console.log(`      ! ${warning}`)
      }
    }
  }catch(error){
    console.error(error instanceof Error?error.message:String(error))
    process.exitCode=1
  }
}
