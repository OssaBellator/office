# Interoperability implementation status

This file distinguishes **implemented engine capability**, **currently reachable product UI**, and **external validation still required**. Keep it conservative: Frame must not claim pixel-perfect Office fidelity where the semantic model deliberately normalizes source formatting.

## Implemented and user-facing now

### Secure local Office import

The main Import dialog routes Word/PowerPoint/Excel to `office-import.html`, a dedicated secure import surface. It accepts macro-free OOXML:

- `.docx`
- `.pptx`
- `.xlsx`

The page calls the canonical `planSecureOfficeImport()` pipeline before governance/preview:

1. bounded ZIP/package inspection;
2. VBA/ActiveX rejection and security notices;
3. OOXML kind detection by package contents rather than filename alone;
4. DOCX/PPTX/XLSX semantic planning;
5. XLSX sheet-visibility enrichment;
6. XLSX number-format/date-system enrichment;
7. XLSX hyperlink trust/provenance enrichment;
8. XLSX classic cell-note/review enrichment;
9. XLSX shared-formula expansion;
10. source-aware re-import synchronization; and
11. governed semantic preview and Apply.

Applied imports persist into the same versioned semantic session as the main workspace.

Current local-file import preserves:

- Word paragraphs/headings/lists, document tables and document-block source provenance;
- PowerPoint relationship slide order, slide text, speaker notes, source provenance and flattened table rows;
- Excel cached values, recognized finance mappings, arbitrary schemas, extra columns, booleans, hidden/very-hidden source-sheet state, formula text, number formats/date systems, worksheet hyperlinks and classic cell-note provenance;
- imported Data tables as editable/versioned/searchable/revertible Frame objects.

### Direct Google Drive import

The main Import dialog routes Google Drive to `google-drive.html`.

Implemented and reachable:

- `googleIdentity.ts` — Google Identity Services token boundary;
- `googleDriveProvider.ts` — native Docs/Sheets/Slides listing/search/pagination/export;
- `GoogleDriveImportDialog.tsx` — read-only connect/search/select UI;
- `googleWorkspaceInteropImport.ts` — Google export bytes through the same secure Office pipeline;
- `google-env.d.ts` — typed `VITE_GOOGLE_CLIENT_ID`;
- `docs/GOOGLE_DRIVE_SETUP.md`.

Security model:

- public OAuth web client ID only;
- no client secret in the browser;
- `drive.readonly` scope;
- token held ephemerally in component memory;
- Google file bytes pass through the same macro/control gate and bounded Office parser as local files;
- no semantic mutation before governed preview/approval.

If `VITE_GOOGLE_CLIENT_ID` is not configured, the page clearly reports that direct Google import is unavailable and users can still use DOCX/PPTX/XLSX downloads.

### Office compatibility export with preflight assessment

The main Export dialog routes Office compatibility export to `office-export.html` instead of starting three downloads immediately.

The page runs `assessOfficeExport()` first and shows:

- DOCX semantic block/claim/review counts;
- PPTX visible-scene/speaker-note counts;
- XLSX table, cached foreign-formula, boolean, number-format, hyperlink and hidden-sheet counts;
- imported Excel review-note count;
- source date-system mix;
- date-like styles intentionally suppressed when mixed 1900/1904 workbooks would otherwise risk shifted serial dates;
- unsafe hyperlink targets intentionally suppressed; and
- classic Excel notes intentionally retained in Frame but omitted from the default XLSX projection.

Users can then download DOCX, PPTX and XLSX individually or as a set.

The stable `officeExport.ts` facade routes to:

- `officeDocxExport.ts` for native Word list numbering + readable review/provenance export;
- `officePptxExport.ts` for true PowerPoint speaker-notes parts; and
- `officeXlsxExport.ts` for safe sheet names, booleans, hidden/very-hidden sheet state, number formats and trusted hyperlink projection.

Normal Office exports deliberately do **not** embed hidden Frame manifest metadata. Frame JSON remains the lossless semantic backup.

## Excel / Google Sheets fidelity currently implemented

### Typed values and source structure

Imported Data supports text, finite numbers, booleans and null/blank values. Workbook worksheet state is retained as `visible`, `hidden` or `veryHidden` provenance. Hidden recognized finance worksheets are retained as generic imported Data in addition to any live-model update when needed so source provenance is not erased by semanticization.

### Formula provenance

Frame preserves cached formula values and original formula text per imported cell. Compact Excel shared-formula dependents are expanded with A1-relative translation. Formula cells show a `ƒ` marker in Data, participate in search/history, and lose the imported formula only when the user explicitly edits that cached value.

Frame does **not** execute arbitrary foreign formulas and does not automatically re-emit them as live XLSX formulas. Office export writes cached values only until an explicit formula translation/trust policy exists.

### Number-format and date-system provenance

Frame preserves each styled imported cell's `numFmtId`, custom number-format code where present, and source workbook date system (`1900` or `1904`). Data shows a `#` provenance badge. Search, semantic history and interoperability reports can inspect the metadata.

