# Modern Word review-thread preservation

Frame imports modern Microsoft Word comment metadata as **source review provenance** layered on top of the existing semantic DOCX import. This extends the classic Word-comment path without changing the product rule that imported review stays read-only until a user explicitly promotes it into native Frame work.

## Preserved metadata

When the corresponding Word parts are present, Frame currently preserves:

- classic comment ID (`w:id`);
- comment body and author;
- legacy comment timestamp;
- the `paraId` of the comment's last paragraph;
- reply-parent relationship through `paraIdParent`;
- source done/resolved state;
- durable comment ID;
- extensible UTC date metadata; and
- the semantic document block anchoring the root discussion.

Replies without their own document-range marker inherit the root document anchor by following the parent-comment chain. Frame does not attach a reply to a nearby paragraph merely because the text appears related.

## Identity strategy

Frame retains the ordinary source review identity:

`word-comment:<source filename>:<Word comment id>`

When Word also supplies a durable comment ID, Frame stores that separately and uses it as a stronger refresh key.

On DOCX re-import Frame therefore attempts native-review remapping in this order:

1. exact source review ID;
2. durable Word comment ID when available; and
3. no guessed replacement.

This matters because an Office producer may rewrite the ordinary comment ID while preserving the durable identity.

If neither identity can be matched safely, native promoted review remains actionable but becomes source-detached on the Strategy document rather than being deleted or silently retargeted.

## Thread projection

`wordReviewThreads.ts` projects flat source-review records into conservative review threads.

Each projected thread exposes:

- root message;
- ordered messages with depth;
- reply count;
- participants;
- source resolved state; and
- source/target context.

Missing parents and parent cycles are not guessed through. They remain conservative roots in the projection.

The flat workspace review records remain the durable storage representation; thread projection is derived and does not mutate provenance.

## Promotion semantics

Any imported Word source comment/reply can be explicitly promoted into a native Frame:

- task;
- comment; or
- approval.

The native review gets its own Frame-authored body, owner and status while retaining source provenance. The Office source review remains unchanged.

A promoted Word review participates in semantic history, undo/redo, revert, search and readiness. Source-only review does not affect readiness.

## Current UI boundary

The unified review inbox already exposes Word source review and promotion. The richer thread hierarchy is currently available through the semantic projection layer and regression suite; the next UI step is to render root/reply grouping and source done state directly in Context rather than showing each imported Word comment as a flat source item.

## Export boundary

Default DOCX export does not yet emit imported Word source comments, modern reply metadata or native Frame review records. Export preflight reports source-comment and promoted-review counts explicitly so users know what remains Frame-only.

Frame JSON remains the lossless representation for review provenance and native review work.

## Validation boundary

The repository contains parser, secure-import, durable-remap and thread-projection regressions. The current environment used for implementation cannot materialize the private repository into the local runtime, so these new regressions have **not** been executed here. They are intended to run under the existing local `npm run test:interop` workflow.

External application validation in current Microsoft 365 clients is still required before claiming full repair-free review round-tripping.
