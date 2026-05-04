import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import TimetablePage from './pages/TimetablePage'
import AttendancePage from './pages/AttendancePage'
import ReportsPage from './pages/ReportsPage'
import AdminPage from './pages/AdminPage'
import ReminderPage from './pages/ReminderPage'
import MarksPage from './pages/MarksPage'
import ProfilePage from './pages/ProfilePage'

function PrivateRoute({ children, adminOnly = false }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="marks" element={<MarksPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reminders" element={<ReminderPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin" element={<PrivateRoute adminOnly><AdminPage /></PrivateRoute>} />
      </Route>
    </Routes>
  )
}