XLSX export re-emits safe number formats in `xl/styles.xml`. If source date systems conflict, the output uses 1900 and suppresses date-like styles from 1904-source cells instead of shifting raw serial values.

### Hyperlink provenance and trust

Frame preserves worksheet hyperlinks independently from displayed cell values.

- safe `http`, `https` and `mailto` targets can be opened and re-exported;
- internal workbook locations are retained and can be re-exported;
- file/custom/unsupported external schemes remain inert source provenance and are not reactivated in normal XLSX export.

Hyperlinks participate in Data badges/tooltips, search, semantic history, reporting and export preflight.

### Classic Excel cell-note provenance

Classic Excel worksheet notes/comments are preserved as per-cell review provenance with note text and author when present.

They:

- show a note badge in imported Data;
- survive semantic command serialization/deserialization;
- participate in semantic search;
- participate in review-aware semantic history separately from cell values;
- affect workspace semantic fingerprints; and
- remain attached when the cached value is edited.

The **default XLSX export omits classic notes** and tells the user how many will remain in Frame. An opt-in experimental classic-note XLSX writer, package validator and manual smoke-test path exist, but they are not the normal product export until validated in current Excel clients without repair prompts.

Modern **threaded Excel comments** remain warning-only. Frame intentionally does not flatten replies/participants into a fake legacy note.

### Still not translated

- fonts, fills, borders and alignment;
- conditional formatting;
- merged-cell geometry;
- threaded Excel comment/reply structure;
- external workbook/data connections.

## Word / Google Docs fidelity currently implemented

Preserved:

- paragraphs;
- title/subtitle and heading hierarchy (normalized to Frame heading 1–3);
- bullets and numbered lists;
- document tables into Frame Data;
- source filename provenance on imported paragraphs.

Still warning-only / flattened:

- images/media;
- embedded charts/objects;
- footnotes/endnotes;
- native Word comments/comment threads;
- tracked revision markup;
- headers/footers;
- exact document layout.

## PowerPoint / Google Slides fidelity currently implemented

Preserved:

- relationship-defined slide order;
- titles and body text;
- speaker notes through notes-slide relationships;
- imported scene source attribution;
- table rows flattened into editable semantic scene text.

Export creates real slide/notes parts, slide master/layout and theme package parts.

Still warning-only / semanticized:

- source theme/master geometry;
- exact text positioning/fonts;
- images/media;
- charts/SmartArt;
- native table geometry;
- transitions/animations.

## Package safety and validation

DOCX/PPTX/XLSX are untrusted ZIP packages. The browser-side reader currently:

- rejects packages larger than 128 MiB;
- rejects more than 20,000 ZIP entries;
- rejects individual XML parts larger than 32 MiB;
- caps total materialized XML at 96 MiB;
- rejects encrypted/password-protected packages;
- rejects ZIP64/multi-disk packages for now;
- validates central/local-header and payload bounds; and
- skips inflating unused binary media.

The secure import boundary also rejects VBA and ActiveX package parts.

Generated Office exports are covered by the Frame OPC validator, which checks relationship target existence, duplicate relationship IDs and `[Content_Types].xml` coverage. Styled/hyperlinked XLSX and the experimental classic-note package path have dedicated regression coverage.

## Local QA tools

Implemented:

- `npm run test:interop` — focused Office/Google/XLSX/imported-review interoperability suite;
- `scripts/generate-office-fixtures.mjs` — writes real Frame DOCX/PPTX/XLSX fixtures;
- `scripts/inspect-office-import.mjs` — prints planned semantic import/warnings for a real Office file;
- classic-note package validation/manual fixture tooling;
- package validation CLI/tooling;
- `docs/INTEROPERABILITY_TESTING.md`.

## Implemented but awaiting external application validation

Generated DOCX/PPTX/XLSX packages round-trip through Frame's bounded ZIP reader/parsers and OPC validator.

The experimental classic-note XLSX writer additionally round-trips through Frame's note parser/validator, but it has **not** been promoted to normal export because it has not yet been opened by this assistant in current installed Excel clients.

More generally, generated Office files have not been opened by this assistant in a real installed Microsoft Word, PowerPoint or Excel instance in this environment. Do not claim pixel-perfect or repair-free Office validation until generated fixtures are manually opened in current Microsoft 365 / Google Workspace / LibreOffice clients.

## Next interoperability priorities

1. Model modern threaded Excel comments and replies as real Frame review threads.
2. Preserve selected cell presentation metadata (alignment/emphasis) only where it adds semantic meaning; do not recreate a formatting-first spreadsheet model.
3. Represent Word comments/revisions as Frame review annotations/version events.
4. Import embedded DOCX/PPTX media into reusable Frame media objects.
5. Convert PowerPoint charts/tables into linked semantic chart/table objects.
6. Expand the explicit reviewable translation layer for supported foreign Excel formulas into Frame formulas.
7. Expand the real-world fixture corpus from current Microsoft 365 and Google Workspace exports and run it through `test:interop` plus manual application smoke tests.
