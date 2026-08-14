import assert from 'node:assert/strict'
import test from 'node:test'
import { createGoogleDriveClient, createGoogleDriveExportProvider, googleWorkspaceFileFromDriveMetadata, googleWorkspaceKindFromMimeType } from '../src/googleDriveProvider.ts'

test('Google Drive MIME types map to native Workspace kinds',()=>{
  assert.equal(googleWorkspaceKindFromMimeType('application/vnd.google-apps.document'),'document')
  assert.equal(googleWorkspaceKindFromMimeType('application/vnd.google-apps.spreadsheet'),'spreadsheet')
  assert.equal(googleWorkspaceKindFromMimeType('application/vnd.google-apps.presentation'),'presentation')
  assert.equal(googleWorkspaceKindFromMimeType('application/pdf'),null)
  assert.deepEqual(googleWorkspaceFileFromDriveMetadata({id:'abc',name:'Strategy',mimeType:'application/vnd.google-apps.document',modifiedTime:'2026-08-15T01:00:00Z'}),{id:'abc',name:'Strategy',kind:'document',modifiedTime:'2026-08-15T01:00:00Z'})
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

test('Google Drive client discovers only native Docs Sheets and Slides with pagination',async()=>{
  const calls=[]
  const client=createGoogleDriveClient({accessToken:'token',fetchImpl:async(input,init)=>{
    calls.push({input,init})
    return Response.json({files:[
      {id:'doc',name:'FY strategy',mimeType:'application/vnd.google-apps.document',modifiedTime:'2026-08-15T01:00:00Z'},
      {id:'pdf',name:'Ignored PDF',mimeType:'application/pdf'},
    ],nextPageToken:'next-page'})
  }})
  const page=await client.listWorkspaceFiles({query:"Ossa's plan",pageToken:'cursor',pageSize:75})
  assert.deepEqual(page.files,[{id:'doc',name:'FY strategy',kind:'document',modifiedTime:'2026-08-15T01:00:00Z'}])
  assert.equal(page.nextPageToken,'next-page')
  const url=new URL(calls[0].input)
  const q=url.searchParams.get('q')
  assert.match(q,/trashed = false/)
  assert.match(q,/application\/vnd\.google-apps\.document/)
  assert.match(q,/application\/vnd\.google-apps\.spreadsheet/)
  assert.match(q,/application\/vnd\.google-apps\.presentation/)
  assert.match(q,/name contains 'Ossa\\'s plan'/)
  assert.equal(url.searchParams.get('pageToken'),'cursor')
  assert.equal(url.searchParams.get('pageSize'),'75')
  assert.equal(url.searchParams.get('fields'),'nextPageToken,files(id,name,mimeType,modifiedTime)')
  assert.equal(calls[0].init.headers.Authorization,'Bearer token')
})

test('Google Drive listing caps page size to API maximum',async()=>{
  let called=''
  const client=createGoogleDriveClient({accessToken:'token',fetchImpl:async(input)=>{called=input;return Response.json({files:[]})}})
  await client.listWorkspaceFiles({pageSize:5000})
  assert.equal(new URL(called).searchParams.get('pageSize'),'1000')
})

test('Google Drive provider exposes actionable authorization and permission errors',async()=>{
  const unauthorized=createGoogleDriveExportProvider({accessToken:'x',fetchImpl:async()=>new Response('{"error":"invalid token"}',{status:401})})
  await assert.rejects(()=>unauthorized.exportFile({fileId:'1',mimeType:'x'}),/authorization expired or is invalid/)
  const forbidden=createGoogleDriveExportProvider({accessToken:'x',fetchImpl:async()=>new Response('permission denied',{status:403})})
  await assert.rejects(()=>forbidden.exportFile({fileId:'1',mimeType:'x'}),/did not allow this export/)
})

test('Google Drive client uses the same actionable errors for discovery',async()=>{
  const client=createGoogleDriveClient({accessToken:'x',fetchImpl:async()=>new Response('permission denied',{status:403})})
  await assert.rejects(()=>client.listWorkspaceFiles(),/did not allow this file listing/)
})

test('Google Drive provider rejects blank OAuth tokens before making a request',()=>{
  assert.throws(()=>createGoogleDriveExportProvider({accessToken:'   '}),/requires an OAuth access token/)
})
