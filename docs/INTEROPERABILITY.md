# Frame interoperability contract

Frame's native format is the semantic workspace, not a collection of Office files. Interoperability is implemented as **semantic import** and **compatibility export**: familiar files enter Frame as editable, versioned objects; Frame projects those objects back into common formats when another tool needs a file.

The lossless representation remains the Frame workspace/session JSON because it contains semantic history, relationships, review state, provenance and other concepts that DOCX/PPTX/XLSX cannot completely represent.

## Current support matrix

| Source / target | Import into Frame | Export from Frame | Current behavior |
| --- | --- | --- | --- |
| Microsoft Word `.docx` | Yes | Yes | Paragraphs/headings/lists become semantic document blocks; tables become Frame Data. Source provenance is retained. |
| Microsoft PowerPoint `.pptx` | Yes | Yes | Relationship slide order, slide text and speaker notes become semantic scenes. Export uses real PowerPoint notes parts. |
| Microsoft Excel `.xlsx` | Yes | Yes | Compatible finance sheets update live models; arbitrary/foreign sheets remain Data. Booleans, formulas, hidden-sheet state, number formats/date systems, hyperlinks, classic notes and modern threaded review provenance are preserved. |
| Google Docs | Yes, direct Drive or DOCX download | DOCX projection | Direct Drive export goes through the same secure Office pipeline as local files. |
| Google Slides | Yes, direct Drive or PPTX download | PPTX projection | Native Google Slides are exported in memory to PPTX then semanticized. |
| Google Sheets | Yes, direct Drive or XLSX download | XLSX projection | Native Sheets are exported in memory to XLSX; spreadsheet provenance uses the same Excel path. |
| CSV | Yes | Yes | Regions/Plan CSV uses schema-aware semantic import; CSV remains a simple compatibility projection. |
| Frame JSON | Yes | Yes | Lossless workspace/session backup including semantic history. |
| Legacy Office `.doc/.ppt/.xls` | No | No | Convert to DOCX/PPTX/XLSX first. |
| Macro-enabled `.docm/.pptm/.xlsm` | Rejected by secure import | No | Frame does not import VBA/ActiveX packages. Convert to macro-free OOXML first. |
| Google pointer `.gdoc/.gslides/.gsheet` | No pointer-file parsing | N/A | Pointer files contain no document body; use direct Drive or export/download. |

## Product import/export entrypoints

The main workspace does not make raw Office parsing an incidental file-picker side effect.

- **Office import** routes to `office-import.html`, which runs the secure package gate, content detection, semantic planning, fidelity enrichment, source synchronization and governed preview before Apply.
- **Google Drive import** routes to `google-drive.html`, which obtains read-only Google authorization on demand and sends exported Office bytes through the same secure pipeline.
- **Office export** routes to `office-export.html`, which shows a fidelity assessment before generating DOCX/PPTX/XLSX.

This keeps interoperability policy explicit and avoids creating separate conversion engines for local files and cloud files.

## Word / Google Docs fidelity

### Preserved as editable Frame objects

- paragraph text;
- title/subtitle styles;
- heading hierarchy, normalized to Frame heading levels 1–3 where required;
- bullet/numbered list semantics;
- document tables imported into Data;
- source filename on imported paragraph blocks.

The source is visible in Docs, searchable, version-diffed, serialized, and included in Markdown/DOCX compatibility projections.

### Warned before Apply

- embedded images/media;
- embedded charts/objects;
- footnotes/endnotes;
- Word comments/comment threads;
- headers/footers;
- tracked revision markup;
- exact source layout.

These features are not yet native Frame objects.

## PowerPoint / Google Slides fidelity

### Preserved as editable Frame objects

- presentation relationship order rather than filename order;
- slide titles and text bodies;
- speaker notes through notes-slide relationships;
- imported slide source attribution;
- slide tables as editable text rows when native semantic table geometry is unavailable;
- imported scenes participate in Frame reorder/hide/show/notes/presentation/search/history/revert behavior.

### Export behavior

Frame's PPTX projection creates a normal OOXML presentation package with:

- presentation part;
- slide master and blank layout;
- Frame theme;
- one slide per visible semantic scene;
- notes master;
- real notes-slide parts; and
- slide/notes relationships.

Speaker cues therefore remain speaker notes rather than visible `Speaker note:` slide text.

### Warned before Apply

- source theme/master geometry;
- exact source text positioning/fonts;
- images/media;
- charts/SmartArt;
- native table geometry;
- transitions/animations.

## Excel / Google Sheets fidelity

### Recognized semantic models

