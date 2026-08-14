import { useEffect, useState } from 'react'
import { ArrowUpRight, BarChart3, CheckCircle2, ChevronDown, ChevronUp, Circle, FileText, Link2, ListTodo, MessageSquare, Plus, Quote, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { formatMetric, metricDelta, type WorkspaceState } from '../model'
import {
  getSemanticDocument,
  makeGrowthEvidenceInsertion,
  resolveSemanticClaim,
  type BlockAnnotation,
  type BlockAnnotationKind,
  type SemanticCitation,
  type SemanticDocumentBlock,
} from '../semanticDocument'
import type { VersionedWorkspaceCommand } from '../semanticCommands'

export function DocsSurface({
  workspace,
  commitDocument,
  onSemanticCommand,
  onOpenData,
}: {
  workspace: WorkspaceState
  commitDocument: (field: keyof WorkspaceState['document'], value: string) => void
  onSemanticCommand: (command: VersionedWorkspaceCommand) => void
  onOpenData: () => void
}) {
  const [draft, setDraft] = useState(workspace.document)
  const semantic = getSemanticDocument(workspace)

  useEffect(() => {
    setDraft(workspace.document)
  }, [workspace.document.eyebrow, workspace.document.title, workspace.document.summary, workspace.document.body])

  const edit = (field: keyof WorkspaceState['document'], value: string) => setDraft((current) => ({ ...current, [field]: value }))
  const commit = (field: keyof WorkspaceState['document']) => { if (draft[field] !== workspace.document[field]) commitDocument(field, draft[field]) }
  const move = (block: SemanticDocumentBlock, delta: number) => {
    const index = semantic.blocks.findIndex((item) => item.id === block.id)
    onSemanticCommand({ type: 'document.block.move', blockId: block.id, toIndex: index + delta })
  }
  const addParagraph = () => {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`
    onSemanticCommand({ type: 'document.block.insert', block: { id: `block:${id}`, type: 'paragraph', text: 'New paragraph' } })
  }
  const addEvidence = () => {
    const insertion = makeGrowthEvidenceInsertion(workspace)
    onSemanticCommand({ type: 'document.block.insert', ...insertion })
  }
  const addMetrics = () => {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`
    onSemanticCommand({ type: 'document.block.insert', block: { id: `block:${id}`, type: 'metric-embed', label: 'Live metrics', metricIds: workspace.metrics.map((metric) => metric.id) } })
  }
  const addDecision = () => {
    const decision = workspace.decisions[0]
    if (!decision) return
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`
    onSemanticCommand({ type: 'document.block.insert', block: { id: `block:${id}`, type: 'decision-embed', decisionId: decision.id } })
  }

  return (
    <div className="document-wrap">
      <article className="document-page semantic-document-page" data-frame-object="document:strategy">
        <input className="doc-eyebrow" value={draft.eyebrow} onChange={(event) => edit('eyebrow', event.target.value)} onBlur={() => commit('eyebrow')} aria-label="Document status" />
        <textarea className="doc-title" value={draft.title} onChange={(event) => edit('title', event.target.value)} onBlur={() => commit('title')} aria-label="Document title" rows={2} />
        <textarea className="doc-summary" value={draft.summary} onChange={(event) => edit('summary', event.target.value)} onBlur={() => commit('summary')} aria-label="Executive summary" rows={3} />

        <div className="doc-divider" />
        <div className="semantic-block-heading"><div><span>SEMANTIC DOCUMENT</span><h2>Strategy blocks</h2></div><small>{semantic.blocks.length} blocks · {semantic.annotations.length} reviews</small></div>

        <div className="semantic-block-list">
          {semantic.blocks.map((block, index) => (
            <div className={`semantic-block semantic-block-${block.type}`} data-frame-object={block.id} key={block.id}>
              <div className="semantic-block-rail">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <button disabled={index === 0} onClick={() => move(block, -1)} title="Move block up"><ChevronUp size={13} /></button>
                <button disabled={index === semantic.blocks.length - 1} onClick={() => move(block, 1)} title="Move block down"><ChevronDown size={13} /></button>
                <button onClick={() => onSemanticCommand({ type: 'document.block.remove', blockId: block.id })} title="Remove block"><Trash2 size={13} /></button>
              </div>
              <div className="semantic-block-content">
                {block.type === 'paragraph' && <ParagraphBlock block={block} onSemanticCommand={onSemanticCommand} />}
                {block.type === 'claim' && <ClaimBlock workspace={workspace} block={block} onSemanticCommand={onSemanticCommand} />}
                {block.type === 'metric-embed' && <MetricEmbed workspace={workspace} block={block} onOpenData={onOpenData} />}
                {block.type === 'decision-embed' && <DecisionEmbed workspace={workspace} block={block} />}
                <BlockReview workspace={workspace} blockId={block.id} onSemanticCommand={onSemanticCommand} />
              </div>
            </div>
          ))}
        </div>

        <div className="semantic-insert-bar">
          <span><Plus size={13} /> Insert block</span>
          <button onClick={addParagraph}><FileText size={13} /> Paragraph</button>
          <button onClick={addEvidence}><Quote size={13} /> Evidence claim</button>
          <button onClick={addMetrics}><BarChart3 size={13} /> Live metrics</button>
          <button onClick={addDecision}><CheckCircle2 size={13} /> Decision</button>
        </div>
      </article>
    </div>
  )
}

function ParagraphBlock({ block, onSemanticCommand }: { block: Extract<SemanticDocumentBlock, { type: 'paragraph' }>; onSemanticCommand: (command: VersionedWorkspaceCommand) => void }) {
  const [text, setText] = useState(block.text)
  useEffect(() => setText(block.text), [block.text])
  const commit = () => { if (text !== block.text) onSemanticCommand({ type: 'document.block.update', blockId: block.id, text }) }
  return <div className="semantic-paragraph"><span className="semantic-block-kind"><FileText size={12} /> Paragraph</span><textarea value={text} onChange={(event) => setText(event.target.value)} onBlur={commit} rows={6} aria-label="Semantic paragraph" /></div>
}

function ClaimBlock({ workspace, block, onSemanticCommand }: { workspace: WorkspaceState; block: Extract<SemanticDocumentBlock, { type: 'claim' }>; onSemanticCommand: (command: VersionedWorkspaceCommand) => void }) {
  const semantic = getSemanticDocument(workspace)
  const claim = semantic.claims.find((item) => item.id === block.claimId)
  if (!claim) return <div className="claim-card stale"><strong>Missing claim object</strong></div>
  const resolved = resolveSemanticClaim(workspace, claim.id)
  const [statement, setStatement] = useState(claim.statement)
  const [rationale, setRationale] = useState(claim.rationale)
  useEffect(() => setStatement(claim.statement), [claim.statement])
  useEffect(() => setRationale(claim.rationale), [claim.rationale])
  const citations = claim.citationIds.map((id) => semantic.citations.find((item) => item.id === id)).filter(Boolean) as SemanticCitation[]
  const statusLabel = resolved.status === 'supported' ? 'SUPPORTED CLAIM' : resolved.status === 'stale' ? 'STALE CLAIM' : 'CONTRADICTED CLAIM'
  return <div className={`claim-card semantic-claim ${resolved.status}`} data-frame-object={claim.id}>
    <div className="claim-header"><span>{statusLabel}</span><label>Confidence <select value={claim.confidence} onChange={(event) => onSemanticCommand({ type: 'claim.update', claimId: claim.id, field: 'confidence', value: event.target.value as 'low'|'medium'|'high' })}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label></div>
    <textarea className="claim-statement-editor" value={statement} onChange={(event) => setStatement(event.target.value)} onBlur={() => { if (statement !== claim.statement) onSemanticCommand({ type: 'claim.update', claimId: claim.id, field: 'statement', value: statement }) }} rows={2} aria-label="Claim statement" />
    <textarea className="claim-rationale-editor" value={rationale} onChange={(event) => setRationale(event.target.value)} onBlur={() => { if (rationale !== claim.rationale) onSemanticCommand({ type: 'claim.update', claimId: claim.id, field: 'rationale', value: rationale }) }} rows={2} aria-label="Claim rationale" />
    <div className="claim-live-check"><Sparkles size={12} /><span>{resolved.liveRationale}</span></div>
    <div className="semantic-citations">{citations.map((citation) => <CitationEditor citation={citation} workspace={workspace} onSemanticCommand={onSemanticCommand} key={citation.id} />)}</div>
  </div>
}

function CitationEditor({ citation, workspace, onSemanticCommand }: { citation: SemanticCitation; workspace: WorkspaceState; onSemanticCommand: (command: VersionedWorkspaceCommand) => void }) {
  const [locator, setLocator] = useState(citation.locator)
  useEffect(() => setLocator(citation.locator), [citation.locator])
  const source = workspace.sources.find((item) => item.id === citation.sourceId)
  const evidence = workspace.graph.objects.find((item) => item.id === citation.evidenceObjectId)
  return <div className="citation-editor" data-frame-object={citation.id}><Link2 size={12} /><div><strong>{source?.label ?? citation.sourceId}</strong><span>{evidence?.label ?? citation.evidenceObjectId}</span></div><input value={locator} onChange={(event) => setLocator(event.target.value)} onBlur={() => { if (locator !== citation.locator) onSemanticCommand({ type: 'citation.update', citationId: citation.id, field: 'locator', value: locator }) }} aria-label="Citation locator" /><small className={source?.status === 'stale' ? 'stale' : ''}>{source?.status ?? 'missing'}</small></div>
}

function MetricEmbed({ workspace, block, onOpenData }: { workspace: WorkspaceState; block: Extract<SemanticDocumentBlock, { type: 'metric-embed' }>; onOpenData: () => void }) {
  const metrics = block.metricIds.map((id) => workspace.metrics.find((metric) => metric.id === id)).filter(Boolean) as WorkspaceState['metrics']
  return <div className="live-object-block"><div className="live-object-header"><div><span className="object-kicker"><Link2 size={12} /> Live object embed</span><h2>{block.label}</h2></div><button className="text-button" onClick={onOpenData}>Open model <ArrowUpRight size={13} /></button></div><div className="metric-grid">{metrics.map((metric) => <div className="metric-card" data-frame-object={`metric:${metric.id}`} key={metric.id}><span>{metric.label}</span><strong>{formatMetric(metric)}</strong><small className={metricDelta(metric) >= 0 ? 'positive' : 'negative'}>{metricDelta(metric) >= 0 ? '↑' : '↓'} {Math.abs(metricDelta(metric)).toFixed(1)} vs prior</small></div>)}</div></div>
}

function DecisionEmbed({ workspace, block }: { workspace: WorkspaceState; block: Extract<SemanticDocumentBlock, { type: 'decision-embed' }> }) {
  const decision = workspace.decisions.find((item) => item.id === block.decisionId)
  if (!decision) return <div className="decision-card"><Circle size={19} /><div><strong>Missing decision</strong></div></div>
  return <div data-frame-object={`decision:${decision.id}`}><span className="semantic-block-kind"><CheckCircle2 size={12} /> Shared decision</span><div className="decision-card">{decision.status === 'approved' ? <CheckCircle2 size={19} /> : <Circle size={19} />}<div><strong>{decision.title}</strong><p>{decision.rationale}</p><span>{decision.status === 'approved' ? 'Approved' : 'Pending approval'} · Owner: {decision.owner}</span></div></div></div>
}

function BlockReview({ workspace, blockId, onSemanticCommand }: { workspace: WorkspaceState; blockId: string; onSemanticCommand: (command: VersionedWorkspaceCommand) => void }) {
  const annotations = getSemanticDocument(workspace).annotations.filter((annotation) => annotation.blockId === blockId)
  const add = (kind: BlockAnnotationKind) => {
    const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`
    const annotation: BlockAnnotation = {
      id: `annotation:${suffix}`,
      blockId,
      kind,
      body: kind === 'comment' ? 'Add review context…' : kind === 'task' ? 'Follow up on this block' : 'Approve this block for the next review',
      owner: 'Strategy',
      status: kind === 'approval' ? 'pending' : 'open',
    }
    onSemanticCommand({ type: 'annotation.insert', annotation })
  }
  return <div className="block-review"><div className="block-review-heading"><span>Review</span><div><button onClick={() => add('comment')}><MessageSquare size={11} /> Comment</button><button onClick={() => add('task')}><ListTodo size={11} /> Task</button><button onClick={() => add('approval')}><ShieldCheck size={11} /> Approval</button></div></div>{annotations.length > 0 && <div className="annotation-list">{annotations.map((annotation) => <AnnotationItem annotation={annotation} onSemanticCommand={onSemanticCommand} key={annotation.id} />)}</div>}</div>
}

function AnnotationItem({ annotation, onSemanticCommand }: { annotation: BlockAnnotation; onSemanticCommand: (command: VersionedWorkspaceCommand) => void }) {
  const [body, setBody] = useState(annotation.body)
  const [owner, setOwner] = useState(annotation.owner)
  useEffect(() => setBody(annotation.body), [annotation.body])
  useEffect(() => setOwner(annotation.owner), [annotation.owner])
  const Icon = annotation.kind === 'comment' ? MessageSquare : annotation.kind === 'task' ? ListTodo : ShieldCheck
  const done = annotation.status === 'resolved' || annotation.status === 'approved'
  const nextStatus = annotation.kind === 'approval' ? (annotation.status === 'approved' ? 'pending' : 'approved') : (annotation.status === 'resolved' ? 'open' : 'resolved')
  return <div className={`annotation-item ${annotation.kind} ${done ? 'done' : ''}`} data-frame-object={annotation.id}><Icon size={13} /><textarea value={body} onChange={(event) => setBody(event.target.value)} onBlur={() => { if (body !== annotation.body) onSemanticCommand({ type: 'annotation.update', annotationId: annotation.id, field: 'body', value: body }) }} rows={1} aria-label={`${annotation.kind} text`} /><input className="annotation-owner" value={owner} onChange={(event) => setOwner(event.target.value)} onBlur={() => { if (owner !== annotation.owner) onSemanticCommand({ type: 'annotation.update', annotationId: annotation.id, field: 'owner', value: owner }) }} aria-label={`${annotation.kind} owner`} /><button className="annotation-status" onClick={() => onSemanticCommand({ type: 'annotation.update', annotationId: annotation.id, field: 'status', value: nextStatus })}>{annotation.kind === 'approval' ? (annotation.status === 'approved' ? 'Approved' : 'Approve') : (annotation.status === 'resolved' ? 'Resolved' : 'Resolve')}</button><button className="annotation-remove" onClick={() => onSemanticCommand({ type: 'annotation.remove', annotationId: annotation.id })} title={`Remove ${annotation.kind}`}><Trash2 size={11} /></button></div>
}
