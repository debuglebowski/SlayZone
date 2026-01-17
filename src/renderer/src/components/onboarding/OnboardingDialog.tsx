import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface OnboardingStep {
  title: string
  description: string
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to Focus',
    description:
      'A simple task manager with a focused Work Mode to help you get things done without rabbit-holing.'
  },
  {
    title: 'Organize with Projects',
    description:
      'Create projects in the sidebar to group related tasks. Click "All" to see tasks across all projects.'
  },
  {
    title: 'Work Mode',
    description:
      'Open a task and click "Work Mode" for a dedicated workspace with AI chat, browser tabs, and documents.'
  },
  {
    title: 'Keyboard Shortcuts',
    description: 'Press "n" to create a new task from anywhere. Press "esc" to go back.'
  }
]

export function OnboardingDialog(): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Check if onboarding already completed
    window.api.settings.get('onboarding_completed').then((value) => {
      if (value !== 'true') {
        setOpen(true)
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
    setOpen(false)
  }

  if (!open) return null

  const current = ONBOARDING_STEPS[step]

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <div className="text-center py-6">
          <h2 className="text-xl font-bold mb-3">{current.title}</h2>
          <p className="text-muted-foreground mb-8 px-4">{current.description}</p>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mb-6">
            {ONBOARDING_STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  i === step ? 'bg-primary' : 'bg-muted'
                )}
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
