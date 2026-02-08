import Database from 'better-sqlite3'

interface Migration {
  version: number
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'inbox',
          priority INTEGER NOT NULL DEFAULT 3,
          due_date TEXT,
          blocked_reason TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE workspace_items (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          content TEXT,
          url TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_tasks_project ON tasks(project_id);
        CREATE INDEX idx_tasks_parent ON tasks(parent_id);
        CREATE INDEX idx_tasks_status ON tasks(status);
        CREATE INDEX idx_workspace_task ON workspace_items(task_id);
      `)
    }
  },
  {
    version: 2,
    up: (db) => {
      db.exec(`
        CREATE TABLE tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL DEFAULT '#6b7280',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE task_tags (
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (task_id, tag_id)
        );

        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE INDEX idx_task_tags_task ON task_tags(task_id);
        CREATE INDEX idx_task_tags_tag ON task_tags(tag_id);
      `)
    }
  },
  {
    version: 3,
    up: (db) => {
      db.exec(`
        CREATE TABLE chat_messages (
          id TEXT PRIMARY KEY,
          workspace_item_id TEXT NOT NULL REFERENCES workspace_items(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_chat_messages_workspace ON chat_messages(workspace_item_id);
      `)
    }
  },
  {
    version: 4,
    up: (db) => {
      db.exec(`
        ALTER TABLE tasks ADD COLUMN archived_at TEXT DEFAULT NULL;
        CREATE INDEX idx_tasks_archived ON tasks(archived_at);
      `)
    }
  },
  {
    version: 5,
    up: (db) => {
      db.exec(`
        ALTER TABLE tasks ADD COLUMN recurrence_type TEXT DEFAULT NULL;
        ALTER TABLE tasks ADD COLUMN recurrence_interval INTEGER DEFAULT NULL;
        ALTER TABLE tasks ADD COLUMN last_reset_at TEXT DEFAULT NULL;
        ALTER TABLE tasks ADD COLUMN next_reset_at TEXT DEFAULT NULL;
        CREATE INDEX idx_tasks_recurring ON tasks(next_reset_at) WHERE recurrence_type IS NOT NULL;
      `)
    }
  },
  {
    version: 6,
    up: (db) => {
      db.exec(`
        ALTER TABLE workspace_items ADD COLUMN favicon TEXT DEFAULT NULL;
      `)
    }
  },
  {
    version: 7,
    up: (db) => {
      db.exec(`
        ALTER TABLE tasks ADD COLUMN last_active_workspace_item_id TEXT DEFAULT NULL;
      `)
    }
  },
  {
    version: 8,
    up: (db) => {
      // Cleanup: remove unused tables and columns
      db.exec(`
        DROP TABLE IF EXISTS chat_messages;
        DROP TABLE IF EXISTS workspace_items;
        DROP INDEX IF EXISTS idx_tasks_parent;
        DROP INDEX IF EXISTS idx_tasks_recurring;
        ALTER TABLE tasks DROP COLUMN parent_id;
        ALTER TABLE tasks DROP COLUMN blocked_reason;
        ALTER TABLE tasks DROP COLUMN recurrence_type;
        ALTER TABLE tasks DROP COLUMN recurrence_interval;
        ALTER TABLE tasks DROP COLUMN last_reset_at;
        ALTER TABLE tasks DROP COLUMN next_reset_at;
        ALTER TABLE tasks DROP COLUMN last_active_workspace_item_id;
      `)
    }
  },
  {
    version: 9,
    up: (db) => {
      db.exec(`
        ALTER TABLE projects ADD COLUMN path TEXT DEFAULT NULL;
        ALTER TABLE tasks ADD COLUMN claude_session_id TEXT DEFAULT NULL;

        CREATE TABLE task_dependencies (
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          blocks_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          PRIMARY KEY (task_id, blocks_task_id)
        );

        CREATE INDEX idx_task_deps_task ON task_dependencies(task_id);
        CREATE INDEX idx_task_deps_blocks ON task_dependencies(blocks_task_id);
      `)
    }
  },
  {
    version: 10,
    up: (db) => {
      db.exec(`
        CREATE TABLE terminal_sessions (
          task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
          buffer TEXT NOT NULL,
          serialized_state TEXT,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `)
    }
  },
  {
    version: 11,
    up: (db) => {
      // Add terminal mode columns
      // Rename claude_session_id to claude_conversation_id (SQLite doesn't support direct rename, so add new + migrate)
      db.exec(`
        ALTER TABLE tasks ADD COLUMN terminal_mode TEXT DEFAULT 'claude-code';
        ALTER TABLE tasks ADD COLUMN claude_conversation_id TEXT DEFAULT NULL;
        ALTER TABLE tasks ADD COLUMN codex_conversation_id TEXT DEFAULT NULL;
        ALTER TABLE tasks ADD COLUMN terminal_shell TEXT DEFAULT NULL;
      `)
      // Migrate data from old column to new
      db.exec(`
        UPDATE tasks SET claude_conversation_id = claude_session_id WHERE claude_session_id IS NOT NULL;
      `)
      // Note: SQLite doesn't support DROP COLUMN in older versions, keep claude_session_id for backwards compat
    }
  },
  {
    version: 12,
    up: (db) => {
      // Remove unused terminal_sessions table - sessions are now handled entirely in-memory
      db.exec(`DROP TABLE IF EXISTS terminal_sessions;`)
    }
  },
  {
    version: 13,
    up: (db) => {
      db.exec(`ALTER TABLE tasks ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;`)
      db.exec(`UPDATE tasks SET "order" = rowid;`)
    }
  },
  {
    version: 14,
    up: (db) => {
      db.exec(`ALTER TABLE tasks ADD COLUMN dangerously_skip_permissions INTEGER NOT NULL DEFAULT 0;`)
    }
  },
  {
    version: 15,
    up: (db) => {
      db.exec(`
        CREATE TABLE worktrees (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          path TEXT NOT NULL,
          branch TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE UNIQUE INDEX idx_worktrees_task ON worktrees(task_id);
      `)
    }
  },
  {
    version: 16,
    up: (db) => {
      db.exec(`ALTER TABLE tasks ADD COLUMN panel_visibility TEXT DEFAULT NULL;`)
    }
  },
  {
    version: 17,
    up: (db) => {
      // Add worktree_path and browser_url to tasks
      db.exec(`
        ALTER TABLE tasks ADD COLUMN worktree_path TEXT DEFAULT NULL;
        ALTER TABLE tasks ADD COLUMN browser_url TEXT DEFAULT NULL;
      `)
      // Migrate existing worktree paths to tasks
      db.exec(`
        UPDATE tasks
        SET worktree_path = (
          SELECT path FROM worktrees WHERE worktrees.task_id = tasks.id
        )
        WHERE id IN (SELECT task_id FROM worktrees)
      `)
      // Drop worktrees table
      db.exec(`
        DROP INDEX IF EXISTS idx_worktrees_task;
        DROP TABLE IF EXISTS worktrees;
      `)
    }
  },
  {
    version: 18,
    up: (db) => {
      // Add browser_tabs JSON column for multi-tab browser support
      db.exec(`ALTER TABLE tasks ADD COLUMN browser_tabs TEXT DEFAULT NULL;`)

      // Migrate existing browser_url values to browser_tabs JSON
      // Using task_id as tab id since we need deterministic IDs in migration
      const tasks = db.prepare(`SELECT id, browser_url FROM tasks WHERE browser_url IS NOT NULL AND browser_url != ''`).all() as Array<{ id: string; browser_url: string }>
      const updateStmt = db.prepare(`UPDATE tasks SET browser_tabs = ? WHERE id = ?`)
      for (const task of tasks) {
        const tabId = `tab-${task.id.slice(0, 8)}`
        const browserTabs = JSON.stringify({
          tabs: [{ id: tabId, url: task.browser_url, title: task.browser_url }],
          activeTabId: tabId
        })
        updateStmt.run(browserTabs, task.id)
      }
    }
  },
  {
    version: 19,
    up: (db) => {
      // Create terminal_tabs table for multi-tab terminal support
      // Use IF NOT EXISTS to handle partial migration state
      db.exec(`
        CREATE TABLE IF NOT EXISTS terminal_tabs (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          label TEXT,
          mode TEXT NOT NULL DEFAULT 'terminal',
          is_main INTEGER NOT NULL DEFAULT 0,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_terminal_tabs_task ON terminal_tabs(task_id);
      `)

      // Create main tab for each existing task using its terminal_mode
      // Use taskId as tab id (unique since each task has one main tab)
      // Use INSERT OR IGNORE to skip tasks that already have a main tab
      const tasks = db.prepare(`SELECT id, terminal_mode FROM tasks`).all() as Array<{ id: string; terminal_mode: string | null }>
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO terminal_tabs (id, task_id, label, mode, is_main, position, created_at)
        VALUES (?, ?, NULL, ?, 1, 0, datetime('now'))
      `)
      for (const task of tasks) {
        insertStmt.run(task.id, task.id, task.terminal_mode || 'claude-code')
      }
    }
  },
  {
    version: 20,
    up: (db) => {
      db.exec(`ALTER TABLE tasks ADD COLUMN worktree_parent_branch TEXT DEFAULT NULL;`)
    }
  },
  {
    version: 21,
    up: (db) => {
      db.exec(`
        ALTER TABLE tasks ADD COLUMN claude_flags TEXT NOT NULL DEFAULT '';
        ALTER TABLE tasks ADD COLUMN codex_flags TEXT NOT NULL DEFAULT '';
      `)
      db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`)
        .run('default_claude_flags', '--dangerously-skip-permissions')
      db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`)
        .run('default_codex_flags', '--full-auto --search')
    }
  },
  {
    version: 22,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS diagnostics_events (
          id TEXT PRIMARY KEY,
          ts_ms INTEGER NOT NULL,
          level TEXT NOT NULL,
          source TEXT NOT NULL,
          event TEXT NOT NULL,
          trace_id TEXT,
          task_id TEXT,
          project_id TEXT,
          session_id TEXT,
          channel TEXT,
          message TEXT,
          payload_json TEXT,
          redaction_version INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_diag_ts ON diagnostics_events(ts_ms);
        CREATE INDEX IF NOT EXISTS idx_diag_level_ts ON diagnostics_events(level, ts_ms);
        CREATE INDEX IF NOT EXISTS idx_diag_trace ON diagnostics_events(trace_id);
        CREATE INDEX IF NOT EXISTS idx_diag_source_event_ts ON diagnostics_events(source, event, ts_ms);
      `)

      db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`)
        .run('diagnostics_enabled', '1')
      db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`)
        .run('diagnostics_verbose', '0')
      db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`)
        .run('diagnostics_include_pty_output', '0')
      db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`)
        .run('diagnostics_retention_days', '14')
    }
  },
  {
    version: 23,
    up: (db) => {
      db.exec(`ALTER TABLE tasks ADD COLUMN merge_state TEXT DEFAULT NULL;`)
    }
  },
  {
    version: 24,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_config_items (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          scope TEXT NOT NULL,
          project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_ai_config_items_scope_type ON ai_config_items(scope, type);
        CREATE INDEX IF NOT EXISTS idx_ai_config_items_project ON ai_config_items(project_id);

        CREATE TABLE IF NOT EXISTS ai_config_project_selections (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          item_id TEXT NOT NULL REFERENCES ai_config_items(id) ON DELETE CASCADE,
          target_path TEXT NOT NULL,
          selected_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(project_id, item_id)
        );
        CREATE INDEX IF NOT EXISTS idx_ai_config_sel_project ON ai_config_project_selections(project_id);
        CREATE INDEX IF NOT EXISTS idx_ai_config_sel_item ON ai_config_project_selections(item_id);

        CREATE TABLE IF NOT EXISTS ai_config_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          kind TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'placeholder',
          last_checked_at TEXT DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `)
    }
  }
]

export function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      db.transaction(() => {
        migration.up(db)
        db.pragma(`user_version = ${migration.version}`)
      })()
      console.log(`Migration ${migration.version} applied`)
    }
  }
}
