export interface TemplateContext {
  task?: {
    id: string
    name: string
    status: string
    priority: number
    worktree_path?: string | null
    branch?: string | null
    terminal_mode?: string | null
    terminal_mode_flags?: string | null
  }
  project?: {
    id: string
    name: string
    path: string
  }
  trigger?: {
    old_status?: string
    new_status?: string
  }
}

export function resolveTemplate(template: string, ctx: TemplateContext): string {
  return template.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_match, group: string, key: string) => {
    const obj = ctx[group as keyof TemplateContext]
    if (!obj || typeof obj !== 'object') return ''
    const value = (obj as Record<string, unknown>)[key]
    return value != null ? String(value) : ''
  })
}
