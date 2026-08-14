# Frame interoperability contract

Frame's native format is the semantic workspace, not a collection of Office files. Interoperability is implemented as **semantic import** and **compatibility export**: content enters Frame as editable objects, and Frame can project those objects back into common formats when another tool needs a file.

The lossless backup format remains the Frame workspace/session JSON because it contains semantic history, object relationships, review state, provenance, and other concepts that DOCX/PPTX/XLSX cannot represent completely.

## Current support matrix

| Source / target | Import into Frame | Export from Frame | Current behavior |
| --- | --- | --- | --- |
| Microsoft Word `.docx` | Yes | Yes | Paragraphs, headings and lists become semantic document blocks. Tables become Frame Data tables. Claims/metrics/decisions export as normal Word content. |
| Microsoft PowerPoint `.pptx` | Yes | Yes | Slides become editable Frame scenes. Slide text, slide order and speaker notes are preserved semantically. Frame exports standard slides with real speaker-notes parts. |
| Microsoft Excel `.xlsx` | Yes | Yes | Recognized finance sheets update live semantic models; arbitrary sheets remain editable Frame Data tables. Frame exports Regions, Plan and retained foreign tables. |
| Google Docs | Yes, via DOCX export; Drive adapter implemented | DOCX projection | Google-native content uses the same DOCX semantic import path. Direct Drive transport is implemented but sign-in/picker UI still needs application OAuth configuration. |
| Google Slides | Yes, via PPTX export; Drive adapter implemented | PPTX projection | Google-native content uses the same PPTX semantic import path. |
| Google Sheets | Yes, via XLSX export; Drive adapter implemented | XLSX projection | Google-native content uses the same XLSX semantic import path. |
| CSV | Yes | Yes | Regions/Plan CSV has schema-aware import; CSV remains a simple compatibility format. |
| Frame JSON | Yes | Yes | Lossless workspace/session backup including semantic history. |
| Legacy Office `.doc/.ppt/.xls` | No | No | Convert to DOCX/PPTX/XLSX in Office or Google Workspace first. |
| Google pointer `.gdoc/.gslides/.gsheet` | No direct file parsing | N/A | Pointer files do not contain document content. Download/export the native file or use the Drive provider. |

## Word / Google Docs fidelity

### Preserved as editable Frame objects

- Paragraph text.
- Word/Google title and subtitle styles.
- Heading hierarchy, collapsed to Frame heading levels 1–3 where required.
- Bullet and numbered list semantics.
- Document tables, imported into Data instead of flattened into surrounding prose.
- Source filename on imported paragraph blocks; the source is visible in Docs, searchable, version-diffed, serialized, and included in Markdown/DOCX compatibility exports.

### Warned before Apply

The import preview explicitly reports fidelity gaps instead of silently dropping them. Current warnings cover:

- embedded images/media;
- embedded charts/objects;
- footnotes/endnotes;
- comments/comment threads;
- headers/footers; and
- tracked revision markup.

These features are not yet native Frame objects.

## PowerPoint / Google Slides fidelity

### Preserved as editable Frame objects

- Presentation relationship order rather than filename order.
- Slide titles and text bodies.
- Speaker notes through notes-slide relationships.
- Imported slide source attribution.
- Slide tables as editable text rows when a native semantic table object cannot yet represent the layout.
- Imported scenes participate in Frame reorder, hide/show, notes, presentation mode, semantic history, search and revert behavior.

### Export behavior

Frame's PPTX projection creates:

- a presentation part;
- slide master and blank layout;
- a Frame theme;
- one standard slide part per visible semantic scene;
- a notes master;
- one real notes-slide part per exported scene; and
- slide/notes relationships.

Speaker cues are therefore exported as notes rather than rendered visibly as `Speaker note:` content on the slide.

### Warned before Apply

- source theme/master geometry is semanticized rather than reproduced pixel-for-pixel;
- exact text positioning and source fonts are not retained;
- images/media are not imported yet;
- charts/SmartArt are not yet converted to native Frame visual objects;
- PowerPoint tables are currently flattened into editable text rows; and
- transitions/animations are not imported.

