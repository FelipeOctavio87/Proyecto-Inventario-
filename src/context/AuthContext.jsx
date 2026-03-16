import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AuthContext = createContext(null)

const STORAGE_KEY = 'inventory_auth'

/** @type {'administrador' | 'colaborador'} */
export const ROLES = { ADMIN: 'administrador', COLLABORATOR: 'colaborador' }

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data?.email && (data.role === ROLES.ADMIN || data.role === ROLES.COLLABORATOR)) {
          setUser({ email: data.email, role: data.role })
        }
      }
    } catch (_) {
      // ignore invalid stored auth
    }
  }, [])

  const login = useCallback((email, role = ROLES.COLLABORATOR) => {
    const r = role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.COLLABORATOR
    const u = { email: String(email).trim(), role: r }
    setUser(u)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    } catch (_) {}
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (_) {}
  }, [])

  const isAdmin = !!user && user.role === ROLES.ADMIN

  const value = {
    user,
    isLoggedIn: !!user,
    isAdmin,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
