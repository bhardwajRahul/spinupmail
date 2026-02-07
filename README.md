# Spinupmail

Spinupmail is a Cloudflare Email Routing + Workers app for generating disposable
email addresses, storing inbound messages, and reading them via API (session
cookies or API keys). It includes a Hono API backend and a React + shadcn UI
frontend.

## What You Get

- Create unlimited email addresses tied to a user account
- Receive emails via Cloudflare Email Routing and store them in D1
- Browse emails in the UI
- Generate API keys for automation (e.g., test suites)

## Prerequisites

- A Cloudflare account with a domain using Cloudflare nameservers
- Email Routing enabled for the domain
- `pnpm` installed

## Repo Layout

- `packages/backend` — Cloudflare Worker (Hono + Better Auth + D1 + KV)
- `packages/frontend` — React + shadcn UI (Vite)

## 1. Install Dependencies

From the repo root:

```bash
pnpm install
```

## 2. Configure Cloudflare Resources

### D1 Database

```bash
pnpm exec wrangler d1 create SUM_DB
```

### KV Namespace

```bash
pnpm exec wrangler kv namespace create SUM_KV
```

Copy the example config and update IDs:

```bash
cp packages/backend/wrangler.toml.example \
  packages/backend/wrangler.toml
```

Edit `packages/backend/wrangler.toml` with:

- `[[d1_databases]].database_id`
- `[[kv_namespaces]].id`
- `[vars].EMAIL_DOMAIN` (your domain)
- Optional: `[vars].EMAIL_MAX_BYTES`, `[vars].EMAIL_FORWARD_TO`

## 3. Better Auth Secrets

Set the secrets for the Worker:

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put BETTER_AUTH_BASE_URL
```

Use the Worker URL or your API route URL:

- `BETTER_AUTH_BASE_URL = https://<your-domain>/api/auth`

## 4. Database Migrations

Do **not** hand-edit migrations.

```bash
pnpm -C packages/backend db:generate
pnpm exec wrangler d1 migrations apply SUM_DB --remote
```

## 5. Deploy the Backend Worker

```bash
pnpm -C packages/backend deploy
```

## 6. Configure Email Routing (Cloudflare Dashboard)

1. Enable **Email Routing** for your domain
2. Add at least one destination address (verification email required)
3. Create a **Routing rule**:
   - Address: `*@your-domain.com`
   - Action: **Send to Worker**
   - Worker: `spinupmail` (or your deployed Worker name)

## 7. Deploy the Frontend (Cloudflare Pages)

Create a **Pages** project (not a Worker). The UI can be confusing, explicitly choose "Pages".

Build settings:

- Root directory: `packages/frontend`
- Build command: `pnpm run build`
- Build output directory: `dist`

### Environment Variables (Pages)

If you route the Worker on the same domain at `/api/*`, you can set:

- `VITE_AUTH_BASE_URL = /api/auth`
- `VITE_API_BASE_URL = /api`

If you prefer a separate API domain:

- `VITE_AUTH_BASE_URL = https://api.your-domain.com/api/auth`
- `VITE_API_BASE_URL = https://api.your-domain.com`

## 8. Route API Requests to the Worker

If your frontend is on `https://your-domain.com`, add a Worker route:

- `your-domain.com/api/*` → `spinupmail` Worker
- (Optional) `www.your-domain.com/api/*` → `spinupmail` Worker

This keeps the frontend and API on the same domain.

## Using the App

1. Open the Pages URL
2. Sign up / sign in
3. Create a new email address
4. Send an email to that address
5. View emails in the UI

## API Usage (Automation)

Generate an API key from the UI. Then use it to access the API:

```bash
curl "https://your-domain.com/api/email-addresses" \
  -H "X-API-Key: <your_api_key>"
```

```bash
curl "https://your-domain.com/api/emails?address=john-123@your-domain.com" \
  -H "X-API-Key: <your_api_key>"
```

## Local Development

Backend:

```bash
pnpm -C packages/backend dev
```

Frontend:

```bash
pnpm -C packages/frontend dev
```

Set `.env` for frontend local dev if needed:

```
VITE_AUTH_BASE_URL=http://localhost:8787/api/auth
VITE_API_BASE_URL=http://localhost:8787
```

## Notes

- Email addresses **must** be created before email is sent. Unknown addresses
  are rejected.
- HTML is sanitized on the backend and rendered inside a sandboxed iframe.
