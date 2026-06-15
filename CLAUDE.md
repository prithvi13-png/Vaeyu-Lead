# Vaeyu Lead Tracker — CLAUDE.md

Context for working on this repo across sessions. Read this before making changes.

## What this is

Phase 1 MVP of a Lead Tracking Platform for Vaeyu Innovations, per
`Vaeyu_Lead_Tracker_PRD.pdf` (v1.0, 13 June 2026). Captures website enquiries
automatically and supports manual lead entry, with ownership, status lifecycle,
notes, and an activity log. Schema is intentionally CRM-ready for later phases
(contacts, companies, deals/pipeline, communications, reporting).

## Tech stack

- **Backend**: Django + Django REST Framework, PostgreSQL, JWT auth via
  `djangorestframework-simplejwt`, Celery + Redis for async tasks
  (notifications, retry-on-failure for the public enquiry endpoint).
- **Frontend**: React (Vite) + TypeScript, React Router, TanStack Query for
  server state, shadcn/ui + Tailwind for components.
- **Layout**: monorepo — `/backend` (Django/DRF) and `/frontend` (Vite React),
  separate SPA + API server, CORS configured between them.
- **Secrets**: `.env` files (not committed), `.env.example` provided for both
  apps. Never hardcode secrets/credentials.

## Repo layout

```
vaeyu-lead-tracker/
  backend/
    manage.py
    config/            # Django project package: settings, urls, wsgi/asgi, celery
    apps/
      users/           # custom User model (UUID pk, email login, role)
      leads/           # Lead, Note, ActivityLog models
    requirements.txt
    .env.example
  frontend/
    src/
    .env.example
  README.md
  CLAUDE.md
```

## Conventions

- Backend: Django apps live under `backend/apps/`. Settings read from env vars
  via `django-environ`. DRF for all APIs; JWT (access + refresh) via simplejwt.
- Database: PostgreSQL only (no SQLite, even for dev) — keep dev/prod parity.
- Soft deletes only: models use `is_archived` (Lead) rather than hard deletes.
  Every meaningful change to a Lead is recorded in the ActivityLog.
- Roles: two roles — `admin` (Manager/Admin) and `sales_rep`. Enforce via DRF
  permission classes, not just frontend checks.
- Primary keys: `Lead`, `Note`, `ActivityLog`, and `User` all use UUID primary
  keys (per PRD data model).
- `User` (`apps.users.User`) is a custom `AbstractUser` subclass: no
  `username`, `email` is `USERNAME_FIELD` (login identifier), plus `role`
  (`admin` / `sales_rep`). `AUTH_USER_MODEL = "users.User"`.
- Dev superuser: `admin@vaeyu.local` / `adminpass123` (local only).
- Frontend: TypeScript, functional components, TanStack Query for all API
  calls (no manual fetch+useState data layers). shadcn/ui components — add
  via the shadcn CLI rather than hand-rolling primitives, and stay consistent
  with its conventions (Tailwind, `cn()` helper, `components/ui/`).
- Auth storage: access token in memory (e.g. query client / context), refresh
  token in an httpOnly cookie — never localStorage.
- Keep code comment-free unless explaining a non-obvious "why".

## Phase plan

Work proceeds in phases. **Stop after each phase for review before
continuing to the next.**

- [x] **Phase 1 — Scaffolding**: Django project + Vite React app in monorepo
  layout. PostgreSQL, env vars, CORS, DRF + JWT configured. README with
  setup/run instructions.
- [x] **Phase 2 — Data model & migrations**: Lead, Note, ActivityLog, User
  (role field) models. CRM-ready schema, soft deletes via `is_archived`.
- [x] **Phase 3 — Backend API**: Auth endpoints, Leads/Notes/Users
  viewsets + serializers, filtering/search, role-based permissions,
  ActivityLog auto-writes, public token-secured enquiry capture endpoint
  with spam check + retry/fallback. Tests for key endpoints.
- [x] **Phase 4 — Notifications (Celery)**: Celery + Redis wiring, email on
  new lead to owner/managers, retry/fallback for failed enquiry saves.
- [x] **Phase 5 — Frontend**: Login, Leads list (filter/search/sort), Lead
  detail (edit, status, owner, notes, activity timeline), manual Add Lead
  form with duplicate warning, admin user management, role-aware views.
  TanStack Query with optimistic updates on status changes.

## API conventions (Phase 3)

- Auth: `POST /api/auth/token/` (email + password → access/refresh + user
  profile), `POST /api/auth/token/refresh/`, `GET /api/auth/me/`. Login uses
  `EmailTokenObtainPairSerializer` (email as username field).
