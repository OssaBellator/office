# Frame

Frame is an experimental productivity workspace that treats documents, data, and presentations as different views over the same structured work.

This repository contains a local-first React prototype plus a testable workspace engine for shared objects, semantic formulas, evidence lineage, reversible commands, version history, and live presentation narratives.

## What is implemented

### Shared workspace

- **Docs, Data, and Present** are purpose-built surfaces over one workspace model.
- Shared metrics, decisions, sources, claims, and regional data retain identity across surfaces instead of being copied.
- `localStorage` persistence keeps the current workspace and semantic revision session across reloads.
- **Portable JSON backup/import** preserves the current state, revision ledger, branches, and migration metadata; older workspace-only JSON is accepted and upgraded.

### Frame Docs

- Editable strategy title, summary, status, and body.
- Text edits commit as semantic revisions on blur while native text-field undo remains intact.
- Live linked business metrics update from Data.
- A derived **supported claim** exposes evidence object, source, confidence, freshness, and rationale.
- Shared decision state renders directly in the document.

### Frame Data

Three working modes are implemented:

- **Grid** — typed regional data with edits committed as atomic semantic transactions.
- **Model** — table schema, editable metric formulas, formula validation, upstream lineage, and downstream consumers.
- **Analyse** — live charting and derived narrative insights.

The formula engine supports meaning-based expressions such as:

```text
SUM(Regions.Revenue)
AVERAGE(Regions.Margin WHERE Growth >= 20)
SUM(Regions.Revenue WHERE Region = "APAC")
SUM(Regions.Revenue WHERE Growth >= 18 AND Margin < 71)
```

Supported aggregations are `SUM`, `AVERAGE`, `MIN`, `MAX`, and `COUNT`. Filters support `=`, `!=`, `>`, `>=`, `<`, `<=`, strings, numbers, and `AND`. Formula validation enforces semantic units so a currency metric cannot silently be defined from a percent field.

### Frame Present

- Interactive four-scene storyboard: thesis, performance, regional signal, and decision.
- Scene titles, speaker cues, sources, and content derive from the shared workspace rather than copied slide text.
- Storyboard scenes are selectable and arrow-key navigable.
- **Full-screen presentation player** is available from the Present surface, using the same semantic scene renderer as the storyboard.
- Player keyboard navigation supports arrows, Space/PageDown, PageUp, Home/End, and Escape.

### Semantic object graph and provenance

- Stable object IDs for documents, metrics, regions, decisions, sources, and presentation scenes.
- Upstream/downstream lineage queries.
- Downstream impact detection for edits.
- Formula changes synchronize derived graph edges.
- Source/provenance records include live/stale freshness state.
- Source freshness changes are versioned, undoable, revertible, and reflected in derived claim status.

### Versioning and history

- Semantic changes are stored as transactions with **UUID-backed identities** plus human revision numbers (`v1`, `v2`, ...).
- Undo and redo preserve semantic transactions rather than raw UI snapshots.
- An append-only revision ledger retains abandoned redo branches after branching edits.
- Full **History browser** shows current/applied/undone/branch revisions.
- Any two recorded workspace snapshots can be compared with semantic object/field diffs.
- Historical transactions can be reverted as a **new revision**.
- Reverts are conflict-aware and refuse to overwrite a field that changed again afterward.
- Old local session formats migrate into the versioned ledger, including migrated event identity alignment.

### Universal command surface

`Cmd/Ctrl + K` supports deterministic typed intents in addition to suggested actions. Examples:

```text
set APAC revenue to 10
update Europe growth 25%
set revenue formula to SUM(Regions.Revenue WHERE Growth >= 20)
set strategy title to One connected workspace
append to strategy: Validate margin before launch.
approve decision
mark finance source stale
show history
open slides
undo
redo
```

Mutation intents go through the same semantic preview, validation, undo, and version-history path as direct UI edits. Invalid formulas and unknown object references are rejected before mutation.

## Run locally

Node 22.6+ is required.

```bash
npm install
npm run dev
```

## Local testing

GitHub Actions is intentionally not used while hosted Actions usage is unavailable. The primary validation path is local.

```bash
npm test
npm run test:watch
npm run typecheck
npm run verify
```

`npm run verify` runs tests, TypeScript validation, and the Vite production build when dependencies are installed.

The committed suite now has **58 tests**, covering:

