import { useState } from 'react'
import { Sparkles, Pencil } from 'lucide-react'
import { api } from '../api'

// Compact "age in weeks/months (+ developmental-leap status)" strip, shown
// on every tab. Also owns the one place the ET (due date) can be set —
// leap detection needs it and is otherwise hidden.
export default function AgeInfo({ child, age, onChildUpdated }) {
  const [editing, setEditing] = useState(false)
  const [dueDate, setDueDate] = useState(child.due_date || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.updateChild(child.id, { due_date: dueDate || null })
      setEditing(false)
      await onChildUpdated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm flex flex-wrap items-end gap-3"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Errechneter Termin (ET)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg text-sm transition-colors"
        >
          Speichern
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="py-2 px-4 text-sm text-gray-500 hover:text-gray-700"
        >
          Abbrechen
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
        <p className="w-full text-xs text-gray-400">
          Der ET wird genutzt, um mögliche Entwicklungssprünge (Wachstumsschübe) anzuzeigen —
          leer lassen, um das auszublenden.
        </p>
      </form>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-900">
          <span className="font-semibold">Woche {age.weeks}</span>
          <span className="text-gray-400"> · </span>
          <span>
            {age.months} {age.months === 1 ? 'Monat' : 'Monate'}
          </span>
        </span>
        {age.leap && (
          <span className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
            <Sparkles size={14} />
            Vermutlich Sprung {age.leap.number}: {age.leap.name}
          </span>
        )}
      </div>
      {child.due_date ? (
        <button
          onClick={() => {
            setDueDate(child.due_date)
            setEditing(true)
          }}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <Pencil size={12} />
          ET: {child.due_date}
        </button>
      ) : (
        <button
          onClick={() => {
            setDueDate('')
            setEditing(true)
          }}
          className="text-xs text-amber-600 hover:text-amber-700 font-medium"
        >
          ET hinzufügen für Sprung-Anzeige
        </button>
      )}
    </div>
  )
}
