# Frame

Frame is an experimental productivity workspace that treats documents, data, and presentations as different views over the same structured work.

This repository contains a local-first React prototype plus a testable semantic workspace engine for shared objects, typed data, formulas, evidence lineage, reversible commands, version history, relationships, and reusable presentation/data visuals.

## What is implemented

### Shared workspace

- **Docs, Data, and Present** are purpose-built surfaces over one workspace model.
- Shared metrics, decisions, sources, claims, typed rows, chart definitions, and presentation scenes retain identity across surfaces instead of being copied.
- Local persistence keeps the current workspace and semantic revision session across reloads.
- **Portable JSON backup/import** preserves state, revision history, abandoned branches, and schema migration metadata; older workspace-only JSON is accepted and upgraded.

### Frame Docs

- Editable strategy title, summary, status, and body.
- Text edits commit as semantic revisions on blur while native text-field undo remains intact.
- Live linked metrics update from Data.
- A derived **supported claim** exposes evidence object, source, confidence, freshness, and rationale.
- Shared decision state renders directly in the document.
- Source freshness changes are reflected in claim status.

### Frame Data

Three working modes are implemented:

- **Grid** — typed Actual and Plan tables, with edits committed as atomic semantic transactions.
- **Model** — table schemas, explicit relationships, editable metric formulas, unit validation, upstream lineage, downstream consumers, and shared chart lineage.
- **Analyse** — a reusable Actual-vs-Plan chart object plus derived narrative insights.

The current typed tables are:

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

The model includes an explicit one-to-one relationship:

```text
Regions.Region ↔ Plan.Region
```

The same saved chart definition — **Actual vs plan by region** — is materialized in both Data Analyse and Present.

### Semantic formulas and expressions

Meaning-based formulas reference tables and fields rather than cell coordinates.

Supported aggregate formulas include:

```text
SUM(Regions.Revenue)
AVERAGE(Regions.Margin WHERE Growth >= 20)
SUM(Regions.Revenue WHERE Region = "APAC")
SUM(Regions.Revenue WHERE Growth >= 18 AND Margin < 71)
```

Supported aggregations are `SUM`, `AVERAGE`, `MIN`, `MAX`, and `COUNT`. Filters support `=`, `!=`, `>`, `>=`, `<`, `<=`, strings, numbers, and `AND`.

Composable expressions support grouping, constants, unary signs, `+`, `-`, `*`, and `/` with dimensional validation:

```text
SUM(Regions.Revenue) - SUM(Plan.Revenue)
SUM(Regions.Revenue) / SUM(Plan.Revenue) * 100
```

The engine tracks semantic dimensions (`currency`, `percent`, `number`) and rejects invalid arithmetic such as adding currency to percent or multiplying currency by currency.

Formula metrics recompute generically after row edits, including when only a `WHERE` dependency changes. For example, changing `Growth` can correctly change `SUM(Regions.Revenue WHERE Growth >= 20)` without touching a revenue cell.

Current shared calculated metrics include:

- **Q2 revenue** — `SUM(Regions.Revenue)`
- **Q2 revenue plan** — `SUM(Plan.Revenue)`
- **Revenue variance** — `SUM(Regions.Revenue) - SUM(Plan.Revenue)`
- **Revenue attainment** — `SUM(Regions.Revenue) / SUM(Plan.Revenue) * 100`

### Frame Present

- Interactive four-scene storyboard: thesis, performance, regional signal, and decision.
- Scene titles, speaker cues, sources, metrics, and content derive from the shared workspace rather than copied slide text.
- Storyboard scenes are selectable and arrow-key navigable.
- The performance scene renders the same shared Actual-vs-Plan chart definition used in Data Analyse.
- **Full-screen presentation player** is available from the Present surface, using the same semantic scene renderer as the storyboard.
- Player keyboard navigation supports arrows, Space/PageDown, PageUp, Home/End, and Escape.

### Semantic object graph and provenance

- Stable object IDs for documents, metrics, actual rows, plan rows, decisions, sources, chart definitions, and presentation scenes.
- Upstream/downstream lineage queries.
- Downstream impact detection for edits.
- Formula changes synchronize derived graph edges.
- Explicit typed-table relationships are resolved and validated rather than silently joining unmatched rows.
- Reusable chart definitions materialize through those relationships.
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
- Old local session formats migrate into the current ledger, including new tables, graph objects, relationships, chart definitions, formula metrics, and migrated event identities.

