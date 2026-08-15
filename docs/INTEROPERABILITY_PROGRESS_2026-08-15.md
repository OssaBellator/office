# Interoperability progress — 2026-08-15

This checkpoint records the latest additive interoperability work while the implementation-status documents are being refreshed.

## Excel / Google Sheets fidelity added

Frame now preserves and models more than raw spreadsheet values:

- boolean cells as real booleans;
- source worksheet visibility (`visible`, `hidden`, `veryHidden`);
- original formula text beside cached values, including expanded shared-formula dependents;
- per-cell Excel number-format provenance plus source workbook 1900/1904 date system;
- external/internal hyperlink provenance, with only HTTP/HTTPS/mailto and internal workbook locations considered live/exportable;
- classic Excel cell notes as review provenance with author + text.

The Data surface exposes separate formula, number-format, hyperlink and note badges. Unsafe file/custom hyperlink targets remain inert but inspectable.

## Safe XLSX projection

The XLSX compatibility writer now projects:

- booleans as boolean cells;
- hidden/very-hidden source sheet state;
- safe number formats via `styles.xml`;
- a consistent 1900/1904 workbook date system when possible;
- safe web/mail hyperlinks as external relationships;
- internal workbook hyperlinks as locations.

Frame intentionally suppresses:

- foreign formulas as executable formulas — cached values are exported instead;
- unsafe file/custom hyperlink relationships;
- date-like formats whose source 1900/1904 system conflicts with the combined output workbook;
- classic Excel notes for now, until a comments + VML writer is validated in current Excel clients.

## Review provenance

`importedDataReview.ts` exposes imported cell notes as review items with source/table/row/column/value/author/text context. `officeReviewAssessment.ts` adds those notes to a pre-export review assessment and explicitly reports that they remain Frame-only in normal XLSX export.

## Regression coverage added

Focused tests now include:

- boolean + hidden-sheet fidelity;
- number-format + date-system fidelity;
- hyperlink import/export trust boundary;
- classic Excel cell-note import/search/persistence/export-boundary behavior;
- a composite workbook containing very-hidden state, booleans, shared formulas, custom date format, safe/unsafe hyperlinks and a classic note through secure import → semantic application → XLSX export.

The repository still requires local execution of `npm run test:interop` / `npm run verify` to establish a passing result; this environment cannot run the full installed Vite toolchain.

## Current deliberate limitations

- modern threaded Excel comments are warning-only;
- classic notes are imported but not yet emitted into normal XLSX packages;
- foreign formulas are preserved but not executed/reactivated;
- fonts/fills/borders/alignment/conditional formatting remain outside the semantic import contract;
- merged-cell geometry is still flattened;
- external data connections are not refreshed/imported as live connections;
- real installed Microsoft 365 / Google Workspace smoke validation is still required for repair-free compatibility claims.
