import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Crown, LoaderCircle, Search, ShieldAlert, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import './Leaderboard.css'

const PAGE_SIZE = 20

function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

function TierBadge({ tier }) {
  return <span className={`leaderboard-tier tier-${(tier || 'initiate').toLowerCase()}`}>{tier || 'INITIATE'}</span>
}

function PodiumCard({ player }) {
  const place = player.rank === 1 ? 'first' : player.rank === 2 ? 'second' : 'third'
  return (
    <article className={`podium-card podium-${place}`}>
      <div className="podium-card-top">
        <span className="podium-rank">#{String(player.rank).padStart(2, '0')}</span>
        {player.rank === 1 && <Crown aria-label="First place" size={17} />}
      </div>
      <strong className="podium-name">{player.username}</strong>
      <span className="podium-handle">
        {player.cfHandle ? `# ${player.cfHandle}` : 'NO CF HANDLE LINKED'}
        {player.isVerified && <span className="leaderboard-verified-label"><BadgeCheck aria-hidden="true" size={12} /> CF VERIFIED</span>}
      </span>
      <div className="podium-rating">{formatNumber(player.platformRating)} <small>ELO</small></div>
      <div className="podium-meta">
        <TierBadge tier={player.tier} />
        <span>{formatNumber(player.stats?.wins)} WINS</span>
      </div>
    </article>
  )
}

function LeaderboardRow({ player }) {
  const stats = player.stats || {}
  return (
    <tr>
      <td className="leaderboard-rank">#{String(player.rank).padStart(2, '0')}</td>
      <td>
        <div className="leaderboard-identity">
          <span className="leaderboard-avatar">{(player.username || '?').slice(0, 1).toUpperCase()}</span>
          <span className="leaderboard-player-name">
            <strong>{player.username}</strong>
            <small>{player.cfHandle ? `# ${player.cfHandle}` : 'NO CF HANDLE'}</small>
          </span>
          {player.isVerified && (
            <span className="leaderboard-verified-label">
              <BadgeCheck aria-hidden="true" size={13} /> CF VERIFIED
            </span>
          )}
        </div>
      </td>
      <td className="leaderboard-rating">
        <strong>{formatNumber(player.platformRating)}</strong>
        <small>PEAK {formatNumber(player.peakRating)}</small>
      </td>
      <td className="leaderboard-record">
        <strong>{formatNumber(stats.wins)}W <i>/</i> {formatNumber(stats.losses)}L <i>/</i> {formatNumber(stats.ties)}T</strong>
        <small>{formatNumber(stats.totalMatches)} TOTAL DUELS</small>
      </td>
      <td className="leaderboard-winrate">{Number(player.winRate || 0).toFixed(1)}<small>%</small></td>
      <td><TierBadge tier={player.tier} /></td>
    </tr>
  )
}

