import {
  DndContext,
  PointerSensor,
  useSensors,
  useSensor,
  closestCenter,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SidebarMenu, SidebarMenuItem, cn } from '@slayzone/ui'
import { useDialogStore } from '@slayzone/settings'
import { ProjectItem } from '../ProjectItem'
import type { SidebarViewContext } from './types'

export function ProjectsRailView({
  projects,
  selectedProjectId,
  onSelectProject,
  onProjectSettings,
  onReorderProjects,
  idleByProject,
}: SidebarViewContext) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = projects.findIndex((p) => p.id === active.id)
    const newIndex = projects.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(projects, oldIndex, newIndex)
    onReorderProjects(newOrder.map((p) => p.id))
  }

  return (
    <SidebarMenu className="flex flex-col items-center gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {projects.map((project) => (
            <SidebarMenuItem key={project.id}>
              <ProjectItem
                project={project}
                selected={selectedProjectId === project.id}
                onClick={() => onSelectProject(project.id)}
                onSettings={() => onProjectSettings(project)}
                onDelete={() => useDialogStore.getState().openDeleteProject(project)}
                idleCount={idleByProject?.get(project.id) ?? 0}
              />
            </SidebarMenuItem>
          ))}
        </SortableContext>
      </DndContext>

      <SidebarMenuItem>
        <button
          onClick={() => useDialogStore.getState().openCreateProject()}
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            'text-lg text-muted-foreground border-2 border-dashed',
            'hover:border-primary hover:text-primary transition-colors'
          )}
          title="Add project"
        >
          +
        </button>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
