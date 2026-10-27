import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, BadgeCheck, Clipboard, LoaderCircle, Swords, Trophy } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import CreateDuelModal from '../components/CreateDuelModal'
import api from '../services/api'

function formatElapsed(startTime, solvedAt) {
  if (!startTime || !solvedAt) return null
  const elapsedSeconds = Math.max(0, Math.floor(
    (new Date(solvedAt).getTime() - new Date(startTime).getTime()) / 1000
  ))
  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')
  const seconds = (elapsedSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function formatDate(value) {
  if (!value) return 'DATE UNAVAILABLE'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function RatingDelta({ delta }) {
  if (!Number.isFinite(delta)) return <span className="recap-rating-delta rating-neutral">RATING NOT RECORDED</span>
  const positive = delta > 0
  const neutral = delta === 0
  return (
    <span className={`recap-rating-delta ${positive ? 'rating-positive' : neutral ? 'rating-neutral' : 'rating-negative'}`}>
      {delta > 0 ? '+' : ''}{delta} ELO
    </span>
  )
}

function CombatantCard({ side, player, score, delta, newRating }) {
  return (
    <article className={`recap-player-card recap-${side.toLowerCase()}`}>
      <div className="recap-player-label">{side} // COMBATANT</div>
      <div className="recap-player-identity">
        <span className="recap-avatar">{(player?.cfHandle || player?.username || side).slice(0, 1).toUpperCase()}</span>
        <div><strong>{player?.username || 'PLAYER UNAVAILABLE'}</strong><span>{player?.cfHandle ? `CF // ${player.cfHandle}` : 'UNVERIFIED HANDLE'}</span></div>
        {player?.isVerified && <BadgeCheck aria-label="Verified Codeforces handle" className="recap-verified" size={17} />}
      </div>
      <div className="recap-score">{Number(score || 0).toLocaleString()}<span>PTS</span></div>
      <div className="recap-rating-row">
        <RatingDelta delta={delta} />
        <span className="recap-new-rating">{Number.isFinite(newRating) ? `${newRating.toLocaleString()} ELO` : '— ELO'}</span>
      </div>
    </article>
  )
}

export default function MatchRecap() {
  const { roomCode: suppliedRoomCode } = useParams()
  const roomCode = (suppliedRoomCode || '').trim().toUpperCase()
  const invalidRoomCode = !/^[A-Z0-9]{6}$/.test(roomCode)
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showCreateDuel, setShowCreateDuel] = useState(false)

  useEffect(() => {
    let active = true
    if (invalidRoomCode) return () => { active = false }

    async function loadRecap() {
      setLoading(true)
      setError('')
      try {
        const { data } = await api.get(`/matches/${encodeURIComponent(roomCode)}`)
        if (active) setMatch(data.match || data)
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.message || requestError.message || 'Could not load this match recap.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadRecap()

    return () => { active = false }
  }, [roomCode, invalidRoomCode])

  async function shareRecap() {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setNotice('SHARE LINK COPIED TO CLIPBOARD.')
    } catch {
      setNotice(`SHARE THIS LINK: ${url}`)
    }
  }

  if (invalidRoomCode) {
    return (
      <main className="match-recap-page">
        <div className="error-banner" role="alert">ROOM CODE IS INVALID. MATCH CODES MUST BE SIX LETTERS OR NUMBERS.</div>
        <Link className="lobby-back-link" to="/dashboard"><ArrowLeft size={15} /> BACK TO COMMAND</Link>
      </main>
    )
  }

  if (loading) {
    return <main className="match-recap-page recap-loading"><LoaderCircle className="spin" size={25} /><span>RETRIEVING COMBAT AUDIT...</span></main>
  }

  if (error || !match) {
    return (
      <main className="match-recap-page">
        <div className="error-banner" role="alert">{error || 'MATCH RECAP NOT FOUND.'}</div>
        <Link className="lobby-back-link" to="/dashboard"><ArrowLeft size={15} /> BACK TO COMMAND</Link>
      </main>
    )
  }

  const isFinished = match.status === 'FINISHED'
  const winner = match.winner
  const winnerPlayer = winner === 'HOST' ? match.host : winner === 'GUEST' ? match.guest : null
  const reasonLabel = match.terminationReason === 'CLINCH_VICTORY'
    ? 'VICTORY VIA EARLY CLINCH'
    : match.terminationReason === 'TIME_EXPIRED'
      ? 'DECISION BY TIME EXPIRY'
      : 'MATCH RESULT'

  return (
    <main className="match-recap-page">
      {notice && <div className="recap-notice" role="status">{notice}<button onClick={() => setNotice('')} type="button">×</button></div>}
      <header className="recap-header">
        <div>
          <div className="eyebrow"><span className="eyebrow-rule" /> PERMANENT MATCH RECORD</div>
          <h1>COMBAT DEBRIEF<span> // {match.roomCode}</span></h1>
        </div>
        <button className="recap-share-button" onClick={shareRecap} type="button"><Clipboard size={15} /> SHARE MATCH RECAP</button>
      </header>

      <section className={`recap-victor-banner ${winner === 'TIE' ? 'recap-tie' : ''}`}>
        <Trophy aria-hidden="true" size={24} />
        <div>
          <span>{reasonLabel}</span>
          <strong>{winner === 'TIE' ? 'STALEMATE // EVENLY MATCHED' : isFinished ? `${winnerPlayer?.username || winner} // VICTOR` : 'MATCH RESULT PENDING'}</strong>
          <small>{isFinished ? `FINALIZED ${formatDate(match.endTime)}` : `STATUS // ${match.status}`}</small>
        </div>
      </section>

      <section aria-label="Final combatant ratings and scores" className="recap-combatants">
        <CombatantCard
          delta={match.hostDelta}
          newRating={match.hostRatingAfter}
          player={match.host}
          score={match.scores?.hostScore}
          side="HOST"
        />
        <div aria-hidden="true" className="recap-versus"><Swords size={19} /><span>VS</span></div>
        <CombatantCard
          delta={match.guestDelta}
          newRating={match.guestRatingAfter}
          player={match.guest}
          score={match.scores?.guestScore}
          side="GUEST"
        />
      </section>

      <section className="recap-audit">
        <div className="section-heading"><span>PROBLEM BREAKDOWN</span><span>{match.problems?.length || 0} TARGETS // AUDIT TRAIL</span></div>
        {match.problems?.length ? (
          <div className="recap-audit-list">
            {match.problems.map((problem, index) => {
              const elapsed = formatElapsed(match.startTime, problem.solvedAt)
              return (
                <article className={`recap-audit-row ${problem.status === 'LOCKED' ? 'audit-locked' : ''}`} key={`${problem.contestId}-${problem.index}`}>
                  <span className="audit-index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="audit-problem">
                    <a href={problem.problemUrl} rel="noreferrer" target="_blank">{problem.contestId}-{problem.index} / {problem.name}<ArrowUpRight size={13} /></a>
                    <span>{problem.rating || '—'} CF RATING <i /> {Number(problem.points || 0).toLocaleString()} PTS</span>
                  </div>
                  <div className="audit-resolution">
                    {problem.status === 'LOCKED'
                      ? <><strong>LOCKED BY {problem.solvedBy?.cfHandle || problem.solvedBy?.username || 'COMBATANT'}</strong><span>{elapsed ? `AT ${elapsed} INTO MATCH` : formatDate(problem.solvedAt)}</span></>
                      : <><strong>UNCLAIMED</strong><span>NO ACCEPTED SUBMISSION</span></>}
                  </div>
                </article>
              )
            })}
          </div>
        ) : <div className="recap-empty">NO PROBLEM AUDIT DATA WAS SAVED.</div>}
      </section>

      <div className="recap-actions">
        <Link className="recap-secondary-action" to="/dashboard"><ArrowLeft size={15} /> RETURN TO COMMAND DASHBOARD</Link>
        <button className="recap-primary-action" onClick={() => setShowCreateDuel(true)} type="button">HOST NEW DUEL <ArrowUpRight size={15} /></button>
      </div>
      <footer className="dashboard-footer"><span>LOCKEDIN // MATCH AUDIT</span><span>RECORD // {match._id}</span></footer>
      {showCreateDuel && <CreateDuelModal onClose={() => setShowCreateDuel(false)} />}
    </main>
  )
}
