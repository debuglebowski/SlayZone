import { useEffect, useState } from 'react'
import type { Project } from '../../../../../shared/types/database'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface ProjectSelectProps {
  value: string | undefined
  onChange: (value: string) => void
  disabled?: boolean
}

export function ProjectSelect({
  value,
  onChange,
  disabled
}: ProjectSelectProps): React.JSX.Element {
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    window.api.db.getProjects().then(setProjects)
  }, [])

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select project" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
              {project.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
