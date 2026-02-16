import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.min.css'

interface MarkdownPreviewProps {
  content: string
  scrollRef?: React.Ref<HTMLDivElement>
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

export function MarkdownPreview({ content, scrollRef }: MarkdownPreviewProps) {
  const debouncedContent = useDebouncedValue(content, 200)

  return (
    <div ref={scrollRef} className="h-full overflow-auto p-6">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeHighlight]}>{debouncedContent}</ReactMarkdown>
      </div>
    </div>
  )
}
