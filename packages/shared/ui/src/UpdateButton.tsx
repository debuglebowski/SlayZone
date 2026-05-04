import { Download } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip'

interface UpdateButtonProps {
  version: string | null
  onRestart: () => void
}

export function UpdateButton({ version, onRestart }: UpdateButtonProps): React.JSX.Element | null {
  if (!version) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onRestart}
          className="h-7 w-7 flex items-center justify-center text-green-500 hover:text-green-400 transition-colors"
        >
          <Download className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        Restart to install v{version}
      </TooltipContent>
    </Tooltip>
  )
}
