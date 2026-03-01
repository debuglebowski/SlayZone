import * as React from 'react'
import type { VariantProps } from 'class-variance-authority'

import { Button, buttonVariants } from './button'

type IconButtonSize = 'icon' | 'icon-sm' | 'icon-lg'

interface IconButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'size'>,
    Omit<VariantProps<typeof buttonVariants>, 'size'> {
  'aria-label': string
  size?: IconButtonSize
}

function IconButton({ size = 'icon', ...props }: IconButtonProps) {
  return <Button size={size} {...props} />
}

export { IconButton, type IconButtonProps }
