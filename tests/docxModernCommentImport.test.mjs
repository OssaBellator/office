import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { parseDocxCommentIds, parseDocxComments, parseDocxCommentsExtended, parseDocxCommentsExtensible } from '../src/docxCommentImport.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip } from '../src/officeExport.ts'
import { planSecureOfficeImport } from '../src/officeSecureImport.ts'
import { planPromoteSourceReview } from '../src/reviewPromotion.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { listWorkspaceReviewInbox } from '../src/workspaceReviewInbox.ts'
import { getWorkspaceReviews } from '../src/workspaceReviews.ts'

const ROOT_PARA='11111111'
const REPLY_PARA='22222222'
const ROOT_DURABLE='AAAA0001'
const REPLY_DURABLE='BBBB0002'

function documentXml(rootId='7'){
  return `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Opening context</w:t></w:r></w:p><w:p><w:commentRangeStart w:id="${rootId}"/><w:r><w:t>Revenue grew 17%.</w:t></w:r><w:commentRangeEnd w:id="${rootId}"/><w:r><w:commentReference w:id="${rootId}"/></w:r></w:p></w:body></w:document>`
}
function commentsXml({rootId='7',replyId='8',replyParent=true}={}){
  return `<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:comment w:id="${rootId}" w:author="Alice Chen" w:date="2026-08-15T03:00:00Z"><w:p w14:paraId="${ROOT_PARA}"><w:r><w:t>Confirm revenue with Finance.</w:t></w:r></w:p></w:comment><w:comment w:id="${replyId}" w:author="Bob Singh"><w:p w14:paraId="${REPLY_PARA}"><w:r><w:t>Validated against the board pack.</w:t></w:r></w:p></w:comment></w:comments>`
}
function commentsExtendedXml({replyParent=true}={}){
  return `<w15:commentsEx xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"><w15:commentEx w15:paraId="${ROOT_PARA}" w15:done="1"/><w15:commentEx w15:paraId="${REPLY_PARA}"${replyParent?` w15:paraIdParent="${ROOT_PARA}"`:' w15:paraIdParent="99999999"'} w15:done="0"/></w15:commentsEx>`
}
function commentsIdsXml(){
  return `<w16cid:commentsIds xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid"><w16cid:commentId w16cid:paraId="${ROOT_PARA}" w16cid:durableId="${ROOT_DURABLE}"/><w16cid:commentId w16cid:paraId="${REPLY_PARA}" w16cid:durableId="${REPLY_DURABLE}"/></w16cid:commentsIds>`
}
function commentsExtensibleXml(){
  return `<w16cex:commentsExtensible xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex"><w16cex:commentExtensible w16cex:durableId="${ROOT_DURABLE}" w16cex:dateUtc="2026-08-15T03:01:00Z"/><w16cex:commentExtensible w16cex:durableId="${REPLY_DURABLE}" w16cex:dateUtc="2026-08-15T03:04:00Z"/></w16cex:commentsExtensible>`
}
function docx({rootId='7',replyId='8',replyParent=true}={}){
  return createStoredZip({
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':documentXml(rootId),
    'word/_rels/document.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>',
    'word/comments.xml':commentsXml({rootId,replyId,replyParent}),
    'word/commentsExtended.xml':commentsExtendedXml({replyParent}),
    'word/commentsIds.xml':commentsIdsXml(),
    'word/commentsExtensible.xml':commentsExtensibleXml(),
  })
}
function apply(workspace,commands){let session=createVersionedWorkspaceSession(workspace);for(const command of commands)session=executeVersionedWorkspaceCommand(session,command);return session.present}

test('modern Word extension parsers preserve reply, done, durable id, and UTC metadata',()=>{
  const comments=parseDocxComments(commentsXml())
  assert.equal(comments[0].paraId,ROOT_PARA)
  assert.equal(comments[1].paraId,REPLY_PARA)
  const extended=parseDocxCommentsExtended(commentsExtendedXml())
  assert.deepEqual(extended.get(ROOT_PARA),{paraId:ROOT_PARA,done:true})
  assert.deepEqual(extended.get(REPLY_PARA),{paraId:REPLY_PARA,parentParaId:ROOT_PARA,done:false})
  const ids=parseDocxCommentIds(commentsIdsXml())
  assert.equal(ids.get(ROOT_PARA),ROOT_DURABLE)
  assert.equal(ids.get(REPLY_PARA),REPLY_DURABLE)
  const extensible=parseDocxCommentsExtensible(commentsExtensibleXml())
  assert.deepEqual(extensible.get(ROOT_DURABLE),{durableId:ROOT_DURABLE,dateUtc:'2026-08-15T03:01:00Z'})
})

