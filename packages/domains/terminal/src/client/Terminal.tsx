import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
// import { WebLinksAddon } from '@xterm/addon-web-links' // Disabled - causes persistent underlines
import { SerializeAddon } from '@xterm/addon-serialize'
// import { WebglAddon } from '@xterm/addon-webgl' // Disabled - bypasses CSS underline fix
import '@xterm/xterm/css/xterm.css'

// Override xterm underline styles - Claude Code outputs these and they persist incorrectly
// This is a definitive fix that works regardless of ANSI code filtering
const underlineOverride = document.createElement('style')
underlineOverride.textContent = `
  .xterm-underline-1, .xterm-underline-2, .xterm-underline-3,
  .xterm-underline-4, .xterm-underline-5 {
    text-decoration: none !important;
  }
`
document.head.appendChild(underlineOverride)

import { getTerminal, setTerminal, disposeTerminal } from './terminal-cache'
import { usePty } from './PtyContext'
import type { TerminalMode, TerminalState, CodeMode } from '@slayzone/terminal/shared'

// Wait for container to have non-zero dimensions before opening terminal
function waitForDimensions(
  container: HTMLElement,
  signal: AbortSignal,
  timeoutMs = 3000
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already has dimensions? Resolve immediately
    const rect = container.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      resolve()
      return
    }

    let settled = false
    const cleanup = () => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      observer.disconnect()
      signal.removeEventListener('abort', onAbort)
    }

    // Timeout to prevent hanging forever
    const timeoutId = setTimeout(() => {
      cleanup()
      resolve()
    }, timeoutMs)

    // Otherwise wait for ResizeObserver
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        cleanup()
        resolve()
      }
    })

    // Handle abort (component unmount)
    const onAbort = (): void => {
      cleanup()
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
  sessionId: string
  cwd: string
  mode?: TerminalMode
  conversationId?: string | null
  existingConversationId?: string | null
  initialPrompt?: string | null
  codeMode?: CodeMode | null
  providerFlags?: string | null
  autoFocus?: boolean
  onConversationCreated?: (conversationId: string) => void
  onSessionInvalid?: () => void
  onReady?: (api: { sendInput: (text: string) => Promise<void>; focus: () => void }) => void
}

