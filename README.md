# Frame

Frame is an experimental productivity workspace that treats documents, data, and presentations as different views over the same structured work.

This repository currently contains the first product prototype: a local-first React application demonstrating the core interaction model.

## What is implemented

- **Shared workspace shell** for navigating Docs, Data, and Present surfaces.
- **Frame Docs** with editable strategy content, live business metrics, a connected decision object, and source-aware UI.
- **Frame Data** with a typed regional revenue table, editable values, a derived total, simple analysis, and live charting.
- **Frame Present** with a narrative/storyboard interface and a presentation scene derived from the same live metrics used elsewhere.
- **Shared object model** for metrics, typed rows, decisions, and document content.
- **Cross-surface propagation**: changing regional revenue recalculates the shared Q2 revenue metric, which immediately updates Docs and Present.
- **Command palette** (`Cmd/Ctrl + K`) with deterministic prototype actions for navigating, adding evidence, approving a shared decision, and resetting the demo.
- **Local persistence** through `localStorage` so edits survive reloads without requiring backend infrastructure yet.

## Run locally

```bash
npm install
npm run dev
```

Build a production bundle with:

```bash
npm run build
```

## Current architecture

```text
src/
  App.tsx       Product surfaces and interaction layer
  model.ts      Shared workspace/object model and seed data
  main.tsx      React entrypoint
  styles.css    Product visual system and responsive layouts
```

The prototype deliberately keeps state management small. The next architectural step should be extracting the workspace model into a dedicated state/data layer before adding multiplayer collaboration or a backend.

## Product principles encoded in the prototype

1. **Projects before files.** The workspace is the primary unit; document, data, and presentation views live inside it.
2. **One object, many representations.** Metrics and decisions retain identity across surfaces rather than being copied.
3. **Purpose-built surfaces.** Docs, Data, and Present have different interaction models even though they share underlying objects.
4. **Inspectable automation.** AI-like actions should operate on structured objects and become previewable changes rather than opaque chat output.
5. **Compatibility later, native model first.** DOCX/XLSX/PPTX import/export will matter, but the internal model should not inherit their limitations.

## Suggested next milestones

### 1. Make the object graph real

- Stable object IDs and references
- Derived/computed metrics
- Dependency graph and downstream impact detection
- Change events and semantic history
- Source/provenance records

### 2. Strengthen Docs

- Rich-text editor with semantic blocks
- Claims and citations
- Slash/command insertion
- Inline object embeds
- Comments, decisions, owners, approvals

### 3. Strengthen Data

- Typed schema editor
- Formula engine using semantic references
- Multiple tables and relations
- Model view
- Chart definitions as reusable objects

### 4. Strengthen Present

- Scene selection and editing
- Semantic slide components
- Constraint-based layout engine
- Themes/design tokens
- Speaker notes and presentation mode

### 5. Collaboration and storage

- Server-backed workspace persistence
- Authentication and permissions
- Realtime multiplayer/CRDT layer
- Semantic version history
- Export/import adapters

## Status

This is an intentionally narrow vertical slice, not a production office suite. Its job is to validate the foundational thesis: **a document, spreadsheet, and presentation can remain distinct tools while operating on the same connected model of work.**
