# Interoperability implementation status

This file distinguishes **implemented engine capability** from **currently mounted product UI**. Keep it conservative: do not call something user-facing until the active WorkspaceApp path invokes it.

## Implemented and user-facing now

### Local Office import

The existing Import dialog accepts:

- `.docx`
- `.pptx`
- `.xlsx`

It invokes the Office semantic planner and stages the resulting versioned commands through the governed batch preview. Fidelity warnings are displayed before Apply.

Current local-file import preserves:

- Word paragraphs/headings/lists, document tables and document-block source provenance;
- PowerPoint slide order, slide text, speaker notes, source provenance and flattened table rows;
- Excel cached values, recognized finance mappings, arbitrary foreign schemas, extra columns and formula text provenance;
- imported Data tables as editable/versioned/searchable/revertible Frame objects.

### Office export

The Export dialog includes an Office compatibility set:

- DOCX strategy projection;
- PPTX visible-story projection; and
- XLSX Regions/Plan/imported-table projection.

The stable `officeExport.ts` facade currently routes to:

- `officeDocxExport.ts` for native Word list numbering + review/provenance export;
- `officePptxExport.ts` for true PowerPoint speaker-notes parts; and
- `officeXlsxExport.ts` for case-insensitively safe sheet names and cached-value-only formula export.

### Local QA tools

Implemented:

- `scripts/generate-office-fixtures.mjs`
- `scripts/inspect-office-import.mjs`
- `docs/INTEROPERABILITY_TESTING.md`

These make real Microsoft 365 / Google Workspace smoke testing repeatable without GitHub Actions.

## Implemented engine capability, not yet mounted in the active WorkspaceApp UI

### Source-aware local Office re-import

Implemented:

- `officeImportSync.ts`
- `officeImportFacade.ts`
- re-import regression tests

The synchronizer replaces prior imported blocks/tables/scenes from the same source rather than accumulating duplicate revisions.

**Current limitation:** `WorkspaceApp.stageOfficeImport()` still calls the lower-level `planOfficeImport()` directly. It has not yet been changed to `planSynchronizedOfficeImport()` because the current repository connector only allows whole-file replacement for that large shell file and a safe patch edit was not available during this pass.

Result: the synchronization behavior is active for direct Google planning, but local file re-import can still stack a second imported revision in the current UI.

### Direct Google Drive chooser

Implemented:

- `googleIdentity.ts` — Google Identity Services read-only token boundary;
- `googleDriveProvider.ts` — native Docs/Sheets/Slides listing and export;
- `googleWorkspaceImport.ts` — Google export → common Office planner;
- `GoogleDriveImportDialog.tsx` + CSS — connect/search/paginate/select UI;
- `google-env.d.ts` — typed `VITE_GOOGLE_CLIENT_ID`;
- `docs/GOOGLE_DRIVE_SETUP.md`;
- identity/provider/planner/re-import tests.

Security model:

- public OAuth web client ID only;
- no client secret in the browser;
- `drive.readonly` scope;
- token held ephemerally by the chooser;
- Google file bytes pass through the same bounded Office parser;
- no mutation before governed semantic preview.

**Current limitation:** `GoogleDriveImportDialog` is not yet mounted by `WorkspaceApp` / `WorkspaceTransferDialog`, so direct Google import is not yet reachable in the active UI. Google users can still use the fully mounted download-as-DOCX/PPTX/XLSX route.

## Implemented but awaiting external application validation

Generated DOCX/PPTX/XLSX packages round-trip through Frame's own bounded ZIP reader/parsers and have automated package assertions.

They have **not** yet been opened by this assistant in real Microsoft Word, PowerPoint or Excel because this environment has no Office applications and no outbound package-install access. Do not claim pixel-perfect or repair-free Microsoft Office validation until the generated fixtures are manually opened in real Office/Google Workspace.

Use `scripts/generate-office-fixtures.mjs` for that smoke test.

## Known fidelity boundaries

### DOCX

Still warning-only / flattened:

- images/media;
- embedded charts/objects;
- footnotes/endnotes;
- Word comments as native Word comments (Frame review text does export readably);
- tracked revision markup;
- headers/footers;
- exact document layout.

### PPTX

Still warning-only / semanticized:

- source theme/master geometry;
- exact positioning/fonts;
- images/media;
- charts/SmartArt;
- native table geometry (table rows currently become editable text);
- transitions/animations.

### XLSX

Preserved but not executed:

- explicit imported Excel/Sheets formula text + cached values.

Still warning-only / flattened:

- styles and date/number display formats;
- merged-cell geometry;
- comments/notes;
- external workbook/data connections.

Important parser edge still to address: Excel shared-formula dependents whose `<f>` element does not repeat the formula text need explicit expansion/preservation. Do not overstate formula coverage until that is implemented.

## Next safe integration edits

When a normal patch-capable repo checkout is available, make these two small WorkspaceApp/UI changes before expanding format breadth:

1. Change local Office planning to the canonical synchronized facade:

```ts
const plan = await planSynchronizedOfficeImport(workspace, await file.arrayBuffer(), file.name)
```

2. Add a Google Drive action to the Import dialog and mount `GoogleDriveImportDialog`; when it returns an `OfficeImportPlan`, call the existing governed automation planner with `plan.commands` and `plan.warnings`.

Those changes should not create a second import/review pathway.
