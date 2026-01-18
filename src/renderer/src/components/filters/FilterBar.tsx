import { motion } from 'framer-motion'
import type { Tag } from '../../../../shared/types/database'
import { GroupBySelect } from './GroupBySelect'
import type { FilterState, GroupKey, DueDateRange } from './FilterState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { TagIcon } from 'lucide-react'

interface FilterBarProps {
  filter: FilterState
  onChange: (f: FilterState) => void
  tags: Tag[]
}

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: '1', label: 'P1' },
  { value: '2', label: 'P2' },
  { value: '3', label: 'P3' },
  { value: '4', label: 'P4' },
  { value: '5', label: 'P5' }
]

const DUE_DATE_OPTIONS: { value: DueDateRange; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'later', label: 'Later' }
]

export function FilterBar({ filter, onChange, tags }: FilterBarProps): React.JSX.Element {
  const handleGroupByChange = (groupBy: GroupKey): void => {
    onChange({ ...filter, groupBy })
  }

  const handlePriorityChange = (value: string): void => {
    const priority = value === 'all' ? null : parseInt(value, 10)
    onChange({ ...filter, priority })
  }

  const handleDueDateRangeChange = (dueDateRange: DueDateRange): void => {
    onChange({ ...filter, dueDateRange })
  }

  const handleTagToggle = (tagId: string): void => {
    const tagIds = filter.tagIds.includes(tagId)
      ? filter.tagIds.filter((id) => id !== tagId)
      : [...filter.tagIds, tagId]
    onChange({ ...filter, tagIds })
  }

  const handleShowDoneChange = (showDone: boolean): void => {
    onChange({ ...filter, showDone })
  }

  const handleShowArchivedChange = (showArchived: boolean): void => {
    onChange({ ...filter, showArchived })
  }

  const selectedTagCount = filter.tagIds.length

  return (
    <motion.div
      className="flex items-center gap-4 flex-wrap"
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.033 }}
    >
      {/* Group By */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Group</Label>
        <GroupBySelect value={filter.groupBy} onChange={handleGroupByChange} />
      </div>

      {/* Priority Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Priority</Label>
        <Select
          value={filter.priority === null ? 'all' : String(filter.priority)}
          onValueChange={handlePriorityChange}
        >
          <SelectTrigger className="w-[80px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Due Date Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Due</Label>
        <Select
          value={filter.dueDateRange}
          onValueChange={(v) => handleDueDateRangeChange(v as DueDateRange)}
        >
          <SelectTrigger className="w-[100px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DUE_DATE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tags Filter */}
      {tags.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <TagIcon className="size-4" />
              Tags
              {selectedTagCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {selectedTagCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            <div className="flex flex-col gap-1">
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={filter.tagIds.includes(tag.id)}
                    onCheckedChange={() => handleTagToggle(tag.id)}
                  />
                  <span className="size-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm">{tag.name}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Toggle Switches */}
      <div className="flex items-center gap-4 ml-auto">
        <div className="flex items-center gap-2">
          <Switch id="show-done" checked={filter.showDone} onCheckedChange={handleShowDoneChange} />
          <Label htmlFor="show-done" className="text-xs cursor-pointer">
            Done
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-archived"
            checked={filter.showArchived}
            onCheckedChange={handleShowArchivedChange}
          />
          <Label htmlFor="show-archived" className="text-xs cursor-pointer">
            Archived
          </Label>
        </div>
      </div>
    </motion.div>
  )
}
