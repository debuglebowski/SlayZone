import { z } from 'zod'

// Task status enum matching database.ts
export const taskStatusEnum = z.enum([
  'inbox',
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done'
])

// Priority 1-5
export const priorityEnum = z.number().int().min(1).max(5)

// Task creation schema
export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1, 'Title required').max(200, 'Title too long'),
  description: z.string().max(5000).optional(),
  status: taskStatusEnum.default('inbox'),
  priority: priorityEnum.default(3),
  dueDate: z.string().nullable().optional(), // ISO date string YYYY-MM-DD
})

// Task update schema (all optional except id)
export const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: taskStatusEnum.optional(),
  priority: priorityEnum.optional(),
  dueDate: z.string().nullable().optional(),
  blockedReason: z.string().max(500).nullable().optional(),
})

// Project creation schema
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name required').max(100, 'Name too long'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color'),
})

// Project update schema
export const updateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// Inferred types for forms
export type CreateTaskFormData = z.infer<typeof createTaskSchema>
export type UpdateTaskFormData = z.infer<typeof updateTaskSchema>
export type CreateProjectFormData = z.infer<typeof createProjectSchema>
export type UpdateProjectFormData = z.infer<typeof updateProjectSchema>

// Status options for Select
export const statusOptions = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
] as const

// Priority options for Select
export const priorityOptions = [
  { value: 1, label: 'P1 - Urgent' },
  { value: 2, label: 'P2 - High' },
  { value: 3, label: 'P3 - Medium' },
  { value: 4, label: 'P4 - Low' },
  { value: 5, label: 'P5 - Someday' },
] as const
