from __future__ import annotations

import re
from time import perf_counter
from urllib.parse import quote

from django.conf import settings
from django.utils import translation
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DraftLocation
from .serializers import (
    AddExistingWikidataItemSerializer,
    CreateWikidataItemSerializer,
    DraftLocationSerializer,
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
    fetch_citoid_metadata,
    encode_location_id,
    fetch_wikidata_entity,
    fetch_location_children,
    fetch_location_detail,
    fetch_locations,
    fetch_wikidata_authenticated_username,
    list_render_debug_scope,
    search_commons_categories,
    search_geocode_places,
    reverse_geocode_places,
    search_wikidata_entities,
)


_WIKIDATA_ENTITY_PATTERN = re.compile(
    r'^https?://www\.wikidata\.org/entity/(Q\d+)$',
    flags=re.IGNORECASE,
)
_WIKIDATA_QID_PATTERN = re.compile(r'(Q\d+)', flags=re.IGNORECASE)
_DRAFT_URI_PATTERN = re.compile(r'^https://draft\.local/location/(\d+)$')
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


def _wikidata_uri_from_qid(qid: str) -> str:
    normalized_qid = _extract_wikidata_qid(qid)
    if not normalized_qid:
        return ''
    return f'https://www.wikidata.org/entity/{normalized_qid}'


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


def _draft_tree_item(draft: DraftLocation) -> dict:
    uri = draft.canonical_uri()
    return {
        'id': encode_location_id(uri),
        'uri': uri,
        'name': draft.name,
        'source': 'draft',
        'draft_id': draft.id,
    }


def _children_for_parent_uri(parent_uri: str) -> list[dict]:
    normalized_parent = _normalize_uri(parent_uri)
    if not normalized_parent:
        return []

    children: list[dict] = []
    for draft in _draft_queryset():
        if _normalize_uri(draft.parent_uri) != normalized_parent:
            continue
        children.append(_draft_tree_item(draft))

    return children


def _merge_children(primary_children: list[dict], secondary_children: list[dict]) -> list[dict]:
    merged: list[dict] = []
    seen_keys: set[str] = set()

    for child in [*primary_children, *secondary_children]:
        if not isinstance(child, dict):
            continue
        child_uri = _normalize_uri(str(child.get('uri') or ''))
        child_id = str(child.get('id') or '').strip()
        dedupe_key = child_uri or child_id
        if not dedupe_key:
            continue
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)
        merged.append(child)

    return merged


