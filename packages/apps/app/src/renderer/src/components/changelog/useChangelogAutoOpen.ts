import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@slayzone/transport/client'
import { useSetting, useSetSettingMutation } from '@slayzone/settings/client'
import { CHANGELOG } from './changelog-data'

const SETTINGS_KEY = 'last_seen_changelog_version'

export function useChangelogAutoOpen(): [boolean, string | null, () => void] {
  const trpc = useTRPC()
  const { data: currentVersion } = useQuery(trpc.app.meta.getVersion.queryOptions())
  const lastSeen = useSetting(SETTINGS_KEY)
  const setSetting = useSetSettingMutation()

  const [shouldOpen, setShouldOpen] = useState(false)
  const [lastSeenVersion, setLastSeenVersion] = useState<string | null>(null)

  useEffect(() => {
    if (!currentVersion || lastSeen === undefined) return

    if (lastSeen === null) {
      // First launch or existing user getting this feature — seed silently
      setSetting.mutate({ key: SETTINGS_KEY, value: currentVersion })
      return
    }

    if (lastSeen !== currentVersion && CHANGELOG.length > 0) {
      setLastSeenVersion(lastSeen)
      setShouldOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVersion, lastSeen])

  const dismiss = () => {
    setShouldOpen(false)
    if (currentVersion) {
      setSetting.mutate({ key: SETTINGS_KEY, value: currentVersion })
    }
  }

  return [shouldOpen, lastSeenVersion, dismiss]
}