test('secure DOCX import preserves Word reply hierarchy on the root semantic document anchor',async()=>{
  const plan=await planSecureOfficeImport(cloneSeedWorkspace(),docx(),'strategy.docx')
  const reviewCommand=plan.commands.find((command)=>command.type==='review.workspace.replace')
  assert.ok(reviewCommand)
  const source=reviewCommand.reviews.filter((review)=>review.sourceOnly&&review.sourceReview?.kind==='word-comment')
  assert.equal(source.length,2)
  const root=source.find((review)=>review.sourceReview.commentId==='7'),reply=source.find((review)=>review.sourceReview.commentId==='8')
  assert.ok(root);assert.ok(reply)
  assert.equal(root.sourceReview.paraId,ROOT_PARA)
  assert.equal(root.sourceReview.durableId,ROOT_DURABLE)
  assert.equal(root.sourceReview.done,true)
  assert.equal(root.sourceReview.dateUtc,'2026-08-15T03:01:00Z')
  assert.equal(root.createdAt,'2026-08-15T03:01:00Z')
  assert.equal(reply.label.startsWith('Word reply ·'),true)
  assert.equal(reply.objectId,root.objectId)
  assert.equal(reply.sourceReview.parentSourceReviewId,'word-comment:strategy.docx:7')
  assert.equal(reply.sourceReview.durableId,REPLY_DURABLE)
  assert.equal(reply.sourceReview.done,false)
  assert.equal(reply.sourceReview.dateUtc,'2026-08-15T03:04:00Z')
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(reviewCommand)),reviewCommand)
  assert.equal(plan.warnings.some((warning)=>/modern Word comment extension records? .*reply-parent and done-state metadata/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/Word durable comment IDs? .*preserved/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/Word extensible comment metadata records? .*preserved/.test(warning)),true)
})

test('promoted Word review remaps through durable id when ordinary Word comment id changes',async()=>{
  const base=cloneSeedWorkspace(),first=await planSecureOfficeImport(base,docx({rootId:'7',replyId:'8'}),'strategy.docx')
  let workspace=apply(base,first.commands)
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-word'&&item.owner==='Alice Chen')
  assert.ok(source)
  const promotion=planPromoteSourceReview(workspace,source.id,{owner:'Finance',body:'Validate the board revenue figure'})
  workspace=apply(workspace,[promotion.command])
  const before=getWorkspaceReviews(workspace).find((review)=>review.id===promotion.review.id)
  assert.equal(before.sourceReview.durableId,ROOT_DURABLE)
  assert.equal(before.sourceReview.sourceReviewId,'word-comment:strategy.docx:7')

  const refresh=await planSecureOfficeImport(workspace,docx({rootId:'70',replyId:'80'}),'strategy.docx')
  const reviewCommand=refresh.commands.find((command)=>command.type==='review.workspace.replace')
  assert.ok(reviewCommand)
  const native=reviewCommand.reviews.find((review)=>review.id===promotion.review.id)
  assert.ok(native)
  assert.equal(native.sourceDetached,undefined)
  assert.equal(native.sourceReview.durableId,ROOT_DURABLE)
  assert.equal(native.sourceReview.commentId,'70')
  assert.equal(native.sourceReview.sourceReviewId,'word-comment:strategy.docx:70')
  const refreshedSource=reviewCommand.reviews.find((review)=>review.sourceOnly&&review.sourceReview?.sourceReviewId==='word-comment:strategy.docx:70')
  assert.ok(refreshedSource)
  assert.equal(native.objectId,refreshedSource.objectId)
  assert.equal(refresh.warnings.some((warning)=>/remapped to refreshed Word comment anchors/.test(warning)),true)
})

test('reply with unknown parent is not guessed onto a nearby document block',async()=>{
  const plan=await planSecureOfficeImport(cloneSeedWorkspace(),docx({replyParent:false}),'strategy.docx')
  const reviewCommand=plan.commands.find((command)=>command.type==='review.workspace.replace')
  const source=reviewCommand.reviews.filter((review)=>review.sourceOnly&&review.sourceReview?.kind==='word-comment')
  assert.equal(source.length,1)
  assert.equal(source[0].sourceReview.commentId,'7')
  assert.equal(plan.warnings.some((warning)=>/could not be anchored because neither it nor its reply-parent chain mapped/.test(warning)),true)
})
