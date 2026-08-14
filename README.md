# Frame

Frame is an experimental productivity workspace that treats documents, data, and presentations as different views over the same structured work.

This repository contains a local-first React prototype plus a testable semantic workspace engine for shared objects, typed data, formulas, evidence lineage, reversible commands, version history, relationships, reusable visuals, semantic document blocks, and authored presentation structure.

## What is implemented

### Shared workspace

- **Docs, Data, and Present** are purpose-built surfaces over one workspace model.
- Shared metrics, decisions, sources, claims, typed rows, chart definitions, document blocks, review annotations, and presentation scenes retain identity across surfaces instead of being copied.
- Local persistence keeps the current workspace and semantic revision session across reloads.
- **Portable JSON backup/import** preserves state, revision history, abandoned branches, semantic document state, authored presentation state, and schema migration metadata; older workspace-only JSON is accepted and upgraded.

### Frame Docs

The strategy is now an ordered semantic document rather than one body textarea.

Implemented block types:

- **Paragraph** — native text editing committed as one semantic revision on blur.
- **Evidence claim** — explicit claim identity, rationale, confidence, source citation, evidence object, and live support state.
- **Live metric embed** — renders shared metric objects directly from Data.
- **Decision embed** — renders a shared decision object rather than copied prose.

Claims can be **supported**, **stale**, or **contradicted**. A claim becomes stale when its cited source is stale, and can become contradicted when its frozen evidence predicate no longer holds—for example when another region overtakes the cited growth leader.

Claims and citations are editable first-class objects. Citation locators remain attached to source/evidence identity, and semantic graph edges expose claim → block and evidence → citation → claim lineage.

Each document block also supports review state:

- comments
- tasks
- approvals
- owners
- open/resolved/pending/approved status

Reviews remain attached to block identity when a block moves. Removing a block cleans up attached review state and orphan claim/citation objects. All block, claim, citation, and review mutations participate in preview, undo/redo, history, comparison, backup/import, and conflict-aware revert.

Insert controls are available in Docs and through `Cmd/Ctrl + K` slash-style intents:

```text
/paragraph Validate margin before launch.
/claim
/metrics
/decision
```

Legacy document-body edits and append commands remain supported and are mirrored into the first semantic paragraph for compatibility.

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

### Shared chart authoring

**Actual vs plan by region** is one saved relationship-backed chart definition consumed by both Data Analyse and Present. It is not rebuilt independently by each surface.

The chart supports two representations:

```text
Grouped bars
Line
```

Changing the representation is a semantic `chart.kind` transaction. It exposes a before/after diff and downstream impact, persists in history, supports conflict-aware revert, and immediately updates both Data and Present.

It can be changed directly in Data or through `Cmd/Ctrl + K`:

```text
set actual vs plan chart to line
/chart grouped bars
```

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

Composable expressions support grouping, constants, unary signs, `+`, `-`, `*`, and `/` with dimensional validation. The engine tracks semantic dimensions (`currency`, `percent`, `number`) and rejects invalid arithmetic such as adding currency to percent or multiplying currency by currency.

Formula metrics recompute generically after row edits, including when only a `WHERE` dependency changes. For example, changing `Growth` can correctly change `SUM(Regions.Revenue WHERE Growth >= 20)` without touching a revenue cell.

Current shared calculated metrics include:

- **Q2 revenue** — `SUM(Regions.Revenue)`
- **Q2 revenue plan** — `SUM(Plan.Revenue)`
- **Revenue variance** — `SUM(Regions.Revenue) - SUM(Plan.Revenue)`

### Frame Present

Scene content remains live and derived from shared workspace objects, while **story structure is now authored semantic state**.

Implemented authoring controls:

- reorder thesis, performance, signal, and decision scenes
- hide/show scenes without deleting their semantic identity
- edit speaker notes per scene
- keep generated live notes as the fallback when an override is cleared
- preserve order, visibility, and note overrides across reloads/backups/version history

The storyboard rail exposes reorder and visibility controls. Hidden scenes remain recoverable. At least one scene must remain visible.

Presentation state participates in semantic compare and conflict-aware revert. The full-screen player automatically consumes the authored visible sequence and note model.

The performance scene renders the same shared Actual-vs-Plan chart definition used in Data Analyse. Player keyboard navigation supports arrows, Space/PageDown, PageUp, Home/End, and Escape.

Typed story commands are also supported:

```text
hide signal scene
show signal scene
move decision scene first
set performance speaker note to Lead with variance
```

### Semantic object graph and provenance

- Stable object IDs for documents, document blocks, claims, citations, reviews, metrics, actual rows, plan rows, decisions, sources, chart definitions, and presentation scenes.
- Upstream/downstream lineage queries.
- Downstream impact detection for edits.
- Formula changes synchronize derived graph edges.
- Explicit typed-table relationships are resolved and validated rather than silently joining unmatched rows.
- Reusable chart definitions materialize through those relationships.
- Semantic Docs add evidence/citation/review lineage to the same graph.
- Presentation migration ensures thesis and signal scenes have graph identity and live dependencies.
- Source/provenance records include live/stale freshness state.

### Versioning and history

- Semantic changes are stored as transactions with **UUID-backed identities** plus human revision numbers (`v1`, `v2`, ...).
- Undo and redo preserve semantic transactions rather than raw UI snapshots.
- An append-only revision ledger retains abandoned redo branches after branching edits.
- Full **History browser** shows current/applied/undone/branch revisions.
- Any two recorded workspace snapshots can be compared with semantic object/field diffs.
- Historical transactions can be reverted as a **new revision**.
- Reverts are conflict-aware and refuse to overwrite semantic document state, chart representation, story structure, formulas, source freshness, or row values that changed again afterward.
- Old local session formats migrate into the current ledger, including semantic document materialization, presentation authoring state, graph evolution, tables, relationships, chart definitions, and migrated event identities.

