# Nize Logistics — Platform Revamp

A full product pass over the platform: audit, security and correctness fixes, a
new design system with a real dark mode, rebuilt dashboards, and role-based demo
accounts with admin-managed credentials.

---

## 1. Deploying this change

Run these once against your database, in order:

```bash
cd apps/backend
npm install
npm run migrate      # idempotent schema upgrade — safe to re-run
npm run seed:demo    # creates the demo accounts (skips ones that exist)
```

Then the apps as usual:

```bash
npm run dev:backend   # from the repo root
npm run dev:frontend
```

`npm run migrate` is non-destructive: every statement is `IF NOT EXISTS`
guarded, no column is dropped and no row is deleted. It records what it has
applied in a `schema_migrations` table.

### Demo accounts

`npm run seed:demo` prints these and creates them if they are missing:

```text
SUPER ADMIN
  Email:    superadmin@nizelogistics.com
  Username: superadmin
  Password: NizeSuper#2026

ADMIN
  Email:    admin@nizelogistics.com
  Username: admin
  Password: NizeAdmin#2026

RIDER
  Email:    rider@nizelogistics.com
  Username: rider
  Password: NizeRider#2026
```

Passwords are bcrypt-hashed (cost 12) on insert — the plaintext above exists
only in the seed script's output and in this file, never in the database, the
API, or the frontend bundle. Change them from **Admin → Accounts** after the
first sign-in, or override them at seed time:

```bash
DEMO_ADMIN_PASSWORD='…' DEMO_RIDER_PASSWORD='…' npm run seed:demo
```

Re-running the seed never overwrites a password you have since changed. To
deliberately reset them back to the defaults, use `npm run seed:demo:reset`.

**There is no customer account, by design.** This platform has three roles —
`super_admin`, `admin`, `rider`. Customers book and track anonymously by ticket
id and have no login, so there is nothing to seed for them. See §6.

### Managing credentials without touching the database

**Admin → Accounts** lists every account that can sign in. From there an
administrator can:

- issue a new password for any rider (super admins can also reset other admins),
- enable or disable an account,
- change their own password,
- see which accounts have a reset pending and when each last signed in.

Passwords are never readable — not by an admin, not through the API. A reset
mints a new value, shows it **once** for you to hand over privately, and forces
the account to choose their own at the next sign-in.

Guard rails: nobody can disable their own account, a plain admin cannot act on
another admin, and the last active super admin can be neither disabled nor
demoted.

---

## 2. What changed

### Security

| Fix | Detail |
|---|---|
| Password hashes were being served to the browser | `/admin/riders` and `/super/admins` ran `SELECT *` and returned `password_hash` and the raw push subscription for every user. All responses now go through allow-list serializers (`src/lib/serialize.js`). |
| Live payment secrets were being served to the browser | `/super/settings` returned the settings row verbatim, including the Paystack secret key, SMTP password and VAPID private key. It now returns presence booleans (`hasPaystackSecretKey`) instead of values. |
| Anyone with an order id could cancel or edit that order | Cancel and edit ran under `optionalAuth` with no ownership check. They now require the sender's phone number, or an admin session. |
| No rate limiting anywhere | Login is capped at 10 attempts per 15 min per IP, order creation at 20/hour, public lookups at 100/5 min, plus a global API ceiling. |
| Login leaked which accounts exist | Failed logins now compare against a dummy hash so response timing does not reveal whether an address is registered, and failures are audit-logged. |
| Refund data was readable by any signed-in user | `/refunds/:id/refund-status` is admin-only, matching the refund action itself. |
| Uploads accepted any file of any size | Restricted to JPEG/PNG/WebP/HEIC at 8MB, enforced before buffering. |
| Any signed-in user could join any order's live feed | Socket subscriptions now verify the order exists, and a rider's position is only broadcast for a job they actually hold. |
| CORS allowed `*` with credentials | Production now allows only the configured `FRONTEND_URL` origins. |
| Internal errors leaked stack traces | 5xx responses are generic in production; details stay in the server log. |
| Bcrypt cost was 10 | Raised to 12 for all new and reset passwords. |

### Broken features that never worked

- **Card payments were never confirmed.** The Paystack webhook computed its HMAC
  over `JSON.stringify(req.body)` *after* `express.json()` had already parsed the
  payload, so the signature never matched and every webhook was rejected with
  401. The route is now mounted with `express.raw()` **before** the JSON parser
  and verifies against the exact bytes received, with a constant-time compare,
  duplicate-delivery handling and an underpayment guard.
- **Recipient issue reports always failed.** The insert wrote `reportType` and
  `status: 'pending'`, but the table has `type`, defaults status to `'open'`, and
  declared `reporter_role NOT NULL` — which a recipient (who has no account)
  can never supply. Column names fixed, `reporter_role` made nullable, and the
  source recorded in a new `reporter_label`.
- **A rider's job vanished the moment they accepted it.** The dashboard query
  matched only `('assigned', 'picked_up')`, skipping `accepted` and `in_transit`.
