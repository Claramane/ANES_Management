import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, CircularProgress, Typography } from '@mui/material'
import { supabase } from '../../lib/supabase'

export default function CallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate('/app/schedule', { replace: true })
      } else if (event === 'SIGNED_OUT') {
        navigate('/login', { replace: true })
      }
    })

    // Timeout fallback in case the event never fires (e.g. session already loaded)
    const timer = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        navigate(session ? '/app/schedule' : '/login', { replace: true })
      })
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [navigate])

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={2}>
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">登入中，請稍候…</Typography>
    </Box>
  )
}
