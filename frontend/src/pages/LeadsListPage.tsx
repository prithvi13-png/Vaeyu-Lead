import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatDateTime } from "@/lib/format"
import { useUsersQuery } from "@/lib/users-api"
import {
  ALL_LEAD_SOURCES,
  LEAD_STATUSES,
  type LeadListItem,
  type LeadSource,
  type LeadStatus,
  type PaginatedResponse,
} from "@/lib/types"

const PAGE_SIZE = 25

type SortableField = "created_at" | "updated_at" | "full_name" | "status"

export function LeadsListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: users } = useUsersQuery()

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [status, setStatus] = useState<LeadStatus | "all">("all")
  const [source, setSource] = useState<LeadSource | "all">("all")
  const [owner, setOwner] = useState<string>("all")
  const [showArchived, setShowArchived] = useState(false)
  const [ordering, setOrdering] = useState<{ field: SortableField; direction: "asc" | "desc" }>({
    field: "created_at",
    direction: "desc",
  })
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 400)
    return () => clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, source, owner, showArchived])

  const { data, isLoading, isError } = useQuery({
    queryKey: ["leads", { debouncedSearch, status, source, owner, showArchived, ordering, page }],
    queryFn: async () => {
      const ordParam = ordering.direction === "desc" ? `-${ordering.field}` : ordering.field
      const response = await api.get<PaginatedResponse<LeadListItem>>("/leads/", {
        params: {
          search: debouncedSearch || undefined,
          status: status === "all" ? undefined : status,
          source: source === "all" ? undefined : source,
          owner: owner === "all" ? undefined : owner,
          is_archived: showArchived ? "true" : undefined,
          ordering: ordParam,
          page,
        },
      })
      return response.data
    },
  })

  function toggleSort(field: SortableField) {
    setPage(1)
    setOrdering((current) => {
      if (current.field !== field) return { field, direction: "asc" }
      return { field, direction: current.direction === "asc" ? "desc" : "asc" }
    })
  }

  function SortIcon({ field }: { field: SortableField }) {
    if (ordering.field !== field) return <ArrowUpDown className="size-3.5 text-muted-foreground" />
    return ordering.direction === "asc" ? (
      <ArrowUp className="size-3.5" />
    ) : (
      <ArrowDown className="size-3.5" />
    )
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <Button onClick={() => navigate("/leads/new")}>Add lead</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name, email, or phone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64"
        />
        <Select value={status} onValueChange={(value) => setStatus(value as LeadStatus | "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LEAD_STATUSES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(value) => setSource(value as LeadSource | "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {ALL_LEAD_SOURCES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {user?.role === "admin" && (
          <Select value={owner} onValueChange={(value) => setOwner(value ?? "all")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {users?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant={showArchived ? "secondary" : "outline"}
          onClick={() => setShowArchived((value) => !value)}
        >
          {showArchived ? "Showing archived" : "Show archived"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>
                <button
                  className="flex items-center gap-1 font-medium"
                  onClick={() => toggleSort("full_name")}
                >
                  Name <SortIcon field="full_name" />
                </button>
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 font-medium"
                  onClick={() => toggleSort("status")}
                >
                  Status <SortIcon field="status" />
                </button>
              </TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 font-medium"
                  onClick={() => toggleSort("created_at")}
                >
                  Created <SortIcon field="created_at" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-destructive">
                  Failed to load leads.
                </TableCell>
              </TableRow>
            )}
            {data && data.results.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No leads found.
                </TableCell>
              </TableRow>
            )}
            {data?.results.map((lead) => (
              <TableRow
                key={lead.id}
                className="cursor-pointer"
                onClick={() => navigate(`/leads/${lead.id}`)}
              >
                <TableCell className="font-medium">
                  {lead.full_name}
                  {lead.is_spam && (
                    <span className="ml-1.5 text-xs text-destructive">(spam)</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.email || lead.phone || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.company_name || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {ALL_LEAD_SOURCES.find((s) => s.value === lead.source)?.label ?? lead.source}
                </TableCell>
                <TableCell>
                  <LeadStatusBadge status={lead.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.owner?.name ?? "Unassigned"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(lead.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.count > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data.count} lead{data.count === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data.previous}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.next}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