- **`in_transit` was dead.** It existed in the enum but nothing ever set it.
- **Saving fares wiped them.** `PUT /admin/pricing` wrote `value || null` into
  `NOT NULL` columns, so saving one field nulled the others and errored.
- **Saving platform settings always failed.** It wrote `maintenance_mode` and
  `maintenance_message`, neither of which existed in the schema.
- **Invites recorded no author.** The insert used `invitedBy`; the column is
  `created_by`, so the value was silently dropped.
- **The homepage tracker rejected every real ticket.** It validated `NZ-8402`
  while tickets are issued as `NIZ-XXXXXX`.
- **Uppercase emails could not sign in.** Login lowercased the input but compared
  against the stored value; matching is now case-insensitive on both sides.
- **Duplicate signup emails returned a 500** from the unique constraint instead
  of a clear 409.
- **Public tracking had no live updates.** The socket handshake required a token,
  which customers never have. Anonymous connections are now allowed and may
  follow a single order by ticket id.

### The order lifecycle

There is now one status model, shared by both apps
(`apps/backend/src/lib/orderStatus.js` ↔ `apps/frontend/src/lib/orderStatus.ts`):

```
pending → assigned → accepted → picked_up → in_transit → delivered
                 ↘ (cancelled from any live state) ↙
```

Every label, colour and timeline in the UI reads from that file, so a status
cannot read "In Transit" on one page and "Dispatched" on another. The server
enforces the transition table, which is what now stops a rider marking an order
delivered when they never collected it. Covered by tests.

### Backend additions

- Order list API with real search (ticket, name, phone, address), status /
  payment / rider / date filters, sorting, pagination and total counts.
- Analytics: 7-day order and revenue trend, completion rate, average delivery
  time, and a per-rider performance breakdown — all aggregated in SQL rather
  than by shipping rows to the client to be counted.
- Rider assignment, reassignment and unassignment, with the previous rider freed
  automatically.
- Rider decline, `in_transit`, proof-of-delivery upload and cash-collected
  handling for COD orders.
- Account management endpoints (list, reset password, enable/disable, change own
  password, update own profile).
- An append-only `audit_logs` table recording assignments, cancellations,
  credential changes, suspensions, refunds and settings edits, surfaced under
  **Admin → Settings → Activity log**.
- Request validation on every mutating endpoint via zod. A missing latitude used
  to reach a `NOT NULL` decimal column as `NaN` and return a 500; it is now a
  400 naming the field.
- Scheduled pickups auto-assign to the **nearest** free rider instead of
  whichever row the database returned first.

### Database

`apps/backend/migrations/001_platform_upgrade.sql`:

- credential lifecycle columns (`must_change_password`, `password_changed_at`,
  `last_login_at`),
- the `reports` table repaired to match the code, with resolution fields,
- `audit_logs` created,
- `maintenance_mode` / `maintenance_message` added to platform settings,
- **17 indexes** on the hot paths — `orders.status`, `orders.assigned_rider_id`,
  `(assigned_rider_id, status)`, `created_at`, `UPPER(ticket_id)`,
  `payment_reference`, `LOWER(email)`, a partial index for available riders, and
  more. None of these existed; every dashboard query was a sequential scan.
- check constraints preventing negative prices and distances,
- data repair for rows the old code left inconsistent (riders stuck `is_busy`
  with no live job; delivered orders with no `delivered_at`).

### Design system

The stylesheet is rebuilt around semantic tokens with a blue/white light theme
and a genuinely designed dark theme — deep neutral grounds, lifted surfaces and
re-tuned brand colours, not an inversion. Pink stays an accent. Theme follows
the OS by default and can be pinned light or dark; the choice is applied before
first paint, so there is no flash.

Two root causes of the old "clunky" dashboards, both fixed:

1. **Tailwind was never actually enabled.** `globals.css` had no `@tailwind`
   directives, so every utility class in the dashboards (`md:grid-cols-4`,
   `rounded-2xl`, `space-y-6`, `hover:shadow-2xl`, …) did nothing. The pages
   were written against a framework that was not loading.
2. **Component variants were being tree-shaken away.** Tailwind purges
   `@layer components` by scanning source text, and the variants are composed at
   runtime (`badge-${tone}`). Every rule it could not see literally was dropped —
   which is why status badges rendered with no colour at all. Now safelisted.

New reusable primitives in `src/components/ui/`: Button, Card, Field, Input,
Select, Textarea, Badge, StatusBadge, Modal, ConfirmDialog, Toast, Tabs,
Pagination, Skeleton, EmptyState, ErrorState, InlineAlert, Kpi, CopyButton.

Font Awesome was dropped. It was a render-blocking CDN stylesheet in `<head>`
for icons we could already draw with `lucide-react` (bundled anyway), and every
icon on the site disappeared whenever that CDN was slow or blocked.

### Dashboards

**Admin** is now a control centre with six sections: Overview (KPIs, 7-day trend
chart, performance, recent orders), Orders (working filters, search, sorting,
pagination, assignment, cancellation), Riders (fleet with live availability and
performance), Issues (recipient report queue), Accounts (credential management),
and Settings (fares plus the activity log). `alert()`, `confirm()` and `prompt()`
are gone, replaced by real modals and toasts. The fake "View All" button that did
nothing is gone.

