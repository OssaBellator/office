import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { parseDocxCommentParagraphAnchors, parseDocxComments } from '../src/docxCommentImport.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip } from '../src/officeExport.ts'
import { planSecureOfficeImport } from '../src/officeSecureImport.ts'
import { planPromoteSourceReview } from '../src/reviewPromotion.ts'
import { searchWorkspace } from '../src/searchIndex.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { assessWorkspaceReadiness, buildWorkspaceDiagnostics } from '../src/workspaceDiagnostics.ts'
import { listWorkspaceReviewInbox } from '../src/workspaceReviewInbox.ts'
import { getWorkspaceReviews } from '../src/workspaceReviews.ts'

function documentXml(secondCommentText='Next step'){
  return`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Opening context</w:t></w:r></w:p><w:p><w:commentRangeStart w:id="7"/><w:r><w:t>Revenue grew 17%.</w:t></w:r><w:commentRangeEnd w:id="7"/><w:r><w:commentReference w:id="7"/></w:r></w:p><w:p><w:r><w:t>${secondCommentText}</w:t></w:r><w:r><w:commentReference w:id="8"/></w:r></w:p></w:body></w:document>`
}
function commentsXml(second='Clarify the next owner',includeRevenue=true){
  const revenue=includeRevenue?'<w:comment w:id="7" w:author="Alice Chen" w:initials="AC" w:date="2026-08-15T03:00:00Z"><w:p><w:r><w:t>Confirm revenue with Finance.</w:t></w:r></w:p><w:p><w:r><w:t>Use the board-approved figure.</w:t></w:r></w:p></w:comment>':''
  return`<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${revenue}<w:comment w:id="8" w:author="Bob Singh"><w:p><w:r><w:t>${second}</w:t></w:r></w:p></w:comment></w:comments>`
}
function docx({secondComment='Clarify the next owner',extended=true,includeRevenue=true,commentsPart=true}={}){
  const files={
    '[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${commentsPart?'<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>':''}</Types>`,
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':documentXml(),
    'word/_rels/document.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${commentsPart?'<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>':''}</Relationships>`,
  }
  if(commentsPart)files['word/comments.xml']=commentsXml(secondComment,includeRevenue)
  if(extended&&commentsPart)files['word/commentsExtended.xml']='<w15:commentsEx xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"/>'
  return createStoredZip(files)
}
function apply(workspace,commands){let session=createVersionedWorkspaceSession(workspace);for(const command of commands)session=executeVersionedWorkspaceCommand(session,command);return session.present}

test('Word comment parser preserves author date multiline body and paragraph anchors',()=>{
  const comments=parseDocxComments(commentsXml())
  assert.equal(comments.length,2)
  assert.deepEqual(comments[0],{id:'7',author:'Alice Chen',initials:'AC',createdAt:'2026-08-15T03:00:00Z',text:'Confirm revenue with Finance.\nUse the board-approved figure.'})
  const anchors=parseDocxCommentParagraphAnchors(documentXml())
  assert.equal(anchors.get('7'),1)
  assert.equal(anchors.get('8'),2)
})

test('secure DOCX import preserves comments as source-only review on imported semantic blocks',async()=>{
  const plan=await planSecureOfficeImport(cloneSeedWorkspace(),docx(),'strategy.docx')
  const inserts=plan.commands.filter((command)=>command.type==='document.block.insert')
  const reviewCommand=plan.commands.find((command)=>command.type==='review.workspace.replace')
  assert.equal(inserts.length,3)
  assert.ok(reviewCommand)
  const sourceReviews=reviewCommand.reviews.filter((review)=>review.sourceOnly)
  assert.equal(sourceReviews.length,2)
  assert.equal(sourceReviews[0].objectId,inserts[1].block.id)
  assert.equal(sourceReviews[0].sourceReview.kind,'word-comment')
  assert.equal(sourceReviews[0].sourceReview.blockId,inserts[1].block.id)
  assert.equal(sourceReviews[0].sourceReview.sourceReviewId,'word-comment:strategy.docx:7')
  assert.equal(sourceReviews[0].owner,'Alice Chen')
  assert.match(sourceReviews[0].body,/board-approved figure/)
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(reviewCommand)),reviewCommand)
  assert.equal(plan.warnings.some((warning)=>/preserved as read-only source review provenance/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/Additional modern Word comment-thread metadata/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/Word comments and comment threads are not imported yet/.test(warning)),false)
})

test('Word source comments are searchable and visible but do not become native readiness work',async()=>{
  const base=cloneSeedWorkspace(),baseline=assessWorkspaceReadiness(base)
  const plan=await planSecureOfficeImport(base,docx({extended:false}),'strategy.docx')
  const workspace=apply(base,plan.commands)
  const reviews=getWorkspaceReviews(workspace).filter((review)=>review.sourceOnly&&review.sourceReview?.kind==='word-comment')
  assert.equal(reviews.length,2)
  assert.equal(searchWorkspace(workspace,'Alice Finance',{kinds:['review'],surface:'docs'})[0].id,reviews[0].id)
  const inbox=listWorkspaceReviewInbox(workspace).filter((item)=>item.origin==='imported-word')
  assert.equal(inbox.length,2)
  assert.equal(inbox[0].actionable,false)
  const readiness=assessWorkspaceReadiness(workspace)
  assert.equal(readiness.openTasks,baseline.openTasks)
  assert.equal(readiness.openApprovals,baseline.openApprovals)
  assert.equal(buildWorkspaceDiagnostics(workspace).some((item)=>item.id.startsWith('workspace-review-comment:source-review:word-comment:')),false)
})

