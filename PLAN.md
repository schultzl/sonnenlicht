# SONNENLICHT — Baby Development Tracker

Expanded plan, based on the original MVP draft, adapted to the WochenbettPlaner
architecture (FastAPI + React, JWT login, SQLite locally / PostgreSQL on Render).

## Goal

A modern-looking web app that:

1. Shows standard awake/sleep phases of a baby based on age (from week 0)
2. Shows the baby's current age in weeks based on birth date
3. Tracks the baby's weight and displays it on a line chart alongside the WHO
   growth-standard percentile corridor, so deviations from the norm are easy
   to spot
4. Supports multiple user accounts (login/registration), each with their own
   child profile(s) — deployable on Render

## Tech stack (revised from the draft)

The draft recommended Streamlit. That recommendation is **dropped**: Streamlit
has no real multi-user auth story and doesn't match the WochenbettPlaner
architecture. Instead:

| Layer      | Choice                                | Same as WochenbettPlaner? |
|------------|---------------------------------------|---------------------------|
| Backend    | FastAPI + uvicorn                     | yes |
| Auth       | JWT bearer tokens, bcrypt, python-jose| yes — `auth.py` reusable nearly verbatim |
| ORM / DB   | SQLAlchemy 2 · SQLite locally, PostgreSQL on Render (`DATABASE_URL`, incl. `postgres://` → `postgresql://` fix) | yes |
| Frontend   | React 18 + Vite + Tailwind CSS + lucide-react | yes |
| Charts     | **Recharts** (React-native, small, supports range-area bands) | new — WochenbettPlaner has no charts |
| Data prep  | Plain CSV, loaded with `csv`/`pandas` at startup, cached in memory | new |
| Deployment | Render web service: `build.sh` (pip install + npm build), FastAPI serves `frontend/dist` | yes |

Chart alternative: Plotly.js (react-plotly.js) if richer hover/zoom is wanted —
heavier bundle. Recharts `<Area>` with `[low, high]` range dataKeys handles the
percentile corridor cleanly; start there.

One deliberate deviation from WochenbettPlaner: instead of one JSON blob per
user (`db_storage.py` pattern), use **proper relational tables**. Weight
entries are append-only time-series rows — exactly what SQL is for — and this
gives free ordering, per-entry delete, and later export.

## Data model (SQLAlchemy)

```
users
  id, username (unique), email (unique), hashed_password

children                      -- 1 user : N children (schema-ready for later;
  id, user_id FK              --  MVP UI only surfaces one)
  name, birth_date (date), sex ('m'|'f')

weight_entries
  id, child_id FK
  measured_on (date), weight_grams (int)
  UNIQUE(child_id, measured_on)   -- one weight per day; upsert on conflict
```

Auth tables and token flow copied from WochenbettPlaner: register → 201 +
token, login → token, `get_current_user` dependency guarding all data routes.
Ownership check on every child/entry route (`child.user_id == current_user.id`).

## Reference data (bundled in `data/`, read-only)

1. **WHO weight-for-age, birth–5 years, LMS tables** — one CSV for boys, one
   for girls (`wfa_boys_lms.csv`, `wfa_girls_lms.csv`), downloadable from
   who.int (Child Growth Standards, weight-for-age, z-score/LMS expanded
   tables, by day or week).
   - Store the L, M, S columns, not pre-baked percentiles. Then:
     - percentile curve value: `M * (1 + L*S*z)^(1/L)` for z ∈ {-2, -1, 0, +1, +2}
       (≈ P2.3, P15.9, P50, P84.1, P97.7 — matches the German U-Heft corridor)
     - exact z-score of a measurement: `z = ((w/M)^L - 1) / (L*S)` → show the
       baby's current percentile as a number ("aktuell ~P42")
   - Use the by-day (or by-week) tables so no interpolation is needed for the
     first year; linearly interpolate between rows where necessary.