**Rider** is mobile-first: earnings as a compact strip, then the live job with
exactly one obvious primary action per state, the address that matters right now
in large type, one-tap call/WhatsApp/Maps, proof-of-delivery photo capture, and
delivery history. The old screen collected the ETA and delivery notes through
`prompt()` dialogs and had no way to attach proof at all.

Its realtime effect was also rebuilt: it previously re-registered socket handlers
on every state change and captured a stale job id in the location timer, so
positions were reported against the wrong delivery.

---

## 3. Testing

```bash
cd apps/backend && npm test    # 21 tests, all passing
```

Covers the status transition table (including the skip-the-pickup case that used
to be possible), fare calculation, and the response serializers — asserting that
password hashes, payment secrets and customer phone numbers cannot appear in any
response.

Both apps typecheck and build clean (`npx tsc --noEmit`, `next build`).

The revamped screens were rendered and reviewed in Chromium at desktop and
390px mobile widths, in both themes.

---

## 4. Environment

No new required variables. `apps/backend/.env.example` and
`apps/frontend/.env.local.example` document the full set. Optional additions:

| Variable | Purpose |
|---|---|
| `DEMO_*_USERNAME` / `_EMAIL` / `_PASSWORD` | Override seeded demo credentials |
| `FRONTEND_URL` | Now also the CORS allow-list; accepts a comma-separated list |

`FRONTEND_URL` is enforced as the CORS origin in production — if the frontend is
served from more than one domain, list them all.

---

## 5. API changes to be aware of

- `POST /api/orders/:id/cancel` and `PUT /api/orders/:id` now require
  `senderPhone` in the body (or an admin session) and return 403 with
  `code: "OWNERSHIP_REQUIRED"` otherwise.
- `GET /api/super/settings` returns `hasXxx` booleans in place of credentials.
- `GET /api/admin/riders` and `/api/super/admins` no longer return password
  hashes or push subscriptions.
- `GET /api/admin/orders` takes `page`, `limit`, `sort`, `order`, `status`,
  `paymentStatus`, `riderId`, `search`, `from`, `to` and returns
  `{ orders, pagination: { page, limit, total } }`.
- Validation failures return `400 { error, details: [{ field, message }] }`.
- An account with a pending admin reset gets `428 PASSWORD_CHANGE_REQUIRED` on
  protected routes until it sets a new password.
- New: `POST /api/orders/quote`, `POST /api/auth/change-password`,
  `PATCH /api/auth/profile`, `POST /api/rider/decline/:id`,
  `POST /api/rider/in-transit/:id`, `GET /api/admin/accounts`,
  `POST /api/admin/accounts/:id/reset-password`,
  `PUT /api/admin/accounts/:id/status`, `GET /api/admin/audit`,
  `GET /api/admin/analytics/riders`, `POST /api/admin/order/:id/unassign`.

---

## 6. Limitations — what I could not do

**The database was unreachable from my environment.** The sandbox network policy
blocks both PostgreSQL (TCP 5432) and Neon's HTTPS SQL endpoint, so I could
not connect to the Neon instance at all. Consequences:

1. **I never inspected the live schema or data.** Everything is written against
   `src/lib/db/schema.js` and the existing queries. The migration is written
   defensively for that reason — idempotent, additive, and tolerant of a
   `report_type` column existing under either name.
2. **I could not create the demo accounts for you.** The seed script is written
   and ready; you must run `npm run seed:demo` once. The credentials in §1 are
   what it will create.
3. **The end-to-end workflows in §24 of your brief were not run against a real
   database.** I verified the layers I could reach: unit tests over the pure
   logic, a full typecheck and production build of both apps, every backend
   module imported cleanly, and the dashboards rendered in a real browser
   against a stub API matching the response shapes. What remains unverified is
   the actual SQL executing against Postgres — please run the migration and walk
   one order through book → assign → accept → pickup → in transit → delivered
   before going live.

**Other things I deliberately left alone:**

- **`apps/frontend-old/`** is untouched legacy (beyond the phone numbers). It
  looks superseded by the Next.js app; worth deleting once you confirm that.
- **Google Maps / Leaflet components** were not reworked. They are functional
  and touching them risked breaking the map integration you recently fixed.
- **Platform settings UI for super admins** (maintenance mode, retention) has a
  working API and migration, but no dedicated screen yet — the Settings tab
  covers fares and the audit log. It flags this rather than pretending
  otherwise.
- **Email templates** are still inline HTML strings. Functional, unpolished.
- **The `paystack` npm package** is a dependency but unused — the code calls the
  API directly via axios. Safe to remove.
- **Rotate the credentials you shared.** The database URL, Paystack keys,
  Cloudinary secret, Mailjet SMTP password, VAPID private key and JWT secret
  were all pasted in chat. They are in `apps/backend/.env`, which is gitignored
  and was not committed — but they should still be rotated, as you said you
  would. The JWT secret in particular is currently a placeholder-style string
  that names itself as needing replacement; changing it signs everyone out,
  which is fine and worth doing.
