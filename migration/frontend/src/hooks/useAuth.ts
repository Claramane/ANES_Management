import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database.types'

type UserProfile = Tables<'user_profiles'>

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
}

const initial: AuthState = { user: null, profile: null, loading: true, error: null }

export function useAuth() {
  const [state, setState] = useState<AuthState>(initial)

  useEffect(() => {
    let mounted = true

    async function loadProfile(user: User) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return

      if (!profile) {
        await supabase.auth.signOut()
        setState({
          user: null, profile: null, loading: false,
          error: '此 Google 帳號尚未獲得授權，請聯絡護理長。',
        })
        return
      }

      if (!profile.is_active) {
        await supabase.auth.signOut()
        setState({
          user: null, profile: null, loading: false,
          error: '此帳號已停用，請聯絡管理員。',
        })
        return
      }

      setState({ user, profile, loading: false, error: null })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (session?.user) {
          setState(s => ({ ...s, loading: true, error: null }))
          await loadProfile(session.user)
        } else {
          setState({ user: null, profile: null, loading: false, error: null })
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  function signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  function signOut() {
    return supabase.auth.signOut()
  }

  return { ...state, signInWithGoogle, signOut }
}
