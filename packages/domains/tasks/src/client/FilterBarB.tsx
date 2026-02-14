import type { Tag } from '@slayzone/tags/shared'
import type { FilterState, GroupKey, DueDateRange, SortKey } from './FilterState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@slayzone/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@slayzone/ui'
import { Button } from '@slayzone/ui'
import { Checkbox } from '@slayzone/ui'
import { Switch } from '@slayzone/ui'
import { Label } from '@slayzone/ui'
import { ListFilter, Layers, ArrowUpDown, Eye } from 'lucide-react'

interface FilterBarBProps {
  filter: FilterState
  onChange: (f: FilterState) => void
  tags: Tag[]
}

const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'due_date', label: 'Due Date' }
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'priority', label: 'Priority' },
  { value: 'due_date', label: 'Due date' },
  { value: 'title', label: 'Title' },
  { value: 'created', label: 'Newest first' }
]

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: '1', label: 'P1 — Urgent' },
  { value: '2', label: 'P2 — High' },
  { value: '3', label: 'P3 — Medium' },
  { value: '4', label: 'P4 — Low' },
  { value: '5', label: 'P5 — None' }
]

const DUE_DATE_OPTIONS: { value: DueDateRange; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'later', label: 'Later' }
]

export function FilterBarB({ filter, onChange, tags }: FilterBarBProps): React.JSX.Element {
  const activeFilterCount =
    (filter.priority !== null ? 1 : 0) +
    (filter.dueDateRange !== 'all' ? 1 : 0) +
    (filter.tagIds.length > 0 ? 1 : 0)

  return (
    <div className="ml-auto flex items-center gap-1">
      {/* Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1.5 px-2 text-xs font-medium ${activeFilterCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <ListFilter className="size-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          <div className="space-y-3">
            {/* Priority */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Priority</Label>
              <Select
                value={filter.priority === null ? 'all' : String(filter.priority)}
                onValueChange={(v) => onChange({ ...filter, priority: v === 'all' ? null : parseInt(v, 10) })}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Due date</Label>
              <Select
                value={filter.dueDateRange}
                onValueChange={(v) => onChange({ ...filter, dueDateRange: v as DueDateRange })}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DUE_DATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Tags</Label>
                <div className="flex flex-col gap-0.5">
                  {tags.map((tag) => (
                    <label
                      key={tag.id}
                      className="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={filter.tagIds.includes(tag.id)}
                        onCheckedChange={() => {
                          const tagIds = filter.tagIds.includes(tag.id)
                            ? filter.tagIds.filter((id) => id !== tag.id)
                            : [...filter.tagIds, tag.id]
                          onChange({ ...filter, tagIds })
                        }}
                      />
                      <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="text-sm">{tag.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Reset */}
            {activeFilterCount > 0 && (
              <>
                <div className="h-px bg-border" />
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => onChange({ ...filter, priority: null, dueDateRange: 'all', tagIds: [] })}
                >
                  Reset filters
                </button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div className="h-4 w-px bg-border" />

      {/* Group By */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs font-medium text-muted-foreground">
            <Layers className="size-3.5" />
            Group
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1" align="end">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors ${
                filter.groupBy === opt.value ? 'bg-accent font-medium' : ''
              }`}
              onClick={() => onChange({ ...filter, groupBy: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <div className="h-4 w-px bg-border" />

      {/* Sort */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1.5 px-2 text-xs font-medium ${filter.sortBy !== 'manual' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <ArrowUpDown className="size-3.5" />
            Sort
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1" align="end">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors ${
                filter.sortBy === opt.value ? 'bg-accent font-medium' : ''
              }`}
              onClick={() => onChange({ ...filter, sortBy: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <div className="h-4 w-px bg-border" />

      {/* View Options */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs font-medium text-muted-foreground">
            <Eye className="size-3.5" />
            View
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3" align="end">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="b-done" className="text-sm cursor-pointer">Completed</Label>
              <Switch id="b-done" checked={filter.showDone} onCheckedChange={(v) => onChange({ ...filter, showDone: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="b-archived" className="text-sm cursor-pointer">Archived</Label>
              <Switch id="b-archived" checked={filter.showArchived} onCheckedChange={(v) => onChange({ ...filter, showArchived: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="b-subtasks" className="text-sm cursor-pointer">Sub-tasks</Label>
              <Switch id="b-subtasks" checked={filter.showSubTasks} onCheckedChange={(v) => onChange({ ...filter, showSubTasks: v })} />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
