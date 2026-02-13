# Wikikuvaajat-proto

Prototype Django + Vue application for displaying locations fetched from a SPARQL query.

## Features

- Backend API in Django
- Frontend implemented with Vue.js
- Three views for locations:
  - List
  - Map
  - Single item details form
- Multilingual UI (English, Swedish, Finnish)
- Mobile-friendly layout
- Unit tests for SPARQL parsing and API views


## Default SPARQL query

The backend fetches locations using this query:

```sparql
SELECT * WHERE {
  wd:Q1292442 wdt:P527 ?item .
  ?item wdt:P31 ?p31 .
  ?item wdt:P625 ?p625 .
  ?item wdt:P131 ?p131
}
```

## Project structure

- `backend/` – Django project (`wikikuvaajat_backend`) and app (`locations`)
- `frontend/` – standalone frontend source (`index.html`) using Vue.js

## Run locally

```bash
pip install -r requirements.txt
python backend/manage.py migrate
python backend/manage.py runserver
```

Open `http://127.0.0.1:8000/`.

## Test

```bash
python backend/manage.py test
```
