import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { validateOfficePackage } from '../src/officePackageValidator.ts'

const file=process.argv[2]
if(!file){console.error('Usage: node --experimental-strip-types scripts/validate-office-package.mjs <file.docx|file.pptx|file.xlsx>');process.exitCode=2}else{
  try{
    const bytes=new Uint8Array(await readFile(resolve(file)))
    const result=await validateOfficePackage(bytes)
    console.log(`${result.valid?'VALID':'INVALID'} · ${result.partCount} parts · ${result.relationshipCount} relationships`)
    for(const issue of result.issues)console.log(`- ${issue.kind} · ${issue.part}: ${issue.detail}`)
    if(!result.valid)process.exitCode=1
  }catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1}
}