A compatible Region/Revenue/Growth/Margin worksheet can update Frame's live regional model. Compatible Plan/Budget/Forecast sheets can update the live plan model. These changes still go through semantic preview, permissions, history, undo/redo and revert.

### Foreign and preserved source sheets

A worksheet that does not map cleanly to the live finance model remains an **Imported Data table**. Recognized sheets are also retained when doing so is necessary to avoid losing extra columns or source provenance.

Imported Data tables currently preserve:

- source filename and sheet label;
- source worksheet state: `visible`, `hidden`, `veryHidden`;
- source workbook date system: `1900` or `1904`;
- typed text, number and boolean cells;
- foreign columns/schemas;
- formula text beside cached formula values;
- per-cell number-format ID and custom format code where present;
- per-cell hyperlinks as source provenance;
- classic Excel cell notes with author and plain text; and
- modern threaded review conversations with identities, replies, timestamps, resolution state and mentions.

They remain editable, codec/runtime validated, searchable, version-diffed, fingerprinted, revertible, and included in XLSX compatibility projection where safe.

### Formula preservation policy

For an imported formula cell Frame preserves:

1. the workbook's cached value, which is shown and may feed compatible live-model updates; and
2. the original formula text as per-cell provenance.

Compact Excel shared-formula dependents are expanded with relative A1 reference translation before storage. Formula-backed cells display a `ƒ` marker in Data. Editing the value deliberately removes the preserved foreign formula from that cell because the user has replaced the imported formula result.

Frame **does not execute arbitrary foreign spreadsheet formulas**. Formula translation into Frame's semantic formula engine must be explicit and reviewable.

Frame's normal XLSX exporter writes cached values rather than silently reactivating preserved foreign formulas.

### Boolean values

Excel `t="b"` cells are imported as true booleans rather than strings/numbers. Boolean columns are inferred when all present values are boolean, can be edited as TRUE/FALSE, participate in semantic diffs/search, and re-export as XLSX boolean cells.

### Hidden and very-hidden worksheets

Workbook sheet visibility is source provenance, not UI trivia. Frame retains hidden/very-hidden state on imported Data tables, including recognized finance worksheets when needed to avoid losing that source property. XLSX export re-emits the source sheet state.

### Number-format and date-system provenance

Frame preserves per-cell Excel `numFmtId`, custom `formatCode` when present, and whether the source workbook uses the 1900 or 1904 date system. It deliberately leaves stored numeric values unchanged during import rather than guessing semantic dates.

Number-format provenance is shown with a `#` marker in Data and participates in search, semantic history and interoperability reporting.

### Safe number-format re-export

The XLSX projection can re-emit safe imported number formats through `xl/styles.xml`.

- If formatted imported tables consistently use 1904 dates, Frame exports `date1904="1"`.
- If all formatted tables use 1900, Frame uses the normal 1900 system.
- If formatted source tables mix 1900 and 1904 date systems, the combined Frame workbook uses 1900. Date-like styles from 1904-source cells are intentionally suppressed so raw serials are not rendered as silently shifted dates. Non-date-like formats can still be projected safely.

The Office export assessment reports this suppression before download.

### Hyperlink trust boundary

Frame preserves worksheet hyperlinks separately from the cell value.

- `https:`, `http:` and `mailto:` external targets are treated as navigable/exportable.
- internal workbook locations are retained and can be projected back into XLSX.
- file, UNC, custom or otherwise unsupported external schemes remain visible provenance but are inert in Frame and omitted from normal XLSX export.

The Data surface distinguishes safe live links from inert link provenance. Search, semantic history, interoperability reports and export preflight all include link metadata.

### Classic Excel cell notes as review provenance

Classic worksheet notes/comments are imported as per-cell review provenance with plain-text note body and author when present.

A note badge is shown beside the imported cell. Notes are searchable, command-codec validated, included in semantic workspace identity, and compared separately from the underlying cell value in semantic history. Editing the cached cell value does not silently erase its imported note.

**Default XLSX export deliberately omits classic notes for now.** The Office export assessment shows the number of Frame review notes that will stay behind. An opt-in experimental classic-note XLSX writer and validator exist for local interoperability testing, but it is not the normal product export path until current Excel clients have been externally smoke-tested for repair-free behavior.

### Modern Excel threaded review conversations

Frame imports modern Excel threaded comments as structured source review rather than flattening them into legacy notes.

For each retained thread Frame preserves:

- comment ID and person ID;
- resolved display name when Persons metadata is available;
- root/reply structure through `parentId`;
- source text;
- source UTC timestamp from `dT`;
- source open/resolved state from `done`; and
- mention IDs, people and source character ranges.

