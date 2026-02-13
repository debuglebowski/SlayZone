import { test, expect, seed, goHome, clickProject, TEST_PROJECT_PATH } from './fixtures/electron'

let mcpUrl = ''

/** Parse SSE or JSON response text into JSON-RPC messages. */
function parseResponse(text: string): any[] {
  // SSE format: "event: message\ndata: {...}\n\n"
  if (text.includes('event:')) {
    return [...text.matchAll(/^data: (.+)$/gm)].map(([, json]) => JSON.parse(json))
  }
  // Plain JSON (one per line)
  return text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

/** Send a JSON-RPC request to the MCP server. */
async function mcpRequest(
  method: string,
  params: Record<string, unknown> = {},
  sessionId?: string
): Promise<{ body: any; sessionId: string | null }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  }
  if (sessionId) headers['mcp-session-id'] = sessionId

  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    })
  })

  const text = await res.text()
  const messages = parseResponse(text)
  const body = messages.find((m: any) => m.id === 1) ?? messages[0]
  return { body, sessionId: res.headers.get('mcp-session-id') }
}

/** Initialize an MCP session. Returns the session ID. */
async function mcpInit(): Promise<string> {
  const { body, sessionId } = await mcpRequest('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'slayzone-e2e', version: '1.0.0' }
  })
  expect(body.result).toBeTruthy()
  expect(sessionId).toBeTruthy()

  // Send initialized notification
  await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'mcp-session-id': sessionId!
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })
  })

  return sessionId!
}

