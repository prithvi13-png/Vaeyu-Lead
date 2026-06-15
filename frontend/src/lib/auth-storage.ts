// In-memory access token store (never persisted to localStorage). The refresh
// token lives in an httpOnly cookie set by the backend and is invisible to JS.

let accessToken: string | null = null
let unauthorizedHandler: (() => void) | null = null

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

export function notifyUnauthorized() {
  unauthorizedHandler?.()
}
