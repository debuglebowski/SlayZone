/**
 * Strip SGR 4 (underline) codes from terminal data.
 * Handles all variants: SGR 4, 4:1-4:5 (single, double, curly, dotted, dashed).
 * Preserves all other SGR codes in combined sequences (e.g., bold+underline+red → bold+red).
 */
export function stripUnderlineCodes(data: string): string {
  return data.replace(/\x1b\[([0-9;:]*)m/g, (_, params) => {
    if (!params) return '\x1b[m'
    const filtered = params.split(';').filter((p: string) => p !== '4' && !p.startsWith('4:')).join(';')
    return filtered ? `\x1b[${filtered}m` : ''
  })
}