- semantic formulas, typed filters, filter dependencies, and unit compatibility
- metric recalculation and cross-surface propagation
- dependency lineage and downstream impact
- evidence claims, confidence, and source freshness
- deterministic command parsing and previews
- reversible semantic sessions and legacy hydration
- UUID-backed revisions, abandoned branches, arbitrary version comparison, and conflict-aware reverts
- durable session persistence and migrated event identities
- source freshness transactions
- presentation narrative derivation
- portable workspace export/import and legacy workspace migration

## Current architecture

```text
src/
  WorkspaceApp.tsx              Workspace shell, persistence, commands, history, backup/import
  model.ts                      Core workspace graph, schemas, seed data, legacy mutations
  formulas.ts                   Semantic formula parser/evaluator with filters
  semanticCommands.ts           Versioned structured commands and formula/source validation
  semanticPreview.ts            Pure preview engine for versioned commands
  commandPreview.ts             Legacy-compatible preview helper
  intent.ts                     Deterministic Cmd/Ctrl+K intent parser
  workspaceCompare.ts           Semantic workspace diff engine
  versioning.ts                 UUID transactions, revision ledger, undo/redo, snapshots
  revert.ts                     Conflict-aware revert planning/execution
  sessionStore.ts               Durable session hydration/serialization
  workspaceIO.ts                Portable JSON backup/import format
  knowledge.ts                  Derived claims, confidence, freshness, evidence lineage
  presentationModel.ts          Pure live narrative/scene derivation

  components/
    DocsSurface.tsx             Document surface and grounded claim UI
    DataSurface.tsx             Grid, Model, Analyse, formula editor
    PresentSurface.tsx          Interactive storyboard
    SemanticScene.tsx           Shared semantic slide renderer
    PresentationPlayer.tsx      Full-screen presentation player
    ContextPanel.tsx            Provenance, source freshness, semantic history
    HistoryBrowser.tsx          Version list, compare, conflict-aware revert
    CommandPalette.tsx          Typed universal commands and preview UI

  styles.css
  model-view.css
  history.css
  history-browser.css
  present.css
  presentation-player.css
  command-intent.css
  local-tools.css
  main.tsx

tests/
  formulas.test.mjs
  intent.test.mjs
  knowledge.test.mjs
  model.test.mjs
  presentationModel.test.mjs
  preview.test.mjs
  semanticPreview.test.mjs
  sessionStore.test.mjs
  session-versioning.test.mjs
  sourceStatus.test.mjs
  versioning.test.mjs
  workspaceIO.test.mjs
```

## Product principles encoded in the prototype

1. **Projects before files.** The workspace is the primary unit; document, data, and presentation views live inside it.
2. **One object, many representations.** Shared concepts retain identity across surfaces.
3. **Purpose-built surfaces.** Docs, Data, and Present have different interaction models without becoming separate information silos.
4. **Meaning before coordinates.** Formulas reference semantic tables and fields rather than accidental cell locations.
5. **Evidence is inspectable.** Claims expose their source, evidence object, confidence, and freshness.
6. **Automation is previewable.** Structured actions show semantic changes and downstream impact before application.
7. **Reversible by default.** Structured changes become undoable, comparable, revertible transactions.
8. **History is data.** Versions and abandoned branches remain part of the workspace instead of disappearing from an undo stack.
9. **Compatibility later, native model first.** DOCX/XLSX/PPTX adapters matter, but the internal model should not inherit their limitations.

## Suggested next milestones

### 1. Semantic Docs editor

- Replace plain textareas with a rich-text editor built from semantic blocks.
- Make claims/citations explicit editable block objects rather than only derived UI.
- Inline live-object embeds and slash/command insertion.
- Comments, tasks, owners, decisions, and approvals attached to blocks.

### 2. Multi-table Data model

- Multiple typed tables and explicit relationships.
- Formula autocomplete/reference browser.
- Grouped aggregation and richer expression composition.
- Reusable chart definitions as shared objects.
- Metric-definition management beyond the current revenue example.

### 3. Semantic Present authoring

- Create, delete, and reorder scenes as workspace objects.
- Reusable semantic slide components and constraint-based layouts.
- Editable speaker notes and themes/design tokens.
- Explicit source-object links for every slide component.

### 4. Collaboration and storage

- Server-backed workspace persistence and authentication.
- Permissions and explicit AI/automation capabilities.
- Realtime multiplayer/CRDT layer.
- Server-side semantic ledger and merge/conflict model.

### 5. Compatibility adapters

- DOCX import/export.
- XLSX import/export.
- PPTX import/export.
- PDF/CSV/Markdown export where appropriate.

## Status

This is still a focused prototype, not a production office suite. It now validates a larger part of the core thesis: **a document, spreadsheet, and presentation can remain distinct tools while operating on the same connected, inspectable, versioned model of work.**
