import { useState, useEffect } from 'react'
import type { Project } from '../../shared/types/database'

function App(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[]>([])
  const [status, setStatus] = useState<string>('Loading...')

  useEffect(() => {
    // Test IPC on mount
    window.api.db
      .getProjects()
      .then((p) => {
        setProjects(p)
        setStatus(`Found ${p.length} projects`)
      })
      .catch((err) => setStatus(`Error: ${err.message}`))
  }, [])

  const createTestProject = async (): Promise<void> => {
    const project = await window.api.db.createProject({
      name: 'Test Project',
      color: '#3b82f6'
    })
    setProjects([...projects, project])
    setStatus(`Created project: ${project.name}`)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 p-8">
      <h1 className="text-4xl font-bold text-white">Focus</h1>
      <p className="text-slate-400">{status}</p>
      <button
        onClick={createTestProject}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Create Test Project
      </button>
      {projects.length > 0 && (
        <ul className="mt-4 space-y-2">
          {projects.map((p) => (
            <li key={p.id} className="text-white">
              <span
                className="mr-2 inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
