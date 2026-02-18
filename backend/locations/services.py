from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from contextvars import ContextVar
import json
from dataclasses import dataclass
from datetime import date, timedelta
from functools import partial
import re
from threading import Lock
from time import perf_counter
from typing import Any
from urllib.parse import quote, unquote
import xml.etree.ElementTree as ET

import requests
try:
    from requests_oauthlib import OAuth1
except ImportError:  # pragma: no cover - handled in runtime configuration checks
    OAuth1 = None
from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone

from .models import CommonsCategoryImageCountCache, ViewItImageCountCache


class SPARQLServiceError(RuntimeError):
    pass


class ExternalServiceError(RuntimeError):
    pass


class WikidataWriteError(RuntimeError):
    pass


@dataclass(frozen=True)
class Location:
    id: str
    uri: str
    name: str
    description: str
    latitude: float
    longitude: float
    date_modified: str = ''
    commons_category: str = ''
    image_name: str = ''
    image_url: str = ''
    image_thumb_url: str = ''
    inception_p571: str = ''
    location_p276: str = ''
    location_p276_label: str = ''
    location_p276_wikipedia_url: str = ''
    architect_p84: str = ''
    architect_p84_label: str = ''
    architect_p84_wikipedia_url: str = ''
    official_closure_date_p3999: str = ''
    state_of_use_p5817: str = ''
    state_of_use_p5817_label: str = ''
    state_of_use_p5817_wikipedia_url: str = ''
    address_text: str = ''
    postal_code: str = ''
    municipality_p131: str = ''
    municipality_p131_label: str = ''
    municipality_p131_wikipedia_url: str = ''
    instance_of_p31: str = ''
    instance_of_p31_label: str = ''
    instance_of_p31_wikipedia_url: str = ''
    architectural_style_p149: str = ''
    architectural_style_p149_label: str = ''
    architectural_style_p149_wikipedia_url: str = ''
    heritage_designation_p1435: str = ''
    heritage_designation_p1435_label: str = ''
    heritage_designation_p1435_wikipedia_url: str = ''
    located_on_street_p669: str = ''
    located_on_street_p669_label: str = ''
    located_on_street_p669_wikipedia_url: str = ''
    house_number_p670: str = ''
    route_instruction_p2795: str = ''
    yso_id_p2347: str = ''
    yle_topic_id_p8309: str = ''
    kanto_id_p8980: str = ''
    protected_buildings_register_in_finland_id_p5310: str = ''
    rky_national_built_heritage_environment_id_p4009: str = ''
    permanent_building_number_vtj_prt_p3824: str = ''
    protected_buildings_register_in_finland_building_id_p5313: str = ''
    helsinki_persistent_building_id_ratu_p8355: str = ''


_WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php'
_COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php'
_NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
_NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
_PETSCAN_API_URL = 'https://petscan.wmcloud.org/'
_VIEW_IT_API_BASE_URL = 'https://view-it.toolforge.org/api'
_CITOID_REST_API_URL = 'https://en.wikipedia.org/api/rest_v1/data/citation/mediawiki/'
_COMMONS_THUMB_WIDTH = 320
_PETSCAN_DEPTH = 3
_WIKIDATA_CALENDAR_MODEL = 'http://www.wikidata.org/entity/Q1985727'
_WIKIDATA_GLOBE = 'http://www.wikidata.org/entity/Q2'
_IMAGE_COUNT_REFRESH_MAX_WORKERS = 4
_IMAGE_COUNT_REFRESH_EXECUTOR = ThreadPoolExecutor(
    max_workers=_IMAGE_COUNT_REFRESH_MAX_WORKERS,
    thread_name_prefix='image-count-refresh',
)
_IMAGE_COUNT_REFRESH_LOCK = Lock()
_PENDING_COMMONS_IMAGE_COUNT_REFRESHES: set[str] = set()
_PENDING_VIEW_IT_IMAGE_COUNT_REFRESHES: set[str] = set()
_LIST_RENDER_DEBUG_ACTIVE: ContextVar[bool] = ContextVar('list_render_debug_active', default=False)


@contextmanager
def list_render_debug_scope():
    if not getattr(settings, 'DEBUG', False):
        yield
        return

    token = _LIST_RENDER_DEBUG_ACTIVE.set(True)
    try:
        yield
    finally:
        _LIST_RENDER_DEBUG_ACTIVE.reset(token)


def _list_render_debug_enabled() -> bool:
    return bool(getattr(settings, 'DEBUG', False) and _LIST_RENDER_DEBUG_ACTIVE.get())


def _list_render_debug_log(message: str) -> None:
    if not _list_render_debug_enabled():
        return
    print(f'[LIST-DEBUG] {message}', flush=True)


def _format_debug_url(url: str, max_length: int = 600) -> str:
    normalized = str(url or '').strip()
    if len(normalized) <= max_length:
        return normalized
    return f'{normalized[:max_length - 3]}...'


def _list_render_debug_log_external_fetch(
    *,
    source: str,
    url: str,
    started_at: float,
    error: Exception | None = None,
) -> None:
    if not _list_render_debug_enabled():
        return

    elapsed_ms = (perf_counter() - started_at) * 1000
    status = 'error' if error is not None else 'ok'
    message = (
        f'external_fetch source={source} status={status} '
        f'duration_ms={elapsed_ms:.1f} url={_format_debug_url(url)}'
    )
    if error is not None:
        message = f'{message} error={error}'
    _list_render_debug_log(message)


def _language_fallbacks(lang: str | None, include_mul: bool = True) -> list[str]:
    allowed = {code.lower() for code, _ in settings.LANGUAGES}
    default_lang = settings.LANGUAGE_CODE.lower()
    candidates: list[str] = []

    if lang:
        normalized = lang.lower().replace('_', '-')
        if normalized in allowed:
            candidates.append(normalized)

        base_lang = normalized.split('-')[0]
        if base_lang in allowed:
            candidates.append(base_lang)

    if default_lang in allowed:
        candidates.append(default_lang)

    if 'en' in allowed:
        candidates.append('en')
    if include_mul:
        candidates.append('mul')

    unique_candidates: list[str] = []
    for candidate in candidates:
        if candidate not in unique_candidates:
            unique_candidates.append(candidate)

    return unique_candidates


def _sparql_label_languages(preferred_lang: str | None) -> str:
    candidates: list[str] = []
    normalized = (preferred_lang or '').strip().lower().replace('_', '-')
    if normalized:
        candidates.append(normalized)
        base_lang = normalized.split('-')[0]
        if base_lang:
            candidates.append(base_lang)

    candidates.append('en')
    candidates.append('mul')

    unique_candidates: list[str] = []
    for candidate in candidates:
        if candidate and candidate not in unique_candidates:
            unique_candidates.append(candidate)

    return ','.join(unique_candidates)


def _wikipedia_site_url(preferred_lang: str | None) -> str:
    normalized = (preferred_lang or '').strip().lower().replace('_', '-')
    language_code = normalized.split('-', 1)[0] if normalized else 'en'
    if not re.fullmatch(r'[a-z]{2,12}', language_code):
        language_code = 'en'
    return f'https://{language_code}.wikipedia.org/'


def encode_location_id(uri: str) -> str:
    return quote(uri, safe='')


def decode_location_id(location_id: str) -> str:
    return unquote(location_id)


def _query_sparql(query: str) -> list[dict[str, Any]]:
    request_started_at = perf_counter()
    request_url = str(getattr(settings, 'SPARQL_ENDPOINT', '') or '')
    try:
        response = requests.get(
            settings.SPARQL_ENDPOINT,
            params={'query': query, 'format': 'application/sparql-results+json'},
            headers={
                'Accept': 'application/sparql-results+json, application/json;q=0.9, */*;q=0.1',
                'User-Agent': 'LocationsExplorer/1.0 (+https://localhost)',
            },
            timeout=settings.SPARQL_TIMEOUT_SECONDS,
        )
        request_url = str(getattr(response, 'url', '') or request_url)
        response.raise_for_status()
    except requests.RequestException as exc:
        _list_render_debug_log_external_fetch(
            source='sparql',
            url=request_url,
            started_at=request_started_at,
            error=exc,
        )
        raise SPARQLServiceError(f'SPARQL request failed: {exc}') from exc
    _list_render_debug_log_external_fetch(
        source='sparql',
        url=request_url,
        started_at=request_started_at,
    )

    def _parse_sparql_xml_results(xml_text: str) -> list[dict[str, Any]]:
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as exc:
            raise SPARQLServiceError(f'SPARQL XML parse failed: {exc}') from exc

        ns = {'sr': 'http://www.w3.org/2005/sparql-results#'}
        bindings: list[dict[str, Any]] = []

        for result in root.findall('.//sr:results/sr:result', ns):
            item: dict[str, Any] = {}
            for binding in result.findall('sr:binding', ns):
                name = binding.attrib.get('name')
                if not name:
                    continue

                value_node = None
                for candidate_tag in ('sr:uri', 'sr:literal', 'sr:bnode'):
                    candidate = binding.find(candidate_tag, ns)
                    if candidate is not None:
                        value_node = candidate
                        break
                if value_node is None or value_node.text is None:
                    continue

                item[name] = {'value': value_node.text}

            if item:
                bindings.append(item)

        return bindings

    try:
        payload = response.json()
    except ValueError as exc:
        content_type = response.headers.get('Content-Type', '').lower()
        preview = response.text[:200].replace('\n', ' ').strip()
        looks_like_xml = (
            'application/sparql-results+xml' in content_type
            or response.text.lstrip().startswith('<?xml')
            or response.text.lstrip().startswith('<sparql')
        )

        if looks_like_xml:
            return _parse_sparql_xml_results(response.text)

        raise SPARQLServiceError(
            'SPARQL endpoint did not return supported results format. '
            f'content_type={content_type!r}, preview={preview!r}'
        ) from exc

    return payload.get('results', {}).get('bindings', [])


