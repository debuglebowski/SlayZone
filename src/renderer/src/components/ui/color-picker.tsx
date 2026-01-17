import { HexColorPicker, HexColorInput } from 'react-colorful'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <HexColorPicker color={value} onChange={onChange} />
      <HexColorInput
        color={value}
        onChange={onChange}
        prefixed
        className="w-full px-3 py-2 border rounded-md text-sm"
      />
    </div>
  )
}
