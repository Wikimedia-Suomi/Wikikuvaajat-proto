# Locations Explorer (Wikidata only)

This repository has two Django subprojects:
- `backend/`: REST API + Wikidata SPARQL integration
- `frontend/`: Vue UI served from Django template/static files (CDN Vue runtime, no npm)

Locations are loaded from Wikidata and shown in three UI modes:
- list view
- map view
- single item detail view

Supported default languages:
- English (`en`)
- Swedish (`sv`)
- Finnish (`fi`)

## Project structure

- `backend/` API Django project
- `frontend/` UI Django project
- `frontend/templates/index.html` Vue app shell
- `frontend/static/ui/app.js` Vue app logic (no build step)
- `frontend/static/ui/styles.css` responsive styling

## Run with single web server

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 manage.py migrate
python3 manage.py runserver 8000
```

Open:
- `http://localhost:8000/` for UI
- `http://localhost:8000/api/locations/?lang=en` for API

How this works:
- `backend/` remains the API subproject
- `frontend/` remains the UI subproject
- backend loads frontend `ui` app, templates, and static files, then serves both from one Django server

## Wikidata SPARQL list query

Location listing uses Wikidata SPARQL with this base constraint:

```sparql
SELECT * WHERE {
  ?item wdt:P5008 wd:Q138299296 .
}
```

The backend extends it with label/description and coordinates needed by the list/map views, and executes it against:
- `https://query.wikidata.org/sparql`

## API endpoints

- `GET /api/locations/?lang=en`
- `GET /api/locations/<location_id>/?lang=fi`
- `GET /api/drafts/`
- `POST /api/drafts/`
- `GET /api/drafts/<draft_id>/`
- `PATCH /api/drafts/<draft_id>/`
- `GET /api/wikidata/search/?q=helsinki&lang=fi`
- `GET /api/wikidata/entities/<entity_id>/?lang=fi`
- `GET /api/auth/status/`
- `POST /api/wikidata/add-existing/`
- `POST /api/wikidata/create/`
- `GET /api/commons/categories/?q=hel`
- `GET /api/geocode/search/?q=helsinki`

## Backend environment variables (optional)

- `SPARQL_ENDPOINT` (default: `https://query.wikidata.org/sparql`)
- `SPARQL_DEFAULT_LIMIT` (default: `500`)
- `SPARQL_TIMEOUT_SECONDS` (default: `15`)
- `API_BASE_URL` (default: `/api`)
- `CORS_ALLOWED_ORIGINS` (default: `http://localhost:8001`, only needed if you run frontend on another origin)
- `SOCIAL_AUTH_MEDIAWIKI_KEY` (required for Wikimedia OAuth login and Wikidata write actions)
- `SOCIAL_AUTH_MEDIAWIKI_SECRET` (required for Wikimedia OAuth login and Wikidata write actions)
- `SOCIAL_AUTH_MEDIAWIKI_URL` (default: `https://meta.wikimedia.org/w/index.php`)
- `SOCIAL_AUTH_MEDIAWIKI_CALLBACK` (recommended: your exact callback URL, e.g. `http://127.0.0.1:8000/auth/complete/mediawiki/`)
- `LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN` (optional local-dev fallback OAuth access token)
- `LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET` (optional local-dev fallback OAuth access secret)
- `WIKIDATA_COLLECTION_QID` (default: `Q138299296`)

## Wikimedia OAuth login (social-auth-app-django)

Backend uses the standard `social-auth-app-django` `mediawiki` OAuth1 backend.

- Install backend deps (including social auth): `pip install -r backend/requirements.txt`
- Login start URL: `/auth/login/mediawiki/`
- Logout URL: `/auth/logout/`
- Callback URL pattern: `/auth/complete/mediawiki/`

`/api/auth/status/` reports `enabled=false` when `SOCIAL_AUTH_MEDIAWIKI_KEY` and `SOCIAL_AUTH_MEDIAWIKI_SECRET` are not configured.

### Local development access token fallback

For local development (`DEBUG=1`) you can configure OAuth token fallback for Wikidata write endpoints:

- `LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN`
- `LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET`

Alias env names are also supported:

- `WIKIMEDIA_OAUTH1_ACCESS_TOKEN`
- `WIKIMEDIA_OAUTH1_ACCESS_SECRET` (or `WIKIMEDIA_OAUTH1_ACCESS_TOKEN_SECRET`)

This is intended for endpoint-specific OAuth credentials (for example a consumer created with settings like "This consumer is for use only by Zache").

## Optional: run frontend subproject standalone

```bash
cd frontend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 manage.py migrate
python3 manage.py runserver 8001
```

Open:
- `http://localhost:8001/` for UI
- UI reads backend API base URL from `API_BASE_URL` (default: `http://localhost:8000/api`)

## Tests

Backend:
```bash
cd backend
python3 manage.py test
```

Frontend:
```bash
cd frontend
source .venv/bin/activate
python3 manage.py test
```

Frontend tests should be run from the frontend virtual environment.
