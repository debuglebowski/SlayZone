import { useEffect, useState, useMemo } from 'react'
import { useChatView } from './ChatViewContext'
import {
  ChevronDown,
  ChevronRight,
  Brain,
  CircleCheck,
  CircleX,
  Loader2,
  FileText,
  Terminal as TerminalIcon,
  Pencil,
  Search,
  CheckSquare,
  ClipboardList,
  FilePlus,
  HelpCircle,
  Sparkles,
  Copy,
  Check as CheckIcon,
  User,
} from 'lucide-react'
import { cn } from '@slayzone/ui'
import { DiffView, GhMarkdown } from '@slayzone/worktrees/client'
import type { TimelineItem, ToolInvocation } from '@slayzone/terminal/client'
import { claudeEditResultToFileDiff } from './claude-patch-to-filediff'
import { LinkifiedText } from './LinkifiedText'
import { HighlightedText } from './HighlightedText'

// --- Helpers ---

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function useCopy(text: string): { copied: boolean; copy: () => void } {
  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return { copied, copy }
}

// --- Turn-scoped wrappers ---

/** User prompt — right-aligned card. */
export function UserMessage({ item }: { item: Extract<TimelineItem, { kind: 'user-text' }> }) {
  return (
    <div className="px-4 py-2 flex justify-end">
      <div className="max-w-[85%] min-w-0 rounded-lg border border-primary/25 bg-primary/5 shadow-sm px-3 py-2 text-sm text-foreground whitespace-pre-wrap break-words">
        <HighlightedText text={item.text} />
      </div>
    </div>
  )
}