export function Terminal({
  sessionId,
  cwd,
  mode = 'claude-code',
  conversationId,
  existingConversationId,
  initialPrompt,
  codeMode,
  providerFlags,
  autoFocus = false,
  onConversationCreated,
  onSessionInvalid,
  onReady
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const serializeAddonRef = useRef<SerializeAddon | null>(null)
  const initializedRef = useRef(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)

  const { subscribe, subscribeExit, subscribeSessionInvalid, subscribeAttention, subscribeState, getState, resetTaskState, cleanupTask } = usePty()

  const [ptyState, setPtyState] = useState<TerminalState>(() => getState(sessionId))

  const initTerminal = useCallback(async (signal: AbortSignal) => {
    if (!containerRef.current || initializedRef.current) return
    setIsInitializing(true)
    setInitError(null)

    try {
      // Wait for container to have dimensions BEFORE initializing terminal
      try {
        await waitForDimensions(containerRef.current, signal)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        throw e
      }

      const rect = containerRef.current.getBoundingClientRect()

      // Re-check after await (component state might have changed)
      if (!containerRef.current || initializedRef.current || signal.aborted) return

      // Don't initialize if container still has 0 dimensions (not visible)
      if (rect.width === 0 || rect.height === 0) {
        return
      }

      initializedRef.current = true

      // Check if we have a cached terminal for this task
      const cached = getTerminal(sessionId)
      if (cached) {
        // If mode changed, dispose cached terminal and kill old PTY to start fresh
        if (cached.mode !== mode) {
          // Reset state FIRST to ignore any in-flight data
          resetTaskState(sessionId)
          disposeTerminal(sessionId)
          // Kill old PTY (any data it sends will be ignored)
          await window.api.pty.kill(sessionId)
        } else {
          // Reattach existing terminal (container already has dimensions)
          containerRef.current.appendChild(cached.element)
          terminalRef.current = cached.terminal
          fitAddonRef.current = cached.fitAddon
          serializeAddonRef.current = cached.serializeAddon

          // Simple fit - container is guaranteed to have dimensions
          cached.fitAddon.fit()
          if (autoFocus && !isDialogOpen()) {
            cached.terminal.focus()
          }
          window.api.pty.resize(sessionId, cached.terminal.cols, cached.terminal.rows)
          cached.terminal.write('\x1b[0m') // Reset ANSI state on reattach

          // Sync state from backend (fixes stuck loading spinner on reattach)
          const actualState = await window.api.pty.getState(sessionId)
          if (signal.aborted) return // Don't setState if unmounted
          if (actualState) setPtyState(actualState)

          // Expose API for programmatic input and focus
          onReady?.({
            sendInput: async (text) => {
              for (const char of text) {
                cached.terminal.input(char)
                await new Promise(r => setTimeout(r, 1))
              }
            },
            focus: () => cached.terminal.focus()
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
      // const webLinksAddon = new WebLinksAddon() // Disabled - causes persistent underlines
      const serializeAddon = new SerializeAddon()

      terminal.loadAddon(fitAddon)
      // terminal.loadAddon(webLinksAddon) // Disabled - causes persistent underlines
      terminal.loadAddon(serializeAddon)

      // WebGL addon DISABLED - renders underlines directly to canvas, bypassing CSS override
      // Canvas 2D renderer uses DOM elements that respect our .xterm-underline-* CSS fix
      // try {
      //   const webglAddon = new WebglAddon()
      //   webglAddon.onContextLoss(() => {
      //     webglAddon.dispose()
      //   })
      //   terminal.loadAddon(webglAddon)
      // } catch {
      //   // WebGL not available, continue with canvas renderer
      // }

      terminalRef.current = terminal
      fitAddonRef.current = fitAddon
      serializeAddonRef.current = serializeAddon

      terminal.open(containerRef.current)
      terminal.clear() // Ensure terminal starts completely fresh
      // Simple fit - container is guaranteed to have dimensions from waitForDimensions
      fitAddon.fit()
      if (autoFocus && !isDialogOpen()) {
        terminal.focus()
      }

      // Let Ctrl+Tab and Ctrl+Shift+Tab bubble up for tab switching
      terminal.attachCustomKeyEventHandler((e) => {
        if (e.ctrlKey && e.key === 'Tab') return false
        return true
      })

      // Check if PTY already exists (e.g., from idle hibernation)
      const exists = await window.api.pty.exists(sessionId)
      if (signal.aborted) return // Don't continue if unmounted
      if (exists) {
        // Sync state from main process (fixes stuck loading spinner)
        const actualState = await window.api.pty.getState(sessionId)
        if (signal.aborted) return // Don't setState if unmounted
        if (actualState) setPtyState(actualState)

        // Restore from backend buffer (single source of truth)
        // Use getBufferSince with -1 to get all chunks
        const result = await window.api.pty.getBufferSince(sessionId, -1)
        if (result && result.chunks.length > 0) {
          terminal.write('\x1b[0m') // Reset ANSI state before buffer replay
          for (const chunk of result.chunks) {
            terminal.write(chunk.data)
          }
          terminal.write('\x1b[0m') // Reset ANSI state after buffer replay
        }
      } else {

        // Generate conversation ID only for claude-code mode
        let newConversationId = conversationId
        if (mode === 'claude-code' && !newConversationId && !existingConversationId) {
          newConversationId = crypto.randomUUID()
          onConversationCreated?.(newConversationId)
        }

        // Create PTY with selected mode (conversation IDs apply to AI modes only)
        // Note: Don't pass initialPrompt - we'll inject it after terminal is ready
        const isAiMode = mode === 'claude-code' || mode === 'codex'
        const effectiveConversationId = isAiMode ? newConversationId : undefined
        const effectiveExistingConversationId = isAiMode ? existingConversationId : undefined
        const result = await window.api.pty.create(sessionId, cwd, effectiveConversationId, effectiveExistingConversationId, mode, null, codeMode, providerFlags)
        if (!result.success) {
          const message = result.error || 'Failed to create terminal process'
          terminal.writeln(`\x1b[31mError: ${message}\x1b[0m`)
          setInitError(message)
          setPtyState('error')
          return
        }
      }

      // Handle terminal input - pass through to PTY
      terminal.onData((data) => {
        window.api.pty.write(sessionId, data)
      })

      // Handle resize
      terminal.onResize(({ cols, rows }) => {
        window.api.pty.resize(sessionId, cols, rows)
      })

      // Initial resize
      const { cols, rows } = terminal
      window.api.pty.resize(sessionId, cols, rows)

      // Helper to inject text char-by-char
      const injectText = async (text: string): Promise<void> => {
        for (const char of text) {
          terminal.input(char)
          await new Promise(r => setTimeout(r, 1))
        }
      }

      // Expose API for programmatic input and focus
      onReady?.({ sendInput: injectText, focus: () => terminal.focus() })

      // Inject initial prompt if provided (after a delay for terminal to be ready)
      if (initialPrompt) {
        setTimeout(async () => {
          if (signal.aborted) return // Don't inject if unmounted
          try {
            // For plan mode, prefix with /plan
            const textToInject = codeMode === 'plan' ? `/plan ${initialPrompt}` : initialPrompt
            await injectText(textToInject)
          } catch {
            // Terminal may have been disposed, ignore
          }
        }, 500)
      }
    } catch (error) {
      if (signal.aborted) return
      const message = error instanceof Error ? error.message : 'Failed to initialize terminal'
      setInitError(message)
      setPtyState('error')
    } finally {
      if (!signal.aborted) {
        setIsInitializing(false)
      }
    }
  }, [sessionId, cwd, mode, conversationId, existingConversationId, initialPrompt, codeMode, providerFlags, autoFocus, onConversationCreated, onReady, resetTaskState])

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
          setTerminal(sessionId, {
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
  }, [initTerminal, sessionId])

  // Subscribe to PTY events via context (survives view switches)
  useEffect(() => {
    const unsubData = subscribe(sessionId, (data, _seq) => {
      // Seq is tracked by PtyContext - just write the data
      terminalRef.current?.write(data)
    })

    const unsubExit = subscribeExit(sessionId, (exitCode) => {
      terminalRef.current?.writeln(`\r\n\x1b[90mProcess exited with code ${exitCode}\x1b[0m`)
      // Clean up cached terminal and context state on exit
      disposeTerminal(sessionId)
      cleanupTask(sessionId)
    })

    const unsubSessionInvalid = subscribeSessionInvalid(sessionId, () => {
      onSessionInvalid?.()
    })

    const unsubAttention = subscribeAttention(sessionId, () => {
      // Hibernation disabled - caused sync loss when returning to tab
      // (terminalRef became null but nothing triggered reinit)
      // Memory tradeoff: ~5-20MB per inactive terminal, worth it for reliability
    })

    return () => {
      unsubData()
      unsubExit()
      unsubSessionInvalid()
      unsubAttention()
    }
  }, [sessionId, onSessionInvalid, subscribe, subscribeExit, subscribeSessionInvalid, subscribeAttention])

  // Subscribe to PTY state changes for loading indicator
  useEffect(() => {
    setPtyState(getState(sessionId))
    return subscribeState(sessionId, (newState) => setPtyState(newState))
  }, [sessionId, getState, subscribeState])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      // Don't fit when container is hidden (0 dimensions from CSS display:none)
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) {
        return
      }

      // If terminal is missing and not currently initializing, reinit
      // DO NOT set initializedRef here - initTerminal manages its own flag
      // (setting it here caused initTerminal to return early at line 118)
      if (!terminalRef.current && !initializedRef.current) {
        const controller = new AbortController()
        initTerminal(controller.signal)
        return
      }

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
  }, [initTerminal])

  // Handle paste and drag-drop for files/images
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Convert File to base64
    const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // Remove data:...;base64, prefix
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    }

    // Insert path into terminal (escape if has spaces)
    const insertPath = (path: string) => {
      const escaped = path.includes(' ') ? `"${path}"` : path
      window.api.pty.write(sessionId, escaped)
    }

    // Process a single file
    const processFile = async (file: File, mimeType?: string): Promise<string | null> => {
      const filePath = (file as File & { path?: string }).path
      if (filePath) {
        return filePath
      } else if (mimeType?.startsWith('image/') || file.type.startsWith('image/')) {
        // Image from clipboard (screenshot, browser copy) - save to temp
        const base64 = await fileToBase64(file)
        const result = await window.api.files.saveTempImage(base64, mimeType || file.type)
        if (result.success && result.path) {
          return result.path
        }
      }
      return null
    }

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const paths: string[] = []

      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (!file) continue

          e.preventDefault()
          const path = await processFile(file, item.type)
          if (path) paths.push(path)
        }
      }

      if (paths.length > 0) {
        insertPath(paths.join(' '))
      }
    }

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = e.dataTransfer?.files
      if (!files?.length) return

      const paths: string[] = []
      for (const file of files) {
        const path = await processFile(file)
        if (path) paths.push(path)
      }

      if (paths.length > 0) {
        insertPath(paths.join(' '))
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
    }

    container.addEventListener('paste', handlePaste)
    container.addEventListener('drop', handleDrop)
    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('dragleave', handleDragLeave)

    return () => {
      container.removeEventListener('paste', handlePaste)
      container.removeEventListener('drop', handleDrop)
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('dragleave', handleDragLeave)
    }
  }, [sessionId])

  const isLoading = !initError && (isInitializing || ptyState === 'starting')

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`relative h-full w-full bg-[#0a0a0a] rounded-lg outline-none overflow-hidden transition-colors ${
        isDragOver ? 'ring-2 ring-blue-500/50 ring-inset' : ''
      }`}
      style={{ padding: '8px' }}
      onClick={() => terminalRef.current?.focus()}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-10">
          <div className="flex items-center gap-2 text-neutral-500">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">Starting terminal...</span>
          </div>
        </div>
      )}
      {initError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-10 p-4">
          <div className="text-red-400 text-sm text-center">Failed to start terminal: {initError}</div>
        </div>
      )}
    </div>
  )
}
