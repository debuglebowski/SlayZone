# Terminal Black Screen Bug - RESOLVED

## Issue 1: Restart/Reset causes black screen

**Symptoms:**
- Terminal goes black when clicking "Reset terminal" or "Restart terminal"
- Only Cmd+R (full app restart) fixed it

**Root Cause:**
When `setTerminal` saw skipCache flag, it disposed the passed terminal but **did not delete the existing cache entry**:
1. Terminal cached earlier (view switch)
2. User clicks restart → `markSkipCache(taskId)`
3. Cleanup calls `setTerminal` → disposes new instance, but old cache entry remains
4. New initTerminal finds old (disposed) cache entry → tries to reattach → crash

**Fix:** `terminal-cache.ts` - Add `cache.delete(taskId)` in `setTerminal` when skipCache is set.

## Issue 2: Idle causes black screen

**Symptoms:**
- Terminal goes black after idle period
- Hidden terminals tried to initialize with 0 dimensions

**Root Cause:**
1. Idle handler disposed terminal even when visible
2. Hidden terminals (other tasks) tried to initialize with 0-dimension containers

**Fixes:**
1. `Terminal.tsx` - Skip init if container has 0 dimensions after timeout
2. `Terminal.tsx` - Reset `initializedRef` in idle handler (allows reinit)
3. `Terminal.tsx` - Only dispose in idle handler if terminal is NOT visible

## Key Files
- `src/renderer/src/components/terminal/Terminal.tsx` - xterm component
- `src/renderer/src/components/terminal/terminal-cache.ts` - module-level cache
- `src/renderer/src/components/task-detail/TaskDetailPage.tsx` - restart handlers
