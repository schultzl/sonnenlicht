import { useState } from 'react'
import { Baby } from 'lucide-react'
import { api } from '../api'

const today = () => new Date().toISOString().slice(0, 10)

export default function ProfileSetup({ onCreated }) {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState('f')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.createChild({ name, birth_date: birthDate, sex })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <div className="flex flex-col items-center mb-6 text-center">
        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
          <Baby size={24} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Willkommen!</h2>
        <p className="text-sm text-gray-500 mt-1">
          Erzähl uns kurz von deinem Baby — das Geburtsdatum bestimmt die Altersberechnung,
          das Geschlecht die passende WHO-Wachstumskurve.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-amber-100 p-6 shadow-sm">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="z. B. Emma"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Geburtsdatum</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
              max={today()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Geschlecht</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'f', label: 'Mädchen' },
                { value: 'm', label: 'Junge' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSex(value)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    sex === value
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-amber-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg text-sm transition-colors"
          >
            {loading ? 'Bitte warten…' : 'Los geht’s'}
          </button>
        </form>
      </div>
    </div>
  )
}