test('DOCX re-import replaces prior source comments with newly anchored records instead of duplicating them',async()=>{
  const base=cloneSeedWorkspace()
  const first=await planSecureOfficeImport(base,docx({extended:false}),'strategy.docx')
  const imported=apply(base,first.commands)
  const oldReviews=getWorkspaceReviews(imported).filter((review)=>review.sourceOnly&&review.sourceReview?.kind==='word-comment')
  assert.equal(oldReviews.length,2)

  const second=await planSecureOfficeImport(imported,docx({secondComment:'Assign the next owner',extended:false}),'strategy.docx')
  const replacement=second.commands.find((command)=>command.type==='review.workspace.replace')
  assert.ok(replacement)
  const nextSourceReviews=replacement.reviews.filter((review)=>review.sourceOnly&&review.sourceReview?.kind==='word-comment')
  assert.equal(nextSourceReviews.length,2)
  assert.deepEqual(nextSourceReviews.map((review)=>review.id).sort(),oldReviews.map((review)=>review.id).sort())
  assert.equal(nextSourceReviews.some((review)=>review.body==='Assign the next owner'),true)
  assert.equal(nextSourceReviews.every((review)=>!oldReviews.some((old)=>old.objectId===review.objectId)),true)

  const refreshed=apply(imported,second.commands)
  assert.equal(getWorkspaceReviews(refreshed).filter((review)=>review.sourceOnly&&review.sourceReview?.kind==='word-comment').length,2)
})

test('promoted Word review remaps by source comment id and detaches safely if source comment disappears',async()=>{
  const base=cloneSeedWorkspace(),first=await planSecureOfficeImport(base,docx({extended:false}),'strategy.docx')
  let workspace=apply(base,first.commands)
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-word'&&item.owner==='Alice Chen')
  assert.ok(source)
  const promotion=planPromoteSourceReview(workspace,source.id,{owner:'Finance',body:'Validate the board revenue figure',createdAt:'now'})
  workspace=apply(workspace,[promotion.command])
  let native=getWorkspaceReviews(workspace).find((review)=>review.id===promotion.review.id)
  assert.ok(native)
  assert.equal(native.sourceOnly,undefined)
  assert.equal(native.sourceReview.kind,'word-comment')
  assert.equal(native.body,'Validate the board revenue figure')
  assert.equal(listWorkspaceReviewInbox(workspace).find((item)=>item.id===source.id).promotedReviewId,native.id)

  const sameSource=await planSecureOfficeImport(workspace,docx({extended:false}),'strategy.docx')
  const sameReviewCommand=sameSource.commands.find((command)=>command.type==='review.workspace.replace')
  native=sameReviewCommand.reviews.find((review)=>review.id===promotion.review.id)
  const refreshedSource=sameReviewCommand.reviews.find((review)=>review.sourceOnly&&review.sourceReview?.sourceReviewId==='word-comment:strategy.docx:7')
  assert.ok(native);assert.ok(refreshedSource)
  assert.equal(native.objectId,refreshedSource.objectId)
  assert.equal(native.sourceReview.blockId,refreshedSource.sourceReview.blockId)
  assert.equal(native.sourceDetached,undefined)
  assert.equal(sameSource.warnings.some((warning)=>/remapped to refreshed Word comment anchors/.test(warning)),true)
  workspace=apply(workspace,sameSource.commands)

  const removedSource=await planSecureOfficeImport(workspace,docx({extended:false,includeRevenue:false}),'strategy.docx')
  const removedReviewCommand=removedSource.commands.find((command)=>command.type==='review.workspace.replace')
  native=removedReviewCommand.reviews.find((review)=>review.id===promotion.review.id)
  assert.ok(native)
  assert.equal(native.objectId,'document:strategy')
  assert.equal(native.sourceDetached,true)
  assert.equal(native.body,'Validate the board revenue figure')
  assert.equal(native.owner,'Finance')
  assert.equal(removedReviewCommand.reviews.some((review)=>review.sourceOnly&&review.sourceReview?.sourceReviewId==='word-comment:strategy.docx:7'),false)
  assert.equal(removedSource.warnings.some((warning)=>/detached to the Strategy document/.test(warning)),true)
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(removedReviewCommand)),removedReviewCommand)
  const detached=apply(workspace,removedSource.commands)
  const detachedInbox=listWorkspaceReviewInbox(detached).find((item)=>item.id===promotion.review.id)
  assert.ok(detachedInbox)
  assert.equal(detachedInbox.origin,'frame-workspace')
  assert.equal(detachedInbox.detached,true)
  assert.equal(detachedInbox.relinkable,false)
})

test('removing the Word comments part entirely also removes stale source review and detaches promoted work',async()=>{
  const base=cloneSeedWorkspace(),first=await planSecureOfficeImport(base,docx({extended:false}),'strategy.docx')
  let workspace=apply(base,first.commands)
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-word'&&item.owner==='Alice Chen')
  workspace=apply(workspace,[planPromoteSourceReview(workspace,source.id,{owner:'Finance'}).command])
  const withoutComments=await planSecureOfficeImport(workspace,docx({commentsPart:false,extended:false}),'strategy.docx')
  const reviewCommand=withoutComments.commands.find((command)=>command.type==='review.workspace.replace')
  assert.ok(reviewCommand)
  assert.equal(reviewCommand.reviews.some((review)=>review.sourceOnly&&review.sourceReview?.kind==='word-comment'&&review.sourceReview.source==='strategy.docx'),false)
  const native=reviewCommand.reviews.find((review)=>!review.sourceOnly&&review.sourceReview?.kind==='word-comment'&&review.sourceReview.source==='strategy.docx')
  assert.ok(native)
  assert.equal(native.objectId,'document:strategy')
  assert.equal(native.sourceDetached,true)
  assert.equal(withoutComments.warnings.some((warning)=>/detached to the Strategy document/.test(warning)),true)
})
