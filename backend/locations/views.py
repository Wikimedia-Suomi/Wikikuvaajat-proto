from __future__ import annotations

import re
from time import perf_counter
from urllib.parse import quote

from django.contrib.auth import get_user_model, login as auth_login
from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils import translation
from django.utils.http import url_has_allowed_host_and_scheme
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    AddExistingWikidataItemSerializer,
    CommonsImageUploadSerializer,
    CreateWikidataItemSerializer,
    LocationSerializer,
)
from .services import (
    ExternalServiceError,
    SPARQLServiceError,
    WikidataWriteError,
    create_wikidata_building_item,
    build_locations_sparql_query,
    decode_location_id,
    ensure_wikidata_collection_membership,
    enrich_locations_with_image_counts,
    fetch_latest_osm_feature_metadata,
    fetch_citoid_metadata,
    fetch_wikidata_entity,
    fetch_location_children,
    fetch_location_detail,
    fetch_locations,
    fetch_wikidata_authenticated_username,
    list_render_debug_scope,
    search_commons_categories,
    search_geocode_places,
    reverse_geocode_places,
    upload_image_to_commons,
    search_wikidata_entities,
)


_WIKIDATA_ENTITY_PATTERN = re.compile(
    r'^https?://www\.wikidata\.org/entity/(Q\d+)$',
    flags=re.IGNORECASE,
)
_WIKIDATA_QID_ONLY_PATTERN = re.compile(r'^Q\d+$', flags=re.IGNORECASE)
_WIKIDATA_QID_PATTERN = re.compile(r'(Q\d+)', flags=re.IGNORECASE)
_LOCAL_DRAFT_URI_PATTERN = re.compile(r'^https://draft\.local/location/\d+$', flags=re.IGNORECASE)
_LOCAL_AUTH_USERNAME_PATTERN = re.compile(r'[^A-Za-z0-9.@_+-]+')
_LOCAL_AUTH_USERNAME_PREFIX = 'local_'
_LOCAL_AUTH_USERNAME_FALLBACK_SUFFIX = 'access-token'
_CACHE_BUST_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$')
_LOCAL_DEV_ALLOWED_IPS = frozenset({'localhost', '127.0.0.1', '::1'})


def _list_render_debug_log(message: str) -> None:
    if not getattr(settings, 'DEBUG', False):
        return
    print(f'[LIST-DEBUG] {message}', flush=True)


def _oauth_login_url() -> str:
    return '/auth/login/mediawiki/?next=/'


def _local_dev_access_login_url() -> str:
    return '/auth/login/local/?next=/'


def _oauth_logout_url() -> str:
    return '/auth/logout/?next=/'


def _oauth_enabled() -> bool:
    oauth_key = str(getattr(settings, 'SOCIAL_AUTH_MEDIAWIKI_KEY', '') or '').strip()
    oauth_secret = str(getattr(settings, 'SOCIAL_AUTH_MEDIAWIKI_SECRET', '') or '').strip()
    return bool(oauth_key and oauth_secret)


def _local_dev_access_token_credentials() -> tuple[str, str]:
    token = str(getattr(settings, 'LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN', '') or '').strip()
    secret = str(getattr(settings, 'LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET', '') or '').strip()
    return token, secret


def _local_dev_access_token_configured() -> bool:
    token, secret = _local_dev_access_token_credentials()
    return bool(token and secret)


def _local_dev_access_request_allowed(request) -> bool:
    remote_addr = str(request.META.get('REMOTE_ADDR') or '').strip().lower()
    if remote_addr not in _LOCAL_DEV_ALLOWED_IPS:
        return False

    x_forwarded_for = str(request.META.get('HTTP_X_FORWARDED_FOR') or '').strip()
    if x_forwarded_for:
        client_ip = x_forwarded_for.split(',', 1)[0].strip().lower()
        if client_ip and client_ip not in _LOCAL_DEV_ALLOWED_IPS:
            return False

    x_real_ip = str(request.META.get('HTTP_X_REAL_IP') or '').strip().lower()
    if x_real_ip and x_real_ip not in _LOCAL_DEV_ALLOWED_IPS:
        return False

    return True


def _local_dev_access_token_enabled(request=None) -> bool:
    if not getattr(settings, 'DEBUG', False):
        return False
    if not _local_dev_access_token_configured():
        return False
    if request is not None and not _local_dev_access_request_allowed(request):
        return False
    return True