Replies without their own cell reference inherit the root cell by following their parent chain. Threads that cannot be mapped onto retained Data rows/columns are explicitly reported rather than silently relocated.

Threaded review is visible as a distinct Data-cell badge and source-order tooltip, searchable, command-codec validated, included in review-aware semantic history, and shown in the unified Context review inbox with source status, participant and reply counts. Imported review remains read-only provenance and does **not** block readiness until a user explicitly promotes it into native Frame review work.

**Default XLSX export deliberately omits modern threaded review parts.** Export preflight shows retained thread/comment/open-thread counts and states that Frame is keeping the discussion rather than flattening it into legacy notes.

### Still not translated

- fonts, fills, borders and alignment;
- conditional formatting;
- merged-cell geometry;
- modern threaded-review XLSX export;
- external workbook/data connections.

## Google Drive direct-import boundary

`googleIdentity.ts` and `googleDriveProvider.ts` implement a read-only browser integration. The Google flow can request access on demand, discover/search/paginate native Docs/Sheets/Slides, export a selected file to Office bytes in memory, and route those bytes through `planSecureOfficeImport()`.

Security model:

- public OAuth web client ID only;
- no client secret in browser code;
- read-only Drive scope;
- ephemeral token held in UI memory;
- same macro/control rejection and bounded Office parser as local files;
- no mutation before governed semantic preview.

## Import safety limits

DOCX/PPTX/XLSX are ZIP packages and are treated as untrusted input. The current browser-side reader:

- rejects packages larger than 128 MiB;
- rejects more than 20,000 ZIP entries;
- rejects individual XML parts larger than 32 MiB;
- caps total materialized XML at 96 MiB;
- rejects encrypted/password-protected packages;
- rejects ZIP64 and multi-disk packages for now;
- validates central/local-header and payload bounds; and
- does not inflate unused binary media merely to inspect text/XML content.

The secure boundary rejects VBA and ActiveX parts. These are prototype safeguards, not the final enterprise upload policy.

## Export privacy and trust boundary

Normal Office compatibility exports do **not** embed hidden Frame-only semantic manifests. That prevents comments/review/provenance metadata that is invisible on the Office canvas from unexpectedly leaving the workspace.

An internal manifest mechanism exists for controlled round-trip workflows and has an explicit strip operation, but ordinary shareable DOCX/PPTX/XLSX files remain clean compatibility projections.

Foreign Excel formulas are never implicitly reactivated, unsupported hyperlink schemes are never silently made live, and imported review conversations are never silently flattened into another review format.

## Package validation

Frame has a local OPC validator that checks internal relationship targets, unique relationship IDs and content-type coverage. The exporter regression suite covers DOCX, PPTX, XLSX, speaker-note parts, styled XLSX packages, hyperlink relationships and the experimental classic-note package path.

This is stronger than self-parsing alone, but it is not a substitute for opening generated files in current Office applications.

## Local interoperability QA

Useful local commands/tools:

- `npm run test:interop`
- `scripts/generate-office-fixtures.mjs`
- `scripts/inspect-office-import.mjs`
- classic-note fixture/export validation tooling;
- Office package validator CLI/tooling;
- `docs/INTEROPERABILITY_TESTING.md`.

The environment used by this assistant cannot currently run the full Vite build or open installed Microsoft Office applications, so external smoke validation remains a deliberate manual gate.

## Compatibility-export philosophy

Frame should never make users choose between semantic power and ecosystem compatibility. The intended contract is:

1. **Import** familiar work into editable Frame objects.
2. **Warn** when source fidelity cannot be represented yet.
3. **Keep provenance** so imported information never becomes anonymous copy/paste.
4. **Work semantically** across Docs, Data and Present.
5. **Assess export fidelity** before projecting into Office files.
6. **Export** standard files when collaborators/downstream systems require them.
7. **Keep Frame JSON** as the lossless representation of the workspace itself.

## Next interoperability milestones

1. Promote selected imported source notes/threads into native Frame review work while preserving an immutable link back to source review provenance.
2. Validate and, if justified, implement modern threaded-review XLSX export without flattening conversations.
3. Preserve selected spreadsheet presentation metadata (alignment/emphasis) only where it adds semantic meaning; do not recreate a formatting-first spreadsheet model.
4. Represent Word comments/revisions as Frame review annotations and version events.
5. Import embedded DOCX/PPTX images into reusable Frame media objects.
6. Convert PowerPoint charts/tables into linked semantic chart/table objects.
7. Expand the explicit reviewable translation layer for supported foreign Excel formulas into Frame formulas.
8. Expand fixture coverage using current Microsoft 365 and Google Workspace exports and run manual application smoke tests in addition to `test:interop`.
