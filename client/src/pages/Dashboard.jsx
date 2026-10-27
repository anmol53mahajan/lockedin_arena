import { useEffect, useState } from 'react'
import { ArrowUpRight, BadgeCheck, Clock3, Crosshair, Crown, LoaderCircle, Plus, Swords, Target, Trophy, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import VerifyHandleModal from '../components/VerifyHandleModal'
import CreateDuelModal from '../components/CreateDuelModal'

function MetricCard({ label, value, note, icon: Icon, accent = false }) {
  return (
    <article className={`metric-card ${accent ? 'metric-accent' : ''}`}>
      <div className="metric-top"><span>{label}</span><Icon size={16} /></div>
      <strong>{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  )
}

export default function Dashboard() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [showVerification, setShowVerification] = useState(false)
  const [showCreateDuel, setShowCreateDuel] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('error')
  const [joining, setJoining] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')

  useEffect(() => {
    let active = true
    api.get('/matches/user/history')
      .then(({ data }) => {
        if (active) setHistory(Array.isArray(data.matches) ? data.matches.slice(0, 5) : [])
      })
      .catch((requestError) => {
        if (active) {
          setHistoryError(requestError.response?.data?.message || requestError.message || 'Could not load combat history.')
        }
      })
      .finally(() => {
        if (active) setHistoryLoading(false)
      })
    refreshUser().catch((requestError) => {
      if (active) {
        setNoticeType('error')
        setNotice(requestError.response?.data?.message || 'Could not refresh your latest rating profile.')
      }
    })
    return () => { active = false }
  }, [refreshUser])

  const stats = user?.stats || {}
  const totalMatches = Number(stats.totalMatches || 0)
  const wins = Number(stats.wins || 0)
  const losses = Number(stats.losses || 0)
  const ties = Number(stats.ties || 0)
  const winRate = totalMatches ? Math.round((wins / totalMatches) * 100) : 0

  function handleCreateDuel() {
    setNotice('')
    if (!user?.isVerified) {
      setNoticeType('error')
      setNotice('Verify your Codeforces handle before creating a duel.')
      setShowVerification(true)
      return
    }
    setShowCreateDuel(true)
  }

  async function handleJoinDuel(event) {
    event.preventDefault()
    setNotice('')
    if (!/^[A-Z0-9]{6}$/.test(roomCode.trim().toUpperCase())) {
      setNoticeType('error')
      setNotice('ROOM CODES MUST BE EXACTLY 6 LETTERS OR NUMBERS.')
      return
    }

    setJoining(true)
    try {
      const { data } = await api.post('/matches/join', { roomCode: roomCode.trim().toUpperCase() })
      const joinedRoomCode = data.match?.roomCode || roomCode.trim().toUpperCase()
      navigate(`/lobby/${encodeURIComponent(joinedRoomCode)}`)
    } catch (requestError) {
      setNoticeType('error')
      setNotice(requestError.response?.data?.message || requestError.message || 'Could not enter that arena.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="eyebrow"><span className="eyebrow-rule" /> COMPETITOR PROFILE / ACTIVE</div>
          <h1>THE ARENA<br /><span>IS YOURS.</span></h1>
          <p>Every problem is a fight. Every point is earned.</p>
        </div>
        <div className="player-card">
          <div className="player-card-top"><span>PLAYER // 001</span><span className="player-live"><i /> ONLINE</span></div>
          <div className="player-name">{user?.username || 'COMPETITOR'}</div>
          <div className="player-details">
            {user?.isVerified ? (
              <span className="status-chip status-verified"><BadgeCheck size={14} /> CF VERIFIED</span>
            ) : (
              <button className="status-chip status-unverified verify-trigger" onClick={() => setShowVerification(true)} type="button">
                <span>UNVERIFIED — VERIFY HANDLE</span><ArrowUpRight size={14} />
              </button>
            )}
            {user?.cfHandle && <span className="player-handle"># {user.cfHandle}</span>}
          </div>
          <div className="player-rating"><span>PLATFORM RATING</span><strong>{Number(user?.platformRating ?? 1200).toLocaleString()} <small>ELO</small></strong></div>
          <div className="combat-ratio">
            <span>COMBAT RECORD</span>
            <strong><b>{wins}W</b><i>/</i><b>{losses}L</b><i>/</i><b>{ties}T</b></strong>
          </div>
        </div>
        <span aria-hidden="true" className="hero-scribble">EARN<br />YOUR<br />STRIPES.</span>
      </section>

      <section aria-label="Arena actions" className="action-grid">
        <article className="action-card create-card">
          <div className="action-card-head"><span>01 / HOST A MATCH</span><Swords size={18} /></div>
          <div className="action-title">CREATE<br />DUEL<span className="red-period">.</span></div>
          <p>Host a customized lockout match.</p>
          <button className="action-button action-button-red" disabled={joining} onClick={handleCreateDuel} type="button">
            <Plus size={17} /> CREATE DUEL
          </button>
        </article>

        <article className="action-card join-card">
          <div className="action-card-head"><span>02 / CHALLENGE ACCEPTED</span><Users size={18} /></div>
          <div className="action-title">JOIN VIA<br />CODE<span className="red-period">.</span></div>
          <p>Got a room code? Enter the arena.</p>
          <form className="join-form" onSubmit={handleJoinDuel}>
            <label className="sr-only" htmlFor="room-code">Six-character room code</label>
            <input
              autoComplete="off"
              className="arena-input room-input"
              id="room-code"
              maxLength={6}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="ROOM CODE"
              value={roomCode}
            />
            <button className="action-button action-button-outline" disabled={joining} type="submit">
              {joining ? 'CONNECTING...' : <>ENTER ARENA <ArrowUpRight size={16} /></>}
            </button>
          </form>
        </article>
      </section>

      {notice && (
        <div className={`dashboard-notice ${noticeType === 'success' ? 'dashboard-notice-success' : ''}`} role="alert">
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice('')} type="button">×</button>
        </div>
      )}

      <section aria-label="Combat statistics" className="stats-section">
        <div className="section-heading"><span>COMBAT RECORD</span><span>CAREER / ALL TIME</span></div>
        <div className="metrics-grid">
          <MetricCard accent icon={Crosshair} label="CURRENT RATING" note="ARENA ELO" value={Number(user?.platformRating ?? 1200).toLocaleString()} />
          <MetricCard icon={Crown} label="PEAK RATING" note="PERSONAL BEST" value={Number(user?.peakRating ?? 1200).toLocaleString()} />
          <MetricCard icon={Swords} label="TOTAL DUELS" note="MATCHES FOUGHT" value={totalMatches.toLocaleString()} />
          <MetricCard icon={Trophy} label="WIN RATE" note="CAREER VICTORIES" value={`${winRate}%`} />
        </div>
      </section>

      <section className="battle-history">
        <div className="section-heading"><span>RECENT BATTLES</span><span>LAST 05 / MATCH LOG</span></div>
        {historyLoading ? (
          <div className="history-state"><LoaderCircle className="spin" size={20} /><span>LOADING COMBAT RECORDS...</span></div>
        ) : historyError ? (
          <div className="history-state history-error" role="alert">{historyError}</div>
        ) : history.length ? (
          <div className="combat-log-list">
            {history.map((match) => {
              const isHost = match.host?._id?.toString() === user?._id?.toString()
              const opponent = isHost ? match.guest : match.host
              const side = isHost ? 'HOST' : 'GUEST'
              const result = match.winner === 'TIE' ? 'TIE' : match.winner === side ? 'VICTORY' : 'DEFEAT'
              const delta = isHost ? match.hostDelta : match.guestDelta
              return (
                <Link className="combat-log-row" key={match._id} to={`/match/${encodeURIComponent(match.roomCode)}`}>
                  <span className="combat-log-avatar">{(opponent?.cfHandle || opponent?.username || '?').slice(0, 1).toUpperCase()}</span>
                  <span className="combat-log-opponent"><strong>{opponent?.cfHandle || opponent?.username || 'OPPONENT'}</strong><small>{opponent?.username ? `@${opponent.username}` : `ROOM // ${match.roomCode}`}</small></span>
                  <span className={`combat-log-result result-${result.toLowerCase()}`}>{result}</span>
                  <span className="combat-log-score">{Number(match.scores?.hostScore || 0).toLocaleString()} <i>—</i> {Number(match.scores?.guestScore || 0).toLocaleString()}</span>
                  <span className={`combat-log-delta ${delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : ''}`}>{Number.isFinite(delta) ? `${delta > 0 ? '+' : ''}${delta}` : '—'}</span>
                  <span className="combat-log-date"><Clock3 size={12} />{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(match.endTime || match.createdAt))}</span>
                  <ArrowUpRight aria-hidden="true" className="combat-log-open" size={15} />
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="empty-history">
            <Target size={29} strokeWidth={1.4} />
            <p>NO COMBAT LOGS YET.</p>
            <span>HOST OR JOIN A DUEL TO RECORD YOUR FIRST MATCH.</span>
          </div>
        )}
      </section>

      <footer className="dashboard-footer"><span>LOCKEDIN // ARENA</span><span>NO GLORY WITHOUT THE GRIND.</span></footer>

      {showVerification && <VerifyHandleModal onClose={() => setShowVerification(false)} />}
      {showCreateDuel && <CreateDuelModal onClose={() => setShowCreateDuel(false)} />}
    </main>
  )
}
