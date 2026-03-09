import { useState, useCallback } from 'react'
import { ChevronDown, Loader2, ArrowUp, ArrowDown, Copy, Download, Upload, ExternalLink } from 'lucide-react'
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  toast
} from '@slayzone/ui'
import type { AheadBehind } from '../shared/types'

interface RemoteSectionProps {
  remoteUrl: string
  upstreamAB: AheadBehind | null
  targetPath: string
  branch: string | null
  onSyncDone: () => void
}

export function RemoteSection({ remoteUrl, upstreamAB, targetPath, branch, onSyncDone }: RemoteSectionProps) {
  const [pushing, setPushing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [pushMenuOpen, setPushMenuOpen] = useState(false)
  const [forcePushConfirmOpen, setForcePushConfirmOpen] = useState(false)

  const handlePush = useCallback(async (force?: boolean) => {
    setPushing(true)
    setPushMenuOpen(false)
    setForcePushConfirmOpen(false)
    try {
      const result = await window.api.git.push(targetPath, branch ?? undefined, force)
      if (!result.success) {
        toast(result.error ?? 'Push failed')
      } else {
        toast(force ? 'Force pushed' : 'Pushed')
        onSyncDone()
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Push failed')
    } finally {
      setPushing(false)
    }
  }, [targetPath, branch, onSyncDone])

  const handlePull = useCallback(async () => {
    setPulling(true)
    try {
      const result = await window.api.git.pull(targetPath)
      if (!result.success) {
        toast(result.error ?? 'Pull failed')
      } else {
        toast('Pulled')
        onSyncDone()
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Pull failed')
    } finally {
      setPulling(false)
    }
  }, [targetPath, onSyncDone])

  return (
    <>
      <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
        <div className="flex items-start gap-2">
          {/* Left: URL + ahead/behind */}
          <div className="flex-1 min-w-0 space-y-1">
            <button
              onClick={() => { navigator.clipboard.writeText(remoteUrl); toast('Remote URL copied') }}
              className="flex items-center gap-2 w-full text-left group"
              title="Click to copy"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-mono text-muted-foreground truncate flex-1">
                {remoteUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '')}
              </span>
              <Copy className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {upstreamAB && (upstreamAB.ahead > 0 || upstreamAB.behind > 0) && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground pl-5.5">
                {upstreamAB.ahead > 0 && (
                  <span className="flex items-center gap-1">
                    <ArrowUp className="h-3 w-3" /> {upstreamAB.ahead} ahead
                  </span>
                )}
                {upstreamAB.behind > 0 && (
                  <span className="flex items-center gap-1">
                    <ArrowDown className="h-3 w-3" /> {upstreamAB.behind} behind
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Push / Pull buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePull}
              disabled={pulling || pushing}
              className="gap-1 h-7 px-2"
            >
              {pulling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Pull
            </Button>
            <div className="flex">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePush(false)}
                disabled={pushing || pulling}
                className="gap-1 h-7 px-2 rounded-r-none border-r-0"
              >
                {pushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Push
              </Button>
              <Popover open={pushMenuOpen} onOpenChange={setPushMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pushing || pulling}
                    className="px-1 h-7 rounded-l-none"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-40 p-1">
                  <button
                    onClick={() => { setPushMenuOpen(false); setForcePushConfirmOpen(true) }}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-muted rounded transition-colors text-left text-destructive"
                  >
                    Force Push
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={forcePushConfirmOpen} onOpenChange={setForcePushConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force Push</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the remote branch history using --force-with-lease. This can cause others to lose work if they've pushed to this branch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handlePush(true)}>Force Push</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