2. **Sleep/wake reference** (`sleep_phases.csv`) — static lookup by age bracket:

   | age (weeks) | total sleep | wake windows | naps  | nap length      |
   |-------------|-------------|--------------|-------|-----------------|
   | 0–3         | 15–18 h     | 30–60 min    | 4–6+  | 30 min – 4 h (highly variable) |
   | 4–11        | 14–17 h     | 60–90 min    | 4–5   | 30 min – 2 h    |
   | 12–25       | 12–16 h     | 1.5–2.5 h    | 3–4   | 45 min – 2 h (consolidating) |
   | 26–38       | 12–15 h     | 2–3 h        | 2–3   | 1 – 2 h         |
   | 39–52       | 12–15 h     | 2.5–4 h      | 2     | 1 – 1.5 h       |

   Columns: `week_from, week_to, total_sleep_min_h, total_sleep_max_h,
   wake_window_min, wake_window_max, naps, nap_length_min, nap_length_max,
   notes, source` (nap lengths in minutes). Cite AAP/NHS ranges in the
   `source` column; show the citation in the UI footer. Newborn nap length is
   genuinely erratic — surface that as a note in the UI rather than implying
   a tight norm.

## Repository structure

```
Sonnenlicht/
├── build.sh                    # pip install -r requirements.txt && cd frontend && npm install && npm run build
├── requirements.txt            # fastapi, uvicorn[standard], sqlalchemy, python-jose[cryptography],
│                               # bcrypt, psycopg2-binary, pytest, ruff
├── main.py                     # `serve` entry point (uvicorn sonnenlicht.web:app)
├── data/
│   ├── wfa_boys_lms.csv
│   ├── wfa_girls_lms.csv
│   └── sleep_phases.csv
├── sonnenlicht/
│   ├── database.py             # engine, SessionLocal, User/Child/WeightEntry models,
│   │                           #   DATABASE_URL env + postgres:// scheme fix (copy pattern)
│   ├── auth.py                 # hash/verify password, create/decode JWT (copy from WochenbettPlaner)
│   ├── growth.py               # LMS loading + percentile/z-score math — pure functions, no I/O paths hardcoded
│   ├── sleep.py                # sleep_phases.csv lookup: bracket_for_week(week) — pure
│   ├── age.py                  # age_in_weeks/days from birth_date — pure (trivial but test-worthy)
│   └── web.py                  # FastAPI app, auth + API routes, serves frontend/dist
├── tests/
│   ├── test_growth.py          # LMS math against known WHO values (e.g. P50 boys week 0 ≈ 3.35 kg)
│   ├── test_sleep.py           # bracket edges (week 3 vs 4, > table max)
│   └── test_age.py
└── frontend/
    ├── package.json            # react, react-dom, lucide-react, recharts; vite, tailwind
    └── src/
        ├── api.js              # token helpers + one function per endpoint (copy pattern,
        │                       #   TOKEN_KEY = 'sonnenlicht_token', auth:expired event)
        ├── App.jsx             # auth gate + tab shell + useChildState hook
        ├── index.css
        └── components/
            ├── AuthForm.jsx    # login/register (adapt from WochenbettPlaner)
            ├── ProfileSetup.jsx# first-run: name, birth date, sex
            ├── Overview.jsx    # tab 1
            ├── SleepPhases.jsx # tab 2
            └── WeightChart.jsx # tab 3
```

`growth.py`, `sleep.py`, `age.py` are I/O-free / pure (mirroring `manager.py`'s
testability principle): they take loaded tables + values, return numbers. Web
layer does the loading once at startup.

## API

```
POST /api/auth/register            {username, email, password} → {access_token}
POST /api/auth/login               {username, password}        → {access_token}

GET  /api/children                 → [child]           (MVP UI uses the first)
POST /api/children                 {name, birth_date, sex} → child
PATCH /api/children/{id}           fix typos in profile

GET  /api/children/{id}/overview   → {age_weeks, age_days, sleep_bracket,
                                      latest_weight, weight_delta_7d,
                                      current_percentile}
GET  /api/sleep-phases             → full static table (no auth secrets in it,
                                      but keep it behind auth for consistency)

GET  /api/children/{id}/weights    → [{id, measured_on, weight_grams, age_weeks, z, percentile}]
POST /api/children/{id}/weights    {measured_on, weight_grams} → entry (upsert per day)
DELETE /api/weights/{entry_id}     typo correction

GET  /api/children/{id}/growth-curve?to_week=N
     → [{week, p3, p15, p50, p85, p97}]   computed server-side from LMS for the
                                          child's sex; frontend just draws it
```

