# Frame Review Center

Review Center is the workspace-wide projection over Frame's review model. It does not own review state itself.

Its job is to make review work legible across Docs, Data, and imported source provenance without collapsing those concepts into one storage format.

## Authoritative stores

Review Center reads from three sources:

1. **Docs review** — semantic document annotations (comments, tasks, approvals).
2. **Native Data review** — canonical workspace-level `workspaceReviews` records.
3. **Imported source review** — read-only Excel notes and threaded comment conversations retained on Imported Data.

Source review remains provenance. Native review remains accountable Frame work.

## States

Review Center classifies items into:

- **Active** — open native tasks/comments and pending native approvals.
- **Archived** — native Data review whose imported source pointer resolves only to a review archive or whose source Data is missing.
- **Source review** — imported Excel notes/threads that have not become native Frame state merely by being imported.
- **Completed** — resolved native tasks/comments and approved native approvals.

Completed native Data review remains visible because it can still retain a source pointer that must be explicitly relinked or detached before the source Data can be removed.

## Filters

The current Review Center supports:

- state;
- kind;
- owner / source author; and
- all-term text search over label, body, owner, source, kind, and status.

The compact Context review inbox remains a nearby triage view. Review Center is the complete lifecycle view.

## Single-item actions

Review Center reuses the same semantic planners used elsewhere:

- **Promote** — imported source review → native Frame Data review.
- **Resolve / Approve** — changes native review status.
- **Relink** — explicitly repairs an archived/missing source pointer.
- **Detach** — deliberately releases imported provenance while keeping native work.

No Review Center action bypasses semantic history.

## Atomic batch source promotion

Unpromoted source notes and threaded conversations can be selected independently of native review.

`Select visible source` respects the current Review Center filters. The batch editor chooses a common:

- native review kind (`task`, `comment`, or `approval`); and
- owner.

Each selected item still keeps its own:

- source text;
- source file;
- table/row/column pointer;
- source review identity; and
- new native review identity.

The planner emits **one** `review.workspace.replace` command containing the existing native review plus every new promoted record. This is important: it avoids sequential full-array replacement commands planned against the same stale workspace snapshot.

Batch promotion rejects, before mutation:

- empty selection;
- duplicate selection IDs;
- missing source Data;
- copied `· review archive` provenance;
- source review that is already linked to native Frame review; and
- multiple selections that resolve to the same source review identity.

Approval batches require an explicit owner.

One semantic revision creates the whole batch, and one stack Undo removes the whole batch.

## Re-promotion after Detach

Detach deliberately releases a source pointer. Therefore the same source note/thread may later be promoted into new native work.

Native review IDs are collision-safe:

```text
frame-review:<source-review-id>
frame-review:<source-review-id>:2
frame-review:<source-review-id>:3
```

The detached review keeps its old ID and history. The new promotion receives the next available identity. Duplicate **current source links** remain disallowed.

## Atomic native Data batch triage

Canonical native Data review has its own independent selection lane.

`Select visible Data` respects the current Review Center filters. The batch triage editor can:

- reassign a common owner;
- complete the selection; or
- do both in one operation.

Completion semantics are type-aware:

```text
task     -> resolved
comment  -> resolved
approval -> approved
```

`planBatchTriageWorkspaceReviews()` emits one `review.workspace.replace` command. It preserves each review's:

- ID;
- authored body;
- source pointer;
- creation timestamp; and
- all unrequested fields.

The planner rejects empty, duplicate, unknown, blank-owner, and ineffective/no-op requests before mutation.

One semantic revision updates the whole selected Data batch, and one stack Undo restores it.

### Why Data-only today

Docs review and native Data review currently have different authoritative stores: semantic document annotations versus `workspaceReviews`.

A mixed Docs+Data batch would require either:

- a new cross-store atomic semantic command; or
- several full-state replacement commands, which would no longer be one revision/one Undo.

Frame currently chooses correctness over pretending that those operations are atomic. Batch native triage therefore targets canonical **Data review only**. Single-item Docs review actions remain available, and Review Center still displays/filter both stores together.

A future cross-store review batch command should update both review collections in one mutation and have explicit conflict-aware revert semantics.

## Re-import and history integrity

Source synchronization keeps Imported Data and native review ownership separate:

- `data.imported.replace` refreshes source Data;
- `review.workspace.replace` remaps native source pointers.

When a review pointer moves to refreshed source Data, the prior source table is retained as an unreferenced `· review archive` history anchor. This keeps stepwise Undo referentially valid.

History revert additionally checks that any **prior** source pointer it would restore still resolves in the current workspace. If later Data edits removed that source context, revert conflicts instead of creating a dangling native review pointer.

## Product invariant

> **Source review records what another system said. Native review records what Frame decided to do about it. Review Center makes both visible without confusing their ownership.**
