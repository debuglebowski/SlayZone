import { validateReparent, type ReparentTaskRow } from './reparent-validation'

function makeLookup(rows: ReparentTaskRow[]): (id: string) => ReparentTaskRow | null {
  const map = new Map(rows.map(r => [r.id, r]))
  return (id) => map.get(id) ?? null
}

function assert(cond: boolean, msg: string): void {
  if (!cond) { console.error('FAIL:', msg); process.exit(1) }
}

// Self-parent
{
  const lookup = makeLookup([{ id: 'a', project_id: 'p', parent_id: null }])
  const r = validateReparent({ taskId: 'a', parentId: 'a', lookup })
  assert(!r.ok && r.error === 'self', 'self-parent should fail')
}

// Detach
{
  const lookup = makeLookup([{ id: 'a', project_id: 'p', parent_id: 'b' }, { id: 'b', project_id: 'p', parent_id: null }])
  const r = validateReparent({ taskId: 'a', parentId: null, lookup })
  assert(r.ok, 'detach should succeed')
}

// Missing task
{
  const lookup = makeLookup([])
  const r = validateReparent({ taskId: 'x', parentId: 'y', lookup })
  assert(!r.ok && r.error === 'missing-task', 'missing task')
}

// Missing parent
{
  const lookup = makeLookup([{ id: 'a', project_id: 'p', parent_id: null }])
  const r = validateReparent({ taskId: 'a', parentId: 'missing', lookup })
  assert(!r.ok && r.error === 'missing-parent', 'missing parent')
}

// Archived parent
{
  const lookup = makeLookup([
    { id: 'a', project_id: 'p', parent_id: null },
    { id: 'b', project_id: 'p', parent_id: null, archived_at: '2026-01-01' },
  ])
  const r = validateReparent({ taskId: 'a', parentId: 'b', lookup })
  assert(!r.ok && r.error === 'archived-parent', 'archived parent')
}

// Cross-project
{
  const lookup = makeLookup([
    { id: 'a', project_id: 'p1', parent_id: null },
    { id: 'b', project_id: 'p2', parent_id: null },
  ])
  const r = validateReparent({ taskId: 'a', parentId: 'b', lookup })
  assert(!r.ok && r.error === 'cross-project', 'cross-project')
}

// Cycle: a -> b -> c, reparent a under c (walks c -> b -> a => cycle)
{
  const lookup = makeLookup([
    { id: 'a', project_id: 'p', parent_id: null },
    { id: 'b', project_id: 'p', parent_id: 'a' },
    { id: 'c', project_id: 'p', parent_id: 'b' },
  ])
  const r = validateReparent({ taskId: 'a', parentId: 'c', lookup })
  assert(!r.ok && r.error === 'cycle', 'cycle detect')
}

// Happy path: sibling reparent under another task
{
  const lookup = makeLookup([
    { id: 'a', project_id: 'p', parent_id: null },
    { id: 'b', project_id: 'p', parent_id: null },
  ])
  const r = validateReparent({ taskId: 'a', parentId: 'b', lookup })
  assert(r.ok, 'happy path reparent')
}

// Depth >1 allowed: grandparent -> parent, child reparented under parent
{
  const lookup = makeLookup([
    { id: 'g', project_id: 'p', parent_id: null },
    { id: 'mid', project_id: 'p', parent_id: 'g' },
    { id: 'c', project_id: 'p', parent_id: null },
  ])
  const r = validateReparent({ taskId: 'c', parentId: 'mid', lookup })
  assert(r.ok, 'depth >1 allowed')
}

console.log('OK — reparent-validation tests passed')