def _format_binding(binding: dict[str, Any]) -> Location:
    uri = _binding_value(binding, ['item', 'uri', 'id'])
    if not uri:
        raise SPARQLServiceError('SPARQL results missing item URI.')

    description = _binding_value(binding, ['itemDescription', 'description', 'comment'], '')
    name = _binding_value(binding, ['itemLabel', 'label', 'name'])
    if not name:
        name = uri.rsplit('/', 1)[-1].replace('_', ' ')
    date_modified = _binding_value(binding, ['dateModified'], '')

    lat_value = _binding_value(binding, ['lat', 'latitude'])
    lon_value = _binding_value(binding, ['lon', 'long', 'longitude'])
    if lat_value and lon_value:
        try:
            latitude = float(lat_value)
            longitude = float(lon_value)
        except ValueError as exc:
            raise SPARQLServiceError('SPARQL results contain invalid coordinates.') from exc
    else:
        coord_value = _binding_value(binding, ['coord', 'coordinate', 'location'])
        lat_lon = _parse_coord_to_lat_lon(coord_value)
        if lat_lon is None:
            raise SPARQLServiceError('SPARQL results missing coordinate bindings.')
        latitude, longitude = lat_lon

    image_name = _binding_value(binding, ['imageName', 'image_name', 'image'], '')
    image_url, image_thumb_url, image_name = _resolve_sparql_image(image_name)
    commons_category = _normalize_commons_category(
        _binding_value(binding, ['commonsCategory', 'commons_category'], '')
    )
    inception_p571 = _binding_value(binding, ['inceptionP571', 'inception'], '')
    location_p276 = _binding_value(binding, ['locationP276', 'location'], '')
    location_p276_label = _binding_value(binding, ['locationP276Label', 'locationLabel'], '')
    location_p276_wikipedia_url = _binding_value(
        binding,
        ['locationP276WikipediaUrl', 'locationWikipediaUrl'],
        '',
    )
    architect_p84 = _binding_value(binding, ['architectP84', 'architect'], '')
    architect_p84_label = _binding_value(binding, ['architectP84Label', 'architectLabel'], '')
    architect_p84_wikipedia_url = _binding_value(
        binding,
        ['architectP84WikipediaUrl', 'architectWikipediaUrl'],
        '',
    )
    official_closure_date_p3999 = _binding_value(
        binding,
        ['officialClosureDateP3999', 'officialClosureDate', 'closureDate'],
        '',
    )
    state_of_use_p5817 = _binding_value(binding, ['stateOfUseP5817', 'stateOfUse'], '')
    state_of_use_p5817_label = _binding_value(binding, ['stateOfUseP5817Label', 'stateOfUseLabel'], '')
    state_of_use_p5817_wikipedia_url = _binding_value(
        binding,
        ['stateOfUseP5817WikipediaUrl', 'stateOfUseWikipediaUrl'],
        '',
    )
    municipality_p131 = _binding_value(
        binding,
        ['municipalityP131', 'administrativeTerritorialEntityP131', 'municipality'],
        '',
    )
    municipality_p131_label = _binding_value(
        binding,
        ['municipalityP131Label', 'administrativeTerritorialEntityP131Label', 'municipalityLabel'],
        '',
    )
    municipality_p131_wikipedia_url = _binding_value(
        binding,
        [
            'municipalityP131WikipediaUrl',
            'administrativeTerritorialEntityP131WikipediaUrl',
            'municipalityWikipediaUrl',
        ],
        '',
    )
    address_text = _binding_value(binding, ['addressTextP6375', 'streetAddressP6375', 'addressText'], '')
    postal_code = _binding_value(binding, ['postalCodeP281', 'postalCode'], '')
    located_on_street_p669 = _binding_value(binding, ['locatedOnStreetP669', 'locatedOnStreet'], '')
    located_on_street_p669_label = _binding_value(
        binding,
        ['locatedOnStreetP669Label', 'locatedOnStreetLabel'],
        '',
    )
    located_on_street_p669_wikipedia_url = _binding_value(
        binding,
        ['locatedOnStreetP669WikipediaUrl', 'locatedOnStreetWikipediaUrl'],
        '',
    )
    house_number_p670 = _binding_value(binding, ['houseNumberP670', 'houseNumber'], '')
    heritage_designation_p1435 = _binding_value(
        binding,
        ['heritageDesignationP1435', 'heritageDesignation'],
        '',
    )
    heritage_designation_p1435_label = _binding_value(
        binding,
        ['heritageDesignationP1435Label', 'heritageDesignationLabel'],
        '',
    )
    heritage_designation_p1435_wikipedia_url = _binding_value(
        binding,
        ['heritageDesignationP1435WikipediaUrl', 'heritageDesignationWikipediaUrl'],
        '',
    )
    instance_of_p31 = _binding_value(binding, ['instanceOfP31', 'instanceOf'], '')
    instance_of_p31_label = _binding_value(binding, ['instanceOfP31Label', 'instanceOfLabel'], '')
    instance_of_p31_wikipedia_url = _binding_value(
        binding,
        ['instanceOfP31WikipediaUrl', 'instanceOfWikipediaUrl'],
        '',
    )
    architectural_style_p149 = _binding_value(
        binding,
        ['architecturalStyleP149', 'architecturalStyle'],
        '',
    )
    architectural_style_p149_label = _binding_value(
        binding,
        ['architecturalStyleP149Label', 'architecturalStyleLabel'],
        '',
    )
    architectural_style_p149_wikipedia_url = _binding_value(
        binding,
        ['architecturalStyleP149WikipediaUrl', 'architecturalStyleWikipediaUrl'],
        '',
    )
    route_instruction_p2795 = _binding_value(
        binding,
        ['routeInstructionP2795', 'directionsP2795', 'routeInstruction'],
        '',
    )
    yso_id_p2347 = _binding_value(binding, ['ysoIdP2347', 'ysoId'], '')
    yle_topic_id_p8309 = _binding_value(binding, ['yleTopicIdP8309', 'yleTopicId'], '')
    kanto_id_p8980 = _binding_value(binding, ['kantoIdP8980', 'kantoId'], '')
    protected_buildings_register_in_finland_id_p5310 = _binding_value(
        binding,
        ['protectedBuildingsRegisterInFinlandIdP5310', 'protectedBuildingsRegisterIdP5310'],
        '',
    )
    rky_national_built_heritage_environment_id_p4009 = _binding_value(
        binding,
        ['rkyNationalBuiltHeritageEnvironmentIdP4009', 'rkyIdP4009'],
        '',
    )
    permanent_building_number_vtj_prt_p3824 = _binding_value(
        binding,
        ['permanentBuildingNumberVtjPrtP3824', 'permanentBuildingNumberP3824'],
        '',
    )
    protected_buildings_register_in_finland_building_id_p5313 = _binding_value(
        binding,
        ['protectedBuildingsRegisterInFinlandBuildingIdP5313', 'protectedBuildingsRegisterBuildingIdP5313'],
        '',
    )
    helsinki_persistent_building_id_ratu_p8355 = _binding_value(
        binding,
        ['helsinkiPersistentBuildingIdRatuP8355', 'helsinkiPersistentBuildingIdP8355'],
        '',
    )

    return Location(
        id=encode_location_id(uri),
        uri=uri,
        name=name,
        description=description,
        date_modified=date_modified,
        latitude=latitude,
        longitude=longitude,
        commons_category=commons_category,
        image_name=image_name,
        image_url=image_url,
        image_thumb_url=image_thumb_url,
        inception_p571=inception_p571,
        location_p276=location_p276,
        location_p276_label=location_p276_label,
        location_p276_wikipedia_url=location_p276_wikipedia_url,
        architect_p84=architect_p84,
        architect_p84_label=architect_p84_label,
        architect_p84_wikipedia_url=architect_p84_wikipedia_url,
        official_closure_date_p3999=official_closure_date_p3999,
        state_of_use_p5817=state_of_use_p5817,
        state_of_use_p5817_label=state_of_use_p5817_label,
        state_of_use_p5817_wikipedia_url=state_of_use_p5817_wikipedia_url,
        municipality_p131=municipality_p131,
        municipality_p131_label=municipality_p131_label,
        municipality_p131_wikipedia_url=municipality_p131_wikipedia_url,
        address_text=address_text,
        postal_code=postal_code,
        located_on_street_p669=located_on_street_p669,
        located_on_street_p669_label=located_on_street_p669_label,
        located_on_street_p669_wikipedia_url=located_on_street_p669_wikipedia_url,
        house_number_p670=house_number_p670,
        heritage_designation_p1435=heritage_designation_p1435,
        heritage_designation_p1435_label=heritage_designation_p1435_label,
        heritage_designation_p1435_wikipedia_url=heritage_designation_p1435_wikipedia_url,
        instance_of_p31=instance_of_p31,
        instance_of_p31_label=instance_of_p31_label,
        instance_of_p31_wikipedia_url=instance_of_p31_wikipedia_url,
        architectural_style_p149=architectural_style_p149,
        architectural_style_p149_label=architectural_style_p149_label,
        architectural_style_p149_wikipedia_url=architectural_style_p149_wikipedia_url,
        route_instruction_p2795=route_instruction_p2795,
        yso_id_p2347=yso_id_p2347,
        yle_topic_id_p8309=yle_topic_id_p8309,
        kanto_id_p8980=kanto_id_p8980,
        protected_buildings_register_in_finland_id_p5310=protected_buildings_register_in_finland_id_p5310,
        rky_national_built_heritage_environment_id_p4009=rky_national_built_heritage_environment_id_p4009,
        permanent_building_number_vtj_prt_p3824=permanent_building_number_vtj_prt_p3824,
        protected_buildings_register_in_finland_building_id_p5313=protected_buildings_register_in_finland_building_id_p5313,
        helsinki_persistent_building_id_ratu_p8355=helsinki_persistent_building_id_ratu_p8355,
    )


def _resolve_sparql_image(image_value: str) -> tuple[str, str, str]:
    raw_value = image_value.strip()
    if not raw_value:
        return '', '', ''

    if raw_value.startswith('http://') or raw_value.startswith('https://'):
        image_url = raw_value
        if 'commons.wikimedia.org/wiki/Special:FilePath/' in image_url:
            separator = '&' if '?' in image_url else '?'
            image_thumb_url = f'{image_url}{separator}width={_COMMONS_THUMB_WIDTH}'
        else:
            image_thumb_url = image_url

        name_candidate = unquote(image_url.split('?', 1)[0].rstrip('/').rsplit('/', 1)[-1]).strip()
        if name_candidate.lower().startswith('file:'):
            name_candidate = name_candidate.split(':', 1)[1].strip()
        return image_url, image_thumb_url, name_candidate

    image_url = _commons_file_url(raw_value)
    image_thumb_url = _commons_thumbnail_url(raw_value)
    return image_url, image_thumb_url, raw_value


def _binding_value(binding: dict[str, Any], keys: list[str], default: str = '') -> str:
    for key in keys:
        entry = binding.get(key)
        if isinstance(entry, dict) and 'value' in entry:
            return str(entry['value'])
    return default


def _collect_linked_entities(
    bindings: list[dict[str, Any]],
    value_keys: list[str],
    label_keys: list[str],
    wikipedia_keys: list[str],
) -> list[dict[str, str]]:
    entities_by_key: dict[str, dict[str, str]] = {}
    ordered_keys: list[str] = []

    for binding in bindings:
        value = _binding_value(binding, value_keys, '').strip()
        label = _binding_value(binding, label_keys, '').strip()
        wikipedia_url = _binding_value(binding, wikipedia_keys, '').strip()
        if not value and not label and not wikipedia_url:
            continue

        dedupe_key = (value or label or wikipedia_url).lower()
        existing = entities_by_key.get(dedupe_key)
        if existing is None:
            entities_by_key[dedupe_key] = {
                'value': value,
                'label': label,
                'wikipedia_url': wikipedia_url,
            }
            ordered_keys.append(dedupe_key)
            continue

        if not existing.get('value') and value:
            existing['value'] = value
        if not existing.get('label') and label:
            existing['label'] = label
        if not existing.get('wikipedia_url') and wikipedia_url:
            existing['wikipedia_url'] = wikipedia_url

    return [entities_by_key[key] for key in ordered_keys]


def _apply_architect_values(item: dict[str, Any], bindings: list[dict[str, Any]]) -> dict[str, Any]:
    architect_values = _collect_linked_entities(
        bindings,
        ['architectP84', 'architect'],
        ['architectP84Label', 'architectLabel'],
        ['architectP84WikipediaUrl', 'architectWikipediaUrl'],
    )
    if not architect_values:
        return item

    enriched = dict(item)
    enriched['architect_p84_values'] = architect_values
    first_architect = architect_values[0]
    enriched['architect_p84'] = first_architect.get('value') or str(enriched.get('architect_p84') or '')
    enriched['architect_p84_label'] = first_architect.get('label') or str(enriched.get('architect_p84_label') or '')
    enriched['architect_p84_wikipedia_url'] = first_architect.get('wikipedia_url') or str(
        enriched.get('architect_p84_wikipedia_url') or ''
    )
    return enriched


def _parse_coord_to_lat_lon(coord_value: str) -> tuple[float, float] | None:
    # Accept WKT-style coordinates from e.g. wdt:P625:
    # "Point(lon lat)" or "<CRS_URI> Point(lon lat)"
    match = re.search(
        r'POINT\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*[,\s]\s*([+-]?\d+(?:\.\d+)?)\s*\)',
        coord_value,
        flags=re.IGNORECASE,
    )
    if not match:
        return None

    try:
        longitude = float(match.group(1))
        latitude = float(match.group(2))
    except ValueError:
        return None

    return latitude, longitude


def _resolve_wikidata_qid(
    label: str,
    lang: str | None = None,
    allow_fuzzy: bool = True,
) -> str:
    normalized_label = (label or '').strip()
    if not normalized_label:
        return ''

    fallback_lang = _language_fallbacks(lang, include_mul=False)[0]
    try:
        items = search_wikidata_entities(normalized_label, lang=fallback_lang, limit=8)
    except ExternalServiceError:
        return ''

    normalized_query = normalized_label.casefold()
    exact_match: str = ''
    for item in items:
        candidate_id = _extract_wikidata_qid(str(item.get('id') or ''))
        if not candidate_id:
            continue

        candidate_label = str(item.get('label') or '').strip().casefold()
        if candidate_label == normalized_query:
            return candidate_id

        if not exact_match:
            exact_match = candidate_id

    if allow_fuzzy and exact_match:
        return exact_match

    return ''


def _municipality_labels_from_address(address: dict[str, Any]) -> list[str]:
    raw_candidates = [
        address.get('municipality'),
        address.get('city'),
        address.get('town'),
        address.get('village'),
        address.get('hamlet'),
        address.get('suburb'),
        address.get('neighbourhood'),
        address.get('borough'),
        address.get('city_district'),
        address.get('county'),
        address.get('state_district'),
        address.get('region'),
    ]

    labels: list[str] = []
    seen: set[str] = set()
    for item in raw_candidates:
        label = str(item or '').strip()
        if not label:
            continue
        normalized = label.casefold()
        if normalized in seen:
            continue
        seen.add(normalized)
        labels.append(label)
    return labels


def reverse_geocode_places(latitude: float, longitude: float, lang: str | None = None) -> dict[str, dict[str, str] | None]:
    try:
        lat = float(latitude)
        lon = float(longitude)
    except (TypeError, ValueError):
        raise ExternalServiceError('Invalid coordinates provided for reverse geocoding.')

    payload = _external_json_get(
        _NOMINATIM_REVERSE_URL,
        {
            'format': 'jsonv2',
            'lat': lat,
            'lon': lon,
            'zoom': 10,
            'addressdetails': 1,
        },
    )

    error = payload.get('error')
    if error:
        message = str(error).strip()
        raise ExternalServiceError(f'Geocoding service error: {message or "unknown"}')

    address = payload.get('address')
    if not isinstance(address, dict):
        return {
            'country': None,
            'municipality': None,
        }

    country_name = str(address.get('country') or '').strip()
    municipality_candidates = _municipality_labels_from_address(address)
    municipality_name = municipality_candidates[0] if municipality_candidates else ''

    country_qid = _resolve_wikidata_qid(country_name, lang=lang) if country_name else ''
    municipality_qid = ''
    if municipality_name:
        municipality_qid = _resolve_wikidata_qid(municipality_name, lang=lang)
        if not municipality_qid and country_name:
            municipality_qid = _resolve_wikidata_qid(f'{municipality_name}, {country_name}', lang=lang)

    return {
        'country': (
            {'id': country_qid, 'label': country_name} if country_name and country_qid else None
        ),
        'municipality': (
            {'id': municipality_qid, 'label': municipality_name} if municipality_name and municipality_qid else None
        ),
    }


