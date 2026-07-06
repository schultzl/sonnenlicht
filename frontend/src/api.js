const TOKEN_KEY = 'sonnenlicht_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

async function req(method, path, body) {
  const token = getToken()
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch('/api' + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    clearToken()
    window.dispatchEvent(new Event('auth:expired'))
    throw new Error('Sitzung abgelaufen, bitte erneut anmelden')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `${method} ${path} failed (${res.status})`)
  }
  return res.json()
}

async function authReq(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `${method} ${path} failed (${res.status})`)
  }
  return res.json()
}

export const api = {
  // Auth (no token needed)
  login: (username, password) => authReq('POST', '/auth/login', { username, password }),
  register: (username, email, password) =>
    authReq('POST', '/auth/register', { username, email, password }),
  forgotPassword: (email) => authReq('POST', '/auth/forgot-password', { email }),
  resetPassword: (token, new_password) =>
    authReq('POST', '/auth/reset-password', { token, new_password }),

  // Account linking
  getLink: () => req('GET', '/link'),
  createLinkCode: () => req('POST', '/link/code'),
  linkAccount: (code) => req('POST', '/link', { code }),
  unlink: () => req('DELETE', '/link'),

  // Children
  getChildren: () => req('GET', '/children'),
  createChild: (data) => req('POST', '/children', data),
  updateChild: (id, data) => req('PATCH', `/children/${id}`, data),

  // Overview + sleep
  getOverview: (childId) => req('GET', `/children/${childId}/overview`),
  getSleepPhases: () => req('GET', '/sleep-phases'),

  // Weight
  getWeights: (childId) => req('GET', `/children/${childId}/weights`),
  addWeight: (childId, data) => req('POST', `/children/${childId}/weights`, data),
  deleteWeight: (entryId) => req('DELETE', `/weights/${entryId}`),
  getGrowthCurve: (childId) => req('GET', `/children/${childId}/growth-curve`),
}
