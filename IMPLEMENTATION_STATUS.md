# Frame implementation status

Current implementation state after the semantic Docs/Data/Present expansion.

## Semantic Docs

- Ordered semantic blocks: paragraph, evidence claim, live metric embed, shared decision embed.
- Explicit claims, citations, source/evidence identity, confidence, and live supported/stale/contradicted evaluation.
- Growth-leader predicates depend on all regional growth rows in the semantic graph, so a competing region can invalidate a claim through normal downstream impact.
- Block-level comments, tasks, approvals, owners, and review status.
- Block insertion, editing, reorder, removal, cleanup, preview, semantic history, undo/redo, compare, backup/import, and conflict-aware revert.
- Slash/command insertion: `/paragraph`, `/claim`, `/metrics`, `/decision`.
- Legacy body edits remain mirrored into the first semantic paragraph.

## Semantic Data

- Separate typed `Regions` actuals and `Plan` tables.
- Explicit `Regions.Region ↔ Plan.Region` relationship.
- Meaning-based aggregate formulas with typed `WHERE` predicates.
- Composable expressions with grouping, unary signs, `+`, `-`, `*`, `/`, operator precedence, divide-by-zero checks, and semantic dimensions (`currency`, `percent`, `number`).
- Final formula dimension is validated against the metric format.
- Generic formula recalculation after row edits, including filter-only dependencies.
- Dynamic computed-metric registry in Model view.
- Semantic formula reference browser and format-aware formula suggestions/autocomplete.
- Shared Actual-vs-Plan relationship-backed chart definition.
- Shared chart representation can be authored as grouped bars or line; the change is versioned, previewable, revertible, and propagates to both Data and Present.

## Semantic Present

- Live thesis, performance, signal, and decision scene content derived from shared workspace objects.
- Authored presentation state for scene order, visibility, and speaker-note overrides.
- Reorder/hide/show/note edits are semantic revisions with compare/history/revert.
- Hidden scenes remain recoverable; at least one scene must remain visible.
- Full-screen player consumes the authored visible sequence.
- Performance scene renders the same shared Actual-vs-Plan chart object used by Data Analyse.
- Typed commands include `hide signal scene`, `move decision scene first`, and speaker-note edits.

## Shared versioning and provenance

- UUID-backed semantic transactions with human revision numbers.
- Durable undo/redo plus append-only ledger retaining abandoned branches.
- Arbitrary semantic version comparison.
- Conflict-aware revert-as-new-revision.
- Semantic document, presentation, chart, source freshness, metric formula, actual, plan, and decision changes all participate in the same history model.
- Older workspace/session snapshots materialize new semantic document and presentation state during hydration.
- Portable JSON backup/import preserves semantic state and revision history.

## Verification status

The repository defines **104 test cases by source inventory** after this pass, including new semantic-document, chart-authoring, presentation-authoring, formula-catalog, multiplicative-expression, and final-metric-dimension coverage.

The implementation environment used for this pass cannot clone/fetch the complete current GitHub tree into the container, so the full historical dependency-backed suite was not honestly executable here as one checkout. Focused current-shape TypeScript/runtime harnesses were used for the newly changed semantic engine paths, and React component contracts were checked separately with lightweight React/lucide stubs. `npm run verify` on a normal developer checkout remains the authoritative full-suite + typecheck + production-build command.