export default function Leaderboard() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [retryCount, setRetryCount] = useState(0)
  const [data, setData] = useState({ leaderboard: [], totalUsers: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const nextSearch = searchInput.trim()
    if (nextSearch === search) return undefined

    const timeout = window.setTimeout(() => {
      setLoading(true)
      setError('')
      setPage(1)
      setSearch(nextSearch)
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [searchInput, search])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    api.get('/leaderboard', {
        params: { page, limit: PAGE_SIZE, ...(search ? { search } : {}) },
        signal: controller.signal,
    })
        .then(({ data: response }) => {
          if (active) {
            setData({
              leaderboard: Array.isArray(response.leaderboard) ? response.leaderboard : [],
              totalUsers: Number(response.totalUsers || 0),
              totalPages: Number(response.totalPages || 0),
            })
          }
        })
        .catch((requestError) => {
          if (active && requestError.code !== 'ERR_CANCELED') {
            setError(requestError.response?.data?.message || requestError.message || 'Could not load the global leaderboard.')
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })

    return () => {
        active = false
        controller.abort()
    }
  }, [page, search, retryCount])

  function handleSearchChange(event) {
    setSearchInput(event.target.value)
  }

  function handlePageChange(nextPage) {
    setLoading(true)
    setError('')
    setPage(nextPage)
  }

  function handleRetry() {
    setLoading(true)
    setError('')
    setRetryCount((count) => count + 1)
  }

  const podium = data.leaderboard.filter((player) => player.rank <= 3).sort((a, b) => a.rank - b.rank)

  return (
    <main className="leaderboard-page">
      <header className="leaderboard-hero">
        <div className="leaderboard-hero-copy">
          <div className="eyebrow"><span className="eyebrow-rule" /> GLOBAL RANKINGS / LIVE</div>
          <h1>THE<br /><span>PECKING<br />ORDER.</span></h1>
          <p>Every point is earned. Every spot is yours to take.</p>
        </div>
        <aside className="leaderboard-hero-stat">
          <div className="leaderboard-stat-icon"><Trophy size={22} /></div>
          <span>REGISTERED COMPETITORS</span>
          <strong>{formatNumber(data.totalUsers)}</strong>
          <small>{search ? 'MATCHING PLAYERS' : 'RANKED BY PLATFORM ELO'}</small>
        </aside>
      </header>

      <div className="leaderboard-toolbar">
        <div className="leaderboard-toolbar-copy">
          <span className="section-heading-label">GLOBAL LADDER</span>
          <span className="leaderboard-results-count">
            {loading ? 'SYNCING RANKS...' : `SHOWING ${data.totalUsers ? (page - 1) * PAGE_SIZE + 1 : 0}–${Math.min(page * PAGE_SIZE, data.totalUsers)} OF ${formatNumber(data.totalUsers)}`}
          </span>
        </div>
        <label className="leaderboard-search">
          <Search aria-hidden="true" size={16} />
          <span className="sr-only">Search by username or Codeforces handle</span>
          <input
            autoComplete="off"
            maxLength={64}
            onChange={handleSearchChange}
            placeholder="SEARCH COMPETITORS"
            type="search"
            value={searchInput}
          />
          {searchInput && (
            <button aria-label="Clear search" onClick={() => setSearchInput('')} type="button">×</button>
          )}
        </label>
      </div>

      {error ? (
        <div className="leaderboard-message leaderboard-error" role="alert">
          <AlertTriangle size={20} />
          <div><strong>RANKING FEED INTERRUPTED</strong><span>{error}</span></div>
          <button onClick={handleRetry} type="button">RETRY</button>
        </div>
      ) : (
        <>
          {podium.length > 0 && (
            <section aria-label="Top three competitors" className="leaderboard-podium">
              <div className="section-heading"><span>THE TOP THREE</span><span>THE ONES TO BEAT</span></div>
              <div className="podium-grid">
                {podium.map((player) => <PodiumCard key={player._id} player={player} />)}
              </div>
            </section>
          )}

          <section aria-label="Global competitor rankings" className="leaderboard-table-section">
            <div className="section-heading"><span>ARENA RANKINGS</span><span>PLATFORM ELO // COMBAT RECORD</span></div>
            {loading ? (
              <div className="leaderboard-message leaderboard-loading" role="status">
                <LoaderCircle aria-hidden="true" className="leaderboard-spinner" size={22} />
                <span>SYNCING GLOBAL RANKS...</span>
              </div>
            ) : data.leaderboard.length ? (
              <div className="leaderboard-table-scroll">
                <table className="leaderboard-table">
                  <thead>
                    <tr><th scope="col">RANK</th><th scope="col">COMPETITOR</th><th scope="col">RATING</th><th scope="col">COMBAT RECORD</th><th scope="col">WIN RATE</th><th scope="col">TIER</th></tr>
                  </thead>
                  <tbody>{data.leaderboard.map((player) => <LeaderboardRow key={player._id} player={player} />)}</tbody>
                </table>
              </div>
            ) : (
              <div className="leaderboard-message leaderboard-empty">
                <div className="leaderboard-empty-icon">{search ? <Search size={22} /> : <ShieldAlert size={22} />}</div>
                <strong>{search ? 'NO COMPETITORS FOUND.' : 'THE LADDER IS WAITING.'}</strong>
                <span>{search ? 'Try another username or Codeforces handle.' : 'Be the first to enter the global rankings.'}</span>
              </div>
            )}

            {data.totalPages > 1 && (
              <nav aria-label="Leaderboard pages" className="leaderboard-pagination">
                <button disabled={loading || page <= 1} onClick={() => handlePageChange(page - 1)} type="button">
                  <ArrowLeft size={15} /> PREVIOUS
                </button>
                <span>PAGE <strong>{page}</strong> <i>/</i> {data.totalPages}</span>
                <button disabled={loading || page >= data.totalPages} onClick={() => handlePageChange(page + 1)} type="button">
                  NEXT <ArrowRight size={15} />
                </button>
              </nav>
            )}
          </section>
        </>
      )}

      <footer className="dashboard-footer">
        <Link to="/dashboard"><ArrowLeft size={13} /> BACK TO YOUR ARENA</Link>
        <span>NO GLORY WITHOUT THE GRIND.</span>
      </footer>
    </main>
  )
}
