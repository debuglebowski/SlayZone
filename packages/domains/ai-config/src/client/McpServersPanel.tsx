import { ExternalLink, Server } from 'lucide-react'
import { cn } from '@slayzone/ui'

interface McpServer {
  id: string
  name: string
  description: string
  url: string
  category: 'filesystem' | 'search' | 'database' | 'dev-tools' | 'productivity' | 'ai'
}

const CURATED_SERVERS: McpServer[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, and manage files and directories.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    category: 'filesystem'
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Interact with GitHub repos, issues, PRs, and more.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    category: 'dev-tools'
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Query and manage PostgreSQL databases.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    category: 'database'
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Query and manage SQLite databases.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
    category: 'database'
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Web and local search via the Brave Search API.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
    category: 'search'
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: 'Browser automation, screenshots, and web scraping.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
    category: 'dev-tools'
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Knowledge graph-based persistent memory for context.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    category: 'ai'
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'Fetch and convert web content to markdown.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    category: 'search'
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Read and send messages in Slack workspaces.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
    category: 'productivity'
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Manage Linear issues, projects, and teams.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/linear',
    category: 'productivity'
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Retrieve and analyze error data from Sentry.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sentry',
    category: 'dev-tools'
  },
  {
    id: 'context7',
    name: 'Context7',
    description: 'Up-to-date documentation and code examples for any library.',
    url: 'https://github.com/upstash/context7',
    category: 'ai'
  }
]

const CATEGORY_LABELS: Record<McpServer['category'], string> = {
  filesystem: 'Filesystem',
  search: 'Search',
  database: 'Database',
  'dev-tools': 'Dev Tools',
  productivity: 'Productivity',
  ai: 'AI'
}

export function McpServersPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Curated MCP servers for use with Claude Code and other AI assistants.
      </p>
      <div className="space-y-1.5">
        {CURATED_SERVERS.map((server) => (
          <a
            key={server.id}
            href={server.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
              'hover:bg-muted/50'
            )}
          >
            <Server className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{server.name}</span>
                <span className="rounded border px-1.5 py-0 text-[10px] text-muted-foreground">
                  {CATEGORY_LABELS[server.category]}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{server.description}</p>
            </div>
            <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  )
}