def _sparql_subject_uri(uri: str) -> str:
    value = uri.strip()
    if not value:
        return value

    entity_match = re.match(r'^https?://www\.wikidata\.org/entity/(Q\d+)$', value, flags=re.IGNORECASE)
    if entity_match:
        return f'http://www.wikidata.org/entity/{entity_match.group(1).upper()}'

    qid_match = re.match(r'^(Q\d+)$', value, flags=re.IGNORECASE)
    if qid_match:
        return f'http://www.wikidata.org/entity/{qid_match.group(1).upper()}'

    return value


def _normalized_wikidata_qids(values: list[str] | None = None) -> list[str]:
    if not values:
        return []

    unique_qids: set[str] = set()
    for value in values:
        qid = _extract_wikidata_qid(str(value or ''))
        if qid:
            unique_qids.add(qid)

    return sorted(unique_qids)


def _list_query(
    lang: str,
    limit: int,
    additional_wikidata_qids: list[str] | None = None,
    query_comment: str = '',
) -> str:
    safe_langs = _sparql_label_languages(lang).replace('"', '')
    wikipedia_site_url = _wikipedia_site_url(lang)
    normalized_additional_qids = _normalized_wikidata_qids(additional_wikidata_qids)

    item_selector = '?item wdt:P5008 wd:Q138299296 .'
    if normalized_additional_qids:
        values = ' '.join(f'wd:{qid}' for qid in normalized_additional_qids)
        item_selector = f'''
  {{
    ?item wdt:P5008 wd:Q138299296 .
  }}
  UNION
  {{
    VALUES ?item {{ {values} }}
  }}
'''

    optional_comment = f'{query_comment}\n' if query_comment else ''
    return f'''
{optional_comment}PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX schema: <http://schema.org/>

SELECT DISTINCT
  ?item ?coord ?itemLabel ?itemDescription ?dateModified ?commonsCategory ?imageName
  ?inceptionP571
  ?locationP276 ?locationP276Label ?locationP276WikipediaUrl
  ?architectP84 ?architectP84Label ?architectP84WikipediaUrl
  ?officialClosureDateP3999
  ?stateOfUseP5817 ?stateOfUseP5817Label ?stateOfUseP5817WikipediaUrl
  ?municipalityP131 ?municipalityP131Label ?municipalityP131WikipediaUrl
  ?addressTextP6375 ?postalCodeP281
  ?locatedOnStreetP669 ?locatedOnStreetP669Label ?locatedOnStreetP669WikipediaUrl ?houseNumberP670
  ?heritageDesignationP1435 ?heritageDesignationP1435Label ?heritageDesignationP1435WikipediaUrl
  ?instanceOfP31 ?instanceOfP31Label ?instanceOfP31WikipediaUrl
  ?architecturalStyleP149 ?architecturalStyleP149Label ?architecturalStyleP149WikipediaUrl
  ?routeInstructionP2795
  ?ysoIdP2347 ?yleTopicIdP8309 ?kantoIdP8980 ?protectedBuildingsRegisterInFinlandIdP5310
  ?rkyNationalBuiltHeritageEnvironmentIdP4009
  ?permanentBuildingNumberVtjPrtP3824 ?protectedBuildingsRegisterInFinlandBuildingIdP5313
  ?helsinkiPersistentBuildingIdRatuP8355
WHERE {{
  {item_selector}
  ?item wdt:P625 ?coord .
  OPTIONAL {{ ?item schema:dateModified ?dateModified . }}
  OPTIONAL {{ ?item wdt:P373 ?commonsCategory . }}
  OPTIONAL {{ ?item wdt:P18 ?imageName . }}
  OPTIONAL {{ ?item wdt:P571 ?inceptionP571 . }}
  OPTIONAL {{
    ?item wdt:P276 ?locationP276 .
    OPTIONAL {{
      ?locationP276WikipediaUrl schema:about ?locationP276 ;
                                schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{
    ?item wdt:P84 ?architectP84 .
    OPTIONAL {{
      ?architectP84WikipediaUrl schema:about ?architectP84 ;
                                schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{ ?item wdt:P3999 ?officialClosureDateP3999 . }}
  OPTIONAL {{
    ?item wdt:P5817 ?stateOfUseP5817 .
    OPTIONAL {{
      ?stateOfUseP5817WikipediaUrl schema:about ?stateOfUseP5817 ;
                                   schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{
    ?item wdt:P131 ?municipalityP131 .
    OPTIONAL {{
      ?municipalityP131WikipediaUrl schema:about ?municipalityP131 ;
                                    schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{ ?item wdt:P6375 ?addressTextP6375 . }}
  OPTIONAL {{ ?item wdt:P281 ?postalCodeP281 . }}
  OPTIONAL {{
    ?item p:P669 ?locatedOnStreetStatementP669 .
    ?locatedOnStreetStatementP669 ps:P669 ?locatedOnStreetP669 .
    OPTIONAL {{ ?locatedOnStreetStatementP669 pq:P670 ?houseNumberP670 . }}
    OPTIONAL {{
      ?locatedOnStreetP669WikipediaUrl schema:about ?locatedOnStreetP669 ;
                                       schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{
    ?item wdt:P1435 ?heritageDesignationP1435 .
    OPTIONAL {{
      ?heritageDesignationP1435WikipediaUrl schema:about ?heritageDesignationP1435 ;
                                            schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{
    ?item wdt:P31 ?instanceOfP31 .
    OPTIONAL {{
      ?instanceOfP31WikipediaUrl schema:about ?instanceOfP31 ;
                                 schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{
    ?item wdt:P149 ?architecturalStyleP149 .
    OPTIONAL {{
      ?architecturalStyleP149WikipediaUrl schema:about ?architecturalStyleP149 ;
                                          schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{ ?item wdt:P2795 ?routeInstructionP2795 . }}
  OPTIONAL {{ ?item wdt:P2347 ?ysoIdP2347 . }}
  OPTIONAL {{ ?item wdt:P8309 ?yleTopicIdP8309 . }}
  OPTIONAL {{ ?item wdt:P8980 ?kantoIdP8980 . }}
  OPTIONAL {{ ?item wdt:P5310 ?protectedBuildingsRegisterInFinlandIdP5310 . }}
  OPTIONAL {{ ?item wdt:P4009 ?rkyNationalBuiltHeritageEnvironmentIdP4009 . }}
  OPTIONAL {{ ?item wdt:P3824 ?permanentBuildingNumberVtjPrtP3824 . }}
  OPTIONAL {{ ?item wdt:P5313 ?protectedBuildingsRegisterInFinlandBuildingIdP5313 . }}
  OPTIONAL {{ ?item wdt:P8355 ?helsinkiPersistentBuildingIdRatuP8355 . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{safe_langs}". }}
}}
LIMIT {limit}
'''


def build_locations_sparql_query(
    lang: str | None = None,
    limit: int | None = None,
    additional_wikidata_qids: list[str] | None = None,
    query_comment: str = '',
) -> str:
    query_limit = limit or settings.SPARQL_DEFAULT_LIMIT
    normalized_additional_qids = _normalized_wikidata_qids(additional_wikidata_qids)
    fallbacks = _language_fallbacks(lang, include_mul=False)
    query_lang = fallbacks[0] if fallbacks else 'en'
    return _list_query(
        query_lang,
        query_limit,
        additional_wikidata_qids=normalized_additional_qids,
        query_comment=query_comment,
    )


def _detail_query(uri: str, lang: str) -> str:
    safe_uri = _sparql_subject_uri(uri).replace('>', '%3E')
    safe_langs = _sparql_label_languages(lang).replace('"', '')
    wikipedia_site_url = _wikipedia_site_url(lang)
    return f'''
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX schema: <http://schema.org/>

SELECT DISTINCT
  ?item ?coord ?itemLabel ?itemDescription ?dateModified ?commonsCategory ?imageName
  ?inceptionP571
  ?locationP276 ?locationP276Label ?locationP276WikipediaUrl
  ?architectP84 ?architectP84Label ?architectP84WikipediaUrl
  ?officialClosureDateP3999
  ?stateOfUseP5817 ?stateOfUseP5817Label ?stateOfUseP5817WikipediaUrl
  ?municipalityP131 ?municipalityP131Label ?municipalityP131WikipediaUrl
  ?addressTextP6375 ?postalCodeP281
  ?locatedOnStreetP669 ?locatedOnStreetP669Label ?locatedOnStreetP669WikipediaUrl ?houseNumberP670
  ?heritageDesignationP1435 ?heritageDesignationP1435Label ?heritageDesignationP1435WikipediaUrl
  ?instanceOfP31 ?instanceOfP31Label ?instanceOfP31WikipediaUrl
  ?architecturalStyleP149 ?architecturalStyleP149Label ?architecturalStyleP149WikipediaUrl
  ?routeInstructionP2795
  ?ysoIdP2347 ?yleTopicIdP8309 ?kantoIdP8980 ?protectedBuildingsRegisterInFinlandIdP5310
  ?rkyNationalBuiltHeritageEnvironmentIdP4009
  ?permanentBuildingNumberVtjPrtP3824 ?protectedBuildingsRegisterInFinlandBuildingIdP5313
  ?helsinkiPersistentBuildingIdRatuP8355
WHERE {{
  VALUES ?item {{ <{safe_uri}> }}
  ?item wdt:P625 ?coord .
  OPTIONAL {{ ?item schema:dateModified ?dateModified . }}
  OPTIONAL {{ ?item wdt:P373 ?commonsCategory . }}
  OPTIONAL {{ ?item wdt:P18 ?imageName . }}
  OPTIONAL {{ ?item wdt:P571 ?inceptionP571 . }}
  OPTIONAL {{
    ?item wdt:P276 ?locationP276 .
    OPTIONAL {{
      ?locationP276WikipediaUrl schema:about ?locationP276 ;
                                schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{
    ?item wdt:P84 ?architectP84 .
    OPTIONAL {{
      ?architectP84WikipediaUrl schema:about ?architectP84 ;
                                schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{ ?item wdt:P3999 ?officialClosureDateP3999 . }}
  OPTIONAL {{
    ?item wdt:P5817 ?stateOfUseP5817 .
    OPTIONAL {{
      ?stateOfUseP5817WikipediaUrl schema:about ?stateOfUseP5817 ;
                                   schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{
    ?item wdt:P131 ?municipalityP131 .
    OPTIONAL {{
      ?municipalityP131WikipediaUrl schema:about ?municipalityP131 ;
                                    schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{ ?item wdt:P6375 ?addressTextP6375 . }}
  OPTIONAL {{ ?item wdt:P281 ?postalCodeP281 . }}
  OPTIONAL {{
    ?item p:P669 ?locatedOnStreetStatementP669 .
    ?locatedOnStreetStatementP669 ps:P669 ?locatedOnStreetP669 .
    OPTIONAL {{ ?locatedOnStreetStatementP669 pq:P670 ?houseNumberP670 . }}
    OPTIONAL {{
      ?locatedOnStreetP669WikipediaUrl schema:about ?locatedOnStreetP669 ;
                                       schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{
    ?item wdt:P1435 ?heritageDesignationP1435 .
    OPTIONAL {{
      ?heritageDesignationP1435WikipediaUrl schema:about ?heritageDesignationP1435 ;
                                            schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{
    ?item wdt:P31 ?instanceOfP31 .
    OPTIONAL {{
      ?instanceOfP31WikipediaUrl schema:about ?instanceOfP31 ;
                                 schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{
    ?item wdt:P149 ?architecturalStyleP149 .
    OPTIONAL {{
      ?architecturalStyleP149WikipediaUrl schema:about ?architecturalStyleP149 ;
                                          schema:isPartOf <{wikipedia_site_url}> .
    }}
  }}
  OPTIONAL {{ ?item wdt:P2795 ?routeInstructionP2795 . }}
  OPTIONAL {{ ?item wdt:P2347 ?ysoIdP2347 . }}
  OPTIONAL {{ ?item wdt:P8309 ?yleTopicIdP8309 . }}
  OPTIONAL {{ ?item wdt:P8980 ?kantoIdP8980 . }}
  OPTIONAL {{ ?item wdt:P5310 ?protectedBuildingsRegisterInFinlandIdP5310 . }}
  OPTIONAL {{ ?item wdt:P4009 ?rkyNationalBuiltHeritageEnvironmentIdP4009 . }}
  OPTIONAL {{ ?item wdt:P3824 ?permanentBuildingNumberVtjPrtP3824 . }}
  OPTIONAL {{ ?item wdt:P5313 ?protectedBuildingsRegisterInFinlandBuildingIdP5313 . }}
  OPTIONAL {{ ?item wdt:P8355 ?helsinkiPersistentBuildingIdRatuP8355 . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{safe_langs}". }}
}}
'''


def _children_query(uri: str, lang: str, limit: int) -> str:
    safe_uri = uri.replace('>', '%3E')
    safe_langs = _sparql_label_languages(lang).replace('"', '')
    return f'''
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>

SELECT DISTINCT ?subitem ?subitemLabel ?commonsCategory
WHERE {{
  VALUES ?item {{ <{safe_uri}> }}
  {{
    ?subitem wdt:P361 ?item .
  }}
  UNION
  {{
    ?item wdt:P527 ?subitem .
  }}
  OPTIONAL {{ ?subitem wdt:P373 ?commonsCategory . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{safe_langs}". }}
}}
LIMIT {limit}
'''


