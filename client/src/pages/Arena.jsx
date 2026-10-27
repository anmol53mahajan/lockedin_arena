import { useEffect, useState } from 'react'
import { ArrowLeft, Clock3, ExternalLink, LoaderCircle, Swords } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import api from '../services/api'

function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export default function Arena() {
  const { roomCode } = useParams()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(0)

  useEffect(() => {
    let active = true
    api.get(`/matches/${encodeURIComponent((roomCode || '').toUpperCase())}`)
      .then(({ data }) => {
        if (active) {
          setNow(Date.now())
          setMatch(data.match)
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || requestError.message || 'Unable to load this arena.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [roomCode])

  useEffect(() => {
    if (!match?.endTime) return undefined
    const timerId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timerId)
  }, [match?.endTime])

  if (loading) {
    return (
      <main className="arena-live-page arena-live-loading">
        <LoaderCircle className="spin" size={26} />
        <span>LOADING ACTIVE MATCH...</span>
      </main>
    )
  }

  if (error || !match) {
    return (
      <main className="arena-live-page">
        <div className="error-banner" role="alert">{error || 'Match not found.'}</div>
        <Link className="lobby-back-link" to="/dashboard"><ArrowLeft size={15} /> BACK TO COMMAND</Link>
      </main>
    )
  }

  const remaining = match.endTime ? new Date(match.endTime).getTime() - now : 0

  return (
    <main className="arena-live-page">
      <header className="arena-live-header">
        <div>
          <div className="eyebrow"><span className="eyebrow-rule" /> LIVE LOCKOUT / {match.roomCode}</div>
          <h1>THE FIGHT<br /><span>IS ON.</span></h1>
        </div>
        <div className="arena-clock">
          <span><Clock3 size={15} /> TIME REMAINING</span>
          <strong>{formatRemaining(remaining)}</strong>
        </div>
      </header>

      <section className="arena-live-score">
        <div><span>{match.host?.username || 'HOST'}</span><strong>{match.scores?.hostScore ?? 0}</strong></div>
        <Swords size={20} />
        <div><span>{match.guest?.username || 'GUEST'}</span><strong>{match.scores?.guestScore ?? 0}</strong></div>
      </section>

      <section className="arena-problems">
        <div className="section-heading"><span>PROBLEM SET</span><span>{match.problems?.length || 0} TARGETS / FIRST ACCEPTED LOCKS POINTS</span></div>
        {match.problems?.length ? (
          <div className="arena-problem-grid">
            {match.problems.map((problem, index) => (
              <article className="arena-problem-card" key={`${problem.contestId}-${problem.index}`}>
                <div className="arena-problem-top">
                  <span>TARGET 0{index + 1}</span><span>{problem.rating} RATING</span>
                </div>
                <h2>{problem.name}</h2>
                <div className="arena-problem-bottom">
                  <strong>{Number(problem.points).toLocaleString()} PTS</strong>
                  <a href={problem.problemUrl} rel="noreferrer" target="_blank">
                    OPEN PROBLEM <ExternalLink size={14} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-history"><p>NO PROBLEMS ASSIGNED.</p><span>THE MATCH MAY NOT HAVE STARTED CORRECTLY.</span></div>
        )}
      </section>

      <footer className="dashboard-footer"><span>LOCKEDIN // ARENA</span><span>SUBMISSIONS SYNC WHEN ARENA POLLING IS ENABLED</span></footer>
    </main>
  )
}
