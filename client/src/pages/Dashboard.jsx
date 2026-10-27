import { useState } from 'react'
import { ArrowUpRight, BadgeCheck, Crosshair, Crown, Plus, Swords, Target, Trophy, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import VerifyHandleModal from '../components/VerifyHandleModal'

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
  const { user } = useAuth()
  const [showVerification, setShowVerification] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [notice, setNotice] = useState('')

  const stats = user?.stats || {}
  const totalMatches = Number(stats.totalMatches || 0)
  const wins = Number(stats.wins || 0)
  const losses = Number(stats.losses || 0)
  const ties = Number(stats.ties || 0)
  const winRate = totalMatches ? Math.round((wins / totalMatches) * 100) : 0

  function handleCreateDuel() {
    setNotice('DUEL LOBBIES ARE NOT AVAILABLE YET. Your player profile is ready for the next arena update.')
  }

  function handleJoinDuel(event) {
    event.preventDefault()
    setNotice('')
    if (!/^[A-Z0-9]{6}$/.test(roomCode.trim().toUpperCase())) {
      setNotice('ROOM CODES MUST BE EXACTLY 6 LETTERS OR NUMBERS.')
      return
    }
    setNotice('ROOM CODE ACCEPTED. Live duel rooms are not available yet.')
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
          <button className="action-button action-button-red" onClick={handleCreateDuel} type="button">
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
            <button className="action-button action-button-outline" type="submit">ENTER ARENA <ArrowUpRight size={16} /></button>
          </form>
        </article>
      </section>

      {notice && <div className="dashboard-notice" role="status">{notice}</div>}

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
        <div className="empty-history">
          <Target size={29} strokeWidth={1.4} />
          <p>NO COMBAT LOGS YET.</p>
          <span>HOST OR JOIN A DUEL TO RECORD YOUR FIRST MATCH.</span>
        </div>
      </section>

      <footer className="dashboard-footer"><span>LOCKEDIN // ARENA</span><span>NO GLORY WITHOUT THE GRIND.</span></footer>

      {showVerification && <VerifyHandleModal onClose={() => setShowVerification(false)} />}
    </main>
  )
}
