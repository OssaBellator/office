import type { WorkspaceState } from './model.ts'
import { compareWorkspaceStates, type WorkspaceVersionDiff } from './workspaceCompare.ts'

export type MergeSide = 'ours' | 'theirs'
export type MergeChange = WorkspaceVersionDiff & { side: MergeSide }
export type MergeConflict = {
  objectId: string
  field: string
  label: string
  base: string | number | null
  ours: string | number | null
  theirs: string | number | null
}
export type SemanticMergePlan = {
  canAutoMerge: boolean
  ours: MergeChange[]
  theirs: MergeChange[]
  autoChanges: MergeChange[]
  sameChanges: MergeChange[]
  conflicts: MergeConflict[]
}

function key(diff: WorkspaceVersionDiff) {
  return `${diff.objectId}\u0000${diff.field}`
}

function sameValue(left: WorkspaceVersionDiff, right: WorkspaceVersionDiff) {
  return Object.is(left.after, right.after)
}

export function planSemanticMerge(base: WorkspaceState, ours: WorkspaceState, theirs: WorkspaceState): SemanticMergePlan {
  const oursDiffs = compareWorkspaceStates(base, ours)
  const theirsDiffs = compareWorkspaceStates(base, theirs)
  const oursByKey = new Map(oursDiffs.map((diff) => [key(diff), diff]))
  const theirsByKey = new Map(theirsDiffs.map((diff) => [key(diff), diff]))
  const allKeys = new Set([...oursByKey.keys(), ...theirsByKey.keys()])
  const autoChanges: MergeChange[] = []
  const sameChanges: MergeChange[] = []
  const conflicts: MergeConflict[] = []

  for (const semanticKey of allKeys) {
    const oursDiff = oursByKey.get(semanticKey)
    const theirsDiff = theirsByKey.get(semanticKey)
    if (oursDiff && !theirsDiff) { autoChanges.push({ ...oursDiff, side:'ours' }); continue }
    if (theirsDiff && !oursDiff) { autoChanges.push({ ...theirsDiff, side:'theirs' }); continue }
    if (!oursDiff || !theirsDiff) continue
    if (sameValue(oursDiff, theirsDiff)) {
      sameChanges.push({ ...oursDiff, side:'ours' })
      continue
    }
    conflicts.push({
      objectId:oursDiff.objectId,
      field:oursDiff.field,
      label:oursDiff.label,
      base:oursDiff.before,
      ours:oursDiff.after,
      theirs:theirsDiff.after,
    })
  }

  return {
    canAutoMerge: conflicts.length === 0,
    ours: oursDiffs.map((diff) => ({ ...diff, side:'ours' as const })),
    theirs: theirsDiffs.map((diff) => ({ ...diff, side:'theirs' as const })),
    autoChanges,
    sameChanges,
    conflicts,
  }
}
