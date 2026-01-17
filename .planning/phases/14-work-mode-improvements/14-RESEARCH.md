# Phase 14: Work Mode Improvements - Research

**Researched:** 2026-01-17
**Domain:** React UI, Tailwind CSS, empty states, sidebar layout
**Confidence:** HIGH

## Summary

This phase improves the Work Mode experience through 5 targeted changes: enhanced empty state with workspace options, hidden workspace panel when empty, task title moved to sidebar, wider sidebar, and subtle exit button. All changes are UI-only using existing patterns.

Current WorkModePage structure:
- Header with back button + task title + "Work Mode" label
- Sidebar (w-64) with workspace items + add buttons
- Main content area showing active workspace item

Key changes:
1. Empty state: Replace "Select an item..." with 3 large buttons (Chat/Browser/Document)
2. Empty state: Hide main content panel entirely when no items
3. Sidebar: Display task title at top instead of header
4. Sidebar: Increase width from w-64 (256px) to w-80 (320px) or larger
5. Exit button: Move from header to sidebar top-right, make subtle (ghost/icon-only)

**Primary recommendation:** Restructure WorkModePage to move title into sidebar, use conditional rendering to hide empty workspace panel, create EmptyWorkspaceState component with 3 large action buttons.

## Standard Stack

### Core (already in codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.x | Layout & styling | Already used |
| lucide-react | current | Icons (MessageSquare, Globe, FileText, X) | Already used |
| @radix-ui primitives | current | Button, tooltips | Already used |

### No New Dependencies Needed
All changes use existing patterns and components.

## Architecture Patterns

### Current WorkModePage Structure
```
<div className="flex flex-col h-screen">
  <header>                          // Contains: back + title + "Work Mode"
    [ArrowLeft] [task.title] [Work Mode label]
  </header>
  <div className="flex flex-1">
    <aside className="w-64">        // Sidebar
      [Workspace header + add buttons]
      [Item list]
    </aside>
    <main className="flex-1">       // Always rendered
      {!activeItem ? <EmptyMessage /> : <ActiveContent />}
    </main>
  </div>
</div>
```

### Target WorkModePage Structure
```
<div className="flex h-screen">     // No flex-col, remove header
  <aside className="w-80">          // Wider sidebar
    <div className="header">
      [task.title]                  // Title in sidebar
      [X exit button top-right]     // Subtle exit
    </div>
    [Workspace header + add buttons]
    [Item list]
  </aside>
  {items.length > 0 && activeItem ? (  // Conditional: hide when empty
    <main className="flex-1">
      <ActiveContent />
    </main>
  ) : (
    <EmptyWorkspaceState />         // Full-width empty state
  )}
</div>
```

### Pattern 1: Conditional Panel Rendering
**What:** Don't render workspace panel when nothing to show
**When:** Empty state (no items) or no item selected
**Example:**
```tsx
{items.length > 0 && activeItemId ? (
  <main className="flex-1 min-h-0">
    {/* Active item content */}
  </main>
) : (
  <EmptyWorkspaceState onAddItem={handleAddItem} />
)}
```

### Pattern 2: Large Action Buttons for Empty State
**What:** Prominent call-to-action buttons instead of text
**Reference:** VS Code welcome page, Notion empty page
**Example:**
```tsx
function EmptyWorkspaceState({ onAddItem }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="grid grid-cols-3 gap-6">
        <EmptyStateButton
          icon={MessageSquare}
          label="Chat"
          onClick={() => onAddItem('chat')}
        />
        <EmptyStateButton
          icon={Globe}
          label="Browser"
          onClick={() => onAddItem('browser')}
        />
        <EmptyStateButton
          icon={FileText}
          label="Document"
          onClick={() => onAddItem('document')}
        />
      </div>
    </div>
  )
}
```

### Pattern 3: Sidebar Width Options
**Current:** `w-64` (256px)
**Options:**
| Class | Width | Use Case |
|-------|-------|----------|
| w-64 | 256px | Current, minimal |
| w-72 | 288px | Slightly wider |
| w-80 | 320px | Comfortable, recommended |
| w-96 | 384px | Very wide |

**Recommendation:** `w-80` (320px) - enough for task title + controls

### Pattern 4: Subtle Exit Button
**What:** Replace prominent ArrowLeft in header with icon-only X in sidebar
**Current:** `<Button variant="ghost" size="icon">` with ArrowLeft
**Target:** X icon, positioned top-right of sidebar header, ghost variant
```tsx
<div className="flex items-center justify-between p-4">
  <h1 className="text-lg font-semibold truncate">{task.title}</h1>
  <Button
    variant="ghost"
    size="icon"
    className="h-7 w-7 text-muted-foreground hover:text-foreground"
    onClick={onBack}
    title="Exit Work Mode"
  >
    <X className="h-4 w-4" />
  </Button>
</div>
```

### Anti-Patterns to Avoid
- **Always rendering empty main panel:** Wastes space, looks broken
- **Tiny action text in empty state:** Users miss the options
- **Exit button competing with primary actions:** Should be discoverable but not prominent

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon buttons | Custom button | Button with variant="ghost" size="icon" | Consistent styling |
| Tooltips | title attribute | Tooltip component | Better UX |
| Conditional visibility | display:none | Conditional rendering | React pattern |

