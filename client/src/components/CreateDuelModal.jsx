import { useState } from 'react'
import { ArrowUpRight, LoaderCircle, Plus, Swords, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const DURATIONS = [15, 30, 45, 60]
const PROBLEM_COUNTS = [3, 4, 5]
const RATINGS = [800, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2400]
const DEFAULT_TIERS = [
  { minRating: 800, maxRating: 1000, points: 250 },
  { minRating: 1000, maxRating: 1200, points: 500 },
  { minRating: 1200, maxRating: 1400, points: 750 },
  { minRating: 1400, maxRating: 1600, points: 1000 },
  { minRating: 1600, maxRating: 1800, points: 1250 },
]

export default function CreateDuelModal({ onClose }) {
  const navigate = useNavigate()
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [problemCount, setProblemCount] = useState(4)
  const [problemTiers, setProblemTiers] = useState(() => DEFAULT_TIERS.slice(0, 4))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function changeProblemCount(count) {
    setProblemCount(count)
    setProblemTiers((current) =>
      Array.from({ length: count }, (_, index) => current[index] || DEFAULT_TIERS[index])
    )
  }

  function updateTier(index, field, value) {
    const numericValue = Number(value)
    setProblemTiers((current) =>
      current.map((tier, tierIndex) => {
        if (tierIndex !== index) return tier
        const nextTier = { ...tier, [field]: numericValue }
        if (field === 'minRating' && nextTier.maxRating < numericValue) {
          nextTier.maxRating = numericValue
        }
        if (field === 'maxRating' && nextTier.minRating > numericValue) {
          nextTier.minRating = numericValue
        }
        return nextTier
      })
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { data } = await api.post('/matches', {
        durationMinutes,
        problemCount,
        problemTiers,
      })
      const roomCode = data.roomCode || data.match?.roomCode
      if (!roomCode) {
        throw new Error('The server created the match but did not return its room code.')
      }
      onClose()
      navigate(`/lobby/${encodeURIComponent(roomCode)}`)
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not create the duel.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose()
      }}
      role="presentation"
    >
      <section aria-labelledby="create-duel-title" aria-modal="true" className="create-duel-modal" role="dialog">
        <div className="modal-topline">
          <span><Swords size={16} /> HOST CONFIGURATION / NEW DUEL</span>
          <button aria-label="Close create duel dialog" className="icon-button" disabled={submitting} onClick={onClose} type="button"><X size={19} /></button>
        </div>

        <div className="create-duel-heading">
          <p className="kicker">SET THE TERMS OF ENGAGEMENT</p>
          <h2 id="create-duel-title">BUILD YOUR<br />ARENA<span className="red-period">.</span></h2>
        </div>

        {error && (
          <div className="error-banner create-error" role="alert">
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError('')} type="button"><X size={15} /></button>
          </div>
        )}

        <form className="duel-config-form" onSubmit={handleSubmit}>
          <fieldset className="config-fieldset">
            <legend className="field-label">MATCH DURATION</legend>
            <div className="duration-options">
              {DURATIONS.map((duration) => (
                <button
                  aria-pressed={durationMinutes === duration}
                  className={`duration-option ${durationMinutes === duration ? 'selected' : ''}`}
                  key={duration}
                  onClick={() => setDurationMinutes(duration)}
                  type="button"
                >
                  {duration}M
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="config-fieldset">
            <legend className="field-label">PROBLEM COUNT</legend>
            <div className="count-options">
              {PROBLEM_COUNTS.map((count) => (
                <button
                  aria-pressed={problemCount === count}
                  className={`count-option ${problemCount === count ? 'selected' : ''}`}
                  key={count}
                  onClick={() => changeProblemCount(count)}
                  type="button"
                >
                  <strong>{count}</strong><span>PROBLEMS</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="config-fieldset">
            <legend className="field-label">PROBLEM TIERS / POINT WEIGHT</legend>
            <div className="tier-grid">
              {problemTiers.map((tier, index) => {
                const maxOptions = RATINGS.filter((rating) => rating >= tier.minRating)
                const minOptions = RATINGS.filter((rating) => rating <= tier.maxRating)
                return (
                  <div className="tier-row" key={`tier-${index + 1}`}>
                    <span className="tier-slot">P{index + 1}</span>
                    <label className="tier-control">
                      <span>MIN RATING</span>
                      <select
                        aria-label={`Problem ${index + 1} minimum Codeforces rating`}
                        onChange={(event) => updateTier(index, 'minRating', event.target.value)}
                        value={tier.minRating}
                      >
                        {minOptions.map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                      </select>
                    </label>
                    <label className="tier-control">
                      <span>MAX RATING</span>
                      <select
                        aria-label={`Problem ${index + 1} maximum Codeforces rating`}
                        onChange={(event) => updateTier(index, 'maxRating', event.target.value)}
                        value={tier.maxRating}
                      >
                        {maxOptions.map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                      </select>
                    </label>
                    <label className="tier-control points-control">
                      <span>POINTS</span>
                      <input
                        aria-label={`Problem ${index + 1} points`}
                        min="1"
                        onChange={(event) => updateTier(index, 'points', event.target.value)}
                        required
                        step="1"
                        type="number"
                        value={tier.points}
                      />
                    </label>
                  </div>
                )
              })}
            </div>
          </fieldset>

          <button className="submit-button initialize-button" disabled={submitting} type="submit">
            {submitting ? <><LoaderCircle className="spin" size={17} /> RESERVING ROOM...</> : <>INITIALIZE ARENA LOBBY <ArrowUpRight size={17} /></>}
          </button>
        </form>
        <div className="modal-foot"><span>ROOM CODE GENERATED ON CREATE</span><span><Plus size={12} /> HOST / 1 PLAYER</span></div>
      </section>
    </div>
  )
}
