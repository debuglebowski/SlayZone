/**
 * Strip SGR 4 (underline) codes from terminal data.
 * Handles all variants: SGR 4, 4:1-4:5 (single, double, curly, dotted, dashed).
 *
 * SGR-structure aware: `38`/`48`/`58` (extended fg/bg/underline color) consume the
 * tokens that follow as a color spec — `5;<idx>` (256-color) or `2;<r>;<g>;<b>` (RGB).
 * A `4` appearing as a color index or an RGB component is NOT underline and must be
 * preserved. The walk skips a color spec verbatim instead of filtering its tokens.
 * Colon sub-parameter form (`38:5:4`, `4:3`) is already a single `;`-token, so it is
 * handled by the per-token checks without special-casing.
 */
export function stripUnderlineCodes(data: string): string {
  return data.replace(/\x1b\[([0-9;:]*)m/g, (_, params) => {
    if (!params) return '\x1b[m'
    const tokens: string[] = params.split(';')
    const kept: string[] = []
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]
      // Extended color introducer — keep it and copy its color spec untouched.
      if (tok === '38' || tok === '48' || tok === '58') {
        kept.push(tok)
        const selector = tokens[i + 1]
        if (selector === '5') {
          // 5;<idx>
          for (let j = 1; j <= 2 && i + j < tokens.length; j++) kept.push(tokens[i + j])
          i += 2
        } else if (selector === '2') {
          // 2;<r>;<g>;<b>
          for (let j = 1; j <= 4 && i + j < tokens.length; j++) kept.push(tokens[i + j])
          i += 4
        }
        // Unknown/missing selector → just keep the introducer, continue normally.
        continue
      }
      // Real SGR underline: standalone `4` or sub-parameter form `4:<n>`.
      if (tok === '4' || tok.startsWith('4:')) continue
      // Everything else (including empty tokens from `;;`) passes through.
      kept.push(tok)
    }
    const filtered = kept.join(';')
    return filtered ? `\x1b[${filtered}m` : ''
  })
}
