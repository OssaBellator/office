import assert from 'node:assert/strict'
import test from 'node:test'
import { getConfiguredGoogleClientId, isGoogleDriveImportConfigured, requestGoogleDriveReadonlyToken } from '../src/googleIdentity.ts'
import { GOOGLE_DRIVE_READONLY_SCOPE } from '../src/googleDriveProvider.ts'

test('Google client id configuration is explicit and trimmed',()=>{
  assert.equal(getConfiguredGoogleClientId({VITE_GOOGLE_CLIENT_ID:'  public-client-id.apps.googleusercontent.com  '}),'public-client-id.apps.googleusercontent.com')
  assert.equal(getConfiguredGoogleClientId({}), '')
  assert.equal(isGoogleDriveImportConfigured({VITE_GOOGLE_CLIENT_ID:'client'}),true)
  assert.equal(isGoogleDriveImportConfigured({}),false)
})

test('readonly token request configures GIS with Drive read-only scope and no client secret',async()=>{
  let config,requestOptions
  const token=await requestGoogleDriveReadonlyToken({clientId:'client-id',loadApi:async()=>({accounts:{oauth2:{initTokenClient(next){config=next;return{requestAccessToken(options){requestOptions=options;queueMicrotask(()=>next.callback({access_token:'access-token'}))}}}}}})})
  assert.equal(token,'access-token')
  assert.equal(config.client_id,'client-id')
  assert.equal(config.scope,GOOGLE_DRIVE_READONLY_SCOPE)
  assert.equal('client_secret' in config,false)
  assert.deepEqual(requestOptions,{prompt:'consent'})
})

test('readonly token request can avoid repeated consent prompts after the user has granted access',async()=>{
  let prompt
  await requestGoogleDriveReadonlyToken({clientId:'client-id',prompt:'',loadApi:async()=>({accounts:{oauth2:{initTokenClient(config){return{requestAccessToken(options){prompt=options.prompt;config.callback({access_token:'token'})}}}}}})})
  assert.equal(prompt,'')
})

test('Google authorization errors remain actionable',async()=>{
  await assert.rejects(()=>requestGoogleDriveReadonlyToken({clientId:'client',loadApi:async()=>({accounts:{oauth2:{initTokenClient(config){return{requestAccessToken(){config.callback({error:'access_denied',error_description:'User denied access'})}}}}}})}),/User denied access/)
  await assert.rejects(()=>requestGoogleDriveReadonlyToken({clientId:'client',loadApi:async()=>({accounts:{oauth2:{initTokenClient(config){return{requestAccessToken(){config.error_callback({type:'popup_failed_to_open'})}}}}}})}),/popup_failed_to_open/)
})

test('blank client id is rejected before GIS loads',async()=>{
  let called=false
  await assert.rejects(()=>requestGoogleDriveReadonlyToken({clientId:'   ',loadApi:async()=>{called=true;throw new Error('should not load')}}),/not configured/)
  assert.equal(called,false)
})
