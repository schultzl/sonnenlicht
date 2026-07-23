import { useState, useEffect, useCallback } from 'react'
import { Trash2, Plus, Milk, Droplet } from 'lucide-react'
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../api'
import { fmtMl, fmtDateTime } from '../format'

const TYPE_LABEL = { breast: 'Muttermilch', formula: 'Pre-Milch' }
const TYPE_COLOR = { breast: '#0e7490', formula: '#d97706' }

const nowLocal = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const currentWeek = (birthDate) =>
  Math.max(0, Math.floor((Date.now() - new Date(birthDate + 'T00:00:00')) / 604800000))

function buildWeeklyStats(feedings) {
  const byWeek = new Map()
  for (const f of feedings) {
    if (!byWeek.has(f.age_weeks)) {
      byWeek.set(f.age_weeks, { week: f.age_weeks, count: 0, total: 0, byType: {} })
    }
    const w = byWeek.get(f.age_weeks)
    w.count += 1
    w.total += f.amount_ml
    if (!w.byType[f.milk_type]) w.byType[f.milk_type] = { count: 0, total: 0 }
    w.byType[f.milk_type].count += 1
    w.byType[f.milk_type].total += f.amount_ml
  }
  return [...byWeek.values()]
    .sort((a, b) => a.week - b.week)
    .map((w) => ({
      week: w.week,
      count: w.count,
      avgAmount: Math.round(w.total / w.count),
      avgBreast: w.byType.breast ? Math.round(w.byType.breast.total / w.byType.breast.count) : null,
      avgFormula: w.byType.formula
        ? Math.round(w.byType.formula.total / w.byType.formula.count)
        : null,
      countBreast: w.byType.breast?.count ?? 0,
      countFormula: w.byType.formula?.count ?? 0,
    }))
}

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

function AmountTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white border border-amber-200 rounded-lg shadow-sm px-3 py-2 text-sm">
      <div className="font-medium text-gray-900">Woche {label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === 'avgBreast' ? TYPE_LABEL.breast : TYPE_LABEL.formula}: {fmtMl(p.value)}
        </div>
      ))}
    </div>
  )
}

function CountTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  return (
    <div className="bg-white border border-amber-200 rounded-lg shadow-sm px-3 py-2 text-sm">
      <div className="font-medium text-gray-900">Woche {label}</div>
      <div className="text-gray-700">{point.count} Mahlzeiten</div>
      {point.countBreast > 0 && (
        <div style={{ color: TYPE_COLOR.breast }}>
          {TYPE_LABEL.breast}: {point.countBreast}
        </div>
      )}
      {point.countFormula > 0 && (
        <div style={{ color: TYPE_COLOR.formula }}>
          {TYPE_LABEL.formula}: {point.countFormula}
        </div>
      )}
    </div>
  )
}