def _cache_bust_query_comment(request) -> str:
    raw_value = str(request.query_params.get('cache_bust') or '').strip()
    if not raw_value:
        return ''
    if not _CACHE_BUST_PATTERN.fullmatch(raw_value):
        return ''
    return f'# cache-bust: {raw_value}'


def _safe_next_redirect_url(request, fallback: str = '/') -> str:
    fallback_value = str(fallback or '/').strip() or '/'
    raw_next = str(request.query_params.get('next') or request.GET.get('next') or '').strip()
    if not raw_next:
        return fallback_value
    if url_has_allowed_host_and_scheme(
        raw_next,
        allowed_hosts={request.get_host()},
        require_https=request.is_secure(),
    ):
        return raw_next
    return fallback_value


def _api_error_detail(public_message: str, exc: Exception | None = None) -> str:
    fallback_message = str(public_message or '').strip() or 'Request failed.'
    if not getattr(settings, 'DEBUG', False) or exc is None:
        return fallback_message
    debug_message = str(exc).strip()
    if not debug_message:
        return fallback_message
    return debug_message


def _api_error_response(
    public_message: str,
    *,
    status_code: int,
    exc: Exception | None = None,
) -> Response:
    return Response(
        {'detail': _api_error_detail(public_message, exc)},
        status=status_code,
    )


def _normalize_local_auth_username(raw_username: str, max_length: int = 150) -> str:
    normalized = str(raw_username or '').strip()
    if normalized:
        normalized = re.sub(r'\s+', '_', normalized)
        normalized = _LOCAL_AUTH_USERNAME_PATTERN.sub('_', normalized).strip('._-')
    if not normalized:
        normalized = _LOCAL_AUTH_USERNAME_FALLBACK_SUFFIX
    local_username = f'{_LOCAL_AUTH_USERNAME_PREFIX}{normalized}'
    if max_length > 0:
        local_username = local_username[:max_length].strip('._-')
    if not local_username:
        fallback_local_username = _LOCAL_AUTH_USERNAME_PREFIX.strip('._-') or 'local'
        if max_length > 0:
            fallback_local_username = fallback_local_username[:max_length].strip('._-')
        local_username = fallback_local_username or 'local'
    return local_username


def _local_dev_login_user(request):
    access_token, access_token_secret = _local_dev_access_token_credentials()
    resolved_username = fetch_wikidata_authenticated_username(
        oauth_token=access_token,
        oauth_token_secret=access_token_secret,
    )
    if not resolved_username:
        raise WikidataWriteError('Could not resolve Wikimedia username from local access tokens.')

    user_model = get_user_model()
    username_field = str(getattr(user_model, 'USERNAME_FIELD', 'username') or 'username')
    try:
        username_field_max_length = int(getattr(user_model._meta.get_field(username_field), 'max_length', 150) or 150)
    except Exception:
        username_field_max_length = 150

    normalized_username = _normalize_local_auth_username(resolved_username, max_length=username_field_max_length)
    user, created = user_model.objects.get_or_create(**{username_field: normalized_username})
    if created and hasattr(user, 'set_unusable_password'):
        user.set_unusable_password()
        user.save(update_fields=['password'])

    auth_login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    request.session['local_dev_access_authenticated'] = True
    return user


