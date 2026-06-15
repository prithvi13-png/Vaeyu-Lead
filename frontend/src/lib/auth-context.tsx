import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { api, refreshAccessToken } from "./api"
import { setAccessToken, setUnauthorizedHandler } from "./auth-storage"
import type { UserProfile } from "./types"

interface AuthContextValue {
  user: UserProfile | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()

  const clearAuth = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(clearAuth)
    return () => setUnauthorizedHandler(null)
  }, [clearAuth])

  useEffect(() => {
    let active = true

    async function init() {
      const token = await refreshAccessToken()
      if (token) {
        try {
          const response = await api.get<UserProfile>("/auth/me/")
          if (active) setUser(response.data)
        } catch {
          if (active) clearAuth()
        }
      }
      if (active) setIsLoading(false)
    }

    init()
    return () => {
      active = false
    }
  }, [clearAuth])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<{ access: string; user: UserProfile }>(
      "/auth/token/",
      { email, password },
    )
    setAccessToken(response.data.access)
    setUser(response.data.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/")
    } catch {
      // ignore — clear local state regardless
    }
    clearAuth()
  }, [clearAuth])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
