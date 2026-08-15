import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createOfficeExportBundleReceipt } from '../src/officeExportReceipt.ts'
import { importWorkspaceSession } from '../src/workspaceIO.ts'

const input=process.argv[2]
const output=resolve(process.argv[3]||'tmp/frame-office-validation')
try{
  const workspace=input?importWorkspaceSession(await readFile(resolve(input),'utf8')).present:cloneSeedWorkspace()
  await mkdir(output,{recursive:true})
  const bundle=await createOfficeExportBundleReceipt(workspace)
  for(const file of bundle.files)await writeFile(resolve(output,file.filename),file.bytes)
  await writeFile(resolve(output,'office-export-bundle-receipt.json'),JSON.stringify(bundle.receipt,null,2))
  const lines=['# Frame Office validation bundle','','Validate these exact files in current applications. Do not rename or regenerate them before recording smoke-test evidence because the receipt is tied to each SHA-256 hash.','']
  for(const artifact of bundle.receipt.artifacts)lines.push(`- ${artifact.kind.toUpperCase()}: \`${artifact.fileName}\` — SHA-256 \`${artifact.sha256}\``)
  lines.push('','Recommended minimum smoke checks:','','- DOCX: open in current Microsoft Word; verify no repair prompt, headings/lists/tables/review text are readable.','- PPTX: open in current Microsoft PowerPoint; verify no repair prompt, slide order/body/source footer and speaker notes.','- XLSX: open in current Microsoft Excel; verify no repair prompt, booleans/sheet visibility/number formats/safe hyperlinks and conservative formula behavior.','- If using the experimental note-preserving XLSX writer, validate note balloons separately and do not treat that result as validation of the normal XLSX artifact hash.','','Record results with the `frame.office-smoke-validation` schema, then run `scripts/check-office-compatibility-evidence.mjs`.')
  await writeFile(resolve(output,'VALIDATE.md'),`${lines.join('\n')}\n`)
  console.log(`Wrote Office validation bundle to ${output}`)
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1}
