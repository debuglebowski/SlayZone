import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useTRPC } from '@slayzone/transport/client'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { Task } from '@slayzone/task/shared'
import { track } from '@slayzone/telemetry/client'

export interface UseSubTasksReturn {
  subTasks: Task[]
  createSubTask: (params: { projectId: string; title: string; status: string }) => Promise<Task | null>
  updateSubTask: (subId: string, updates: Record<string, unknown>) => Promise<void>
  deleteSubTask: (subId: string) => Promise<void>
  handleDragEnd: (event: DragEndEvent) => void
}

export function useSubTasks(
  parentId: string | null | undefined,
  initialSubTasks?: Task[]
): UseSubTasksReturn {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const subTasksQuery = useQuery({
    ...trpc.task.getSubTasks.queryOptions({ parentId: parentId ?? '' }),
    enabled: !!parentId,
    initialData: initialSubTasks,
  })
  const subTasks = subTasksQuery.data ?? []

  const invalidate = useCallback(() => {
    if (parentId) {
      queryClient.invalidateQueries({ queryKey: trpc.task.getSubTasks.queryKey({ parentId }) })
    }
  }, [parentId, queryClient, trpc])

  // Re-fetch subtasks on external changes (CLI, MCP)
  useSubscription(
    trpc.task.onChanged.subscriptionOptions(undefined, {
      enabled: !!parentId,
      onData: () => invalidate(),
    }),
  )

  const createMutation = useMutation(trpc.task.create.mutationOptions({
    onSuccess: () => invalidate(),
  }))
  const updateMutation = useMutation(trpc.task.update.mutationOptions({
    onSuccess: () => invalidate(),
  }))
  const deleteMutation = useMutation(trpc.task.delete.mutationOptions({
    onSuccess: () => invalidate(),
  }))
  const reorderMutation = useMutation(trpc.task.reorder.mutationOptions({
    onSuccess: () => invalidate(),
  }))

  const createSubTask = useCallback(async (params: { projectId: string; title: string; status: string }): Promise<Task | null> => {
    if (!parentId) return null
    const sub = await createMutation.mutateAsync({
      projectId: params.projectId,
      title: params.title,
      parentId,
      status: params.status,
    })
    if (sub) track('subtask_created')
    return sub
  }, [parentId, createMutation])

  const updateSubTask = useCallback(async (subId: string, updates: Record<string, unknown>): Promise<void> => {
    await updateMutation.mutateAsync({ id: subId, ...updates })
  }, [updateMutation])

  const deleteSubTask = useCallback(async (subId: string): Promise<void> => {
    await deleteMutation.mutateAsync({ id: subId })
  }, [deleteMutation])

  const handleDragEnd = useCallback((event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = subTasks.findIndex(s => s.id === active.id)
    const newIndex = subTasks.findIndex(s => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(subTasks, oldIndex, newIndex)
    // Optimistic cache update
    if (parentId) {
      queryClient.setQueryData(trpc.task.getSubTasks.queryKey({ parentId }), reordered)
    }
    reorderMutation.mutate({ taskIds: reordered.map(t => t.id) })
  }, [subTasks, parentId, queryClient, trpc, reorderMutation])

  return { subTasks, createSubTask, updateSubTask, deleteSubTask, handleDragEnd }
}
