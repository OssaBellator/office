import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { exportWorkspaceDocx, exportWorkspacePptx, exportWorkspaceXlsx } from '../src/officeExport.ts'
import { importedTableCellKey, withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'

const output=resolve(process.argv[2]??`${tmpdir()}/frame-office-fixtures`)
await mkdir(output,{recursive:true})

let workspace=cloneSeedWorkspace()
const semantic=getSemanticDocument(workspace)
semantic.blocks.push(
  {id:'block:fixture-heading',type:'paragraph',text:'Interoperability fixture',style:'heading-2'},
  {id:'block:fixture-bullet',type:'paragraph',text:'Native Word bullet',style:'bullet'},
  {id:'block:fixture-numbered',type:'paragraph',text:'Native Word numbered item',style:'numbered'},
  {id:'block:fixture-source',type:'paragraph',text:'Imported provenance survives export',source:'legacy-strategy.docx'},
)
semantic.annotations.push({id:'annotation:fixture-review',blockId:'block:fixture-source',kind:'comment',body:'This is exported review context.',owner:'Interop QA',status:'open'})
workspace=withSemanticDocument(workspace,semantic)
const rowId='row:fixture:1'
workspace=withImportedTables(workspace,[{
  id:'imported:fixture',label:'plan',source:'formula-fixture.xlsx',importedAt:'fixture',
  columns:[{id:'account',label:'Account',type:'text'},{id:'arr',label:'ARR',type:'number'}],
  rows:[{id:rowId,values:{account:'Acme',arr:2.4}}],
  formulaByCell:{[importedTableCellKey(rowId,'arr')]:'1.2+1.2'},
}])

const files=[exportWorkspaceDocx(workspace),exportWorkspacePptx(workspace),exportWorkspaceXlsx(workspace)]
for(const file of files)await writeFile(resolve(output,file.filename),file.bytes)
await writeFile(resolve(output,'README.txt'),[
  'Frame Office interoperability fixtures',
  '',
  'Open the DOCX in Microsoft Word or upload it to Google Docs. Check headings, native bullet/numbered lists, tables, review text and source provenance.',
  'Open the PPTX in PowerPoint or upload it to Google Slides. Check visible slides and the speaker Notes pane; speaker cues should not appear as slide body text.',
  'Open the XLSX in Excel or upload it to Google Sheets. Check Regions, Plan and imported tables. The imported formula fixture intentionally exports the cached value 2.4, not the foreign formula.',
  'The imported table is named plan on purpose; it should be renamed case-insensitively (for example, plan 2) because a Plan sheet already exists.',
  '',
  'If an Office application reports that it repaired a file, preserve the repaired copy and the repair message as a regression fixture before changing the exporter.',
].join('\n'))

console.log(`Wrote ${files.length} Office fixtures to ${output}`)
for(const file of files)console.log(`- ${file.filename}`)