/** Assistant message — left-aligned avatar + card that sizes to content up to 85%. */
export function AssistantText({ item }: { item: Extract<TimelineItem, { kind: 'text' }> }) {
  return (
    <div className="px-4 py-2">
      <div className="flex gap-3 items-start">
        <AssistantAvatar />
        <div className="min-w-0 max-w-[85%] rounded-lg border border-border/50 bg-card/40 shadow-sm px-3 py-2">
          <div className="text-sm leading-relaxed [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:my-3 [&_ul]:my-2 [&_ol]:my-2 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h3]:text-sm [&_h3]:font-medium [&_code]:font-mono [&_code]:text-[0.85em]">
            <GhMarkdown>{item.text}</GhMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

function AssistantAvatar() {
  return (
    <div className="shrink-0 size-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
      <Sparkles className="size-3.5" />
    </div>
  )
}

// Unused but kept for reference if we later show user avatars.
export function _UserAvatar() {
  return (
    <div className="shrink-0 size-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
      <User className="size-3.5" />
    </div>
  )
}

// --- Ancillary blocks ---

export function ThinkingBlock({ item }: { item: Extract<TimelineItem, { kind: 'thinking' }> }) {
  const [open, setOpen] = useState(false)
  const { collapseSignal } = useChatView()
  useEffect(() => {
    setOpen(false)
  }, [collapseSignal])
  const display = item.text || (item.hasSignature ? '(encrypted extended thinking)' : '(empty)')
  return (
    <div className="px-4 pl-[4.25rem] py-0.5">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-foreground rounded px-1.5 py-0.5 hover:bg-muted/60"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <Brain className="size-3" />
        <span className="italic">Thinking</span>
      </button>
      {open && (
        <pre className="mt-1 text-xs text-muted-foreground/80 whitespace-pre-wrap italic pl-5 border-l border-border/40 ml-1">
          <HighlightedText text={display} />
        </pre>
      )}
    </div>
  )
}

export function SystemInit({ item }: { item: Extract<TimelineItem, { kind: 'session-start' }> }) {
  return (
    <div className="px-4 py-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60">
      <span className="font-mono">{item.model}</span>
      <span>·</span>
      <span>{item.tools.length} tools</span>
    </div>
  )
}

export function ResultFooter({ item }: { item: Extract<TimelineItem, { kind: 'result' }> }) {
  const [expanded, setExpanded] = useState(false)
  const { collapseSignal } = useChatView()
  useEffect(() => {
    setExpanded(false)
  }, [collapseSignal])
  const { copied, copy } = useCopy(item.copyText ?? '')
  return (
    <div className="group px-4 pl-[4.25rem] pb-2 flex items-center gap-2 flex-wrap">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'inline-flex items-center gap-2 text-[11px] rounded-md px-2 py-1 text-muted-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors',
          item.isError && 'text-destructive'
        )}
      >
        {item.isError ? <CircleX className="size-3" /> : <CircleCheck className="size-3 text-emerald-500" />}
        <span>{(item.durationMs / 1000).toFixed(1)}s</span>
        <span>·</span>
        <span>${item.totalCostUsd.toFixed(4)}</span>
        <span>·</span>
        <span>{item.numTurns} turn{item.numTurns === 1 ? '' : 's'}</span>
        {item.isError && (
          <>
            <span>·</span>
            <span>{item.subtype}</span>
          </>
        )}
      </button>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity">
        <span>{formatTime(item.timestamp)}</span>
        {item.copyText && (
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 hover:text-foreground"
            aria-label="Copy assistant reply"
          >
            {copied ? <CheckIcon className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      {expanded && item.text && (
        <div className="basis-full mt-1.5 text-xs text-foreground/80 whitespace-pre-wrap pl-2 border-l border-border/40">
          {item.text}
        </div>
      )}
    </div>
  )
}

export function ApiRetryBanner({ item }: { item: Extract<TimelineItem, { kind: 'api-retry' }> }) {
  return (
    <div className="mx-4 my-1 px-3 py-1.5 text-xs rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center gap-2">
      <Loader2 className="size-3 animate-spin shrink-0" />
      API retry {item.attempt}/{item.maxRetries} in {item.delayMs}ms: {item.error}
    </div>
  )
}

export function StderrBlock({ item }: { item: Extract<TimelineItem, { kind: 'stderr' }> }) {
  return (
    <pre className="mx-4 my-1 px-3 py-1.5 text-xs rounded-md border border-destructive/40 bg-destructive/5 text-destructive whitespace-pre-wrap font-mono">
      <HighlightedText text={item.text} />
    </pre>
  )
}

export function InterruptedBlock(_props: { item: Extract<TimelineItem, { kind: 'interrupted' }> }) {
  return (
    <div className="mx-4 my-2 flex items-center gap-2 px-3 py-1 text-[11px] rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
      <span className="inline-block size-1.5 rounded-full bg-amber-500" />
      Turn interrupted
    </div>
  )
}

export function UnknownBlock({ item }: { item: Extract<TimelineItem, { kind: 'unknown' }> }) {
  return (
    <div className="mx-4 my-1 px-3 py-1.5 text-[11px] rounded-md border border-border/50 bg-muted/30 text-muted-foreground">
      <HelpCircle className="inline size-3 mr-1" />
      unsupported event ({item.reason})
    </div>
  )
}

// --- Tool renderers ---

interface ToolProps {
  invocation: ToolInvocation
}

function ToolShell({
  icon,
  title,
  status,
  summary,
  children,
  defaultOpen,
}: {
  icon: React.ReactNode
  title: React.ReactNode
  status: ToolInvocation['status']
  summary?: React.ReactNode
  children?: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? status === 'error')
  const { collapseSignal } = useChatView()
  useEffect(() => {
    setOpen(false)
  }, [collapseSignal])
  const canOpen = Boolean(children)
  return (
    <div className="mx-4 my-1 pl-[2.75rem]">
      <div className="rounded-lg border border-border/50 bg-card/40 overflow-hidden shadow-sm">
        <button
          onClick={() => canOpen && setOpen(!open)}
          disabled={!canOpen}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left',
            canOpen && 'hover:bg-muted/40 cursor-pointer',
            !canOpen && 'cursor-default'
          )}
        >
          <StatusIcon status={status} />
          <span className="shrink-0 text-muted-foreground">{icon}</span>
          <span className="font-medium shrink-0">{title}</span>
          {summary !== undefined && summary !== '' && (
            <span className="text-muted-foreground truncate flex-1 font-mono text-[11px]">{summary}</span>
          )}
          {canOpen && (
            <span className="shrink-0 text-muted-foreground">
              {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </span>
          )}
        </button>
        {open && canOpen && <div className="border-t border-border/40 bg-background/40">{children}</div>}
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: ToolInvocation['status'] }) {
  if (status === 'pending') return <Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
  if (status === 'error') return <CircleX className="size-3 text-destructive shrink-0" />
  return <CircleCheck className="size-3 text-emerald-500 shrink-0" />
}

function shortenPath(p?: string): string {
  if (!p) return ''
  const parts = p.split('/')
  return parts.length > 3 ? '…/' + parts.slice(-2).join('/') : p
}

export function ToolCallEdit({ invocation }: ToolProps) {
  const input = invocation.input as { file_path?: string; old_string?: string; new_string?: string } | null
  const fileDiff = useMemo(() => {
    return invocation.result ? claudeEditResultToFileDiff(invocation.result.structured) : null
  }, [invocation.result])
  return (
    <ToolShell
      icon={<Pencil className="size-3" />}
      title="Edit"
      status={invocation.status}
      summary={shortenPath(input?.file_path)}
      defaultOpen
    >
      {fileDiff ? (
        <div className="p-1">
          <DiffView diff={fileDiff} />
        </div>
      ) : input ? (
        <div className="p-3 text-xs font-mono grid gap-1">
          <div className="text-red-600 dark:text-red-400">- {input.old_string}</div>
          <div className="text-green-700 dark:text-green-400">+ {input.new_string}</div>
        </div>
      ) : null}
    </ToolShell>
  )
}

export function ToolCallRead({ invocation }: ToolProps) {
  const input = invocation.input as { file_path?: string; offset?: number; limit?: number } | null
  const structured = invocation.result?.structured as
    | { file?: { content?: string; numLines?: number } }
    | null
  const summary = input?.file_path
    ? `${shortenPath(input.file_path)}${input.limit ? ` · L${input.offset ?? 1}–${(input.offset ?? 1) + input.limit - 1}` : ''}`
    : ''
  return (
    <ToolShell
      icon={<FileText className="size-3" />}
      title="Read"
      status={invocation.status}
      summary={summary}
    >
      {structured?.file?.content && (
        <pre className="p-3 text-xs font-mono whitespace-pre overflow-x-auto max-h-64 bg-muted/30">
          <LinkifiedText text={structured.file.content} />
        </pre>
      )}
    </ToolShell>
  )
}

export function ToolCallWrite({ invocation }: ToolProps) {
  const input = invocation.input as { file_path?: string; content?: string } | null
  return (
    <ToolShell
      icon={<FilePlus className="size-3" />}
      title="Write"
      status={invocation.status}
      summary={shortenPath(input?.file_path)}
    >
      {input?.content && (
        <pre className="p-3 text-xs font-mono whitespace-pre overflow-x-auto max-h-64 bg-muted/30">
          {input.content}
        </pre>
      )}
    </ToolShell>
  )
}

export function ToolCallBash({ invocation }: ToolProps) {
  const input = invocation.input as { command?: string; description?: string } | null
  const result = invocation.result?.rawContent
  const resultText =
    typeof result === 'string'
      ? result
      : Array.isArray(result)
        ? (result as Array<{ text?: string }>).map((c) => c?.text ?? '').join('\n')
        : ''
  return (
    <ToolShell
      icon={<TerminalIcon className="size-3" />}
      title="Bash"
      status={invocation.status}
      summary={input?.description ?? input?.command}
      defaultOpen
    >
      {input?.command && (
        <div className="px-3 pt-2 text-xs font-mono flex items-start gap-2">
          <span className="text-primary shrink-0">$</span>
          <span className="whitespace-pre-wrap break-all">{input.command}</span>
        </div>
      )}
      {resultText && (
        <pre className="px-3 pb-2 pt-1 text-xs font-mono whitespace-pre-wrap text-muted-foreground max-h-64 overflow-y-auto">
          <LinkifiedText text={resultText} />
        </pre>
      )}
    </ToolShell>
  )
}

export function ToolCallGlob({ invocation }: ToolProps) {
  const input = invocation.input as { pattern?: string; path?: string } | null
  const structured = invocation.result?.structured as
    | { filenames?: string[]; numFiles?: number }
    | null
  return (
    <ToolShell
      icon={<Search className="size-3" />}
      title="Glob"
      status={invocation.status}
      summary={`${input?.pattern ?? ''}${structured ? ` → ${structured.numFiles ?? 0} files` : ''}`}
    >
      {structured?.filenames && (
        <ul className="p-3 text-xs font-mono grid gap-0.5 max-h-48 overflow-y-auto">
          {structured.filenames.map((f) => (
            <li key={f}><LinkifiedText text={f} /></li>
          ))}
        </ul>
      )}
    </ToolShell>
  )
}

export function ToolCallGrep({ invocation }: ToolProps) {
  const input = invocation.input as { pattern?: string; path?: string } | null
  const structured = invocation.result?.structured as
    | { mode?: string; filenames?: string[]; numFiles?: number; numLines?: number; content?: string }
    | null
  const summary = `${input?.pattern ?? ''}${
    structured?.mode === 'content'
      ? ` → ${structured.numLines ?? 0} lines`
      : structured?.numFiles !== undefined
        ? ` → ${structured.numFiles} files`
        : ''
  }`
  return (
    <ToolShell icon={<Search className="size-3" />} title="Grep" status={invocation.status} summary={summary}>
      {structured?.content && (
        <pre className="p-3 text-xs font-mono whitespace-pre overflow-x-auto max-h-48 bg-muted/30">
          <LinkifiedText text={structured.content} />
        </pre>
      )}
      {!structured?.content && structured?.filenames && (
        <ul className="p-3 text-xs font-mono grid gap-0.5 max-h-48 overflow-y-auto">
          {structured.filenames.map((f) => (
            <li key={f}><LinkifiedText text={f} /></li>
          ))}
        </ul>
      )}
    </ToolShell>
  )
}

export function ToolCallTodoWrite({ invocation }: ToolProps) {
  const structured = invocation.result?.structured as
    | { newTodos?: Array<{ content: string; status: string; activeForm?: string }> }
    | null
  const input = invocation.input as { todos?: Array<{ content: string; status: string }> } | null
  const todos = structured?.newTodos ?? input?.todos ?? []
  const inProgress = todos.find((t) => t.status === 'in_progress')
  return (
    <ToolShell
      icon={<CheckSquare className="size-3" />}
      title="TodoWrite"
      status={invocation.status}
      summary={`${todos.length} todos${inProgress ? ` · ${inProgress.content}` : ''}`}
      defaultOpen
    >
      <ul className="p-3 text-xs grid gap-1.5">
        {todos.map((t, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className={cn(
                'inline-block size-2 rounded-full shrink-0',
                t.status === 'completed' && 'bg-emerald-500',
                t.status === 'in_progress' && 'bg-amber-500',
                t.status === 'pending' && 'bg-muted-foreground/30'
              )}
            />
            <span
              className={cn(
                t.status === 'completed' && 'line-through text-muted-foreground',
                t.status === 'in_progress' && 'font-medium'
              )}
            >
              {t.content}
            </span>
          </li>
        ))}
      </ul>
    </ToolShell>
  )
}

export function ToolCallExitPlanMode({ invocation }: ToolProps) {
  const input = invocation.input as { plan?: string } | null
  const plan = input?.plan ?? ''
  return (
    <div className="px-4 py-3">
      <div className="flex gap-3 items-start">
        <div className="shrink-0 size-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm">
          <ClipboardList className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1 max-w-[90%] rounded-lg border border-amber-500/40 bg-amber-500/5 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            <ClipboardList className="size-3" />
            <span>Plan</span>
            <span className="ml-auto"><StatusIcon status={invocation.status} /></span>
          </div>
          {plan && (
            <div className="px-3 py-2 text-sm leading-relaxed [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:my-3 [&_ul]:my-2 [&_ol]:my-2 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h3]:text-sm [&_h3]:font-medium [&_code]:font-mono [&_code]:text-[0.85em]">
              <GhMarkdown>{plan}</GhMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ToolCallGeneric({ invocation }: ToolProps) {
  const result = invocation.result?.rawContent
  const resultText =
    typeof result === 'string'
      ? result
      : result != null
        ? JSON.stringify(result, null, 2)
        : ''
  const inputPreview = JSON.stringify(invocation.input).slice(0, 80)
  return (
    <ToolShell
      icon={<HelpCircle className="size-3" />}
      title={invocation.name || 'Tool'}
      status={invocation.status}
      summary={inputPreview}
    >
      <div className="p-3 grid gap-2 text-xs font-mono">
        <div>
          <div className="text-muted-foreground/70 mb-1">Input</div>
          <pre className="whitespace-pre-wrap bg-muted/30 p-2 rounded">
            {JSON.stringify(invocation.input, null, 2)}
          </pre>
        </div>
        {resultText && (
          <div>
            <div className="text-muted-foreground/70 mb-1">Result</div>
            <pre className="whitespace-pre-wrap bg-muted/30 p-2 rounded max-h-64 overflow-y-auto">
              {resultText}
            </pre>
          </div>
        )}
      </div>
    </ToolShell>
  )
}

export const toolRenderers: Record<string, React.FC<ToolProps>> = {
  Edit: ToolCallEdit,
  Read: ToolCallRead,
  Write: ToolCallWrite,
  Bash: ToolCallBash,
  Glob: ToolCallGlob,
  Grep: ToolCallGrep,
  TodoWrite: ToolCallTodoWrite,
  ExitPlanMode: ToolCallExitPlanMode,
}

export function renderTool(invocation: ToolInvocation): React.JSX.Element {
  const R = toolRenderers[invocation.name] ?? ToolCallGeneric
  return <R invocation={invocation} />
}

/**
 * Items the dispatcher renders as `null`. Virtualized lists must filter these
 * before counting, otherwise reserved slot heights leave ghost gaps.
 */
export function isRenderable(item: TimelineItem): boolean {
  if (item.kind === 'session-start') return false
  if (item.kind === 'rate-limit' && item.status === 'allowed') return false
  return true
}

/** Single dispatcher used by ChatPanel + the dev harness. */
export function renderTimelineItem(item: TimelineItem, key: React.Key): React.JSX.Element | null {
  switch (item.kind) {
    case 'user-text':
      return <UserMessage key={key} item={item} />
    case 'text':
      return <AssistantText key={key} item={item} />
    case 'thinking':
      return <ThinkingBlock key={key} item={item} />
    case 'tool':
      return <div key={key}>{renderTool(item.invocation)}</div>
    case 'session-start':
      return null
    case 'result':
      return <ResultFooter key={key} item={item} />
    case 'api-retry':
      return <ApiRetryBanner key={key} item={item} />
    case 'rate-limit':
      return item.status === 'allowed' ? null : (
        <div key={key} className="mx-4 my-1 text-[11px] text-amber-600">
          rate limit: {item.status}
        </div>
      )
    case 'sub-agent':
      return (
        <div key={key} className="mx-4 my-1 text-[11px] text-muted-foreground/70">
          sub-agent: {item.phase}
        </div>
      )
    case 'stderr':
      return <StderrBlock key={key} item={item} />
    case 'interrupted':
      return <InterruptedBlock key={key} item={item} />
    case 'unknown':
      return <UnknownBlock key={key} item={item} />
  }
}