- Leads: `/api/leads/` (`LeadViewSet`, router-based).
  - List/retrieve/create/update available to any authenticated user.
  - List supports `?status=`, `?source=`, `?owner=<user id>`,
    `?is_archived=true`, `?search=` (name/email/phone), `?ordering=`.
    Archived leads are excluded from list results unless `is_archived` is
    passed.
  - Create uses `LeadCreateSerializer` (source restricted to manual-entry
    sources — `website_form` is reserved for the public enquiry endpoint).
    Requires `full_name` + at least one of `email`/`phone`.
  - Update uses `LeadUpdateSerializer`; setting `status=lost` requires
    `lost_reason`.
  - `POST /api/leads/<id>/assign/` (admin only) — body `{"owner_id": <uuid> | null}`.
  - `POST /api/leads/<id>/archive/` / `.../unarchive/` (admin only).
  - `GET|POST /api/leads/<id>/notes/` — list/add notes on a lead.
  - `GET /api/leads/check-duplicate/?email=&phone=` — up to 5 matches.
  - Every create/status-change/edit/assign/note-added writes an `ActivityLog`
    entry automatically (see `LeadViewSet.perform_create`/`perform_update`
    and the `notes`/`assign`/archive actions).
- Users: `/api/users/` (`UserViewSet`, admin-only CRUD) +
  `POST /api/users/<id>/set-password/`.
- Public enquiry capture: `POST /api/public/enquiries/` — no JWT, instead
  requires header `X-Enquiry-Token: <WEBSITE_ENQUIRY_API_TOKEN>`. Validates
  `full_name` + at least one of `email`/`phone`; captures UTM/`page_url` into
  `source_meta`; a filled `honeypot` field flags `is_spam=True` but the lead
  is still saved (per FR-1.4, spam is flagged not rejected). On success,
  triggers `notify_new_lead` (owner, or all admins if unassigned — currently
  sync email via `apps.leads.notifications`). On failure to save, returns
  `202` and sends `send_enquiry_fallback_alert` to
  `LEAD_FALLBACK_ALERT_EMAIL` so no lead is silently lost — Phase 4 will move
  this onto a Celery retry queue.
- Permissions: `IsAdmin` (apps/users/permissions.py) checks
  `role == "admin"` or `is_superuser`; used for user management and the
  lead assign/archive/unarchive actions. Everything else just requires
  `IsAuthenticated` (the DRF default).

## Background tasks (Phase 4)

- Celery app: `config/celery.py` (autodiscovers `apps/*/tasks.py`), loaded via
  `config/__init__.py`. Broker is Redis (`CELERY_BROKER_URL`); results are
  stored in the DB via `django_celery_results` (`CELERY_RESULT_BACKEND =
  "django-db"`, visible in `/admin/`).
- `CELERY_TASK_ALWAYS_EAGER` (env var, default `False`) runs tasks
  synchronously in-process — handy for local dev without Redis/a worker, and
  used by the public-enquiry tests.
- Tasks live in `apps/leads/tasks.py`:
  - `send_new_lead_notification_task(lead_id)` — sends the new-lead email
    (via `apps.leads.notifications.notify_new_lead`); retries up to 5 times
    on failure. Triggered from `PublicEnquiryView` for non-spam leads.
  - `create_lead_from_enquiry_task(lead_fields, activity_detail, payload)` —
    retries saving a website enquiry that failed to save synchronously
    (exponential backoff, max 5 retries). On final failure, calls
    `send_enquiry_fallback_alert_task` so the enquiry is never silently
    dropped (FR-1.5).
  - `send_enquiry_fallback_alert_task(payload, error)` — emails
    `LEAD_FALLBACK_ALERT_EMAIL` with the original payload + error.
- Run a worker: `celery -A config worker -l info` (from `backend/`, with
  Redis running).

## Frontend (Phase 5)

- Auth: `AuthProvider` (`src/lib/auth-context.tsx`) holds the current user
  and performs a silent `POST /api/auth/token/refresh/` + `GET /api/auth/me/`
  on mount to restore sessions. Access token lives only in a module-level
  variable (`src/lib/auth-storage.ts`); the refresh token is the httpOnly
  cookie set by the backend — neither is ever written to localStorage.
- `src/lib/api.ts` is the shared axios instance (`withCredentials: true`).
  A request interceptor attaches `Authorization: Bearer <access token>`; a
  response interceptor retries once after a silent refresh on `401`, then
  calls the registered "unauthorized" handler (clears auth state) if the
  refresh also fails.
- Routing (`src/App.tsx`): `/login` is public. Everything else is behind
  `ProtectedRoute` (redirects to `/login` if not authenticated) inside
  `AppLayout` (top nav + user menu). `/users` is additionally behind
  `AdminRoute` (redirects non-admins to `/leads`).
- Pages: `LoginPage`, `LeadsListPage` (search/status/source/owner filters,
  sortable columns, pagination), `LeadDetailPage` (editable fields, status
  select with optimistic update + required lost-reason capture, admin-only
  owner reassignment, notes tab, activity-log tab), `AddLeadPage` (manual
  entry with debounced duplicate check against `/leads/check-duplicate/`),
  `UsersAdminPage` (admin-only create user / change role / toggle active /
  set password).
- shadcn/ui components live in `src/components/ui/` and are built on
  `@base-ui/react` primitives (not Radix) — e.g. `Select`'s `onValueChange`
  is `(value: T | null, eventDetails) => void`, so handlers must accept a
  nullable value.
- Forms are plain controlled inputs (no react-hook-form/zod) — kept
  consistent with the minimal-dependency approach.

## Running the project

See `README.md` for full setup/run instructions (backend venv, Postgres,
Redis, frontend dev server). Dev login: `admin@vaeyu.local` / `adminpass123`.
