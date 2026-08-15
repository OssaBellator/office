# Foreign spreadsheet formula translation

Frame preserves imported Excel/Google Sheets formula text and cached values, but it does not execute foreign formulas implicitly.

The translation layer exists to move a **proven, reviewable subset** into Frame's semantic formula graph without turning a workbook import into arbitrary code execution or guesswork.

## Current safe subset

`src/foreignFormulaTranslation.ts` currently recognizes exactly one aggregate over one Excel structured table column:

- `SUM(Table[Field])`
- `AVERAGE(Table[Field])`
- `MIN(Table[Field])`
- `MAX(Table[Field])`
- `COUNT(Table[Field])`

For example:

```text
=SUM(Regions[Revenue])
```

can become the Frame semantic formula:

```text
SUM(Regions.Revenue)
```

The translator does not execute either expression. It only creates a candidate representation.

## Deliberately unsupported

Frame does not automatically translate:

- A1/R1C1 cell references;
- sheet ranges;
- arithmetic around aggregate calls;
- nested formulas;
- lookups;
- external workbook references;
- web/file references;
- volatile functions such as `NOW`, `TODAY`, `RAND`, `OFFSET`, `INDIRECT`, `CELL`, or `INFO`;
- formulas whose table/field context cannot be proven.

Those formulas remain preserved as inert provenance beside their cached values.

## Semantic context review

`src/foreignFormulaReview.ts` classifies each candidate as:

- `ready` — resolves to a supported existing Frame semantic table/field;
- `requires-model-promotion` — resolves to retained imported Data that is not yet in the executable Frame model graph;
- `missing-table`;
- `missing-field`; or
- `unsupported`.

A structured reference to `Regions[Revenue]` can currently be ready. A reference to a retained foreign table such as `Pipeline[ARR]` is not automatically executable; the table first needs explicit model promotion.

## Explicit metric creation

`src/foreignFormulaMetricDraft.ts` can build a normal `metric.create` command **only** for a candidate already reviewed as `ready`.

The command:

- uses the translated Frame formula;
- carries the imported cached numeric cell value as fallback/provenance;
- records the source workbook/table/column;
- refuses metric-id collisions; and
- remains subject to normal Frame command preview, permissions, governance, history and undo/revert once mounted in product UI.

This is intentionally not an automatic import step.

## Readiness reporting

`src/foreignFormulaTranslationReport.ts` summarizes formula migration debt across a workspace:

- total preserved formulas;
- ready translations;
- model-promotion requirements;
- unsupported formulas;
- missing tables/fields;
- source workbooks; and
- blocker details.

The intended migration workflow is:

1. import spreadsheet safely;
2. preserve every formula + cached value;
3. inspect translation report;
4. model/promote foreign tables where appropriate;
5. review ready formula candidates;
6. create Frame semantic metrics explicitly; and
7. keep unsupported formulas inert until a future translator can prove their semantics.

## Product rule

Formula compatibility must be **proof-oriented, not optimistic**. Frame should preserve more than it executes, and only convert a foreign formula when the user can inspect the exact semantic expression that will replace it.