def fetch_locations(
    lang: str | None = None,
    limit: int | None = None,
    additional_wikidata_qids: list[str] | None = None,
    query_comment: str = '',
) -> list[dict[str, Any]]:
    query_limit = limit or settings.SPARQL_DEFAULT_LIMIT
    normalized_additional_qids = _normalized_wikidata_qids(additional_wikidata_qids)
    fallbacks = _language_fallbacks(lang, include_mul=False)
    bindings: list[dict[str, Any]] = []
    last_error: SPARQLServiceError | None = None
    had_successful_query = False
    for fallback_lang in fallbacks:
        try:
            bindings = _query_sparql(
                _list_query(
                    fallback_lang,
                    query_limit,
                    additional_wikidata_qids=normalized_additional_qids,
                    query_comment=query_comment,
                )
            )
        except SPARQLServiceError as exc:
            last_error = exc
            continue
        had_successful_query = True
        if bindings:
            break

    if bindings:
        formatted_by_uri: dict[str, dict[str, Any]] = {}
        bindings_by_uri: dict[str, list[dict[str, Any]]] = {}
        for binding in bindings:
            try:
                item = _format_binding(binding).__dict__
            except SPARQLServiceError:
                continue
            uri = str(item.get('uri') or '').strip()
            if not uri:
                continue
            if uri not in formatted_by_uri:
                formatted_by_uri[uri] = item
                bindings_by_uri[uri] = []
            bindings_by_uri[uri].append(binding)

        merged_items: list[dict[str, Any]] = []
        for uri, item in formatted_by_uri.items():
            merged_items.append(_apply_architect_values(item, bindings_by_uri.get(uri, [])))

        return merged_items

    if last_error is not None and not had_successful_query:
        raise last_error

    return []


def fetch_location_detail(
    uri: str,
    lang: str | None = None,
) -> dict[str, Any] | None:
    fallbacks = _language_fallbacks(lang, include_mul=False)
    bindings: list[dict[str, Any]] = []
    last_error: SPARQLServiceError | None = None
    had_successful_query = False
    for fallback_lang in fallbacks:
        try:
            bindings = _query_sparql(_detail_query(uri, fallback_lang))
        except SPARQLServiceError as exc:
            last_error = exc
            continue
        had_successful_query = True
        if bindings:
            break

    if bindings:
        formatted_by_uri: dict[str, dict[str, Any]] = {}
        bindings_by_uri: dict[str, list[dict[str, Any]]] = {}
        for binding in bindings:
            try:
                item = _format_binding(binding).__dict__
            except SPARQLServiceError:
                continue
            normalized_uri = str(item.get('uri') or '').strip()
            if not normalized_uri:
                continue
            if normalized_uri not in formatted_by_uri:
                formatted_by_uri[normalized_uri] = item
                bindings_by_uri[normalized_uri] = []
            bindings_by_uri[normalized_uri].append(binding)

        if not formatted_by_uri:
            return None

        first_uri = next(iter(formatted_by_uri))
        first_item = formatted_by_uri[first_uri]
        return _apply_architect_values(first_item, bindings_by_uri.get(first_uri, []))

    if last_error is not None and not had_successful_query:
        raise last_error

    return None


