from pathlib import Path
import os
import sys

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR.parent / 'frontend'

if FRONTEND_DIR.exists() and str(FRONTEND_DIR) not in sys.path:
    sys.path.insert(0, str(FRONTEND_DIR))

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
    'corsheaders',
    'rest_framework',
    'social_django',
    'locations',
    'ui',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'social_django.middleware.SocialAuthExceptionMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [FRONTEND_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'social_django.context_processors.backends',
                'social_django.context_processors.login_redirect',
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
STATICFILES_DIRS = [FRONTEND_DIR / 'static']

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
}

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
    if origin.strip()
]

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
SPARQL_DEFAULT_LIMIT = int(os.getenv('SPARQL_DEFAULT_LIMIT', '500'))
SPARQL_TIMEOUT_SECONDS = int(os.getenv('SPARQL_TIMEOUT_SECONDS', '15'))
IMAGE_COUNT_CACHE_TTL_SECONDS = int(os.getenv('IMAGE_COUNT_CACHE_TTL_SECONDS', '86400'))
COMMONS_UPLOAD_MAX_SIZE_BYTES = int(os.getenv('COMMONS_UPLOAD_MAX_SIZE_BYTES', str(50 * 1024 * 1024)))
API_BASE_URL = os.getenv('API_BASE_URL', '/api')
SOCIAL_AUTH_MEDIAWIKI_KEY = os.getenv(
    'SOCIAL_AUTH_MEDIAWIKI_KEY',
    os.getenv('WIKIMEDIA_OAUTH1_CONSUMER_KEY', ''),
)
SOCIAL_AUTH_MEDIAWIKI_SECRET = os.getenv(
    'SOCIAL_AUTH_MEDIAWIKI_SECRET',
    os.getenv('WIKIMEDIA_OAUTH1_CONSUMER_SECRET', ''),
)
SOCIAL_AUTH_MEDIAWIKI_URL = os.getenv(
    'SOCIAL_AUTH_MEDIAWIKI_URL',
    'https://meta.wikimedia.org/w/index.php',
)

# Workaround for error T353593
SOCIAL_AUTH_PROTECTED_USER_FIELDS = ['groups']


SOCIAL_AUTH_MEDIAWIKI_KEY = os.getenv('SOCIAL_AUTH_MEDIAWIKI_KEY', '')
SOCIAL_AUTH_MEDIAWIKI_SECRET=os.getenv('SOCIAL_AUTH_MEDIAWIKI_SECRET', '')
SOCIAL_AUTH_MEDIAWIKI_URL = os.getenv('SOCIAL_AUTH_MEDIAWIKI_URL', 'https://meta.wikimedia.org/w/index.php')
_SOCIAL_AUTH_MEDIAWIKI_CALLBACK = os.getenv('SOCIAL_AUTH_MEDIAWIKI_CALLBACK', '').strip()
if _SOCIAL_AUTH_MEDIAWIKI_CALLBACK:
    SOCIAL_AUTH_MEDIAWIKI_CALLBACK = _SOCIAL_AUTH_MEDIAWIKI_CALLBACK
#SOCIAL_AUTH_MEDIAWIKI_URL = "https://meta.wikimedia.beta.wmcloud.org/w/index.php"


LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN = os.getenv(
    'LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN',
    '',
).strip()
LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET = os.getenv(
    'LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET',
    '',
).strip()

WIKIDATA_COLLECTION_QID = os.getenv('WIKIDATA_COLLECTION_QID', 'Q138299296')


AUTHENTICATION_BACKENDS = [
    'social_core.backends.mediawiki.MediaWiki',
    'django.contrib.auth.backends.ModelBackend',
]
SOCIAL_AUTH_LOGIN_REDIRECT_URL = '/'
SOCIAL_AUTH_LOGIN_ERROR_URL = '/'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/'
SOCIAL_AUTH_URL_NAMESPACE = 'social'