def _children_payload(
    parent_uri: str,
    lang: str,
    wikidata_item: str = '',
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
    normalized_qid = _extract_wikidata_qid(wikidata_item)
    if normalized_qid:
        wikidata_uri = _wikidata_uri_from_qid(normalized_qid)
        if wikidata_uri:
            child_source_uri = wikidata_uri

    draft_children = _children_for_parent_uri(normalized_parent_uri)
    if child_source_uri and _normalize_uri(child_source_uri) != normalized_parent_uri:
        draft_children = _merge_children(
            draft_children,
            _children_for_parent_uri(child_source_uri),
        )

    sparql_children: list[dict] = []
    sparql_source_uri = _wikidata_sparql_uri(child_source_uri)
    if sparql_source_uri:
        try:
            sparql_children = fetch_location_children(uri=sparql_source_uri, lang=lang)
        except SPARQLServiceError:
            sparql_children = []

    return _merge_children(sparql_children, draft_children)


def _draft_to_location(
    draft: DraftLocation,
    include_children: bool = False,
) -> dict:
    uri = draft.canonical_uri()
    parent_uri = _normalize_uri(draft.parent_uri) if draft.parent_uri else ''
    item = {
        'id': encode_location_id(uri),
        'uri': uri,
        'name': draft.name,
        'description': draft.description,
        'latitude': draft.latitude,
        'longitude': draft.longitude,
        'source': 'draft',
        'draft_id': draft.id,
        'location_type': draft.location_type,
        'wikidata_item': draft.wikidata_item,
        'address_text': draft.address_text,
        'postal_code': draft.postal_code,
        'municipality_p131': draft.municipality_p131,
        'commons_category': draft.commons_category,
        'parent_uri': parent_uri,
    }
    if parent_uri:
        item['parent_id'] = encode_location_id(parent_uri)

    if include_children:
        item['children'] = _children_for_parent_uri(uri)

    return item


def _draft_with_wikidata_detail(draft: DraftLocation, lang: str) -> dict:
    payload = _draft_to_location(draft)
    qid = _extract_wikidata_qid(draft.wikidata_item)
    if not qid:
        return payload

    wikidata_uri = _wikidata_uri_from_qid(qid)
    if not wikidata_uri:
        return payload

    try:
        wikidata_detail = fetch_location_detail(uri=wikidata_uri, lang=lang)
    except SPARQLServiceError:
        return payload

    if not isinstance(wikidata_detail, dict):
        return payload

    # Use SPARQL detail as the primary presentation base, same as P527/P361-linked entities.
    merged = dict(wikidata_detail)
    merged['source'] = 'draft'
    merged['draft_id'] = draft.id
    merged['wikidata_item'] = qid

    # Keep explicit draft parent linkage fields.
    if payload.get('parent_uri'):
        merged['parent_uri'] = payload['parent_uri']
    if payload.get('parent_id'):
        merged['parent_id'] = payload['parent_id']

    return merged


def _draft_queryset():
    return DraftLocation.objects.all()


def _draft_wikidata_qids(draft_locations: list[DraftLocation]) -> list[str]:
    qids: list[str] = []
    seen_qids: set[str] = set()

    for draft in draft_locations:
        qid = _extract_wikidata_qid(draft.wikidata_item)
        if not qid or qid in seen_qids:
            continue
        seen_qids.add(qid)
        qids.append(qid)

    return qids


def _draft_by_id(draft_id: int) -> DraftLocation | None:
    return _draft_queryset().filter(pk=draft_id).first()


def _apply_draft_metadata_to_wikidata_location(location: dict, draft: DraftLocation) -> dict:
    if not isinstance(location, dict):
        return location

    enriched = dict(location)
    enriched['source'] = 'draft'
    enriched['draft_id'] = draft.id

    qid = _extract_wikidata_qid(draft.wikidata_item)
    if qid:
        enriched['wikidata_item'] = qid

    parent_uri = _normalize_uri(draft.parent_uri) if draft.parent_uri else ''
    if parent_uri:
        enriched['parent_uri'] = parent_uri
        enriched['parent_id'] = encode_location_id(parent_uri)

    return enriched


def _merge_locations_with_drafts(
    sparql_locations: list[dict],
    draft_locations: list[DraftLocation],
    lang: str,
) -> list[dict]:
    merged = list(sparql_locations)
    draft_by_wikidata_uri: dict[str, DraftLocation] = {}
    for draft in draft_locations:
        qid = _extract_wikidata_qid(draft.wikidata_item)
        if not qid:
            continue
        wikidata_uri = _normalize_uri(_wikidata_uri_from_qid(qid))
        if not wikidata_uri or wikidata_uri in draft_by_wikidata_uri:
            continue
        draft_by_wikidata_uri[wikidata_uri] = draft

    for index, location in enumerate(merged):
        if not isinstance(location, dict):
            continue
        normalized_uri = _normalize_uri(str(location.get('uri') or ''))
        draft = draft_by_wikidata_uri.get(normalized_uri)
        if draft is None:
            continue
        merged[index] = _apply_draft_metadata_to_wikidata_location(location, draft)

    seen_uris = {_normalize_uri(item.get('uri', '')) for item in sparql_locations if item.get('uri')}

    for draft in draft_locations:
        draft_qid = _extract_wikidata_qid(draft.wikidata_item)
        has_wikidata_item = bool(draft_qid)
        if has_wikidata_item:
            wikidata_uri = _normalize_uri(_wikidata_uri_from_qid(draft_qid))
            if wikidata_uri and wikidata_uri in seen_uris:
                continue

        if has_wikidata_item:
            draft_item = _draft_with_wikidata_detail(draft, lang)
        else:
            draft_item = _draft_to_location(draft)
        normalized_uri = _normalize_uri(draft_item['uri'])
        if normalized_uri in seen_uris:
            continue

        seen_uris.add(normalized_uri)
        merged.append(draft_item)

    return merged


def _draft_by_uri(uri: str) -> DraftLocation | None:
    normalized_uri = _normalize_uri(uri)
    match = _DRAFT_URI_PATTERN.match(normalized_uri)
    queryset = _draft_queryset()

    if match:
        return queryset.filter(pk=int(match.group(1))).first()

    return next((draft for draft in queryset if _normalize_uri(draft.canonical_uri()) == normalized_uri), None)


class BaseLocationAPIView(APIView):
    def _get_lang(self, request) -> str:
        lang = request.query_params.get('lang') or translation.get_language()
        return lang or 'en'

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


class LocationListAPIView(BaseLocationAPIView):
    def get(self, request):
        lang = self._get_lang(request)
        cache_bust_comment = _cache_bust_query_comment(request)
        request_started_at = perf_counter()

        with list_render_debug_scope():
            _list_render_debug_log(f'locations_list_start lang={lang}')

            collect_drafts_started_at = perf_counter()
            draft_locations = list(_draft_queryset())
            draft_wikidata_qids = _draft_wikidata_qids(draft_locations)
            _list_render_debug_log(
                f'phase=collect_drafts status=ok '
                f'duration_ms={(perf_counter() - collect_drafts_started_at) * 1000:.1f} '
                f'draft_items={len(draft_locations)} '
                f'draft_wikidata_qids={len(draft_wikidata_qids)}'
            )

            fetch_started_at = perf_counter()
            fetch_kwargs: dict[str, object] = {'lang': lang}
            if cache_bust_comment:
                fetch_kwargs['query_comment'] = cache_bust_comment
            if draft_wikidata_qids:
                fetch_kwargs['additional_wikidata_qids'] = draft_wikidata_qids
            try:
                sparql_locations = fetch_locations(**fetch_kwargs)
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
                f'items={len(sparql_locations)} '
                f'additional_wikidata_qids={len(draft_wikidata_qids)}'
            )

            merge_started_at = perf_counter()
            locations = _merge_locations_with_drafts(sparql_locations, draft_locations, lang)
            _list_render_debug_log(
                f'phase=merge_with_drafts status=ok '
                f'duration_ms={(perf_counter() - merge_started_at) * 1000:.1f} '
                f'sparql_items={len(sparql_locations)} '
                f'draft_items={len(draft_locations)} '
                f'merged_items={len(locations)}'
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
            additional_wikidata_qids=draft_wikidata_qids,
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

        # Explicit draft URIs are always served from local draft storage.
        if _DRAFT_URI_PATTERN.match(normalized_uri):
            draft_location = _draft_by_uri(uri)
            if draft_location is None:
                return Response({'detail': 'Location not found'}, status=status.HTTP_404_NOT_FOUND)
            payload = _draft_with_wikidata_detail(draft_location, lang)
            serializer = LocationSerializer(_enrich_location_payload(payload, lang))
            return Response(serializer.data)

        try:
            location = fetch_location_detail(uri=uri, lang=lang)
        except SPARQLServiceError as exc:
            draft_location = _draft_by_uri(uri)
            if draft_location is not None:
                payload = _draft_to_location(draft_location)
                serializer = LocationSerializer(_enrich_location_payload(payload, lang))
                return Response(serializer.data)
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        if location:
            serializer = LocationSerializer(_enrich_location_payload(location, lang))
            return Response(serializer.data)

        draft_location = _draft_by_uri(uri)
        if draft_location is not None:
            payload = _draft_to_location(draft_location)
            serializer = LocationSerializer(_enrich_location_payload(payload, lang))
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

        if _DRAFT_URI_PATTERN.match(normalized_uri):
            draft_location = _draft_by_uri(uri)
            if draft_location is None:
                return Response({'detail': 'Location not found'}, status=status.HTTP_404_NOT_FOUND)
            parent_uri = draft_location.canonical_uri()
            wikidata_item = draft_location.wikidata_item
        else:
            parent_uri = normalized_uri
            wikidata_item = ''

        children = _children_payload(parent_uri, lang=lang, wikidata_item=wikidata_item)
        return Response(children)


class DraftLocationListCreateAPIView(BaseLocationAPIView):
    def get(self, request):
        drafts = _draft_queryset()
        serializer = DraftLocationSerializer(drafts, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = DraftLocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        draft = serializer.save()
        return Response(DraftLocationSerializer(draft).data, status=status.HTTP_201_CREATED)


class DraftLocationDetailAPIView(BaseLocationAPIView):
    def get(self, request, draft_id: int):
        draft = _draft_by_id(draft_id)
        if draft is None:
            return Response({'detail': 'Draft location not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = DraftLocationSerializer(draft)
        return Response(serializer.data)

    def patch(self, request, draft_id: int):
        draft = _draft_by_id(draft_id)
        if draft is None:
            return Response({'detail': 'Draft location not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = DraftLocationSerializer(draft, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_draft = serializer.save()
        return Response(DraftLocationSerializer(updated_draft).data)


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
