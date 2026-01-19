import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { getTerminal, setTerminal, disposeTerminal } from './terminal-cache'

interface TerminalProps {
  taskId: string
  cwd: string
  sessionId?: string | null
  existingSessionId?: string | null
  onSessionCreated?: (sessionId: string) => void
  onSessionInvalid?: () => void
}

export function Terminal({
  taskId,
  cwd,
  sessionId,
  existingSessionId,
  onSessionCreated,
  onSessionInvalid
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const initializedRef = useRef(false)

  const initTerminal = useCallback(async () => {
    if (!containerRef.current || initializedRef.current) return
    initializedRef.current = true

    // Check if we have a cached terminal for this task
    const cached = getTerminal(taskId)
    if (cached) {
      // Reattach existing terminal
      containerRef.current.appendChild(cached.element)
      terminalRef.current = cached.terminal
      fitAddonRef.current = cached.fitAddon

      // Fit to potentially new container size and focus
      cached.fitAddon.fit()
      cached.terminal.focus()

      // Sync terminal size with PTY
      const { cols, rows } = cached.terminal
      window.api.pty.resize(taskId, cols, rows)
      return
    }

    // Create new terminal
    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#e5e5e5',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#525252',
        black: '#171717',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e5e5e5',
        brightBlack: '#404040',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#fafafa'
      }
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    terminal.open(containerRef.current)
    fitAddon.fit()
    terminal.focus()

    // Check if PTY already exists (e.g., from a previous app session)
    const exists = await window.api.pty.exists(taskId)
    if (exists) {
      // PTY exists - restore terminal history from buffer (fallback)
      const buffer = await window.api.pty.getBuffer(taskId)
      if (buffer) {
        terminal.write(buffer)
      }
    } else {
      // Generate session ID if not provided
      let newSessionId = sessionId
      if (!newSessionId && !existingSessionId) {
        newSessionId = crypto.randomUUID()
        onSessionCreated?.(newSessionId)
      }

      // Create PTY
      const result = await window.api.pty.create(taskId, cwd, newSessionId, existingSessionId)
      if (!result.success) {
        terminal.writeln(`\x1b[31mError: ${result.error}\x1b[0m`)
        return
      }
    }

    // Handle terminal input
    terminal.onData((data) => {
      window.api.pty.write(taskId, data)
    })

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      window.api.pty.resize(taskId, cols, rows)
    })

    // Initial resize
    const { cols, rows } = terminal
    window.api.pty.resize(taskId, cols, rows)
  }, [taskId, cwd, sessionId, existingSessionId, onSessionCreated])

  // Initialize terminal
  useEffect(() => {
    initTerminal()

    return () => {
      // Detach terminal from DOM and cache it (don't dispose)
      if (terminalRef.current && fitAddonRef.current) {
        const element = terminalRef.current.element
        if (element && element.parentNode) {
          element.parentNode.removeChild(element)
          setTerminal(taskId, {
            terminal: terminalRef.current,
            fitAddon: fitAddonRef.current,
            element
          })
        }
      }
      terminalRef.current = null
      fitAddonRef.current = null
      initializedRef.current = false
    }
  }, [initTerminal, taskId])

  // Listen for PTY data
  useEffect(() => {
    const unsubData = window.api.pty.onData((id, data) => {
      if (id === taskId && terminalRef.current) {
        terminalRef.current.write(data)
      }
    })

    const unsubExit = window.api.pty.onExit((id, exitCode) => {
      if (id === taskId && terminalRef.current) {
        terminalRef.current.writeln(`\r\n\x1b[90mProcess exited with code ${exitCode}\x1b[0m`)
      }
    })

    const unsubSessionNotFound = window.api.pty.onSessionNotFound((id) => {
      if (id === taskId) {
        onSessionInvalid?.()
      }
    })

    // Listen for idle events to hibernate the terminal (dispose xterm, keep PTY)
    const unsubIdle = window.api.pty.onIdle((id) => {
      if (id === taskId) {
        // Dispose the cached terminal for this task to free memory
        // The PTY is still running, so we can restore from buffer later
        disposeTerminal(taskId)
        // Clear local refs if they point to the disposed terminal
        terminalRef.current = null
        fitAddonRef.current = null
      }
    })

    return () => {
      unsubData()
      unsubExit()
      unsubSessionNotFound()
      unsubIdle()
    }
  }, [taskId, onSessionInvalid])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      fitAddonRef.current?.fit()
    }

    window.addEventListener('resize', handleResize)
    const observer = new ResizeObserver(handleResize)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      observer.disconnect()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="h-[calc(100%-32px)] w-[calc(100%-32px)] m-4 bg-[#0a0a0a] border border-neutral-800 rounded-lg outline-none overflow-hidden"
      style={{ padding: '8px' }}
      onClick={() => terminalRef.current?.focus()}
    />
  )
}
