import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RotateCw, ArrowLeft, ArrowRight } from 'lucide-react'

interface Props {
  url: string
  onUrlChange: (url: string) => void
  onTitleChange?: (title: string) => void
  onFaviconChange?: (favicon: string) => void
}

export function BrowserView({ url, onUrlChange, onTitleChange, onFaviconChange }: Props) {
  const [inputUrl, setInputUrl] = useState(url)
  const webviewRef = useRef<Electron.WebviewTag>(null)

  // Sync input when url prop changes
  useEffect(() => {
    setInputUrl(url)
  }, [url])

  // Handle webview navigation events
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleNavigate = (e: Electron.DidNavigateEvent) => {
      setInputUrl(e.url)
      if (e.url !== url) onUrlChange(e.url)
    }

    webview.addEventListener('did-navigate', handleNavigate)
    webview.addEventListener('did-navigate-in-page', handleNavigate as any)
    return () => {
      webview.removeEventListener('did-navigate', handleNavigate)
      webview.removeEventListener('did-navigate-in-page', handleNavigate as any)
    }
  }, [url, onUrlChange])

  // Handle page title updates
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview || !onTitleChange) return

    const handleTitleUpdate = (e: Electron.PageTitleUpdatedEvent) => {
      onTitleChange(e.title)
    }

    webview.addEventListener('page-title-updated', handleTitleUpdate)
    return () => {
      webview.removeEventListener('page-title-updated', handleTitleUpdate)
    }
  }, [onTitleChange])

  // Handle page favicon updates
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview || !onFaviconChange) return

    const handleFaviconUpdate = (e: Electron.PageFaviconUpdatedEvent) => {
      if (e.favicons.length > 0) {
        onFaviconChange(e.favicons[0])
      }
    }

    webview.addEventListener('page-favicon-updated', handleFaviconUpdate)
    return () => {
      webview.removeEventListener('page-favicon-updated', handleFaviconUpdate)
    }
  }, [onFaviconChange])

  // Register webview for shortcut interception
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const onReady = () => {
      const id = (webview as any).getWebContentsId?.()
      if (id) window.api.webview.registerShortcuts(id)
    }

    webview.addEventListener('dom-ready', onReady)
    return () => webview.removeEventListener('dom-ready', onReady)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      let newUrl = inputUrl.trim()
      // Add https:// if missing protocol
      if (newUrl && !newUrl.match(/^https?:\/\//)) {
        newUrl = 'https://' + newUrl
      }
      if (newUrl && newUrl !== url) {
        onUrlChange(newUrl)
      }
    }
  }

  const handleRefresh = () => {
    webviewRef.current?.reload()
  }

  const handleBack = () => {
    webviewRef.current?.goBack()
  }

  const handleForward = () => {
    webviewRef.current?.goForward()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Address bar */}
      <div className="flex items-center gap-2 p-2 border-b">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleForward}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh}>
          <RotateCw className="h-4 w-4" />
        </Button>
        <Input
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 h-8 text-sm"
          placeholder="Enter URL..."
        />
      </div>
      {/* Webview */}
      <div className="flex-1 min-h-0">
        <webview
          ref={webviewRef}
          src={url}
          partition="persist:browser-tabs"
          allowpopups="true"
          className="w-full h-full"
          style={{ display: 'inline-flex' }}
        />
      </div>
    </div>
  )
}
