import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

// Biome owns format + ~all lint. ESLint kept ONLY for React Compiler
// experimental rules from eslint-plugin-react-hooks v7 — biome has no
// equivalent. Other plugins are loaded as stubs (all rules off) so the
// ~120 legacy `// eslint-disable-next-line @typescript-eslint/...` /
// `// eslint-disable-next-line react/...` comments scattered across the
// codebase don't trigger "Definition for rule not found" errors.

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/dist-electron',
      '**/out',
      '**/build',
      '**/.vite',
      '**/.astro',
      '**/coverage',
      '**/.e2e-runtime/**',
      '**/.e2e-userdata/**',
      '.claude/worktrees/**',
      'convex/_generated/**'
    ]
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      react: eslintPluginReact,
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off'
    },
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/static-components': 'warn'
    }
  }
)
