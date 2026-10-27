import { Activity, BadgeCheck, LogOut, ShieldAlert, Swords } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout, loading } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="arena-nav">
      <Link aria-label="LockedIn Arena home" className="brand-lockup" to="/">
        <span className="brand-mark"><Swords size={19} strokeWidth={2.5} /></span>
        <span className="brand-name">LOCKEDIN <span>//</span> ARENA</span>
        <span className="live-beacon" title="Arena online" />
      </Link>

      <div className="nav-right">
        {!loading && user ? (
          <>
            <span className={`status-chip ${user.isVerified ? 'status-verified' : 'status-unverified'}`}>
              {user.isVerified ? <BadgeCheck size={14} /> : <ShieldAlert size={14} />}
              {user.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
            </span>
            <span className="nav-handle">
              <span className="hash-mark">#</span>
              {user.cfHandle || 'NO CF HANDLE'}
            </span>
            <span className="elo-chip">{Number(user.platformRating ?? 1200).toLocaleString()} ELO</span>
            <button className="nav-logout" onClick={handleLogout} type="button">
              <LogOut size={15} /> <span>LOGOUT</span>
            </button>
          </>
        ) : !loading ? (
          <>
            <Link className="nav-link" to="/login">LOGIN</Link>
            <Link className="nav-join" to="/register">JOIN ARENA <Activity size={14} /></Link>
          </>
        ) : (
          <span className="nav-loading"><span className="pulse-dot" /> SYNCING PROFILE</span>
        )}
      </div>
    </header>
  )
}
