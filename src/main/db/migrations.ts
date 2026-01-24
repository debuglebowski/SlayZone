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