### Universal command surface

`Cmd/Ctrl + K` supports deterministic typed intents in addition to suggested actions. Examples:

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
set performance speaker note to Lead with variance

set strategy title to One connected workspace
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

GitHub Actions is intentionally not used while hosted Actions usage is unavailable. The primary full validation path is local on a developer checkout with dependencies installed.

```bash
npm test
npm run test:watch
npm run typecheck
npm run verify
```

`npm run verify` runs tests, TypeScript validation, and the Vite production build when dependencies are installed.

The repository now defines **96 test cases** by source inventory. Coverage includes:

- semantic formulas, filters, dependencies, and typed error cases
- metric recalculation, including filter-only dependency changes
- multi-table Actual/Plan modeling and schema migration
- explicit table relationships and relationship integrity
- reusable relationship-backed chart definitions
- versioned chart representation authoring and conflict-aware revert
- semantic document block migration, editing, insertion, removal, ordering, and legacy-body compatibility
- explicit claims/citations, support/staleness/contradiction, and evidence graph lineage
- block comments, tasks, approvals, owners, status, cleanup, preview, and revert
- semantic presentation state migration, ordering, visibility, note overrides, live content, and revert
- deterministic slash/typed command parsing and previews
- reversible semantic sessions, UUID-backed revisions, abandoned branches, arbitrary version comparison, and conflict-aware reverts
- durable session persistence and migrated event identities
- source freshness transactions
- live presentation narrative derivation
- portable workspace export/import and legacy workspace migration

In the network-restricted implementation environment used for this development pass, the complete historical dependency-backed suite could not be cloned/executed as one checkout. Instead, the newly changed core paths were exercised with strict current-shape TypeScript/runtime harnesses, and the Docs/Data/Present React contracts were separately type-checked with lightweight React/lucide stubs. Those focused verification passes are green; `npm run verify` remains the authoritative full-checkout command.

## Current architecture

```text
src/
  WorkspaceApp.tsx              Workspace shell, persistence, commands, history, backup/import
  model.ts                      Workspace graph, tables, relationships, charts, metrics, seed data
  formulas.ts                   Typed aggregate formulas and WHERE filters
  expressions.ts                Composable semantic arithmetic
  relationships.ts              Explicit table relationship resolver
  charts.ts                     Relationship-backed chart materialization
  chartModel.ts                 Editable shared chart representation state
  semanticDocument.ts           Blocks, claims, citations, reviews, evidence state, graph migration
  presentationState.ts          Story order, visibility, speaker-note overrides, scene migration
  semanticCommands.ts           Versioned structured commands across Docs/Data/Present
  semanticPreview.ts            Pure preview engine for versioned commands
  commandPreview.ts             Legacy-compatible preview helper
  intent.ts                     Deterministic Cmd/Ctrl+K and slash intent parser
  workspaceCompare.ts           Semantic workspace/document/chart/story diff engine
  versioning.ts                 UUID transactions, revision ledger, migrations, undo/redo, snapshots
  revert.ts                     Conflict-aware revert planning/execution
  sessionStore.ts               Durable session hydration/serialization
  workspaceIO.ts                Portable JSON backup/import format
  knowledge.ts                  Derived claims, confidence, freshness, evidence lineage
  presentationModel.ts          Live narrative derivation over authored presentation state

  components/
    DocsSurface.tsx             Semantic block editor, grounded claims, reviews, live embeds
    DataSurface.tsx             Actual/Plan Grid, Model, Analyse, formula/chart authoring
    RelationshipChart.tsx       Shared grouped-bar/line renderer for Data and Present
    PresentSurface.tsx          Authored semantic storyboard
    SemanticScene.tsx           Shared semantic slide renderer
    PresentationPlayer.tsx      Full-screen authored-sequence player
    ContextPanel.tsx            Provenance, claim/review/story health, source freshness, history
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
  semantic-document.css
  relationship-chart.css
  presentation-authoring.css
  command-intent.css
  local-tools.css
  main.tsx

tests/
  chartAuthoring.test.mjs
  charts.test.mjs
  expressions.test.mjs
  formulas.test.mjs
  intent.test.mjs
  knowledge.test.mjs
  model.test.mjs
  planning.test.mjs
  presentationAuthoring.test.mjs
  presentationModel.test.mjs
  preview.test.mjs
  relationships.test.mjs
  semanticDocument.test.mjs
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
6. **Evidence is inspectable.** Claims expose their source, evidence object, confidence, freshness, and contradiction state.
7. **Reviews attach to meaning.** Comments, tasks, and approvals follow semantic block identity rather than screen position.
8. **Automation is previewable.** Structured actions show semantic changes and downstream impact before application.
9. **Reversible by default.** Structured changes become undoable, comparable, revertible transactions.
10. **History is data.** Versions and abandoned branches remain part of the workspace instead of disappearing from an undo stack.
11. **Story structure and story content are separate.** Presentation order/notes can be authored while scene content remains live.
12. **Compatibility later, native model first.** DOCX/XLSX/PPTX adapters matter, but the internal model should not inherit their limitations.

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

### 3. Deeper Present authoring

- Create/delete custom semantic scenes rather than only reordering the canonical scene set.
- Reusable scene-component palette and constraint-based layouts.
- Themes/design tokens and per-scene layout variants.
- Explicit editable source-object bindings for slide components.

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

This is still a focused prototype, not a production office suite. It now validates a broader core thesis: **documents, spreadsheets, presentations, metrics, reviews, relationships, and visuals can remain purpose-built interfaces while operating on the same connected, inspectable, versioned model of work.**
