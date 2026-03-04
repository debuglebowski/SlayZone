import GitHub from '@auth/core/providers/github'
import { convexAuth } from '@convex-dev/auth/server'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [GitHub],
  callbacks: {
    async redirect({ redirectTo }) {
      const allowedDesktopRedirect = 'slayzone://auth/callback'
      if (redirectTo === allowedDesktopRedirect || redirectTo.startsWith(`${allowedDesktopRedirect}?`)) {
        return redirectTo
      }

      const baseUrl = process.env.SITE_URL?.replace(/\/$/, '')
      if (!baseUrl) {
        throw new Error('SITE_URL is required for OAuth redirects')
      }

      if (redirectTo.startsWith('?') || redirectTo.startsWith('/')) {
        return `${baseUrl}${redirectTo}`
      }

      if (redirectTo.startsWith(baseUrl)) {
        const after = redirectTo[baseUrl.length]
        if (after === undefined || after === '?' || after === '/') {
          return redirectTo
        }
      }

      throw new Error(`Invalid redirectTo: ${redirectTo}`)
    }
  }
})
