import { useState, useEffect, useCallback } from 'react'
import { Monitor, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { PtyInfo } from '../../../../../shared/types/api'
import type { Task } from '../../../../../shared/types/database'

interface TerminalStatusPopoverProps {
  tasks: Task[]
}

export function TerminalStatusPopover({ tasks }: TerminalStatusPopoverProps) {
  const [ptys, setPtys] = useState<PtyInfo[]>([])
  const [open, setOpen] = useState(false)

  const refreshPtys = useCallback(async () => {
    const list = await window.api.pty.list()
    setPtys(list)
  }, [])

  // Refresh list when popover opens
  useEffect(() => {
    if (open) {
      refreshPtys()
      // Refresh every 5 seconds while open
      const interval = setInterval(refreshPtys, 5000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [open, refreshPtys])

  // Also refresh on idle events
  useEffect(() => {
    const unsub = window.api.pty.onIdle(() => {
      refreshPtys()
    })
    return unsub
  }, [refreshPtys])

  // Initial load
  useEffect(() => {
    refreshPtys()
  }, [refreshPtys])

  const handleTerminate = async (taskId: string) => {
    await window.api.pty.kill(taskId)
    refreshPtys()
  }

  const getTaskName = (taskId: string): string => {
    const task = tasks.find((t) => t.id === taskId)
    return task?.title || 'Unknown Task'
  }

  const formatIdleTime = (lastOutputTime: number): string => {
    const seconds = Math.floor((Date.now() - lastOutputTime) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  const count = ptys.length

  if (count === 0) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-lg"
              className="rounded-lg text-muted-foreground relative"
            >
              <Monitor className="size-5" />
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {count}
              </span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">Active Terminals</TooltipContent>
      </Tooltip>
      <PopoverContent side="right" align="end" className="w-80">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Active Terminals</h4>
            <span className="text-xs text-muted-foreground">{count} running</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {ptys.map((pty) => (
              <div
                key={pty.taskId}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-sm font-medium truncate">{getTaskName(pty.taskId)}</p>
                  <p className="text-xs text-muted-foreground">
                    {pty.state === 'idle' ? (
                      <span className="text-amber-500">Idle</span>
                    ) : pty.state === 'error' ? (
                      <span className="text-red-500">Error</span>
                    ) : pty.state === 'awaiting_input' ? (
                      <span className="text-blue-500">Awaiting Input</span>
                    ) : (
                      <span className="text-green-500">{pty.state === 'starting' ? 'Starting' : 'Active'}</span>
                    )}
                    {' · '}
                    {formatIdleTime(pty.lastOutputTime)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleTerminate(pty.taskId)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
