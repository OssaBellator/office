import type { VersionedWorkspaceSession, VersionedWorkspaceTransaction } from './versioning.ts'

export type SessionIntegrityIssue = {
  id: string
  severity: 'error' | 'warning'
  message: string
  transactionId?: string
}

export type SessionIntegrityReport = {
  valid: boolean
  issues: SessionIntegrityIssue[]
  maxRevision: number
}

function sameState(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function issue(id: string, message: string, transactionId?: string): SessionIntegrityIssue {
  return { id, severity:'error', message, transactionId }
}

function auditEventIdentity(transaction: VersionedWorkspaceTransaction, issues: SessionIntegrityIssue[]) {
  const event = transaction.after.history[0]
  if (!event) issues.push(issue(`event-missing:${transaction.id}`, 'Transaction after-state is missing its leading change event.', transaction.id))
  else if (event.id !== transaction.eventId) issues.push(issue(`event-mismatch:${transaction.id}`, `Transaction eventId ${transaction.eventId} does not match after-state event ${event.id}.`, transaction.id))
}

export function auditVersionedSession(session: VersionedWorkspaceSession): SessionIntegrityReport {
  const issues: SessionIntegrityIssue[] = []
  const ids = new Set<string>()
  const revisions = new Set<number>()
  let maxRevision = 0

  for (const transaction of session.ledger) {
    if (ids.has(transaction.id)) issues.push(issue(`duplicate-id:${transaction.id}`, `Duplicate transaction ID in ledger: ${transaction.id}`, transaction.id))
    ids.add(transaction.id)
    if (revisions.has(transaction.revision)) issues.push(issue(`duplicate-revision:${transaction.revision}`, `Duplicate semantic revision in ledger: v${transaction.revision}`, transaction.id))
    revisions.add(transaction.revision)
    maxRevision = Math.max(maxRevision, transaction.revision)
    auditEventIdentity(transaction, issues)
  }

  if (session.nextRevision <= maxRevision) issues.push(issue('next-revision-stale', `nextRevision ${session.nextRevision} must be greater than max ledger revision ${maxRevision}.`))

  const ledgerIds = new Set(session.ledger.map((transaction) => transaction.id))
  for (const transaction of [...session.past, ...session.future]) {
    if (!ledgerIds.has(transaction.id)) issues.push(issue(`ledger-missing:${transaction.id}`, 'Undo/redo transaction is missing from the append-only ledger.', transaction.id))
  }

  for (let index = 1; index < session.past.length; index += 1) {
    const previous = session.past[index - 1], current = session.past[index]
    if (!sameState(previous.after, current.before)) issues.push(issue(`past-chain:${current.id}`, `Applied transaction v${current.revision} does not begin from v${previous.revision}'s after-state.`, current.id))
  }
  if (session.past.length) {
    const current = session.past.at(-1)!
    if (!sameState(current.after, session.present)) issues.push(issue('present-detached', `Present workspace does not equal current applied revision v${current.revision}.`, current.id))
  }

  if (session.future.length) {
    if (!sameState(session.present, session.future[0].before)) issues.push(issue(`future-head:${session.future[0].id}`, 'First redo transaction does not begin from the present workspace.', session.future[0].id))
    for (let index = 1; index < session.future.length; index += 1) {
      const previous = session.future[index - 1], current = session.future[index]
      if (!sameState(previous.after, current.before)) issues.push(issue(`future-chain:${current.id}`, `Redo transaction v${current.revision} does not continue from the preceding redo transaction.`, current.id))
    }
  }

  return { valid:issues.length === 0, issues, maxRevision }
}

export function assertVersionedSessionIntegrity(session: VersionedWorkspaceSession) {
  const report = auditVersionedSession(session)
  if (!report.valid) throw new Error(`Invalid semantic workspace session: ${report.issues.map((item) => item.message).join(' | ')}`)
  return session
}
