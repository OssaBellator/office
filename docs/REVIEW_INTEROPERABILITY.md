# Frame review interoperability contract

Frame treats review information from Office files as **source provenance first** and **native accountable work only after an explicit promotion**. Importing a comment must never silently create a task, approval, blocker, or mutable Frame discussion.

This contract applies to the current Word and Excel review import paths and is intentionally stricter than a copy/paste or flattening model.

## Review model

Frame distinguishes two layers:

1. **Source review provenance** — immutable review information imported from an Office source. It remains attached to the semantic object that came from the source, is searchable and versioned, but does not affect readiness by itself.
2. **Native Frame review** — a task, comment, or approval deliberately created from source review. It has its own owner, body, status and lifecycle while retaining a source-review link.

Source review and native review may coexist. Resolving or editing native review never rewrites imported source provenance.

## Microsoft Word comments

Frame currently preserves classic Word comments from macro-free DOCX packages.

### Preserved

For an anchorable Word comment Frame retains:

- comment ID as stable source identity;
- plain-text comment body, including multiple comment paragraphs;
- author when present;
- source timestamp when present;
- source filename; and
- the imported semantic document block anchored by `commentRangeStart` / `commentRangeEnd` / `commentReference`.

The imported comment becomes a `sourceOnly` workspace review record with `sourceReview.kind = "word-comment"`.

Source-only Word comments:

- appear in the unified Context review inbox as **Word source comment**;
- are searchable on the Docs surface;
- participate in semantic workspace fingerprints and review-aware history;
- survive command/session serialization;
- do **not** create readiness diagnostics, open tasks or approval blockers; and
- are not emitted into the default DOCX compatibility projection.

### Promotion

A Word source comment can be explicitly promoted to a native Frame:

- task;
- comment; or
- approval.

Promotion creates a separate workspace review record. The user can change its owner and body without changing the imported Word comment. Approvals require an explicit owner.

After promotion, the native review participates in normal Frame semantics:

- semantic revisions;
- undo/redo;
- history and revert;
- search;
- readiness diagnostics; and
- resolution/approval state.

The source item remains visible and is marked **Promoted**.

### DOCX re-import lifecycle

Frame uses the Word source comment ID as the stable identity across re-import.

If the same source comment still exists, the native promoted review is remapped to the newly imported semantic block while preserving its Frame-authored body, owner, kind and status.

If the comment disappears, cannot be anchored, or the DOCX no longer contains a comments part at all:

- the old source-only review record is removed;
- the native promoted review is **not deleted**;
- the native review is moved to `document:strategy`;
- `sourceDetached = true` records that the source anchor no longer exists; and
- the review remains actionable and resolvable.

Frame does not guess a replacement Word anchor merely because nearby text looks similar.

### Word review still not translated

Modern Word comment-thread/reply metadata found in extended comment parts is detected but not yet translated. Frame currently preserves the classic comment body and document anchor and emits an explicit fidelity warning when additional modern thread metadata is present.

Tracked changes/revision markup also remains outside the native review model for now.

## Microsoft Excel classic notes

Classic Excel notes/comments are preserved as per-cell source review provenance.

Frame retains:

- note body;
- author when present; and
- original A1 cell reference when available.

The A1 source reference is used as stable review identity across re-import. This prevents Frame row IDs or row insertion/reordering from silently retargeting promoted work.

A classic note can be explicitly promoted to a native Frame task/comment/approval while the source note remains immutable.

## Microsoft Excel threaded comments

Modern Excel threaded comments are preserved as a real source conversation rather than flattened into a legacy note.

Frame retains:

- stable comment IDs;
- root/reply parent relationships;
- person IDs and display names;
- text;
- UTC source timestamps when present;
- root resolved state;
- mention person IDs, mention IDs and ranges; and
- the source cell.

The root comment ID is the stable source-review identity used across re-import.

A threaded conversation may also be explicitly promoted to native Frame review work. Promotion does not flatten, resolve, edit or otherwise mutate the imported thread.

## Excel re-import and review archives

When an Excel source is refreshed, Frame first tries stable source identity:

- classic note: original A1 source reference;
- threaded comment: root comment ID.

For older imported notes that predate A1 provenance, Frame may use a conservative unique-content fallback. It refuses ambiguous matches.

If a promoted Excel review cannot be safely matched to the refreshed source:

- Frame keeps the native review;
- retains the prior source table as a **review archive**;
- does not duplicate copied source review into the live inbox; and
- exposes an explicit **Relink** workflow so the user can choose a refreshed source review.

Relink changes source provenance/target only. It preserves the native review ID, body, owner, kind, status and creation time.

## Readiness semantics

Imported source review is informational provenance. It does not block readiness merely because the source Office file contained unresolved review.

Only native Frame review enters readiness semantics:

- native open tasks are follow-up work;
- native unresolved comments are review diagnostics; and
- native pending approvals block readiness until approved.

This boundary prevents a file import from silently changing governance state.

## Semantic history and identity

Review provenance is part of semantic workspace identity. A workspace that differs only in imported review provenance is semantically different.

Review-aware history distinguishes:

- **Source review** changes — imported provenance changed; and
- **Frame review** changes — native accountable review work changed.

Source review changes are kept separate from underlying cell values so, for example, editing an Excel note does not masquerade as a numeric data change.

## Search and UI

The unified Context review inbox currently surfaces:

- native Docs reviews;
- native cross-surface promoted reviews;
- Word source comments;
- Excel source notes; and
- Excel source threads.

Source review is visibly read-only until promotion. Native promoted review has normal Resolve/Approve controls. Excel review archives expose Relink; detached Word reviews remain attached to the Strategy document and are clearly labeled as source-detached.

Imported Data cells show distinct provenance badges for formulas, number formats, links, classic notes, threaded review and linked native Frame review.

## Export policy

Default Office export is deliberately conservative.

### DOCX

The export preflight reports:

- imported Word source-comment count;
- native reviews promoted from Word comments;
- open promoted Word review count; and
- detached promoted Word review count.

Neither imported Word source comments nor native Frame review records are embedded into the default DOCX projection yet.

### XLSX

The export preflight reports separately:

- classic source notes;
- source review threads and comment count;
- open source threads;
- native reviews promoted from Excel source review; and
- open promoted Excel review count.

Default XLSX export currently omits source notes, threaded conversations and native Frame review. Threaded review is never flattened into legacy notes implicitly.

Frame JSON remains the lossless representation of review provenance and native review work.

## External validation boundary

The normal Office export path has not been promoted to emit Word comments or Excel threaded comments. The experimental classic-note XLSX writer remains separate from the default product path until repair-free behavior is validated in current Office clients.

Do not claim pixel-perfect review round-tripping or full Microsoft 365 collaboration compatibility yet. Current support is semantic preservation, governed promotion, safe source refresh and conservative export preflight.
