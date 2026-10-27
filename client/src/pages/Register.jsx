import { useState } from 'react'
import { ArrowUpRight, LoaderCircle, ShieldPlus, Swords } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const PASSWORD_REQUIREMENTS = 'At least 8 characters, with uppercase, lowercase, a number, and a special character.'

export default function Register() {
  const { register, user, loading } = useAuth()
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
      await register({ username: username.trim(), password })
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not create your account. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page register-page">
      <section className="auth-editorial" aria-label="Join the arena">
        <div className="eyebrow"><span className="eyebrow-rule" /> NEW CHALLENGER / 02</div>
        <h1 className="editorial-title">PROVE<br /><span>YOUR</span><br />SYNTAX.</h1>
        <p className="editorial-note">Make every submission count.<br />Earn your place on the board.</p>
        <div className="scribble-mark">NO<br />EXCUSES.</div>
        <div className="editorial-foot"><span>LOCKEDIN // ARENA</span><span>02 — CREATE ACCOUNT</span></div>
      </section>

      <section className="auth-card">
        <div className="auth-card-top">
          <span className="auth-icon"><ShieldPlus size={18} /></span>
          <span className="mono-label">COMPETITOR REGISTRATION</span>
          <span className="auth-index">02/02</span>
        </div>
        <div className="auth-heading-wrap">
          <p className="kicker">CLAIM YOUR CALLSIGN</p>
          <h2>TAKE YOUR<br />SHOT<span className="red-period">.</span></h2>
        </div>

        {error && <div className="error-banner" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="register-username">ARENA USERNAME</label>
          <input
            autoComplete="username"
            className="arena-input"
            id="register-username"
            maxLength={20}
            minLength={3}
            onChange={(event) => setUsername(event.target.value)}
            pattern="[A-Za-z0-9_]{3,20}"
            placeholder="3–20 LETTERS / NUMBERS / _"
            required
            title="Use 3–20 letters, numbers, or underscores."
            value={username}
          />

          <label className="field-label" htmlFor="register-password">PASSWORD</label>
          <input
            autoComplete="new-password"
            className="arena-input"
            id="register-password"
            maxLength={128}
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="CREATE A STRONG PASSWORD"
            required
            title={PASSWORD_REQUIREMENTS}
            type="password"
            value={password}
          />
          <p className="field-hint">{PASSWORD_REQUIREMENTS}</p>

          <button className="submit-button" disabled={submitting} type="submit">
            {submitting ? <><LoaderCircle className="spin" size={17} /> ENGAGING...</> : <>JOIN THE ARENA <ArrowUpRight size={17} /></>}
          </button>
        </form>

        <div className="auth-switch">
          <span>ALREADY IN THE FIGHT?</span>
          <Link to="/login">SIGN IN <ArrowUpRight size={14} /></Link>
        </div>
        <div className="auth-card-foot"><Swords size={14} /> ONE ACCOUNT. ONE HANDLE. YOUR GAME.</div>
      </section>
    </main>
  )
}
