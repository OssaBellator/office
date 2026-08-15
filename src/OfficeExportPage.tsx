import { useMemo } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileText, Presentation, ShieldCheck } from 'lucide-react'
import { cloneSeedWorkspace } from './model'
import { assessOfficeExport } from './officeExportAssessment'
import { exportWorkspaceDocx, exportWorkspacePptx, exportWorkspaceXlsx, type OfficeExportFile } from './officeExport'
import { hydrateWorkspaceSession, LEGACY_WORKSPACE_STORAGE_KEY, SESSION_STORAGE_KEY } from './sessionStore'
import { createVersionedWorkspaceSession } from './versioning'

function loadWorkspace(){
  try{
    const rawSession=localStorage.getItem(SESSION_STORAGE_KEY)
    if(rawSession)return hydrateWorkspaceSession(JSON.parse(rawSession)).present
    const legacy=localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY)
    return hydrateWorkspaceSession(null,legacy?JSON.parse(legacy):cloneSeedWorkspace()).present
  }catch{return createVersionedWorkspaceSession(cloneSeedWorkspace()).present}
}
function home(){window.location.assign('/')}
function download(file:OfficeExportFile){const blob=new Blob([file.bytes.slice().buffer],{type:file.mimeType}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=file.filename;anchor.click();URL.revokeObjectURL(url)}

export default function OfficeExportPage(){
  const workspace=useMemo(loadWorkspace,[])
  const assessment=useMemo(()=>assessOfficeExport(workspace),[workspace])
  const files=useMemo(()=>({docx:exportWorkspaceDocx(workspace),pptx:exportWorkspacePptx(workspace),xlsx:exportWorkspaceXlsx(workspace)}),[workspace])
  const exportAll=()=>{download(files.docx);download(files.pptx);download(files.xlsx)}
  return <main className="office-export-page">
    <header className="office-export-page-header"><div className="office-export-page-brand"><span>F</span><strong>Frame</strong></div><button className="secondary-button" onClick={home}><ArrowLeft size={14}/> Back to workspace</button></header>
    <section className="office-export-intro"><div className="office-export-icon"><ShieldCheck size={24}/></div><span>OFFICE COMPATIBILITY PROJECTION</span><h1>Review what leaves Frame</h1><p>Frame remains semantic internally. These Office files project the current workspace into interoperable DOCX, PPTX and XLSX packages without embedding hidden Frame-only manifest metadata by default.</p></section>

    <section className="office-export-grid">
      <ExportCard icon={FileText} title="Word strategy" filename={files.docx.filename} detail={`${assessment.docx.documentBlocks} semantic blocks · ${assessment.docx.claims} claims · ${assessment.docx.reviews} reviews`} onDownload={()=>download(files.docx)}/>
      <ExportCard icon={Presentation} title="PowerPoint narrative" filename={files.pptx.filename} detail={`${assessment.pptx.scenes} visible scenes · ${assessment.pptx.speakerNotes} speaker notes`} onDownload={()=>download(files.pptx)}/>
      <ExportCard icon={FileSpreadsheet} title="Excel workbook" filename={files.xlsx.filename} detail={`${assessment.xlsx.tables} sheets · ${assessment.xlsx.formulaCells} cached foreign formulas · ${assessment.xlsx.numberFormatCells} number-format cells · ${assessment.xlsx.exportableHyperlinkCells} live links · ${assessment.xlsx.reviewNoteCells} legacy notes · ${assessment.xlsx.reviewThreadCells} source threads · ${assessment.xlsx.promotedReviewItems} native Data reviews`} onDownload={()=>download(files.xlsx)}/>
    </section>

    <section className="office-export-assessment">
      <header><div><CheckCircle2 size={17}/><div><span>EXPORT ASSESSMENT</span><h2>Fidelity decisions are explicit</h2></div></div><small>{assessment.warnings.length} note{assessment.warnings.length===1?'':'s'}</small></header>
      <div className="office-export-facts">
        <Fact label="Boolean cells" value={assessment.xlsx.booleanCells}/><Fact label="Legacy review notes" value={assessment.xlsx.reviewNoteCells}/><Fact label="Source review threads" value={assessment.xlsx.reviewThreadCells}/><Fact label="Thread comments" value={assessment.xlsx.threadedComments}/><Fact label="Open source threads" value={assessment.xlsx.openReviewThreads}/><Fact label="Native Data reviews" value={assessment.xlsx.promotedReviewItems}/><Fact label="Open native Data reviews" value={assessment.xlsx.openPromotedReviews}/><Fact label="Exportable links" value={assessment.xlsx.exportableHyperlinkCells}/><Fact label="Suppressed links" value={assessment.xlsx.suppressedHyperlinkCells}/><Fact label="Hidden sheets" value={assessment.xlsx.hiddenTables}/><Fact label="Very hidden sheets" value={assessment.xlsx.veryHiddenTables}/><Fact label="Date systems" value={assessment.xlsx.sourceDateSystems.length?assessment.xlsx.sourceDateSystems.join(' + '):'—'}/><Fact label="Suppressed risky date styles" value={assessment.xlsx.suppressedDateLikeFormatCells}/>
      </div>
      <div className="office-export-warning-list">{assessment.warnings.map((warning,index)=><div key={`${index}:${warning}`}><AlertTriangle size={13}/><span>{warning}</span></div>)}</div>
    </section>

    <section className="office-export-actions"><div><strong>Frame JSON remains the lossless backup.</strong><span>Office files are intentionally interoperable projections, not replacements for the semantic workspace.</span></div><button className="primary-button" onClick={exportAll}><Download size={14}/> Download all three</button></section>
  </main>
}

function ExportCard({icon:Icon,title,filename,detail,onDownload}:{icon:typeof FileText;title:string;filename:string;detail:string;onDownload:()=>void}){return <article className="office-export-card"><span className="office-export-card-icon"><Icon size={20}/></span><div><strong>{title}</strong><span>{filename}</span><small>{detail}</small></div><button className="secondary-button" onClick={onDownload}><Download size={13}/> Download</button></article>}
function Fact({label,value}:{label:string;value:string|number}){return <div className="office-export-fact"><span>{label}</span><strong>{value}</strong></div>}
