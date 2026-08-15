# Office migration rehearsal

Frame can now inspect a collection of Office files as a **dry-run semantic migration** before any workspace mutation occurs.

This exists because migration quality is not just “can the ZIP/XML parser read the file?” A real migration needs to answer:

- is this content new, a revision, or byte-identical to something already imported?
- what semantic commands would be applied?
- what source fidelity is preserved versus warned/flattened?
- which foreign formulas could become Frame formulas?
- what review notes would enter the workspace?
- what would later be omitted or conservatively suppressed in Office compatibility export?

## Browser rehearsal

Open:

```text
/office-migration.html
```

The page loads the current Frame workspace from the same local semantic session as the main app. It lets you choose multiple `.docx`, `.pptx` and `.xlsx` files.

Frame then:

1. creates a cloned versioned workspace session;
2. securely plans each file through the normal macro/control and bounded-OOXML pipeline;
3. creates a SHA-256 source receipt;
4. classifies the payload as new content, a same-name revision, or duplicate content;
5. skips byte-identical duplicate content by default;
6. applies accepted semantic commands only to the in-memory clone;
7. reports simulated semantic transaction count;
8. reports foreign-formula translation readiness;
9. reports imported review-note provenance; and
10. evaluates Office export fidelity for the simulated result.

No result is written back to the current Frame workspace.

## CLI rehearsal

Run:

```bash
node --experimental-strip-types scripts/simulate-office-migration.mjs ./office-corpus
```

Optional existing Frame workspace:

```bash
node --experimental-strip-types scripts/simulate-office-migration.mjs ./office-corpus --workspace=frame-backup.json
```

Optional machine-readable output:

```bash
node --experimental-strip-types scripts/simulate-office-migration.mjs ./office-corpus --output=migration-report.json
```

## Source identity

`officeImportReceipt.ts` fingerprints the exact source bytes with SHA-256. The source revision ledger distinguishes:

- `duplicate-content` — exact same content hash, even if renamed;
- `filename-revision` — same normalized filename + format, different content hash;
- `new-source` — no matching content or filename revision identity.

This is deliberately stronger than the prototype's filename-only matching.

## Formula migration debt

The rehearsal includes `foreignFormulaTranslationReport.ts` output.

Current candidates are only considered executable-ready when:

1. the formula matches the narrow safe structured-aggregate subset; and
2. the referenced table/field already exists in the supported Frame semantic model.

References to retained imported Data are marked `requires-model-promotion` rather than being executed optimistically.

## Review migration

Classic Excel cell notes are counted as imported Data review provenance. Threaded Excel comments remain warning-only until person/reply semantics can map cleanly into Frame's general review model.

## Export risk

The rehearsal's final cloned workspace is passed through the Office review/export assessment. It can surface, for example:

- cached foreign formulas that will not be reactivated;
- unsafe hyperlink targets that will remain Frame-only;
- mixed date-system styles that will be suppressed;
- hidden/very-hidden source sheet state; and
- imported classic cell notes that currently remain Frame-only in normal XLSX export.

## Important limitation

A successful rehearsal means Frame can plan and simulate the semantic migration. It does **not** mean generated compatibility files have been validated by current installed Microsoft 365 applications. Use the validation bundle + smoke evidence workflow for that external gate.
