# Wikikuvaajat Photo Mapper

Wikikuvaajat Photo Mapper is a web tool for documenting architecture and built environments for Wikimedia Commons.
Users can register new photo targets, which automatically create corresponding Wikidata items.
When uploading photos, users first select their location, then annotate images by clicking objects in the photo to
link them to Wikidata items. For exterior shots, users can pinpoint the corresponding location on an OpenStreetMap
layer, and the tool then suggests relevant tags based on nearby OSM data.

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

## Fetch code

SSH:
```bash
git clone git@github.com:Wikimedia-Suomi/Wikikuvaajat-proto.git
cd Wikikuvaajat-proto
```

HTTPS:
```bash
git clone https://github.com/Wikimedia-Suomi/Wikikuvaajat-proto.git
cd Wikikuvaajat-proto
```

## Start development environment (single web server)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DJANGO_SECRET_KEY=dev-secret-change-me
export DJANGO_DEBUG=1
export SOCIAL_AUTH_MEDIAWIKI_KEY="dsasdsa..." # (required for Wikimedia OAuth login and Wikidata write actions)
export SOCIAL_AUTH_MEDIAWIKI_SECRET="dsadsadsa..." # (required for Wikimedia OAuth login and Wikidata write actions)
export LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN="dsadsdsa..." # (OPTIONAL local-dev fallback OAuth access token)
export LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET="dsdsadsa..." # (OPTIONAL local-dev fallback OAuth access secret)
export SOCIAL_AUTH_MEDIAWIKI_URL # (default: `https://meta.wikimedia.org/w/index.php`)
python3 manage.py migrate
python3 manage.py runserver
```

Using LOCAL_DEV tokens require also DJANG_DEBUG=1 is set and browser is connecting from localhost.

Open:
- `http://localhost:8000/` for UI (Django default dev port)
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

The backend extends it with label/description and coordinates needed by the list/map views, and executes it against the configured SPARQL endpoint (Wikidata or QLever by default settings).

## API endpoints

- `GET /api/locations/?lang=en`
- `GET /api/locations/<location_id>/?lang=fi`
- `GET /api/wikidata/search/?q=helsinki&lang=fi`
- `GET /api/wikidata/entities/<entity_id>/?lang=fi`
- `GET /api/auth/status/`
- `POST /api/wikidata/add-existing/`
- `POST /api/wikidata/create/`
- `GET /api/commons/categories/?q=hel`
- `GET /api/geocode/search/?q=helsinki`

`DJANGO_SECRET_KEY` is required for both backend and frontend. If it is empty,
Django raises `The SECRET_KEY setting must not be empty.`.

## Backend environment variables (optional)

- `SPARQL_ENDPOINT_KEY` (default: `wikidata`, options: `wikidata`, `qlever-wikidata`)
- `SPARQL_ENDPOINT` (optional explicit override URL; if unset, selected by `SPARQL_ENDPOINT_KEY`)
- `SPARQL_DEFAULT_LIMIT` (default: `500`)
- `SPARQL_TIMEOUT_SECONDS` (default: `15`)
- `API_BASE_URL` (default: `/api`)
- `CORS_ALLOWED_ORIGINS` (optional; for same-origin local dev this can stay unset)
- `SOCIAL_AUTH_MEDIAWIKI_KEY` (required for Wikimedia OAuth login and Wikidata write actions)
- `SOCIAL_AUTH_MEDIAWIKI_SECRET` (required for Wikimedia OAuth login and Wikidata write actions)
- `SOCIAL_AUTH_MEDIAWIKI_URL` (default: `https://meta.wikimedia.org/w/index.php`)
- `SOCIAL_AUTH_MEDIAWIKI_CALLBACK` (optional explicit override; by default callback uses the same host and path `/auth/complete/mediawiki/`)
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

This is intended for endpoint-specific OAuth credentials (for example a consumer created with settings like "This consumer is for use only by Zache").

## Tests

Backend:
```bash
cd backend
source .venv/bin/activate
DJANGO_SECRET_KEY=test-secret-for-tests python3 manage.py test
```

Frontend:
```bash
cd frontend
source .venv/bin/activate
DJANGO_SECRET_KEY=test-secret-for-tests python3 manage.py test
```

Both backend and frontend tests require `DJANGO_SECRET_KEY` to be set. If it is
missing or empty, Django raises `The SECRET_KEY setting must not be empty.`.

## License

This project is licensed under the MIT License. See `LICENSE`.
