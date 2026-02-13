import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import type { Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { BrowserWindow } from 'electron'
import { z } from 'zod'
import type { Database } from 'better-sqlite3'
import { updateTask } from '@slayzone/task/main'
import { TASK_STATUSES } from '@slayzone/task/shared'

let httpServer: Server | null = null
let idleTimer: NodeJS.Timeout | null = null
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000 // 30 min
const IDLE_CHECK_INTERVAL = 5 * 60 * 1000 // 5 min

function notifyRenderer(): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      try { win.webContents.send('tasks:changed') } catch { /* destroyed */ }
    }
  })
}

function createMcpServer(db: Database): McpServer {
  const server = new McpServer({
    name: 'slayzone',
    version: '1.0.0'
  })

  server.tool(
    'update_task',
    'Update a task\'s details (title, description, status, priority, assignee, due date). Your task ID is available in the SLAYZONE_TASK_ID environment variable.',
    {
      task_id: z.string().describe('The task ID to update (read from $SLAYZONE_TASK_ID env var)'),
      title: z.string().optional().describe('New title'),
      description: z.string().nullable().optional().describe('New description (null to clear)'),
      status: z.enum(TASK_STATUSES).optional().describe('New status'),
      priority: z.number().min(1).max(5).optional().describe('Priority 1-5 (1=highest)'),
      assignee: z.string().nullable().optional().describe('Assignee name (null to clear)'),
      due_date: z.string().nullable().optional().describe('Due date ISO string (null to clear)')
    },
    async ({ task_id, due_date, ...fields }) => {
      const updated = updateTask(db, { id: task_id, ...fields, dueDate: due_date })
      if (!updated) {
        return { content: [{ type: 'text' as const, text: `Task ${task_id} not found` }], isError: true }
      }
      notifyRenderer()
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(updated, null, 2)
        }]
      }
    }
  )

  return server
}

export function stopMcpServer(): void {
  if (idleTimer) { clearInterval(idleTimer); idleTimer = null }
  if (httpServer) { httpServer.close(); httpServer = null }
}

export function startMcpServer(db: Database, port: number): void {
  const app = express()
  app.use(express.json())

  const transports = new Map<string, StreamableHTTPServerTransport>()
  const sessionActivity = new Map<string, number>()

  function touchSession(sid: string): void {
    sessionActivity.set(sid, Date.now())
  }

  function removeSession(sid: string): void {
    transports.delete(sid)
    sessionActivity.delete(sid)
  }

  // Evict sessions idle > 30 min
  idleTimer = setInterval(() => {
    const now = Date.now()
    for (const [sid, lastActive] of sessionActivity) {
      if (now - lastActive > SESSION_IDLE_TIMEOUT) {
        try { transports.get(sid)?.close() } catch { /* already closed */ }
        removeSession(sid)
      }
    }
  }, IDLE_CHECK_INTERVAL)

  app.post('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined

      if (sessionId && transports.has(sessionId)) {
        touchSession(sessionId)
        const transport = transports.get(sessionId)!
        await transport.handleRequest(req, res, req.body)
        return
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const mcpServer = createMcpServer(db)
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports.set(sid, transport)
            touchSession(sid)
          }
        })

        transport.onclose = () => {
          const sid = [...transports.entries()].find(([, t]) => t === transport)?.[0]
          if (sid) removeSession(sid)
        }

        await mcpServer.connect(transport)
        await transport.handleRequest(req, res, req.body)
        return
      }

      res.status(400).json({ error: 'Invalid request — missing session or not an initialize request' })
    } catch (err) {
      console.error('[MCP] POST error:', err)
      if (!res.headersSent) res.status(500).json({ error: 'Internal error' })
    }
  })

  app.get('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      if (sessionId && transports.has(sessionId)) {
        touchSession(sessionId)
        const transport = transports.get(sessionId)!
        await transport.handleRequest(req, res)
        return
      }
      res.status(400).json({ error: 'Invalid session' })
    } catch (err) {
      console.error('[MCP] GET error:', err)
      if (!res.headersSent) res.status(500).json({ error: 'Internal error' })
    }
  })

  app.delete('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!
        await transport.handleRequest(req, res)
        removeSession(sessionId)
        return
      }
      res.status(400).json({ error: 'Invalid session' })
    } catch (err) {
      console.error('[MCP] DELETE error:', err)
      if (!res.headersSent) res.status(500).json({ error: 'Internal error' })
    }
  })

  httpServer = app.listen(port, '127.0.0.1', () => {
    const addr = httpServer!.address()
    const actualPort = typeof addr === 'object' && addr ? addr.port : port
    ;(globalThis as Record<string, unknown>).__mcpPort = actualPort
    console.log(`[MCP] Server listening on http://127.0.0.1:${actualPort}/mcp`)
  })
}
