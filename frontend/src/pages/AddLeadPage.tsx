import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { isAxiosError } from "axios"
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
import { Textarea } from "@/components/ui/textarea"
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge"
import { api } from "@/lib/api"
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  type LeadDetail,
  type LeadListItem,
  type LeadSource,
  type LeadStatus,
} from "@/lib/types"

interface FormState {
  full_name: string
  email: string
  phone: string
  company_name: string
  message: string
  source: LeadSource
  status: LeadStatus
  lost_reason: string
}

const INITIAL_STATE: FormState = {
  full_name: "",
  email: "",
  phone: "",
  company_name: "",
  message: "",
  source: "phone",
  status: "new",
  lost_reason: "",
}

export function AddLeadPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [debouncedEmail, setDebouncedEmail] = useState("")
  const [debouncedPhone, setDebouncedPhone] = useState("")

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedEmail(form.email.trim())
      setDebouncedPhone(form.phone.trim())
    }, 400)
    return () => clearTimeout(timeout)
  }, [form.email, form.phone])

  const { data: duplicates } = useQuery({
    queryKey: ["leads", "check-duplicate", debouncedEmail, debouncedPhone],
    queryFn: async () => {
      const response = await api.get<LeadListItem[]>("/leads/check-duplicate/", {
        params: { email: debouncedEmail || undefined, phone: debouncedPhone || undefined },
      })
      return response.data
    },
    enabled: Boolean(debouncedEmail || debouncedPhone),
  })

  const createMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const response = await api.post<LeadDetail>("/leads/", payload)
      return response.data
    },
    onSuccess: (data) => {
      toast.success("Lead created")
      navigate(`/leads/${data.id}`)
    },
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 400) {
        const data = error.response.data
        const message =
          typeof data === "object" && data !== null
            ? Object.values(data).flat().join(" ")
            : "Please check the form for errors."
        toast.error(message || "Please check the form for errors.")
      } else {
        toast.error("Failed to create lead")
      }
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.full_name.trim()) {
      toast.error("Full name is required.")
      return
    }
    if (!form.email.trim() && !form.phone.trim()) {
      toast.error("Provide at least one of email or phone.")
      return
    }
    if (form.status === "lost" && !form.lost_reason.trim()) {
      toast.error("Lost reason is required when status is Lost.")
      return
    }
    createMutation.mutate(form)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Add lead</h1>

      <Card>
        <CardHeader>
          <CardTitle>Lead details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="full_name">Full name *</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
            <p className="text-xs text-muted-foreground">Provide at least one of email or phone.</p>

            {duplicates && duplicates.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Possible duplicate{duplicates.length > 1 ? "s" : ""} found
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {duplicates.map((lead) => (
                    <li key={lead.id} className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                      <span>{lead.full_name}</span>
                      <span className="text-amber-700 dark:text-amber-400">
                        {lead.email || lead.phone}
                      </span>
                      <LeadStatusBadge status={lead.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company_name">Company</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(event) => setForm({ ...form, company_name: event.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="source">Source</Label>
                <Select
                  value={form.source}
                  onValueChange={(value) => value && setForm({ ...form, source: value })}
                >
                  <SelectTrigger id="source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => value && setForm({ ...form, status: value })}
                >
                  <SelectTrigger id="status" className="w-full">
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
              </div>
            </div>

            {form.status === "lost" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lost_reason">Lost reason *</Label>
                <Textarea
                  id="lost_reason"
                  value={form.lost_reason}
                  onChange={(event) => setForm({ ...form, lost_reason: event.target.value })}
                  rows={2}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create lead"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/leads")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
