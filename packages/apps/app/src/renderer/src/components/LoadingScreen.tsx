import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import logo from '@/assets/logo-solid.svg'

export function LoadingScreen(): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion()
  const [version, setVersion] = useState('')
  const [showSecondText, setShowSecondText] = useState(false)

  useEffect(() => {
    window.api.app.getVersion().then(setVersion)
    // Show second text after first animation + pause
    const timer = setTimeout(() => setShowSecondText(true), 450)
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
        duration: 0.15,
        ease: 'easeOut' as const
      }
    }
  }

  const letters = 'Breath...'.split('')
  const letterDelay = shouldReduceMotion ? 0 : 0.05
  const blobTransition = shouldReduceMotion
    ? undefined
    : { duration: 6, repeat: Infinity, repeatType: 'mirror' as const, ease: 'easeInOut' as const }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(900px circle at 20% 10%, rgba(255, 60, 172, 0.35), transparent 60%),' +
            'radial-gradient(800px circle at 80% 20%, rgba(0, 229, 255, 0.3), transparent 55%),' +
            'radial-gradient(700px circle at 50% 90%, rgba(57, 255, 20, 0.25), transparent 60%),' +
            'linear-gradient(180deg, rgba(8, 8, 8, 1), rgba(8, 8, 8, 1))'
        }}
      />
      <motion.div
        className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#FF3CAC]/40 blur-3xl"
        animate={shouldReduceMotion ? undefined : { x: [0, 40, -20], y: [0, -30, 10] }}
        transition={blobTransition}
      />
      <motion.div
        className="absolute -right-24 top-8 h-80 w-80 rounded-full bg-[#00E5FF]/35 blur-3xl"
        animate={shouldReduceMotion ? undefined : { x: [0, -30, 20], y: [0, 20, -10] }}
        transition={blobTransition}
      />
      <motion.div
        className="absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-[#FFD500]/30 blur-3xl"
        animate={shouldReduceMotion ? undefined : { x: [0, 20, -30], y: [0, 30, -20] }}
        transition={blobTransition}
      />
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-6">
        <motion.div variants={logoVariants} initial="initial" animate="animate">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{
              background:
                'linear-gradient(145deg, rgba(6,6,10,0.95), rgba(18,18,28,0.9)), radial-gradient(60% 60% at 20% 20%, rgba(255,60,172,0.25), transparent 60%)'
            }}
          >
            <img src={logo} alt="Focus" className="h-14 w-14" />
          </div>
        </motion.div>
        <div className="flex text-2xl font-semibold text-foreground">
          {letters.map((letter, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.1,
                delay: 0.05 + i * letterDelay,
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
              transition={{ duration: 0.25, ease: 'easeOut' }}
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
            transition={{ duration: 0.15, delay: 0.3 }}
          >
            v{version}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
