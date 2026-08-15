# Imported review promotion

Frame treats review imported from external productivity suites as **source provenance first**, not as native mutable collaboration state.

That distinction matters because an Excel note or threaded comment can be refreshed by re-import, while a task created inside Frame belongs to the Frame workspace and must survive independently.

## Source review classes

Frame currently recognizes two Excel review forms on imported Data cells:

- **Classic cell notes** — plain text plus author when available and the original A1 cell reference when present.
- **Modern threaded review** — root/reply comments with source comment IDs, person IDs/display names, timestamps, resolution state, and mention metadata.

Both remain read-only source provenance after import.

## Promotion

The Context review inbox exposes **Promote** for imported source review that has not already been promoted.

Promotion currently creates a native Frame **task**:

- targeted at the imported Data row/cell;
- owned by `Unassigned` by default, rather than assigning work to an external source author;
- with an immutable source-review link containing source file, table, row, column and source-review identity;
- stored with the imported Data target and validated by the normal semantic command codec; and
- applied through the existing `data.imported.replace` semantic command, so version history, undo, redo, persistence and revert use the same transaction machinery as other Data edits.

The source note/thread is not modified or removed. After promotion the inbox shows both:

1. the read-only source review marked **Promoted**; and
2. the native Frame task with normal **Resolve** behavior.

The promotion planner also supports `comment` and `approval` review kinds programmatically. Approval promotion starts `pending`; task/comment promotion starts `open`.

## Readiness semantics

Imported source review by itself does **not** block Frame review readiness.

Once explicitly promoted, the native record participates in normal readiness:

- promoted approvals count as pending approvals and block readiness;
- promoted tasks count as open tasks and appear as follow-up warnings; and
- promoted comments count as unresolved comments and appear as follow-up warnings.

Resolving/approving the native Frame record never rewrites the imported source review.

## Re-import behavior

Source-aware Office re-import preserves native promoted work.

For modern threaded review, Frame matches the refreshed conversation by the Excel root comment ID.

Classic notes do not have an equivalent stable GUID. Frame therefore uses a conservative hierarchy:

1. exact retained source-review identity when available;
2. a unique same-column author + note-text match when the source cell reference moved; and
3. positional fallback only when the semantic source review itself is no longer present.

If the source worksheet disappears entirely while promoted Frame work still targets it, Frame retains the prior imported table as a review anchor instead of silently deleting native work.

## UI distinction

Imported Data cells can display independent provenance/work badges for:

- formula text;
- number format;
- hyperlink;
- classic note;
- threaded source review; and
- promoted native Frame review.

This intentionally makes the fork between **what the source said** and **what Frame now owns** visible.

## Current limitations

- The product UI currently promotes as an `Unassigned` task; choosing task/comment/approval and owner before promotion is a later refinement.
- Promoted review records are stored with imported Data tables today. Their schema is cross-surface-ready, but a future workspace-wide review store should own native review that targets Docs, Data and Present uniformly.
- Default XLSX compatibility export does not export native Frame review, classic notes, or modern threaded review. Frame JSON remains the lossless representation.
- Classic-note identity across arbitrary spreadsheet edits is necessarily heuristic because the legacy note format has no stable comment GUID.

## Regression coverage

The focused interoperability suite covers:

- source review import and command-codec persistence;
- duplicate-promotion prevention;
- source/native review coexistence;
- independent native resolution;
- readiness behavior after task/approval promotion;
- semantic history for source and promoted review changes;
- workspace fingerprint changes;
- source re-import remapping, including moved rows; and
- static product-wiring guards for import, history, Data badges, Context inbox and export preflight.
