import { useCallback, useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { io } from 'socket.io-client'
import {
  ArrowLeft,
  Check,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Radio,
  RefreshCw,
  Swords,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function userIdOf(user) {
  return user?._id?.toString?.() || user?.id?.toString?.() || ''
}

function playerName(player, fallback) {
  return player?.username || player?.cfHandle || fallback
}

function resolveOutcome(ending, userId, match) {
  if (!ending) return null
  const winner = ending.winner || match?.winner
  if (winner === 'TIE') return 'TIE'
  if (!winner) {
    const scores = ending.scores || match?.scores || {}
    if (scores.hostScore === scores.guestScore) return 'TIE'
    const winningSide = scores.hostScore > scores.guestScore ? 'HOST' : 'GUEST'
    return winningSide === (userId === userIdOf(match?.host) ? 'HOST' : 'GUEST') ? 'WIN' : 'LOSS'
  }
  const won = winner === (userId === userIdOf(match?.host) ? 'HOST' : 'GUEST')
  return won ? 'WIN' : 'LOSS'
}

function PlayerCard({ player, side, score, currentPlayer }) {
  const label = side === 'HOST' ? 'HOST' : 'GUEST'
  return (
    <article className={`arena-player-card ${side.toLowerCase()}-player`}>
      <div className="arena-player-meta">
        <span>{label} / COMBATANT</span>
        <span className="arena-player-rating">{Number(player?.platformRating || 1200).toLocaleString()} ELO</span>
      </div>
      <div className="arena-player-main">
        <span aria-hidden="true" className="arena-avatar">{(player?.cfHandle || player?.username || label).slice(0, 1).toUpperCase()}</span>
        <div className="arena-player-identity">
          <strong>{playerName(player, `WAITING ${label}`)}</strong>
          <span>{player?.cfHandle ? `CF // ${player.cfHandle}` : 'CODEFORCES HANDLE UNAVAILABLE'}</span>
        </div>
        {currentPlayer && <span className="arena-you-badge">YOU</span>}
      </div>
      <strong className="arena-player-score">{Number(score || 0).toLocaleString()}</strong>
      <span className="arena-player-score-label">LOCKED POINTS</span>
    </article>
  )
}

export default function Arena() {
  const { roomCode } = useParams()
  const { user, token } = useAuth()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const [clock, setClock] = useState(null)
  const [clockNow, setClockNow] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [notice, setNotice] = useState('')
  const [ending, setEnding] = useState(null)
  const [flash, setFlash] = useState(null)
  const socketRef = useRef(null)
  const confettiShown = useRef(false)
  const currentUserId = userIdOf(user)

  const handleEnd = useCallback((payload) => {
    setEnding(payload || { reason: 'MATCH_FINISHED' })
    if (payload?.scores) {
      setMatch((current) => current ? { ...current, scores: payload.scores, status: 'FINISHED' } : current)
    } else {
      setMatch((current) => current ? { ...current, status: 'FINISHED' } : current)
    }
  }, [])

  useEffect(() => {
    let active = true
    let socket
    let cooldownTimer

    async function loadMatch() {
      setLoading(true)
      setError('')
      setEnding(null)
      setClock(null)
      try {
        const { data } = await api.get(`/matches/${encodeURIComponent((roomCode || '').toUpperCase())}`)
        if (!active) return
        const loadedMatch = data.match || data
        setClockNow(Date.now())
        setMatch(loadedMatch)
        if (loadedMatch.endTime && loadedMatch.status === 'ACTIVE') {
          setClock({
            remainingMs: Math.max(0, new Date(loadedMatch.endTime).getTime() - Date.now()),
            receivedAt: Date.now(),
          })
        }
        if (loadedMatch.status === 'FINISHED') {
          setEnding({
            reason: loadedMatch.winner === 'TIE' ? 'TIME_EXPIRED' : 'MATCH_FINISHED',
            winner: loadedMatch.winner,
            scores: loadedMatch.scores,
          })
        }
        if (!token || !currentUserId) {
          setError('Your authenticated player session is unavailable. Sign in again to reconnect.')
          return
        }

        const socketUrl = import.meta.env.VITE_SOCKET_URL || new URL(api.defaults.baseURL).origin
        socket = io(socketUrl, {
          auth: { token },
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        })
        socketRef.current = socket

        socket.on('connect', () => {
          if (!active) return
          setConnected(true)
          setError('')
          socket.emit('join-arena', {
            roomCode: (roomCode || '').toUpperCase(),
            userId: currentUserId,
          }, (response) => {
            if (!active) return
            if (!response?.success) {
              setError(response?.message || 'Unable to join live arena updates.')
            }
          })
        })
        socket.on('disconnect', () => {
          if (active) setConnected(false)
        })
        socket.on('connect_error', (socketError) => {
          if (!active) return
          setConnected(false)
          setError(socketError.message || 'Live connection failed. Reconnecting...')
        })
        socket.on('timer-tick', ({ remainingMs }) => {
          if (active && Number.isFinite(remainingMs)) {
            setClock({ remainingMs, receivedAt: Date.now() })
          }
        })
        socket.on('sync-started', () => {
          if (active) setSyncing(true)
        })
        socket.on('sync-complete', () => {
          if (active) setSyncing(false)
        })
        socket.on('sync-error', ({ message }) => {
          if (!active) return
          setSyncing(false)
          setNotice(message || 'Submission sync failed. Automatic polling will retry.')
        })
        socket.on('problem-locked', (payload) => {
          if (!active) return
          setMatch((current) => {
            if (!current) return current
            const problems = current.problems.map((problem) => (
              `${problem.contestId}-${problem.index}` === payload.problemId
                ? { ...problem, status: 'LOCKED', solvedBy: payload.solvedBy, solvedAt: new Date().toISOString() }
                : problem
            ))
            return { ...current, problems, scores: payload.newScores || current.scores }
          })
          const ownSolve = payload.solvedBy?.toString() === currentUserId
          setFlash({
            title: ownSolve ? 'TARGET CLAIMED' : 'TARGET LOCKED OUT',
            detail: `${payload.solverHandle || 'COMBATANT'} // +${Number(payload.points || 0).toLocaleString()} PTS`,
            ownSolve,
            id: Date.now(),
          })
        })
        socket.on('match-ended', handleEnd)
        cooldownTimer = window.setInterval(() => {
          if (active) setClockNow(Date.now())
        }, 250)
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.message || requestError.message || 'Unable to load this arena.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadMatch()
    return () => {
      active = false
      if (cooldownTimer) window.clearInterval(cooldownTimer)
      if (socket) {
        socket.removeAllListeners()
        socket.disconnect()
      }
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [roomCode, token, currentUserId, handleEnd])

  useEffect(() => {
    if (!flash) return undefined
    const timeout = window.setTimeout(() => setFlash(null), 4500)
    return () => window.clearTimeout(timeout)
  }, [flash])

  const outcome = resolveOutcome(ending, currentUserId, match)
  useEffect(() => {
    if (outcome !== 'WIN' || confettiShown.current) return
    confettiShown.current = true
    confetti({
      particleCount: 130,
      spread: 75,
      origin: { y: 0.62 },
      colors: ['#ed3029', '#f3f0e9', '#d2a44c'],
    })
  }, [outcome])

  const requestSync = () => {
    const socket = socketRef.current
    if (!socket?.connected || syncing || Date.now() < cooldownUntil) return
    const nextCooldown = Date.now() + 10000
    setCooldownUntil(nextCooldown)
    setSyncing(true)
    socket.emit('manual-sync', (response) => {
      if (!response?.success) {
        setSyncing(false)
        if (response?.retryAfterMs) setCooldownUntil(Date.now() + response.retryAfterMs)
        setNotice(response?.message || 'Could not sync submissions. Try again shortly.')
      } else {
        setNotice('SUBMISSION CHECK COMPLETE // NEXT MANUAL SYNC IN 10 SECONDS')
      }
    })
  }

  if (loading) {
    return (
      <main className="arena-live-page arena-live-loading">
        <LoaderCircle className="spin" size={26} />
        <span>LOADING ACTIVE MATCH...</span>
      </main>
    )
  }

  if (error && !match) {
    return (
      <main className="arena-live-page">
        <div className="error-banner" role="alert">{error}</div>
        <Link className="lobby-back-link" to="/dashboard"><ArrowLeft size={15} /> BACK TO COMMAND</Link>
      </main>
    )
  }
  if (!match) return null

  const clockRemaining = clock
    ? Math.max(0, clock.remainingMs - (clockNow - clock.receivedAt))
    : match.endTime ? Math.max(0, new Date(match.endTime).getTime() - clockNow) : 0
  const isLowTime = clockRemaining <= 5 * 60 * 1000 && clockRemaining > 0
  const guestId = userIdOf(match.guest)
  const solvedCount = match.problems?.filter((problem) => problem.status === 'LOCKED').length || 0
  const totalPoints = match.problems?.reduce((total, problem) => total + Number(problem.points || 0), 0) || 0
  const resolvedPoints = (match.scores?.hostScore || 0) + (match.scores?.guestScore || 0)

  return (
    <main className="arena-live-page">
      <div className="arena-topbar">
        <Link className="arena-back-link" to="/dashboard"><ArrowLeft size={14} /> EXIT ARENA</Link>
        <div className={`arena-connection ${connected ? 'is-connected' : 'is-disconnected'}`} role="status">
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {connected ? 'LIVE WEBSOCKET SYNC' : 'RECONNECTING LIVE SYNC'}
        </div>
        <button
          className="arena-sync-button"
          disabled={!connected || syncing || clockNow < cooldownUntil || Boolean(ending)}
          onClick={requestSync}
          type="button"
        >
          {syncing ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}
          {syncing ? 'SYNCING SUBMISSIONS' : clockNow < cooldownUntil
            ? `SYNC COOLDOWN ${Math.ceil((cooldownUntil - clockNow) / 1000)}S`
            : 'SYNC SUBMISSIONS'}
        </button>
      </div>

      {error && <div className="arena-inline-error" role="alert">{error}</div>}
      {notice && (
        <div className="arena-toast" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice('')} type="button"><X size={15} /></button>
        </div>
      )}
      {flash && (
        <div aria-live="assertive" className={`arena-lock-flash ${flash.ownSolve ? 'own-lock' : ''}`} key={flash.id} role="alert">
          <Radio size={19} />
          <div><strong>{flash.title}</strong><span>{flash.detail}</span></div>
          <button aria-label="Dismiss lock alert" onClick={() => setFlash(null)} type="button"><X size={16} /></button>
        </div>
      )}

      <header className="arena-live-header">
        <div>
          <div className="eyebrow"><span className="eyebrow-rule" /> LIVE LOCKOUT / {match.roomCode}</div>
          <h1>THE FIGHT<br /><span>IS ON.</span></h1>
        </div>
        <div className={`arena-clock ${isLowTime ? 'low-time' : ''}`}>
          <span><Clock3 size={15} /> SYNCHRONIZED COUNTDOWN</span>
          <strong>{formatRemaining(clockRemaining)}</strong>
          <span className="arena-clock-source">{connected ? 'SERVER CLOCK // LOCKED' : 'LOCAL ESTIMATE // RECONNECTING'}</span>
        </div>
      </header>

      <section aria-label="Combatant scores" className="arena-combatants">
        <PlayerCard
          currentPlayer={currentUserId === userIdOf(match.host)}
          player={match.host}
          score={match.scores?.hostScore}
          side="HOST"
        />
        <div aria-hidden="true" className="arena-versus"><Swords size={20} /><span>VS</span></div>
        <PlayerCard
          currentPlayer={currentUserId === guestId}
          player={match.guest}
          score={match.scores?.guestScore}
          side="GUEST"
        />
      </section>

      <section className="arena-problems">
        <div className="section-heading">
          <span>LOCKOUT BOARD</span>
          <span>{solvedCount}/{match.problems?.length || 0} TARGETS CLAIMED // {resolvedPoints.toLocaleString()} OF {totalPoints.toLocaleString()} PTS</span>
        </div>
        {match.problems?.length ? (
          <div className="arena-problem-grid">
            {match.problems.map((problem, index) => {
              const isLocked = problem.status === 'LOCKED'
              const isMine = isLocked && problem.solvedBy?.toString() === currentUserId
              return (
                <article
                  className={`arena-problem-card ${isLocked ? isMine ? 'problem-mine' : 'problem-opponent' : ''}`}
                  key={`${problem.contestId}-${problem.index}`}
                >
                  <div className="arena-problem-top">
                    <span>TARGET 0{index + 1} // {problem.contestId}-{problem.index}</span>
                    <span className="arena-rating-badge">{problem.rating || '—'} RATING</span>
                  </div>
                  <h2>{problem.name}</h2>
                  <div className="arena-lock-state">
                    {isMine ? <Check size={17} /> : isLocked ? <X size={17} /> : <Radio size={16} />}
                    <strong>
                      {isMine ? `CLAIMED (+${Number(problem.points).toLocaleString()} PTS)` :
                        isLocked ? 'LOCKED BY OPPONENT (0 PTS)' : 'UNCLAIMED'}
                    </strong>
                  </div>
                  <div className="arena-problem-bottom">
                    <strong>+{Number(problem.points).toLocaleString()} PTS</strong>
                    <a href={problem.problemUrl} rel="noreferrer" target="_blank">
                      OPEN PROBLEM <ExternalLink size={14} />
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="empty-history"><p>NO PROBLEMS ASSIGNED.</p><span>THE MATCH MAY NOT HAVE STARTED CORRECTLY.</span></div>
        )}
      </section>

      <footer className="dashboard-footer"><span>LOCKEDIN // ARENA</span><span>{connected ? 'FIRST ACCEPTED // POINTS PERMANENTLY LOCKED' : 'CONNECTION RESTORING // MATCH STATE WILL RESYNC'}</span></footer>

      {ending && (
        <div aria-labelledby="arena-result-title" aria-modal="true" className="arena-result-backdrop" role="dialog">
          <section className={`arena-result-card result-${outcome?.toLowerCase() || 'tie'}`}>
            <span className="arena-result-kicker">MATCH TERMINATED // {ending.reason || 'FINAL WHISTLE'}</span>
            <h2 id="arena-result-title">
              {outcome === 'WIN' ? 'VICTORY // ARENA CONQUERED' :
                outcome === 'LOSS' ? 'DEFEAT // POINTS LOCKED' : 'STALEMATE // TIME EXPIRED'}
            </h2>
            <div className="arena-result-score">
              <span>{Number(match.scores?.hostScore || 0).toLocaleString()}</span>
              <Swords size={18} />
              <span>{Number(match.scores?.guestScore || 0).toLocaleString()}</span>
            </div>
            <p>{solvedCount} / {match.problems?.length || 0} TARGETS CLAIMED</p>
            <Link className="arena-recap-button" to={`/match/${encodeURIComponent(match.roomCode)}`}>
              VIEW MATCH RECAP &amp; RATING UPDATE
            </Link>
            <Link className="arena-result-exit" to="/dashboard">RETURN TO COMMAND</Link>
          </section>
        </div>
      )}
    </main>
  )
}
