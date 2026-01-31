import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@omgslayzone/types', '@omgslayzone/task', '@omgslayzone/projects', '@omgslayzone/tags', '@omgslayzone/settings', '@omgslayzone/terminal', '@omgslayzone/worktrees'] })],
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'node-pty']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@omgslayzone/types'] })]
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
      exclude: ['@omgslayzone/types', '@omgslayzone/ui', '@omgslayzone/editor', '@omgslayzone/task', '@omgslayzone/tasks', '@omgslayzone/projects', '@omgslayzone/tags', '@omgslayzone/settings', '@omgslayzone/terminal', '@omgslayzone/onboarding', '@omgslayzone/worktrees']
    }
  }
})
