# Sonnenlicht

Ein Baby-Entwicklungs-Tracker: Schlafphasen nach Alter, aktuelles Alter in Wochen
und Gewichtsverlauf auf der WHO-Perzentilkurve. Multi-User mit Login, deploybar
auf Render.

> Alle Angaben dienen nur der Information und ersetzen keine ärztliche Beratung.

## Features

- **Überblick** — aktuelles Alter (Woche/Tag), letztes Gewicht mit Delta,
  aktuelle Perzentile, Schlafprofil für das aktuelle Alter
- **Schlafphasen** — Referenztabelle (Gesamtschlaf, Wachfenster, Anzahl und
  Länge der Nickerchen) von Geburt bis 2 Jahre, mit Wochen-Slider zum
  Vorausschauen
- **Gewicht** — Einträge erfassen (g/kg), interaktive Kurve mit
  WHO-Perzentilkorridor (P3–P97, P15–P85, P50) für Jungen/Mädchen,
  Perzentile pro Messung, Einträge löschbar
- Login/Registrierung (JWT), Daten pro Konto getrennt
- „Zugangsdaten vergessen": E-Mail mit Benutzername + Link zum
  Passwort-Zurücksetzen (30 Min gültig; ohne SMTP-Konfiguration wird die Mail
  lokal nur ins Server-Log geschrieben)

## Stack

FastAPI + SQLAlchemy (SQLite lokal, PostgreSQL auf Render) · React 18 + Vite +
Tailwind + Recharts · WHO Child Growth Standards (LMS-Tabellen, Gewicht-für-Alter,
0–5 Jahre) als gebündelte CSVs.

## Setup

```bash
python3 -m venv ~/envs/sonnenlicht_env
source ~/envs/sonnenlicht_env/bin/activate
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

## Entwicklung

Zwei Terminals:

```bash
# Terminal 1 — API-Server
source ~/envs/sonnenlicht_env/bin/activate
uvicorn sonnenlicht.web:app --reload --port 8000

# Terminal 2 — Vite-Dev-Server (proxied /api auf :8000)
cd frontend && npm run dev
```

→ http://localhost:5173

## Produktion (lokal)

```bash
cd frontend && npm run build && cd ..
source ~/envs/sonnenlicht_env/bin/activate
python main.py   # serviert Frontend + API auf :8000
```

## Tests & Lint

```bash
pytest
ruff check .
```

## Deployment auf Render

1. **PostgreSQL-Datenbank** anlegen — wie beim WochenbettPlaner z. B. bei
   [Neon](https://neon.tech) (kostenloses Kontingent), Connection-String
   kopieren. Alternativ funktioniert auch Renders eigenes PostgreSQL.
2. **Web Service** aus dem Repo anlegen:
   - Build command: `./build.sh`
   - Start command: `uvicorn sonnenlicht.web:app --host 0.0.0.0 --port $PORT`
3. Environment-Variablen setzen:
   - `DATABASE_URL` — die Postgres-URL von Neon (ein evtl. `postgres://`-Schema
     wird automatisch korrigiert)
   - `SECRET_KEY` — langer zufälliger String für die JWT-Signierung
   - `PYTHON_VERSION` — z. B. `3.11.9`
   - Für den „Zugangsdaten vergessen"-Versand (sonst landen Reset-Mails nur im
     Server-Log):
     - `SMTP_HOST`, `SMTP_PORT` (587 = STARTTLS, 465 = SSL), `SMTP_USER`,
       `SMTP_PASSWORD`, `SMTP_FROM` (Default: `SMTP_USER`)
     - `APP_BASE_URL` — öffentliche URL des Service (z. B.
       `https://sonnenlicht.onrender.com`), wird in die Reset-Links geschrieben

## Projektstruktur

```
sonnenlicht/
  database.py   — SQLAlchemy-Engine + Modelle (User, Child, WeightEntry)
  auth.py       — bcrypt-Hashing + JWT erstellen/prüfen (Session- & Reset-Tokens)
  mailer.py     — SMTP-Versand (Env-Konfiguration, lokal Log-Fallback)
  age.py        — Alterberechnung (pure)
  sleep.py      — Schlafphasen-Lookup aus CSV (pure)
  growth.py     — WHO-LMS-Mathematik: Perzentilen, z-Scores, Kurvenpunkte (pure)
  web.py        — FastAPI-App: Auth + API-Routen, serviert frontend/dist
main.py         — Uvicorn-Einstieg (PORT aus Env)
data/
  wfa_boys_lms.csv / wfa_girls_lms.csv — WHO Gewicht-für-Alter (L, M, S je Lebenstag)
  sleep_phases.csv                     — Schlaf-Referenztabelle (AAP/NHS-Bereiche)
tests/          — pytest gegen die puren Module (age, sleep, growth)
frontend/
  src/api.js               — Token-Handling + ein fetch-Wrapper pro Endpoint
  src/App.jsx              — Auth-Gate + Tab-Shell
  src/components/
    AuthForm.jsx           — Login/Registrierung/Zugangsdaten vergessen
    ResetPassword.jsx      — neues Passwort setzen (via Mail-Link ?reset=…)
    ProfileSetup.jsx       — Erststart: Name, Geburtsdatum, Geschlecht
    Overview.jsx           — Tab 1: Metrik-Karten + Schlafprofil
    SleepPhases.jsx        — Tab 2: Referenztabelle + Wochen-Slider
    WeightChart.jsx        — Tab 3: Eintragsformular + Perzentil-Chart
```

## Datenquellen

- **WHO Child Growth Standards** — weight-for-age, expanded LMS tables
  (birth to 5 years), https://www.who.int/tools/child-growth-standards
- **Schlafbereiche** — orientiert an AAP- und NHS-Empfehlungen; Werte sind
  Richtwerte, Neugeborenenschlaf ist naturgemäß unregelmäßig
