# Frame

Frame is an experimental productivity workspace that treats documents, data, and presentations as different views over the same structured work.

The central product idea is simple: **create information once, then write it, analyse it, present it, review it, and publish it without rebuilding it in separate applications.**

This repository contains a local-first React prototype plus a semantic workspace engine for shared objects, typed data, formulas, evidence lineage, review provenance, reversible commands, version history, relationships, reusable visuals, semantic document blocks, authored presentation structure, and governed Office/Google interoperability.

## What is implemented

### Shared workspace

- **Docs, Data, and Present** are purpose-built surfaces over one workspace model.
- Shared metrics, decisions, sources, claims, typed rows, chart definitions, document blocks, review records, imported review provenance, and presentation scenes retain identity across surfaces instead of being copied.
- Local persistence keeps the current workspace and semantic revision session across reloads.
- **Portable JSON backup/import** preserves state, revision history, abandoned branches, semantic document state, authored presentation state, imported Data fidelity, review provenance, and schema migration metadata; older workspace-only JSON is accepted and upgraded.

### Frame Docs

The strategy is an ordered semantic document rather than one body textarea.

Implemented block types:

- **Paragraph** — native text editing committed as one semantic revision on blur.
- **Evidence claim** — explicit claim identity, rationale, confidence, source citation, evidence object, and live support state.
- **Live metric embed** — renders shared metric objects directly from Data.
- **Decision embed** — renders a shared decision object rather than copied prose.

Claims can be **supported**, **stale**, or **contradicted**. A claim becomes stale when its cited source is stale, and can become contradicted when its frozen evidence predicate no longer holds.

Claims and citations are editable first-class objects. Citation locators remain attached to source/evidence identity, and semantic graph edges expose claim → block and evidence → citation → claim lineage.

Each document block also supports native review state:

- comments
- tasks
- approvals
- owners
- open/resolved/pending/approved status

Reviews remain attached to block identity when a block moves. Removing a block cleans up attached review state and orphan claim/citation objects. Block, claim, citation, and review mutations participate in preview, undo/redo, history, comparison, backup/import, and conflict-aware revert.

Insert controls are available in Docs and through `Cmd/Ctrl + K` slash-style intents:

```text
/paragraph Validate margin before launch.
/claim
/metrics
/decision
```

### Frame Data

Three working modes are implemented:

- **Grid** — typed Actual and Plan tables, with edits committed as atomic semantic transactions.
- **Model** — table schemas, explicit relationships, editable metric formulas, unit validation, upstream lineage, downstream consumers, and shared chart lineage.
- **Analyse** — a reusable Actual-vs-Plan chart object plus derived narrative insights.

The core typed tables are:

```text
Regions
  Region   text
  Revenue  currency
  Growth   percent
  Margin   percent

Plan
  Region   text
  Revenue  currency
```

The model includes an explicit relationship:

```text
Regions.Region ↔ Plan.Region
```

Foreign spreadsheet schemas are retained as **Imported Data** instead of being discarded. Imported XLSX/Google Sheets data can preserve typed values, formula provenance, number formats, source date system, hidden/very-hidden sheet state, trusted/inert hyperlinks, classic Excel notes, and modern threaded review conversations.

### Source review → native Frame review

Frame deliberately separates **what an imported source said** from **what the workspace has decided to do about it**.

- Classic Excel notes remain read-only source provenance and retain author, text, and original A1 cell reference when available.
- Modern threaded Excel comments retain people, comment/reply IDs, parent relationships, timestamps, resolution state, and mentions.
- Source review is searchable, version-diffed, persisted, fingerprinted, and visible on Data cells and in the Context review inbox.
- Source review does **not** block workspace readiness by itself.
- **Promote** opens a review editor rather than mutating immediately: users choose Task / Comment / Approval, owner, and native Frame follow-up text while the source review remains immutable.
- Tasks/comments may remain unassigned; promoted approvals require an explicit owner and begin pending.
- Promoted Data review participates in semantic history, undo/redo, revert, readiness, and Office export preflight.
- Re-import remaps promoted review by stable source identity. Ambiguous or missing source review is preserved on an explicit `· review archive` table rather than guessed or dropped.
- Archived native review exposes **Relink**. Frame ranks compatible refreshed source notes/threads by stable identity, sheet, source text, author, and column; the user explicitly selects the target.
- Relinking preserves the native review ID, authored body, owner, kind, status, timestamp, and history while changing only its Data target/source pointer. Undo restores the archive placement.
- Copied source provenance inside a review archive is excluded from the normal source-review inbox so it cannot be promoted a second time.
- Imported tables with open promoted review work are protected from deletion until that native work is resolved/approved.

