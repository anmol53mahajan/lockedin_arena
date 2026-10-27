import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)
const TOKEN_STORAGE_KEY = 'lockedin_token'

function getStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getStoredToken()))

  const persistSession = useCallback((response) => {
    const nextToken = response?.data?.token
    const nextUser = response?.data?.user
    if (!nextToken || !nextUser) {
      throw new Error('The server returned an incomplete authentication response.')
    }

    window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
    setToken(nextToken)
    setUser(nextUser)
    return nextUser
  }, [])

  const clearSession = useCallback(() => {
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    } finally {
      setToken(null)
      setUser(null)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    if (!token) {
      return () => {
        active = false
      }
    }

    api.get('/auth/me')
      .then(({ data }) => {
        if (active) {
          setUser(data.user || data)
        }
      })
      .catch(() => {
        if (active) {
          clearSession()
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [token, clearSession])

  const login = useCallback(async (credentials) => {
    const response = await api.post('/auth/login', credentials)
    return persistSession(response)
  }, [persistSession])

  const register = useCallback(async (data) => {
    const response = await api.post('/auth/register', data)
    return persistSession(response)
  }, [persistSession])

  const logout = useCallback(() => {
    clearSession()
  }, [clearSession])

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me')
    const nextUser = data.user || data
    setUser(nextUser)
    return nextUser
  }, [])

  const verifyHandleInitiate = useCallback(async (cfHandle) => {
    const response = await api.post('/auth/cf/initiate', { cfHandle })
    if (response.data?.user) {
      setUser(response.data.user)
    } else {
      await refreshUser()
    }
    return response.data
  }, [refreshUser])

  const verifyHandleConfirm = useCallback(async () => {
    const { data } = await api.post('/auth/cf/confirm')
    if (data.user) {
      setUser((currentUser) => ({ ...currentUser, ...data.user }))
    } else {
      await refreshUser()
    }
    return data
  }, [refreshUser])

  const value = useMemo(() => ({
    user,
    token,
    loading,
    login,
    register,
    logout,
    verifyHandleInitiate,
    verifyHandleConfirm,
    refreshUser,
  }), [
    user,
    token,
    loading,
    login,
    register,
    logout,
    verifyHandleInitiate,
    verifyHandleConfirm,
    refreshUser,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// The auth hook shares this module with its provider so both use the same context.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
