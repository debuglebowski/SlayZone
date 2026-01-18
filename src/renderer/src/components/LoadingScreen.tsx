import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import logo from '@/assets/logo.svg'

export function LoadingScreen(): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion()
  const [version, setVersion] = useState('')
  const [showSecondText, setShowSecondText] = useState(false)

  useEffect(() => {
    window.api.app.getVersion().then(setVersion)
    // Show second text after first animation + pause
    const timer = setTimeout(() => setShowSecondText(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  const containerVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  }

  const logoVariants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: 'easeOut' as const
      }
    }
  }

  const letters = 'Breath...'.split('')
  const letterDelay = shouldReduceMotion ? 0 : 0.1

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-6">
        <motion.div variants={logoVariants} initial="initial" animate="animate">
          <img src={logo} alt="Focus" className="h-16 w-16" />
        </motion.div>
        <div className="flex text-2xl font-semibold text-foreground">
          {letters.map((letter, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.15,
                delay: 0.1 + i * letterDelay,
                ease: 'easeOut'
              }}
            >
              {letter}
            </motion.span>
          ))}
          {showSecondText && (
            <motion.span
              initial={{ clipPath: 'inset(0 100% 0 0)' }}
              animate={{ clipPath: 'inset(0 0% 0 0)' }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="inline-flex"
            >
              &nbsp;&nbsp;&nbsp;then slay
            </motion.span>
          )}
        </div>
        {version && (
          <motion.div
            className="absolute bottom-6 text-xs text-muted-foreground/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 1 }}
          >
            v{version}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
