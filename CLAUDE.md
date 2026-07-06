# CLAUDE.md

Sonnenlicht — baby development tracker (sleep phases by age, age in weeks,
weight on WHO percentile curves). FastAPI + SQLAlchemy backend, React 18 +
Vite + Tailwind + Recharts frontend, German-first UI. See README.md for
features/setup, PLAN.md for the original design (where they disagree,
README.md is current — e.g. the production DB is Neon, not Render Postgres).

## Commands

```bash
source ~/envs/sonnenlicht_env/bin/activate   # dev venv (not in the repo)
pytest                                        # backend tests
ruff check .                                  # lint
uvicorn sonnenlicht.web:app --reload --port 8000   # API
cd frontend && npm run dev                    # UI on :5173, /api proxied to :8000
cd frontend && npm run build                  # production build → frontend/dist
```

`frontend/dist` is committed (no Node needed at runtime); rebuild it when
frontend sources change. Web layer serves it via StaticFiles when present.

## Architecture notes

- `sonnenlicht/growth.py`, `sleep.py`, `age.py` are pure (no I/O) — that's
  deliberate, keep them that way; `web.py` loads CSVs once at import.
- `create_tables()` runs at import time; no Alembic. Schema changes must be
  additive (new tables are picked up automatically; new columns on existing
  tables are NOT — avoid them or handle migration explicitly).
- All JWTs are signed with `SECRET_KEY` (HS256, `auth.py`). Non-session
  tokens carry a `purpose` claim ("reset", "link"); `decode_token` rejects
  any token with a purpose, and each decoder checks its own purpose — keep
  this mutual exclusion when adding token types.
- Password-reset tokens embed the last 12 chars of the current bcrypt hash
  (`pwh` claim), making them single-use: they die when the password changes.
- Account linking: `account_links` pairs exactly two users symmetrically;
  linked users see/edit each other's children (`_allowed_user_ids` in
  `web.py` — every child/entry access check must go through it or
  replicate it). Children keep their original owner; unlinking only
  removes access, never data.
- Mail: `sonnenlicht/mailer.py`, plain smtplib. Without `SMTP_HOST` set it
  prints the mail to stdout (dev fallback) — reset mails then appear only
  in the server log.

## Deployment (Render + Neon)

- Render Web Service from GitHub `schultzl/sonnenlicht`, branch `main`,
  build `./build.sh`, start
  `uvicorn sonnenlicht.web:app --host 0.0.0.0 --port $PORT`.
- Database: Neon free tier (Postgres). `DATABASE_URL` env var; the
  `postgres://`→`postgresql://` fix and `pool_pre_ping` (needed because
  Neon suspends idle DBs) are in `database.py`.
- Required env vars: `DATABASE_URL`, `SECRET_KEY` (falls back to an
  insecure default — must be set), `PYTHON_VERSION`.
- Optional: `SMTP_HOST/PORT/USER/PASSWORD/FROM` (reset mails; Gmail app
  password works), `APP_BASE_URL` (public service URL, used to build reset
  links — deliberately not derived from the Host header).
- Auto-deploy gotcha: if pushes don't trigger deploys despite
  Auto-Deploy=On Commit and correct branch, check the Render GitHub App's
  repository-access list at github.com/settings/installations.

## Conventions

- UI text is German; backend error `detail` strings are English (frontend
  shows them as-is).
- Backend validation errors: 422 for bad values, 409 for conflicts,
  400 for bad tokens/codes; auth endpoints avoid account enumeration
  (forgot-password always returns `{"ok": true}`).
- Weight entries: grams, one per child+day (upsert on conflict).
- Icons/branding: amber-500 (#f59e0b) square with white lucide "sun";
  generated PNGs live in frontend/public (180 apple-touch, 192/512
  maskable for the manifest).
