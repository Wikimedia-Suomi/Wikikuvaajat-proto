from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
DEBUG = os.getenv('DJANGO_DEBUG', '0') == '1'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'ui',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en'
TIME_ZONE = 'Europe/Helsinki'
USE_I18N = True
USE_TZ = True

LANGUAGES = [
    ('en', 'English'),
    ('sv', 'Svenska'),
    ('fi', 'Suomi'),
]

LOCALE_PATHS = [BASE_DIR / 'locale']

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000/api')
SPARQL_ENDPOINT_OPTIONS = {
    'wikidata': 'https://query.wikidata.org/sparql',
    'qlever-wikidata': 'https://qlever.cs.uni-freiburg.de/api/wikidata',
}
SPARQL_ENDPOINT_KEY = os.getenv('SPARQL_ENDPOINT_KEY', 'wikidata')
SPARQL_ENDPOINT = os.getenv(
    'SPARQL_ENDPOINT',
    SPARQL_ENDPOINT_OPTIONS.get(SPARQL_ENDPOINT_KEY, SPARQL_ENDPOINT_OPTIONS['wikidata']),
)
SPARQL_PREDEFINED_ENDPOINTS = [
    {'id': 'wikidata', 'label': 'Wikidata', 'url': SPARQL_ENDPOINT_OPTIONS['wikidata']},
    {'id': 'qlever-wikidata', 'label': 'QLever Wikidata', 'url': SPARQL_ENDPOINT_OPTIONS['qlever-wikidata']},
]
SPARQL_OSM_ENDPOINT_OPTIONS = {
    'qlever-osm-planet': 'https://qlever.dev/api/osm-planet',
}
SPARQL_OSM_ENDPOINT_KEY = os.getenv('SPARQL_OSM_ENDPOINT_KEY', 'qlever-osm-planet')
SPARQL_OSM_ENDPOINT = os.getenv(
    'SPARQL_OSM_ENDPOINT',
    SPARQL_OSM_ENDPOINT_OPTIONS.get(
        SPARQL_OSM_ENDPOINT_KEY,
        SPARQL_OSM_ENDPOINT_OPTIONS['qlever-osm-planet'],
    ),
)