See `docs/REVIEW_PROVENANCE.md` for the review/source identity contract.

### Shared chart authoring

**Actual vs plan by region** is one saved relationship-backed chart definition consumed by both Data Analyse and Present. It is not rebuilt independently by each surface.

The chart supports grouped bars and line representations. Changing representation is a semantic `chart.kind` transaction with before/after diff, downstream impact, durable history, conflict-aware revert, and immediate updates in both Data and Present.

### Semantic formulas and expressions

Meaning-based formulas reference tables and fields rather than cell coordinates.

Examples:

```text
SUM(Regions.Revenue)
AVERAGE(Regions.Margin WHERE Growth >= 20)
SUM(Regions.Revenue WHERE Region = "APAC")
SUM(Regions.Revenue WHERE Growth >= 18 AND Margin < 71)
```

Supported aggregations are `SUM`, `AVERAGE`, `MIN`, `MAX`, and `COUNT`. Filters support `=`, `!=`, `>`, `>=`, `<`, `<=`, strings, numbers, and `AND`.

Composable expressions support grouping, constants, unary signs, `+`, `-`, `*`, and `/` with dimensional validation. The engine tracks semantic dimensions (`currency`, `percent`, `number`) and rejects invalid arithmetic such as adding currency to percent or multiplying currency by currency.

Formula metrics recompute generically after row edits, including when only a `WHERE` dependency changes.

Current shared calculated metrics include:

- **Q2 revenue** — `SUM(Regions.Revenue)`
- **Q2 revenue plan** — `SUM(Plan.Revenue)`
- **Revenue variance** — `SUM(Regions.Revenue) - SUM(Plan.Revenue)`

### Frame Present

Scene content remains live and derived from shared workspace objects, while **story structure is authored semantic state**.

Implemented authoring controls include:

- reorder scenes
- hide/show scenes without deleting semantic identity
- edit speaker notes per scene
- keep generated live notes as the fallback when an override is cleared
- preserve order, visibility, and note overrides across reloads/backups/version history

Presentation state participates in semantic compare and conflict-aware revert. The full-screen player consumes the authored visible sequence and note model. The performance scene renders the same shared Actual-vs-Plan chart definition used in Data Analyse.

### Semantic object graph and provenance

- Stable object IDs for documents, blocks, claims, citations, native reviews, metrics, actual rows, plan rows, decisions, sources, chart definitions, and presentation scenes.
- Upstream/downstream lineage queries and downstream impact detection.
- Formula changes synchronize derived graph edges.
- Explicit typed-table relationships are resolved and validated rather than silently joining unmatched rows.
- Reusable chart definitions materialize through those relationships.
- Semantic Docs add evidence/citation/review lineage to the same graph.
- Source/provenance records include live/stale freshness state.
- Imported spreadsheet provenance participates in workspace fingerprints, history, search, interoperability reporting, and conflict-safe revert.

### Versioning and history

- Semantic changes are stored as transactions with **UUID-backed identities** plus human revision numbers (`v1`, `v2`, ...).
- Undo and redo preserve semantic transactions rather than raw UI snapshots.
- An append-only revision ledger retains abandoned redo branches after branching edits.
- The **History browser** shows current/applied/undone/branch revisions.
- Any two recorded workspace snapshots can be compared with semantic object/field diffs.
- Historical transactions can be reverted as a **new revision**.
- Reverts are conflict-aware and refuse to overwrite state that changed again afterward.
- Review-aware comparison includes imported notes, threaded conversations, promoted native Data review, archive placement, and relinked source pointers separately from underlying cell values.

### Universal command surface

`Cmd/Ctrl + K` supports deterministic typed intents in addition to suggested actions. Mutation intents go through the same semantic preview, validation, undo, and version-history path as direct UI edits.

Examples:

```text
set APAC revenue to 10
update Europe growth 25%
set APAC plan to 10.5
set revenue formula to SUM(Regions.Revenue WHERE Growth >= 20)
/paragraph Validate margin before launch.
/claim
/metrics
/decision
set actual vs plan chart to line
hide signal scene
move decision scene first
approve decision
mark finance source stale
show history
undo
redo
```

