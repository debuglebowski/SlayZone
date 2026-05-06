import { LayoutGrid, ListTree } from 'lucide-react'
import type { SidebarView } from './types'
import { ProjectsRailView } from './ProjectsRailView'
import { TreeView } from './TreeView'

export const viewRegistry: SidebarView[] = [
  {
    id: 'projects',
    label: 'Projects',
    icon: LayoutGrid,
    width: 'w-18',
    footerLayout: 'vertical',
    render: (ctx) => <ProjectsRailView {...ctx} />,
  },
  {
    id: 'tree',
    label: 'Tree',
    icon: ListTree,
    width: 'w-80',
    footerLayout: 'horizontal',
    resizable: true,
    defaultWidth: 320,
    minWidth: 220,
    maxWidth: 480,
    render: (ctx) => <TreeView {...ctx} />,
  },
]

export const getView = (id: string): SidebarView =>
  viewRegistry.find((v) => v.id === id) ?? viewRegistry[0]
