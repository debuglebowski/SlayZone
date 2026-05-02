export interface NavLink {
  href: string
  label: string
  key: string
}

export const navLinks: NavLink[] = [
  { href: '/features', label: 'Features', key: 'features' },
  { href: '/comparison', label: 'Comparison', key: 'comparison' },
  { href: '/pricing', label: 'Pricing', key: 'pricing' },
  { href: '/faq', label: 'FAQ', key: 'faq' },
  { href: '/docs', label: 'Docs', key: 'docs' },
]
