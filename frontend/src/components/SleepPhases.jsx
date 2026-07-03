import { useState, useEffect } from 'react'
import { api } from '../api'
import { fmtMinutesRange } from '../format'

const currentWeek = (birthDate) =>
  Math.max(0, Math.floor((Date.now() - new Date(birthDate + 'T00:00:00')) / 604800000))

export default function SleepPhases({ child }) {
  const [table, setTable] = useState(null)
  const [error, setError] = useState(null)
  const [week, setWeek] = useState(() => Math.min(currentWeek(child.birth_date), 104))

  useEffect(() => {
    api.getSleepPhases().then(setTable).catch((e) => setError(e.message))
  }, [])

  if (error)
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    )
  if (!table) return <div className="text-center py-16 text-gray-400">Lädt…</div>

  const maxWeek = table[table.length - 1].week_to
  const active =
    table.find((r) => week >= r.week_from && week <= r.week_to) || table[table.length - 1]
  const babyWeek = currentWeek(child.birth_date)

  return (
    <div className="space-y-4">
      {/* Week selector */}
      <div className="bg-white rounded-xl border border-amber-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Woche <span className="text-amber-600 font-bold">{week}</span> anzeigen
          </label>
          {week !== Math.min(babyWeek, maxWeek) && (
            <button
              onClick={() => setWeek(Math.min(babyWeek, maxWeek))}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              Zurück zu heute (Woche {babyWeek})
            </button>
          )}
        </div>
        <input
          type="range"
          min="0"
          max={maxWeek}
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Geburt</span>
          <span>1 Jahr</span>
          <span>2 Jahre</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Alter</th>
              <th className="px-4 py-3 font-medium">Gesamtschlaf</th>
              <th className="px-4 py-3 font-medium">Wachfenster</th>
              <th className="px-4 py-3 font-medium">Nickerchen</th>
              <th className="px-4 py-3 font-medium">Länge pro Nickerchen</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => {
              const isActive = row === active
              return (
                <tr
                  key={row.week_from}
                  className={`border-b border-gray-50 last:border-0 ${
                    isActive ? 'bg-amber-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    Woche {row.week_from}–{row.week_to}
                    {isActive && (
                      <span className="ml-2 text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded">
                        Woche {week}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.total_sleep_min_h}–{row.total_sleep_max_h} h
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {fmtMinutesRange(row.wake_window_min, row.wake_window_max)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.naps}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {fmtMinutesRange(row.nap_length_min, row.nap_length_max)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500 bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
        {active.notes} <span className="text-gray-400">(Quelle: {active.source})</span>
      </p>
    </div>
  )
}
