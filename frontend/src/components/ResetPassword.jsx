import { useState } from 'react'
import { Sun } from 'lucide-react'
import { api, setToken } from '../api'

export default function ResetPassword({ token, onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const data = await api.resetPassword(token, password)
      setToken(data.access_token)
      onDone(data.access_token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mb-3">
            <Sun size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sonnenlicht</h1>
          <p className="text-sm text-gray-500 mt-1">Schlaf & Wachstum deines Babys im Blick</p>
        </div>

        <div className="bg-white rounded-xl border border-amber-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Neues Passwort setzen</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Neues Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Passwort wiederholen
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {loading ? 'Bitte warten…' : 'Passwort speichern'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          <a href="/" className="text-amber-600 hover:text-amber-700 font-medium">
            Zurück zur Anmeldung
          </a>
        </p>
      </div>
    </div>
  )
}
