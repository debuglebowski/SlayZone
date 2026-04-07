// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { indent } from '@milkdown/plugin-indent'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { replaceAll } from '@milkdown/utils'
import { taskListPlugin } from './milkdown-task-list'
import { listItemMovePlugin } from './milkdown-list-move'
import { escapeBlurPlugin } from './milkdown-escape-blur'

afterEach(() => {
  document.body.innerHTML = ''
})

async function createEditor(markdown: string): Promise<{ editor: Editor; container: HTMLElement }> {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, container)
      ctx.set(defaultValueCtx, markdown)
    })
    .use(commonmark)
    .use(gfm)
    .use(taskListPlugin)
    .create()

  return { editor, container }
}

/** Full editor — matches the plugin set from RichTextEditor */
async function createFullEditor(markdown: string): Promise<{ editor: Editor; container: HTMLElement }> {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, container)
      ctx.set(defaultValueCtx, markdown)
    })
    .config((ctx) => {
      ctx.get(listenerCtx).markdownUpdated(() => {})
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(indent)
    .use(listener)
    .use(listItemMovePlugin)
    .use(escapeBlurPlugin)
    .use(taskListPlugin)
    .create()

  return { editor, container }
}

describe('Milkdown task list rendering', () => {
  it('renders checkbox input for task list items', async () => {
    const { editor, container } = await createEditor('- [ ] unchecked task')

    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes.length).toBeGreaterThan(0)
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false)

    await editor.destroy()
  })

  it('renders checked checkbox for [x] items', async () => {
    const { editor, container } = await createEditor('- [x] checked task')

    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes.length).toBeGreaterThan(0)
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true)

    await editor.destroy()
  })

  it('sets data-item-type="task" on task list items', async () => {
    const { editor, container } = await createEditor('- [ ] task item')

    const taskItems = container.querySelectorAll('li[data-item-type="task"]')
    expect(taskItems.length).toBeGreaterThan(0)

    await editor.destroy()
  })

  it('does not render checkbox for regular list items', async () => {
    const { editor, container } = await createEditor('- regular item')

    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)

    await editor.destroy()
  })

  it('does NOT render checkbox without taskListPlugin', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container)
        ctx.set(defaultValueCtx, '- [ ] missing plugin')
      })
      .use(commonmark)
      .use(gfm)
      .create()

    // GFM schema parses task list attrs, but without the plugin no checkbox is rendered
    const li = container.querySelector('li[data-item-type="task"]')
    expect(li).not.toBeNull()
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)

    await editor.destroy()
  })

  it('renders checkbox with full plugin set', async () => {
    const { editor, container } = await createFullEditor('- [ ] full editor task')

    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)

    await editor.destroy()
  })

  it('renders checkbox after replaceAll (async content load)', async () => {
    const { editor, container } = await createFullEditor('')

    editor.action(replaceAll('- [ ] async loaded task', true))

    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)

    await editor.destroy()
  })
})
