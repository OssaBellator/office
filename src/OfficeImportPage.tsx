import { useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, FileArchive, FileSpreadsheet, FileText, Loader2, Presentation, ShieldCheck, Upload } from 'lucide-react'
import { approveAutomation, executeGovernedAutomation, planGovernedAutomation, type GovernedAutomationPlan } from './governedAutomation'
import { supportedLocalOfficeAccept } from './interoperability'
import { cloneSeedWorkspace } from './model'
import { planSecureOfficeImport, type DetectedOfficeImportPlan } from './officeSecureImport'
import { hydrateWorkspaceSession, LEGACY_WORKSPACE_STORAGE_KEY, serializeWorkspaceSession, SESSION_STORAGE_KEY } from './sessionStore'
import { createVersionedWorkspaceSession, type VersionedWorkspaceSession } from './versioning'
import { BatchPreviewModal } from './components/BatchPreviewModal'

function loadSession():VersionedWorkspaceSession{
  try{
    const rawSession=localStorage.getItem(SESSION_STORAGE_KEY)
    if(rawSession)return hydrateWorkspaceSession(JSON.parse(rawSession))
    const legacy=localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY)
    return hydrateWorkspaceSession(null,legacy?JSON.parse(legacy):cloneSeedWorkspace())
  }catch{return createVersionedWorkspaceSession(cloneSeedWorkspace())}
}
function home(){window.location.assign('/')}
function kindIcon(kind:DetectedOfficeImportPlan['kind']){return kind==='docx'?FileText:kind==='xlsx'?FileSpreadsheet:Presentation}
function kindLabel(kind:DetectedOfficeImportPlan['kind']){return kind==='docx'?'Word document':kind==='xlsx'?'Excel workbook':'PowerPoint deck'}

export default function OfficeImportPage(){
  const inputRef=useRef<HTMLInputElement>(null)
  const [session,setSession]=useState<VersionedWorkspaceSession>(loadSession)
  const [pending,setPending]=useState<GovernedAutomationPlan|null>(null)
  const [selected,setSelected]=useState<{originalName:string;plan:DetectedOfficeImportPlan}|null>(null)
  const [busy,setBusy]=useState(false)
  const [applied,setApplied]=useState<string|null>(null)
  const [error,setError]=useState<string|null>(null)

  const choose=()=>inputRef.current?.click()
  const stage=async(file:File)=>{
    setBusy(true);setError(null);setApplied(null)
    try{
      const plan=await planSecureOfficeImport(session.present,await file.arrayBuffer(),file.name)
      if(!plan.commands.length){setApplied(`${file.name} already matches the workspace`);return}
      setSelected({originalName:file.name,plan})
      setPending(planGovernedAutomation(session,'owner',plan.commands,plan.warnings))
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not plan Office import')}
    finally{setBusy(false);if(inputRef.current)inputRef.current.value=''}
  }
  const apply=()=>{
    if(!pending||!selected)return
    try{
      const approval=pending.governance.requiresApproval?approveAutomation(pending,'Workspace owner'):undefined
      const next=executeGovernedAutomation(session,pending,approval)
      localStorage.setItem(SESSION_STORAGE_KEY,serializeWorkspaceSession(next))
      localStorage.setItem(LEGACY_WORKSPACE_STORAGE_KEY,JSON.stringify(next.present))
      setSession(next)
      setApplied(`${selected.plan.detectedFileName} imported`)
      setPending(null);setSelected(null)
    }catch(reason){setPending(null);setError(reason instanceof Error?reason.message:'Could not apply Office import')}
  }
  const reset=()=>{setApplied(null);setError(null);setPending(null);setSelected(null)}

  const Icon=selected?kindIcon(selected.plan.kind):FileArchive
  return <main className="office-import-page">
    <header className="office-import-page-header"><div className="office-import-page-brand"><span>F</span><strong>Frame</strong></div><button className="secondary-button" onClick={home}><ArrowLeft size={14}/> Back to workspace</button></header>
    <section className="office-import-page-intro"><div className="office-import-page-icon"><FileArchive size={24}/></div><span>SECURE OFFICE IMPORT</span><h1>Bring Word, Excel or PowerPoint into Frame</h1><p>Frame identifies the OOXML package by its contents, rejects VBA and ActiveX, preserves supported structure and formula provenance, synchronizes newer revisions from the same source, then shows the complete semantic change plan before Apply.</p><div className="office-import-trust"><div><ShieldCheck size={15}/><span>Macro/control safety gate</span></div><div><CheckCircle2 size={15}/><span>Governed semantic preview</span></div><div><Upload size={15}/><span>Source-aware re-import</span></div></div></section>

    <section className="office-import-card">
      <input ref={inputRef} className="office-import-file-input" type="file" accept={supportedLocalOfficeAccept()} onChange={(event)=>{const file=event.target.files?.[0];if(file)void stage(file)}} />
      {!applied&&!error&&!pending&&<><div className="office-import-drop-visual"><FileArchive size={28}/><div><strong>Choose a DOCX, PPTX or XLSX file</strong><span>Frame reads the package locally in your browser. The original file is never overwritten.</span></div></div><button className="primary-button office-import-choose" disabled={busy} onClick={choose}>{busy?<><Loader2 className="office-import-spin" size={14}/> Inspecting package…</>:<><Upload size={14}/> Choose Office file</>}</button><small>Legacy .doc/.ppt/.xls and macro-enabled .docm/.pptm/.xlsm should be converted to macro-free OOXML first.</small></>}

      {applied&&<div className="office-import-result success"><CheckCircle2 size={22}/><div><strong>{applied}</strong><span>The semantic session is saved locally and ready in the workspace.</span></div><div><button className="secondary-button" onClick={()=>{reset();choose()}}>Import another</button><button className="primary-button" onClick={home}>Open workspace</button></div></div>}
      {error&&<div className="office-import-result error"><ShieldCheck size={22}/><div><strong>Import stopped safely</strong><span>{error}</span></div><div><button className="secondary-button" onClick={reset}>Dismiss</button><button className="primary-button" onClick={()=>{reset();choose()}}>Choose another file</button></div></div>}
      {selected&&!pending&&!applied&&!error&&<div className="office-import-selection"><Icon size={18}/><div><strong>{selected.plan.detectedFileName}</strong><span>{kindLabel(selected.plan.kind)} · {selected.plan.importedItems} imported item{selected.plan.importedItems===1?'':'s'}</span></div></div>}
    </section>

    <section className="office-import-notes"><strong>Compatibility boundary</strong><p>Office files are compatibility projections over Frame's semantic model. Themes, exact layout, unsupported media, comments or formatting may be flattened or omitted, but those losses are surfaced as warnings in the preview rather than hidden.</p></section>

    {pending&&selected&&<BatchPreviewModal plan={pending.plan} governance={pending.governance} warnings={pending.warnings} title={`Import ${selected.plan.detectedFileName}`} onApply={apply} onClose={()=>{setPending(null);setSelected(null)}}/>}
  </main>
}
