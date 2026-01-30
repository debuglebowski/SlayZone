import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { GroupKey } from './FilterState'

interface GroupBySelectProps {
  value: GroupKey
  onChange: (v: GroupKey) => void
}

const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'due_date', label: 'Due Date' }
]

export function GroupBySelect({ value, onChange }: GroupBySelectProps): React.JSX.Element {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as GroupKey)}>
      <SelectTrigger className="w-[120px]" size="sm">
        <SelectValue placeholder="Group by" />
      </SelectTrigger>
      <SelectContent>
        {GROUP_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
