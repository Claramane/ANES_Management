import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
  Alert,
} from '@mui/material'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { user, loading, error, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/app/schedule'

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true })
    }
  }, [user, loading, from, navigate])

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bgcolor="background.default"
      px={2}
    >
      <Paper
        variant="outlined"
        sx={{ p: 4, width: '100%', maxWidth: 400, textAlign: 'center' }}
      >
        <Typography variant="h6" fontWeight={600} gutterBottom>
          麻醉科護理班表管理系統
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          請使用授權的 Google 帳號登入
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
            {error}
          </Alert>
        )}

        <Button
          variant="outlined"
          fullWidth
          size="large"
          onClick={() => signInWithGoogle()}
          sx={{ textTransform: 'none', fontWeight: 500 }}
        >
          使用 Google 帳號登入
        </Button>
      </Paper>
    </Box>
  )
}
