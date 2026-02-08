import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@slayzone/types', '@slayzone/task', '@slayzone/projects', '@slayzone/tags', '@slayzone/settings', '@slayzone/terminal', '@slayzone/task-terminals', '@slayzone/worktrees', '@slayzone/diagnostics', '@slayzone/ai-config'] })],
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'node-pty']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@slayzone/types', '@slayzone/task-terminals'] })]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      exclude: ['@slayzone/types', '@slayzone/ui', '@slayzone/editor', '@slayzone/task', '@slayzone/tasks', '@slayzone/projects', '@slayzone/tags', '@slayzone/settings', '@slayzone/terminal', '@slayzone/task-terminals', '@slayzone/onboarding', '@slayzone/worktrees', '@slayzone/ai-config']
    }
  }
})
