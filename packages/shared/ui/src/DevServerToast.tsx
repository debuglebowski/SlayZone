import { motion, AnimatePresence } from 'framer-motion'
import { Globe, X } from 'lucide-react'

interface DevServerToastProps {
  url: string | null
  onOpen: () => void
  onDismiss: () => void
}

export function DevServerToast({ url, onOpen, onDismiss }: DevServerToastProps): React.JSX.Element {
  return (
    <AnimatePresence>
      {url && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 1800, damping: 60 }}
          data-testid="dev-server-toast"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-xl bg-surface-2 border border-border px-5 py-3.5 shadow-2xl"
        >
          <Globe className="size-5 text-blue-500 shrink-0" />
          <span className="text-sm">
            Dev server detected at <code className="font-mono font-medium text-blue-400">{url}</code>
          </span>
          <button
            className="rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3.5 py-1.5 shrink-0 transition-colors"
            onClick={onOpen}
          >
            Open preview
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
