# Current Frame implementation status

This document is the latest implementation snapshot for the semantic workspace prototype.

## Product surfaces

### Docs

- Ordered semantic paragraph / evidence-claim / metric-embed / decision-embed blocks.
- Explicit claims, citations, confidence, source/evidence identity, and supported/stale/contradicted evaluation.
- Growth-leader claim predicates track all regional growth rows as semantic dependencies, not only the cited row.
- Block comments, tasks, approvals, owners, and review status.
- Semantic block/review changes participate in preview, history, compare, undo/redo, backup/import, and conflict-aware revert.
- Slash-style insertion: `/paragraph`, `/claim`, `/metrics`, `/decision`.
- Review inbox/query model and document review gate distinguish approval/evidence blockers from task/comment warnings.

### Data

- Typed Actual (`Regions`) and `Plan` tables with explicit `Regions.Region ↔ Plan.Region` relationship.
- Aggregate formulas with typed `WHERE` predicates.
- Composable arithmetic with grouping, unary signs, `+`, `-`, `*`, `/`, operator precedence, divide-by-zero checks, and semantic dimensions.
- Final expression dimensions are validated against metric format.
- Formula metrics recompute after any relevant row edit, including filter-only dependency changes.
- Dynamic computed-metric registry, semantic field/relationship reference catalog, and format-aware formula suggestions.
- Relationship integrity diagnostics for duplicate/unmatched keys and one-to-one/many-to-one cardinality rules.
- One relationship-backed Actual-vs-Plan chart definition shared by Analyse and Present.
- Versioned chart representation authoring (`grouped-bar` / `line`).

### Present

- Live thesis, performance, signal, and decision content derived from workspace objects.
- Persisted semantic story order, scene visibility, and speaker-note overrides.
- Reorder/hide/show/note edits participate in semantic compare/history/revert.
- Hidden scenes remain recoverable and at least one scene must stay visible.
- Full-screen player consumes the authored visible sequence.
- Performance scene consumes the same shared chart object as Data Analyse.

## Workspace intelligence

- Workspace diagnostics cover stale/contradicted evidence, review gates, formula/chart failures, dangling graph edges, and story visibility.
- Semantic search indexes documents, blocks, claims, citations, reviews, metrics/formulas, Actual/Plan rows, decisions, charts, sources, and authored scenes.
- Universal query resolution prefers executable `Cmd/Ctrl + K` intents and otherwise returns ranked semantic search results.
- Semantic object locations map search/history results to Docs/Data/Present and support stable `frame://workspace/...` deep links.

## Portability

- Existing full JSON workspace/session backup/import remains the native lossless format.
- Strategy Markdown export preserves semantic claims/citations/reviews/live metric definitions/decisions.
- Board-narrative Markdown respects authored order, visibility, sources, and speaker notes.
- Actual and Plan export as escaped CSV.
- CSV import planning validates headers, quoting, duplicates, region identity, and numeric types, then emits ordinary semantic row-update commands instead of overwriting tables directly.

## Versioning and collaboration foundation

- UUID-backed semantic transactions plus human revisions.
- Durable undo/redo and append-only ledger retaining abandoned branches.
- Arbitrary semantic version compare and conflict-aware revert-as-new-revision.
- Session integrity auditing detects duplicate IDs/revisions, stale counters, missing ledger entries, broken applied/redo chains, detached present state, and event identity drift.
- Three-way semantic merge planning distinguishes independent changes, identical changes, and same-field divergent conflicts.
- Role/capability policy for owner/editor/reviewer/viewer across data/content/review/decision/presentation/provenance commands.
- Authorized preview/execution entry points.
- Optimistic workspace repository contract plus in-memory implementation and integrity-checking repository decorator.
- Workspace service composes authorization, preview, versioning, and compare-and-swap persistence.
- Sync envelopes separate repository version from semantic revision, returning ledger deltas or a full snapshot when history is incomplete.
- Actor-aware audit log records human/automation source, role, repository version, semantic revision, command type, diff count, and downstream impacts.
- Runtime JSON command codec validates all supported semantic command payloads before execution.

## Inspectable automation

- Multi-step automation plans simulate without mutating the supplied session.
- Plans expose per-step previews, cumulative semantic diffs, deduplicated impacts, and readiness before/after.
- Automation governance classifies low/medium/high risk and requires approval for risky provenance/formula/destructive/decision/chart/visibility changes or plans that worsen readiness.
- Semantic workspace fingerprints detect stale automation plans.
- Approval tokens are bound to one plan and approved plans refuse execution after meaningful workspace changes.

## Verification inventory

Current source inventory: **215 `node:test` cases**.

This is a source-count statement, not a claim that all 215 were executed in the implementation container. The container cannot clone/fetch the complete current GitHub tree into one dependency-backed checkout. Focused current-shape TypeScript/runtime harnesses and separate React contract checks have been used for the changed product paths. The authoritative developer-checkout command remains:

```bash
npm run verify
```

The latest focused harnesses cover the semantic document/chart/version/revert paths, presentation-state/model paths, and multiplicative/dimensional expression behavior. The repository test sources additionally cover the collaboration, storage, governance, diagnostics, search/navigation, and compatibility modules listed above.