test.describe('MCP Server', () => {
  let projectId: string
  let taskId: string

  test.beforeAll(async ({ mainWindow, electronApp }) => {
    // Discover the dynamic MCP port from the main process
    const port = await electronApp.evaluate(async () => {
      // Wait for MCP server to start (port 0 = random)
      for (let i = 0; i < 20; i++) {
        const p = (globalThis as any).__mcpPort
        if (p) return p as number
        await new Promise((r) => setTimeout(r, 250))
      }
      return null
    })
    expect(port).toBeTruthy()
    mcpUrl = `http://127.0.0.1:${port}/mcp`

    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'MC Test', color: '#ff6b6b', path: TEST_PROJECT_PATH })
    projectId = p.id
    const t = await s.createTask({ projectId, title: 'MCP target', status: 'todo' })
    taskId = t.id
    await s.refreshData()
    await goHome(mainWindow)
    await clickProject(mainWindow, 'MC')
  })

  test('server accepts initialize handshake', async () => {
    const sid = await mcpInit()
    expect(sid).toBeTruthy()
  })

  test('lists update_task tool', async () => {
    const sid = await mcpInit()
    const { body } = await mcpRequest('tools/list', {}, sid)
    const tools = body.result?.tools ?? []
    const names = tools.map((t: any) => t.name)
    expect(names).toContain('update_task')
  })

  test('update task title via MCP', async ({ mainWindow }) => {
    const sid = await mcpInit()
    const { body } = await mcpRequest('tools/call', {
      name: 'update_task',
      arguments: { task_id: taskId, title: 'Updated by MCP' }
    }, sid)

    // Tool returns updated task JSON
    expect(body.result).toBeTruthy()
    const content = body.result.content[0]
    expect(content.type).toBe('text')
    const updated = JSON.parse(content.text)
    expect(updated.title).toBe('Updated by MCP')

    // Verify DB was updated
    const dbTask = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(dbTask.title).toBe('Updated by MCP')

    // Verify UI refreshed (MCP sends tasks:changed IPC)
    await expect(mainWindow.getByText('Updated by MCP')).toBeVisible({ timeout: 5_000 })
  })

  test('update task status via MCP', async ({ mainWindow }) => {
    const sid = await mcpInit()
    const { body } = await mcpRequest('tools/call', {
      name: 'update_task',
      arguments: { task_id: taskId, status: 'in_progress' }
    }, sid)

    const updated = JSON.parse(body.result.content[0].text)
    expect(updated.status).toBe('in_progress')

    // Verify on kanban — task should appear in In Progress column
    await expect(
      mainWindow.locator('h3').getByText('In Progress', { exact: true })
    ).toBeVisible({ timeout: 5_000 })
  })

  test('returns error for nonexistent task', async () => {
    const sid = await mcpInit()
    const { body } = await mcpRequest('tools/call', {
      name: 'update_task',
      arguments: { task_id: 'nonexistent-id', title: 'Nope' }
    }, sid)

    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain('not found')
  })

  test('update multiple fields at once', async ({ mainWindow }) => {
    const sid = await mcpInit()
    const { body } = await mcpRequest('tools/call', {
      name: 'update_task',
      arguments: {
        task_id: taskId,
        title: 'Multi-update',
        status: 'review',
        priority: 1
      }
    }, sid)

    const updated = JSON.parse(body.result.content[0].text)
    expect(updated.title).toBe('Multi-update')
    expect(updated.status).toBe('review')
    expect(updated.priority).toBe(1)

    const dbTask = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(dbTask.title).toBe('Multi-update')
    expect(dbTask.status).toBe('review')
    expect(dbTask.priority).toBe(1)
  })

  test('set and clear nullable fields', async ({ mainWindow }) => {
    const sid = await mcpInit()

    // Set description and due_date
    const { body: setBody } = await mcpRequest('tools/call', {
      name: 'update_task',
      arguments: {
        task_id: taskId,
        description: 'A description from MCP',
        due_date: '2026-06-01'
      }
    }, sid)
    const after = JSON.parse(setBody.result.content[0].text)
    expect(after.description).toBe('A description from MCP')
    expect(after.due_date).toBe('2026-06-01')

    // Clear them by setting to null
    const { body: clearBody } = await mcpRequest('tools/call', {
      name: 'update_task',
      arguments: {
        task_id: taskId,
        description: null,
        due_date: null
      }
    }, sid)
    const cleared = JSON.parse(clearBody.result.content[0].text)
    expect(cleared.description).toBeNull()
    expect(cleared.due_date).toBeNull()

    // Verify DB
    const dbTask = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(dbTask.description).toBeNull()
    expect(dbTask.due_date).toBeNull()
  })

  test('rejects invalid status value', async () => {
    const sid = await mcpInit()
    const { body } = await mcpRequest('tools/call', {
      name: 'update_task',
      arguments: { task_id: taskId, status: 'yolo' }
    }, sid)

    // Schema validation should reject — returns error
    expect(body.result.isError ?? body.error).toBeTruthy()
  })

  test('rejects out-of-range priority', async () => {
    const sid = await mcpInit()
    const { body } = await mcpRequest('tools/call', {
      name: 'update_task',
      arguments: { task_id: taskId, priority: 99 }
    }, sid)

    expect(body.result?.isError ?? body.error).toBeTruthy()
  })

  test('concurrent sessions update different tasks', async ({ mainWindow }) => {
    const s = seed(mainWindow)
    const t2 = await s.createTask({ projectId, title: 'Concurrent target', status: 'backlog' })
    await s.refreshData()

    // Two independent sessions
    const [sid1, sid2] = await Promise.all([mcpInit(), mcpInit()])
    expect(sid1).not.toBe(sid2)

    // Update different tasks simultaneously
    const [res1, res2] = await Promise.all([
      mcpRequest('tools/call', {
        name: 'update_task',
        arguments: { task_id: taskId, title: 'From session 1' }
      }, sid1),
      mcpRequest('tools/call', {
        name: 'update_task',
        arguments: { task_id: t2.id, title: 'From session 2' }
      }, sid2)
    ])

    const u1 = JSON.parse(res1.body.result.content[0].text)
    const u2 = JSON.parse(res2.body.result.content[0].text)
    expect(u1.title).toBe('From session 1')
    expect(u2.title).toBe('From session 2')

    // Verify both in DB
    const [db1, db2] = await Promise.all([
      mainWindow.evaluate((id) => window.api.db.getTask(id), taskId),
      mainWindow.evaluate((id) => window.api.db.getTask(id), t2.id)
    ])
    expect(db1.title).toBe('From session 1')
    expect(db2.title).toBe('From session 2')
  })
})