## Excel / Google Sheets fidelity

### Recognized semantic models

A sheet with compatible Region/Revenue/Growth/Margin columns can update Frame's live regional model. Compatible Plan/Budget/Forecast sheets can update Frame's live plan model. These changes still go through normal semantic preview, permissions, history, undo/redo and revert.

### Foreign schemas

A worksheet that does not map to the live finance model remains an **Imported Data table**. These tables:

- retain source filename and sheet label;
- infer text/number columns;
- remain editable in Frame Data;
- participate in semantic search;
- generate cell-level semantic version diffs;
- are codec/runtime validated;
- are revertible; and
- are included in XLSX compatibility export.

Recognized sheets with extra foreign columns are also retained as imported tables so those columns are not discarded.

### Formula preservation policy

Frame currently preserves two separate pieces of an imported Excel/Google Sheets formula cell:

1. the workbook's cached value, which is the value shown and used for compatible live-model updates; and
2. the original formula text, stored as provenance on the imported table cell.

Formula-backed cells display a `ƒ` marker in Data. Search and semantic history can see formula text separately from cached values. Editing the cell in Frame deliberately removes the preserved foreign formula from that cell, because the user has replaced the imported value.

Frame **does not execute arbitrary foreign spreadsheet formulas yet**. This avoids treating a foreign workbook language as trusted Frame logic. Formula translation should become an explicit conversion step into Frame's semantic formula engine.

Frame's XLSX exporter currently writes cached values only; it does not automatically re-emit preserved foreign formulas. That is intentional until formula export has an explicit trust/translation policy.

### Other warned fidelity gaps

- cell styles and date/number display formats;
- merged-cell geometry;
- Excel comments/notes; and
- external workbook links/data connections.

## Google Drive direct-import boundary

`googleDriveProvider.ts` implements a read-only Google Drive transport boundary. It can:

- discover native Google Docs, Sheets and Slides;
- search by filename;
- paginate Drive results;
- map native Google MIME types to Frame import kinds; and
- export a selected native Google file to DOCX, XLSX or PPTX bytes for the same semantic planners used by local Office files.

The provider uses a read-only Drive scope. OAuth client configuration, consent and picker UI are deliberately separate from conversion logic. Once product credentials are configured, the UI should remain a thin layer over this provider rather than creating another import engine.

## Import safety limits

DOCX, PPTX and XLSX are ZIP packages and are treated as untrusted local input. The current browser-side reader:

- rejects packages larger than 128 MiB;
- rejects more than 20,000 ZIP entries;
- rejects individual XML parts larger than 32 MiB;
- caps total materialized XML at 96 MiB;
- rejects encrypted/password-protected packages;
- rejects ZIP64 and multi-disk packages for now;
- validates central/local-header and payload bounds; and
- does not inflate unused binary media merely to inspect text/XML content.

These limits are prototype safeguards, not a final enterprise upload policy.

## Compatibility-export philosophy

Frame should never make users choose between semantic power and ecosystem compatibility. The intended contract is:

1. **Import** familiar work into editable Frame objects.
2. **Warn** when source fidelity cannot be represented yet.
3. **Keep provenance** so imported information never becomes anonymous copy/paste.
4. **Work semantically** across Docs, Data and Present.
5. **Export** standard Office files when collaborators or downstream systems require them.
6. **Keep Frame JSON** as the lossless representation of the workspace itself.

## Next interoperability milestones

1. Wire OAuth/sign-in and a Google Drive picker to the existing read-only provider.
2. Import embedded DOCX/PPTX images into reusable Frame media objects rather than skipping media bytes.
3. Convert PowerPoint charts and tables into linked semantic chart/table objects.
4. Translate supported Excel formulas into Frame formulas with an explicit reviewable mapping step.
5. Add rich Excel styles/date types without allowing formatting to obscure semantic data types.
6. Represent Word comments/revisions as Frame review annotations and version events.
7. Validate generated DOCX/PPTX/XLSX packages against real Microsoft Office/LibreOffice fixtures in the local interoperability test suite.
8. Add round-trip fixture tests using exports produced by current Microsoft 365 and Google Workspace versions.
