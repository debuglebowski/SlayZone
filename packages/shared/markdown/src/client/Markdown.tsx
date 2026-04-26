import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { mermaidCodeOverride } from './mermaidCodeOverride'

const components = { code: mermaidCodeOverride }

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
