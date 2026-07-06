import { useState, useEffect, useCallback } from 'react'
import { Sun, Moon, TrendingUp, LogOut, Users } from 'lucide-react'
import { api, getToken, clearToken } from './api'
import AuthForm from './components/AuthForm'
import ResetPassword from './components/ResetPassword'
import LinkAccounts from './components/LinkAccounts'
import ProfileSetup from './components/ProfileSetup'
import Overview from './components/Overview'
import SleepPhases from './components/SleepPhases'
import WeightChart from './components/WeightChart'

const TABS = [
  { id: 'overview', label: 'Überblick', Icon: Sun },
  { id: 'sleep', label: 'Schlaf', Icon: Moon },
  { id: 'weight', label: 'Gewicht', Icon: TrendingUp },
]

export default function App() {
  const [token, setTokenState] = useState(() => getToken())
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(window.location.search).get('reset')
  )
  const [activeTab, setActiveTab] = useState('overview')
  const [children, setChildren] = useState(null)
  const [showLink, setShowLink] = useState(false)
  const [error, setError] = useState(null)

  // Listen for token expiry dispatched by api.js on 401 responses
  useEffect(() => {
    const handler = () => {
      setTokenState(null)
      setChildren(null)
    }
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [])

  const refresh = useCallback(async () => {
    if (!getToken()) return
    try {
      setChildren(await api.getChildren())
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    if (token) refresh()
  }, [token, refresh])

  function handleLogout() {
    clearToken()
    setTokenState(null)
    setChildren(null)
  }

  if (resetToken) {
    return (
      <ResetPassword
        token={resetToken}
        onDone={(newToken) => {
          window.history.replaceState(null, '', window.location.pathname)
          setResetToken(null)
          setTokenState(newToken)
        }}
      />
    )
  }

  if (!token) {
    return <AuthForm onAuth={setTokenState} />
  }

  const child = children && children.length > 0 ? children[0] : null

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-amber-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <Sun size={16} className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Sonnenlicht</h1>
              {child && <span className="text-sm text-gray-400 mt-0.5">· {child.name}</span>}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowLink(true)}
                title="Konto verknüpfen"
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <Users size={15} />
                <span className="hidden sm:inline">Verknüpfen</span>
              </button>
              <button
                onClick={handleLogout}
                title="Abmelden"
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </div>
          </div>
          {/* Tabs */}
          {child && (
            <nav className="flex gap-1 -mb-px">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === id
                      ? 'border-amber-500 text-amber-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 w-full flex-1">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        {!children ? (
          <div className="text-center py-16 text-gray-400">Lädt…</div>
        ) : !child ? (
          <ProfileSetup onCreated={refresh} />
        ) : (
          <>
            {activeTab === 'overview' && <Overview child={child} />}
            {activeTab === 'sleep' && <SleepPhases child={child} />}
            {activeTab === 'weight' && <WeightChart child={child} />}
          </>
        )}
      </main>

      {showLink && (
        <LinkAccounts onClose={() => setShowLink(false)} onChanged={refresh} />
      )}

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-4 py-6 w-full">
        <p className="text-xs text-gray-400 leading-relaxed">
          Alle Angaben dienen nur der Information und ersetzen keine ärztliche Beratung.
          Bei Fragen zur Gewichts- oder Schlafentwicklung wende dich an deine Kinderarztpraxis —
          Abweichungen können auf der Kurve auffällig aussehen und trotzdem völlig normal sein
          (und umgekehrt).
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Referenzwerte: WHO Child Growth Standards (Gewicht) · AAP/NHS (Schlaf)
        </p>
      </footer>
    </div>
  )
}
