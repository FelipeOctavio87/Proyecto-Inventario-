import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)

  const login = useCallback((email) => {
    setUser({ email })
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  const value = {
    user,
    isLoggedIn: !!user,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
