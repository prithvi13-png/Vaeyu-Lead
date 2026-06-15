import { useState, type FormEvent } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { Logo } from "@/components/Logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { isAxiosError } from "axios"

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/leads"
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
      navigate("/leads", { replace: true })
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setError("Incorrect email or password.")
      } else {
        setError("Something went wrong. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="bg-gradient-brand relative hidden flex-col items-center justify-center overflow-hidden p-12 text-white lg:flex">
        <div className="absolute -top-24 -left-24 size-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-20 -bottom-32 size-96 rounded-full bg-black/10 blur-3xl" />
        <div className="relative z-10 flex max-w-md flex-col items-center gap-6 text-center">
          <Logo className="size-28 drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]" />
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Vaeyu Lead Tracker</h1>
            <p className="text-balance text-white/80">
              Capture, qualify, and convert every lead from one elegant workspace.
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-sm border-none shadow-xl shadow-black/5 ring-1 ring-foreground/5">
          <CardHeader className="items-center text-center">
            <Logo className="size-14 lg:hidden" />
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to manage your leads.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={isSubmitting} className="bg-gradient-brand text-white shadow-sm hover:opacity-90">
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
