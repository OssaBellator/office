import type { GoogleWorkspaceExportProvider, GoogleWorkspaceFile, GoogleWorkspaceKind } from './googleWorkspaceImport.ts'

export const GOOGLE_DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
export const GOOGLE_WORKSPACE_MIME_TYPES: Record<GoogleWorkspaceKind,string> = {
  document:'application/vnd.google-apps.document',
  spreadsheet:'application/vnd.google-apps.spreadsheet',
  presentation:'application/vnd.google-apps.presentation',
}

export type GoogleDriveFileMetadata = { id:string; name:string; mimeType:string }
export type GoogleDriveFetch = (input: string, init?: RequestInit) => Promise<Response>
export type GoogleDriveExportProviderOptions = {
  accessToken: string
  fetchImpl?: GoogleDriveFetch
  baseUrl?: string
}

export function googleWorkspaceKindFromMimeType(mimeType:string):GoogleWorkspaceKind|null {
  for(const [kind,value] of Object.entries(GOOGLE_WORKSPACE_MIME_TYPES) as Array<[GoogleWorkspaceKind,string]>) if(value===mimeType)return kind
  return null
}

export function googleWorkspaceFileFromDriveMetadata(file:GoogleDriveFileMetadata):GoogleWorkspaceFile|null {
  const kind=googleWorkspaceKindFromMimeType(file.mimeType)
  return kind?{id:file.id,name:file.name,kind}:null
}

function errorDetail(text:string) {
  const compact=text.replace(/\s+/g,' ').trim()
  return compact?`: ${compact.slice(0,240)}`:''
}

export function createGoogleDriveExportProvider(options:GoogleDriveExportProviderOptions):GoogleWorkspaceExportProvider {
  const token=options.accessToken.trim()
  if(!token)throw new Error('Google Drive export requires an OAuth access token')
  const fetchImpl=options.fetchImpl ?? ((input,init)=>fetch(input,init))
  const base=(options.baseUrl ?? 'https://www.googleapis.com/drive/v3').replace(/\/+$/,'')
  return {
    async exportFile(request){
      const url=`${base}/files/${encodeURIComponent(request.fileId)}/export?mimeType=${encodeURIComponent(request.mimeType)}`
      const response=await fetchImpl(url,{method:'GET',headers:{Authorization:`Bearer ${token}`,Accept:request.mimeType}})
      if(!response.ok){
        let detail=''
        try{detail=await response.text()}catch{}
        if(response.status===401)throw new Error(`Google Drive authorization expired or is invalid${errorDetail(detail)}`)
        if(response.status===403)throw new Error(`Google Drive did not allow this export${errorDetail(detail)}`)
        if(response.status===404)throw new Error(`Google Drive file was not found or is no longer accessible${errorDetail(detail)}`)
        throw new Error(`Google Drive export failed with HTTP ${response.status}${errorDetail(detail)}`)
      }
      return response.arrayBuffer()
    },
  }
}
