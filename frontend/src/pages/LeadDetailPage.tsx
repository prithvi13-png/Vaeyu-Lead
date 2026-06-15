import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatDateTime } from "@/lib/format"
import { useUsersQuery } from "@/lib/users-api"
import {
  ALL_LEAD_SOURCES,
  LEAD_STATUSES,
  type ActivityLogEntry,
  type LeadDetail,
  type LeadStatus,
} from "@/lib/types"

const UNASSIGNED = "unassigned"

const STATUS_LABELS: Record<LeadStatus, string> = Object.fromEntries(
  LEAD_STATUSES.map((option) => [option.value, option.label]),
) as Record<LeadStatus, string>

function sourceLabel(value: string) {
  return ALL_LEAD_SOURCES.find((option) => option.value === value)?.label ?? value
}

function describeActivity(entry: ActivityLogEntry): string {
  const actor = entry.actor?.name ?? "System"
  const detail = entry.detail ?? {}

  switch (entry.action) {
    case "created":
      return `${actor} created this lead via ${sourceLabel(String(detail.source ?? ""))}`
    case "status_changed":
      return `${actor} changed status from ${STATUS_LABELS[detail.from as LeadStatus] ?? detail.from} to ${STATUS_LABELS[detail.to as LeadStatus] ?? detail.to}`
    case "assigned": {
      const from = detail.from as string | null
      const to = detail.to as string | null
      if (!from && to) return `${actor} assigned this lead to ${to}`
      if (from && !to) return `${actor} unassigned this lead (was ${from})`
      if (from && to) return `${actor} reassigned this lead from ${from} to ${to}`
      return `${actor} updated the owner`
    }
    case "note_added":
      return `${actor} added a note`
    case "edited": {
      const fields = Object.keys(detail)
      if (fields.includes("is_archived")) {
        const archived = (detail.is_archived as { to?: boolean })?.to
        return `${actor} ${archived ? "archived" : "restored"} this lead`
      }
      return `${actor} updated ${fields.join(", ")}`
    }
    default:
      return `${actor} updated this lead`
  }
}

interface EditableFields {
  full_name: string
  email: string
  phone: string
  company_name: string
  message: string
}

