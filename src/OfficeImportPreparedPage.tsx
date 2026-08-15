import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSearch, ShieldCheck, UploadCloud, XCircle } from 'lucide-react'
import { approveAutomation, executeGovernedAutomation, planGovernedAutomation, type GovernedAutomationPlan } from './governedAutomation'
import { summarizeOfficeImportPlan } from './interoperabilityReport'
import { cloneSeedWorkspace } from './model'
import { prepareSecureOfficeImport, sourceRevisionMessage, type PreparedOfficeImport } from './officeImportPreparation'
import { loadSourceRevisionLedger, recordSourceRevision } from './sourceRevisionStore'
import { hydrateWorkspaceSession, LEGACY_WORKSPACE_STORAGE_KEY, serializeWorkspaceSession, SESSION_STORAGE_KEY } from './sessionStore'
import { createVersionedWorkspaceSession, type VersionedWorkspaceSession } from './versioning'
import { BatchPreviewModal } from './components/BatchPreviewModal'
import { SourceRevisionPreview } from './components/SourceRevisionPreview'

function loadSession():VersionedWorkspaceSession{try{const raw=localStorage.getItem(SESSION_STORAGE_KEY);if(raw)return hydrateWorkspaceSession(JSON.parse(raw));const legacy=localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY);return hydrateWorkspaceSession(null,legacy?JSON.parse(legacy):cloneSeedWorkspace())}catch{return createVersionedWorkspaceSession(cloneSeedWorkspace())}}
function persist(session:VersionedWorkspaceSession){localStorage.setItem(SESSION_STORAGE_KEY,serializeWorkspaceSession(session));localStorage.setItem(LEGACY_WORKSPACE_STORAGE_KEY,JSON.stringify(session.present))}
function home(){window.location.assign('/')}

export default function OfficeImportPreparedPage(){
  const [session,setSession]=useState<VersionedWorkspaceSession>(loadSession)
  const [prepared,setPrepared]=useState<PreparedOfficeImport|null>(null)
  const [automation,setAutomation]=useState<GovernedAutomationPlan|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState<string|null>(null)
  const [error,setError]=useState<string|null>(null)
  const report=useMemo(()=>prepared?summarizeOfficeImportPlan(prepared.plan):null,[prepared])
  const choose=()=>{const input=document.createElement('input');input.type='file';input.accept='.docx,.pptx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;setBusy(true);setError(null);setMessage(null);setPrepared(null);setAutomation(null);try{const value=await prepareSecureOfficeImport(session.present,new Uint8Array(await file.arrayBuffer()),file.name,loadSourceRevisionLedger());setPrepared(value);setMessage(sourceRevisionMessage(value))}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}finally{setBusy(false)}};input.click()}
  const review=()=>{if(!prepared)return;setAutomation(planGovernedAutomation(session,'owner',prepared.plan.commands,prepared.plan.warnings))}
  const apply=()=>{if(!prepared||!automation)return;try{const approval=automation.governance.requiresApproval?approveAutomation(automation,'Workspace owner'):undefined;const next=executeGovernedAutomation(session,automation,approval);persist(next);recordSourceRevision(prepared.receipt);setSession(next);setAutomation(null);setMessage(`Applied ${automation.plan.steps.length} semantic change${automation.plan.steps.length===1?'':'s'} from ${prepared.receipt.fileName} and recorded source receipt ${prepared.receipt.sha256.slice(0,12)}…`)}catch(cause){setAutomation(null);setError(cause instanceof Error?cause.message:String(cause))}}
  return <main className="office-import-prepared-page">
    <header className="office-import-prepared-header"><div className="office-import-prepared-brand"><span>F</span><strong>Frame</strong></div><button className="secondary-button" onClick={home}><ArrowLeft size={14}/> Back to workspace</button></header>
    <section className="office-import-prepared-intro"><div className="office-import-prepared-icon"><ShieldCheck size={24}/></div><span>SECURE OFFICE IMPORT</span><h1>Know the source before you apply the changes</h1><p>Frame validates the OOXML package, preserves fidelity metadata, fingerprints the exact bytes, classifies source revision identity, and only then creates a governed semantic preview.</p><button className="primary-button" onClick={choose} disabled={busy}><UploadCloud size={15}/>{busy?'Inspecting…':'Choose DOCX, PPTX or XLSX'}</button>{error&&<div className="office-import-prepared-error"><XCircle size={13}/>{error}</div>}{message&&<div className="office-import-prepared-message"><CheckCircle2 size={13}/>{message}</div>}</section>
    {!prepared?<section className="office-import-prepared-empty"><FileSearch size={24}/><strong>No Office source selected</strong><span>Choose a file to calculate its semantic import plan and immutable source receipt. Nothing is applied during inspection.</span></section>:<section className="office-import-prepared-workbench"><SourceRevisionPreview prepared={prepared}/><div className="office-import-prepared-plan"><header><div><span>SEMANTIC IMPORT PLAN</span><h2>{prepared.plan.label}</h2></div><small>{report?.commandCount} commands · {report?.warningCount} warnings</small></header><div className="office-import-prepared-facts"><Fact label="Imported items" value={prepared.plan.importedItems}/><Fact label="Commands" value={report?.commandCount??0}/><Fact label="Warnings" value={prepared.plan.warnings.length}/><Fact label="Source class" value={prepared.classification.replace(/-/g,' ')}/></div>{prepared.plan.warnings.length?<div className="office-import-prepared-warnings">{prepared.plan.warnings.map((warning)=><div key={warning}><AlertTriangle size={11}/><span>{warning}</span></div>)}</div>:<div className="office-import-prepared-clean"><CheckCircle2 size={12}/> No fidelity warnings for this plan.</div>}<footer><span>{prepared.classification==='duplicate-content'?'Identical content was seen before. Review carefully before intentionally applying another projection.':'All changes remain unapplied until the governed preview is approved.'}</span><button className="primary-button" onClick={review}>Review semantic changes</button></footer></div></section>}
    {automation&&<BatchPreviewModal plan={automation.plan} governance={automation.governance} warnings={automation.warnings} title={`Import ${prepared?.receipt.fileName??'Office source'}`} onApply={apply} onClose={()=>setAutomation(null)}/>}  
  </main>
}
function Fact({label,value}:{label:string;value:string|number}){return <div><span>{label}</span><strong>{value}</strong></div>}