export default function FeedingChart({ child }) {
  const [feedings, setFeedings] = useState(null)
  const [error, setError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [fedAt, setFedAt] = useState(nowLocal())
  const [amount, setAmount] = useState('')
  const [milkType, setMilkType] = useState('breast')
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setFeedings(await api.getFeedings(child.id))
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
    const num = Number(amount.replace(',', '.'))
    if (!num || num <= 0) {
      setFormError('Bitte eine gültige Menge eingeben')
      return
    }
    setSaving(true)
    try {
      await api.addFeeding(child.id, {
        fed_at: fedAt,
        amount_ml: Math.round(num),
        milk_type: milkType,
      })
      setAmount('')
      setFedAt(nowLocal())
      await refresh()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entryId) {
    try {
      await api.deleteFeeding(entryId)
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
  if (!feedings) return <div className="text-center py-16 text-gray-400">Lädt…</div>

  const weekly = buildWeeklyStats(feedings)
  const week = currentWeek(child.birth_date)
  const current = weekly.find((w) => w.week === week)
  const currentSub = current
    ? [
        current.avgBreast != null && `${TYPE_LABEL.breast}: ${fmtMl(current.avgBreast)}`,
        current.avgFormula != null && `${TYPE_LABEL.formula}: ${fmtMl(current.avgFormula)}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Noch kein Eintrag'

  return (
    <div className="space-y-4">
      {/* Entry form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zeitpunkt</label>
            <input
              type="datetime-local"
              value={fedAt}
              onChange={(e) => setFedAt(e.target.value)}
              required
              max={nowLocal()}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Menge</label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="z. B. 120"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-sm text-gray-500">ml</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Art</label>
            <select
              value={milkType}
              onChange={(e) => setMilkType(e.target.value)}
              className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="breast">{TYPE_LABEL.breast}</option>
              <option value="formula">{TYPE_LABEL.formula}</option>
            </select>
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
        {formError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {formError}
          </div>
        )}
      </form>

      {/* Current week highlight */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          Icon={Milk}
          label={`Mahlzeiten in Woche ${week}`}
          value={current ? current.count : '—'}
          sub={current ? `${TYPE_LABEL.breast}: ${current.countBreast} · ${TYPE_LABEL.formula}: ${current.countFormula}` : 'Noch kein Eintrag'}
        />
        <MetricCard
          Icon={Droplet}
          label="Ø Menge pro Mahlzeit"
          value={current ? fmtMl(current.avgAmount) : '—'}
          sub={currentSub}
        />
      </div>

      {/* Amount per meal over time */}
      {weekly.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-1">Menge pro Mahlzeit</h3>
          <p className="text-sm text-gray-500 mb-4">
            Durchschnittliche Menge pro Mahlzeit, nach Lebenswoche.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={weekly} margin={{ top: 5, right: 10, bottom: 15, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="week"
                type="number"
                domain={[0, 'dataMax']}
                tickCount={10}
                label={{ value: 'Alter (Wochen)', position: 'insideBottom', offset: -8, fontSize: 12 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} width={44} tickFormatter={(v) => `${v} ml`} />
              <Tooltip content={<AmountTooltip />} />
              <Line
                dataKey="avgBreast"
                name={TYPE_LABEL.breast}
                stroke={TYPE_COLOR.breast}
                strokeWidth={2}
                dot={{ r: 3, fill: TYPE_COLOR.breast }}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                dataKey="avgFormula"
                name={TYPE_LABEL.formula}
                stroke={TYPE_COLOR.formula}
                strokeWidth={2}
                dot={{ r: 3, fill: TYPE_COLOR.formula }}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2" style={{ borderColor: TYPE_COLOR.breast }} />
              {TYPE_LABEL.breast}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2" style={{ borderColor: TYPE_COLOR.formula }} />
              {TYPE_LABEL.formula}
            </span>
          </div>
        </div>
      )}

      {/* Meal count over time */}
      {weekly.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-1">Anzahl Mahlzeiten</h3>
          <p className="text-sm text-gray-500 mb-4">Mahlzeiten pro Lebenswoche, nach Art.</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly} margin={{ top: 5, right: 10, bottom: 15, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="week"
                type="number"
                domain={[0, 'dataMax']}
                tickCount={10}
                label={{ value: 'Alter (Wochen)', position: 'insideBottom', offset: -8, fontSize: 12 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} width={30} allowDecimals={false} />
              <Tooltip content={<CountTooltip />} />
              <Bar dataKey="countBreast" name={TYPE_LABEL.breast} stackId="meals" fill={TYPE_COLOR.breast} />
              <Bar
                dataKey="countFormula"
                name={TYPE_LABEL.formula}
                stackId="meals"
                fill={TYPE_COLOR.formula}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Entry list */}
      {feedings.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm divide-y divide-gray-50">
          {[...feedings].reverse().map((f) => (
            <div key={f.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="flex items-baseline gap-3">
                <span className="font-medium text-gray-900">{fmtMl(f.amount_ml)}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: `${TYPE_COLOR[f.milk_type]}1a`, color: TYPE_COLOR[f.milk_type] }}
                >
                  {TYPE_LABEL[f.milk_type]}
                </span>
                <span className="text-gray-500">{fmtDateTime(f.fed_at)}</span>
                <span className="text-gray-400">Woche {f.age_weeks}</span>
              </div>
              <button
                onClick={() => handleDelete(f.id)}
                title="Eintrag löschen"
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
