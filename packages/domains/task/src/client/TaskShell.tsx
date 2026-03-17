import { useEffect } from 'react'
import { Skeleton } from '@slayzone/ui'

/** Skeleton fallback for TaskDetailPage Suspense boundary. Matches the task layout structure. */
export function TaskShell(): React.JSX.Element {
  useEffect(() => {
    performance.mark('sz:suspense:taskShell:mount')
    return () => { performance.mark('sz:suspense:taskShell:unmount') }
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Skeleton className="h-5 w-40" />
        <div className="flex-1" />
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      {/* Panel area skeleton */}
      <div className="flex-1 flex">
        <div className="flex-1 bg-background" />
      </div>
    </div>
  )
}
