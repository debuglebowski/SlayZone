import { useState } from 'react'
import { HexColorPicker, HexColorInput } from 'react-colorful'
import { Popover, PopoverTrigger, PopoverContent } from './popover'
import { Button } from './button'
import { cn } from './utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            'h-10 px-3'
          )}
        >
          <div className="flex items-center gap-2 w-full">
            <div
              className="h-5 w-5 rounded border border-border shrink-0"
              style={{ backgroundColor: value }}
            />
            <span className="text-sm text-muted-foreground">{value}</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-3">
          <HexColorPicker color={value} onChange={onChange} />
          <HexColorInput
            color={value}
            onChange={onChange}
            prefixed
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
