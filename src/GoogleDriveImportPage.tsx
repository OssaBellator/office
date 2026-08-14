import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Cloud, ShieldCheck } from 'lucide-react'
import { approveAutomation, executeGovernedAutomation, planGovernedAutomation, type GovernedAutomationPlan } from './governedAutomation'
import { cloneSeedWorkspace } from './model'
import { hydrateWorkspaceSession, LEGACY_WORKSPACE_STORAGE_KEY, serializeWorkspaceSession, SESSION_STORAGE_KEY } from './sessionStore'
import { createVersionedWorkspaceSession, type VersionedWorkspaceSession } from './versioning'
import { BatchPreviewModal } from './components/BatchPreviewModal'
import { GoogleDriveImportDialog } from './components/GoogleDriveImportDialog'
import type { GoogleDriveWorkspaceFile } from './googleDriveProvider'
import type { OfficeImportPlan } from './officeImportPlanner'

function loadSession():VersionedWorkspaceSession{
  try{
    const rawSession=localStorage.getItem(SESSION_STORAGE_KEY)
    if(rawSession)return hydrateWorkspaceSession(JSON.parse(rawSession))
    const legacy=localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY)
    return hydrateWorkspaceSession(null,legacy?JSON.parse(legacy):cloneSeedWorkspace())
  }catch{return createVersionedWorkspaceSession(cloneSeedWorkspace())}
}
function home(){window.location.assign('/')}

export default function GoogleDriveImportPage(){
  const [session,setSession]=useState<VersionedWorkspaceSession>(loadSession)
  const [chooserOpen,setChooserOpen]=useState(true)
  const [pending,setPending]=useState<GovernedAutomationPlan|null>(null)
  const [selectedFile,setSelectedFile]=useState<GoogleDriveWorkspaceFile|null>(null)
  const [applied,setApplied]=useState<string|null>(null)
  const [error,setError]=useState<string|null>(null)

  const stage=(plan:OfficeImportPlan,file:GoogleDriveWorkspaceFile)=>{
    try{
      setSelectedFile(file)
      setPending(planGovernedAutomation(session,'owner',plan.commands,plan.warnings))
      setChooserOpen(false)
      setError(null)
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not stage Google import')}
  }
  const apply=()=>{
    if(!pending)return
    try{
      const approval=pending.governance.requiresApproval?approveAutomation(pending,'Workspace owner'):undefined
      const next=executeGovernedAutomation(session,pending,approval)
      localStorage.setItem(SESSION_STORAGE_KEY,serializeWorkspaceSession(next))
      localStorage.setItem(LEGACY_WORKSPACE_STORAGE_KEY,JSON.stringify(next.present))
      setSession(next)
      setApplied(selectedFile?.name??'Google Workspace file')
      setPending(null)
    }catch(reason){setPending(null);setError(reason instanceof Error?reason.message:'Could not apply Google import')}
  }

  return <main className="google-import-page">
    <header className="google-import-page-header"><div className="google-import-page-brand"><span>F</span><strong>Frame</strong></div><button className="secondary-button" onClick={home}><ArrowLeft size={14}/> Back to workspace</button></header>
    <section className="google-import-page-intro"><div className="google-import-page-icon"><Cloud size={24}/></div><span>DIRECT GOOGLE WORKSPACE IMPORT</span><h1>Bring Google work into the semantic workspace</h1><p>Frame reads Google Drive with read-only permission, exports the selected native file in memory, converts it through the same Office semantic pipeline, and shows every proposed change before Apply.</p><div className="google-import-trust"><div><ShieldCheck size={15}/><span>Read-only Drive scope</span></div><div><CheckCircle2 size={15}/><span>Governed semantic preview</span></div></div></section>
    {applied&&<section className="google-import-success"><CheckCircle2 size={22}/><div><strong>{applied} imported</strong><span>The semantic session has been saved locally. Return to the workspace to continue editing.</span></div><button className="primary-button" onClick={home}>Open workspace</button></section>}
    {error&&<section className="google-import-page-error"><strong>Import could not complete</strong><span>{error}</span><button className="secondary-button" onClick={()=>{setError(null);setChooserOpen(true)}}>Try again</button></section>}
    {!applied&&!error&&!chooserOpen&&!pending&&<button className="primary-button google-import-reopen" onClick={()=>setChooserOpen(true)}>Choose another Google file</button>}
    {chooserOpen&&<GoogleDriveImportDialog workspace={session.present} onClose={home} onPlan={stage}/>} 
    {pending&&<BatchPreviewModal plan={pending.plan} governance={pending.governance} warnings={pending.warnings} title={`Import ${selectedFile?.name??'Google Workspace file'}`} onApply={apply} onClose={()=>{setPending(null);setChooserOpen(true)}}/>}
  </main>
}