def _mediawiki_oauth_credentials_for_request(request) -> tuple[dict[str, str] | None, str, int]:
    oauth_enabled = _oauth_enabled()
    local_access_token_enabled = _local_dev_access_token_enabled(request)
    if not oauth_enabled and not local_access_token_enabled:
        return None, 'Wikimedia OAuth is not configured on this server.', status.HTTP_503_SERVICE_UNAVAILABLE

    user = getattr(request, 'user', None)
    if oauth_enabled and user is not None and user.is_authenticated:
        from social_django.models import UserSocialAuth

        social_auth = UserSocialAuth.objects.filter(user=user, provider='mediawiki').first()
        if social_auth is None:
            if local_access_token_enabled:
                access_token, access_token_secret = _local_dev_access_token_credentials()
                return {
                    'oauth_token': access_token,
                    'oauth_token_secret': access_token_secret,
                }, '', status.HTTP_200_OK
            return (
                None,
                'No linked Wikimedia OAuth account found. Sign in with Wikimedia OAuth first.',
                status.HTTP_403_FORBIDDEN,
            )

        extra_data = social_auth.extra_data if isinstance(social_auth.extra_data, dict) else {}
        access_token = extra_data.get('access_token')
        if isinstance(access_token, dict):
            oauth_token = str(access_token.get('oauth_token') or '').strip()
            oauth_token_secret = str(access_token.get('oauth_token_secret') or '').strip()
        else:
            oauth_token = str(extra_data.get('oauth_token') or '').strip()
            oauth_token_secret = str(extra_data.get('oauth_token_secret') or '').strip()

        if oauth_token and oauth_token_secret:
            return {
                'oauth_token': oauth_token,
                'oauth_token_secret': oauth_token_secret,
            }, '', status.HTTP_200_OK

        if local_access_token_enabled:
            access_token, access_token_secret = _local_dev_access_token_credentials()
            return {
                'oauth_token': access_token,
                'oauth_token_secret': access_token_secret,
            }, '', status.HTTP_200_OK

        return (
            None,
            'Wikimedia OAuth credentials are missing from the linked account.',
            status.HTTP_403_FORBIDDEN,
        )

    if local_access_token_enabled and user is not None and user.is_authenticated:
        access_token, access_token_secret = _local_dev_access_token_credentials()
        return {
            'oauth_token': access_token,
            'oauth_token_secret': access_token_secret,
        }, '', status.HTTP_200_OK

    if user is None or not user.is_authenticated:
        return None, 'Authentication required. Sign in with Wikimedia OAuth first.', status.HTTP_401_UNAUTHORIZED

    return (
        None,
        'No linked Wikimedia OAuth account found. Sign in with Wikimedia OAuth first.',
        status.HTTP_403_FORBIDDEN,
    )


def _normalize_uri(uri: str) -> str:
    value = uri.strip()
    match = _WIKIDATA_ENTITY_PATTERN.match(value)
    if match:
        return f'https://www.wikidata.org/entity/{match.group(1).upper()}'
    return value


def _extract_wikidata_qid(value: str) -> str:
    match = _WIKIDATA_QID_PATTERN.search(value.strip())
    if not match:
        return ''
    return match.group(1).upper()


def _normalized_wikidata_entity_uri_from_location_id(location_id: str) -> str:
    decoded_value = decode_location_id(str(location_id or '').strip()).strip()
    if not decoded_value:
        return ''

    entity_match = _WIKIDATA_ENTITY_PATTERN.match(decoded_value)
    if entity_match:
        return f'https://www.wikidata.org/entity/{entity_match.group(1).upper()}'

    if _WIKIDATA_QID_ONLY_PATTERN.fullmatch(decoded_value):
        return f'https://www.wikidata.org/entity/{decoded_value.upper()}'

    return ''


def _wikidata_qid_from_location(location: dict) -> str:
    wikidata_item = str(location.get('wikidata_item') or '').strip()
    if wikidata_item:
        qid = _extract_wikidata_qid(wikidata_item)
        if qid:
            return qid

    uri = str(location.get('uri') or '').strip()
    wikidata_match = _WIKIDATA_ENTITY_PATTERN.match(uri)
    if wikidata_match:
        return wikidata_match.group(1).upper()

    return ''


def _wikidata_sparql_uri(value: str) -> str:
    normalized_qid = _extract_wikidata_qid(value)
    if not normalized_qid:
        return ''
    return f'http://www.wikidata.org/entity/{normalized_qid}'


def _attach_wikidata_image(location: dict, lang: str) -> dict:
    if not isinstance(location, dict):
        return location
    if location.get('image_thumb_url'):
        return location

    qid = _wikidata_qid_from_location(location)
    if not qid:
        return location

    try:
        entity = fetch_wikidata_entity(qid, lang=lang)
    except ExternalServiceError:
        return location

    if not entity:
        return location

    image_thumb_url = str(entity.get('image_thumb_url') or '').strip()
    image_url = str(entity.get('image_url') or '').strip()
    if not image_thumb_url and not image_url:
        return location

    result = dict(location)
    if image_url:
        result['image_url'] = image_url
    if image_thumb_url:
        result['image_thumb_url'] = image_thumb_url
    image_name = str(entity.get('image_name') or '').strip()
    if image_name:
        result['image_name'] = image_name
    return result


def _attach_external_image_counts(location: dict) -> dict:
    enriched = enrich_locations_with_image_counts([location])
    if not enriched:
        return location
    first_item = enriched[0]
    return first_item if isinstance(first_item, dict) else location


