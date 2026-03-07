export interface TestCategory {
  id: string
  project_id: string
  name: string
  pattern: string
  color: string
  sort_order: number
}

export interface CreateTestCategoryInput {
  project_id: string
  name: string
  pattern: string
  color?: string
}

export interface UpdateTestCategoryInput {
  id: string
  name?: string
  pattern?: string
  color?: string
  sort_order?: number
}

export interface TestProfile {
  id: string
  name: string
  categories: { name: string; pattern: string; color: string }[]
}

export interface TestFileMatch {
  path: string
  categoryId: string
}

export interface ScanResult {
  matches: TestFileMatch[]
  totalScanned: number
}

export interface TestLabel {
  id: string
  project_id: string
  name: string
  color: string
  sort_order: number
}

export interface TestFileLabel {
  project_id: string
  file_path: string
  label_id: string
}

export interface TestFileNote {
  project_id: string
  file_path: string
  note: string
}

export interface CreateTestLabelInput {
  project_id: string
  name: string
  color?: string
}

export interface UpdateTestLabelInput {
  id: string
  name?: string
  color?: string
  sort_order?: number
}

export const DEFAULT_PROFILES: TestProfile[] = [
  {
    id: 'builtin:typescript',
    name: 'TypeScript',
    categories: [
      { name: 'Unit', pattern: '**/*.test.{ts,tsx}', color: '#3b82f6' },
      { name: 'E2E', pattern: '**/e2e/**/*.spec.ts', color: '#8b5cf6' },
    ],
  },
  {
    id: 'builtin:python',
    name: 'Python',
    categories: [
      { name: 'Unit', pattern: '**/test_*.py', color: '#22c55e' },
      { name: 'E2E', pattern: '**/e2e/**/test_*.py', color: '#eab308' },
    ],
  },
]
