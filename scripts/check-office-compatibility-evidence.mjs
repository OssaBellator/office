import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { defaultOfficeCompatibilityRequirements, evaluateOfficeCompatibilityEvidence } from '../src/officeCompatibilityEvidence.ts'
import { parseOfficeSmokeValidation } from '../src/officeSmokeValidation.ts'

const [bundlePath,...validationPaths]=process.argv.slice(2)
if(!bundlePath||!validationPaths.length){
  console.error('Usage: node --experimental-strip-types scripts/check-office-compatibility-evidence.mjs <export-bundle-receipt.json> <smoke-validation.json> [...]')
  process.exitCode=2
}else{
  try{
    const bundle=JSON.parse(await readFile(bundlePath,'utf8'))
    if(bundle?.schema!=='frame.office-export-bundle-receipt'||bundle?.version!==1||!Array.isArray(bundle.artifacts))throw new Error('Export bundle receipt has an unsupported schema/version')
    const validations=[]
    for(const path of validationPaths)validations.push(parseOfficeSmokeValidation(JSON.parse(await readFile(path,'utf8'))))
    const evidence=evaluateOfficeCompatibilityEvidence(bundle,validations,defaultOfficeCompatibilityRequirements())
    for(const artifact of evidence.artifacts){
      const status=artifact.ready?'PASS':'BLOCK'
      console.log(`${status} ${artifact.receipt.kind.toUpperCase()} ${artifact.receipt.fileName} ${artifact.receipt.sha256.slice(0,12)}…`)
      if(artifact.passingApplications.length)console.log(`     passed: ${artifact.passingApplications.join(', ')}`)
      if(artifact.missingApplications.length)console.log(`     missing: ${artifact.missingApplications.join(', ')}`)
    }
    console.log(evidence.ready?'Office compatibility evidence gate: PASS':'Office compatibility evidence gate: BLOCKED')
    if(!evidence.ready)process.exitCode=1
  }catch(error){
    console.error(error instanceof Error?error.message:String(error))
    process.exitCode=1
  }
}