### Office and Google interoperability

Interoperability is implemented as **semantic import** and **compatibility export**, not as a second internal file model.

Implemented product paths include:

- secure local DOCX/PPTX/XLSX import through bounded OOXML/ZIP inspection;
- macro/ActiveX rejection;
- governed semantic preview before Apply;
- direct read-only Google Drive import for native Docs/Sheets/Slides by exporting to OOXML in memory and routing through the same secure pipeline;
- DOCX, PPTX, and XLSX compatibility export with explicit preflight assessment;
- CSV/Markdown compatibility paths and lossless Frame JSON backup;
- package validation and dedicated local interoperability fixtures/tooling.

Current XLSX fidelity includes typed booleans, hidden/very-hidden sheets, 1900/1904 date-system provenance, formula text beside cached values, safe number-format projection, safe/inert hyperlink handling, classic cell-note provenance, modern threaded-comment provenance, native promoted Data review accounting, fail-safe review archives, and explicit archive relinking.

Normal XLSX export deliberately keeps unsupported review semantics in Frame rather than silently flattening or embedding hidden metadata. The Office export page tells the user what stays behind before download.

Detailed contracts live in:

- `docs/INTEROPERABILITY.md`
- `docs/INTEROPERABILITY_IMPLEMENTATION_STATUS.md`
- `docs/INTEROPERABILITY_TESTING.md`
- `docs/REVIEW_PROVENANCE.md`

## Run locally

Node 22.6+ is required.

```bash
npm install
npm run dev
```

## Local testing

GitHub Actions is intentionally not the canonical validation path while hosted Actions usage is unavailable. Run validation on a developer checkout with dependencies installed.

```bash
npm test
npm run test:interop
npm run test:watch
npm run typecheck
npm run verify
```

- `npm test` runs the complete Node test inventory.
- `npm run test:interop` runs the focused Office/Google/imported-review interoperability suite, including promotion and archive relinking.
- `npm run verify` runs tests, TypeScript validation, and the Vite production build.

Coverage spans semantic formulas, relationships, charts, semantic Docs, review workflows, versioning/revert, presentation authoring, command/runtime codecs, portable workspace IO, secure Office parsing, Google Drive import, migration/synchronization, package validation, spreadsheet fidelity, source review, native review promotion/relinking, and interoperability export policy.

The current connector-only implementation environment cannot execute the complete dependency-backed checkout or open generated files in installed Microsoft Office applications. The committed local tests and `npm run verify` remain the authoritative validation gate; manual current-Microsoft-365 smoke testing remains a separate interoperability release gate.

## Current architecture

```text
src/
  WorkspaceApp.tsx              Workspace shell, persistence, commands, history, transfer entrypoints
  model.ts                      Workspace graph, typed tables, relationships, metrics, seed data
  formulas.ts                   Typed aggregate formulas and WHERE filters
  expressions.ts                Composable semantic arithmetic
  relationships.ts              Explicit table relationship resolver
  charts.ts                     Relationship-backed chart materialization
  chartModel.ts                 Editable shared chart representation state
  semanticDocument.ts           Blocks, claims, citations, Docs review, evidence state
  semanticCommands.ts           Versioned structured commands across Docs/Data/Present
  semanticPreview.ts            Pure preview engine for versioned commands
  versioning.ts                 UUID transactions, revision ledger, migrations, undo/redo
  revert.ts                     Conflict-aware revert planning/execution
  sessionStore.ts               Durable session hydration/serialization
  workspaceCompare.ts           Core semantic workspace diff engine
  workspaceReviewCompare.ts     Review-aware Data/source/native-review comparison
  workspaceReviews.ts           Native promoted Data review model
  workspaceReviewInbox.ts       Unified Docs/Data/source review projection
  reviewPromotion.ts            Source-review → native Frame review planning
  reviewRelink.ts               Explicit review-archive candidate ranking and relinking
  importedTables.ts             Imported Data + per-cell fidelity/review provenance model
  importedTableCodec.ts         Runtime validation for imported Data and promoted review
  officeInteropImport.ts        Canonical secure Office interoperability enrichment pipeline
  officeImportSync.ts           Source-aware re-import and fail-safe review remapping/archive
  officeExportAssessment.ts     Compatibility-export fidelity/preflight policy
  xlsxCommentImport.ts          Classic Excel note provenance
  xlsxThreadedCommentImport.ts  Modern Excel threaded review provenance
  presentationState.ts          Story order, visibility, speaker-note overrides
  presentationModel.ts          Live narrative derivation over authored presentation state

  components/
    DocsSurface.tsx
    DataSurface.tsx
    ImportedTablesPanel.tsx
    RelationshipChart.tsx
    PresentSurface.tsx
    SemanticScene.tsx
    PresentationPlayer.tsx
    ContextPanel.tsx
    ReviewPromotionDialog.tsx
    ReviewRelinkDialog.tsx
    HistoryBrowser.tsx
    CommandPalette.tsx
```

