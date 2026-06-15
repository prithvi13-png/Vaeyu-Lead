export type Role = "admin" | "sales_rep"

export interface UserBrief {
  id: string
  email: string
  name: string
  role: Role
}

export interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  name: string
  role: Role
  is_active: boolean
  date_joined: string
}

export type LeadSource =
  | "website_form"
  | "phone"
  | "referral"
  | "event"
  | "walk_in"
  | "other"

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "won"
  | "lost"

export interface Note {
  id: string
  lead: string
  author: UserBrief | null
  body: string
  created_at: string
}

export interface ActivityLogEntry {
  id: string
  actor: UserBrief | null
  action: "created" | "status_changed" | "assigned" | "edited" | "note_added"
  detail: Record<string, unknown>
  created_at: string
}

export interface LeadListItem {
  id: string
  full_name: string
  email: string
  phone: string
  company_name: string
  source: LeadSource
  status: LeadStatus
  owner: UserBrief | null
  is_spam: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface LeadDetail extends LeadListItem {
  message: string
  source_meta: Record<string, unknown>
  lost_reason: string
  notes: Note[]
  activity_log: ActivityLogEntry[]
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal / In Discussion" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
]

export const LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: "phone", label: "Phone" },
  { value: "referral", label: "Referral" },
  { value: "event", label: "Event" },
  { value: "walk_in", label: "Walk-in" },
  { value: "other", label: "Other" },
]

export const ALL_LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: "website_form", label: "Website Form" },
  ...LEAD_SOURCES,
]
