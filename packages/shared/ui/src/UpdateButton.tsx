import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip'

interface UpdateButtonProps {
  version: string | null
  onRestart: () => void
}

export function UpdateButton({ version, onRestart }: UpdateButtonProps): React.JSX.Element | null {
  const [restarting, setRestarting] = useState(false)
  if (!version) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => {
            if (restarting) return
            setRestarting(true)
            onRestart()
          }}
          disabled={restarting}
          className="h-7 w-7 flex items-center justify-center text-green-500 hover:text-green-400 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {restarting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {restarting ? `Restarting to install v${version}…` : `Restart to install v${version}`}
      </TooltipContent>
    </Tooltip>
  )
}
