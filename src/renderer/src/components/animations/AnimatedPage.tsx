import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'

interface AnimatedPageProps {
  children: React.ReactNode
  viewKey: string
  direction?: 'forward' | 'backward'
}

const pageVariants = {
  initial: (direction: 'forward' | 'backward') => ({
    opacity: 0,
    x: direction === 'forward' ? 20 : -20
  }),
  animate: {
    opacity: 1,
    x: 0
  },
  exit: (direction: 'forward' | 'backward') => ({
    opacity: 0,
    x: direction === 'forward' ? -20 : 20
  })
}

const pageTransition = {
  type: 'spring' as const,
  stiffness: 9000,
  damping: 240
}

export function AnimatedPage({ children, viewKey, direction = 'forward' }: AnimatedPageProps) {
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    return <>{children}</>
  }

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={viewKey}
        custom={direction}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={pageTransition}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
