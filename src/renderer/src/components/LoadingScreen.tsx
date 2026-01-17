import { motion, useReducedMotion } from 'framer-motion'
import logo from '@/assets/logo.svg'

export function LoadingScreen(): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion()

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
        duration: 0.5,
        ease: 'easeOut'
      }
    }
  }

  const logoPulseVariants = shouldReduceMotion
    ? {}
    : {
        animate: {
          scale: [1, 1.05, 1],
          transition: {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }
        }
      }

  const textVariants = {
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        delay: 0.3,
        ease: 'easeOut'
      }
    }
  }

  const dotsVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.6
      }
    }
  }

  const dotVariants = {
    hidden: { opacity: 0, scale: 0.5 },
    visible: {
      opacity: [0, 1, 0],
      scale: [0.5, 1, 0.5],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="flex flex-col items-center gap-6">
        <motion.div
          variants={logoVariants}
          initial="initial"
          animate="animate"
        >
          <motion.img
            src={logo}
            alt="Focus"
            className="h-16 w-16"
            variants={logoPulseVariants}
            animate="animate"
          />
        </motion.div>
        <motion.div
          variants={textVariants}
          initial="initial"
          animate="animate"
          className="text-2xl font-semibold text-foreground"
        >
          Focus
        </motion.div>
        <motion.div
          className="flex gap-2"
          variants={dotsVariants}
          initial="hidden"
          animate="visible"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              variants={dotVariants}
              className="h-2 w-2 rounded-full bg-primary"
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  )
}
