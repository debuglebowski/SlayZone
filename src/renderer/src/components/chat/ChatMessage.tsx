import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { MessageActions } from './MessageActions'
import type { ChatMessage as ChatMessageType } from '../../../../shared/types/api'
import type { Components } from 'react-markdown'

interface Props {
  message: ChatMessageType
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'
  const [isHovered, setIsHovered] = useState(false)
  const { theme } = useTheme()

  // Determine theme based on dark mode
  const codeTheme = theme === 'dark' ? oneDark : oneLight

  // Custom components for markdown rendering
  const markdownComponents: Partial<Components> = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const isInline = !match
      const language = match ? match[1] : ''
      const codeString = String(children).replace(/\n$/, '')

      return !isInline && match ? (
        <div className="relative my-4">
          <SyntaxHighlighter
            language={language}
            style={codeTheme}
            PreTag="div"
            className="rounded-lg !m-0"
            customStyle={
              {
                margin: 0,
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                lineHeight: '1.5'
              } as React.CSSProperties
            }
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code
          className={cn(
            'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm',
            className
          )}
          {...props}
        >
          {children}
        </code>
      )
    },
    p({ children }) {
      return <p className="mb-4 last:mb-0 leading-7">{children}</p>
    },
    h1({ children }) {
      return <h1 className="text-2xl font-semibold mb-3 mt-6 first:mt-0">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="text-xl font-semibold mb-2 mt-5 first:mt-0">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0">{children}</h3>
    },
    ul({ children }) {
      return <ul className="list-disc list-inside mb-4 space-y-1 ml-4">{children}</ul>
    },
    ol({ children }) {
      return <ol className="list-decimal list-inside mb-4 space-y-1 ml-4">{children}</ol>
    },
    li({ children }) {
      return <li className="leading-7">{children}</li>
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic my-4 text-muted-foreground">
          {children}
        </blockquote>
      )
    },
    a({ children, href }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80 transition-colors"
        >
          {children}
        </a>
      )
    },
    table({ children }) {
      return (
        <div className="overflow-x-auto my-4">
          <table className="min-w-full border-collapse border border-border rounded-lg">
            {children}
          </table>
        </div>
      )
    },
    thead({ children }) {
      return <thead className="bg-muted">{children}</thead>
    },
    th({ children }) {
      return <th className="border border-border px-4 py-2 text-left font-semibold">{children}</th>
    },
    td({ children }) {
      return <td className="border border-border px-4 py-2">{children}</td>
    },
    hr() {
      return <hr className="my-6 border-border" />
    }
  }

  if (isUser) {
    // User messages: contained in a bubble
    return (
      <div className="group relative w-full flex justify-end">
        <div className="relative max-w-[85%] flex flex-col items-end ml-auto">
          <div className="relative w-full rounded-2xl px-6 py-4 transition-all bg-primary text-primary-foreground shadow-sm hover:shadow-md">
            <div
              className={cn(
                'prose prose-sm dark:prose-invert max-w-none prose-invert',
                'prose-headings:font-semibold',
                'prose-p:leading-7 prose-p:mb-4 prose-p:last:mb-0',
                'prose-code:text-sm prose-code:font-mono',
                'prose-pre:bg-transparent prose-pre:p-0',
                'prose-ul:my-4 prose-ol:my-4',
                'prose-li:leading-7',
                'prose-blockquote:border-l-4 prose-blockquote:border-muted-foreground/30',
                'prose-a:text-primary prose-a:underline hover:prose-a:text-primary/80',
                'prose-table:my-4',
                'prose-img:rounded-lg prose-img:my-4'
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Assistant messages: pure text, no container
  return (
    <div
      className="group relative w-full flex justify-start"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative w-full flex flex-col items-start mr-auto">
        {/* Message Actions - visible on hover */}
        <div
          className={cn(
            'absolute -top-2 right-0 transition-opacity duration-200 z-10',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          <MessageActions content={message.content} />
        </div>

        {/* Markdown Content - no container */}
        <div
          className={cn(
            'prose prose-sm dark:prose-invert max-w-none',
            'prose-headings:font-semibold',
            'prose-p:leading-7 prose-p:mb-4 prose-p:last:mb-0',
            'prose-code:text-sm prose-code:font-mono',
            'prose-pre:bg-transparent prose-pre:p-0',
            'prose-ul:my-4 prose-ol:my-4',
            'prose-li:leading-7',
            'prose-blockquote:border-l-4 prose-blockquote:border-muted-foreground/30',
            'prose-a:text-primary prose-a:underline hover:prose-a:text-primary/80',
            'prose-table:my-4',
            'prose-img:rounded-lg prose-img:my-4'
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
