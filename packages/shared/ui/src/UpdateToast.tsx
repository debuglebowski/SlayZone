import { motion, AnimatePresence } from 'framer-motion'
import { Download, X } from 'lucide-react'

interface UpdateToastProps {
  version: string | null
  onRestart: () => void
  onDismiss: () => void
}

export function UpdateToast({ version, onRestart, onDismiss }: UpdateToastProps): React.JSX.Element {
  return (
    <AnimatePresence>
      {version && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 1800, damping: 60 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-xl bg-surface-2 border border-border px-5 py-3.5 shadow-2xl"
        >
          <Download className="size-5 text-green-500 shrink-0" />
          <span className="text-sm">
            Update <code className="font-mono font-medium text-green-400">v{version}</code> ready
          </span>
          <button
            className="rounded-md bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-3.5 py-1.5 shrink-0 transition-colors"
            onClick={onRestart}
          >
            Restart
          </button>
          <button
            className="text-muted-foreground hover:text-foreground shrink-0 p-1"
            onClick={onDismiss}
          >
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
