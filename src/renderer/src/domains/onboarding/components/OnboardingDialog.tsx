import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface OnboardingStep {
  title: string
  description: string
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome',
    description:
      'A task manager with built-in Claude Code terminal for AI-assisted development.'
  },
  {
    title: 'Projects',
    description:
      'Create projects and set their repository path. Each project maps to a codebase.'
  },
  {
    title: 'Terminal',
    description:
      'Open a task to see a split view with notes on the left and a Claude Code terminal on the right.'
  },
  {
    title: 'Shortcuts',
    description: 'Cmd+N creates a task. Cmd+K searches. Esc goes back.'
  }
]

interface OnboardingDialogProps {
  externalOpen?: boolean
  onExternalClose?: () => void
}

export function OnboardingDialog({
  externalOpen,
  onExternalClose
}: OnboardingDialogProps): React.JSX.Element | null {
  const [autoOpen, setAutoOpen] = useState(false)
  const [step, setStep] = useState(0)

  // Combined open state: either auto-triggered or externally controlled
  const open = autoOpen || (externalOpen ?? false)

  useEffect(() => {
    // Check auto-open on first launch
    window.api.settings.get('onboarding_completed').then((value) => {
      if (value !== 'true') {
        setAutoOpen(true)
      }
    })
  }, [])

  const handleNext = (): void => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(step + 1)
    } else {
      completeOnboarding()
    }
  }

  const handleSkip = (): void => {
    completeOnboarding()
  }

  const completeOnboarding = (): void => {
    window.api.settings.set('onboarding_completed', 'true')
    setStep(0)
    setAutoOpen(false)
    onExternalClose?.()
  }

  if (!open) return null

  const current = ONBOARDING_STEPS[step]

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <div className="text-center py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 1500, damping: 80 }}
            >
              <h2 className="text-xl font-bold mb-3">{current.title}</h2>
              <p className="text-muted-foreground mb-8 px-4">{current.description}</p>
            </motion.div>
          </AnimatePresence>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mb-6">
            {ONBOARDING_STEPS.map((_, i) => (
              <motion.div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  i === step ? 'bg-primary' : 'bg-muted'
                )}
                initial={false}
                animate={{
                  scale: i === step ? 1.2 : 1,
                  opacity: i === step ? 1 : 0.5
                }}
                transition={{ duration: 0.2 }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3">
            {step < ONBOARDING_STEPS.length - 1 && (
              <Button variant="ghost" onClick={handleSkip}>
                Skip
              </Button>
            )}
            <Button onClick={handleNext}>
              {step < ONBOARDING_STEPS.length - 1 ? 'Next' : 'Get Started'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