def fetch_location_children(
    uri: str,
    lang: str | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    query_limit = max(1, int(limit or settings.SPARQL_DEFAULT_LIMIT))
    fallbacks = _language_fallbacks(lang, include_mul=False)
    bindings: list[dict[str, Any]] = []
    last_error: SPARQLServiceError | None = None
    had_successful_query = False
    for fallback_lang in fallbacks:
        try:
            bindings = _query_sparql(_children_query(uri, fallback_lang, query_limit))
        except SPARQLServiceError as exc:
            last_error = exc
            continue
        had_successful_query = True
        if bindings:
            break

    if bindings:
        children_by_uri: dict[str, dict[str, Any]] = {}
        for binding in bindings:
            child_uri = _binding_value(binding, ['subitem', 'item', 'uri'])
            if not child_uri:
                continue
            child_label = _binding_value(binding, ['subitemLabel', 'itemLabel', 'label'])
            if not child_label:
                child_label = child_uri.rsplit('/', 1)[-1].replace('_', ' ')
            child_commons_category = _normalize_commons_category(
                _binding_value(binding, ['commonsCategory', 'commons_category'], '')
            )
            if child_uri in children_by_uri:
                continue
            child_item = {
                'id': encode_location_id(child_uri),
                'uri': child_uri,
                'name': child_label,
                'source': 'sparql',
            }
            if child_commons_category:
                child_item['commons_category'] = child_commons_category
            children_by_uri[child_uri] = child_item
        return list(children_by_uri.values())

    if last_error is not None and not had_successful_query:
        raise last_error

    return []


def fetch_commons_subcategory_children(
    category_name: str,
    limit: int = 200,
) -> list[dict[str, Any]]:
    normalized_parent = _normalize_commons_category(category_name)
    if not normalized_parent:
        return []

    requested_limit = max(1, min(int(limit), 500))
    parent_title = f'Category:{normalized_parent}'.replace(' ', '_')
    seen_categories: set[str] = set()
    results: list[dict[str, Any]] = []
    cmcontinue: str | None = None

    while len(results) < requested_limit:
        params: dict[str, Any] = {
            'action': 'query',
            'list': 'categorymembers',
            'cmtitle': parent_title,
            'cmtype': 'subcat',
            'cmlimit': min(500, requested_limit - len(results)),
            'format': 'json',
        }
        if cmcontinue:
            params['cmcontinue'] = cmcontinue

        payload = _external_json_get(_COMMONS_API_URL, params)
        query_payload = payload.get('query', {})
        if not isinstance(query_payload, dict):
            break

        members = query_payload.get('categorymembers', [])
        if not isinstance(members, list):
            break

        for item in members:
            if not isinstance(item, dict):
                continue
            title = str(item.get('title') or '').strip()
            if not title:
                continue

            subcategory_name = _normalize_commons_category(title)
            if not subcategory_name:
                continue

            category_key = subcategory_name.lower()
            if category_key in seen_categories:
                continue

            seen_categories.add(category_key)
            wiki_title = f'Category:{subcategory_name}'.replace(' ', '_')
            subcategory_uri = f'https://commons.wikimedia.org/wiki/{quote(wiki_title, safe=":/")}'
            results.append(
                {
                    'id': encode_location_id(subcategory_uri),
                    'uri': subcategory_uri,
                    'name': subcategory_name,
                    'source': 'commons',
                    'commons_category': subcategory_name,
                }
            )

            if len(results) >= requested_limit:
                break

        if len(results) >= requested_limit:
            break

        continue_payload = payload.get('continue', {})
        if not isinstance(continue_payload, dict):
            break
        next_continue = continue_payload.get('cmcontinue')
        if not isinstance(next_continue, str) or not next_continue:
            break
        cmcontinue = next_continue

    return results


def _external_timeout_seconds() -> int:
    return int(getattr(settings, 'SPARQL_TIMEOUT_SECONDS', 15))


def _external_json_get(url: str, params: dict[str, Any]) -> dict[str, Any]:
    request_started_at = perf_counter()
    request_url = str(url or '')
    try:
        response = requests.get(
            url,
            params=params,
            headers={
                'Accept': 'application/json',
                'User-Agent': 'LocationsExplorer/1.0 (+https://localhost)',
            },
            timeout=_external_timeout_seconds(),
        )
        request_url = str(getattr(response, 'url', '') or request_url)
        response.raise_for_status()
    except requests.RequestException as exc:
        _list_render_debug_log_external_fetch(
            source='external-json',
            url=request_url,
            started_at=request_started_at,
            error=exc,
        )
        raise ExternalServiceError(f'External request failed: {exc}') from exc
    _list_render_debug_log_external_fetch(
        source='external-json',
        url=request_url,
        started_at=request_started_at,
    )

    try:
        payload = response.json()
    except ValueError as exc:
        preview = response.text[:200].replace('\n', ' ').strip()
        raise ExternalServiceError(f'External service did not return JSON. preview={preview!r}') from exc

    if not isinstance(payload, dict):
        raise ExternalServiceError('External service returned unexpected payload.')

    return payload


def _clean_citoid_text(value: Any) -> str:
    if value is None:
        return ''
    text = str(value).strip()
    if not text:
        return ''
    without_tags = re.sub(r'<[^>]+>', ' ', text)
    return re.sub(r'\s+', ' ', without_tags).strip()


def _citoid_author_text(value: Any) -> str:
    raw_items = value if isinstance(value, list) else [value]
    parts: list[str] = []
    for raw_item in raw_items:
        if isinstance(raw_item, str):
            normalized = _clean_citoid_text(raw_item)
            if normalized:
                parts.append(normalized)
            continue
        if not isinstance(raw_item, dict):
            continue

        literal = _clean_citoid_text(
            raw_item.get('literal') or raw_item.get('name') or raw_item.get('family') or ''
        )
        if not literal:
            given = _clean_citoid_text(raw_item.get('given') or raw_item.get('givenName') or '')
            family = _clean_citoid_text(raw_item.get('family') or raw_item.get('familyName') or '')
            literal = _clean_citoid_text(f'{given} {family}'.strip())
        if literal:
            parts.append(literal)

    unique_parts: list[str] = []
    for item in parts:
        if item not in unique_parts:
            unique_parts.append(item)
    return ', '.join(unique_parts)


def _citoid_normalized_publication_date(value: Any) -> str:
    if isinstance(value, list) and value:
        return _citoid_normalized_publication_date(value[0])
    if isinstance(value, dict):
        for key in ('raw', 'literal', 'value', 'date'):
            normalized = _citoid_normalized_publication_date(value.get(key))
            if normalized:
                return normalized
        return ''

    raw_value = _clean_citoid_text(value)
    if not raw_value:
        return ''
    for pattern in (r'\d{4}-\d{2}-\d{2}', r'\d{4}-\d{2}', r'\d{4}'):
        match = re.search(pattern, raw_value)
        if match:
            return match.group(0)
    return ''


def _first_citoid_item(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                return item
    return {}


def fetch_citoid_metadata(source_url: str, lang: str | None = None) -> dict[str, str]:
    normalized_url = str(source_url or '').strip()
    if not normalized_url.startswith('http://') and not normalized_url.startswith('https://'):
        raise ExternalServiceError('A valid source URL is required.')

    encoded_url = quote(normalized_url, safe='')
    request_url = f'{_CITOID_REST_API_URL}{encoded_url}'
    request_started_at = perf_counter()
    try:
        response = requests.get(
            request_url,
            headers={
                'Accept': 'application/json',
                'User-Agent': 'LocationsExplorer/1.0 (+https://localhost)',
            },
            timeout=_external_timeout_seconds(),
        )
        request_url = str(getattr(response, 'url', '') or request_url)
        response.raise_for_status()
    except requests.RequestException as exc:
        _list_render_debug_log_external_fetch(
            source='citoid',
            url=request_url,
            started_at=request_started_at,
            error=exc,
        )
        raise ExternalServiceError(f'Citoid request failed: {exc}') from exc
    _list_render_debug_log_external_fetch(
        source='citoid',
        url=request_url,
        started_at=request_started_at,
    )

    try:
        payload = response.json()
    except ValueError as exc:
        preview = response.text[:200].replace('\n', ' ').strip()
        raise ExternalServiceError(f'Citoid service did not return JSON. preview={preview!r}') from exc

    item = _first_citoid_item(payload)
    if not item:
        raise ExternalServiceError('Citoid did not return metadata for this URL.')

    title = _clean_citoid_text(item.get('title') or item.get('headline') or '')
    author = _citoid_author_text(item.get('author'))
    publication_date = _citoid_normalized_publication_date(
        item.get('date')
        or item.get('issued')
        or item.get('published')
        or item.get('publication_date')
    )
    source_lang = _wikidata_language_code(
        _clean_citoid_text(item.get('language') or item.get('lang') or ''),
        fallback=_wikidata_language_code(str(lang or ''), fallback='en'),
    )

    return {
        'source_url': normalized_url,
        'source_title': title,
        'source_title_language': source_lang,
        'source_author': author,
        'source_publication_date': publication_date,
        'source_published_in_p1433': '',
        'source_language_of_work_p407': '',
    }


def _extract_wikidata_qid(value: str) -> str:
    match = re.search(r'(Q\d+)', value, flags=re.IGNORECASE)
    if not match:
        return ''
    return match.group(1).upper()


def _label_for_language(value_map: dict[str, Any], fallbacks: list[str]) -> str:
    for lang in fallbacks:
        entry = value_map.get(lang)
        if isinstance(entry, dict):
            label = entry.get('value')
            if label:
                return str(label)
    for entry in value_map.values():
        if isinstance(entry, dict):
            label = entry.get('value')
            if label:
                return str(label)
    return ''


def _entity_id_from_claim_value(value: Any) -> str:
    if not isinstance(value, dict):
        return ''
    direct_id = value.get('id')
    if isinstance(direct_id, str) and direct_id:
        return direct_id.upper()
    numeric_id = value.get('numeric-id')
    if isinstance(numeric_id, int):
        return f'Q{numeric_id}'
    return ''


def _first_claim_datavalue(claims: dict[str, Any], property_id: str) -> Any:
    entries = claims.get(property_id)
    if not isinstance(entries, list):
        return None

    for entry in entries:
        mainsnak = entry.get('mainsnak', {}) if isinstance(entry, dict) else {}
        datavalue = mainsnak.get('datavalue', {}) if isinstance(mainsnak, dict) else {}
        if isinstance(datavalue, dict) and 'value' in datavalue:
            return datavalue['value']
    return None


def _claim_entity_ids(claims: dict[str, Any], property_id: str) -> list[str]:
    entries = claims.get(property_id)
    if not isinstance(entries, list):
        return []

    entity_ids: list[str] = []
    seen_ids: set[str] = set()
    for entry in entries:
        mainsnak = entry.get('mainsnak', {}) if isinstance(entry, dict) else {}
        datavalue = mainsnak.get('datavalue', {}) if isinstance(mainsnak, dict) else {}
        value = datavalue.get('value') if isinstance(datavalue, dict) else None
        entity_id = _entity_id_from_claim_value(value)
        if not entity_id:
            continue
        if entity_id in seen_ids:
            continue
        seen_ids.add(entity_id)
        entity_ids.append(entity_id)

    return entity_ids


def _string_from_claim_value(value: Any, fallbacks: list[str] | None = None) -> str:
    if isinstance(value, str):
        return value.strip()

    if isinstance(value, dict):
        text_value = value.get('text')
        if isinstance(text_value, str):
            return text_value.strip()

        entity_id = _entity_id_from_claim_value(value)
        if entity_id:
            return entity_id

    return ''


def _first_claim_string(claims: dict[str, Any], property_id: str, fallbacks: list[str] | None = None) -> str:
    entries = claims.get(property_id)
    if not isinstance(entries, list):
        return ''

    monolingual_candidates: list[tuple[str, str]] = []

    for entry in entries:
        mainsnak = entry.get('mainsnak', {}) if isinstance(entry, dict) else {}
        datavalue = mainsnak.get('datavalue', {}) if isinstance(mainsnak, dict) else {}
        if not isinstance(datavalue, dict):
            continue

        value = datavalue.get('value')
        if isinstance(value, dict) and isinstance(value.get('text'), str):
            language = str(value.get('language') or '').lower()
            monolingual_candidates.append((language, value['text'].strip()))
            continue

        text = _string_from_claim_value(value, fallbacks=fallbacks)
        if text:
            return text

    if fallbacks:
        fallback_set = [lang.lower() for lang in fallbacks]
        for lang in fallback_set:
            for candidate_lang, candidate_text in monolingual_candidates:
                if candidate_lang == lang and candidate_text:
                    return candidate_text

    for _, candidate_text in monolingual_candidates:
        if candidate_text:
            return candidate_text

    return ''


def _commons_file_url(filename: str) -> str:
    normalized = filename.strip()
    if not normalized:
        return ''

    if normalized.lower().startswith('file:'):
        normalized = normalized.split(':', 1)[1].strip()

    if not normalized:
        return ''

    normalized = normalized.replace(' ', '_')
    encoded_name = quote(normalized, safe='')
    return f'https://commons.wikimedia.org/wiki/Special:FilePath/{encoded_name}'


def _commons_thumbnail_url(filename: str, width: int = _COMMONS_THUMB_WIDTH) -> str:
    base_url = _commons_file_url(filename)
    if not base_url:
        return ''

    thumb_width = width if width > 0 else _COMMONS_THUMB_WIDTH
    return f'{base_url}?width={thumb_width}'


def _normalize_commons_category(value: str) -> str:
    category = value.strip()
    if not category:
        return ''

    if category.lower().startswith('category:'):
        category = category.split(':', 1)[1].strip()

    category = category.replace('_', ' ')
    category = re.sub(r'\s+', ' ', category)
    return category


def _petscan_category_value(category_name: str) -> str:
    normalized = _normalize_commons_category(category_name)
    if not normalized:
        return ''
    return normalized.replace(' ', '_')


def _commons_category_url(category_name: str) -> str:
    normalized = _normalize_commons_category(category_name)
    if not normalized:
        return ''

    title = f'Category:{normalized}'.replace(' ', '_')
    return f'https://commons.wikimedia.org/wiki/{quote(title, safe=":/")}'


def _view_it_url(qid: str) -> str:
    normalized = _extract_wikidata_qid(qid)
    if not normalized:
        return ''
    return f'https://view-it.toolforge.org/?q={quote(normalized, safe="")}'


def _image_count_cache_ttl_seconds() -> int:
    raw_value = getattr(settings, 'IMAGE_COUNT_CACHE_TTL_SECONDS', 86400)
    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        return 86400
    return parsed if parsed > 0 else 0


def _image_count_cache_cutoff(now_value):
    ttl_seconds = _image_count_cache_ttl_seconds()
    if ttl_seconds <= 0:
        return None
    return now_value - timedelta(seconds=ttl_seconds)


def _is_cache_entry_fresh(fetched_at, cutoff) -> bool:
    if cutoff is None:
        return True
    if fetched_at is None:
        return False
    return fetched_at >= cutoff


def _parse_non_negative_int(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = int(str(value))
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return 0
    return parsed


def _petscan_count_from_payload(payload: dict[str, Any]) -> int:
    top_level_count = None
    for key in ('n', 'count', 'total', 'pages'):
        candidate = _parse_non_negative_int(payload.get(key))
        if candidate is not None:
            top_level_count = candidate
            break

    sections = payload.get('*')
    if not isinstance(sections, list):
        if top_level_count is not None:
            return top_level_count
        raise ExternalServiceError('PetScan payload was missing results.')

    explicit_count_total = 0
    found_explicit_count = False
    page_count_total = 0
    found_page_lists = False

    for section in sections:
        if not isinstance(section, dict):
            continue

        article_bucket = section.get('a')
        if isinstance(article_bucket, dict):
            for count_key in ('n', 'count', 'total', 'pages'):
                candidate = _parse_non_negative_int(article_bucket.get(count_key))
                if candidate is not None:
                    explicit_count_total += candidate
                    found_explicit_count = True
                    break

            pages = article_bucket.get('*')
            if isinstance(pages, list):
                page_count_total += len(pages)
                found_page_lists = True
                continue

        for count_key in ('n', 'count', 'total', 'pages'):
            candidate = _parse_non_negative_int(section.get(count_key))
            if candidate is not None:
                explicit_count_total += candidate
                found_explicit_count = True
                break

    if found_explicit_count:
        return explicit_count_total
    if found_page_lists:
        return page_count_total
    if top_level_count is not None:
        return top_level_count

    raise ExternalServiceError('PetScan payload did not include image count fields.')


def _fetch_petscan_image_count(category_name: str) -> int:
    normalized_category = _normalize_commons_category(category_name)
    if not normalized_category:
        return 0
    petscan_category = _petscan_category_value(normalized_category)

    payload = _external_json_get(
        _PETSCAN_API_URL,
        {
            'project': 'wikimedia',
            'language': 'commons',
            'categories': petscan_category,
            'depth': _PETSCAN_DEPTH,
            'format': 'json',
            'output_compatability': 'catscan',
            'search_max_results': 500,
            'ns[6]': '1',
            'doit': '1',
        },
    )
    return _petscan_count_from_payload(payload)


def _fetch_view_it_image_count(qid: str) -> int:
    normalized_qid = _extract_wikidata_qid(qid)
    if not normalized_qid:
        return 0

    payload = _external_json_get(f'{_VIEW_IT_API_BASE_URL}/{normalized_qid}', {})
    total = _parse_non_negative_int(payload.get('total'))
    if total is not None:
        return total

    results = payload.get('results')
    if isinstance(results, list):
        return len(results)

    raise ExternalServiceError('View-it payload did not include total image count.')


def _run_refresh_job(refresh_fn, key: str) -> None:
    close_old_connections()
    try:
        refresh_fn(key)
    finally:
        close_old_connections()


def _refresh_commons_image_count(category_name: str) -> None:
    try:
        image_count = _fetch_petscan_image_count(category_name)
    except ExternalServiceError:
        return

    CommonsCategoryImageCountCache.objects.update_or_create(
        category_name=category_name,
        defaults={
            'image_count': image_count,
            'fetched_at': timezone.now(),
        },
    )


def _refresh_view_it_image_count(wikidata_qid: str) -> None:
    try:
        image_count = _fetch_view_it_image_count(wikidata_qid)
    except ExternalServiceError:
        return

    ViewItImageCountCache.objects.update_or_create(
        wikidata_qid=wikidata_qid,
        defaults={
            'image_count': image_count,
            'fetched_at': timezone.now(),
        },
    )


def _cleanup_pending_refresh(
    _future,
    *,
    pending_set: set[str],
    refresh_key: str,
) -> None:
    with _IMAGE_COUNT_REFRESH_LOCK:
        pending_set.discard(refresh_key)


def _submit_refresh(
    refresh_key: str,
    *,
    pending_set: set[str],
    refresh_fn,
) -> None:
    with _IMAGE_COUNT_REFRESH_LOCK:
        if refresh_key in pending_set:
            return
        pending_set.add(refresh_key)

    try:
        future = _IMAGE_COUNT_REFRESH_EXECUTOR.submit(_run_refresh_job, refresh_fn, refresh_key)
    except RuntimeError:
        with _IMAGE_COUNT_REFRESH_LOCK:
            pending_set.discard(refresh_key)
        return

    future.add_done_callback(
        partial(_cleanup_pending_refresh, pending_set=pending_set, refresh_key=refresh_key)
    )


def _queue_image_count_refresh(
    *,
    stale_categories: set[str],
    stale_qids: set[str],
) -> None:
    if not stale_categories and not stale_qids:
        return

    for category in sorted(stale_categories):
        _submit_refresh(
            category,
            pending_set=_PENDING_COMMONS_IMAGE_COUNT_REFRESHES,
            refresh_fn=_refresh_commons_image_count,
        )

    for qid in sorted(stale_qids):
        _submit_refresh(
            qid,
            pending_set=_PENDING_VIEW_IT_IMAGE_COUNT_REFRESHES,
            refresh_fn=_refresh_view_it_image_count,
        )


def _commons_counts_for_categories(categories: set[str]) -> tuple[dict[str, int], set[str]]:
    normalized_set: set[str] = set()
    for category in categories:
        normalized = _normalize_commons_category(category)
        if normalized:
            normalized_set.add(normalized)
    normalized_categories = sorted(normalized_set)
    if not normalized_categories:
        return {}, set()

    now_value = timezone.now()
    cutoff = _image_count_cache_cutoff(now_value)
    cache_entries = {
        entry.category_name: entry
        for entry in CommonsCategoryImageCountCache.objects.filter(category_name__in=normalized_categories)
    }

    counts: dict[str, int] = {}
    stale_categories: set[str] = set()
    for category in normalized_categories:
        cache_entry = cache_entries.get(category)
        if cache_entry is not None:
            counts[category] = cache_entry.image_count
        if cache_entry is None or not _is_cache_entry_fresh(cache_entry.fetched_at, cutoff):
            stale_categories.add(category)

    return counts, stale_categories


def _view_it_counts_for_qids(qids: set[str]) -> tuple[dict[str, int], set[str]]:
    normalized_set: set[str] = set()
    for qid in qids:
        normalized = _extract_wikidata_qid(qid)
        if normalized:
            normalized_set.add(normalized)
    normalized_qids = sorted(normalized_set)
    if not normalized_qids:
        return {}, set()

    now_value = timezone.now()
    cutoff = _image_count_cache_cutoff(now_value)
    cache_entries = {
        entry.wikidata_qid: entry
        for entry in ViewItImageCountCache.objects.filter(wikidata_qid__in=normalized_qids)
    }

    counts: dict[str, int] = {}
    stale_qids: set[str] = set()
    for qid in normalized_qids:
        cache_entry = cache_entries.get(qid)
        if cache_entry is not None:
            counts[qid] = cache_entry.image_count
        if cache_entry is None or not _is_cache_entry_fresh(cache_entry.fetched_at, cutoff):
            stale_qids.add(qid)

    return counts, stale_qids


def enrich_locations_with_image_counts(locations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not locations:
        return locations

    normalized_categories: set[str] = set()
    normalized_qids: set[str] = set()
    category_by_position: dict[int, str] = {}
    qid_by_position: dict[int, str] = {}

    for index, location in enumerate(locations):
        if not isinstance(location, dict):
            continue

        category = _normalize_commons_category(str(location.get('commons_category') or ''))
        if category:
            normalized_categories.add(category)
            category_by_position[index] = category

        wikidata_qid = _extract_wikidata_qid(str(location.get('wikidata_item') or ''))
        if not wikidata_qid:
            wikidata_qid = _extract_wikidata_qid(str(location.get('uri') or ''))
        if wikidata_qid:
            normalized_qids.add(wikidata_qid)
            qid_by_position[index] = wikidata_qid

    commons_counts, stale_categories = _commons_counts_for_categories(normalized_categories)
    view_it_counts, stale_qids = _view_it_counts_for_qids(normalized_qids)
    _queue_image_count_refresh(
        stale_categories=stale_categories,
        stale_qids=stale_qids,
    )

    enriched_locations: list[dict[str, Any]] = []
    for index, location in enumerate(locations):
        if not isinstance(location, dict):
            enriched_locations.append(location)
            continue

        enriched = dict(location)
        category = category_by_position.get(index)
        if category:
            enriched['commons_category'] = category
            enriched['commons_category_url'] = _commons_category_url(category)
            enriched['commons_image_count_petscan'] = commons_counts.get(category)

        qid = qid_by_position.get(index)
        if qid:
            enriched['view_it_qid'] = qid
            enriched['view_it_url'] = _view_it_url(qid)
            enriched['view_it_image_count'] = view_it_counts.get(qid)

        enriched_locations.append(enriched)

    return enriched_locations


def _wikidata_labels_for_ids(entity_ids: list[str], fallbacks: list[str]) -> dict[str, str]:
    if not entity_ids:
        return {}

    unique_ids = sorted({entity_id.upper() for entity_id in entity_ids if entity_id})
    if not unique_ids:
        return {}

    payload = _external_json_get(
        _WIKIDATA_API_URL,
        {
            'action': 'wbgetentities',
            'ids': '|'.join(unique_ids),
            'props': 'labels',
            'languages': '|'.join(fallbacks),
            'format': 'json',
        },
    )

    entities = payload.get('entities', {})
    if not isinstance(entities, dict):
        return {}

    labels: dict[str, str] = {}
    for entity_id in unique_ids:
        entity = entities.get(entity_id, {})
        if not isinstance(entity, dict):
            continue
        label = _label_for_language(entity.get('labels', {}), fallbacks)
        if label:
            labels[entity_id] = label
    return labels


def _wikidata_oauth_credentials(
    oauth_token: str = '',
    oauth_token_secret: str = '',
) -> tuple[str, str, str, str]:
    consumer_key = str(getattr(settings, 'SOCIAL_AUTH_MEDIAWIKI_KEY', '') or '').strip()
    consumer_secret = str(getattr(settings, 'SOCIAL_AUTH_MEDIAWIKI_SECRET', '') or '').strip()
    access_token = str(oauth_token or '').strip()
    access_token_secret = str(oauth_token_secret or '').strip()
    if not consumer_key or not consumer_secret:
        raise WikidataWriteError(
            'Wikimedia OAuth is not configured. '
            'Set SOCIAL_AUTH_MEDIAWIKI_KEY and SOCIAL_AUTH_MEDIAWIKI_SECRET.'
        )
    if not access_token or not access_token_secret:
        raise WikidataWriteError(
            'Wikimedia OAuth credentials are missing for this session. '
            'Sign in with Wikimedia OAuth before editing Wikidata.'
        )
    return consumer_key, consumer_secret, access_token, access_token_secret


def _local_dev_access_token_enabled() -> bool:
    if not getattr(settings, 'DEBUG', False):
        return False
    access_token = str(getattr(settings, 'LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN', '') or '').strip()
    access_token_secret = str(getattr(settings, 'LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET', '') or '').strip()
    return bool(access_token and access_token_secret)


def _wikidata_local_dev_access_token_credentials() -> tuple[str, str]:
    if not _local_dev_access_token_enabled():
        raise WikidataWriteError(
            'Wikidata local access token authentication is not configured. '
            'Set LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN and LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET.'
        )

    access_token = str(getattr(settings, 'LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN', '') or '').strip()
    access_token_secret = str(getattr(settings, 'LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET', '') or '').strip()
    return access_token, access_token_secret


def _wikidata_api_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            'Accept': 'application/json',
            'User-Agent': 'LocationsExplorer/1.0 (+https://localhost)',
        }
    )
    return session


def _wikidata_csrf_token(session: requests.Session) -> str:
    csrf_token_payload = _wikidata_api_get(
        session,
        {
            'action': 'query',
            'meta': 'tokens',
            'type': 'csrf',
            'format': 'json',
        },
    )
    csrf_query = csrf_token_payload.get('query', {})
    csrf_tokens = csrf_query.get('tokens', {}) if isinstance(csrf_query, dict) else {}
    csrf_token = str(csrf_tokens.get('csrftoken') or '').strip()
    if not csrf_token:
        raise WikidataWriteError('Could not fetch Wikidata CSRF token.')
    return csrf_token


def _wikidata_api_get(session: requests.Session, params: dict[str, Any]) -> dict[str, Any]:
    try:
        response = session.get(
            _WIKIDATA_API_URL,
            params=params,
            timeout=_external_timeout_seconds(),
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise WikidataWriteError(f'Wikidata request failed: {exc}') from exc

    try:
        payload = response.json()
    except ValueError as exc:
        preview = response.text[:200].replace('\n', ' ').strip()
        raise WikidataWriteError(f'Wikidata service did not return JSON. preview={preview!r}') from exc

    if not isinstance(payload, dict):
        raise WikidataWriteError('Wikidata service returned unexpected payload.')

    error_payload = payload.get('error')
    if isinstance(error_payload, dict):
        code = str(error_payload.get('code') or '').strip() or 'unknown'
        info = str(error_payload.get('info') or '').strip() or 'unknown error'
        raise WikidataWriteError(f'Wikidata API error ({code}): {info}')

    return payload


def _wikidata_api_post(session: requests.Session, params: dict[str, Any]) -> dict[str, Any]:
    try:
        response = session.post(
            _WIKIDATA_API_URL,
            data=params,
            timeout=_external_timeout_seconds(),
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise WikidataWriteError(f'Wikidata request failed: {exc}') from exc

    try:
        payload = response.json()
    except ValueError as exc:
        preview = response.text[:200].replace('\n', ' ').strip()
        raise WikidataWriteError(f'Wikidata service did not return JSON. preview={preview!r}') from exc

    if not isinstance(payload, dict):
        raise WikidataWriteError('Wikidata service returned unexpected payload.')

    error_payload = payload.get('error')
    if isinstance(error_payload, dict):
        code = str(error_payload.get('code') or '').strip() or 'unknown'
        info = str(error_payload.get('info') or '').strip() or 'unknown error'
        raise WikidataWriteError(f'Wikidata API error ({code}): {info}')

    return payload


def _wikidata_oauth_session(
    oauth_token: str = '',
    oauth_token_secret: str = '',
) -> tuple[requests.Session, str]:
    access_token = str(oauth_token or '').strip()
    access_token_secret = str(oauth_token_secret or '').strip()
    if not access_token and not access_token_secret and _local_dev_access_token_enabled():
        access_token, access_token_secret = _wikidata_local_dev_access_token_credentials()
    if not access_token or not access_token_secret:
        raise WikidataWriteError(
            'Wikimedia OAuth credentials are missing for this session. '
            'Sign in with Wikimedia OAuth before editing Wikidata, or configure '
            'LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN and LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET in local development.'
        )

    if OAuth1 is None:
        raise WikidataWriteError(
            'Wikidata OAuth1 support requires requests-oauthlib. '
            'Install dependencies from backend/requirements.txt.'
        )

    consumer_key, consumer_secret, access_token, access_token_secret = _wikidata_oauth_credentials(
        oauth_token=access_token,
        oauth_token_secret=access_token_secret,
    )
    session = _wikidata_api_session()
    session.auth = OAuth1(
        client_key=consumer_key,
        client_secret=consumer_secret,
        resource_owner_key=access_token,
        resource_owner_secret=access_token_secret,
        signature_type='auth_header',
    )

    csrf_token = _wikidata_csrf_token(session)
    return session, csrf_token


def _log_wikidata_userinfo_failure(response_text: str, status_code: int | None = None, detail: str = '') -> None:
    status_part = f' status={status_code}' if status_code is not None else ''
    detail_part = f' detail={detail}' if detail else ''
    preview = str(response_text or '').replace('\n', ' ').strip()
    print(f'[AUTH-DEBUG] MediaWiki userinfo fetch failed.{status_part}{detail_part} response={preview!r}', flush=True)


def fetch_wikidata_authenticated_username(
    oauth_token: str = '',
    oauth_token_secret: str = '',
) -> str:
    access_token = str(oauth_token or '').strip()
    access_token_secret = str(oauth_token_secret or '').strip()
    if not access_token and not access_token_secret and _local_dev_access_token_enabled():
        access_token, access_token_secret = _wikidata_local_dev_access_token_credentials()
    if not access_token or not access_token_secret:
        _log_wikidata_userinfo_failure('', detail='missing access token or access secret')
        return ''

    if OAuth1 is None:
        raise WikidataWriteError(
            'Wikidata OAuth1 support requires requests-oauthlib. '
            'Install dependencies from backend/requirements.txt.'
        )

    try:
        consumer_key, consumer_secret, access_token, access_token_secret = _wikidata_oauth_credentials(
            oauth_token=access_token,
            oauth_token_secret=access_token_secret,
        )
    except WikidataWriteError as exc:
        _log_wikidata_userinfo_failure('', detail=f'oauth credentials invalid: {exc}')
        raise
    session = _wikidata_api_session()
    session.auth = OAuth1(
        client_key=consumer_key,
        client_secret=consumer_secret,
        resource_owner_key=access_token,
        resource_owner_secret=access_token_secret,
        signature_type='auth_header',
    )
    userinfo_params = {
        'action': 'query',
        'meta': 'userinfo',
        'format': 'json',
    }
    try:
        response = session.get(
            _WIKIDATA_API_URL,
            params=userinfo_params,
            timeout=_external_timeout_seconds(),
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        failed_response = getattr(exc, 'response', None)
        response_text = str(getattr(failed_response, 'text', '') or '')
        response_status = getattr(failed_response, 'status_code', None)
        _log_wikidata_userinfo_failure(response_text, response_status, detail=str(exc))
        raise WikidataWriteError(f'Wikidata request failed: {exc}') from exc

    try:
        payload = response.json()
    except ValueError as exc:
        response_text = str(getattr(response, 'text', '') or '')
        _log_wikidata_userinfo_failure(response_text, response.status_code, detail='non-json response')
        preview = response_text[:200].replace('\n', ' ').strip()
        raise WikidataWriteError(f'Wikidata service did not return JSON. preview={preview!r}') from exc

    if not isinstance(payload, dict):
        _log_wikidata_userinfo_failure(
            json.dumps(payload, ensure_ascii=False, default=str),
            response.status_code,
            detail='unexpected payload type',
        )
        raise WikidataWriteError('Wikidata service returned unexpected payload.')

    error_payload = payload.get('error')
    if isinstance(error_payload, dict):
        _log_wikidata_userinfo_failure(
            json.dumps(payload, ensure_ascii=False),
            response.status_code,
            detail='api error',
        )
        code = str(error_payload.get('code') or '').strip() or 'unknown'
        info = str(error_payload.get('info') or '').strip() or 'unknown error'
        raise WikidataWriteError(f'Wikidata API error ({code}): {info}')

    query = payload.get('query', {})
    userinfo = query.get('userinfo', {}) if isinstance(query, dict) else {}
    username = str((userinfo.get('name') or '') if isinstance(userinfo, dict) else '').strip()
    if not username:
        _log_wikidata_userinfo_failure(
            json.dumps(payload, ensure_ascii=False),
            response.status_code,
            detail='username missing from userinfo response',
        )
    return username


def _wikidata_numeric_qid(qid: str) -> int:
    normalized_qid = _extract_wikidata_qid(qid)
    if not normalized_qid:
        raise WikidataWriteError(f'Invalid Wikidata item: {qid!r}')
    return int(normalized_qid[1:])


def _wikidata_entity_datavalue(qid: str) -> dict[str, Any]:
    normalized_qid = _extract_wikidata_qid(qid)
    if not normalized_qid:
        raise WikidataWriteError(f'Invalid Wikidata item: {qid!r}')
    return {
        'entity-type': 'item',
        'numeric-id': _wikidata_numeric_qid(normalized_qid),
    }


def _wikidata_language_code(value: str, fallback: str = 'en') -> str:
    normalized_fallback = str(fallback or '').strip().lower()
    if not re.fullmatch(r'[a-z]{2,12}', normalized_fallback):
        normalized_fallback = 'en'

    normalized = str(value or '').strip().lower()
    if re.fullmatch(r'[a-z]{2,12}', normalized):
        return normalized
    return normalized_fallback


def _wikidata_monolingual_text_datavalue(text: str, language: str, fallback: str = 'en') -> dict[str, Any]:
    return {
        'text': str(text or '').strip(),
        'language': _wikidata_language_code(language, fallback=fallback),
    }


def _wikidata_time_datavalue(value: str) -> dict[str, Any]:
    normalized = str(value or '').strip()
    if not normalized:
        raise WikidataWriteError('Empty time value is not allowed.')

    if re.fullmatch(r'\d{4}', normalized):
        year = int(normalized)
        if year < 1:
            raise WikidataWriteError('Year must be greater than 0.')
        return {
            'time': f'+{year:04d}-00-00T00:00:00Z',
            'timezone': 0,
            'before': 0,
            'after': 0,
            'precision': 9,
            'calendarmodel': _WIKIDATA_CALENDAR_MODEL,
        }

    if re.fullmatch(r'\d{4}-\d{2}', normalized):
        try:
            year, month = normalized.split('-', 1)
            parsed_year = int(year)
            parsed_month = int(month)
            date(parsed_year, parsed_month, 1)
        except ValueError as exc:
            raise WikidataWriteError(f'Invalid month date value: {normalized}') from exc
        return {
            'time': f'+{parsed_year:04d}-{parsed_month:02d}-00T00:00:00Z',
            'timezone': 0,
            'before': 0,
            'after': 0,
            'precision': 10,
            'calendarmodel': _WIKIDATA_CALENDAR_MODEL,
        }

    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', normalized):
        try:
            parsed = date.fromisoformat(normalized)
        except ValueError as exc:
            raise WikidataWriteError(f'Invalid date value: {normalized}') from exc
        return {
            'time': f'+{parsed.year:04d}-{parsed.month:02d}-{parsed.day:02d}T00:00:00Z',
            'timezone': 0,
            'before': 0,
            'after': 0,
            'precision': 11,
            'calendarmodel': _WIKIDATA_CALENDAR_MODEL,
        }

    raise WikidataWriteError(
        'Unsupported date format. Use YYYY or YYYY-MM or YYYY-MM-DD.'
    )


def _wikidata_today_datavalue() -> dict[str, Any]:
    today = timezone.now().date()
    return {
        'time': f'+{today.year:04d}-{today.month:02d}-{today.day:02d}T00:00:00Z',
        'timezone': 0,
        'before': 0,
        'after': 0,
        'precision': 11,
        'calendarmodel': _WIKIDATA_CALENDAR_MODEL,
    }


def _wikidata_source_snaks(
    source_url: str,
    source_title: str = '',
    source_title_language: str = '',
    source_author: str = '',
    source_publication_date: str = '',
    source_published_in_p1433: str = '',
    source_language_of_work_p407: str = '',
) -> dict[str, Any]:
    normalized_url = str(source_url or '').strip()
    if not normalized_url:
        return {}

    snaks: dict[str, Any] = {
        'P854': [
            {
                'snaktype': 'value',
                'property': 'P854',
                'datavalue': {'value': normalized_url, 'type': 'string'},
            }
        ],
        'P813': [
            {
                'snaktype': 'value',
                'property': 'P813',
                'datavalue': {'value': _wikidata_today_datavalue(), 'type': 'time'},
            }
        ],
    }

    normalized_title = str(source_title or '').strip()
    if normalized_title:
        snaks['P1476'] = [
            {
                'snaktype': 'value',
                'property': 'P1476',
                'datavalue': {
                    'value': _wikidata_monolingual_text_datavalue(
                        normalized_title,
                        source_title_language,
                        fallback='en',
                    ),
                    'type': 'monolingualtext',
                },
            }
        ]

    normalized_author = str(source_author or '').strip()
    if normalized_author:
        snaks['P2093'] = [
            {
                'snaktype': 'value',
                'property': 'P2093',
                'datavalue': {'value': normalized_author, 'type': 'string'},
            }
        ]

    normalized_publication_date = str(source_publication_date or '').strip()
    if normalized_publication_date:
        snaks['P577'] = [
            {
                'snaktype': 'value',
                'property': 'P577',
                'datavalue': {'value': _wikidata_time_datavalue(normalized_publication_date), 'type': 'time'},
            }
        ]

    normalized_published_in_qid = _extract_wikidata_qid(str(source_published_in_p1433 or '').strip())
    if normalized_published_in_qid:
        snaks['P1433'] = [
            {
                'snaktype': 'value',
                'property': 'P1433',
                'datavalue': {'value': _wikidata_entity_datavalue(normalized_published_in_qid), 'type': 'wikibase-entityid'},
            }
        ]

    normalized_language_of_work_qid = _extract_wikidata_qid(str(source_language_of_work_p407 or '').strip())
    if normalized_language_of_work_qid:
        snaks['P407'] = [
            {
                'snaktype': 'value',
                'property': 'P407',
                'datavalue': {'value': _wikidata_entity_datavalue(normalized_language_of_work_qid), 'type': 'wikibase-entityid'},
            }
        ]

    return snaks


def _set_claim_reference(
    session: requests.Session,
    csrf_token: str,
    claim_id: str,
    source_url: str,
    source_title: str = '',
    source_title_language: str = '',
    source_author: str = '',
    source_publication_date: str = '',
    source_published_in_p1433: str = '',
    source_language_of_work_p407: str = '',
) -> None:
    snaks = _wikidata_source_snaks(
        source_url,
        source_title=source_title,
        source_title_language=source_title_language,
        source_author=source_author,
        source_publication_date=source_publication_date,
        source_published_in_p1433=source_published_in_p1433,
        source_language_of_work_p407=source_language_of_work_p407,
    )
    if not snaks:
        return

    _wikidata_api_post(
        session,
        {
            'action': 'wbsetreference',
            'statement': claim_id,
            'snaks': json.dumps(snaks, ensure_ascii=False, separators=(',', ':')),
            'token': csrf_token,
            'format': 'json',
        },
    )


def _set_claim_qualifier(
    session: requests.Session,
    csrf_token: str,
    claim_id: str,
    property_id: str,
    datavalue: Any,
) -> None:
    _wikidata_api_post(
        session,
        {
            'action': 'wbsetqualifier',
            'claim': claim_id,
            'property': property_id,
            'snaktype': 'value',
            'value': json.dumps(datavalue, ensure_ascii=False, separators=(',', ':')),
            'token': csrf_token,
            'format': 'json',
        },
    )


def _create_wikidata_claim(
    session: requests.Session,
    csrf_token: str,
    entity_qid: str,
    property_id: str,
    datavalue: Any,
    source_url: str = '',
    source_title: str = '',
    source_title_language: str = '',
    source_author: str = '',
    source_publication_date: str = '',
    source_published_in_p1433: str = '',
    source_language_of_work_p407: str = '',
    qualifiers: dict[str, Any] | None = None,
) -> str:
    payload = _wikidata_api_post(
        session,
        {
            'action': 'wbcreateclaim',
            'entity': entity_qid,
            'property': property_id,
            'snaktype': 'value',
            'value': json.dumps(datavalue, ensure_ascii=False, separators=(',', ':')),
            'token': csrf_token,
            'format': 'json',
        },
    )
    claim = payload.get('claim', {})
    claim_id = str(claim.get('id') or '').strip() if isinstance(claim, dict) else ''
    if not claim_id:
        raise WikidataWriteError(f'Wikidata API did not return claim id for {property_id}.')

    _set_claim_reference(
        session,
        csrf_token,
        claim_id,
        source_url,
        source_title=source_title,
        source_title_language=source_title_language,
        source_author=source_author,
        source_publication_date=source_publication_date,
        source_published_in_p1433=source_published_in_p1433,
        source_language_of_work_p407=source_language_of_work_p407,
    )

    if qualifiers:
        for qualifier_property, qualifier_value in qualifiers.items():
            if qualifier_value is None:
                continue
            if isinstance(qualifier_value, str) and not qualifier_value.strip():
                continue
            _set_claim_qualifier(
                session,
                csrf_token,
                claim_id,
                qualifier_property,
                qualifier_value,
            )
    return claim_id


def _entity_item_claims(claims: dict[str, Any], property_id: str, target_qid: str) -> list[dict[str, Any]]:
    normalized_target = _extract_wikidata_qid(target_qid)
    if not normalized_target:
        return []

    entries = claims.get(property_id)
    if not isinstance(entries, list):
        return []

    matching_claims: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        mainsnak = entry.get('mainsnak', {})
        if not isinstance(mainsnak, dict):
            continue
        datavalue = mainsnak.get('datavalue', {})
        if not isinstance(datavalue, dict):
            continue
        value = datavalue.get('value')
        entity_id = _entity_id_from_claim_value(value)
        if entity_id and entity_id == normalized_target:
            matching_claims.append(entry)

    return matching_claims


def _entity_has_item_claim(claims: dict[str, Any], property_id: str, target_qid: str) -> bool:
    return bool(_entity_item_claims(claims, property_id, target_qid))


def _reference_has_string_snak(snaks: dict[str, Any], property_id: str, expected_value: str) -> bool:
    normalized_expected = str(expected_value or '').strip()
    if not normalized_expected:
        return True
    property_snaks = snaks.get(property_id)
    if not isinstance(property_snaks, list):
        return False
    for item_snak in property_snaks:
        if not isinstance(item_snak, dict):
            continue
        datavalue = item_snak.get('datavalue', {})
        if not isinstance(datavalue, dict):
            continue
        if str(datavalue.get('value') or '').strip() == normalized_expected:
            return True
    return False


def _reference_has_entity_snak(snaks: dict[str, Any], property_id: str, expected_qid: str) -> bool:
    normalized_expected_qid = _extract_wikidata_qid(expected_qid)
    if not normalized_expected_qid:
        return True
    property_snaks = snaks.get(property_id)
    if not isinstance(property_snaks, list):
        return False
    for item_snak in property_snaks:
        if not isinstance(item_snak, dict):
            continue
        datavalue = item_snak.get('datavalue', {})
        if not isinstance(datavalue, dict):
            continue
        entity_id = _entity_id_from_claim_value(datavalue.get('value'))
        if entity_id == normalized_expected_qid:
            return True
    return False


def _claim_has_matching_source_reference(
    claim: dict[str, Any],
    source_url: str,
    source_published_in_p1433: str = '',
    source_language_of_work_p407: str = '',
) -> bool:
    normalized_url = str(source_url or '').strip()
    if not normalized_url:
        return False

    references = claim.get('references')
    if not isinstance(references, list):
        return False

    for reference in references:
        if not isinstance(reference, dict):
            continue
        snaks = reference.get('snaks', {})
        if not isinstance(snaks, dict):
            continue
        if not _reference_has_string_snak(snaks, 'P854', normalized_url):
            continue
        if not _reference_has_entity_snak(snaks, 'P1433', source_published_in_p1433):
            continue
        if not _reference_has_entity_snak(snaks, 'P407', source_language_of_work_p407):
            continue
        return True

    return False


def ensure_wikidata_collection_membership(
    entity_id: str,
    collection_qid: str | None = None,
    oauth_token: str = '',
    oauth_token_secret: str = '',
    source_url: str = '',
    source_title: str = '',
    source_title_language: str = '',
    source_author: str = '',
    source_publication_date: str = '',
    source_published_in_p1433: str = '',
    source_language_of_work_p407: str = '',
    reason_p958: str = '',
) -> dict[str, Any]:
    normalized_entity_qid = _extract_wikidata_qid(entity_id)
    if not normalized_entity_qid:
        raise WikidataWriteError('A valid Wikidata item id is required.')

    raw_collection_qid = collection_qid or str(getattr(settings, 'WIKIDATA_COLLECTION_QID', '') or '')
    normalized_collection_qid = _extract_wikidata_qid(raw_collection_qid)
    if not normalized_collection_qid:
        raise WikidataWriteError('A valid collection Wikidata item id is required.')

    session, csrf_token = _wikidata_oauth_session(
        oauth_token=oauth_token,
        oauth_token_secret=oauth_token_secret,
    )
    entity_payload = _wikidata_api_get(
        session,
        {
            'action': 'wbgetentities',
            'ids': normalized_entity_qid,
            'props': 'claims',
            'format': 'json',
        },
    )
    entities = entity_payload.get('entities', {})
    entity = entities.get(normalized_entity_qid, {}) if isinstance(entities, dict) else {}
    claims = entity.get('claims', {}) if isinstance(entity, dict) else {}
    claims = claims if isinstance(claims, dict) else {}

    normalized_source_url = str(source_url or '').strip()
    normalized_source_title = str(source_title or '').strip()
    normalized_source_title_language = str(source_title_language or '').strip()
    normalized_source_author = str(source_author or '').strip()
    normalized_source_publication_date = str(source_publication_date or '').strip()
    normalized_source_published_in_qid = _extract_wikidata_qid(str(source_published_in_p1433 or '').strip())
    normalized_source_language_of_work_qid = _extract_wikidata_qid(str(source_language_of_work_p407 or '').strip())
    normalized_reason_p958 = str(reason_p958 or '').strip()

    matching_collection_claims = _entity_item_claims(claims, 'P5008', normalized_collection_qid)
    already_listed = bool(matching_collection_claims)
    if not already_listed:
        _create_wikidata_claim(
            session=session,
            csrf_token=csrf_token,
            entity_qid=normalized_entity_qid,
            property_id='P5008',
            datavalue=_wikidata_entity_datavalue(normalized_collection_qid),
            source_url=normalized_source_url,
            source_title=normalized_source_title,
            source_title_language=normalized_source_title_language,
            source_author=normalized_source_author,
            source_publication_date=normalized_source_publication_date,
            source_published_in_p1433=normalized_source_published_in_qid,
            source_language_of_work_p407=normalized_source_language_of_work_qid,
            qualifiers={'P958': normalized_reason_p958},
        )
    elif normalized_source_url:
        for claim in matching_collection_claims:
            if not isinstance(claim, dict):
                continue
            claim_id = str(claim.get('id') or '').strip()
            if not claim_id:
                continue
            if _claim_has_matching_source_reference(
                claim,
                normalized_source_url,
                source_published_in_p1433=normalized_source_published_in_qid,
                source_language_of_work_p407=normalized_source_language_of_work_qid,
            ):
                continue

            _set_claim_reference(
                session,
                csrf_token,
                claim_id,
                normalized_source_url,
                source_title=normalized_source_title,
                source_title_language=normalized_source_title_language,
                source_author=normalized_source_author,
                source_publication_date=normalized_source_publication_date,
                source_published_in_p1433=normalized_source_published_in_qid,
                source_language_of_work_p407=normalized_source_language_of_work_qid,
            )

    return {
        'qid': normalized_entity_qid,
        'uri': f'https://www.wikidata.org/entity/{normalized_entity_qid}',
        'already_listed': already_listed,
    }


def create_wikidata_building_item(
    payload: dict[str, Any],
    lang: str | None = None,
    collection_qid: str | None = None,
    oauth_token: str = '',
    oauth_token_secret: str = '',
) -> dict[str, Any]:
    label = str(payload.get('label') or '').strip()
    description = str(payload.get('description') or '').strip()
    if not label:
        raise WikidataWriteError('Label is required.')
    if not description:
        raise WikidataWriteError('Description is required.')

    instance_of_qid = _extract_wikidata_qid(str(payload.get('instance_of_p31') or ''))
    country_qid = _extract_wikidata_qid(str(payload.get('country_p17') or ''))
    municipality_qid = _extract_wikidata_qid(str(payload.get('municipality_p131') or ''))
    if not instance_of_qid or not country_qid or not municipality_qid:
        raise WikidataWriteError('P31, P17 and P131 are required.')

    try:
        latitude = float(payload.get('latitude'))
        longitude = float(payload.get('longitude'))
    except (TypeError, ValueError) as exc:
        raise WikidataWriteError('Valid coordinates are required.') from exc

    if latitude < -90 or latitude > 90 or longitude < -180 or longitude > 180:
        raise WikidataWriteError('Coordinates are out of bounds.')

    raw_collection_qid = collection_qid or str(getattr(settings, 'WIKIDATA_COLLECTION_QID', '') or '')
    normalized_collection_qid = _extract_wikidata_qid(raw_collection_qid)
    if not normalized_collection_qid:
        raise WikidataWriteError('A valid collection Wikidata item id is required.')

    language_fallbacks = _language_fallbacks(lang, include_mul=False)
    edit_language = language_fallbacks[0] if language_fallbacks else 'en'
    label_language = _wikidata_language_code(str(payload.get('label_language') or ''), fallback=edit_language)
    description_language = _wikidata_language_code(
        str(payload.get('description_language') or ''),
        fallback=edit_language,
    )
    address_language = _wikidata_language_code(
        str(payload.get('address_text_language_p6375') or ''),
        fallback=edit_language,
    )
    route_instruction_language = _wikidata_language_code(
        str(payload.get('route_instruction_language_p2795') or ''),
        fallback=edit_language,
    )

    session, csrf_token = _wikidata_oauth_session(
        oauth_token=oauth_token,
        oauth_token_secret=oauth_token_secret,
    )

    create_payload = _wikidata_api_post(
        session,
        {
            'action': 'wbeditentity',
            'new': 'item',
            'token': csrf_token,
            'format': 'json',
            'data': json.dumps(
                {
                    'labels': {
                        label_language: {
                            'language': label_language,
                            'value': label,
                        }
                    },
                    'descriptions': {
                        description_language: {
                            'language': description_language,
                            'value': description,
                        }
                    },
                },
                ensure_ascii=False,
                separators=(',', ':'),
            ),
        },
    )
    created_entity = create_payload.get('entity', {})
    created_qid = _extract_wikidata_qid(str(created_entity.get('id') if isinstance(created_entity, dict) else ''))
    if not created_qid:
        raise WikidataWriteError('Wikidata API did not return created item id.')

    _create_wikidata_claim(
        session,
        csrf_token,
        created_qid,
        'P31',
        _wikidata_entity_datavalue(instance_of_qid),
    )
    _create_wikidata_claim(
        session,
        csrf_token,
        created_qid,
        'P17',
        _wikidata_entity_datavalue(country_qid),
    )
    _create_wikidata_claim(
        session,
        csrf_token,
        created_qid,
        'P131',
        _wikidata_entity_datavalue(municipality_qid),
    )
    _create_wikidata_claim(
        session,
        csrf_token,
        created_qid,
        'P625',
        {
            'latitude': latitude,
            'longitude': longitude,
            'precision': 0.0001,
            'globe': _WIKIDATA_GLOBE,
        },
    )
    _create_wikidata_claim(
        session,
        csrf_token,
        created_qid,
        'P5008',
        _wikidata_entity_datavalue(normalized_collection_qid),
    )

    architect_qid = _extract_wikidata_qid(str(payload.get('architect_p84') or ''))
    if architect_qid:
        _create_wikidata_claim(
            session,
            csrf_token,
            created_qid,
            'P84',
            _wikidata_entity_datavalue(architect_qid),
            source_url=str(payload.get('architect_source_url') or '').strip(),
        )

    heritage_qid = _extract_wikidata_qid(str(payload.get('heritage_designation_p1435') or ''))
    if heritage_qid:
        _create_wikidata_claim(
            session,
            csrf_token,
            created_qid,
            'P1435',
            _wikidata_entity_datavalue(heritage_qid),
            source_url=str(payload.get('heritage_source_url') or '').strip(),
        )

    architectural_style_qid = _extract_wikidata_qid(str(payload.get('architectural_style_p149') or ''))
    if architectural_style_qid:
        _create_wikidata_claim(
            session,
            csrf_token,
            created_qid,
            'P149',
            _wikidata_entity_datavalue(architectural_style_qid),
        )

    state_of_use_qid = _extract_wikidata_qid(str(payload.get('state_of_use_p5817') or ''))
    if state_of_use_qid:
        _create_wikidata_claim(
            session,
            csrf_token,
            created_qid,
            'P5817',
            _wikidata_entity_datavalue(state_of_use_qid),
        )

    located_on_street_qid = _extract_wikidata_qid(str(payload.get('located_on_street_p669') or ''))
    if located_on_street_qid:
        _create_wikidata_claim(
            session,
            csrf_token,
            created_qid,
            'P669',
            _wikidata_entity_datavalue(located_on_street_qid),
        )

    inception_value = str(payload.get('inception_p571') or '').strip()
    if inception_value:
        _create_wikidata_claim(
            session,
            csrf_token,
            created_qid,
            'P571',
            _wikidata_time_datavalue(inception_value),
            source_url=str(payload.get('inception_source_url') or '').strip(),
        )

    closure_date_value = str(payload.get('official_closure_date_p3999') or '').strip()
    if closure_date_value:
        _create_wikidata_claim(
            session,
            csrf_token,
            created_qid,
            'P3999',
            _wikidata_time_datavalue(closure_date_value),
            source_url=str(payload.get('official_closure_date_source_url') or '').strip(),
        )

    address_text = str(payload.get('address_text_p6375') or '').strip()
    if address_text:
        _create_wikidata_claim(
            session,
            csrf_token,
            created_qid,
            'P6375',
            _wikidata_monolingual_text_datavalue(address_text, address_language, fallback=edit_language),
        )

    postal_code = str(payload.get('postal_code_p281') or '').strip()
    if postal_code:
        _create_wikidata_claim(
            session,
            csrf_token,
            created_qid,
            'P281',
            postal_code,
        )

    commons_category = _normalize_commons_category(str(payload.get('commons_category_p373') or ''))
    if commons_category:
        _create_wikidata_claim(
            session,
            csrf_token,
            created_qid,
            'P373',
            commons_category,
        )

    house_number = str(payload.get('house_number_p670') or '').strip()
    if house_number:
        _create_wikidata_claim(
            session,
            csrf_token,
            created_qid,
            'P670',
            house_number,
        )

    route_instruction = str(payload.get('route_instruction_p2795') or '').strip()
    if route_instruction:
        _create_wikidata_claim(
            session,
            csrf_token,
            created_qid,
            'P2795',
            _wikidata_monolingual_text_datavalue(
                route_instruction,
                route_instruction_language,
                fallback=edit_language,
            ),
        )

    return {
        'qid': created_qid,
        'uri': f'https://www.wikidata.org/entity/{created_qid}',
        'added_to_collection_qid': normalized_collection_qid,
    }


def search_wikidata_entities(query: str, lang: str | None = None, limit: int = 10) -> list[dict[str, Any]]:
    search_term = query.strip()
    if not search_term:
        return []

    fallbacks = _language_fallbacks(lang)
    language = fallbacks[0]
    payload = _external_json_get(
        _WIKIDATA_API_URL,
        {
            'action': 'wbsearchentities',
            'search': search_term,
            'language': language,
            'uselang': language,
            'type': 'item',
            'limit': max(1, min(limit, 20)),
            'format': 'json',
        },
    )

    items = payload.get('search', [])
    if not isinstance(items, list):
        return []

    results: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        qid = _extract_wikidata_qid(str(item.get('id', '')))
        if not qid:
            continue
        label = str(item.get('label') or qid)
        description = str(item.get('description') or '')
        results.append(
            {
                'id': qid,
                'label': label,
                'description': description,
                'uri': f'https://www.wikidata.org/entity/{qid}',
            }
        )

    return results


def fetch_wikidata_entity(entity_id: str, lang: str | None = None) -> dict[str, Any] | None:
    qid = _extract_wikidata_qid(entity_id)
    if not qid:
        return None

    fallbacks = _language_fallbacks(lang)
    payload = _external_json_get(
        _WIKIDATA_API_URL,
        {
            'action': 'wbgetentities',
            'ids': qid,
            'props': 'labels|descriptions|claims',
            'languages': '|'.join(fallbacks),
            'format': 'json',
        },
    )
    entities = payload.get('entities', {})
    if not isinstance(entities, dict):
        return None

    entity = entities.get(qid)
    if not isinstance(entity, dict):
        return None

    labels = entity.get('labels', {})
    descriptions = entity.get('descriptions', {})
    claims = entity.get('claims', {})
    if not isinstance(labels, dict) or not isinstance(descriptions, dict) or not isinstance(claims, dict):
        return None

    label = _label_for_language(labels, fallbacks) or qid
    description = _label_for_language(descriptions, fallbacks)

    coord_value = _first_claim_datavalue(claims, 'P625')
    latitude: float | None = None
    longitude: float | None = None
    if isinstance(coord_value, dict):
        lat_candidate = coord_value.get('latitude')
        lon_candidate = coord_value.get('longitude')
        try:
            if lat_candidate is not None and lon_candidate is not None:
                latitude = float(lat_candidate)
                longitude = float(lon_candidate)
        except (TypeError, ValueError):
            latitude = None
            longitude = None

    instance_of_id = _entity_id_from_claim_value(_first_claim_datavalue(claims, 'P31'))
    municipality_id = _entity_id_from_claim_value(_first_claim_datavalue(claims, 'P131'))
    geographic_entity_ids = _claim_entity_ids(claims, 'P706')
    commons_category = _first_claim_string(claims, 'P373', fallbacks=fallbacks)
    address_text = _first_claim_string(claims, 'P6375', fallbacks=fallbacks)
    postal_code = _first_claim_string(claims, 'P281', fallbacks=fallbacks)
    image_name = _first_claim_string(claims, 'P18', fallbacks=fallbacks)
    image_url = _commons_file_url(image_name)
    image_thumb_url = _commons_thumbnail_url(image_name)

    referenced_labels = _wikidata_labels_for_ids(
        [instance_of_id, municipality_id, *geographic_entity_ids],
        fallbacks,
    )
    instance_of = None
    municipality = None
    geographic_entities: list[dict[str, str]] = []
    if instance_of_id:
        instance_of = {
            'id': instance_of_id,
            'label': referenced_labels.get(instance_of_id, instance_of_id),
        }
    if municipality_id:
        municipality = {
            'id': municipality_id,
            'label': referenced_labels.get(municipality_id, municipality_id),
        }
    for geographic_entity_id in geographic_entity_ids:
        geographic_entities.append(
            {
                'id': geographic_entity_id,
                'label': referenced_labels.get(geographic_entity_id, geographic_entity_id),
            }
        )

    return {
        'id': qid,
        'uri': f'https://www.wikidata.org/entity/{qid}',
        'label': label,
        'description': description,
        'latitude': latitude,
        'longitude': longitude,
        'instance_of': instance_of,
        'municipality': municipality,
        'geographic_entities': geographic_entities,
        'address_text': address_text,
        'postal_code': postal_code,
        'commons_category': commons_category,
        'image_name': image_name,
        'image_url': image_url,
        'image_thumb_url': image_thumb_url,
    }


def search_commons_categories(query: str, limit: int = 10) -> list[dict[str, str]]:
    prefix = query.strip()
    if not prefix:
        return []

    payload = _external_json_get(
        _COMMONS_API_URL,
        {
            'action': 'query',
            'list': 'allcategories',
            'acprefix': prefix,
            'aclimit': max(1, min(limit, 20)),
            'format': 'json',
        },
    )
    query_payload = payload.get('query', {})
    if not isinstance(query_payload, dict):
        return []
    categories = query_payload.get('allcategories', [])
    if not isinstance(categories, list):
        return []

    results: list[dict[str, str]] = []
    for item in categories:
        if not isinstance(item, dict):
            continue
        name = str(item.get('*') or '').strip()
        if not name:
            continue
        wiki_title = f'Category:{name}'.replace(' ', '_')
        results.append(
            {
                'name': name,
                'title': f'Category:{name}',
                'uri': f'https://commons.wikimedia.org/wiki/{quote(wiki_title, safe=":/")}',
            }
        )
    return results


def search_geocode_places(query: str, limit: int = 10) -> list[dict[str, Any]]:
    search_term = query.strip()
    if not search_term:
        return []

    try:
        response = requests.get(
            _NOMINATIM_SEARCH_URL,
            params={
                'q': search_term,
                'format': 'jsonv2',
                'limit': max(1, min(limit, 20)),
            },
            headers={
                'Accept': 'application/json',
                'User-Agent': 'LocationsExplorer/1.0 (+https://localhost)',
            },
            timeout=_external_timeout_seconds(),
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise ExternalServiceError(f'Geocoding request failed: {exc}') from exc

    try:
        payload = response.json()
    except ValueError as exc:
        preview = response.text[:200].replace('\n', ' ').strip()
        raise ExternalServiceError(f'Geocoding service did not return JSON. preview={preview!r}') from exc

    if not isinstance(payload, list):
        return []

    results: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            latitude = float(item.get('lat'))
            longitude = float(item.get('lon'))
        except (TypeError, ValueError):
            continue

        results.append(
            {
                'name': str(item.get('display_name') or '').strip(),
                'latitude': latitude,
                'longitude': longitude,
            }
        )

    return results
