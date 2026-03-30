import { useState } from 'react'
import { format, setHours, setMinutes, addHours, addDays, nextMonday, isAfter } from 'date-fns'
import { AlarmClock, Moon, Calendar as CalendarIcon, Sun } from 'lucide-react'
import { Calendar, Button } from '@slayzone/ui'

interface SnoozeOption {
  label: string
  icon: React.ReactNode
  getDate: () => Date
}

function getSnoozePresets(): SnoozeOption[] {
  const now = new Date()
  return [
    {
      label: 'Later today',
      icon: <Sun className="size-3.5" />,
      getDate: () => {
        const fourPm = setMinutes(setHours(now, 16), 0)
        return isAfter(fourPm, addHours(now, 1)) ? fourPm : addHours(now, 3)
      }
    },
    {
      label: 'Tomorrow',
      icon: <Moon className="size-3.5" />,
      getDate: () => setMinutes(setHours(addDays(now, 1), 9), 0)
    },
    {
      label: 'Next week',
      icon: <CalendarIcon className="size-3.5" />,
      getDate: () => setMinutes(setHours(nextMonday(now), 9), 0)
    }
  ]
}

interface SnoozePickerProps {
  onSnooze: (until: string) => void
  onClose?: () => void
}

export function SnoozePicker({ onSnooze, onClose }: SnoozePickerProps): React.JSX.Element {
  const [showCustom, setShowCustom] = useState(false)
  const [customDate, setCustomDate] = useState<Date | undefined>()
  const [customTime, setCustomTime] = useState('09:00')
  const presets = getSnoozePresets()

  const handlePreset = (option: SnoozeOption): void => {
    onSnooze(option.getDate().toISOString())
    onClose?.()
  }

  const handleCustomConfirm = (): void => {
    if (!customDate) return
    const [h, m] = customTime.split(':').map(Number)
    const dt = setMinutes(setHours(customDate, h), m)
    onSnooze(dt.toISOString())
    onClose?.()
  }

  if (showCustom) {
    return (
      <div className="space-y-2 p-1">
        <Calendar
          mode="single"
          selected={customDate}
          onSelect={setCustomDate}
          disabled={{ before: new Date() }}
        />
        <div className="flex items-center gap-2 px-2">
          <AlarmClock className="size-3.5 text-muted-foreground" />
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm"
          />
        </div>
        <div className="flex gap-1 px-2 pb-1">
          <Button variant="ghost" size="sm" className="flex-1" onClick={() => setShowCustom(false)}>
            Back
          </Button>
          <Button size="sm" className="flex-1" onClick={handleCustomConfirm} disabled={!customDate}>
            Snooze
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="py-1">
      {presets.map((option) => (
        <button
          key={option.label}
          onClick={() => handlePreset(option)}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          {option.icon}
          <span className="flex-1 text-left">{option.label}</span>
          <span className="text-xs text-muted-foreground">{format(option.getDate(), 'EEE, MMM d')}</span>
        </button>
      ))}
      <button
        onClick={() => setShowCustom(true)}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
      >
        <AlarmClock className="size-3.5" />
        Custom...
      </button>
    </div>
  )
}