def _enrich_location_payload(location: dict, lang: str) -> dict:
    with_wikidata_image = _attach_wikidata_image(location, lang)
    return _attach_external_image_counts(with_wikidata_image)


def _children_payload(
    parent_uri: str,
    lang: str,
) -> list[dict]:
    normalized_parent_uri = _normalize_uri(parent_uri)
    if not normalized_parent_uri:
        return []

    raw_parent_uri = parent_uri.strip()
    child_source_uri = (
        raw_parent_uri
        if raw_parent_uri and _WIKIDATA_ENTITY_PATTERN.match(raw_parent_uri)
        else normalized_parent_uri
    )
    sparql_source_uri = _wikidata_sparql_uri(child_source_uri)
    if not sparql_source_uri:
        return []
    try:
        return fetch_location_children(uri=sparql_source_uri, lang=lang)
    except SPARQLServiceError:
        return []


class BaseLocationAPIView(APIView):
    def _get_lang(self, request) -> str:
        lang = request.query_params.get('lang') or translation.get_language()
        return lang or 'en'

    def _require_authenticated_user(self, request):
        user = getattr(request, 'user', None)
        if user is not None and user.is_authenticated:
            return None
        return Response(
            {'detail': 'Authentication required. Sign in with Wikimedia OAuth first.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    def _get_limit(self, request, default: int = 10, maximum: int = 20) -> int:
        raw_limit = request.query_params.get('limit')
        if raw_limit is None:
            return default

        try:
            parsed_limit = int(raw_limit)
        except (TypeError, ValueError):
            return default

        if parsed_limit < 1:
            return default
        return min(parsed_limit, maximum)


class LocalDevAccessTokenLoginAPIView(APIView):
    authentication_classes = ()
    permission_classes = ()

    def get(self, request):
        if not getattr(settings, 'DEBUG', False) or not _local_dev_access_token_configured():
            return Response(
                {'detail': 'Local development access token mode is not enabled.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not _local_dev_access_request_allowed(request):
            return Response(
                {'detail': 'Local development access token mode is only allowed from localhost.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            _local_dev_login_user(request)
        except WikidataWriteError as exc:
            print(f'[AUTH-DEBUG] Local access token login failed: {exc}', flush=True)
            return _api_error_response(
                'Local access token login failed.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )

        return HttpResponseRedirect(_safe_next_redirect_url(request))


class AuthStatusAPIView(APIView):
    def get(self, request):
        oauth_enabled = _oauth_enabled()
        local_access_token_enabled = _local_dev_access_token_enabled(request)
        enabled = oauth_enabled or local_access_token_enabled
        request_user = getattr(request, 'user', None)
        request_is_authenticated = bool(request_user and request_user.is_authenticated)
        use_access_token_mode = bool(local_access_token_enabled)
        payload: dict[str, object] = {
            'enabled': enabled,
            'authenticated': request_is_authenticated,
            'login_url': _local_dev_access_login_url() if use_access_token_mode else _oauth_login_url(),
            'logout_url': _oauth_logout_url(),
            'provider': 'mediawiki',
            'auth_mode': 'access_token' if use_access_token_mode else 'oauth',
            'username': '',
        }

        if not enabled:
            return Response(payload)

        if request_is_authenticated:
            payload['username'] = str(request.user.get_username() or '')

        return Response(payload)


class MediaWikiLoginAPIView(APIView):
    authentication_classes = ()
    permission_classes = ()

    def get(self, request):
        next_url = _safe_next_redirect_url(request)
        if _local_dev_access_token_enabled(request):
            return HttpResponseRedirect(f'/auth/login/local/?next={quote(next_url, safe="")}')
        if not _oauth_enabled():
            return Response(
                {'detail': 'Wikimedia OAuth is not configured on this server.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            from social_django.views import auth as social_auth_begin

            return social_auth_begin(request, 'mediawiki')
        except Exception as exc:
            print(f'[AUTH-DEBUG] Wikimedia OAuth login start failed: {exc}', flush=True)
            return _api_error_response(
                'Wikimedia OAuth login failed.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )


class OSMFeatureLatestAPIView(BaseLocationAPIView):
    def get(self, request, feature_type: str, feature_id: int):
        normalized_type = str(feature_type or '').strip().lower()
        if normalized_type not in {'node', 'way', 'relation'}:
            return Response(
                {'detail': 'feature_type must be one of: node, way, relation.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if feature_id < 1:
            return Response(
                {'detail': 'feature_id must be a positive integer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        raw_latitude = str(request.query_params.get('lat') or '').strip()
        raw_longitude = str(request.query_params.get('lon') or '').strip()
        raw_name = str(request.query_params.get('name') or '').strip()
        hint_latitude: float | None = None
        hint_longitude: float | None = None
        hint_name: str | None = None
        if raw_latitude:
            try:
                hint_latitude = float(raw_latitude)
            except ValueError:
                return Response(
                    {'detail': 'lat must be a valid number.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if hint_latitude < -90 or hint_latitude > 90:
                return Response(
                    {'detail': 'lat must be between -90 and 90.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if raw_longitude:
            try:
                hint_longitude = float(raw_longitude)
            except ValueError:
                return Response(
                    {'detail': 'lon must be a valid number.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if hint_longitude < -180 or hint_longitude > 180:
                return Response(
                    {'detail': 'lon must be between -180 and 180.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if raw_name:
            hint_name = raw_name[:200]

        lang = self._get_lang(request)
        try:
            payload = fetch_latest_osm_feature_metadata(
                normalized_type,
                feature_id,
                lang=lang,
                hint_latitude=hint_latitude,
                hint_longitude=hint_longitude,
                hint_name=hint_name,
            )
        except ExternalServiceError as exc:
            return _api_error_response(
                'Could not fetch latest OSM feature metadata.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )

        if payload is None:
            return Response({'detail': 'OSM feature not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)


class LocationListAPIView(BaseLocationAPIView):
    def get(self, request):
        lang = self._get_lang(request)
        cache_bust_comment = _cache_bust_query_comment(request)
        request_started_at = perf_counter()

        with list_render_debug_scope():
            _list_render_debug_log(f'locations_list_start lang={lang}')

            fetch_started_at = perf_counter()
            fetch_kwargs: dict[str, object] = {'lang': lang}
            if cache_bust_comment:
                fetch_kwargs['query_comment'] = cache_bust_comment
            try:
                locations = fetch_locations(**fetch_kwargs)
            except SPARQLServiceError as exc:
                _list_render_debug_log(
                    f'phase=fetch_locations status=error '
                    f'duration_ms={(perf_counter() - fetch_started_at) * 1000:.1f} '
                    f'error={exc}'
                )
                _list_render_debug_log(
                    f'locations_list_total status=error '
                    f'duration_ms={(perf_counter() - request_started_at) * 1000:.1f}'
                )
                return _api_error_response(
                    'Could not fetch locations.',
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    exc=exc,
                )

            _list_render_debug_log(
                f'phase=fetch_locations status=ok '
                f'duration_ms={(perf_counter() - fetch_started_at) * 1000:.1f} '
                f'items={len(locations)}'
            )

            enrich_started_at = perf_counter()
            locations = enrich_locations_with_image_counts(locations)
            _list_render_debug_log(
                f'phase=enrich_image_counts status=ok '
                f'duration_ms={(perf_counter() - enrich_started_at) * 1000:.1f} '
                f'items={len(locations)}'
            )

            serialize_started_at = perf_counter()
            serializer = LocationSerializer(locations, many=True)
            payload = serializer.data
            _list_render_debug_log(
                f'phase=serialize status=ok '
                f'duration_ms={(perf_counter() - serialize_started_at) * 1000:.1f} '
                f'items={len(payload)}'
            )

            _list_render_debug_log(
                f'locations_list_total status=ok '
                f'duration_ms={(perf_counter() - request_started_at) * 1000:.1f}'
            )

        sparql_query = build_locations_sparql_query(
            lang=lang,
            query_comment=cache_bust_comment,
        )
        query_ui_url = f'https://query.wikidata.org/#{quote(sparql_query, safe="")}'

        response = Response(payload)
        response['X-Wikidata-Query-Url'] = query_ui_url
        return response


class LocationDetailAPIView(BaseLocationAPIView):
    def get(self, request, location_id: str):
        lang = self._get_lang(request)
        uri = _normalized_wikidata_entity_uri_from_location_id(location_id)
        if not uri:
            return Response({'detail': 'Location not found'}, status=status.HTTP_404_NOT_FOUND)

        normalized_uri = _normalize_uri(uri)
        if _LOCAL_DRAFT_URI_PATTERN.match(normalized_uri):
            return Response({'detail': 'Location not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            location = fetch_location_detail(uri=uri, lang=lang)
        except SPARQLServiceError as exc:
            return _api_error_response(
                'Could not fetch location details.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )

        if location:
            serializer = LocationSerializer(_enrich_location_payload(location, lang))
            return Response(serializer.data)

        return Response({'detail': 'Location not found'}, status=status.HTTP_404_NOT_FOUND)


class LocationChildrenAPIView(BaseLocationAPIView):
    def get(self, request, location_id: str = ''):
        lang = self._get_lang(request)
        raw_location_id = location_id or (request.query_params.get('location_id') or '').strip()
        if not raw_location_id:
            return Response({'detail': 'location_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        uri = _normalized_wikidata_entity_uri_from_location_id(raw_location_id)
        if not uri:
            return Response({'detail': 'Location not found'}, status=status.HTTP_404_NOT_FOUND)

        normalized_uri = _normalize_uri(uri)
        if _LOCAL_DRAFT_URI_PATTERN.match(normalized_uri):
            return Response({'detail': 'Location not found'}, status=status.HTTP_404_NOT_FOUND)

        children = _children_payload(uri, lang=lang)
        return Response(children)


class WikidataSearchAPIView(BaseLocationAPIView):
    def get(self, request):
        query = (request.query_params.get('q') or '').strip()
        if not query:
            return Response([])

        limit = self._get_limit(request, default=10, maximum=20)
        lang = self._get_lang(request)
        try:
            items = search_wikidata_entities(query=query, lang=lang, limit=limit)
        except ExternalServiceError as exc:
            return _api_error_response(
                'Wikidata search failed.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )
        return Response(items)


class WikidataEntityAPIView(BaseLocationAPIView):
    def get(self, request, entity_id: str):
        lang = self._get_lang(request)
        try:
            entity = fetch_wikidata_entity(entity_id, lang=lang)
        except ExternalServiceError as exc:
            return _api_error_response(
                'Could not fetch Wikidata entity.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )

        if entity is None:
            return Response({'detail': 'Wikidata entity not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(entity)


class WikidataAddExistingAPIView(BaseLocationAPIView):
    def post(self, request):
        auth_error = self._require_authenticated_user(request)
        if auth_error is not None:
            return auth_error
        oauth_credentials, oauth_error, oauth_status = _mediawiki_oauth_credentials_for_request(request)
        if oauth_credentials is None:
            return Response({'detail': oauth_error}, status=oauth_status)

        serializer = AddExistingWikidataItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wikidata_item = serializer.validated_data['wikidata_item']
        try:
            result = ensure_wikidata_collection_membership(
                wikidata_item,
                oauth_token=oauth_credentials['oauth_token'],
                oauth_token_secret=oauth_credentials['oauth_token_secret'],
                source_url=str(serializer.validated_data.get('source_url') or '').strip(),
                source_title=str(serializer.validated_data.get('source_title') or '').strip(),
                source_title_language=str(serializer.validated_data.get('source_title_language') or '').strip(),
                source_author=str(serializer.validated_data.get('source_author') or '').strip(),
                source_publication_date=str(serializer.validated_data.get('source_publication_date') or '').strip(),
                source_publisher_p123=str(serializer.validated_data.get('source_publisher_p123') or '').strip(),
                source_published_in_p1433=str(serializer.validated_data.get('source_published_in_p1433') or '').strip(),
                source_language_of_work_p407=str(
                    serializer.validated_data.get('source_language_of_work_p407') or ''
                ).strip(),
            )
        except (ExternalServiceError, WikidataWriteError) as exc:
            return _api_error_response(
                'Could not update Wikidata item.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )

        return Response(result)


class CitoidMetadataAPIView(BaseLocationAPIView):
    def get(self, request):
        source_url = str(request.query_params.get('url') or '').strip()
        if not source_url:
            return Response({'detail': 'url is required'}, status=status.HTTP_400_BAD_REQUEST)

        lang = self._get_lang(request)
        try:
            metadata = fetch_citoid_metadata(source_url, lang=lang)
        except ExternalServiceError as exc:
            return _api_error_response(
                'Could not fetch citation metadata.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )
        return Response(metadata)


class WikidataCreateItemAPIView(BaseLocationAPIView):
    def post(self, request):
        auth_error = self._require_authenticated_user(request)
        if auth_error is not None:
            return auth_error
        oauth_credentials, oauth_error, oauth_status = _mediawiki_oauth_credentials_for_request(request)
        if oauth_credentials is None:
            return Response({'detail': oauth_error}, status=oauth_status)

        serializer = CreateWikidataItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lang = self._get_lang(request)
        try:
            created = create_wikidata_building_item(
                serializer.validated_data,
                lang=lang,
                oauth_token=oauth_credentials['oauth_token'],
                oauth_token_secret=oauth_credentials['oauth_token_secret'],
            )
        except (ExternalServiceError, WikidataWriteError) as exc:
            return _api_error_response(
                'Could not create Wikidata item.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )

        return Response(created, status=status.HTTP_201_CREATED)


class CommonsCategorySearchAPIView(BaseLocationAPIView):
    def get(self, request):
        query = (request.query_params.get('q') or '').strip()
        if not query:
            return Response([])

        limit = self._get_limit(request, default=10, maximum=20)
        try:
            categories = search_commons_categories(query=query, limit=limit)
        except ExternalServiceError as exc:
            return _api_error_response(
                'Could not fetch Commons categories.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )
        return Response(categories)


class CommonsImageUploadAPIView(BaseLocationAPIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        auth_error = self._require_authenticated_user(request)
        if auth_error is not None:
            return auth_error
        oauth_credentials, oauth_error, oauth_status = _mediawiki_oauth_credentials_for_request(request)
        if oauth_credentials is None:
            return Response({'detail': oauth_error}, status=oauth_status)

        serializer = CommonsImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lang = self._get_lang(request)
        caption_language = str(serializer.validated_data.get('caption_language') or lang or 'en').strip()
        description_language = str(serializer.validated_data.get('description_language') or lang or 'en').strip()
        try:
            result = upload_image_to_commons(
                image_file=serializer.validated_data['file'],
                caption=str(serializer.validated_data.get('caption') or '').strip(),
                caption_language=caption_language,
                description=str(serializer.validated_data.get('description') or '').strip(),
                description_language=description_language,
                target_filename=str(serializer.validated_data.get('target_filename') or '').strip(),
                author=str(serializer.validated_data.get('author') or '').strip(),
                source_url=str(serializer.validated_data.get('source_url') or '').strip(),
                date_created=str(serializer.validated_data.get('date_created') or '').strip(),
                license_template=str(serializer.validated_data.get('license_template') or 'Cc-by-sa-4.0').strip(),
                categories=list(serializer.validated_data.get('categories') or []),
                depicts=list(serializer.validated_data.get('depicts') or []),
                wikidata_item=str(serializer.validated_data.get('wikidata_item') or '').strip(),
                coordinate_source=str(serializer.validated_data.get('coordinate_source') or 'map').strip(),
                latitude=serializer.validated_data.get('latitude'),
                longitude=serializer.validated_data.get('longitude'),
                heading=serializer.validated_data.get('heading'),
                elevation_meters=serializer.validated_data.get('elevation_meters'),
                oauth_token=oauth_credentials['oauth_token'],
                oauth_token_secret=oauth_credentials['oauth_token_secret'],
            )
        except (ExternalServiceError, WikidataWriteError) as exc:
            return _api_error_response(
                'Could not upload file to Wikimedia Commons.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )

        return Response(result, status=status.HTTP_201_CREATED)


class GeocodeSearchAPIView(BaseLocationAPIView):
    def get(self, request):
        query = (request.query_params.get('q') or '').strip()
        if not query:
            return Response([])

        limit = self._get_limit(request, default=8, maximum=20)
        try:
            places = search_geocode_places(query=query, limit=limit)
        except ExternalServiceError as exc:
            return _api_error_response(
                'Geocoding search failed.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )
        return Response(places)


class GeocodeReverseAPIView(BaseLocationAPIView):
    def get(self, request):
        lat_value = request.query_params.get('lat')
        lon_value = request.query_params.get('lon')
        if not lat_value or not lon_value:
            return Response(
                {'detail': 'Latitude and longitude are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            latitude = float(lat_value)
            longitude = float(lon_value)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'Latitude and longitude must be valid numbers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lang = self._get_lang(request)
        try:
            result = reverse_geocode_places(latitude=latitude, longitude=longitude, lang=lang)
        except ExternalServiceError as exc:
            return _api_error_response(
                'Reverse geocoding failed.',
                status_code=status.HTTP_502_BAD_GATEWAY,
                exc=exc,
            )
        return Response(result)