## Product principles encoded in the prototype

1. **Projects before files.** The workspace is the primary unit; document, data, and presentation views live inside it.
2. **One object, many representations.** Shared concepts and visuals retain identity across surfaces.
3. **Purpose-built surfaces.** Docs, Data, and Present have different interaction models without becoming separate information silos.
4. **Meaning before coordinates.** Native formulas reference semantic tables and fields rather than accidental cell positions.
5. **Relationships are explicit.** Cross-table visuals and calculations do not rely on invisible positional joins.
6. **Evidence is inspectable.** Claims expose source, evidence object, confidence, freshness, and contradiction state.
7. **Reviews attach to meaning.** Native comments/tasks/approvals follow semantic identity; imported review preserves its source identity.
8. **Provenance is preserved; accountability is explicit.** Importing feedback and deciding what to do about it are related but distinct actions.
9. **Automation is previewable.** Structured actions show semantic changes and downstream impact before application.
10. **Reversible by default.** Structured changes become undoable, comparable, revertible transactions.
11. **History is data.** Versions and abandoned branches remain part of the workspace instead of disappearing from an undo stack.
12. **Story structure and story content are separate.** Presentation order/notes can be authored while scene content remains live.
13. **Compatibility is a projection, not the native model.** Office/Google adapters are important, but Frame does not inherit their structural limitations or silently invent fidelity it cannot preserve.
14. **Ambiguity should surface, not disappear.** Re-import archives and explicit relinking preserve work when automatic source matching cannot be trusted.

## Suggested next milestones

### 1. Deeper semantic Docs editing

- Inline text marks/headings/lists inside paragraph blocks instead of plain block textareas.
- Selection-based comments and citations within blocks.
- Explicit manual-claim creation and evidence reassignment UI.
- Review filters, assignee views, and document-level approval gates.

### 2. Deeper Data modeling

- Relationship-aware lookup/join functions in semantic expressions.
- Formula reference autocomplete and metric registry UI.
- Additional relationship cardinalities and integrity diagnostics.
- Additional editable chart properties and chart types.
- Grouped aggregations and richer expression composition.
- Additional typed tables beyond Actual and Plan.

### 3. Review and collaboration

- Workspace-wide native review storage independent of imported-table ownership.
- Assignee/filter views across Docs and Data review.
- Batch triage/promotion for large imported review sets.
- Explicit archive cleanup/detach controls after native review is resolved or safely relinked.
- Multi-user review activity, mentions, and permission-aware approvals once server collaboration exists.

### 4. Deeper Present authoring

- Create/delete custom semantic scenes rather than only reordering the canonical scene set.
- Reusable scene-component palette and constraint-based layouts.
- Themes/design tokens and per-scene layout variants.
- Explicit editable source-object bindings for slide components.

### 5. Collaboration and storage

- Server-backed workspace persistence and authentication.
- Permissions and explicit AI/automation capabilities.
- Realtime multiplayer/CRDT layer.
- Server-side semantic ledger and merge/conflict model.

### 6. Interoperability depth and validation

- Represent Word comments/revisions as Frame review/version events.
- Import DOCX/PPTX media into reusable Frame media objects.
- Convert PowerPoint charts/tables into linked semantic objects.
- Expand reviewable foreign-formula translation into native Frame formulas.
- Add meaningful spreadsheet presentation semantics without recreating a formatting-first grid model.
- Expand current Microsoft 365 / Google Workspace fixture corpus and manual application smoke testing.

## Status

This is still a focused prototype, not a production office suite. It validates a broader thesis: **documents, spreadsheets, presentations, metrics, reviews, relationships, visuals, and compatibility files can remain purpose-built interfaces while operating on the same connected, inspectable, versioned model of work.**
