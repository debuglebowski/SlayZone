export type ChangeCategory = 'feature' | 'improvement' | 'fix'

export interface ChangeItem {
  category: ChangeCategory
  title: string
  description?: string
}

export interface ChangelogEntry {
  version: string
  date: string
  tagline: string
  items: ChangeItem[]
}

// Newest first. Only user-facing versions with meaningful changes.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.69',
    date: '2026-02-26',
    tagline: 'Search everything',
    items: [
      {
        category: 'feature',
        title: 'Global file search',
        description:
          'Cmd+Shift+F searches across all files in your project — from any tab.',
      },
      {
        category: 'feature',
        title: 'Project color tints',
        description:
          "Tabs, task detail, and kanban cards pick up your project's color for quick visual grouping.",
      },
      {
        category: 'feature',
        title: 'Pinnable usage bars',
        description:
          'Pin or unpin inline API usage bars per provider — keep only what you care about visible.',
      },
      {
        category: 'feature',
        title: 'In-app changelog',
        description:
          "See what's new every time you update — opens automatically on version upgrade.",
      },
      {
        category: 'feature',
        title: 'Appearance settings',
        description:
          'Customize font sizes across the app and enable reduced motion for a calmer experience.',
      },
      {
        category: 'improvement',
        title: 'Faster startup',
        description:
          'Parallel splash screen and pre-populated app — visible content on first frame.',
      },
      {
        category: 'fix',
        title: 'Windows support',
        description:
          'Shell, environment, and git operations stabilized for Windows.',
      },
    ],
  },
  {
    version: '0.1.62',
    date: '2026-02-20',
    tagline: 'Terminal power, everywhere',
    items: [
      {
        category: 'feature',
        title: 'The Slay CLI',
        description: 'Create, update, search, and manage tasks without leaving your terminal. Full CRUD, completions, and auto-project scoping.',
      },
      {
        category: 'feature',
        title: 'Multi-panel home screen',
        description: 'Open kanban, git, editor, and processes side by side — all on the home tab.',
      },
      {
        category: 'improvement',
        title: 'Tooltips everywhere',
        description: 'Every panel, button, and control now has helpful tooltip hints.',
      },
    ],
  },
  {
    version: '0.1.56',
    date: '2026-02-15',
    tagline: 'See everything at once',
    items: [
      {
        category: 'feature',
        title: 'Processes panel',
        description: 'Monitor and manage background tasks — dev servers, builds, watchers — from a dedicated panel.',
      },
      {
        category: 'feature',
        title: 'Daily leaderboard',
        description: 'Opt-in anonymous weekly coding streaks. See how you stack up.',
      },
      {
        category: 'feature',
        title: 'Inline DevTools',
        description: 'Chromium DevTools embedded right inside the browser panel. No more separate windows.',
      },
      {
        category: 'improvement',
        title: 'Focused panel glow',
        description: 'A subtle glow shows which panel is currently active — gone when there\'s only one.',
      },
      {
        category: 'fix',
        title: 'Terminal injection fix',
        description: 'Escape sequence responses no longer inject garbage characters into your terminal.',
      },
    ],
  },
  {
    version: '0.1.51',
    date: '2026-02-10',
    tagline: 'Rock solid terminals',
    items: [
      {
        category: 'feature',
        title: 'Crash recovery',
        description: 'Terminals now auto-recover from crashes with built-in health checks and diagnostics.',
      },
      {
        category: 'improvement',
        title: 'Smarter Cmd+W',
        description: 'Closes the focused pane first — terminal split, editor file, browser tab — then the task tab.',
      },
      {
        category: 'improvement',
        title: 'Copy URL in browser',
        description: 'One-click button to copy the current browser panel URL.',
      },
      {
        category: 'fix',
        title: 'Blocked external launches',
        description: 'Webviews can no longer silently open apps like Spotify or Zoom.',
      },
    ],
  },
  {
    version: '0.1.47',
    date: '2026-02-05',
    tagline: 'Drag, drop, split',
    items: [
      {
        category: 'feature',
        title: 'Split terminal groups',
        description: 'Drag terminals into groups and run them side by side within a single task.',
      },
      {
        category: 'feature',
        title: 'Responsive browser preview',
        description: 'Test your app across phone, tablet, and desktop viewports — all inline.',
      },
      {
        category: 'feature',
        title: 'Drag files from Finder',
        description: 'Drop files and folders straight from Finder into the editor tree.',
      },
      {
        category: 'improvement',
        title: 'Image preview in editor',
        description: 'Open images directly in the editor panel instead of an external app.',
      },
      {
        category: 'improvement',
        title: 'Priority signal bars',
        description: 'Kanban cards now show signal-bar indicators so you can spot high-priority tasks at a glance.',
      },
      {
        category: 'improvement',
        title: 'Update toast',
        description: 'When a new version is downloaded, a toast appears — restart with one click.',
      },
    ],
  },
  {
    version: '0.1.42',
    date: '2026-01-28',
    tagline: 'The big picture',
    items: [
      {
        category: 'feature',
        title: 'Explode mode',
        description: 'Grid view of every open task terminal at once. See all your agents working in parallel.',
      },
    ],
  },
]
