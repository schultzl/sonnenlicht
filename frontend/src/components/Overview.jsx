import { useState, useEffect } from 'react'
import { CalendarDays, Scale, Percent, Moon } from 'lucide-react'
import { api } from '../api'
import { fmtGrams, fmtDate, fmtMinutesRange } from '../format'

function MetricCard({ Icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
        <Icon size={15} className="text-amber-500" />
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-sm text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function Overview({ child }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getOverview(child.id).then(setData).catch((e) => setError(e.message))
  }, [child.id])

  if (error)
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    )
  if (!data) return <div className="text-center py-16 text-gray-400">Lädt…</div>

  const { age, sleep, weight } = data
  const latest = weight?.latest
  const delta = weight?.delta

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          Icon={CalendarDays}
          label="Alter"
          value={`Woche ${age.weeks}`}
          sub={`Tag ${age.days} · insgesamt ${age.total_days} Tage`}
        />
        <MetricCard
          Icon={Scale}
          label="Letztes Gewicht"
          value={latest ? fmtGrams(latest.weight_grams) : '—'}
          sub={
            latest
              ? delta
                ? `${delta.grams >= 0 ? '+' : ''}${fmtGrams(delta.grams)} in ${delta.days} Tagen`
                : `am ${fmtDate(latest.measured_on)}`
              : 'Noch kein Eintrag'
          }
        />
        <MetricCard
          Icon={Percent}
          label="Perzentile"
          value={latest && latest.percentile != null ? `P${Math.round(latest.percentile)}` : '—'}
          sub={latest && latest.z != null ? `z = ${latest.z}` : 'Noch kein Eintrag'}
        />
      </div>

      {/* Sleep bracket for the current age */}
      <div className="bg-white rounded-xl border border-amber-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Moon size={16} className="text-amber-500" />
          <h3 className="font-semibold text-gray-900">
            Schlaf in diesem Alter (Woche {sleep.week_from}–{sleep.week_to})
          </h3>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Gesamtschlaf</dt>
            <dd className="font-semibold text-gray-900 mt-0.5">
              {sleep.total_sleep_min_h}–{sleep.total_sleep_max_h} h
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Wachfenster</dt>
            <dd className="font-semibold text-gray-900 mt-0.5">
              {fmtMinutesRange(sleep.wake_window_min, sleep.wake_window_max)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Nickerchen</dt>
            <dd className="font-semibold text-gray-900 mt-0.5">{sleep.naps} pro Tag</dd>
          </div>
          <div>
            <dt className="text-gray-500">Länge pro Nickerchen</dt>
            <dd className="font-semibold text-gray-900 mt-0.5">
              {fmtMinutesRange(sleep.nap_length_min, sleep.nap_length_max)}
            </dd>
          </div>
        </dl>
        {sleep.notes && <p className="text-sm text-gray-500 mt-4">{sleep.notes}</p>}
      </div>
    </div>
  )
}
