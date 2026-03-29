import { IconButton, Tooltip, TooltipTrigger, TooltipContent } from '@slayzone/ui'
import { Pencil, Play, Pause, Square, RotateCcw } from 'lucide-react'
import type { LoopState, LoopStatus } from './useLoopMode'
import type { LoopConfig } from '@slayzone/terminal/shared'

interface LoopModeBannerProps {
  loopState: LoopState
  onStart: (config: LoopConfig) => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onEditConfig: () => void
}

const STATUS_LABELS: Record<LoopStatus, string> = {
  idle: 'Ready',
  sending: 'Sending...',
  waiting: 'Waiting...',
  checking: 'Checking...',
  paused: 'Paused',
  passed: 'Passed',
  stopped: 'Stopped',
  error: 'Error',
  'max-reached': 'Max reached'
}

const STATUS_DOT_COLORS: Record<LoopStatus, string> = {
  idle: 'bg-neutral-400',
  sending: 'bg-yellow-500',
  waiting: 'bg-yellow-500',
  checking: 'bg-yellow-500',
  paused: 'bg-blue-500',
  passed: 'bg-green-500',
  stopped: 'bg-neutral-400',
  error: 'bg-red-500',
  'max-reached': 'bg-orange-500'
}

const CRITERIA_LABELS = {
  'contains': 'contains',
  'not-contains': 'not contains',
  'regex': 'regex'
} as const

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '\u2026' : s
}

export function LoopModeBanner({ loopState, onStart, onPause, onResume, onStop, onEditConfig }: LoopModeBannerProps) {
  const { active, iteration, status, config } = loopState
  const hasConfig = config.prompt.trim().length > 0 && config.criteriaPattern.trim().length > 0
  const showStatus = active || status !== 'idle'
  const progress = config.maxIterations > 0 ? (iteration / config.maxIterations) * 100 : 0

  return (
    <div
      className={`absolute top-6 right-6 z-10 w-72 rounded-xl border-2 ${active ? 'border-orange-500/60' : 'border-border'} bg-background backdrop-blur-md text-xs overflow-hidden transition-all duration-300`}
      style={{
        boxShadow: active
          ? '0 0 20px 0 rgba(249,115,22,0.4), 0 0 60px 0 rgba(249,115,22,0.15)'
          : '0 4px 24px 0 rgba(0,0,0,0.15)',
        animation: active ? 'loop-glow-active 2s ease-in-out infinite' : 'loop-glow-idle 3s ease-in-out infinite'
      }}
    >
      <style>{`
        @keyframes loop-glow-active {
          0%, 100% { box-shadow: 0 0 20px 0 rgba(249,115,22,0.4), 0 0 60px 0 rgba(249,115,22,0.15); }
          50% { box-shadow: 0 0 35px 5px rgba(249,115,22,0.6), 0 0 80px 10px rgba(249,115,22,0.25); }
        }
        @keyframes loop-glow-idle {
          0%, 100% { box-shadow: 0 4px 20px 0 rgba(249,115,22,0.08), 0 0 0 0 rgba(249,115,22,0); }
          50% { box-shadow: 0 4px 30px 4px rgba(249,115,22,0.15), 0 0 15px 2px rgba(249,115,22,0.08); }
        }
      `}</style>
      {/* Header with action icons */}
      <div className={`flex items-center justify-between px-3 py-2 border-b ${active ? 'border-orange-500/20 bg-orange-500/5' : 'border-border'}`}>
        <span className="font-bold text-foreground tracking-wide">LOOP COMMAND</span>
        <div className="flex items-center gap-0.5">
          {!active && status !== 'paused' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton variant="ghost" className="size-7" aria-label="Edit config" onClick={onEditConfig}>
                  <Pencil className="size-3.5" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">Configure</TooltipContent>
            </Tooltip>
          )}
          {!active && status !== 'paused' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton variant="ghost" className="size-7" aria-label="Start loop" disabled={!hasConfig} onClick={() => onStart(config)}>
                  <Play className="size-4" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">Start</TooltipContent>
            </Tooltip>
          )}
          {active && (
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton variant="ghost" className="size-7" aria-label="Pause loop" onClick={onPause}>
                  <Pause className="size-4" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">Pause</TooltipContent>
            </Tooltip>
          )}
          {status === 'paused' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton variant="ghost" className="size-7" aria-label="Resume loop" onClick={onResume}>
                  <RotateCcw className="size-4" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">Resume</TooltipContent>
            </Tooltip>
          )}
          {(active || status === 'paused') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton variant="ghost" className="size-7 text-destructive" aria-label="Stop loop" onClick={onStop}>
                  <Square className="size-4" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">Stop</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Prompt section */}
      <div className={`px-3 py-2.5 border-b ${active ? 'border-orange-500/20' : 'border-border'}`}>
        <div className="text-muted-foreground mb-0.5">Prompt</div>
        <div className="text-foreground leading-snug">{truncate(config.prompt, 100)}</div>
      </div>

      {/* Criteria section */}
      <div className={`px-3 py-2.5 border-b ${active ? 'border-orange-500/20' : 'border-border'}`}>
        <div className="text-muted-foreground mb-0.5">Criteria</div>
        <div className="text-foreground">{CRITERIA_LABELS[config.criteriaType]} &ldquo;{truncate(config.criteriaPattern, 40)}&rdquo;</div>
      </div>

      {/* Status + progress section */}
      <div className={`px-3 py-2.5 ${active ? 'border-orange-500/20' : ''} space-y-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className={`size-2.5 rounded-full shrink-0 ${STATUS_DOT_COLORS[status]} ${active ? 'animate-pulse' : ''}`} />
            <span className={showStatus ? 'text-foreground font-medium' : 'text-muted-foreground'}>
              {showStatus ? STATUS_LABELS[status] : 'Idle'}
            </span>
          </div>
          <span className="text-muted-foreground font-mono tabular-nums">{iteration}/{config.maxIterations}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${active ? 'bg-orange-500' : 'bg-foreground/30'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