## Common Pitfalls

### Pitfall 1: Empty State Button Sizing
**What goes wrong:** Buttons too small, look like regular actions
**Why:** Empty state needs to draw attention
**How to avoid:** Use larger padding, bigger icons (h-8 w-8 or larger)
**Warning signs:** Users still look for "how to start"

### Pitfall 2: Task Title Truncation in Sidebar
**What goes wrong:** Long titles break layout
**Why:** Fixed sidebar width
**How to avoid:** Use `truncate` class on title, maybe tooltip for full title
**Warning signs:** Title wraps or pushes exit button off screen

### Pitfall 3: Exit Button Visibility
**What goes wrong:** Users can't find exit
**Why:** Too subtle, no visible affordance
**How to avoid:** Keep reasonable size (h-7 w-7), show on hover, use tooltip
**Warning signs:** Users use browser back or keyboard escape only

### Pitfall 4: Sidebar Width Breaking Other Views
**What goes wrong:** Workspace panel too narrow on smaller screens
**Why:** Sidebar taking too much space
**How to avoid:** w-80 is safe for most screens, consider responsive w-72 md:w-80
**Warning signs:** Horizontal scrollbar appears

## Code Examples

### EmptyWorkspaceState Component
```tsx
import { MessageSquare, Globe, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WorkspaceItemType } from '../../../../shared/types/database'

interface Props {
  onAddItem: (type: WorkspaceItemType) => void
}

export function EmptyWorkspaceState({ onAddItem }: Props) {
  const options = [
    { type: 'chat' as const, icon: MessageSquare, label: 'Chat', desc: 'AI conversation' },
    { type: 'browser' as const, icon: Globe, label: 'Browser', desc: 'Web research' },
    { type: 'document' as const, icon: FileText, label: 'Document', desc: 'Notes & drafts' }
  ]

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex gap-6">
        {options.map(({ type, icon: Icon, label, desc }) => (
          <button
            key={type}
            onClick={() => onAddItem(type)}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-dashed
                       hover:border-primary hover:bg-muted/50 transition-colors w-32"
          >
            <Icon className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <div className="font-medium">{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

### Sidebar Header with Title + Exit
```tsx
<aside className="w-80 border-r flex flex-col">
  {/* Title + Exit */}
  <div className="flex items-center justify-between p-4 border-b">
    <h1 className="text-lg font-semibold truncate pr-2">{task.title}</h1>
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground"
      onClick={onBack}
    >
      <X className="h-4 w-4" />
    </Button>
  </div>

  {/* Workspace controls */}
  <div className="p-2 border-b flex items-center justify-between">
    <span className="text-sm font-medium">Workspace</span>
    {/* Add buttons */}
  </div>

  {/* Item list */}
  <div className="flex-1 overflow-y-auto p-2">
    {/* items */}
  </div>
</aside>
```

### Conditional Main Panel
```tsx
// In WorkModePage render:
const hasContent = items.length > 0 && activeItemId

return (
  <div className="flex h-screen">
    <aside className="w-80 border-r flex flex-col">
      {/* sidebar content */}
    </aside>

    {hasContent ? (
      <main className="flex-1 min-h-0">
        {activeItem?.type === 'chat' ? <ChatPanel ... /> : ...}
      </main>
    ) : (
      <EmptyWorkspaceState onAddItem={handleAddItem} />
    )}
  </div>
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text-only empty states | Action-button empty states | Modern apps | Better onboarding |
| Header-based navigation | Sidebar-based controls | Workspace apps | More screen real estate |
| Prominent exit buttons | Subtle exit in corner | Modern UX | Less visual noise |

## Open Questions

1. **Empty state when items exist but none selected?**
   - What we know: Currently shows "Select an item..."
   - What's unclear: Should this be same as no-items empty state?
   - Recommendation: Show "Select an item" for has-items, full empty state only for no-items

2. **Title editing in sidebar?**
   - What we know: TaskDetailPage has click-to-edit title
   - What's unclear: Should work mode title be editable?
   - Recommendation: No - keep simple, edit via task detail page

## Sources

### Primary (HIGH confidence)
- `/Users/Kalle/dev/projects/focus/src/renderer/src/components/work-mode/WorkModePage.tsx` - current implementation
- `/Users/Kalle/dev/projects/focus/src/renderer/src/components/work-mode/WorkspaceSidebar.tsx` - sidebar pattern
- `/Users/Kalle/dev/projects/focus/src/renderer/src/components/ui/button.tsx` - button variants

### Secondary (MEDIUM confidence)
- Tailwind CSS width utilities documentation
- Common empty state patterns in modern web apps

## Metadata

**Confidence breakdown:**
- Layout changes: HIGH - straightforward Tailwind/React
- Empty state: HIGH - common pattern, clear requirements
- Sidebar width: HIGH - single class change
- Exit button: HIGH - existing Button component

**Research date:** 2026-01-17
**Valid until:** 2026-02-17 (stable patterns)
