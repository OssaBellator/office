import type { GoogleWorkspaceExportProvider, GoogleWorkspaceFile, GoogleWorkspaceKind } from './googleWorkspaceImport.ts'

export const GOOGLE_DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
export const GOOGLE_WORKSPACE_MIME_TYPES: Record<GoogleWorkspaceKind,string> = {
  document:'application/vnd.google-apps.document',
  spreadsheet:'application/vnd.google-apps.spreadsheet',
  presentation:'application/vnd.google-apps.presentation',
}

export type GoogleDriveFileMetadata = { id:string; name:string; mimeType:string; modifiedTime?:string }
export type GoogleDriveWorkspaceFile = GoogleWorkspaceFile & { modifiedTime?:string }
export type GoogleDriveFilePage = { files:GoogleDriveWorkspaceFile[]; nextPageToken?:string }
export type GoogleDriveFetch = (input: string, init?: RequestInit) => Promise<Response>
export type GoogleDriveExportProviderOptions = {
  accessToken: string
  fetchImpl?: GoogleDriveFetch
  baseUrl?: string
}
export type GoogleDriveListOptions = { query?:string; pageToken?:string; pageSize?:number }
export type GoogleDriveClient = GoogleWorkspaceExportProvider & {
  listWorkspaceFiles(options?:GoogleDriveListOptions):Promise<GoogleDriveFilePage>
}

export function googleWorkspaceKindFromMimeType(mimeType:string):GoogleWorkspaceKind|null {
  for(const [kind,value] of Object.entries(GOOGLE_WORKSPACE_MIME_TYPES) as Array<[GoogleWorkspaceKind,string]>) if(value===mimeType)return kind
  return null
}

export function googleWorkspaceFileFromDriveMetadata(file:GoogleDriveFileMetadata):GoogleDriveWorkspaceFile|null {
  const kind=googleWorkspaceKindFromMimeType(file.mimeType)
  return kind?{id:file.id,name:file.name,kind,...(file.modifiedTime?{modifiedTime:file.modifiedTime}:{})}:null
}

function errorDetail(text:string) {
  const compact=text.replace(/\s+/g,' ').trim()
  return compact?`: ${compact.slice(0,240)}`:''
}
function driveQueryLiteral(value:string){return value.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
function nativeMimeQuery(){return `(${Object.values(GOOGLE_WORKSPACE_MIME_TYPES).map((mime)=>`mimeType = '${mime}'`).join(' or ')})`}
function responseError(status:number,detail:string,action:string){
  if(status===401)return new Error(`Google Drive authorization expired or is invalid${errorDetail(detail)}`)
  if(status===403)return new Error(`Google Drive did not allow this ${action}${errorDetail(detail)}`)
  if(status===404)return new Error(`Google Drive resource was not found or is no longer accessible${errorDetail(detail)}`)
  return new Error(`Google Drive ${action} failed with HTTP ${status}${errorDetail(detail)}`)
}

export function createGoogleDriveClient(options:GoogleDriveExportProviderOptions):GoogleDriveClient {
  const token=options.accessToken.trim()
  if(!token)throw new Error('Google Drive access requires an OAuth access token')
  const fetchImpl=options.fetchImpl ?? ((input,init)=>fetch(input,init))
  const base=(options.baseUrl ?? 'https://www.googleapis.com/drive/v3').replace(/\/+$/,'')
  const headers={Authorization:`Bearer ${token}`}
  return {
    async exportFile(request){
      const url=`${base}/files/${encodeURIComponent(request.fileId)}/export?mimeType=${encodeURIComponent(request.mimeType)}`
      const response=await fetchImpl(url,{method:'GET',headers:{...headers,Accept:request.mimeType}})
      if(!response.ok){let detail='';try{detail=await response.text()}catch{};throw responseError(response.status,detail,'export')}
      return response.arrayBuffer()
    },
    async listWorkspaceFiles(listOptions={}){
      const pageSize=Math.max(1,Math.min(1000,Math.trunc(listOptions.pageSize??50)))
      const queryParts=['trashed = false',nativeMimeQuery()]
      const search=listOptions.query?.trim()
      if(search)queryParts.push(`name contains '${driveQueryLiteral(search)}'`)
      const params=new URLSearchParams({q:queryParts.join(' and '),spaces:'drive',orderBy:'modifiedTime desc,name_natural',pageSize:String(pageSize),fields:'nextPageToken,files(id,name,mimeType,modifiedTime)'})
      if(listOptions.pageToken)params.set('pageToken',listOptions.pageToken)
      const response=await fetchImpl(`${base}/files?${params.toString()}`,{method:'GET',headers})
      if(!response.ok){let detail='';try{detail=await response.text()}catch{};throw responseError(response.status,detail,'file listing')}
      const payload=await response.json() as {files?:GoogleDriveFileMetadata[];nextPageToken?:string}
      const files=(payload.files??[]).flatMap((file)=>{const mapped=googleWorkspaceFileFromDriveMetadata(file);return mapped?[mapped]:[]})
      return{files,...(payload.nextPageToken?{nextPageToken:payload.nextPageToken}:{})}
    },
  }
}

export function createGoogleDriveExportProvider(options:GoogleDriveExportProviderOptions):GoogleWorkspaceExportProvider {
  return createGoogleDriveClient(options)
}
