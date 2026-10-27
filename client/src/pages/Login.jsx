import { useState } from 'react'
import { ArrowUpRight, LoaderCircle, LockKeyhole, Swords } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, user, loading } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login({ username: username.trim(), password })
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to enter the arena. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-editorial" aria-label="Arena welcome">
        <div className="eyebrow"><span className="eyebrow-rule" /> PLAYER ACCESS / 01</div>
        <h1 className="editorial-title">STEP INTO<br /><span>THE RING.</span></h1>
        <p className="editorial-note">No spectators. No second chances.<br />Just you, your skill, and the clock.</p>
        <div className="scribble-mark">READY<br />TO FIGHT?</div>
        <div className="editorial-foot"><span>LOCKEDIN // ARENA</span><span>01 — AUTHENTICATE</span></div>
      </section>

      <section className="auth-card">
        <div className="auth-card-top">
          <span className="auth-icon"><LockKeyhole size={18} /></span>
          <span className="mono-label">SECURE PLAYER LOGIN</span>
          <span className="auth-index">01/02</span>
        </div>
        <div className="auth-heading-wrap">
          <p className="kicker">YOUR NEXT MATCH STARTS HERE</p>
          <h2>BACK IN<br />THE ARENA<span className="red-period">.</span></h2>
        </div>

        {error && <div className="error-banner" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="login-username">ARENA USERNAME</label>
          <input
            autoComplete="username"
            className="arena-input"
            id="login-username"
            maxLength={20}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="YOUR_HANDLE"
            required
            value={username}
          />

          <label className="field-label" htmlFor="login-password">PASSWORD</label>
          <input
            autoComplete="current-password"
            className="arena-input"
            id="login-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••••"
            required
            type="password"
            value={password}
          />

          <button className="submit-button" disabled={submitting} type="submit">
            {submitting ? <><LoaderCircle className="spin" size={17} /> ENGAGING...</> : <>ENTER THE ARENA <ArrowUpRight size={17} /></>}
          </button>
        </form>

        <div className="auth-switch">
          <span>NEW COMPETITOR?</span>
          <Link to="/register">CREATE YOUR ACCOUNT <ArrowUpRight size={14} /></Link>
        </div>
        <div className="auth-card-foot"><Swords size={14} /> BUILT FOR THE LOCKOUT.</div>
      </section>
    </main>
  )
}
