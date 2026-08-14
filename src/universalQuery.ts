import { parsePaletteIntent, type PaletteIntent } from './intent.ts'
import type { WorkspaceState } from './model.ts'
import { searchWorkspace, type WorkspaceSearchResult } from './searchIndex.ts'

export type UniversalQueryResult =
  | { kind:'intent'; intent:Exclude<PaletteIntent,{kind:'unknown'}> }
  | { kind:'search'; query:string; results:WorkspaceSearchResult[]; message:string }

export function resolveUniversalQuery(query: string, workspace: WorkspaceState, limit = 8): UniversalQueryResult {
  const intent = parsePaletteIntent(query, workspace)
  if (intent.kind !== 'unknown') return { kind:'intent', intent }
  const results = searchWorkspace(workspace, query, { limit })
  return {
    kind:'search',
    query:query.trim(),
    results,
    message:results.length ? `${results.length} semantic workspace result${results.length === 1 ? '' : 's'}` : intent.message,
  }
}
