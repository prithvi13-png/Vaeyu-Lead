import axios, { type AxiosRequestConfig } from "axios"
import {
  getAccessToken,
  notifyUnauthorized,
  setAccessToken,
} from "./auth-storage"

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api"

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ access: string }>(
        `${API_BASE_URL}/auth/token/refresh/`,
        {},
        { withCredentials: true },
      )
      .then((response) => {
        const token = response.data.access
        setAccessToken(token)
        return token
      })
      .catch(() => {
        setAccessToken(null)
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

type RetryableConfig = AxiosRequestConfig & { _retry?: boolean }

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetryableConfig | undefined
    const status = error.response?.status

    if (status === 401 && config && !config._retry && !config.url?.includes("/auth/")) {
      config._retry = true
      const token = await refreshAccessToken()
      if (token) {
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` }
        return api(config)
      }
      notifyUnauthorized()
    }

    return Promise.reject(error)
  },
)
