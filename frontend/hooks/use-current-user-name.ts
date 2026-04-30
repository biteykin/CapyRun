// frontend/hooks/use-current-user-name.ts

import { useEffect, useState } from 'react'

export const useCurrentUserName = () => {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchProfileName = async () => {
      try {
        const res = await fetch('/api/profile/me', {
          method: 'GET',
          credentials: 'include',
        })

        if (!res.ok) return

        const data = await res.json()
        const displayName =
          data?.profile?.display_name ??
          data?.profile?.username ??
          data?.user?.email ??
          '?'

        if (!cancelled) setName(displayName)
      } catch (error) {
        console.error(error)
      }
    }

    fetchProfileName()

    return () => {
      cancelled = true
    }
  }, [])

  return name || '?'
}
