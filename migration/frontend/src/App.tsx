import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGuard } from './components/AuthGuard'
import LoginPage from './pages/LoginPage'
import CallbackPage from './pages/auth/CallbackPage'
import AppLayout from './pages/app/AppLayout'
import SchedulePage from './pages/app/SchedulePage'
import SwapPage from './pages/app/SwapPage'
import AdminLayout from './pages/admin/AdminLayout'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<CallbackPage />} />

      <Route
        path="/app"
        element={
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="schedule" replace />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="swap" element={<SwapPage />} />
      </Route>

      <Route
        path="/admin/*"
        element={
          <AuthGuard requirePermission="manage_schedule">
            <AdminLayout />
          </AuthGuard>
        }
      />

      <Route path="/" element={<Navigate to="/app/schedule" replace />} />
      <Route path="*" element={<Navigate to="/app/schedule" replace />} />
    </Routes>
  )
}