Server computes everything (age, percentiles, curve points); the frontend stays
a dumb renderer — same philosophy as WochenbettPlaner's `load → manager → save`.

## The three tabs

**Tab 1 — Overview**
- Metric cards: current age ("Woche 14, Tag 3"), last weight + delta since
  previous entry, current percentile.
- Sleep/wake summary for the current age bracket.
- Nice touch (post-MVP polish): small horizontal "typical day" timeline bar.

**Tab 2 — Sleep phases**
- Full bracket table, current bracket highlighted.
- Slider/stepper "show week X" to look ahead.

**Tab 3 — Weight**
- Entry form: date (default today) + weight in g (accept kg input, normalize
  to grams). List of entries below the chart with delete buttons.
- Recharts chart:
  - X: age in weeks (0 → max(current_week, last_entry_week) + 4)
  - Shaded band P3–P97 (light), inner band P15–P85 (slightly stronger),
    dashed P50 line
  - Baby's weights as connected line + dots on top; tooltip shows date,
    weight, percentile
- The signal to communicate: **tracking parallel to the curves matters, not
  sitting on P50.** Put that sentence in the UI near the chart.

**Disclaimer (build into the footer + first-run screen):** informational only;
any concern about weight development belongs at the pediatrician's — chart
deviations can look alarming while being normal, and vice versa.

## Deployment (Render, mirroring WochenbettPlaner)

- Web Service: build command `./build.sh`, start command
  `uvicorn sonnenlicht.web:app --host 0.0.0.0 --port $PORT`
- Render PostgreSQL instance → `DATABASE_URL` env var (the `postgres://`
  scheme fix in `database.py` handles Render's URL format)
- `SECRET_KEY` env var set in Render dashboard (never the default)
- `create_tables()` at import time, like WochenbettPlaner (fine at this scale;
  Alembic only if the schema starts churning)
- Local dev identical to WochenbettPlaner: uvicorn `--reload` on :8000 +
  `npm run dev` on :5173 with `/api` proxy in `vite.config.js`

## Build order

1. **Skeleton + auth** — repo layout, `database.py`/`auth.py` (port from
   WochenbettPlaner), register/login endpoints, React shell with AuthForm and
   empty tabs. *Deliverable: can register, log in, see three empty tabs.*
2. **Profile + age** — Child model, ProfileSetup first-run flow, Overview tab
   with age-in-weeks card.
3. **Sleep phases** — `sleep_phases.csv`, `sleep.py` + tests, Tab 2 and the
   sleep card on Tab 1.
4. **Weight CRUD** — WeightEntry model, add/list/delete endpoints + form/list
   UI (no chart yet).
5. **WHO curves** — download + commit LMS CSVs, `growth.py` + tests against
   published WHO reference values, `/growth-curve` endpoint, Recharts corridor
   chart with the baby's line.
6. **Polish** — percentile metric card, weight delta indicator ("+180 g in 7
   Tagen"), Tailwind theming (warm "Sonnenlicht" palette: soft yellow/amber
   accents), empty states, disclaimer, mobile layout check (this will be used
   on a phone at 3 a.m.).
7. **Deploy** — Render service + Postgres, `build.sh`, smoke test.

## Later (not MVP)

- Length + head circumference (same LMS approach, WHO publishes both)
- Feeding / nap logging
- Multiple children in the UI (schema already supports it)
- PDF/CSV export for the pediatrician
- Corrected age for prematurity (offset all age computations by
  `40 weeks − gestational age at birth`; store optional `due_date` on Child)
- UI language toggle DE/EN (start German-first — target users are German)
