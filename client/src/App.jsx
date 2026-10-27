import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import { AuthProvider, useAuth } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import Lobby from './pages/Lobby'
import Login from './pages/Login'
import Register from './pages/Register'

function PageLoader() {
  return (
    <div aria-label="Loading player profile" className="page-loader" role="status">
      <span className="loader-ring" />
      <span>SYNCING ARENA PROFILE...</span>
    </div>
  )
}

function LandingRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return <Navigate replace to={user ? '/dashboard' : '/login'} />
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return user ? <Navigate replace to="/dashboard" /> : children
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return user ? children : <Navigate replace to="/login" />
}

function ArenaApp() {
  return (
    <div className="arena-frame">
      <div className="arena-viewport">
        <Navbar />
        <Routes>
          <Route element={<LandingRedirect />} path="/" />
          <Route element={<GuestRoute><Login /></GuestRoute>} path="/login" />
          <Route element={<GuestRoute><Register /></GuestRoute>} path="/register" />
          <Route element={<ProtectedRoute><Dashboard /></ProtectedRoute>} path="/dashboard" />
          <Route element={<ProtectedRoute><Lobby /></ProtectedRoute>} path="/lobby/:roomCode" />
          <Route element={<LandingRedirect />} path="*" />
        </Routes>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ArenaApp />
      </BrowserRouter>
    </AuthProvider>
  )
}
