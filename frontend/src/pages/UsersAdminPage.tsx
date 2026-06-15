import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { isAxiosError } from "axios"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { PaginatedResponse, Role, UserProfile } from "@/lib/types"

const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "sales_rep", label: "Sales Rep" },
]

interface CreateUserForm {
  email: string
  first_name: string
  last_name: string
  role: Role
  is_active: boolean
  password: string
}

const INITIAL_CREATE_FORM: CreateUserForm = {
  email: "",
  first_name: "",
  last_name: "",
  role: "sales_rep",
  is_active: true,
  password: "",
}

function errorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error) && error.response?.data) {
    const data = error.response.data
    if (typeof data === "object" && data !== null) {
      const message = Object.values(data).flat().join(" ")
      if (message) return message
    }
  }
  return fallback
}

export function UsersAdminPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateUserForm>(INITIAL_CREATE_FORM)
  const [passwordTarget, setPasswordTarget] = useState<UserProfile | null>(null)
  const [newPassword, setNewPassword] = useState("")

  const { data, isLoading, isError } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<UserProfile>>("/users/")
      return response.data.results
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: CreateUserForm) => {
      const response = await api.post<UserProfile>("/users/", payload)
      return response.data
    },
    onSuccess: () => {
      toast.success("User created")
      queryClient.invalidateQueries({ queryKey: ["users"] })
      setCreateOpen(false)
      setCreateForm(INITIAL_CREATE_FORM)
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to create user")),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<UserProfile> }) => {
      const response = await api.patch<UserProfile>(`/users/${id}/`, payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update user")),
  })

  const setPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await api.post(`/users/${id}/set-password/`, { password })
    },
    onSuccess: () => {
      toast.success("Password updated")
      setPasswordTarget(null)
      setNewPassword("")
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to set password")),
  })

  function handleCreateSubmit(event: FormEvent) {
    event.preventDefault()
    if (!createForm.email.trim() || createForm.password.length < 8) {
      toast.error("Email is required and password must be at least 8 characters.")
      return
    }
    createMutation.mutate(createForm)
  }

  function handleSetPassword(event: FormEvent) {
    event.preventDefault()
    if (!passwordTarget) return
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.")
      return
    }
    setPasswordMutation.mutate({ id: passwordTarget.id, password: newPassword })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button>Add user</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add user</DialogTitle>
            </DialogHeader>
            <form className="flex flex-col gap-3" onSubmit={handleCreateSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, email: event.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-first-name">First name</Label>
                  <Input
                    id="new-first-name"
                    value={createForm.first_name}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, first_name: event.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-last-name">Last name</Label>
                  <Input
                    id="new-last-name"
                    value={createForm.last_name}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, last_name: event.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-role">Role</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(value) =>
                    value && setCreateForm({ ...createForm, role: value as Role })
                  }
                >
                  <SelectTrigger id="new-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, password: event.target.value })
                  }
                  required
                  minLength={8}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="new-is-active"
                  checked={createForm.is_active}
                  onCheckedChange={(checked) =>
                    setCreateForm({ ...createForm, is_active: checked })
                  }
                />
                <Label htmlFor="new-is-active">Active</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create user"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Password</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-destructive">
                  Failed to load users.
                </TableCell>
              </TableRow>
            )}
            {data?.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Select
                    value={u.role}
                    onValueChange={(value) =>
                      value &&
                      value !== u.role &&
                      updateMutation.mutate({ id: u.id, payload: { role: value as Role } })
                    }
                  >
                    <SelectTrigger size="sm" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={u.is_active}
                    onCheckedChange={(checked) =>
                      updateMutation.mutate({ id: u.id, payload: { is_active: checked } })
                    }
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(u.date_joined)}
                </TableCell>
                <TableCell>
                  <Dialog
                    open={passwordTarget?.id === u.id}
                    onOpenChange={(open) => {
                      if (!open) {
                        setPasswordTarget(null)
                        setNewPassword("")
                      } else {
                        setPasswordTarget(u)
                      }
                    }}
                  >
                    <DialogTrigger
                      render={
                        <Button variant="outline" size="sm">
                          Set password
                        </Button>
                      }
                    />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Set password for {u.name}</DialogTitle>
                      </DialogHeader>
                      <form className="flex flex-col gap-3" onSubmit={handleSetPassword}>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="set-password-input">New password</Label>
                          <Input
                            id="set-password-input"
                            type="password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            minLength={8}
                            required
                          />
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={setPasswordMutation.isPending}>
                            {setPasswordMutation.isPending ? "Saving…" : "Save password"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
