import { getFileIconSvg } from './file-icons'

interface FileIconProps {
  fileName: string
  className?: string
}

export function FileIcon({ fileName, className }: FileIconProps) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: getFileIconSvg(fileName) }}
    />
  )
}
