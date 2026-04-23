import { useEffect, useState } from 'react'
import { cn, getTerminalStateStyle, Tooltip, TooltipContent, TooltipTrigger } from '@slayzone/ui'
import type { TerminalState } from '../shared/types'
import { usePty } from './PtyContext'

export function PtyStateDot({ sessionId }: { sessionId: string }): React.JSX.Element | null {
  const { getState, subscribeState } = usePty()
  const [state, setState] = useState<TerminalState>(() => getState(sessionId))
  useEffect(() => {
    setState(getState(sessionId))
    return subscribeState(sessionId, (next) => setState(next))
  }, [sessionId, getState, subscribeState])
  const style = getTerminalStateStyle(state)
  if (!style) return <span className="shrink-0 size-2" aria-hidden />
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('shrink-0 size-2 rounded-full', style.color)} aria-label={`Terminal: ${style.label}`} />
      </TooltipTrigger>
      <TooltipContent>Terminal: {style.label}</TooltipContent>
    </Tooltip>
  )
}
