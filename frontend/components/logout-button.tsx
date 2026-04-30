// frontend/components/logout-button.tsx

'use client'

import { supabase } from '@/lib/supabaseBrowser'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  const logout = async () => {
    try {
      window.sessionStorage.setItem('capyrun:logout-in-progress', '1')
    } catch {}

    try {
      await supabase.auth.signOut({ scope: 'local' })
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      try {
        window.sessionStorage.removeItem('capyrun:logout-in-progress')
      } catch {}
    }

    router.push('/auth/login')
  }

  return <Button onClick={logout}>Logout</Button>
}
