import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, BadgeCheck, Check, Clipboard, ClipboardCheck, Clock3, LoaderCircle, ShieldAlert, Swords, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

function CombatantCard({ label, player, ready, waiting = false }) {
  if (waiting) {
    return (
      <article className="combatant-card combatant-waiting">
        <div className="combatant-label"><span>GUEST</span><Users size={15} /></div>
        <div className="radar-wrap"><span className="radar-ring" /><span className="radar-ring radar-ring-two" /><span className="radar-center" /></div>
        <p>WAITING FOR CHALLENGER<br />TO ENTER CODE...</p>
        <span className="combatant-ready waiting-ready">PLAYER SLOT OPEN</span>
      </article>
    )
  }

  return (
    <article className={`combatant-card ${label === 'HOST' ? 'combatant-host' : ''}`}>
      <div className="combatant-label"><span>{label}</span>{player?.isVerified ? <BadgeCheck size={16} /> : <ShieldAlert size={16} />}</div>
      <div className="combatant-name">{player?.username || 'COMPETITOR'}</div>
      <div className="combatant-handle">{player?.cfHandle ? `# ${player.cfHandle}` : 'CODEFORCES HANDLE NOT LINKED'}</div>
      <div className="combatant-rating"><span>PLATFORM ELO</span><strong>{Number(player?.platformRating ?? 1200).toLocaleString()}</strong></div>
      <div className={`combatant-ready ${ready ? 'is-ready' : ''}`}>
        {ready ? <><Check size={14} /> READY FOR COMBAT</> : 'NOT READY'}
      </div>
    </article>
  )
}

