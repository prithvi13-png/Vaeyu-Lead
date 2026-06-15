import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function AdminRoute() {
  const { user } = useAuth()

  if (user?.role !== "admin") {
    return <Navigate to="/leads" replace />
  }

  return <Outlet />
}
