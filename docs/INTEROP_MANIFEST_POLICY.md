# Office interoperability manifest policy

Frame has an **explicit internal round-trip** API that can embed `frame/interop.xml` inside an OOXML package. That manifest can carry semantic extension metadata that Word/PowerPoint/Excel cannot represent directly.

It is **not** part of normal Office export.

## Default external export rule

The user-facing Office compatibility functions:

- `exportWorkspaceDocx`
- `exportWorkspacePptx`
- `exportWorkspaceXlsx`

must produce ordinary Office files **without** a hidden Frame manifest.

Reason: a semantic workspace can contain review annotations, provenance, formulas, hidden presentation state and other information that is not visibly rendered in the exported Office canvas. Embedding that data invisibly in a file sent to an external recipient would be a disclosure risk.

`tests/officeManifestPrivacy.test.mjs` enforces this boundary.

## Internal round-trip API

`exportWorkspaceOfficeSetWithManifest` is intentionally explicit. Treat it as an internal/controlled round-trip mechanism, not a replacement for the normal Export button.

Before any manifest-bearing export becomes user-facing, the product must provide:

1. a clear "include Frame metadata" choice;
2. a summary of what metadata will be embedded;
3. a safe default of **off** for external sharing;
4. policy/permission checks for review comments, source provenance and sensitive model metadata;
5. a "strip Frame metadata" operation; and
6. tests proving that ordinary exports stay manifest-free.

## Import behavior

Reading a Frame manifest should never cause hidden metadata to override visible Office edits without review. A future round-trip importer should treat manifest content as provenance/merge context and compare it against the visible imported projection before restoring richer semantic objects.

A manifest is not proof that the Office file is unchanged since Frame exported it.
