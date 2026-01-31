import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, ArrowRight, RotateCw, X } from 'lucide-react'
import { Button, Input, cn } from '@omgslayzone/ui'

// Minimal webview interface for type safety
interface WebviewElement extends HTMLElement {
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  reload(): void
  stop(): void
  loadURL(url: string): void
  getURL(): string
}

interface BrowserPanelProps {
  className?: string
}

export function BrowserPanel({ className }: BrowserPanelProps) {
  const [inputUrl, setInputUrl] = useState('')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const webviewRef = useRef<WebviewElement>(null)

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const handleNavigate = () => {
      setCanGoBack(wv.canGoBack())
      setCanGoForward(wv.canGoForward())
      setInputUrl(wv.getURL())
    }

    const handleStartLoading = () => setIsLoading(true)
    const handleStopLoading = () => setIsLoading(false)

    wv.addEventListener('did-navigate', handleNavigate)
    wv.addEventListener('did-navigate-in-page', handleNavigate)
    wv.addEventListener('did-start-loading', handleStartLoading)
    wv.addEventListener('did-stop-loading', handleStopLoading)

    return () => {
      wv.removeEventListener('did-navigate', handleNavigate)
      wv.removeEventListener('did-navigate-in-page', handleNavigate)
      wv.removeEventListener('did-start-loading', handleStartLoading)
      wv.removeEventListener('did-stop-loading', handleStopLoading)
    }
  }, [])

  const handleNavigate = () => {
    const wv = webviewRef.current
    if (!wv || !inputUrl.trim()) return

    let url = inputUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`
    }
    wv.loadURL(url)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate()
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* URL Bar */}
      <div className="shrink-0 p-2 border-b flex items-center gap-1 bg-background">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!canGoBack}
          onClick={() => webviewRef.current?.goBack()}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!canGoForward}
          onClick={() => webviewRef.current?.goForward()}
        >
          <ArrowRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            if (isLoading) {
              webviewRef.current?.stop()
            } else {
              webviewRef.current?.reload()
            }
          }}
        >
          {isLoading ? <X className="size-4" /> : <RotateCw className="size-4" />}
        </Button>

        <Input
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter URL..."
          className="flex-1 h-7 text-sm"
        />
      </div>

      {/* Webview */}
      <webview
        ref={webviewRef}
        src="about:blank"
        partition="persist:browser-tabs"
        className="flex-1"
        // @ts-expect-error - webview attributes not in React types
        allowpopups="true"
      />
    </div>
  )
}
