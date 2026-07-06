import { useState, useEffect } from 'react'
import { X, Copy, Check, Users } from 'lucide-react'
import { api } from '../api'

export default function LinkAccounts({ onClose, onChanged }) {
  const [info, setInfo] = useState(null)
  const [code, setCode] = useState(null)
  const [inputCode, setInputCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.getLink().then(setInfo).catch((e) => setError(e.message))
  }, [])

  async function handleCreateCode() {
    setError(null)
    setLoading(true)
    try {
      const data = await api.createLinkCode()
      setCode(data.code)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleLink(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await api.linkAccount(inputCode)
      setInfo({ linked: true, partner_username: data.partner_username })
      setInputCode('')
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUnlink() {
    setError(null)
    setLoading(true)
    try {
      await api.unlink()
      setInfo({ linked: false, partner_username: null })
      setCode(null)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-20 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-amber-100 p-6 shadow-lg w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-amber-500" />
            Konto verknüpfen
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {!info ? (
          <p className="text-sm text-gray-400">Lädt…</p>
        ) : info.linked ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Dein Konto ist mit <strong>{info.partner_username}</strong> verknüpft.
              Ihr seht beide dieselben Kind-Profile und könnt gemeinsam Daten
              eintragen.
            </p>
            <button
              onClick={handleUnlink}
              disabled={loading}
              className="w-full py-2 px-4 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 font-medium rounded-lg text-sm transition-colors"
            >
              Verknüpfung lösen
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-gray-600 leading-relaxed">
              Verknüpfe dein Konto mit dem eines anderen Elternteils — dann könnt
              ihr beide Daten für dasselbe Baby eintragen.
            </p>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Einladungscode erstellen und deinem Partner schicken:
              </p>
              {code ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={code}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs bg-gray-50 text-gray-600"
                    />
                    <button
                      onClick={handleCopy}
                      title="Kopieren"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50"
                    >
                      {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Der Code ist 48 Stunden gültig.</p>
                </div>
              ) : (
                <button
                  onClick={handleCreateCode}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  Einladungscode erstellen
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">oder</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <form onSubmit={handleLink} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Code von deinem Partner einfügen:
              </label>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Einladungscode"
              />
              <button
                type="submit"
                disabled={loading || !inputCode.trim()}
                className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg text-sm transition-colors"
              >
                Verknüpfen
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
