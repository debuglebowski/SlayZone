import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@slayzone/ui'
import type { TabDisplayMode } from '../shared/types'

export interface ConfirmDisplayModeDialogProps {
  open: boolean
  target: TabDisplayMode
  onConfirm: () => void
  onCancel: () => void
}

const copyByTarget: Record<TabDisplayMode, { title: string; action: string }> = {
  chat: { title: 'Enable chat view?', action: 'Enable' },
  xterm: { title: 'Disable chat view?', action: 'Disable' },
}

const DESCRIPTION =
  'Switching ends the current session in this tab. The conversation id is preserved, so you can resume later. Continue?'

export function ConfirmDisplayModeDialog({
  open,
  target,
  onConfirm,
  onCancel,
}: ConfirmDisplayModeDialogProps) {
  const copy = copyByTarget[target]
  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{DESCRIPTION}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{copy.action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
