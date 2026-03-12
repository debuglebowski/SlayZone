import { v } from 'convex/values'
import { action } from './_generated/server'

const DISCORD_MAX_LENGTH = 2000

export const submit = action({
  args: {
    content: v.string(),
    threadId: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        appVersion: v.optional(v.string()),
        platform: v.optional(v.string())
      })
    )
  },
  handler: async (_ctx, args) => {
    const webhookUrl = process.env.DISCORD_FEEDBACK_WEBHOOK_URL
    if (!webhookUrl) throw new Error('Feedback webhook not configured')

    const metaParts: string[] = []
    if (args.metadata?.appVersion) metaParts.push(`v${args.metadata.appVersion}`)
    if (args.metadata?.platform) metaParts.push(args.metadata.platform)
    const header = metaParts.length ? `*${metaParts.join(' · ')}*\n\n` : ''

    let body = header + args.content
    if (body.length > DISCORD_MAX_LENGTH) {
      const suffix = '\n\n*(truncated)*'
      body = body.slice(0, DISCORD_MAX_LENGTH - suffix.length) + suffix
    }

    let url = webhookUrl + '?wait=true'
    const payload: Record<string, unknown> = { content: body }

    if (args.threadId) {
      url += `&thread_id=${args.threadId}`
    } else {
      const preview = args.content.slice(0, 80).replace(/\n/g, ' ')
      payload.thread_name = preview.length < args.content.length ? preview + '…' : preview
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Discord webhook failed: ${res.status} ${text}`)
    }

    const data = await res.json()
    return { threadId: args.threadId ?? data.channel_id }
  }
})
