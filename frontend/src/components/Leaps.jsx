import { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { api } from '../api'
import { fmtMonthRange } from '../format'
import { useAge } from '../useAge'
import AgeInfo from './AgeInfo'

export default function Leaps({ child, onChildUpdated }) {
  const [table, setTable] = useState(null)
  const [error, setError] = useState(null)
  const age = useAge(child)

  useEffect(() => {
    api.getLeaps().then(setTable).catch((e) => setError(e.message))
  }, [])

  if (error)
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    )
  if (!table) return <div className="text-center py-16 text-gray-400">Lädt…</div>

  return (
    <div className="space-y-4">
      {age && <AgeInfo child={child} age={age} onChildUpdated={onChildUpdated} />}

      <div className="space-y-3">
        {table.map((leap) => {
          const isActive = age?.leap?.number === leap.number
          const isNext = !age?.leap && age?.next_leap?.number === leap.number
          return (
            <div
              key={leap.number}
              className={`bg-white rounded-xl border p-4 shadow-sm ${
                isActive ? 'border-amber-400 ring-1 ring-amber-200' : 'border-amber-100'
              }`}
            >
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Sparkles size={15} className="text-amber-500 shrink-0" />
                <h3 className="font-semibold text-gray-900">
                  Sprung {leap.number}: {leap.name}
                </h3>
                {isActive && (
                  <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded">
                    aktuell
                  </span>
                )}
                {isNext && (
                  <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                    als nächstes
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-1.5">
                ab ET: Woche {leap.week_from}–{leap.week_to} · ≈{' '}
                {fmtMonthRange(leap.week_from, leap.week_to)}
              </p>
              <p className="text-sm text-gray-700">{leap.skills}</p>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 px-1">
        Zeitfenster gelten ab dem errechneten Termin (ET), nicht dem Geburtsdatum, und sind
        Richtwerte — der tatsächliche Verlauf kann pro Kind deutlich abweichen.
      </p>
    </div>
  )
}
