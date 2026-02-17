export type McpCategory = 'filesystem' | 'search' | 'database' | 'dev-tools' | 'productivity' | 'ai'

export interface McpServerTemplate {
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface CuratedMcpServer {
  id: string
  name: string
  description: string
  url: string
  category: McpCategory
  npmPackage: string
  template: McpServerTemplate
}

export const CURATED_MCP_SERVERS: CuratedMcpServer[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, search, and manage files and directories. Provides tools for listing directory contents, reading/writing files, creating directories, moving files, and searching within file contents.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    category: 'filesystem',
    npmPackage: '@modelcontextprotocol/server-filesystem',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] }
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Interact with GitHub repositories, issues, pull requests, branches, and actions. Create and review PRs, manage issues, search code, and automate GitHub workflows directly from your AI assistant.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    category: 'dev-tools',
    npmPackage: '@modelcontextprotocol/server-github',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: '$GITHUB_TOKEN' } }
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Connect to PostgreSQL databases to run read-only SQL queries, inspect schemas, list tables, and describe table structures. Useful for data exploration and debugging database-backed applications.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    category: 'database',
    npmPackage: '@modelcontextprotocol/server-postgres',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', '$DATABASE_URL'] }
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Connect to SQLite databases to run SQL queries, inspect schemas, list tables, and explore data. Great for working with local databases, prototyping, and debugging embedded database applications.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
    category: 'database',
    npmPackage: '@modelcontextprotocol/server-sqlite',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sqlite', '$DB_PATH'] }
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Perform web searches and local point-of-interest lookups using the Brave Search API. Get real-time search results, snippets, and web content summaries without needing a browser.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
    category: 'search',
    npmPackage: '@modelcontextprotocol/server-brave-search',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'], env: { BRAVE_API_KEY: '$BRAVE_API_KEY' } }
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: 'Automate browser interactions using Puppeteer. Navigate pages, take screenshots, click elements, fill forms, and extract content from web pages. Runs a headless Chromium instance.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
    category: 'dev-tools',
    npmPackage: '@modelcontextprotocol/server-puppeteer',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'] }
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Persistent memory using a local knowledge graph. Store and retrieve entities, relationships, and observations across conversations. Helps AI assistants remember context between sessions.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    category: 'ai',
    npmPackage: '@modelcontextprotocol/server-memory',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] }
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'Fetch any URL and convert its HTML content to clean markdown. Supports web pages, documentation sites, and APIs. Useful for pulling reference material into conversations.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    category: 'search',
    npmPackage: '@modelcontextprotocol/server-fetch',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'] }
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Read channels, send messages, reply to threads, and search conversations in Slack workspaces. Integrate Slack communication directly into your AI-assisted workflows.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
    category: 'productivity',
    npmPackage: '@modelcontextprotocol/server-slack',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'], env: { SLACK_BOT_TOKEN: '$SLACK_BOT_TOKEN' } }
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Create, update, and search Linear issues, projects, and cycles. Manage your team\'s workflow, triage bugs, and track progress across sprints directly from your AI assistant.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/linear',
    category: 'productivity',
    npmPackage: '@modelcontextprotocol/server-linear',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-linear'], env: { LINEAR_API_KEY: '$LINEAR_API_KEY' } }
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Retrieve and analyze error reports, stack traces, and performance data from Sentry. Investigate production issues, search for specific errors, and understand crash patterns.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sentry',
    category: 'dev-tools',
    npmPackage: '@modelcontextprotocol/server-sentry',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sentry'], env: { SENTRY_AUTH_TOKEN: '$SENTRY_AUTH_TOKEN' } }
  },
  {
    id: 'context7',
    name: 'Context7',
    description: 'Pull up-to-date documentation, API references, and code examples for any programming library or framework. Ensures AI assistants have access to the latest docs rather than stale training data.',
    url: 'https://github.com/upstash/context7',
    category: 'ai',
    npmPackage: '@upstash/context7-mcp',
    template: { command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] }
  },
  {
    id: 'playwright',
    name: 'Playwright',
    description: 'Microsoft\'s official browser automation server. Interact with web pages through accessibility snapshots instead of screenshots — click, type, navigate, and extract content without needing vision capabilities.',
    url: 'https://github.com/microsoft/playwright-mcp',
    category: 'dev-tools',
    npmPackage: '@playwright/mcp',
    template: { command: 'npx', args: ['-y', '@playwright/mcp'] }
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Official Notion integration. Search pages, read and update content, query databases, and create new pages. Bring your team\'s knowledge base and project docs into AI-assisted workflows.',
    url: 'https://github.com/notionhq/notion-mcp-server',
    category: 'productivity',
    npmPackage: '@notionhq/notion-mcp-server',
    template: { command: 'npx', args: ['-y', '@notionhq/notion-mcp-server'], env: { OPENAPI_MCP_HEADERS: '{"Authorization":"Bearer $NOTION_TOKEN","Notion-Version":"2022-06-28"}' } }
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: 'Enhance AI reasoning with structured thought chains. Breaks complex problems into sequential steps with revision and branching support. Improves accuracy on multi-step logic, planning, and analysis tasks.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    category: 'ai',
    npmPackage: '@modelcontextprotocol/server-sequential-thinking',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] }
  },
  {
    id: 'git',
    name: 'Git',
    description: 'Read, search, and manipulate local Git repositories. View commit history, diffs, branches, and file contents at any revision. Useful for code review, history exploration, and repository analysis.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
    category: 'dev-tools',
    npmPackage: '@modelcontextprotocol/server-git',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-git'] }
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Interact with GitLab repositories, merge requests, CI/CD pipelines, and issues. Create and review MRs, manage issues, trigger pipelines, and automate GitLab workflows.',
    url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab',
    category: 'dev-tools',
    npmPackage: '@modelcontextprotocol/server-gitlab',
    template: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-gitlab'], env: { GITLAB_PERSONAL_ACCESS_TOKEN: '$GITLAB_TOKEN' } }
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    description: 'Turn any URL into clean, LLM-ready markdown. Crawls web pages, strips boilerplate and ads, and returns structured content. Supports batch crawling, sitemaps, and JavaScript-rendered pages.',
    url: 'https://github.com/mendableai/firecrawl-mcp-server',
    category: 'search',
    npmPackage: 'firecrawl-mcp',
    template: { command: 'npx', args: ['-y', 'firecrawl-mcp'], env: { FIRECRAWL_API_KEY: '$FIRECRAWL_API_KEY' } }
  },
  {
    id: 'exa',
    name: 'Exa',
    description: 'Semantic web search powered by neural embeddings. Find pages similar to a given URL, search by meaning rather than keywords, and get curated results for research and content discovery.',
    url: 'https://github.com/exa-labs/exa-mcp-server',
    category: 'search',
    npmPackage: 'exa-mcp-server',
    template: { command: 'npx', args: ['-y', 'exa-mcp-server'], env: { EXA_API_KEY: '$EXA_API_KEY' } }
  }
]

export const CATEGORY_LABELS: Record<McpCategory, string> = {
  filesystem: 'Filesystem',
  search: 'Search',
  database: 'Database',
  'dev-tools': 'Dev Tools',
  productivity: 'Productivity',
  ai: 'AI'
}
