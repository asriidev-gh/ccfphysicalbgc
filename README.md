# PHYSICAL BGC 2026

Sports event registration and competition platform for the **CCF BGC Sports Ministry 2nd Year Anniversary Celebration**
(Nov 25, 2026 · 6–9 PM · CCF BGC Main Hall, 4F, One Bonifacio, Taguig City).

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · PostgreSQL + Prisma 7 · Zod · React Hook Form · Vitest.

## What it does

| Area | Routes |
| --- | --- |
| Public site, registration, self-service | `/`, `/register`, `/registration/[reference]`, `/find` |
| Live leaderboards | `/leaderboard`, `/leaderboard/[sport]` |
| Projector / TV mode | `/display` (read-only, no controls) |
| Activity lead console | `/lead`, `/lead/[activityId]` |
| Admin | `/admin` (overview, events, sports, activities, participants, registrations, leads, monitor, results & approvals, leaderboard control, announcements, reports, audit logs, settings) |

Sports, activities, scoring rules and lead assignments are all **data**, created in the admin UI. Nothing about
Badminton, Kat, Andy, etc. is hard-coded in components; the six launch sports are only seed data.

## Prerequisites

- Node.js 22+ and npm
- Docker (for local PostgreSQL) **or** any PostgreSQL 14+ / a Supabase project

## Quick start (local)

```bash
npm install                    # also runs `prisma generate`
cp .env.example .env           # then edit APP_SECRET (openssl rand -base64 48)
docker compose up -d           # PostgreSQL on localhost:5433
npm run db:deploy              # apply migrations   (or `npm run db:migrate` in development)
npm run db:seed                # local-only demo data + accounts
npm run dev                    # http://localhost:3000
```

### Development accounts (local only)

`SEED_DEV_PASSWORD` in `.env` (default `local-dev-only-ChangeMe1`) is the password for all of these:

| Role | Email |
| --- | --- |
| Super admin | `superadmin@local.test` |
| Admin | `admin@local.test` |
| Activity leads | `lead.badminton@local.test`, `lead.basketball@local.test`, `lead.running@local.test`, `lead.pickleball@local.test`, `lead.hyrox@local.test`, `lead.crossfit@local.test` |

The dev seed **refuses to run** against a non-local database or `NODE_ENV=production`. Seeded activities start as
`DRAFT`: open **Admin → Event Activities** and click **Activate** (activation is blocked if scoring is invalid).

### Creating the real leads' accounts

No accounts exist for Kat, Jayson, Andy, Salvi, Pau, Nikki, Lester or Jovi. Suggested assignments (printed by the seed):

| Sport | Suggested lead(s) |
| --- | --- |
| Badminton | Kat and Jayson |
| Basketball | Andy |
| Running | Salvi and Pau |
| Pickleball | Nikki |
| HYROX | Lester |
| CrossFit | Jovi |

