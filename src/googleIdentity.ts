import { GOOGLE_DRIVE_READONLY_SCOPE } from './googleDriveProvider.ts'

export const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

type GoogleTokenResponse = { access_token?:string; error?:string; error_description?:string }
type GoogleTokenClient = { requestAccessToken(options?:{prompt?:string}):void }
type GoogleOAuth2Api = {
  initTokenClient(config:{client_id:string;scope:string;callback:(response:GoogleTokenResponse)=>void;error_callback?:(error:{type?:string;message?:string})=>void}):GoogleTokenClient
}
type GoogleIdentityApi = { accounts:{oauth2:GoogleOAuth2Api} }
type WindowWithGoogle = Window & { google?:GoogleIdentityApi }

let scriptPromise:Promise<GoogleIdentityApi>|null=null

function configuredWindow(){return globalThis.window as WindowWithGoogle|undefined}
function detail(response:GoogleTokenResponse){return response.error_description?.trim()||response.error?.trim()||'Google authorization did not return an access token'}

export function getConfiguredGoogleClientId(env:Record<string,unknown> = ((import.meta as ImportMeta & {env?:Record<string,unknown>}).env ?? {})) {
  const value=env.VITE_GOOGLE_CLIENT_ID
  return typeof value==='string'?value.trim():''
}

export function isGoogleDriveImportConfigured(env?:Record<string,unknown>){return Boolean(getConfiguredGoogleClientId(env))}

export function loadGoogleIdentityServices(documentRef:Document|undefined=globalThis.document):Promise<GoogleIdentityApi>{
  const current=configuredWindow()?.google
  if(current?.accounts?.oauth2)return Promise.resolve(current)
  if(scriptPromise)return scriptPromise
  if(!documentRef)return Promise.reject(new Error('Google Identity Services requires a browser document'))
  scriptPromise=new Promise((resolve,reject)=>{
    const existing=documentRef.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT_URL}"]`)
    const script=existing??documentRef.createElement('script')
    const finish=()=>{
      const api=configuredWindow()?.google
      if(api?.accounts?.oauth2)resolve(api)
      else{scriptPromise=null;reject(new Error('Google Identity Services loaded without the OAuth client API'))}
    }
    const fail=()=>{scriptPromise=null;reject(new Error('Could not load Google Identity Services'))}
    script.addEventListener('load',finish,{once:true})
    script.addEventListener('error',fail,{once:true})
    if(!existing){script.src=GOOGLE_IDENTITY_SCRIPT_URL;script.async=true;script.defer=true;documentRef.head.appendChild(script)}
    else if((existing as HTMLScriptElement & {readyState?:string}).readyState==='complete')finish()
  })
  return scriptPromise
}

export async function requestGoogleDriveReadonlyToken(options:{clientId:string;prompt?:''|'consent'|'select_account';loadApi?:()=>Promise<GoogleIdentityApi>}):Promise<string>{
  const clientId=options.clientId.trim()
  if(!clientId)throw new Error('Direct Google Drive import is not configured for this Frame deployment')
  const google=await (options.loadApi??(()=>loadGoogleIdentityServices()))()
  return new Promise((resolve,reject)=>{
    let settled=false
    const tokenClient=google.accounts.oauth2.initTokenClient({
      client_id:clientId,
      scope:GOOGLE_DRIVE_READONLY_SCOPE,
      callback:(response)=>{
        if(settled)return
        settled=true
        const token=response.access_token?.trim()
        if(token){resolve(token);return}
        reject(new Error(detail(response)))
      },
      error_callback:(error)=>{
        if(settled)return
        settled=true
        reject(new Error(error.message?.trim()||error.type?.trim()||'Google authorization popup could not complete'))
      },
    })
    tokenClient.requestAccessToken({prompt:options.prompt??'consent'})
  })
}
