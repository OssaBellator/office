import { useMemo, useState } from 'react'
import { AlertTriangle, FileSpreadsheet, FileText, Loader2, Presentation, RefreshCw, Search, X } from 'lucide-react'
import { createGoogleDriveClient, type GoogleDriveClient, type GoogleDriveWorkspaceFile } from '../googleDriveProvider'
import { getConfiguredGoogleClientId, requestGoogleDriveReadonlyToken } from '../googleIdentity'
import { planGoogleWorkspaceImport } from '../googleWorkspaceImport'
import type { WorkspaceState } from '../model'
import type { OfficeImportPlan } from '../officeImportPlanner'
import '../google-drive-import.css'

function kindLabel(file:GoogleDriveWorkspaceFile){return file.kind==='document'?'Google Doc':file.kind==='spreadsheet'?'Google Sheet':'Google Slides'}
function kindIcon(file:GoogleDriveWorkspaceFile){return file.kind==='document'?FileText:file.kind==='spreadsheet'?FileSpreadsheet:Presentation}
function modifiedLabel(value?:string){if(!value)return'';const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(date)}

export function GoogleDriveImportDialog({workspace,onClose,onPlan}:{workspace:WorkspaceState;onClose:()=>void;onPlan:(plan:OfficeImportPlan,file:GoogleDriveWorkspaceFile)=>void}){
  const clientId=useMemo(()=>getConfiguredGoogleClientId(),[])
  const [client,setClient]=useState<GoogleDriveClient|null>(null)
  const [files,setFiles]=useState<GoogleDriveWorkspaceFile[]>([])
  const [query,setQuery]=useState('')
  const [searchedQuery,setSearchedQuery]=useState('')
  const [nextPageToken,setNextPageToken]=useState<string|undefined>()
  const [busy,setBusy]=useState<'connect'|'list'|'more'|`import:${string}`|null>(null)
  const [error,setError]=useState<string|null>(null)

  const load=async(drive:GoogleDriveClient,search:string,pageToken?:string,append=false)=>{
    setBusy(pageToken?'more':'list');setError(null)
    try{
      const page=await drive.listWorkspaceFiles({query:search||undefined,pageToken,pageSize:50})
      setFiles((current)=>append?[...current,...page.files]:page.files)
      setNextPageToken(page.nextPageToken)
      setSearchedQuery(search)
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not list Google Drive files')}
    finally{setBusy(null)}
  }
  const connect=async()=>{
    if(!clientId)return
    setBusy('connect');setError(null)
    try{
      const accessToken=await requestGoogleDriveReadonlyToken({clientId,prompt:'consent'})
      const drive=createGoogleDriveClient({accessToken})
      setClient(drive)
      await load(drive,'')
    }catch(reason){setError(reason instanceof Error?reason.message:'Google authorization could not complete');setBusy(null)}
  }
  const search=async(event:React.FormEvent)=>{event.preventDefault();if(client)await load(client,query.trim())}
  const importFile=async(file:GoogleDriveWorkspaceFile)=>{
    if(!client)return
    setBusy(`import:${file.id}`);setError(null)
    try{const plan=await planGoogleWorkspaceImport(workspace,file,client);onPlan(plan,file)}
    catch(reason){setError(reason instanceof Error?reason.message:`Could not import ${file.name}`);setBusy(null)}
  }

  return <div className="google-drive-backdrop" onMouseDown={onClose}>
    <section className="google-drive-dialog" onMouseDown={(event)=>event.stopPropagation()} aria-label="Import from Google Drive">
      <header><div><span>GOOGLE DRIVE · READ ONLY</span><h2>Import Google Docs, Sheets or Slides</h2><p>Frame asks Google for read-only Drive access, exports the selected native file to DOCX/XLSX/PPTX in memory, then runs the normal semantic import preview. The access token is not saved to the workspace.</p></div><button className="icon-button" onClick={onClose} aria-label="Close Google Drive import"><X size={16}/></button></header>

      {!clientId&&<div className="google-drive-config-warning"><AlertTriangle size={16}/><div><strong>Direct Google import is not configured</strong><span>Set <code>VITE_GOOGLE_CLIENT_ID</code> to a public Google OAuth web client ID for this deployment. No client secret belongs in the browser. You can still download DOCX/PPTX/XLSX from Google and use the normal Office import.</span></div></div>}

      {clientId&&!client&&<div className="google-drive-connect"><div className="google-drive-provider-mark">G</div><div><strong>Connect Google Drive</strong><span>Authorization is requested only when you choose to connect.</span></div><button className="primary-button" disabled={busy==='connect'} onClick={connect}>{busy==='connect'?<Loader2 className="google-drive-spin" size={14}/>:null}{busy==='connect'?' Connecting…':'Connect read-only'}</button></div>}

      {client&&<>
        <form className="google-drive-search" onSubmit={search}><Search size={14}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search Google Drive files" aria-label="Search Google Drive files"/><button className="secondary-button" disabled={busy==='list'} type="submit">{busy==='list'?<Loader2 className="google-drive-spin" size={13}/>:<Search size={13}/>} Search</button><button className="icon-button" type="button" title="Refresh" disabled={busy==='list'} onClick={()=>load(client,searchedQuery)}><RefreshCw size={14}/></button></form>
        <div className="google-drive-result-heading"><span>{searchedQuery?`RESULTS FOR “${searchedQuery}”`:'RECENT GOOGLE WORKSPACE FILES'}</span><small>{files.length} loaded</small></div>
        <div className="google-drive-file-list">
          {!files.length&&busy!=='list'&&<div className="google-drive-empty">No Google Docs, Sheets or Slides matched this view.</div>}
          {files.map((file)=>{const Icon=kindIcon(file),importing=busy===`import:${file.id}`;return <button className="google-drive-file" disabled={Boolean(busy)} onClick={()=>importFile(file)} key={file.id}><span className={`google-drive-file-icon ${file.kind}`}><Icon size={17}/></span><span className="google-drive-file-copy"><strong>{file.name}</strong><small>{kindLabel(file)}{file.modifiedTime?` · Modified ${modifiedLabel(file.modifiedTime)}`:''}</small></span><span className="google-drive-file-action">{importing?<><Loader2 className="google-drive-spin" size={13}/> Planning…</>:'Preview import'}</span></button>})}
        </div>
        {nextPageToken&&<button className="google-drive-more secondary-button" disabled={Boolean(busy)} onClick={()=>load(client,searchedQuery,nextPageToken,true)}>{busy==='more'?<><Loader2 className="google-drive-spin" size={13}/> Loading…</>:'Load more'}</button>}
      </>}

      {error&&<div className="google-drive-error"><AlertTriangle size={14}/><span>{error}</span></div>}
      <footer><span>Google content is not applied until you review and approve Frame's semantic import plan.</span><button className="secondary-button" onClick={onClose}>Cancel</button></footer>
    </section>
  </div>
}
