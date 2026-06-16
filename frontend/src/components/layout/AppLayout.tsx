import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { Logo } from "@/components/Logo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate("/login", { replace: true })
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-md supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <Logo className="size-8 drop-shadow-[0_2px_8px_color-mix(in_oklch,var(--brand-from)_45%,transparent)]" />
              <span className="text-gradient-brand text-base font-semibold tracking-tight">
                Vaeyu Lead Tracker
              </span>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink
                to="/leads"
                className={({ isActive }) =>
                  cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
                    isActive
                      ? "bg-gradient-brand text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                Leads
              </NavLink>
              {user?.role === "admin" && (
                <NavLink
                  to="/users"
                  className={({ isActive }) =>
                    cn(
                      "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
                      isActive
                        ? "bg-gradient-brand text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  Users
                </NavLink>
              )}
            </nav>
          </div>
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 outline-none hover:bg-muted">
                <Avatar className="size-8 ring-2 ring-offset-2 ring-offset-background ring-brand-from/40">
                  <AvatarFallback className="bg-gradient-brand font-medium text-white">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="flex flex-col px-2 py-1.5">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {user.role.replace("_", " ")}
                  </span>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
