import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent } from '@slayzone/ui'
import { Button } from '@slayzone/ui'
import { cn } from '@slayzone/ui'
import { useTelemetry } from '@slayzone/telemetry/client'
import { Check, BarChart3, Sparkles, SquareTerminal, ChevronLeft } from 'lucide-react'

const STEP_COUNT = 3

const PROVIDERS = [
  { mode: 'claude-code', label: 'Claude Code' },
  { mode: 'codex', label: 'Codex' },
  { mode: 'cursor-agent', label: 'Cursor' },
  { mode: 'gemini', label: 'Gemini' },
  { mode: 'opencode', label: 'OpenCode' }
]

const TRACKED_EVENTS = [
  'App opened (with version number)',
  'Activity heartbeat every 5 minutes while active'
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
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = back
  const [selectedProvider, setSelectedProvider] = useState('claude-code')
  const { setTier } = useTelemetry()

  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto')
  const contentRef = useRef<HTMLDivElement>(null)

  const measureHeight = useCallback(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [])

  const open = autoOpen || (externalOpen ?? false)

  useEffect(() => {
    window.api.settings.get('onboarding_completed').then((value) => {
      if (value !== 'true') {
        setAutoOpen(true)
      }
    })
  }, [])

  const handleNext = (): void => {
    if (step === 1) {
      window.api.settings.set('default_terminal_mode', selectedProvider)
    }
    if (step < STEP_COUNT - 1) {
      setDirection(1)
      setStep(step + 1)
    }
  }

  const handleBack = (): void => {
    if (step > 0) {
      setDirection(-1)
      setStep(step - 1)
    }
  }

  const handleSkip = (): void => {
    completeOnboarding()
  }

  const completeOnboarding = (tier?: 'anonymous' | 'opted_in'): void => {
    if (tier) setTier(tier)
    window.api.settings.set('onboarding_completed', 'true')
    setStep(0)
    setAutoOpen(false)
    onExternalClose?.()
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden" showCloseButton={false} onEscapeKeyDown={handleSkip}>
        {/* Top bar: back + skip */}
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="w-9">
            {step > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                onClick={handleBack}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={handleSkip}
          >
            Skip
          </Button>
        </div>

        <div className="px-8 pb-8">
          <motion.div
            animate={{ height: contentHeight }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            style={{ overflow: 'hidden' }}
          >
          <AnimatePresence mode="wait" onExitComplete={measureHeight}>
            <motion.div
              key={step}
              ref={contentRef}
              initial={{ opacity: 0, x: direction * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -20 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              onAnimationComplete={measureHeight}
            >
              {/* Step 0: Welcome */}
              {step === 0 && (
                <div className="text-center">
                  <motion.div
                    className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                  >
                    <Sparkles className="h-7 w-7 text-primary" />
                  </motion.div>
                  <h2 className="text-2xl font-semibold tracking-tight mb-2">Welcome to SlayZone</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    A task manager with built-in AI coding terminals for AI-assisted development.
                  </p>
                </div>
              )}

              {/* Step 1: Provider selection */}
              {step === 1 && (
                <div>
                  <div className="text-center mb-6">
                    <motion.div
                      className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                    >
                      <SquareTerminal className="h-7 w-7 text-primary" />
                    </motion.div>
                    <h2 className="text-2xl font-semibold tracking-tight mb-2">Choose your default AI</h2>
                    <p className="text-muted-foreground">
                      Pick the CLI you use most. Change anytime in settings.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {PROVIDERS.map(({ mode, label }, i) => (
                      <motion.button
                        key={mode}
                        onClick={() => setSelectedProvider(mode)}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i, duration: 0.2 }}
                        className={cn(
                          'w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all',
                          selectedProvider === mode
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'hover:bg-muted/60'
                        )}
                      >
                        <span>{label}</span>
                        {selectedProvider === mode && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          >
                            <Check className="h-4 w-4" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Analytics */}
              {step === 2 && (
                <div>
                  <div className="text-center mb-6">
                    <motion.div
                      className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                    >
                      <BarChart3 className="h-7 w-7 text-primary" />
                    </motion.div>
                    <h2 className="text-2xl font-semibold tracking-tight mb-2">Analytics</h2>
                    <p className="text-muted-foreground">
                      We always collect the following anonymously:
                    </p>
                  </div>

                  <div className="rounded-xl bg-muted/40 p-4 mb-8">
                    <ul className="space-y-2">
                      {TRACKED_EVENTS.map((event, i) => (
                        <motion.li
                          key={event}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.04 * i, duration: 0.2 }}
                          className="flex items-start gap-2.5 text-sm text-muted-foreground"
                        >
                          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          </div>
                          {event}
                        </motion.li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-sm text-muted-foreground text-left mb-2 leading-relaxed">
                    To understand how often people come back, we can store a <strong className="text-foreground">random anonymous ID</strong> locally on your device. No personal info, no IP recording.
                  </p>
                  <p className="text-sm text-muted-foreground text-left mb-6">
                    Allow this?
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => completeOnboarding('anonymous')}
                    >
                      No thanks
                    </Button>
                    <Button
                      className="h-11"
                      onClick={() => completeOnboarding('opted_in')}
                    >
                      Sure
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          </motion.div>

          {/* Step indicators + actions */}
          <div className="mt-8">
            {/* Continue button — not on analytics step (has its own buttons) */}
            {step < 2 && (
              <Button onClick={handleNext} className="w-full">
                Continue
              </Button>
            )}

            {/* Progress bar */}
            <div className="flex justify-center gap-1.5 mt-5">
              {Array.from({ length: STEP_COUNT }).map((_, i) => (
                <motion.div
                  key={i}
                  className={cn(
                    'h-1 rounded-full transition-colors',
                    i === step ? 'bg-primary' : 'bg-muted'
                  )}
                  animate={{ width: i === step ? 24 : 8 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
