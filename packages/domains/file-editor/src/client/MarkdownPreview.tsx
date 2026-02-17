import { useState, useEffect, useRef, useMemo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.min.css'

interface MarkdownPreviewProps {
  content: string
  scrollRef?: React.Ref<HTMLDivElement>
  /** Absolute project root path */
  projectPath?: string
  /** Relative path of the markdown file within the project */
  filePath?: string
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  const firstRun = useRef(true)

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])

  return debounced
}

export function MarkdownPreview({ content, scrollRef, projectPath, filePath }: MarkdownPreviewProps) {
  const debouncedContent = useDebouncedValue(content, 200)

  const components = useMemo<Components>(() => {
    if (!projectPath || !filePath) return {}
    // Directory of the markdown file (relative to project root)
    const fileDir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : ''
    return {
      img: ({ src, ...props }) => {
        let resolvedSrc = src
        if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
          // Resolve relative path against markdown file's directory
          const parts = (fileDir ? fileDir + '/' + src : src).split('/')
          const normalized: string[] = []
          for (const p of parts) {
            if (p === '..') normalized.pop()
            else if (p && p !== '.') normalized.push(p)
          }
          resolvedSrc = 'slz-file://' + projectPath + '/' + normalized.join('/')
        }
        return <img {...props} src={resolvedSrc} />
      }
    }
  }, [projectPath, filePath])

  return (
    <div ref={scrollRef} className="h-full overflow-auto p-6">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeHighlight]} components={components}>{debouncedContent}</ReactMarkdown>
      </div>
    </div>
  )
}
