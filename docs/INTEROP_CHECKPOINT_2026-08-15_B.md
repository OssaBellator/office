# Interoperability checkpoint B — 2026-08-15

This checkpoint records the implementation added after the first 2026-08-15 interoperability progress note.

## Spreadsheet fidelity added

### Hyperlinks

Imported Data now preserves per-cell spreadsheet hyperlink provenance:

- external target;
- internal workbook location;
- optional display text;
- optional tooltip.

Trust boundary:

- `https`, `http`, and `mailto` external targets may be live/re-exported;
- internal workbook locations may be re-exported as internal hyperlinks;
- file/UNC/custom/unsupported external schemes remain inert provenance in Frame and are suppressed from normal XLSX export.

Data shows separate live/inert hyperlink badges. Link metadata participates in codec validation, search, semantic comparison, interoperability reporting and export preflight.

### Classic Excel cell notes

Classic `commentsN.xml` cell notes are preserved as review provenance with:

- cell anchor;
- author where available; and
- flattened plain review text.

Data shows a review-note badge and retains the note when the cached cell value is edited.

`importedDataReview.ts`, `workspaceReviewCompare.ts` and `reviewHistory.ts` provide Office-agnostic review APIs.

Modern threaded comments remain warning-only rather than being flattened incorrectly.

### Experimental note-preserving XLSX

Normal Frame XLSX export still keeps imported notes Frame-only.

An opt-in `officeXlsxNotesExport.ts` writer can emit classic comments + VML note parts for external validation. It has:

- generic OPC validation;
- note-specific relationship/shape validation; and
- Frame secure re-import round-trip tests.

Use `scripts/export-xlsx-with-notes.mjs` to generate a file for current Microsoft Excel smoke testing. Do not promote this writer into normal export until repair-free rendering is confirmed in current Excel.

## Source identity and revision architecture

Office imports can now be fingerprinted independently from filenames.

`officeImportReceipt.ts` creates SHA-256 source receipts containing:

- filename;
- OOXML kind;
- byte length;
- content SHA-256;
- stable source identity (`kind:sha256`);
- imported item count;
- warning count;
- semantic command type counts; and
- timestamp.

`sourceRevisionLedger.ts` classifies payloads as:

- `duplicate-content`;
- `filename-revision`; or
- `new-source`.

`sourceRevisionStore.ts` provides defensive localStorage-compatible persistence.

`officeImportPreparation.ts` bundles secure planning with revision classification.

`sourceRevisionDiff.ts` compares receipt-level changes such as bytes/imported items/warnings/command-shape deltas.

`sourceRevisionEnvelope.ts` provides a validated server/interchange envelope.

Product-ready components exist for source revision preview and ledger inspection.

## Migration rehearsal

`officeMigrationSimulation.ts` simulates sequential Office imports against a cloned semantic session and never mutates the user's current workspace.

It reports:

- applied vs duplicate-skipped vs failed files;
- simulated semantic transactions;
- revision ledger;
- foreign formula translation readiness;
- imported Data review notes; and
- eventual Office export fidelity.

Browser page:

```text
/office-migration.html
```

CLI:

```bash
node --experimental-strip-types scripts/simulate-office-migration.mjs <directory>
```

`officeMigrationBatch.ts` additionally creates an immutable batch plan with:

- base workspace SHA-256;
- projected workspace SHA-256;
- sequential semantic commands;
- per-file command ranges;
- source receipt identities; and
- stale-state matching before future governed execution.

## Formula translation proof layer

Preserved foreign formulas remain inert by default.

Implemented translation subset:

- `SUM(Table[Field])`
- `AVERAGE(Table[Field])`
- `MIN(Table[Field])`
- `MAX(Table[Field])`
- `COUNT(Table[Field])`

The candidate syntax becomes Frame semantic aggregate syntax, e.g.:

```text
SUM(Regions[Revenue]) -> SUM(Regions.Revenue)
```

`foreignFormulaReview.ts` verifies whether the referenced semantic table/field exists.

Statuses:

- ready;
- requires model promotion;
- missing table;
- missing field;
- unsupported.

`foreignFormulaMetricDraft.ts` can build a normal `metric.create` command only from a candidate reviewed as ready. It still requires normal Frame preview/governance when mounted into product UI.

`foreignFormulaTranslationReport.ts` summarizes formula migration debt.

## External compatibility evidence

Frame now has a machine-readable path from generated artifact to release evidence.

### Export receipts

`officeExportReceipt.ts` fingerprints exact DOCX/PPTX/XLSX bytes and snapshots export fidelity.

`officeExportReceiptVerification.ts` recomputes SHA-256 to prove a receipt still matches an artifact.

`officeExportReceiptCodec.ts` provides defensive runtime decoding for bundle receipts.

### Smoke validation records

`officeSmokeValidation.ts` records:

- exact artifact filename/hash/kind;
- target application;
- app version/platform;
- tester/time;
- outcome;
- repair-prompt flag;
- observations; and
- explicit boolean checks.

A release-gate pass requires:

- pass or pass-with-differences;
- no repair prompt;
- at least one explicit check; and
- every check passing.

`officeSmokeLedger.ts` stores validated evidence defensively.

`officeCompatibilityEvidence.ts` matches smoke results to exact export hashes and required applications.

CLI:

```bash
node --experimental-strip-types scripts/check-office-compatibility-evidence.mjs <bundle-receipt.json> <validation.json> [...]
```

Validation bundle generator:

```bash
node --experimental-strip-types scripts/generate-office-validation-bundle.mjs [frame-backup.json] [output-directory]
```

This produces exact Office files, SHA receipts and a manual checklist.

## Corpus diagnostics

Two non-mutating corpus tools now exist:

```bash
node --experimental-strip-types scripts/diagnose-office-directory.mjs <directory>
node --experimental-strip-types scripts/simulate-office-migration.mjs <directory>
```

The first reports per-file secure planning/fidelity/security. The second also sequentially simulates semantic changes in memory.

## Important validation caveat

The new modules and regressions are committed but have **not** been executed in this assistant environment after the latest additions. The full installed Vite toolchain is unavailable here.

Generated Office packages still require real current Microsoft 365 / Google Workspace smoke validation before Frame claims repair-free external compatibility. The evidence/receipt workflow now makes that validation exact and auditable rather than informal.
