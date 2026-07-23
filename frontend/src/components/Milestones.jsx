import { useState, useEffect, useCallback } from 'react'
import { Award, Check } from 'lucide-react'
import { api } from '../api'
import { fmtDate } from '../format'

const today = () => new Date().toISOString().slice(0, 10)

const currentWeek = (birthDate) =>
  Math.max(0, Math.floor((Date.now() - new Date(birthDate + 'T00:00:00')) / 604800000))

function MilestoneRow({ m, achievedOn, onMark, onUnmark }) {
  const [date, setDate] = useState(today)
  const achieved = achievedOn != null

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
              m.category === 'Motorik' ? 'bg-cyan-50 text-cyan-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {m.category}
          </span>
          <span className="font-medium text-gray-900 text-sm">{m.title}</span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{m.description}</p>
      </div>
      {achieved ? (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-emerald-600 flex items-center gap-1">
            <Check size={14} /> {fmtDate(achievedOn)}
          </span>
          <button
            onClick={onUnmark}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Zurücksetzen
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={today()}
            className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            onClick={() => onMark(date)}
            className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium px-2 py-1.5 rounded transition-colors"
          >
            Erreicht
          </button>
        </div>
      )}
    </div>
  )
}

export default function Milestones({ child }) {
  const [table, setTable] = useState(null)
  const [achievements, setAchievements] = useState(null)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([
        api.getMilestones(),
        api.getMilestoneAchievements(child.id),
      ])
      setTable(t)
      setAchievements(a)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [child.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleMark(key, achievedOn) {
    try {
      await api.setMilestoneAchieved(child.id, key, achievedOn)
      await refresh()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleUnmark(key) {
    try {
      await api.unsetMilestoneAchieved(child.id, key)
      await refresh()
    } catch (e) {
      setError(e.message)
    }
  }

  if (error)
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    )
  if (!table || !achievements) return <div className="text-center py-16 text-gray-400">Lädt…</div>

  const achievedMap = new Map(achievements.map((a) => [a.milestone_key, a.achieved_on]))
  const week = currentWeek(child.birth_date)
  const achievedCount = table.filter((m) => achievedMap.has(m.key)).length

  const brackets = [
    ...new Map(
      table.map((m) => [`${m.week_from}-${m.week_to}`, { week_from: m.week_from, week_to: m.week_to }])
    ).values(),
  ].sort((a, b) => a.week_from - b.week_from)

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Erreichte Meilensteine</div>
          <div className="text-2xl font-bold text-gray-900">
            {achievedCount} / {table.length}
          </div>
        </div>
        <Award className="text-amber-500" size={28} />
      </div>

      {/* Milestones grouped by age bracket */}
      {brackets.map((b) => {
        const items = table.filter((m) => m.week_from === b.week_from && m.week_to === b.week_to)
        const isActive = week >= b.week_from && week <= b.week_to
        return (
          <div
            key={`${b.week_from}-${b.week_to}`}
            className={`bg-white rounded-xl border p-4 shadow-sm ${
              isActive ? 'border-amber-400 ring-1 ring-amber-200' : 'border-amber-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">
                Woche {b.week_from}–{b.week_to}
              </h3>
              {isActive && (
                <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded">
                  aktuell
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {items.map((m) => (
                <MilestoneRow
                  key={m.key}
                  m={m}
                  achievedOn={achievedMap.get(m.key)}
                  onMark={(d) => handleMark(m.key, d)}
                  onUnmark={() => handleUnmark(m.key)}
                />
              ))}
            </div>
          </div>
        )
      })}

      <p className="text-xs text-gray-400 px-1">
        Referenz: CDC „Learn the Signs. Act Early.“ — Kinder entwickeln sich unterschiedlich
        schnell; Abweichungen von diesen Fenstern sind häufig normal.
      </p>
    </div>
  )
}
