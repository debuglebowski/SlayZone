export interface Project {
  id: string
  name: string
  color: string
  path: string | null
  created_at: string
  updated_at: string
}

export interface CreateProjectInput {
  name: string
  color: string
  path?: string
}

export interface UpdateProjectInput {
  id: string
  name?: string
  color?: string
  path?: string | null
}
