# Test inventory

Current source inventory after the semantic Docs/Data/Present, diagnostics, and compatibility-export pass: **115 test cases**.

The count is based on the committed `node:test` cases in `tests/*.test.mjs`.

Recent coverage added beyond the earlier 75-test baseline includes:

- semantic document blocks, claims, citations, review annotations, predicate lineage, migration, preview, cleanup, and revert
- versioned shared chart authoring and chart revert conflicts
- authored presentation order, visibility, speaker notes, migration, live-data behavior, preview, and revert
- multiplicative semantic expressions, precedence, ratios, final semantic dimensions, invalid unit arithmetic, and division by zero
- semantic formula field/relationship catalog and format-aware suggestions
- workspace readiness diagnostics for stale/contradicted evidence, review gates, graph errors, chart/formula health, and story visibility
- semantic Markdown exports for strategy/presentation and escaped CSV exports for Actual/Plan

Because the implementation container cannot clone the complete current GitHub tree, this file records **source inventory**, not a claim that all 115 cases were executed in this environment. The authoritative full-checkout command remains:

```bash
npm run verify
```

Focused current-shape TypeScript/runtime harnesses and separate React contract checks were used for the newly changed engine/UI paths during this pass.