1. Sign in as an admin → **Activity Leads → Create account** (name, email, strong temporary password). Share it privately.
2. **Event Activities → (activity) → Activity leads → Assign.** Multiple leads per activity are supported.
3. Ask each lead to sign in at `/login`. Deactivating an account or resetting its password signs it out immediately.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev / production build / serve |
| `npm run typecheck` · `npm run lint` · `npm run format:check` | Static checks |
| `npm run test:db` | Create + migrate the **separate** test database (`TEST_DATABASE_URL`) |
| `npm test` | Vitest: unit + PostgreSQL-backed integration tests |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:reset` | Prisma migrations and seed |

Tests never touch the development database: `tests/setup.ts` forces `TEST_DATABASE_URL`.

## Architecture notes

- **PostgreSQL is the source of truth.** Constraints beyond Prisma's DSL live in migration SQL: a partial unique index
  allows only one `RUNNING` attempt per enrolment, one `current` result per attempt, plus `CHECK`s (time order,
  capacity > 0, elapsed ≥ 0, …).
- **Auth:** email + bcrypt password, opaque random session token in an `HttpOnly`, `SameSite=Lax`, `Secure` (prod) cookie.
  Only a SHA-256 of the token is stored (revocable, server-validated on every request). Login is rate limited per IP and per account.
  Participants do **not** need accounts: they prove ownership with their registration reference plus the email/mobile they used.
- **Authorisation** is enforced in the service layer (`src/lib/auth/policy.ts` + each service), on top of page and Server Action
  checks. Lead access is derived from the DB assignment of the *attempt's own activity*, never from client-supplied ids.
- **Scoring engine** (`src/lib/scoring`): typed config validated by Zod and a fixed registry of calculators
  (time, points, reps, distance, match, multi-station, weighted custom). There is **no eval / formula string / user code**.
  Time is integer milliseconds; raw input, calculated metrics and ranking value are stored separately.
  Rules are versioned (`ScoringConfigVersion`) and **locked once attempts exist**; corrections create a new result version
  scored with the *original* rules, with full history and an audit entry.
- **Timing:** start/finish instants and elapsed ms are taken on the server. The browser timer renders
  `clock + (serverNow − clockAtLoad) − startedAt` every animation frame, so it cannot drift in background tabs.
- **Idempotency & races:** submit uses a client idempotency key; start/finish/review use conditional updates and row locks;
  registration capacity uses `SELECT … FOR UPDATE` (tested with 10 concurrent registrations for 3 seats).
- **Real-time:** after a result is published the service calls `pg_notify`. Each server process keeps one `LISTEN` connection
  (auto-reconnect with backoff) and fans notifications to **Server-Sent Events** at `/api/stream`. Messages contain only ids;
  clients re-fetch authoritative state, and always re-fetch on (re)connect and when the tab becomes visible, so missed or
  duplicate messages are harmless.
- **Privacy:** public leaderboards expose name, rank, official score and status only. QR codes encode only
  `…/registration/<unguessable reference>`. Audit logs scrub credentials. CSV export neutralises spreadsheet formulas.

## Deployment

### Supabase (managed PostgreSQL)

1. Create a project. From **Connect**, copy two strings:
   - `DATABASE_URL`: *Transaction pooler* (port 6543) for the running app.
   - `DIRECT_URL`: *Direct connection* or *Session pooler* (port 5432). **Required**: Prisma migrations and the real-time
     `LISTEN` connection cannot use the transaction pooler.
2. Run migrations from your machine or CI: `DATABASE_URL=<direct url> npx prisma migrate deploy`.
   The migration `enable_rls` turns on Row Level Security with no policies, so Supabase's public API (anon key) cannot read any table;
   the app connects as the privileged database role through Prisma. Do not add policies or use the Supabase client for these tables.
3. Bootstrap (no demo accounts):
   `SEED_MODE=bootstrap BOOTSTRAP_ADMIN_EMAIL=you@example.com BOOTSTRAP_ADMIN_PASSWORD='<12+ chars>' npx prisma db seed`
4. Set `APP_SECRET`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `DIRECT_URL` on the host.

### Hosting the app: important real-time constraint

Real-time uses long-lived SSE connections plus a persistent `LISTEN` connection, so it needs a **long-running Node.js host**
(Fly.io, Railway, Render, a VPS/Docker, etc.: `npm run build && npm start`). On Vercel's serverless functions SSE streams are
cut at the function time limit; the client reconnects and re-syncs automatically, but this is not a good fit for the projector
screen. If you must use Vercel, replace `src/lib/realtime/bus.ts` + `/api/stream` with a managed transport (e.g. Supabase Realtime
Broadcast or Ably); everything else (services publish a small `BusMessage`) stays the same.

### Backups and recovery

- Supabase: enable daily backups / PITR on the project; take a manual backup right before event night.
- Self-hosted: `pg_dump -Fc "$DIRECT_URL" > pbgc-$(date +%F).dump` nightly (and hourly on event day); restore with `pg_restore`.
- Test a restore before the event. Registration data and results are the only irreplaceable data; everything else is re-seedable.

## Security-sensitive code map

| Concern | Where |
| --- | --- |
| Sessions, cookies, password verify | `src/lib/auth/session.ts` |
| Role and per-activity authorisation | `src/lib/auth/policy.ts`, service entry points |
| Public registration input (no privileged fields) | `src/lib/services/registration.ts` (`registrationInput`) |
| Rate limiting (Postgres) | `src/lib/services/ratelimit.ts`, used by public/login Server Actions |
| Result submission / approval invariants | `src/lib/services/challenge.ts` |
| Public data shaping | `src/lib/services/leaderboard.ts` (explicit DTO), `/api/*` |
| Audit trail | `src/lib/services/audit.ts` |

## Known limitations / remaining work

- **Teams:** `ParticipationType.TEAM` is stored, but there is no Team entity; match play is participant vs. participant.
- **Eligibility** is a single fitness/consent confirmation; per-activity eligibility rules (age, level) are not modelled.
- Public rate limiting keys on `x-forwarded-for`; behind a proxy, make sure only your proxy can set it.
- The browser UI was verified by type-check, lint, production build and HTTP smoke tests, plus service-level tests of the
  full workflow. **No browser-driven (Playwright) end-to-end tests are included** (deliberately skipped); a manual
  walkthrough on a phone and on the projector is recommended before the event.
- Real-time on serverless hosts: see above.
- Image/icon upload for sports is limited to a built-in icon set (select by name).
