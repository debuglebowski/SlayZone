# Phase 11: Kanban Polish - Research

**Researched:** 2026-01-17
**Domain:** UI refactoring, Radix/shadcn component patterns
**Confidence:** HIGH

## Summary

This phase replaces a dropdown menu with two direct-access buttons in the sidebar footer. The codebase already uses lucide-react icons extensively and has established Button component patterns with icon sizes.

Current state: `AppSidebar.tsx` has a `DropdownMenu` in `SidebarFooter` with "Settings" and "Tutorial" menu items. Both handlers (`onSettings`, `onTutorial`) are already wired through props to `App.tsx`.

**Primary recommendation:** Replace DropdownMenu with two icon buttons using existing `Button` component + lucide-react icons (Settings, HelpCircle or BookOpen).

## Standard Stack

Already in codebase, no new deps needed:

| Library | Version | Purpose | Usage |
|---------|---------|---------|-------|
| lucide-react | 0.562.0 | Icons | Import Settings, HelpCircle |
| shadcn Button | - | Button component | variant="ghost", size="icon" |
| @radix-ui/react-tooltip | 1.2.8 | Tooltips | Wrap buttons for labels |

### Removal
- Remove `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` imports from AppSidebar.tsx

## Architecture Patterns

### Current Structure (to remove)
```tsx
<SidebarFooter>
  <SidebarMenuItem>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button>...</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={onSettings}>Settings</DropdownMenuItem>
        <DropdownMenuItem onClick={onTutorial}>Tutorial</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </SidebarMenuItem>
</SidebarFooter>
```

### Target Structure
```tsx
<SidebarFooter className="py-4">
  <SidebarMenu>
    <SidebarMenuItem className="flex justify-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onSettings}>
            <Settings className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Settings</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onTutorial}>
            <HelpCircle className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Tutorial</TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarFooter>
```

### Button Sizing
Existing sidebar buttons use `w-10 h-10`. Button component has `size="icon"` = `size-9` and `size="icon-lg"` = `size-10`. Use `size="icon-lg"` or custom class to match.

### Icon Choices
- **Settings:** `Settings` from lucide-react (gear icon)
- **Tutorial:** `HelpCircle` (question mark in circle) or `BookOpen` (book icon)

Codebase convention: icons sized via className `size-4` or `size-5`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon buttons | Custom button styling | Button variant="ghost" size="icon" | Consistent focus states, accessibility |
| Tooltips | title attribute | Tooltip component | Accessible, styled, delay control |

## Common Pitfalls

### Pitfall 1: Tooltip Provider Missing
**What:** Tooltips render incorrectly or not at all
**Why:** TooltipProvider required at root
**How to avoid:** Check if TooltipProvider exists (likely does since tooltip.tsx exists). If not, wrap App in TooltipProvider.
**Warning signs:** Tooltips flash or position incorrectly

### Pitfall 2: Inconsistent Button Sizing
**What:** New buttons look different size than existing sidebar items
**Why:** Existing uses `w-10 h-10`, Button component uses different sizes
**How to avoid:** Match existing dimension with `className="w-10 h-10"` or use `size="icon-lg"`

### Pitfall 3: Gap/Spacing Issues
**What:** Buttons too close or too far apart
**Why:** Changing from single item to two items
**How to avoid:** Use `gap-2` in flex container, test visually

## Code Examples

### Import Pattern
```tsx
import { Settings, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
```

### Icon Button with Tooltip
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="ghost"
      size="icon-lg"
      onClick={onSettings}
      className="text-muted-foreground"
    >
      <Settings className="size-5" />
    </Button>
  </TooltipTrigger>
  <TooltipContent side="right">Settings</TooltipContent>
</Tooltip>
```

### Alternative: Raw Button (matching existing style)
```tsx
<button
  onClick={onSettings}
  className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
  title="Settings"
>
  <Settings className="size-5" />
</button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| title attr | Tooltip component | Radix maturity | Better accessibility, styling |
| onClick menus | Direct buttons | UX preference | Faster access, less clicks |

## Open Questions

1. **TooltipProvider location?** Need to verify if already at root or needs adding.
2. **Icon choice for Tutorial?** HelpCircle vs BookOpen - subjective UX decision.

## Sources

### Primary (HIGH confidence)
- AppSidebar.tsx - current implementation examined
- button.tsx - variant/size options confirmed
- package.json - lucide-react 0.562.0 confirmed
- App.tsx - handlers already wired (onSettings, onTutorial)

### Secondary (MEDIUM confidence)
- tooltip.tsx exists in ui folder (not read, but imports likely standard shadcn)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all deps already in codebase
- Architecture: HIGH - simple component refactor, patterns clear
- Pitfalls: HIGH - common React/Radix patterns

**Research date:** 2026-01-17
**Valid until:** Stable - no external deps or fast-moving APIs