### Universal command surface

`Cmd/Ctrl + K` supports deterministic typed intents in addition to suggested actions. Examples:

```text
set APAC revenue to 10
update Europe growth 25%
set APAC plan to 10.5
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

The committed suite currently has **75 tests**, covering:

- semantic formulas, filters, dependencies, and typed error cases
- dimensional arithmetic expressions and actual/plan ratios
- metric recalculation, including filter-only dependency changes
- multi-table Actual/Plan modeling and schema migration
- explicit table relationships and relationship integrity
- reusable relationship-backed chart definitions
- cross-surface metric/chart propagation
- evidence claims, confidence, provenance, and source freshness
- deterministic command parsing and previews
- reversible semantic sessions and legacy hydration
- UUID-backed revisions, abandoned branches, arbitrary version comparison, and conflict-aware reverts
- durable session persistence and migrated event identities
- source freshness transactions
- live presentation narrative derivation
- portable workspace export/import and legacy workspace migration

## Current architecture

```text
src/
  WorkspaceApp.tsx              Workspace shell, persistence, commands, history, backup/import
  model.ts                      Workspace graph, tables, relationships, charts, metrics, seed data
  formulas.ts                   Typed aggregate formulas and WHERE filters
  expressions.ts                Composable dimension-aware semantic arithmetic
  relationships.ts              Explicit table relationship resolver
  charts.ts                     Reusable relationship-backed chart materialization
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
    DataSurface.tsx             Actual/Plan Grid, Model, Analyse, formula editors
    PresentSurface.tsx          Interactive storyboard
    SemanticScene.tsx           Shared semantic slide renderer and shared chart consumer
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
  plan-model.css
  plan-presentation.css
  shared-chart.css
  command-intent.css
  local-tools.css
  main.tsx

tests/
  charts.test.mjs
  expressions.test.mjs
  formulas.test.mjs
  intent.test.mjs
  knowledge.test.mjs
  model.test.mjs
  planning.test.mjs
  presentationModel.test.mjs
  preview.test.mjs
  relationships.test.mjs
  semanticPreview.test.mjs
  sessionStore.test.mjs
  session-versioning.test.mjs
  sourceStatus.test.mjs
  versioning.test.mjs
  workspaceIO.test.mjs
```

## Product principles encoded in the prototype

1. **Projects before files.** The workspace is the primary unit; document, data, and presentation views live inside it.
2. **One object, many representations.** Shared concepts and visuals retain identity across surfaces.
3. **Purpose-built surfaces.** Docs, Data, and Present have different interaction models without becoming separate information silos.
4. **Meaning before coordinates.** Formulas reference semantic tables and fields rather than accidental cell positions.
5. **Relationships are explicit.** Cross-table visuals and calculations do not rely on invisible positional joins.
6. **Evidence is inspectable.** Claims expose their source, evidence object, confidence, and freshness.
7. **Automation is previewable.** Structured actions show semantic changes and downstream impact before application.
8. **Reversible by default.** Structured changes become undoable, comparable, revertible transactions.
9. **History is data.** Versions and abandoned branches remain part of the workspace instead of disappearing from an undo stack.
10. **Compatibility later, native model first.** DOCX/XLSX/PPTX adapters matter, but the internal model should not inherit their limitations.

## Suggested next milestones

### 1. Semantic Docs editor

- Replace plain textareas with a rich-text editor built from semantic blocks.
- Make claims/citations explicit editable block objects rather than only derived UI.
- Inline live-object embeds and slash/command insertion.
- Comments, tasks, owners, decisions, and approvals attached to blocks.

### 2. Deeper Data modeling

- Relationship-aware lookup/join functions in semantic expressions.
- Formula reference autocomplete and metric registry UI.
- Additional relationship cardinalities and integrity diagnostics.
- More reusable chart types and editable chart definitions.
- Grouped aggregations and richer expression composition.
- Additional typed tables beyond Actual and Plan.

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

This is still a focused prototype, not a production office suite. It now validates a substantial part of the core thesis: **documents, spreadsheets, presentations, metrics, relationships, and visuals can remain purpose-built interfaces while operating on the same connected, inspectable, versioned model of work.**