function toEditable(lead: LeadDetail): EditableFields {
  return {
    full_name: lead.full_name,
    email: lead.email,
    phone: lead.phone,
    company_name: lead.company_name,
    message: lead.message,
  }
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data: users } = useUsersQuery()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: lead, isLoading, isError } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => (await api.get<LeadDetail>(`/leads/${id}/`)).data,
    enabled: !!id,
  })

  const [form, setForm] = useState<EditableFields | null>(null)
  const [noteBody, setNoteBody] = useState("")
  const [lostReasonDraft, setLostReasonDraft] = useState<string | null>(null)

  useEffect(() => {
    if (lead) setForm(toEditable(lead))
  }, [lead?.id])

  const updateMutation = useMutation({
    mutationFn: async (payload: EditableFields) => {
      const response = await api.patch<LeadDetail>(`/leads/${id}/`, payload)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["lead", id], data)
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast.success("Lead updated")
    },
    onError: () => toast.error("Failed to save changes"),
  })

  const statusMutation = useMutation({
    mutationFn: async (payload: { status: LeadStatus; lost_reason?: string }) => {
      const response = await api.patch<LeadDetail>(`/leads/${id}/`, payload)
      return response.data
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["lead", id] })
      const previous = queryClient.getQueryData<LeadDetail>(["lead", id])
      queryClient.setQueryData<LeadDetail>(["lead", id], (old) =>
        old ? { ...old, ...payload } : old,
      )
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(["lead", id], context.previous)
      toast.error("Failed to update status")
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["lead", id], data)
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast.success("Status updated")
    },
  })

  const assignMutation = useMutation({
    mutationFn: async (ownerId: string | null) => {
      const response = await api.post<LeadDetail>(`/leads/${id}/assign/`, {
        owner_id: ownerId,
      })
      return response.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["lead", id], data)
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast.success("Owner updated")
    },
    onError: () => toast.error("Failed to update owner"),
  })

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const action = lead?.is_archived ? "unarchive" : "archive"
      const response = await api.post<LeadDetail>(`/leads/${id}/${action}/`)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["lead", id], data)
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast.success(data.is_archived ? "Lead archived" : "Lead restored")
    },
    onError: () => toast.error("Failed to update lead"),
  })

  const addNoteMutation = useMutation({
    mutationFn: async (body: string) => {
      await api.post(`/leads/${id}/notes/`, { body })
    },
    onSuccess: () => {
      setNoteBody("")
      queryClient.invalidateQueries({ queryKey: ["lead", id] })
    },
    onError: () => toast.error("Failed to add note"),
  })

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (isError || !lead || !form) {
    return <p className="text-sm text-destructive">Failed to load this lead.</p>
  }

  const isDirty =
    form.full_name !== lead.full_name ||
    form.email !== lead.email ||
    form.phone !== lead.phone ||
    form.company_name !== lead.company_name ||
    form.message !== lead.message

  function handleSaveDetails(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    if (!form.email.trim() && !form.phone.trim()) {
      toast.error("Provide at least one of email or phone.")
      return
    }
    updateMutation.mutate(form)
  }

  function handleStatusChange(status: LeadStatus | null) {
    if (!status) return
    if (status === "lost") {
      setLostReasonDraft(lead?.lost_reason || "")
      return
    }
    setLostReasonDraft(null)
    statusMutation.mutate({ status })
  }

  function confirmLostStatus() {
    if (!lostReasonDraft?.trim()) return
    statusMutation.mutate({ status: "lost", lost_reason: lostReasonDraft.trim() })
    setLostReasonDraft(null)
  }

  function handleOwnerChange(value: string | null) {
    assignMutation.mutate(!value || value === UNASSIGNED ? null : value)
  }

  function handleAddNote(event: FormEvent) {
    event.preventDefault()
    if (!noteBody.trim()) return
    addNoteMutation.mutate(noteBody.trim())
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
          <ArrowLeft className="size-4" /> Back to leads
        </Button>
        {user?.role === "admin" && (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="outline" size="sm">
                  {lead.is_archived ? "Restore lead" : "Archive lead"}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {lead.is_archived ? "Restore this lead?" : "Archive this lead?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {lead.is_archived
                    ? "It will reappear in the default leads list."
                    : "It will be hidden from the default leads list but can be restored later."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => archiveMutation.mutate()}>
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {lead.full_name}
                {lead.is_spam && <Badge variant="destructive">Spam</Badge>}
                {lead.is_archived && <Badge variant="secondary">Archived</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={handleSaveDetails}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input
                      id="full_name"
                      value={form.full_name}
                      onChange={(event) =>
                        setForm({ ...form, full_name: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="company_name">Company</Label>
                    <Input
                      id="company_name"
                      value={form.company_name}
                      onChange={(event) =>
                        setForm({ ...form, company_name: event.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={form.message}
                    onChange={(event) => setForm({ ...form, message: event.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Source: {sourceLabel(lead.source)}</span>
                  <span>·</span>
                  <span>Created {formatDateTime(lead.created_at)}</span>
                  <span>·</span>
                  <span>Updated {formatDateTime(lead.updated_at)}</span>
                </div>
                <div>
                  <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Tabs defaultValue="notes">
                <TabsList>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>
                <TabsContent value="notes" className="flex flex-col gap-4 pt-4">
                  <form className="flex flex-col gap-2" onSubmit={handleAddNote}>
                    <Textarea
                      placeholder="Add a note…"
                      value={noteBody}
                      onChange={(event) => setNoteBody(event.target.value)}
                      rows={2}
                    />
                    <div>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!noteBody.trim() || addNoteMutation.isPending}
                      >
                        {addNoteMutation.isPending ? "Adding…" : "Add note"}
                      </Button>
                    </div>
                  </form>
                  <div className="flex flex-col gap-3">
                    {lead.notes.length === 0 && (
                      <p className="text-sm text-muted-foreground">No notes yet.</p>
                    )}
                    {[...lead.notes]
                      .sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                      )
                      .map((note) => (
                        <div key={note.id} className="rounded-lg border p-3 text-sm">
                          <p className="whitespace-pre-wrap">{note.body}</p>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {note.author?.name ?? "Unknown"} · {formatDateTime(note.created_at)}
                          </p>
                        </div>
                      ))}
                  </div>
                </TabsContent>
                <TabsContent value="activity" className="pt-4">
                  <div className="flex flex-col gap-3">
                    {lead.activity_log.length === 0 && (
                      <p className="text-sm text-muted-foreground">No activity yet.</p>
                    )}
                    {[...lead.activity_log]
                      .sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                      )
                      .map((entry) => (
                        <div key={entry.id} className="text-sm">
                          <p>{describeActivity(entry)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(entry.created_at)}
                          </p>
                        </div>
                      ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Select value={lead.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <LeadStatusBadge status={lead.status} />
              {lead.status === "lost" && lead.lost_reason && lostReasonDraft === null && (
                <p className="text-xs text-muted-foreground">
                  Lost reason: {lead.lost_reason}
                </p>
              )}
              {lostReasonDraft !== null && (
                <div className="flex flex-col gap-2 rounded-lg border p-2">
                  <Label htmlFor="lost_reason" className="text-xs">
                    Reason for losing this lead
                  </Label>
                  <Textarea
                    id="lost_reason"
                    value={lostReasonDraft}
                    onChange={(event) => setLostReasonDraft(event.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={confirmLostStatus}
                      disabled={!lostReasonDraft.trim() || statusMutation.isPending}
                    >
                      Confirm
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setLostReasonDraft(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Owner</CardTitle>
            </CardHeader>
            <CardContent>
              {user?.role === "admin" ? (
                <Select
                  value={lead.owner?.id ?? UNASSIGNED}
                  onValueChange={handleOwnerChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {users?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{lead.owner?.name ?? "Unassigned"}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