export default function Lobby() {
  const { user } = useAuth()
  const { roomCode: routeRoomCode } = useParams()
  const navigate = useNavigate()
  const roomCode = (routeRoomCode || '').toUpperCase()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const loadMatch = useCallback(async (showInitialLoader = false) => {
    if (showInitialLoader) setLoading(true)
    try {
      const { data } = await api.get(`/matches/${encodeURIComponent(roomCode)}`)
      setMatch(data.match)
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load this lobby.')
    } finally {
      if (showInitialLoader) setLoading(false)
    }
  }, [roomCode])

  useEffect(() => {
    let active = true
    async function initialLoad() {
      setLoading(true)
      try {
        const { data } = await api.get(`/matches/${encodeURIComponent(roomCode)}`)
        if (active) {
          setMatch(data.match)
          setError('')
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.message || requestError.message || 'Unable to load this lobby.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    initialLoad()
    return () => { active = false }
  }, [roomCode])

  const matchStatus = match?.status

  useEffect(() => {
    if (matchStatus !== 'LOBBY') return undefined
    const intervalId = window.setInterval(() => loadMatch(false), 3500)
    return () => window.clearInterval(intervalId)
  }, [matchStatus, loadMatch])

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Clipboard access was blocked. Select and copy the room code manually.')
    }
  }

  async function toggleReady() {
    setError('')
    setBusyAction('ready')
    try {
      const ownReady = viewerIsHost
        ? Boolean(match.readyStates?.hostReady)
        : Boolean(match.readyStates?.guestReady)
      const { data } = await api.patch(`/matches/${encodeURIComponent(roomCode)}/ready`, {
        ready: !ownReady
      })
      setMatch(data.match)
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not update ready status.')
    } finally {
      setBusyAction('')
    }
  }

  async function startMatch() {
    setError('')
    setBusyAction('start')
    try {
      const { data } = await api.post(`/matches/${encodeURIComponent(roomCode)}/start`)
      setMatch(data.match)
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not start this match.')
    } finally {
      setBusyAction('')
    }
  }

  async function joinThisDuel() {
    setError('')
    setBusyAction('join')
    try {
      const { data } = await api.post('/matches/join', { roomCode })
      setMatch(data.match)
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not join this duel.')
    } finally {
      setBusyAction('')
    }
  }

  if (loading) {
    return (
      <main className="lobby-page lobby-loading">
        <span className="loader-ring" />
        <span>CONNECTING TO LOBBY // {roomCode}</span>
      </main>
    )
  }

  const hostId = match?.host?._id
  const guestId = match?.guest?._id
  const viewerIsHost = Boolean(hostId && user?._id && hostId === user._id)
  const viewerIsGuest = Boolean(guestId && user?._id && guestId === user._id)
  const viewerIsParticipant = viewerIsHost || viewerIsGuest
  const durationMinutes = match?.config?.durationMinutes ?? 30
  const problemTiers = match?.config?.problemTiers || []
  const bothPlayersReady = Boolean(match?.guest && match?.readyStates?.hostReady && match?.readyStates?.guestReady)
  const viewerReady = viewerIsHost
    ? Boolean(match?.readyStates?.hostReady)
    : Boolean(match?.readyStates?.guestReady)
  const matchStarted = match?.status === 'ACTIVE' || match?.status === 'STARTING'

  return (
    <main className="lobby-page">
      <Link className="lobby-back-link" to="/dashboard"><ArrowLeft size={15} /> BACK TO COMMAND</Link>

      {error && (
        <div className="dashboard-notice" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError('')} type="button">×</button>
        </div>
      )}

      {!match ? (
        <section className="lobby-unavailable">
          <div className="eyebrow"><span className="eyebrow-rule" /> ROOM / {roomCode}</div>
          <h1>LOBBY<br /><span>UNAVAILABLE.</span></h1>
          <button className="action-button action-button-outline" onClick={() => navigate('/dashboard')} type="button">RETURN TO DASHBOARD</button>
        </section>
      ) : (
        <>
          <header className="lobby-header">
            <div>
              <div className="eyebrow"><span className="eyebrow-rule" /> PRE-MATCH // DUEL LOBBY</div>
              <h1>ENTER THE<br /><span>LOCKOUT.</span></h1>
            </div>
            <div className="room-code-card">
              <span>ROOM CODE / SHARE TO CHALLENGE</span>
              <div className="room-code-display">
                <strong>{match.roomCode}</strong>
                <button aria-label="Copy room code" onClick={copyRoomCode} type="button">
                  {copied ? <ClipboardCheck size={16} /> : <Clipboard size={16} />}
                  {copied ? 'COPIED' : 'COPY CODE'}
                </button>
              </div>
              <span className="share-link">{window.location.href}</span>
            </div>
          </header>

          <section className="lobby-config-section">
            <div className="section-heading"><span>MATCH PARAMETERS</span><span>{match.status}</span></div>
            <div className="lobby-config-summary">
              <div className="lobby-config-stat"><Clock3 size={16} /><span>DURATION</span><strong>{durationMinutes} MIN</strong></div>
              <div className="lobby-config-stat"><Swords size={16} /><span>PROBLEM COUNT</span><strong>{match.config?.problemCount ?? problemTiers.length} PROBLEMS</strong></div>
              <div className="lobby-points">
                {problemTiers.map((tier, index) => (
                  <div className="lobby-point-row" key={`point-${tier.slot || index + 1}`}>
                    <span>P{tier.slot || index + 1}</span>
                    <span>{tier.minRating}–{tier.maxRating} RATING</span>
                    <strong>{Number(tier.points).toLocaleString()} PTS</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="combatants-section">
            <div className="section-heading"><span>COMBATANTS</span><span>2 PLAYER LOCKOUT</span></div>
            <div className="combatants-grid">
              <CombatantCard
                label="HOST"
                player={match.host}
                ready={match.readyStates?.hostReady}
              />
              <div className="versus-mark">VS</div>
              {match.guest ? (
                <CombatantCard
                  label="GUEST"
                  player={match.guest}
                  ready={match.readyStates?.guestReady}
                />
              ) : (
                <CombatantCard label="GUEST" waiting />
              )}
            </div>
          </section>

          <section className="lobby-action-center">
            {matchStarted ? (
              <div className="match-started-banner">
                <span className="pulse-dot" />
                <div><strong>MATCH INITIALIZED</strong><span>Lobby locked at {match.startTime ? new Date(match.startTime).toLocaleTimeString() : 'now'}.</span></div>
              </div>
            ) : (
              <>
                <div className="lobby-ready-copy">
                  <span className="kicker">{viewerIsParticipant ? `READY CHECK / ${bothPlayersReady ? 'ALL PLAYERS READY' : 'AWAITING PLAYERS'}` : 'CHALLENGER ACCESS'}</span>
                  <p>{!viewerIsParticipant ? 'Join this lobby to take the open challenger slot.' : match.guest ? 'Both combatants must confirm readiness before the host can start.' : 'Share the room code and wait for a challenger to join.'}</p>
                </div>
                <div className="lobby-buttons">
                  {!viewerIsParticipant ? (
                    <button className="action-button action-button-red" disabled={busyAction !== '' || Boolean(match.guest)} onClick={joinThisDuel} type="button">
                      {busyAction === 'join' ? <><LoaderCircle className="spin" size={16} /> JOINING...</> : <>JOIN THIS DUEL <ArrowUpRight size={16} /></>}
                    </button>
                  ) : (
                    <button
                      className={`action-button ${viewerReady ? 'action-button-ready' : 'action-button-outline'}`}
                      disabled={busyAction !== ''}
                      onClick={toggleReady}
                      type="button"
                    >
                      {busyAction === 'ready' ? <><LoaderCircle className="spin" size={16} /> UPDATING...</> : <>{viewerReady ? <Check size={16} /> : null}{viewerReady ? 'READY CONFIRMED' : 'I AM READY'}</>}
                    </button>
                  )}
                  {viewerIsHost && (
                    <button
                      className="action-button action-button-red"
                      disabled={!bothPlayersReady || busyAction !== ''}
                      onClick={startMatch}
                      type="button"
                    >
                      {busyAction === 'start' ? <><LoaderCircle className="spin" size={16} /> INITIALIZING...</> : <>START MATCH <ArrowUpRight size={16} /></>}
                    </button>
                  )}
                  <button className="leave-lobby-button" onClick={() => navigate('/dashboard')} type="button">LEAVE LOBBY</button>
                </div>
              </>
            )}
          </section>

          <footer className="dashboard-footer"><span>LOCKEDIN // ARENA</span><span>ROOM {match.roomCode} / {match.status}</span></footer>
        </>
      )}
    </main>
  )
}
