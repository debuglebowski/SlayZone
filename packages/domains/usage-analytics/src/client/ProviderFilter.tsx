import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '@slayzone/ui'
import { ALL_PROVIDERS, type ProviderOption } from '../shared/types'

interface Props {
  selected: string
  onChange: (provider: string) => void
  options: ProviderOption[]
}

export function ProviderFilter({ selected, onChange, options }: Props) {
  const supported = options.filter((o) => o.hasUsageData)
  const unsupported = options.filter((o) => !o.hasUsageData)

  return (
    <Select value={selected} onValueChange={onChange}>
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={4}>
        <SelectItem value={ALL_PROVIDERS}>All Providers</SelectItem>
        {supported.length > 0 && <SelectSeparator />}
        {supported.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
        ))}
        {unsupported.length > 0 && <SelectSeparator />}
        {unsupported.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            <span className="text-muted-foreground">{opt.label}</span>
            <span className="text-xs text-muted-foreground/60 ml-1">no usage data</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
