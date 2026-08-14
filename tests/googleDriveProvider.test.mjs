import assert from 'node:assert/strict'
import test from 'node:test'
import { createGoogleDriveExportProvider, googleWorkspaceFileFromDriveMetadata, googleWorkspaceKindFromMimeType } from '../src/googleDriveProvider.ts'

test('Google Drive MIME types map to native Workspace kinds',()=>{
  assert.equal(googleWorkspaceKindFromMimeType('application/vnd.google-apps.document'),'document')
  assert.equal(googleWorkspaceKindFromMimeType('application/vnd.google-apps.spreadsheet'),'spreadsheet')
  assert.equal(googleWorkspaceKindFromMimeType('application/vnd.google-apps.presentation'),'presentation')
  assert.equal(googleWorkspaceKindFromMimeType('application/pdf'),null)
  assert.deepEqual(googleWorkspaceFileFromDriveMetadata({id:'abc',name:'Strategy',mimeType:'application/vnd.google-apps.document'}),{id:'abc',name:'Strategy',kind:'document'})
})

test('Google Drive provider calls files.export with encoded MIME and bearer token',async()=>{
  const calls=[]
  const provider=createGoogleDriveExportProvider({accessToken:'token-123',fetchImpl:async(input,init)=>{
    calls.push({input,init})
    return new Response(new Uint8Array([1,2,3]),{status:200})
  }})
  const bytes=new Uint8Array(await provider.exportFile({fileId:'file / 1',mimeType:'application/test+zip'}))
  assert.deepEqual([...bytes],[1,2,3])
  assert.equal(calls.length,1)
  assert.match(calls[0].input,/\/drive\/v3\/files\/file%20%2F%201\/export\?mimeType=application%2Ftest%2Bzip$/)
  assert.equal(calls[0].init.headers.Authorization,'Bearer token-123')
  assert.equal(calls[0].init.headers.Accept,'application/test+zip')
})

test('Google Drive provider exposes actionable authorization and permission errors',async()=>{
  const unauthorized=createGoogleDriveExportProvider({accessToken:'x',fetchImpl:async()=>new Response('{"error":"invalid token"}',{status:401})})
  await assert.rejects(()=>unauthorized.exportFile({fileId:'1',mimeType:'x'}),/authorization expired or is invalid/)
  const forbidden=createGoogleDriveExportProvider({accessToken:'x',fetchImpl:async()=>new Response('permission denied',{status:403})})
  await assert.rejects(()=>forbidden.exportFile({fileId:'1',mimeType:'x'}),/did not allow this export/)
})

test('Google Drive provider rejects blank OAuth tokens before making a request',()=>{
  assert.throws(()=>createGoogleDriveExportProvider({accessToken:'   '}),/requires an OAuth access token/)
})
