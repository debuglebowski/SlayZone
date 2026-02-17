import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

interface SuccessToastProps {
  message: string
  show: boolean
  onComplete?: () => void
}

export function SuccessToast({ message, show, onComplete }: SuccessToastProps): React.JSX.Element {
  return (
    <AnimatePresence onExitComplete={onComplete}>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 1800, damping: 60 }}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-3 shadow-lg"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.017, type: 'spring', stiffness: 2100, damping: 50 }}
          >
            <CheckCircle2 className="size-5" />
          </motion.div>
          <span className="text-sm font-medium">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
