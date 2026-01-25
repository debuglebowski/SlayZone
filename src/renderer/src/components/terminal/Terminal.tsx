import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SerializeAddon } from '@xterm/addon-serialize'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import { getTerminal, setTerminal, disposeTerminal } from './terminal-cache'
import { usePty } from '../../contexts/PtyContext'
import type { TerminalMode } from '../../../../shared/types/api'

// Wait for container to have non-zero dimensions before opening terminal
function waitForDimensions(
  container: HTMLElement,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already has dimensions? Resolve immediately
    const rect = container.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      resolve()
      return
    }

    // Otherwise wait for ResizeObserver
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        observer.disconnect()
        resolve()
      }
    })

    // Handle abort (component unmount)
    const onAbort = (): void => {
      observer.disconnect()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort)

    observer.observe(container)
  })
}

// Check if a dialog is open (don't steal focus from dialogs)
function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null
}

interface TerminalProps {
  taskId: string
  cwd: string
  mode?: TerminalMode
  sessionId?: string | null
  existingSessionId?: string | null
  initialPrompt?: string | null
  onSessionCreated?: (sessionId: string) => void
  onSessionInvalid?: () => void
  onReady?: (sendInput: (text: string) => Promise<void>) => void
}

export function Terminal({
  taskId,
  cwd,
  mode = 'claude-code',
  sessionId,
  existingSessionId,
  initialPrompt,
  onSessionCreated,
  onSessionInvalid,
  onReady
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const serializeAddonRef = useRef<SerializeAddon | null>(null)
  const initializedRef = useRef(false)

  const { subscribe, subscribeExit, subscribeSessionInvalid, subscribeIdle, getBuffer, clearBuffer, resetTaskState, clearIgnore } = usePty()

  const initTerminal = useCallback(async (signal: AbortSignal) => {
    if (!containerRef.current || initializedRef.current) return

    // Wait for container to have dimensions BEFORE initializing terminal
    try {
      await waitForDimensions(containerRef.current, signal)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      throw e
    }

    // Re-check after await (component state might have changed)
    if (!containerRef.current || initializedRef.current || signal.aborted) return
    initializedRef.current = true

    // Check if we have a cached terminal for this task
    const cached = getTerminal(taskId)
    if (cached) {
      // If mode changed, dispose cached terminal and kill old PTY to start fresh
      if (cached.mode !== mode) {
        // Reset state FIRST to ignore any in-flight data
        resetTaskState(taskId)
        disposeTerminal(taskId)
        // Kill old PTY (any data it sends will be ignored)
        await window.api.pty.kill(taskId)
      } else {
        // Reattach existing terminal (container already has dimensions)
        containerRef.current.appendChild(cached.element)
        terminalRef.current = cached.terminal
        fitAddonRef.current = cached.fitAddon
        serializeAddonRef.current = cached.serializeAddon

        // Simple fit - container is guaranteed to have dimensions
        cached.fitAddon.fit()
        if (!isDialogOpen()) cached.terminal.focus()
        window.api.pty.resize(taskId, cached.terminal.cols, cached.terminal.rows)

        // Expose sendInput for programmatic input (char-by-char for Ink compatibility)
        onReady?.(async (text) => {
          for (const char of text) {
            cached.terminal.input(char)
            await new Promise(r => setTimeout(r, 1))
          }
        })
        return
      }
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
    const serializeAddon = new SerializeAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.loadAddon(serializeAddon)

    // Try to load WebGL addon for GPU acceleration
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        webglAddon.dispose()
      })
      terminal.loadAddon(webglAddon)
    } catch {
      // WebGL not available, continue with canvas renderer
    }

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    serializeAddonRef.current = serializeAddon

    terminal.open(containerRef.current)
    terminal.clear() // Ensure terminal starts completely fresh
    // Simple fit - container is guaranteed to have dimensions from waitForDimensions
    fitAddon.fit()
    if (!isDialogOpen()) terminal.focus()

    // Let Ctrl+Tab and Ctrl+Shift+Tab bubble up for tab switching
    terminal.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.key === 'Tab') return false
      return true
    })

    // Check if PTY already exists (e.g., from idle hibernation)
    const exists = await window.api.pty.exists(taskId)
    if (exists) {
      // PTY exists - check if we have buffered data from context
      const contextBuffer = getBuffer(taskId)
      if (contextBuffer) {
        terminal.write(contextBuffer)
      } else {
        // Fall back to PTY buffer
        const buffer = await window.api.pty.getBuffer(taskId)
        if (buffer) {
          terminal.write(buffer)
        }
      }
    } else {
      // Clear any stale buffer data before creating new PTY
      // (handles race condition where old PTY sends data while dying)
      clearBuffer(taskId)
      // Clear ignore flag BEFORE creating PTY so we receive its initial output
      // (old PTY was killed 100ms+ ago, stale data has been delivered and ignored)
      clearIgnore(taskId)

      // Generate session ID only for claude-code mode
      let newSessionId = sessionId
      if (mode === 'claude-code' && !newSessionId && !existingSessionId) {
        newSessionId = crypto.randomUUID()
        onSessionCreated?.(newSessionId)
      }

      // Create PTY with selected mode (only pass session IDs for claude-code)
      const effectiveSessionId = mode === 'claude-code' ? newSessionId : undefined
      const effectiveExistingSessionId = mode === 'claude-code' ? existingSessionId : undefined
      const result = await window.api.pty.create(taskId, cwd, effectiveSessionId, effectiveExistingSessionId, mode, initialPrompt)
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

    // Expose sendInput for programmatic input (char-by-char for Ink compatibility)
    onReady?.(async (text) => {
      for (const char of text) {
        terminal.input(char)
        await new Promise(r => setTimeout(r, 1))
      }
    })
  }, [taskId, cwd, mode, sessionId, existingSessionId, initialPrompt, onSessionCreated, onReady, getBuffer, clearBuffer, resetTaskState, clearIgnore])

  // Initialize terminal
  useEffect(() => {
    const controller = new AbortController()
    initTerminal(controller.signal)

    return () => {
      controller.abort()
      // Serialize state before caching
      let serializedState: string | undefined
      if (serializeAddonRef.current && terminalRef.current) {
        try {
          serializedState = serializeAddonRef.current.serialize()
        } catch {
          // Serialize failed, continue without it
        }
      }

      // Detach terminal from DOM and cache it (don't dispose)
      if (terminalRef.current && fitAddonRef.current && serializeAddonRef.current) {
        const element = terminalRef.current.element
        if (element && element.parentNode) {
          element.parentNode.removeChild(element)
          setTerminal(taskId, {
            terminal: terminalRef.current,
            fitAddon: fitAddonRef.current,
            serializeAddon: serializeAddonRef.current,
            element,
            serializedState,
            mode
          })
        }
      }
      terminalRef.current = null
      fitAddonRef.current = null
      serializeAddonRef.current = null
      initializedRef.current = false
    }
  }, [initTerminal, taskId])

  // Subscribe to PTY events via context (survives view switches)
  useEffect(() => {
    const unsubData = subscribe(taskId, (data) => {
      terminalRef.current?.write(data)
    })

    const unsubExit = subscribeExit(taskId, (exitCode) => {
      terminalRef.current?.writeln(`\r\n\x1b[90mProcess exited with code ${exitCode}\x1b[0m`)
    })

    const unsubSessionInvalid = subscribeSessionInvalid(taskId, () => {
      onSessionInvalid?.()
    })

    const unsubIdle = subscribeIdle(taskId, () => {
      // Dispose the cached terminal for this task to free memory
      // The PTY is still running, so we can restore from buffer later
      disposeTerminal(taskId)
      // Clear local refs if they point to the disposed terminal
      terminalRef.current = null
      fitAddonRef.current = null
      serializeAddonRef.current = null
    })

    return () => {
      unsubData()
      unsubExit()
      unsubSessionInvalid()
      unsubIdle()
    }
  }, [taskId, onSessionInvalid, subscribe, subscribeExit, subscribeSessionInvalid, subscribeIdle])

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
