import { useRef, useEffect, useCallback, useState } from 'react'
import { RotateCw, X, Globe } from 'lucide-react'
import { Button } from '@slayzone/ui'

interface WebviewElement extends HTMLElement {
  reload(): void
  stop(): void
  getURL(): string
}

interface WebPanelViewProps {
  panelId: string
  url: string
  name: string
  onUrlChange: (panelId: string, url: string) => void
  onFaviconChange?: (panelId: string, favicon: string) => void
  isResizing?: boolean
}

export function WebPanelView({ panelId, url, name, onUrlChange, onFaviconChange, isResizing }: WebPanelViewProps) {
  const webviewRef = useRef<WebviewElement>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleNavigate = useCallback(() => {
    const wv = webviewRef.current
    if (!wv) return
    onUrlChange(panelId, wv.getURL())
  }, [panelId, onUrlChange])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onStartLoading = () => setIsLoading(true)
    const onStopLoading = () => setIsLoading(false)

    const onFavicon = (e: Event) => {
      const favicons = (e as CustomEvent).detail?.favicons as string[] | undefined
      if (favicons?.[0] && onFaviconChange) {
        onFaviconChange(panelId, favicons[0])
      }
    }

    wv.addEventListener('did-navigate', handleNavigate)
    wv.addEventListener('did-navigate-in-page', handleNavigate)
    wv.addEventListener('did-start-loading', onStartLoading)
    wv.addEventListener('did-stop-loading', onStopLoading)
    wv.addEventListener('page-favicon-updated', onFavicon)

    return () => {
      wv.removeEventListener('did-navigate', handleNavigate)
      wv.removeEventListener('did-navigate-in-page', handleNavigate)
      wv.removeEventListener('did-start-loading', onStartLoading)
      wv.removeEventListener('did-stop-loading', onStopLoading)
      wv.removeEventListener('page-favicon-updated', onFavicon)
    }
  }, [handleNavigate, panelId, onFaviconChange])

  return (
    <div className="flex flex-col h-full">
      {/* Header — h-10 matches Terminal/Browser/Editor tab bars */}
      <div className="shrink-0 flex items-center h-10 px-2 gap-1.5 border-b border-border">
        <Globe className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground flex-1">{name}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            const wv = webviewRef.current
            if (!wv) return
            if (isLoading) wv.stop()
            else wv.reload()
          }}
        >
          {isLoading ? <X className="size-3.5" /> : <RotateCw className="size-3.5" />}
        </Button>
      </div>

      {/* Webview */}
      <div className="relative flex-1">
        <webview
          ref={webviewRef}
          src={url}
          partition="persist:web-panels"
          className="absolute inset-0"
          // @ts-expect-error - webview attributes not in React types
          allowpopups="true"
        />
        {isResizing && <div className="absolute inset-0 z-10" />}
      </div>
    </div>
  )
}
