# Excel review provenance in Frame

Frame treats spreadsheet comments and notes as **review information**, not cell formatting.

That distinction matters because the semantic workspace should preserve why a value exists and what review work remains even when the original workbook is no longer open.

## Classic Excel cell notes

Classic comments/notes stored in `xl/comments*.xml` are currently imported into `ImportedDataTable.commentByCell` as:

```ts
{
  text: string
  author?: string
}
```

Each note is attached to a specific semantic table row + column cell key. The Data surface shows a note badge and exposes author/text without changing the cell value.

Editing a cached cell value does **not** silently delete its imported note. The review provenance remains attached until a future explicit review-edit/removal action changes it.

## Review API

`src/importedDataReview.ts` converts imported cell notes into review items containing:

- source workbook;
- table label;
- row id;
- column id/label;
- current semantic cell value;
- imported author; and
- review text.

This is intentionally Office-agnostic. Future collaboration/review UI can consume the review item without understanding `comments1.xml` or VML.

`src/workspaceReviewCompare.ts` layers note diffs over the core semantic workspace comparator, and `src/reviewHistory.ts` summarizes note changes per semantic transaction.

## Search

Imported note author/text is indexed with the table's semantic search record, so a user can find the affected Data table with queries such as an author's name or a review phrase.

## Import behavior

The secure XLSX pipeline:

1. resolves the worksheet's comments relationship;
2. parses the classic comments part;
3. resolves `authorId` against the authors collection;
4. flattens rich-text runs into review text;
5. maps the Excel cell reference to the retained Frame Data row/column; and
6. preserves the note as cell review provenance.

If a note exists on a worksheet that otherwise would not be retained, Frame may retain that worksheet as generic Data so the review context is not discarded.

If a comment points outside the rows/columns retained as Frame Data, the import plan surfaces a warning rather than claiming complete preservation.

## Threaded comments

Modern Excel threaded comments are a separate review system with person identities, comment ids and reply/thread semantics.

Frame currently **does not flatten them into fake classic notes**. When threaded-comment parts are detected, the import plan reports that threaded comments are not imported yet.

The intended future mapping is to Frame's general review/conversation model, preserving:

- person identity;
- comment id;
- parent/reply relationships;
- timestamps where available;
- cell anchor; and
- resolved/open state if represented.

## Export boundary

Normal Frame XLSX compatibility export currently keeps classic imported notes **Frame-only**.

Reason: traditional Excel cell notes require both comments parts and legacy VML drawing/worksheet relationships. Generating a superficially valid package is not enough; the result must be tested in current Excel for repair prompts and correct note rendering.

An opt-in experimental writer exists in `src/officeXlsxNotesExport.ts`. It emits:

- `xl/commentsN.xml`;
- `xl/drawings/vmlDrawingN.vml`;
- worksheet comments + VML relationships;
- `legacyDrawing` reference; and
- required content types.

It is covered by Frame's OPC validator and secure re-import round-trip tests, but should remain outside the default product export until manual current-Excel smoke validation passes.

The CLI `scripts/export-xlsx-with-notes.mjs` exists specifically for that validation workflow.

## Product rule

Review provenance must never be silently lost merely because Office and Frame represent review differently. When fidelity cannot safely cross the compatibility boundary, Frame should preserve it internally and say so before export.
