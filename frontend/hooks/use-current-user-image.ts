// frontend/hooks/use-current-user-image.ts

import { useEffect, useState } from 'react'

export const useCurrentUserImage = () => {
  const [image, setImage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchUserImage = async () => {
      try {
        const res = await fetch('/api/profile/me', {
          method: 'GET',
          credentials: 'include',
        })

        if (!res.ok) return

        const data = await res.json()
        const avatarUrl = data?.profile?.avatar_url ?? null

        if (!cancelled) setImage(avatarUrl)
      } catch (error) {
        console.error(error)
      }
    }

    fetchUserImage()

    return () => {
      cancelled = true
    }
  }, [])

  return image
}
