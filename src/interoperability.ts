export type InteropFamily='frame'|'microsoft'|'google'|'portable'
export type InteropSupport='native'|'projection'|'provider'|'convert-first'|'unsupported'
export type InteropCapability={
  id:string
  label:string
  family:InteropFamily
  extensions:string[]
  import:InteropSupport
  export:InteropSupport
  semanticTarget:'workspace'|'docs'|'data'|'present'|'none'
  notes:string
}

export const INTEROP_CAPABILITIES:InteropCapability[]=[
  {id:'frame-json',label:'Frame workspace',family:'frame',extensions:['json'],import:'native',export:'native',semanticTarget:'workspace',notes:'Lossless semantic workspace/session backup including history.'},
  {id:'docx',label:'Microsoft Word',family:'microsoft',extensions:['docx'],import:'projection',export:'projection',semanticTarget:'docs',notes:'Paragraphs/headings/lists become document blocks; tables become Data.'},
  {id:'pptx',label:'Microsoft PowerPoint',family:'microsoft',extensions:['pptx'],import:'projection',export:'projection',semanticTarget:'present',notes:'Slides become scenes; slide order and speaker notes are preserved semantically.'},
  {id:'xlsx',label:'Microsoft Excel',family:'microsoft',extensions:['xlsx'],import:'projection',export:'projection',semanticTarget:'data',notes:'Known finance schemas update live models; foreign sheets remain editable imported tables.'},
  {id:'csv',label:'CSV',family:'portable',extensions:['csv'],import:'projection',export:'projection',semanticTarget:'data',notes:'Schema-aware Regions/Plan import and portable table export.'},
  {id:'markdown',label:'Markdown',family:'portable',extensions:['md'],import:'unsupported',export:'projection',semanticTarget:'docs',notes:'Current compatibility export for strategy and board narrative.'},
  {id:'google-docs',label:'Google Docs',family:'google',extensions:['gdoc'],import:'provider',export:'projection',semanticTarget:'docs',notes:'Direct Drive provider exports to DOCX in memory; pointer .gdoc files themselves contain no document content.'},
  {id:'google-sheets',label:'Google Sheets',family:'google',extensions:['gsheet'],import:'provider',export:'projection',semanticTarget:'data',notes:'Direct Drive provider exports to XLSX in memory; pointer .gsheet files themselves contain no workbook content.'},
  {id:'google-slides',label:'Google Slides',family:'google',extensions:['gslides'],import:'provider',export:'projection',semanticTarget:'present',notes:'Direct Drive provider exports to PPTX in memory; pointer .gslides files themselves contain no deck content.'},
  {id:'legacy-word',label:'Legacy Word',family:'microsoft',extensions:['doc'],import:'convert-first',export:'unsupported',semanticTarget:'docs',notes:'Convert to DOCX in Word or Google Docs first.'},
  {id:'legacy-powerpoint',label:'Legacy PowerPoint',family:'microsoft',extensions:['ppt'],import:'convert-first',export:'unsupported',semanticTarget:'present',notes:'Convert to PPTX in PowerPoint or Google Slides first.'},
  {id:'legacy-excel',label:'Legacy Excel',family:'microsoft',extensions:['xls'],import:'convert-first',export:'unsupported',semanticTarget:'data',notes:'Convert to XLSX in Excel or Google Sheets first.'},
  {id:'macro-office',label:'Macro-enabled Office',family:'microsoft',extensions:['docm','pptm','xlsm'],import:'convert-first',export:'unsupported',semanticTarget:'none',notes:'Save a macro-free DOCX/PPTX/XLSX copy before importing.'},
]

export function normalizeInteropExtension(fileName:string){const clean=fileName.trim().toLowerCase();const index=clean.lastIndexOf('.');return index>=0?clean.slice(index+1):clean}
export function findInteropCapability(fileNameOrExtension:string){const extension=normalizeInteropExtension(fileNameOrExtension);return INTEROP_CAPABILITIES.find((item)=>item.extensions.includes(extension))??null}
export function supportedLocalOfficeAccept(){return INTEROP_CAPABILITIES.filter((item)=>item.family==='microsoft'&&item.import==='projection').flatMap((item)=>item.extensions.map((extension)=>`.${extension}`)).join(',')}
export function canDirectlyImportLocalFile(fileName:string){const capability=findInteropCapability(fileName);return capability?.import==='native'||capability?.import==='projection'}
