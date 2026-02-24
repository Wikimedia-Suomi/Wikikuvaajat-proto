from __future__ import annotations

import re
from time import perf_counter
from urllib.parse import quote

from django.conf import settings
from django.utils import translation
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
_WIKIDATA_QID_PATTERN = re.compile(r'(Q\d+)', flags=re.IGNORECASE)
_LOCAL_DRAFT_URI_PATTERN = re.compile(r'^https://draft\.local/location/\d+$', flags=re.IGNORECASE)
_CACHE_BUST_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$')


def _list_render_debug_log(message: str) -> None:
    if not getattr(settings, 'DEBUG', False):
        return
    print(f'[LIST-DEBUG] {message}', flush=True)


def _oauth_login_url() -> str:
    return '/auth/login/mediawiki/?next=/'


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


def _local_dev_access_token_enabled() -> bool:
    if not getattr(settings, 'DEBUG', False):
        return False
    token, secret = _local_dev_access_token_credentials()
    return bool(token and secret)


def _cache_bust_query_comment(request) -> str:
    raw_value = str(request.query_params.get('cache_bust') or '').strip()
    if not raw_value:
        return ''
    if not _CACHE_BUST_PATTERN.fullmatch(raw_value):
        return ''
    return f'# cache-bust: {raw_value}'


def _mediawiki_oauth_credentials_for_request(request) -> tuple[dict[str, str] | None, str, int]:
    oauth_enabled = _oauth_enabled()
    local_access_token_enabled = _local_dev_access_token_enabled()
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

    if local_access_token_enabled:
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
        if _local_dev_access_token_enabled():
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


class AuthStatusAPIView(APIView):
    def get(self, request):
        oauth_enabled = _oauth_enabled()
        local_access_token_enabled = _local_dev_access_token_enabled()
        enabled = oauth_enabled or local_access_token_enabled
        request_is_authenticated = bool(getattr(request, 'user', None) and request.user.is_authenticated)
        use_access_token_mode = bool(local_access_token_enabled and (not request_is_authenticated or not oauth_enabled))
        payload: dict[str, object] = {
            'enabled': enabled,
            'authenticated': request_is_authenticated or use_access_token_mode,
            'login_url': '#' if use_access_token_mode else _oauth_login_url(),
            'logout_url': '#' if use_access_token_mode else _oauth_logout_url(),
            'provider': 'mediawiki',
            'auth_mode': 'access_token' if use_access_token_mode else 'oauth',
            'username': '',
        }

        if not enabled:
            return Response(payload)

        if payload['authenticated']:
            if use_access_token_mode:
                access_token, access_token_secret = _local_dev_access_token_credentials()
                try:
                    payload['username'] = (
                        fetch_wikidata_authenticated_username(
                            oauth_token=access_token,
                            oauth_token_secret=access_token_secret,
                        )
                        or 'local-access-token'
                    )
                except WikidataWriteError as exc:
                    print(
                        f'[AUTH-DEBUG] Local access token username lookup failed: {exc}',
                        flush=True,
                    )
                    payload['username'] = 'local-access-token'
            else:
                payload['username'] = str(request.user.get_username() or '')

        return Response(payload)


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
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

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
                return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

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
        uri = decode_location_id(location_id)
        normalized_uri = _normalize_uri(uri)
        if _LOCAL_DRAFT_URI_PATTERN.match(normalized_uri):
            return Response({'detail': 'Location not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            location = fetch_location_detail(uri=uri, lang=lang)
        except SPARQLServiceError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

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

        uri = decode_location_id(raw_location_id)
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
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(items)


class WikidataEntityAPIView(BaseLocationAPIView):
    def get(self, request, entity_id: str):
        lang = self._get_lang(request)
        try:
            entity = fetch_wikidata_entity(entity_id, lang=lang)
        except ExternalServiceError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

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
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

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
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
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
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

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
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
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
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

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
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
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
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)
