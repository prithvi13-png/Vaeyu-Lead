# Vaeyu Lead Tracker

Phase 1 MVP of a Lead Tracking Platform for Vaeyu Innovations — captures
website enquiries automatically, supports manual lead entry, and tracks
ownership, status, notes, and activity history. See `CLAUDE.md` for the
full phase plan and conventions.

## Stack

- **Backend**: Django + Django REST Framework, PostgreSQL, JWT auth
  (`djangorestframework-simplejwt`), Celery + Redis for async tasks.
- **Frontend**: React (Vite) + TypeScript, React Router, TanStack Query,
  shadcn/ui + Tailwind CSS.

## Prerequisites

- Python 3.12+ (developed with 3.14)
- Node.js 20+
- PostgreSQL (running locally, or update `DATABASE_URL`)
- Redis (for Celery — needed from Phase 4 onward)

## Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # then edit values as needed
```

Create the database (only needed once):

```bash
psql -d postgres -c "CREATE ROLE vaeyu WITH LOGIN PASSWORD 'vaeyu_dev_password';"
psql -d postgres -c "CREATE DATABASE vaeyu_lead_tracker OWNER vaeyu;"
```

Run migrations and start the dev server:

```bash
python manage.py migrate
python manage.py runserver 8000
```

The API is available at `http://localhost:8000/api/`. Health check:
`GET /api/health/` → `{"status": "ok"}`.

## Background tasks (Celery)

New-lead notifications and the website enquiry retry/fallback run as Celery
tasks. Start Redis and a worker alongside the dev server:

```bash
redis-server &

cd backend
source venv/bin/activate
celery -A config worker -l info
```

For local development without Redis/a worker, set `CELERY_TASK_ALWAYS_EAGER=True`
in `.env` to run tasks synchronously in-process. Task results are recorded
in the database via `django_celery_results` (visible in `/admin/`).

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # then edit values as needed
npm run dev
```

The app runs at `http://localhost:5173/` and talks to the backend at
`VITE_API_URL` (defaults to `http://localhost:8000/api`).

## Running both

Run the backend and frontend dev servers in separate terminals (commands
above). CORS is pre-configured to allow `http://localhost:5173` to call
the API at `http://localhost:8000`.

## Project layout

```
vaeyu-lead-tracker/
  backend/    # Django project (config/, apps/, manage.py)
  frontend/   # Vite React app (src/)
  CLAUDE.md   # stack, conventions, phase plan
  README.md
```
