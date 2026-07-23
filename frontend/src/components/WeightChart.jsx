import { useState, useEffect, useCallback } from 'react'
import { Trash2, Plus } from 'lucide-react'
import {
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../api'
import { fmtGrams, fmtDate } from '../format'

const today = () => new Date().toISOString().slice(0, 10)

function ChartTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  if (point.entry) {
    return (
      <div className="bg-white border border-amber-200 rounded-lg shadow-sm px-3 py-2 text-sm">
        <div className="font-medium text-gray-900">{fmtDate(point.entry.measured_on)}</div>
        <div className="text-gray-700">{fmtGrams(point.entry.weight_grams)}</div>
        {point.entry.percentile != null && (
          <div className="text-amber-600">≈ P{Math.round(point.entry.percentile)}</div>
        )}
      </div>
    )
  }
  return (
    <div className="bg-white border border-amber-200 rounded-lg shadow-sm px-3 py-2 text-sm">
      <div className="font-medium text-gray-900">Woche {point.week}</div>
      <div className="text-gray-500">
        P50: {point.p50?.toLocaleString('de-DE')} kg
      </div>
    </div>
  )
}

function fmtDelta(grams) {
  return `${grams >= 0 ? '+' : ''}${fmtGrams(grams)}`
}

function fmtDeltaDays(days) {
  return days === 1 ? 'zum Vortag' : `in ${days} Tagen`
}

function DeltaTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  return (
    <div className="bg-white border border-amber-200 rounded-lg shadow-sm px-3 py-2 text-sm">
      <div className="font-medium text-gray-900">{fmtDate(point.date)}</div>
      <div className={point.grams >= 0 ? 'text-emerald-600' : 'text-red-500'}>
        {fmtDelta(point.grams)}
      </div>
      <div className="text-gray-400 text-xs">{fmtDeltaDays(point.days)}</div>
    </div>
  )
}

export default function WeightChart({ child }) {
  const [weights, setWeights] = useState(null)
  const [curve, setCurve] = useState(null)
  const [error, setError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [date, setDate] = useState(today())
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('g')
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [w, c] = await Promise.all([api.getWeights(child.id), api.getGrowthCurve(child.id)])
      setWeights(w)
      setCurve(c)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [child.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    const num = Number(value.replace(',', '.'))
    if (!num || num <= 0) {
      setFormError('Bitte ein gültiges Gewicht eingeben')
      return
    }
    const grams = Math.round(unit === 'kg' ? num * 1000 : num)
    setSaving(true)
    try {
      await api.addWeight(child.id, { measured_on: date, weight_grams: grams })
      setValue('')
      await refresh()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entryId) {
    try {
      await api.deleteWeight(entryId)
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
  if (!weights || !curve) return <div className="text-center py-16 text-gray-400">Lädt…</div>

  const data = [
    ...curve.map((c) => ({
      week: c.week,
      outer: [c.p3, c.p97],
      inner: [c.p15, c.p85],
      p50: c.p50,
    })),
    ...weights.map((w) => ({ week: w.age_weeks, kg: w.weight_grams / 1000, entry: w })),
  ].sort((a, b) => a.week - b.week)

  // Difference to the previous entry, one point per entry (skipping the first, which has none).
  const deltas = weights.slice(1).map((w, i) => {
    const prev = weights[i]
    const days = Math.round(
      (new Date(w.measured_on + 'T00:00:00') - new Date(prev.measured_on + 'T00:00:00')) /
        86400000
    )
    return { id: w.id, week: w.age_weeks, date: w.measured_on, grams: w.weight_grams - prev.weight_grams, days }
  })
  const deltaById = new Map(deltas.map((d) => [d.id, d]))

  return (
    <div className="space-y-4">
      {/* Entry form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              min={child.birth_date}
              max={today()}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gewicht</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                placeholder={unit === 'g' ? 'z. B. 4260' : 'z. B. 4,26'}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg text-sm transition-colors"
          >
            <Plus size={15} />
            Eintragen
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Pro Tag wird ein Wert gespeichert — ein zweiter Eintrag am selben Tag überschreibt den ersten.
        </p>
        {formError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {formError}
          </div>
        )}
      </form>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-1">Gewichtsverlauf</h3>
        <p className="text-sm text-gray-500 mb-4">
          Entscheidend ist, dass die Kurve <span className="font-medium">parallel</span> zu den
          Perzentilen verläuft — nicht, dass sie auf der P50 liegt.
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 15, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              type="number"
              dataKey="week"
              domain={[0, 'dataMax']}
              tickCount={10}
              label={{ value: 'Alter (Wochen)', position: 'insideBottom', offset: -8, fontSize: 12 }}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 12 }}
              width={44}
              tickFormatter={(v) => `${v} kg`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              dataKey="outer"
              stroke="none"
              fill="#fde68a"
              fillOpacity={0.45}
              connectNulls
              isAnimationActive={false}
            />
            <Area
              dataKey="inner"
              stroke="none"
              fill="#fbbf24"
              fillOpacity={0.35}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="p50"
              stroke="#d97706"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="kg"
              stroke="#0e7490"
              strokeWidth={2}
              dot={{ r: 3, fill: '#0e7490' }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: '#fde68a' }} /> P3–P97
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: '#fbbf24' }} /> P15–P85
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-amber-600" /> P50 (Median)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2" style={{ borderColor: '#0e7490' }} /> {child.name}
          </span>
        </div>
      </div>

      {/* Delta chart */}
      {deltas.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-1">Veränderung zum vorherigen Eintrag</h3>
          <p className="text-sm text-gray-500 mb-4">
            Gewichtsdifferenz zwischen aufeinanderfolgenden Einträgen.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deltas} margin={{ top: 5, right: 10, bottom: 15, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                type="number"
                dataKey="week"
                domain={[0, 'dataMax']}
                tickCount={10}
                label={{ value: 'Alter (Wochen)', position: 'insideBottom', offset: -8, fontSize: 12 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} width={44} tickFormatter={(v) => `${v} g`} />
              <Tooltip content={<DeltaTooltip />} />
              <Bar dataKey="grams" radius={[3, 3, 0, 0]}>
                {deltas.map((d) => (
                  <Cell key={d.id} fill={d.grams >= 0 ? '#0e7490' : '#dc2626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Entry list */}
      {weights.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm divide-y divide-gray-50">
          {[...weights].reverse().map((w) => {
            const d = deltaById.get(w.id)
            return (
              <div key={w.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-baseline gap-3">
                  <span className="font-medium text-gray-900">{fmtGrams(w.weight_grams)}</span>
                  {d && (
                    <span className={d.grams >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {fmtDelta(d.grams)} ({fmtDeltaDays(d.days)})
                    </span>
                  )}
                  <span className="text-gray-500">{fmtDate(w.measured_on)}</span>
                  <span className="text-gray-400">Woche {Math.floor(w.age_days / 7)}</span>
                  {w.percentile != null && (
                    <span className="text-amber-600">≈ P{Math.round(w.percentile)}</span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(w.id)}
                  title="Eintrag löschen"
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
