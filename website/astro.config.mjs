import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://slay.zone',
  output: 'static',
  outDir: './dist',
  publicDir: './public',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/features/demo/'),
    }),
  ],
  image: {
    remotePatterns: [],
  },
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
})
