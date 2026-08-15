# Frame review provenance contract

Frame distinguishes **source review provenance** from **native Frame review work**. That separation is deliberate: importing a spreadsheet comment should not silently create a task, approval, or blocker, and turning source feedback into accountable work should not mutate the source record.

## Review layers

### 1. Imported source review

Excel review metadata is preserved as read-only provenance on Imported Data.

Classic cell notes preserve:

- note text;
- author when present; and
- the original worksheet A1 cell reference when available.

Modern threaded comments preserve:

- root and reply comment IDs;
- person IDs and display names;
- parent/reply relationships;
- UTC timestamps when present;
- resolved state;
- cell reference;
- mention person IDs and text ranges.

Source review is searchable, version-diffed, fingerprinted, persisted and visible in the Data grid and Context review inbox. It does **not** block workspace readiness by itself.

### 2. Promoted native Frame review

A user can explicitly promote a source note or thread into native Frame review work. Promotion currently creates a Frame task by default and retains an immutable source pointer containing:

- source file;
- source table;
- source row and column in the current Frame projection;
- source review kind (`excel-note` or `excel-thread`); and
- stable source review identity.

The imported source review remains unchanged and is shown as **Promoted**. A separate native Data review appears in the inbox and on the affected cell.

Native promoted review participates in:

- semantic history;
- undo/redo and revert;
- workspace fingerprints;
- readiness diagnostics;
- task/approval resolution; and
- Office export preflight.

Promoted approvals can block readiness. Promoted tasks/comments are follow-up work but are not converted into source comments.

## Source identity and re-import

Threaded comments have source GUIDs, so Frame uses the root threaded-comment ID as the source review identity. That identity survives row movement in the workbook.

Classic notes do not have an equivalent stable comment GUID. Frame therefore retains the original A1 source cell reference and uses it as the primary source anchor. On re-import Frame remaps promoted classic-note work in this order:

1. exact source-review identity / A1 anchor;
2. one unambiguous note with the same author and text, allowing a note that moved cells to remain linked; and
3. positional fallback for older Frame sessions created before A1 note provenance was retained.

If a refreshed source sheet still exists, promoted native review is remapped to the refreshed Frame table/row IDs. If a source sheet disappears while it still contains native promoted review records, Frame retains the prior table as a review anchor rather than silently deleting native work.

## Imported table lifecycle

Promoted Data review records are currently stored with their Imported Data table. This is a prototype implementation choice that lets promotion, resolution, undo/redo, revert, persistence and synchronization reuse the hardened `data.imported.replace` semantic transaction path.

Because of that storage choice:

- an imported table with **open** native promoted review cannot be removed from the Data UI;
- once those reviews are resolved or approved, deliberate table removal is allowed;
- semantic history still records the prior review state after removal.

A future server-backed model can lift these records into a workspace-wide review collection without changing the source-link schema.

## Export policy

Normal XLSX compatibility export currently keeps all review layers conservative:

- classic source notes remain in Frame unless the experimental classic-note export path is explicitly tested;
- threaded source comments remain in Frame and are never flattened into fake legacy notes;
- promoted native Frame Data review remains in Frame and is not embedded as hidden workbook metadata.

The Office export assessment reports source-note count, source-thread/comment count, open source threads, native promoted review count and open native promoted review count before download.

Frame JSON remains the lossless representation of the workspace and its review provenance.

## Product principle

The invariant is simple:

> **Provenance is preserved; accountability is explicit.**

Importing external review records what the source said. Promotion records what the Frame workspace has decided to do about it. Those are related facts, not the same object.
