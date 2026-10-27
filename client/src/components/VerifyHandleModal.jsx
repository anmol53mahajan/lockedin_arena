import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Clipboard, ClipboardCheck, ExternalLink, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useAuth } from '../context/AuthContext'

const PROBLEM_URL = 'https://codeforces.com/problemset/problem/4/A'

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainder = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}

export default function VerifyHandleModal({ onClose }) {
  const { verifyHandleInitiate, verifyHandleConfirm } = useAuth()
  const [handle, setHandle] = useState('')
  const [token, setToken] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState('')
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loading, onClose])

  useEffect(() => {
    if (step !== 2 || secondsLeft <= 0) return undefined
    const timerId = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timerId)
  }, [step, secondsLeft])

  async function startChallenge(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const challenge = await verifyHandleInitiate(handle.trim())
      setToken(challenge.token)
      const expiry = Number(challenge.expiresInSeconds)
      setSecondsLeft(Number.isFinite(expiry) ? Math.max(0, Math.ceil(expiry)) : 300)
      setStep(2)
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not start the verification challenge.')
    } finally {
      setLoading(false)
    }
  }

  async function checkVerdict() {
    setError('')
    setLoading(true)
    try {
      await verifyHandleConfirm()
      setVerified(true)
      confetti({
        particleCount: 150,
        spread: 78,
        origin: { y: 0.62 },
        colors: ['#ed3029', '#f4f0e7', '#f3bd35'],
      })
      window.setTimeout(onClose, 1600)
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Verification could not be completed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function copyValue(value, label) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1600)
    } catch {
      setError('Clipboard access was blocked. Select and copy the text manually.')
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onClose()
      }}
      role="presentation"
    >
      <section aria-labelledby="verify-title" aria-modal="true" className="verify-modal" role="dialog">
        <div className="modal-topline">
          <span><span className="pulse-dot" /> IDENTITY CHECK / CODEFORCES</span>
          <button aria-label="Close verification dialog" className="icon-button" disabled={loading} onClick={onClose} type="button"><X size={19} /></button>
        </div>

        {verified ? (
          <div className="verification-success">
            <span className="success-emblem"><ShieldCheck size={36} /></span>
            <p className="kicker">IDENTITY CONFIRMED</p>
            <h2>HANDLE<br />LOCKED IN<span className="red-period">.</span></h2>
            <p className="muted-copy">Your Codeforces account is now linked to the arena.</p>
          </div>
        ) : (
          <>
            <div className="verify-heading">
              <span className="step-count">STEP 0{step} / 02</span>
              <h2 id="verify-title">{step === 1 ? <>CLAIM YOUR<br />HANDLE.</> : <>PROVE<br />CONTROL<span className="red-period">.</span></>}</h2>
            </div>

            {error && <div className="error-banner modal-error" role="alert"><AlertTriangle size={16} />{error}</div>}

            {step === 1 ? (
              <form className="verify-form" onSubmit={startChallenge}>
                <p className="muted-copy">Link your Codeforces account. The handle is locked after successful verification.</p>
                <label className="field-label" htmlFor="cf-handle">CODEFORCES HANDLE</label>
                <input
                  autoComplete="off"
                  autoFocus
                  className="arena-input"
                  id="cf-handle"
                  maxLength={24}
                  onChange={(event) => setHandle(event.target.value)}
                  placeholder="YOUR CODEFORCES HANDLE"
                  required
                  value={handle}
                />
                <button className="submit-button" disabled={loading || !handle.trim()} type="submit">
                  {loading ? <><LoaderCircle className="spin" size={17} /> GENERATING...</> : <>INITIATE CHALLENGE <span>↗</span></>}
                </button>
              </form>
            ) : (
              <div className="challenge-body">
                <div className="challenge-target">
                  <span className="field-label">TARGET PROBLEM</span>
                  <a href={PROBLEM_URL} rel="noreferrer" target="_blank">
                    CODEFORCES 4A / WATERMELON <ExternalLink size={14} />
                  </a>
                  <button className="copy-link" onClick={() => copyValue(PROBLEM_URL, 'problem')} type="button">
                    {copied === 'problem' ? <ClipboardCheck size={14} /> : <Clipboard size={14} />}
                    {copied === 'problem' ? 'COPIED' : 'COPY LINK'}
                  </button>
                </div>

                <div className="token-panel">
                  <span className="field-label">YOUR ONE-TIME TOKEN</span>
                  <div className="token-line">
                    <strong>{token}</strong>
                    <button aria-label="Copy verification token" className="token-copy" onClick={() => copyValue(token, 'token')} type="button">
                      {copied === 'token' ? <Check size={17} /> : <Clipboard size={17} />}
                    </button>
                  </div>
                </div>

                <p className="challenge-instruction">Submit code for Problem 4A that causes a <strong>COMPILATION ERROR</strong>. Include this token in the compiler error output within five minutes.</p>

                <div className={`countdown ${secondsLeft < 60 ? 'countdown-urgent' : ''}`}>
                  <span>CHALLENGE EXPIRES IN</span>
                  <strong>{formatTime(secondsLeft)}</strong>
                </div>

                <button className="submit-button" disabled={loading || secondsLeft === 0} onClick={checkVerdict} type="button">
                  {loading ? <><LoaderCircle className="spin" size={17} /> SCANNING CODEFORCES...</> : <>CHECK CODEFORCES VERDICT <span>↗</span></>}
                </button>
                {secondsLeft === 0 && (
                  <button className="retry-button" onClick={() => { setStep(1); setToken(''); setError('The challenge expired. Start a new challenge.') }} type="button">
                    CHALLENGE EXPIRED — START AGAIN
                  </button>
                )}
              </div>
            )}
          </>
        )}
        <div className="modal-foot"><span>LOCKEDIN // ARENA</span><span>SECURE VERIFICATION</span></div>
      </section>
    </div>
  )
}
