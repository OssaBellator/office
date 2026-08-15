import { spawnSync } from 'node:child_process'

const files=[
  'src/docxCommentImport.ts',
  'src/wordReviewThreads.ts',
  'src/workspaceReviewCodec.ts',
  'src/workspaceReviews.ts',
  'src/reviewPromotion.ts',
  'src/reviewRelink.ts',
  'src/workspaceReviewCompare.ts',
  'src/officeInteropImport.ts',
  'src/officeImportSync.ts',
  'src/officeExportAssessment.ts',
  'src/interoperabilityReport.ts',
]
const args=[
  '--noEmit',
  '--allowImportingTsExtensions',
  '--moduleResolution','bundler',
  '--module','esnext',
  '--target','es2022',
  '--strict',
  '--skipLibCheck',
  '--lib','ES2022,DOM',
  ...files,
]
const command=process.env.TSC||'tsc'
const result=spawnSync(command,args,{stdio:'inherit',shell:process.platform==='win32'})
if(result.error){console.error(`Could not start ${command}: ${result.error.message}`);process.exit(1)}
process.exit(result.status??1)
