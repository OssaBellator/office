import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip } from '../src/officeExport.ts'
import { planSecureOfficeImport } from '../src/officeSecureImport.ts'
import { planPromoteSourceReview } from '../src/reviewPromotion.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { listWorkspaceReviewInbox } from '../src/workspaceReviewInbox.ts'
import { getWorkspaceReviews } from '../src/workspaceReviews.ts'

const PARA='11111111',DURABLE='AAAA0001'
function packageFiles({commentId='7',comments=true}={}){
  const contentTypes=`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${comments?'<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>':''}</Types>`
  const files={
    '[Content_Types].xml':contentTypes,
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Opening context</w:t></w:r></w:p><w:p><w:commentRangeStart w:id="${commentId}"/><w:r><w:t>Revenue grew 17%.</w:t></w:r><w:commentRangeEnd w:id="${commentId}"/><w:r><w:commentReference w:id="${commentId}"/></w:r></w:p></w:body></w:document>`,
    'word/_rels/document.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${comments?'<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>':''}</Relationships>`,
  }
  if(comments){
    files['word/comments.xml']=`<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:comment w:id="${commentId}" w:author="Alice"><w:p w14:paraId="${PARA}"><w:r><w:t>Confirm revenue.</w:t></w:r></w:p></w:comment></w:comments>`
    files['word/commentsIds.xml']=`<w16cid:commentsIds xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid"><w16cid:commentId w16cid:paraId="${PARA}" w16cid:durableId="${DURABLE}"/></w16cid:commentsIds>`
  }
  return files
}
function docx(options){return createStoredZip(packageFiles(options))}
function apply(workspace,commands){let session=createVersionedWorkspaceSession(workspace);for(const command of commands)session=executeVersionedWorkspaceCommand(session,command);return session.present}

test('detached Word review reattaches automatically when its durable source comment returns',async()=>{
  const base=cloneSeedWorkspace(),initial=await planSecureOfficeImport(base,docx({commentId:'7'}),'strategy.docx')
  let workspace=apply(base,initial.commands)
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-word')
  assert.ok(source)
  const promotion=planPromoteSourceReview(workspace,source.id,{kind:'task',owner:'Finance',body:'Validate revenue before board send'})
  workspace=apply(workspace,[promotion.command])
  const promoted=getWorkspaceReviews(workspace).find((review)=>review.id===promotion.review.id)
  assert.equal(promoted.sourceReview.durableId,DURABLE)

  const removed=await planSecureOfficeImport(workspace,docx({comments:false}),'strategy.docx')
  workspace=apply(workspace,removed.commands)
  let native=getWorkspaceReviews(workspace).find((review)=>review.id===promotion.review.id)
  assert.equal(native.sourceDetached,true)
  assert.equal(native.objectId,'document:strategy')

  const restored=await planSecureOfficeImport(workspace,docx({commentId:'70'}),'strategy.docx')
  const reviewCommand=restored.commands.find((command)=>command.type==='review.workspace.replace')
  assert.ok(reviewCommand)
  native=reviewCommand.reviews.find((review)=>review.id===promotion.review.id)
  assert.ok(native)
  assert.equal(native.sourceDetached,undefined)
  assert.equal(native.sourceReview.durableId,DURABLE)
  assert.equal(native.sourceReview.commentId,'70')
  assert.equal(native.sourceReview.sourceReviewId,'word-comment:strategy.docx:70')
  assert.notEqual(native.objectId,'document:strategy')
  assert.equal(native.body,'Validate revenue before board send')
  assert.equal(native.owner,'Finance')
  assert.equal(restored.warnings.some((warning)=>/remapped to refreshed Word comment anchors/.test(warning)),true)
})
