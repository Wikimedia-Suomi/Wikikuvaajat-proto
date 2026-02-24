(function () {
  const { createApp, ref, computed, onMounted, onBeforeUnmount, watch, nextTick } = Vue
  const { createRouter, createWebHashHistory, useRoute } = VueRouter
  const { createI18n, useI18n } = VueI18n

  const configuredApiBaseUrl =
    (window.APP_CONFIG && typeof window.APP_CONFIG.apiBaseUrl === 'string'
      ? window.APP_CONFIG.apiBaseUrl
      : 'http://localhost:8000/api'
    ).replace(/\/$/, '')
  const configuredSparqlDefaultEndpoint = 'https://query.wikidata.org/sparql'
  const configuredSparqlOsmEndpoint = 'https://qlever.dev/api/osm-planet'
  const API_BASE_URL = configuredApiBaseUrl
  const SUPPORTED_LOCALES = ['en', 'sv', 'fi']
  const WIKIDATA_LANGUAGE_SEARCH_URL = 'https://commons.wikimedia.org/w/api.php'
  const WIKIDATA_PROPERTY_SEARCH_URL = 'https://www.wikidata.org/w/api.php'
  const WIKIDATA_SPARQL_ENDPOINT_URL = configuredSparqlDefaultEndpoint
  const OSM_PLANET_SPARQL_ENDPOINT_URL = configuredSparqlOsmEndpoint
  const SAVE_IMAGE_NEARBY_WIKIDATA_RADIUS_METERS = 150
  const SAVE_IMAGE_NEARBY_OSM_RADIUS_METERS = 100
  const SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS = 15
  const SAVE_IMAGE_SUBJECT_OSM_RADIUS_METERS = 30
  const SAVE_IMAGE_SUBJECT_OSM_MAX_ELEMENTS = 80
  const SAVE_IMAGE_SUBJECT_OSM_MAX_TAG_MAPPINGS = 120
  const SAVE_IMAGE_SUBJECT_NEARBY_MAP_FEATURE_BASE_LIMIT = 100
  const SAVE_IMAGE_SUBJECT_NEARBY_MAP_FEATURE_VISIBLE_LIMIT = 15
  const SAVE_IMAGE_SUBJECT_NEARBY_WIKIDATA_MAX_ITEMS = 20
  const SAVE_IMAGE_SUBJECT_WIKIDATA_REVERSE_LOOKUP_RADIUS_KM = 2.5
  const SAVE_IMAGE_SUBJECT_WIKIDATA_REVERSE_LOOKUP_LIMIT = 8
  const SAVE_IMAGE_SUBJECT_WIKIDATA_REVERSE_LOOKUP_CACHE_MAX_ITEMS = 200
  const SAVE_IMAGE_SUBCATEGORY_COORDINATE_BATCH_SIZE = 10
  const SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_QIDS = 40
  const SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_CANDIDATES = 120
  const SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_PLACES = 20
  const SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_P373 = 20
  const SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_CACHE_MAX_ITEMS = 200
  const SAVE_IMAGE_FILENAME_BUILDER_MAX_SUBJECTS = 2
  const SAVE_IMAGE_FILENAME_BUILDER_MAX_CATEGORIES = 2
  const SAVE_IMAGE_FILENAME_BUILDER_MAX_BASE_LENGTH = 220
  const SAVE_IMAGE_SUBJECT_CONTAINER_FALLBACK_QID = 'Q1757'
  const SAVE_IMAGE_SUBJECT_OSM_OPTIONAL_TAG_KEYS = [
    'name',
    'wikidata',
    'amenity',
    'building',
    'landuse',
    'natural',
    'boundary',
    'highway',
    'tourism',
    'shop',
    'leisure',
    'historic',
    'man_made',
    'railway',
    'public_transport',
    'place',
    'waterway',
    'aeroway',
    'route',
    'power',
    'office',
    'craft',
    'healthcare',
    'station',
    'bus',
    'tram',
    'subway',
    'ferry',
    'parking',
    'sport',
    'bridge',
    'tunnel',
    'service',
    'aerialway',
    'barrier',
    'junction',
    'water',
    'landcover',
    'area',
  ]
  const SAVE_IMAGE_SUBJECT_OSM_OPTIONAL_ADDRESS_BINDINGS = [
    {
      variable: 'addrStreet',
      predicateIri: 'https://www.openstreetmap.org/wiki/Key:addr:street',
      tagKey: 'addr:street',
    },
    {
      variable: 'addrHousenumber',
      predicateIri: 'https://www.openstreetmap.org/wiki/Key:addr:housenumber',
      tagKey: 'addr:housenumber',
    },
    {
      variable: 'addrPlace',
      predicateIri: 'https://www.openstreetmap.org/wiki/Key:addr:place',
      tagKey: 'addr:place',
    },
  ]
  const SAVE_IMAGE_SELECTED_CATEGORY_ANCESTOR_DEPTH = 3
  const SAVE_IMAGE_SUBJECT_TYPE_DEFINITIONS = [
    { value: 'interior', locationRelevant: true },
    { value: 'exterior', locationRelevant: true },
    { value: 'aerial', locationRelevant: true },
    { value: 'portrait', locationRelevant: false },
    { value: 'general', locationRelevant: false },
  ]
  const SAVE_IMAGE_SUBJECT_TYPE_BY_VALUE = new Map(
    SAVE_IMAGE_SUBJECT_TYPE_DEFINITIONS.map((entry) => [entry.value, entry])
  )
  const WIKIDATA_LANGUAGE_CODE_CANONICAL = {
    sme: 'se',
  }
  const NEW_WIKIDATA_OPTIONAL_PROPERTY_DEFINITIONS = [
    { key: 'location_p276', propertyId: 'P276', labelKey: 'locationP276' },
    { key: 'part_of_p361', propertyId: 'P361', labelKey: 'partOfP361' },
    { key: 'architectural_style_p149', propertyId: 'P149', labelKey: 'architecturalStyleP149' },
    { key: 'architect_p84', propertyId: 'P84', labelKey: 'architectP84' },
    { key: 'inception_p571', propertyId: 'P571', labelKey: 'inceptionP571' },
    { key: 'heritage_designation_p1435', propertyId: 'P1435', labelKey: 'heritageDesignationP1435' },
    { key: 'route_instruction_p2795', propertyId: 'P2795', labelKey: 'routeInstructionP2795' },
    { key: 'official_closure_date_p3999', propertyId: 'P3999', labelKey: 'officialClosureDateP3999' },
    { key: 'state_of_use_p5817', propertyId: 'P5817', labelKey: 'stateOfUseP5817' },
    { key: 'yso_id_p2347', propertyId: 'P2347', labelKey: 'ysoIdP2347' },
    { key: 'kanto_id_p8980', propertyId: 'P8980', labelKey: 'kantoIdP8980' },
    {
      key: 'protected_buildings_register_in_finland_id_p5310',
      propertyId: 'P5310',
      labelKey: 'protectedBuildingsRegisterInFinlandIdP5310',
    },
    {
      key: 'rky_national_built_heritage_environment_id_p4009',
      propertyId: 'P4009',
      labelKey: 'rkyNationalBuiltHeritageEnvironmentIdP4009',
    },
    {
      key: 'permanent_building_number_vtj_prt_p3824',
      propertyId: 'P3824',
      labelKey: 'permanentBuildingNumberVtjPrtP3824',
    },
    {
      key: 'protected_buildings_register_in_finland_building_id_p5313',
      propertyId: 'P5313',
      labelKey: 'protectedBuildingsRegisterInFinlandBuildingIdP5313',
    },
    {
      key: 'helsinki_persistent_building_id_ratu_p8355',
      propertyId: 'P8355',
      labelKey: 'helsinkiPersistentBuildingIdRatuP8355',
    },
    { key: 'commons_category_p373', propertyId: 'P373', labelKey: 'commonsCategory' },
  ]
  const NEW_WIKIDATA_DEDICATED_PROPERTY_KEYS = new Set([
    'part_of_p361',
    'architect_p84',
    'inception_p571',
    'heritage_designation_p1435',
    'commons_category_p373',
  ])
  const NEW_WIKIDATA_IDENTIFIER_PROPERTY_KEYS = new Set([
    'yso_id_p2347',
    'kanto_id_p8980',
    'protected_buildings_register_in_finland_id_p5310',
    'rky_national_built_heritage_environment_id_p4009',
    'permanent_building_number_vtj_prt_p3824',
    'protected_buildings_register_in_finland_building_id_p5313',
    'helsinki_persistent_building_id_ratu_p8355',
  ])
  const NEW_WIKIDATA_DYNAMIC_PROPERTY_KEY_PREFIX = 'property_'
  const NEW_WIKIDATA_OPTIONAL_PROPERTY_BY_KEY = new Map(
    NEW_WIKIDATA_OPTIONAL_PROPERTY_DEFINITIONS.map((entry) => [entry.key, entry])
  )
  const NEW_WIKIDATA_OPTIONAL_PROPERTY_BY_ID = new Map(
    NEW_WIKIDATA_OPTIONAL_PROPERTY_DEFINITIONS.map((entry) => [entry.propertyId, entry])
  )
  const AUTOCOMPLETE_RESULT_LIMIT = 20
  const SUBJECT_WIKIDATA_DEBUG_LOG_ENABLED = (() => {
    try {
      if (window.APP_CONFIG && window.APP_CONFIG.debugSubjectWikidataSuggestions === true) {
        return true
      }
      const hostname = (
        window &&
        window.location &&
        typeof window.location.hostname === 'string'
      )
        ? window.location.hostname.trim().toLowerCase()
        : ''
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
    } catch (error) {
      void error
      return false
    }
  })()
  const LOCATION_SILENT_REFRESH_DELAY_MS = 5000
  const DETAIL_IMAGE_PLACEHOLDER_DATA_URI = (() => {
    const svg = (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">'
      + '<defs><linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">'
      + '<stop offset="0%" stop-color="#eef3f8"/><stop offset="100%" stop-color="#d7e2ee"/>'
      + '</linearGradient></defs>'
      + '<rect width="1200" height="800" fill="url(#bg)"/>'
      + '<rect x="250" y="180" width="700" height="440" rx="28" fill="#9eb1c5"/>'
      + '<circle cx="500" cy="350" r="65" fill="#d7e2ee"/>'
      + '<path d="M320 550l130-150 125 110 95-85 210 125z" fill="#d7e2ee"/>'
      + '</svg>'
    )
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  })()
  const SAVE_IMAGE_SUBJECT_PIN_COLOR = '#1a73e8'
  const SAVE_IMAGE_SUBJECT_LINKED_PIN_COLORS = [
    '#d93025',
    '#188038',
    '#f9ab00',
    '#9334e6',
    '#00897b',
    '#ef6c00',
    '#c2185b',
    '#5e35b1',
    '#546e7a',
    '#3949ab',
  ]
  const SAVE_IMAGE_SUBJECT_PIN_DATA_URI_BY_COLOR = new Map()

  function buildSaveImageSubjectPinDataUri(color) {
    const pinColor = typeof color === 'string' && color.trim()
      ? color.trim()
      : SAVE_IMAGE_SUBJECT_PIN_COLOR
    const svg = (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
      + '<path fill="' + pinColor + '" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>'
      + '</svg>'
    )
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
  }

  function getSaveImageSubjectPinDataUri(color) {
    const normalizedColor = typeof color === 'string' && color.trim()
      ? color.trim()
      : SAVE_IMAGE_SUBJECT_PIN_COLOR
    if (SAVE_IMAGE_SUBJECT_PIN_DATA_URI_BY_COLOR.has(normalizedColor)) {
      return SAVE_IMAGE_SUBJECT_PIN_DATA_URI_BY_COLOR.get(normalizedColor)
    }
    const dataUri = buildSaveImageSubjectPinDataUri(normalizedColor)
    SAVE_IMAGE_SUBJECT_PIN_DATA_URI_BY_COLOR.set(normalizedColor, dataUri)
    return dataUri
  }

  function getSaveImageSubjectLinkedPinColor(indexValue) {
    const normalizedIndex = Number.parseInt(String(indexValue), 10)
    if (!Number.isFinite(normalizedIndex) || normalizedIndex < 0) {
      return SAVE_IMAGE_SUBJECT_LINKED_PIN_COLORS[0] || SAVE_IMAGE_SUBJECT_PIN_COLOR
    }
    if (SAVE_IMAGE_SUBJECT_LINKED_PIN_COLORS.length < 1) {
      return SAVE_IMAGE_SUBJECT_PIN_COLOR
    }
    return SAVE_IMAGE_SUBJECT_LINKED_PIN_COLORS[normalizedIndex % SAVE_IMAGE_SUBJECT_LINKED_PIN_COLORS.length]
  }

  const SAVE_IMAGE_SUBJECT_PIN_DATA_URI = getSaveImageSubjectPinDataUri(SAVE_IMAGE_SUBJECT_PIN_COLOR)

  function normalizeSaveImageSubjectType(value) {
    const normalized = String(value || '').trim().toLowerCase()
    if (!normalized) {
      return ''
    }
    return SAVE_IMAGE_SUBJECT_TYPE_BY_VALUE.has(normalized) ? normalized : ''
  }

  function saveImageSubjectTypeIsLocationRelevant(value) {
    const normalized = normalizeSaveImageSubjectType(value)
    if (!normalized) {
      return false
    }
    const definition = SAVE_IMAGE_SUBJECT_TYPE_BY_VALUE.get(normalized)
    return Boolean(definition && definition.locationRelevant)
  }

  function preferredSaveImageSubjectLinkMode(subjectType) {
    const normalizedType = normalizeSaveImageSubjectType(subjectType)
    if (!normalizedType) {
      return 'map'
    }
    if (normalizedType === 'exterior' || normalizedType === 'aerial') {
      return 'map'
    }
    return 'image-only'
  }

  function normalizeLanguageSearchToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
  }

  function normalizeLanguageCode(value) {
    const normalized = String(value || '').trim().toLowerCase()
    if (!normalized) {
      return ''
    }
    return WIKIDATA_LANGUAGE_CODE_CANONICAL[normalized] || normalized
  }

  function extractLanguageSearchItems(payload) {
    const normalizeObjectItems = (rawItems) => {
      if (!rawItems || typeof rawItems !== 'object' || Array.isArray(rawItems)) {
        return []
      }
      const items = []
      for (const [code, name] of Object.entries(rawItems)) {
        const normalizedCode = normalizeLanguageCode(code)
        const normalizedName = String(name || '').trim()
        if (!normalizedCode) {
          continue
        }
        items.push({
          code: normalizedCode,
          name: normalizedName,
        })
      }
      return items
    }

    if (!payload || typeof payload !== 'object') {
      return []
    }
    if (Array.isArray(payload.search)) {
      return payload.search
    }
    if (Array.isArray(payload.languagesearch)) {
      return payload.languagesearch
    }
    if (payload.languagesearch && typeof payload.languagesearch === 'object') {
      return normalizeObjectItems(payload.languagesearch)
    }
    if (Array.isArray(payload.languages)) {
      return payload.languages
    }
    if (payload.query && typeof payload.query === 'object' && Array.isArray(payload.query.languagesearch)) {
      return payload.query.languagesearch
    }
    if (
      payload.query &&
      typeof payload.query === 'object' &&
      payload.query.languagesearch &&
      typeof payload.query.languagesearch === 'object'
    ) {
      return normalizeObjectItems(payload.query.languagesearch)
    }
    return []
  }

  function normalizeWikidataLanguageOption(option) {
    if (!option || typeof option !== 'object') {
      return null
    }

    const code = normalizeLanguageCode(option.code || option.language || option.lang || '')
    if (!code) {
      return null
    }

    const name = String(option.name || option.localname || option.localName || option.language || '').trim()
    const autonym = String(option.autonym || option.native || option.autonymname || option.autonymName || '').trim()
    const searchTokens = new Set([normalizeLanguageSearchToken(code)])

    if (name) {
      searchTokens.add(normalizeLanguageSearchToken(name))
    }
    if (autonym) {
      searchTokens.add(normalizeLanguageSearchToken(autonym))
    }
    if (Array.isArray(option.searchTokens)) {
      for (const token of option.searchTokens) {
        const normalizedToken = normalizeLanguageSearchToken(token)
        if (normalizedToken) {
          searchTokens.add(normalizedToken)
        }
      }
    }

    return {
      code,
      name,
      autonym,
      searchTokens: Array.from(searchTokens).filter(Boolean),
    }
  }

  async function searchWikidataLanguages(query, lang = null, limit = AUTOCOMPLETE_RESULT_LIMIT) {
    const searchTerm = String(query || '').trim()
    if (!searchTerm) {
      return []
    }

    const requestLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || AUTOCOMPLETE_RESULT_LIMIT, 50))
    const searchUrl = new URL(WIKIDATA_LANGUAGE_SEARCH_URL)
    searchUrl.searchParams.set('action', 'languagesearch')
    searchUrl.searchParams.set('format', 'json')
    searchUrl.searchParams.set('formatversion', '2')
    searchUrl.searchParams.set('search', searchTerm)
    searchUrl.searchParams.set('limit', String(requestLimit))
    searchUrl.searchParams.set('origin', '*')
    const normalizedUiLocale = normalizeSupportedLocale(lang) || 'en'
    searchUrl.searchParams.set('uselang', normalizedUiLocale)

    const response = await fetch(searchUrl.toString(), { method: 'GET' })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    const items = extractLanguageSearchItems(payload)
    if (!Array.isArray(items)) {
      return []
    }

    const seenCodes = new Set()
    const options = []
    for (const item of items) {
      const normalizedOption = normalizeWikidataLanguageOption(item)
      if (!normalizedOption) {
        continue
      }
      if (seenCodes.has(normalizedOption.code)) {
        continue
      }
      seenCodes.add(normalizedOption.code)
      options.push(normalizedOption)
    }

    return options
  }

  async function fetchNearbyWikidataCommonsCategories(latitude, longitude, {
    radiusMeters = SAVE_IMAGE_NEARBY_WIKIDATA_RADIUS_METERS,
    limit = SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS,
    lang = null,
  } = {}) {
    const latitudeValue = Number(latitude)
    const longitudeValue = Number(longitude)
    if (!Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue)) {
      return []
    }

    const radiusKilometers = Math.max(0.001, Number(radiusMeters) / 1000)
    const resultLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS, 50))
    const queryLanguage = normalizeSupportedLocale(lang) || 'en'
    const queryResultLimit = Math.max(resultLimit, Math.min(resultLimit * 6, 200))
    const sparql = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>

SELECT ?item ?commonsCategory ?distance
WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?itemLocation .
    bd:serviceParam wikibase:center "Point(${longitudeValue.toFixed(7)} ${latitudeValue.toFixed(7)})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKilometers.toFixed(3)}" .
    bd:serviceParam wikibase:distance ?distance .
  }
  {
    ?item wdt:P373 ?commonsCategoryRaw .
  }
  UNION
  {
    ?item wdt:P706 ?locationOfFeatureItem .
    ?locationOfFeatureItem wdt:P373 ?commonsCategoryRaw .
  }
  UNION
  {
    ?item wdt:P276 ?locatedInItem .
    ?locatedInItem wdt:P373 ?commonsCategoryRaw .
  }
  BIND(STR(?commonsCategoryRaw) AS ?commonsCategory)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${queryLanguage},en". }
}
ORDER BY ASC(?distance)
LIMIT ${queryResultLimit}
`.trim()

    const requestBody = new URLSearchParams()
    requestBody.set('query', sparql)

    const requestUrl = new URL(WIKIDATA_SPARQL_ENDPOINT_URL)
    requestUrl.searchParams.set('format', 'json')
    const response = await fetch(requestUrl.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: requestBody.toString(),
    })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    const bindings =
      payload &&
      typeof payload === 'object' &&
      payload.results &&
      typeof payload.results === 'object' &&
      Array.isArray(payload.results.bindings)
        ? payload.results.bindings
        : []

    const nearbyItems = []
    const seenCategoryKeys = new Set()
    for (const binding of bindings) {
      if (!binding || typeof binding !== 'object') {
        continue
      }
      const categoryValue =
        binding.commonsCategory &&
        typeof binding.commonsCategory === 'object' &&
        typeof binding.commonsCategory.value === 'string'
          ? binding.commonsCategory.value.trim()
          : ''
      if (!categoryValue) {
        continue
      }
      const dedupeKey = categoryValue.replace(/\s+/g, '_').toLowerCase()
      if (seenCategoryKeys.has(dedupeKey)) {
        continue
      }
      seenCategoryKeys.add(dedupeKey)
      nearbyItems.push({
        category: categoryValue,
      })
      if (nearbyItems.length >= resultLimit) {
        break
      }
    }

    return nearbyItems
  }

  async function fetchNearbyWikidataDepictItems(latitude, longitude, {
    radiusMeters = SAVE_IMAGE_NEARBY_WIKIDATA_RADIUS_METERS,
    limit = SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS,
    lang = null,
  } = {}) {
    const latitudeValue = Number(latitude)
    const longitudeValue = Number(longitude)
    if (!Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue)) {
      return []
    }

    const radiusKilometers = Math.max(0.001, Number(radiusMeters) / 1000)
    const resultLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS, 50))
    const queryResultLimit = Math.max(resultLimit, Math.min(resultLimit * 10, 300))
    const queryLanguage = normalizeSupportedLocale(lang) || 'en'
    const sparql = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>

SELECT ?item ?itemLabel ?itemDescription ?distance
WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?itemLocation .
    bd:serviceParam wikibase:center "Point(${longitudeValue.toFixed(7)} ${latitudeValue.toFixed(7)})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKilometers.toFixed(3)}" .
    bd:serviceParam wikibase:distance ?distance .
  }
  FILTER(STRSTARTS(STR(?item), "http://www.wikidata.org/entity/Q"))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${queryLanguage},en". }
}
ORDER BY ASC(?distance)
LIMIT ${queryResultLimit}
`.trim()

    const requestBody = new URLSearchParams()
    requestBody.set('query', sparql)
    const requestUrl = new URL(WIKIDATA_SPARQL_ENDPOINT_URL)
    requestUrl.searchParams.set('format', 'json')
    const response = await fetch(requestUrl.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: requestBody.toString(),
    })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    const bindings =
      payload &&
      typeof payload === 'object' &&
      payload.results &&
      typeof payload.results === 'object' &&
      Array.isArray(payload.results.bindings)
        ? payload.results.bindings
        : []

    const items = []
    const seenQids = new Set()
    for (const binding of bindings) {
      if (!binding || typeof binding !== 'object') {
        continue
      }
      const depictQid = extractWikidataId(
        binding.item &&
        typeof binding.item === 'object' &&
        typeof binding.item.value === 'string'
          ? binding.item.value
          : '',
      )
      if (!depictQid || seenQids.has(depictQid)) {
        continue
      }
      seenQids.add(depictQid)
      items.push({
        id: depictQid,
        label:
          binding.itemLabel &&
          typeof binding.itemLabel === 'object' &&
          typeof binding.itemLabel.value === 'string'
            ? binding.itemLabel.value.trim()
            : '',
        description:
          binding.itemDescription &&
          typeof binding.itemDescription === 'object' &&
          typeof binding.itemDescription.value === 'string'
            ? binding.itemDescription.value.trim()
            : '',
      })
      if (items.length >= resultLimit) {
        break
      }
    }

    return items
  }

  async function fetchCommonsCategoriesForWikidataQids(qids, {
    limit = SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS,
  } = {}) {
    const normalizedQids = []
    const seenQids = new Set()
    for (const rawQid of Array.isArray(qids) ? qids : []) {
      const normalizedQid = extractWikidataId(String(rawQid || ''))
      if (!normalizedQid || seenQids.has(normalizedQid)) {
        continue
      }
      seenQids.add(normalizedQid)
      normalizedQids.push(normalizedQid)
    }
    if (normalizedQids.length === 0) {
      return []
    }

    const resultLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS, 50))
    const limitedQids = normalizedQids.slice(0, 50)
    const valuesClause = limitedQids.map((qid) => `wd:${qid}`).join(' ')
    const queryResultLimit = Math.max(resultLimit, Math.min(resultLimit * 10, 500))
    const sparql = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>

SELECT ?item ?commonsCategory
WHERE {
  VALUES ?item { ${valuesClause} }
  {
    ?item wdt:P373 ?commonsCategoryRaw .
  }
  UNION
  {
    ?item wdt:P706 ?locationOfFeatureItem .
    ?locationOfFeatureItem wdt:P373 ?commonsCategoryRaw .
  }
  UNION
  {
    ?item wdt:P276 ?locatedInItem .
    ?locatedInItem wdt:P373 ?commonsCategoryRaw .
  }
  BIND(STR(?commonsCategoryRaw) AS ?commonsCategory)
}
LIMIT ${queryResultLimit}
`.trim()

    const requestBody = new URLSearchParams()
    requestBody.set('query', sparql)
    const requestUrl = new URL(WIKIDATA_SPARQL_ENDPOINT_URL)
    requestUrl.searchParams.set('format', 'json')
    const response = await fetch(requestUrl.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: requestBody.toString(),
    })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    const bindings =
      payload &&
      typeof payload === 'object' &&
      payload.results &&
      typeof payload.results === 'object' &&
      Array.isArray(payload.results.bindings)
        ? payload.results.bindings
        : []

    const categoriesByQid = new Map()
    const categoryKeysByQid = new Map()
    for (const binding of bindings) {
      if (!binding || typeof binding !== 'object') {
        continue
      }
      const qid = extractWikidataId(
        binding.item &&
        typeof binding.item === 'object' &&
        typeof binding.item.value === 'string'
          ? binding.item.value
          : '',
      )
      if (!qid) {
        continue
      }
      const categoryValue =
        binding.commonsCategory &&
        typeof binding.commonsCategory === 'object' &&
        typeof binding.commonsCategory.value === 'string'
          ? binding.commonsCategory.value.trim()
          : ''
      if (!categoryValue) {
        continue
      }
      const categoryKey = categoryValue.replace(/\s+/g, '_').toLowerCase()
      if (!categoryKeysByQid.has(qid)) {
        categoryKeysByQid.set(qid, new Set())
      }
      if (!categoriesByQid.has(qid)) {
        categoriesByQid.set(qid, [])
      }
      const qidCategoryKeys = categoryKeysByQid.get(qid)
      if (qidCategoryKeys.has(categoryKey)) {
        continue
      }
      qidCategoryKeys.add(categoryKey)
      categoriesByQid.get(qid).push(categoryValue)
    }

    const categories = []
    const seenCategoryKeys = new Set()
    outerLoop:
    for (const qid of limitedQids) {
      const qidCategories = categoriesByQid.get(qid)
      if (!Array.isArray(qidCategories) || qidCategories.length === 0) {
        continue
      }
      for (const category of qidCategories) {
        const categoryKey = String(category || '').replace(/\s+/g, '_').toLowerCase()
        if (!categoryKey || seenCategoryKeys.has(categoryKey)) {
          continue
        }
        seenCategoryKeys.add(categoryKey)
        categories.push({ qid, category })
        if (categories.length >= resultLimit) {
          break outerLoop
        }
      }
    }
    return categories
  }

  async function fetchWikidataCategoryContextForQids(qids, { lang = null } = {}) {
    const normalizedQids = []
    const seenQids = new Set()
    const maxQids = Math.max(
      1,
      Math.min(
        Number.parseInt(String(SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_QIDS), 10) || SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_QIDS,
        50,
      ),
    )
    for (const rawQid of Array.isArray(qids) ? qids : []) {
      const normalizedQid = extractWikidataId(String(rawQid || ''))
      if (!normalizedQid || seenQids.has(normalizedQid)) {
        continue
      }
      seenQids.add(normalizedQid)
      normalizedQids.push(normalizedQid)
      if (normalizedQids.length >= maxQids) {
        break
      }
    }
    if (normalizedQids.length < 1) {
      return {
        subjectCategories: [],
        places: [],
      }
    }

    const valuesClause = normalizedQids.map((qid) => `wd:${qid}`).join(' ')
    const queryLanguage = normalizeSupportedLocale(lang) || 'en'
    const labelLanguage = Array.from(new Set([queryLanguage, 'en'])).join(',')
    const queryResultLimit = Math.max(
      SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_CANDIDATES,
      Math.min(normalizedQids.length * 30, 1200),
    )
    const sparql = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>

SELECT ?seed ?subjectCommonsCategory ?subjectCommonsCategoryFromType ?place ?placeLabel
WHERE {
  VALUES ?seed { ${valuesClause} }
  OPTIONAL {
    ?seed wdt:P373 ?subjectCommonsCategoryRaw .
    BIND(STR(?subjectCommonsCategoryRaw) AS ?subjectCommonsCategory)
  }
  OPTIONAL {
    ?seed (wdt:P31|wdt:P279) ?seedTypeItem .
    ?seedTypeItem wdt:P373 ?subjectCommonsCategoryFromTypeRaw .
    BIND(STR(?subjectCommonsCategoryFromTypeRaw) AS ?subjectCommonsCategoryFromType)
  }
  OPTIONAL {
    ?seed (wdt:P131|wdt:P706|wdt:P276) ?place .
    FILTER(STRSTARTS(STR(?place), "http://www.wikidata.org/entity/Q"))
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${labelLanguage}". }
}
LIMIT ${queryResultLimit}
`.trim()

    const requestBody = new URLSearchParams()
    requestBody.set('query', sparql)
    const requestUrl = new URL(WIKIDATA_SPARQL_ENDPOINT_URL)
    requestUrl.searchParams.set('format', 'json')
    const response = await fetch(requestUrl.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: requestBody.toString(),
    })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    const bindings =
      payload &&
      typeof payload === 'object' &&
      payload.results &&
      typeof payload.results === 'object' &&
      Array.isArray(payload.results.bindings)
        ? payload.results.bindings
        : []

    const seedIndexByQid = new Map()
    for (let index = 0; index < normalizedQids.length; index += 1) {
      seedIndexByQid.set(normalizedQids[index], index)
    }

    const categoriesBySeed = new Map()
    const categoryKeysBySeed = new Map()
    const placeByQid = new Map()
    const placeOrderByQid = new Map()
    for (const binding of bindings) {
      if (!binding || typeof binding !== 'object') {
        continue
      }
      const seedQid = extractWikidataId(
        binding.seed &&
        typeof binding.seed === 'object' &&
        typeof binding.seed.value === 'string'
          ? binding.seed.value
          : '',
      )
      if (!seedQid) {
        continue
      }

      const pushCategoryForSeed = (rawCategoryValue) => {
        const subjectCommonsCategory = normalizeCommonsCategoryName(rawCategoryValue)
        if (!subjectCommonsCategory) {
          return
        }
        if (!categoriesBySeed.has(seedQid)) {
          categoriesBySeed.set(seedQid, [])
        }
        if (!categoryKeysBySeed.has(seedQid)) {
          categoryKeysBySeed.set(seedQid, new Set())
        }
        const dedupeKey = subjectCommonsCategory.toLowerCase()
        const seenKeys = categoryKeysBySeed.get(seedQid)
        if (seenKeys.has(dedupeKey)) {
          return
        }
        seenKeys.add(dedupeKey)
        categoriesBySeed.get(seedQid).push(subjectCommonsCategory)
      }

      pushCategoryForSeed(
        binding.subjectCommonsCategory &&
        typeof binding.subjectCommonsCategory === 'object' &&
        typeof binding.subjectCommonsCategory.value === 'string'
          ? binding.subjectCommonsCategory.value
          : '',
      )
      pushCategoryForSeed(
        binding.subjectCommonsCategoryFromType &&
        typeof binding.subjectCommonsCategoryFromType === 'object' &&
        typeof binding.subjectCommonsCategoryFromType.value === 'string'
          ? binding.subjectCommonsCategoryFromType.value
          : '',
      )

      const placeQid = extractWikidataId(
        binding.place &&
        typeof binding.place === 'object' &&
        typeof binding.place.value === 'string'
          ? binding.place.value
          : '',
      )
      if (!placeQid) {
        continue
      }

      const placeLabel = (
        binding.placeLabel &&
        typeof binding.placeLabel === 'object' &&
        typeof binding.placeLabel.value === 'string'
      )
        ? binding.placeLabel.value.trim()
        : ''
      if (!placeByQid.has(placeQid)) {
        placeByQid.set(placeQid, {
          id: placeQid,
          label: placeLabel,
        })
        placeOrderByQid.set(
          placeQid,
          seedIndexByQid.has(seedQid) ? seedIndexByQid.get(seedQid) : Number.MAX_SAFE_INTEGER,
        )
      } else {
        const current = placeByQid.get(placeQid)
        if (current && !current.label && placeLabel) {
          current.label = placeLabel
        }
      }
    }

    const subjectCategories = []
    const seenCategoryKeys = new Set()
    for (const seedQid of normalizedQids) {
      const seedCategories = categoriesBySeed.get(seedQid)
      if (!Array.isArray(seedCategories)) {
        continue
      }
      for (const categoryName of seedCategories) {
        const normalizedCategory = normalizeCommonsCategoryName(categoryName)
        if (!normalizedCategory) {
          continue
        }
        const dedupeKey = normalizedCategory.toLowerCase()
        if (seenCategoryKeys.has(dedupeKey)) {
          continue
        }
        seenCategoryKeys.add(dedupeKey)
        subjectCategories.push(normalizedCategory)
        if (subjectCategories.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_CANDIDATES) {
          break
        }
      }
      if (subjectCategories.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_CANDIDATES) {
        break
      }
    }

    const places = Array.from(placeByQid.values())
      .sort((left, right) => {
        const leftOrder = placeOrderByQid.has(left.id) ? placeOrderByQid.get(left.id) : Number.MAX_SAFE_INTEGER
        const rightOrder = placeOrderByQid.has(right.id) ? placeOrderByQid.get(right.id) : Number.MAX_SAFE_INTEGER
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder
        }
        return String(left.label || left.id).localeCompare(
          String(right.label || right.id),
          'en',
          { sensitivity: 'base' },
        )
      })
      .slice(0, SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_PLACES)
      .map((place) => ({
        id: place.id,
        label: String(place.label || '').trim(),
      }))

    return {
      subjectCategories,
      places,
    }
  }

  async function fetchCommonsCategoryExistenceMap(categoryNames) {
    const normalizedCategories = []
    const categoryByDedupeKey = new Map()
    for (const rawCategory of Array.isArray(categoryNames) ? categoryNames : []) {
      const normalizedCategory = normalizeCommonsCategoryName(String(rawCategory || ''))
      if (!normalizedCategory) {
        continue
      }
      const dedupeKey = normalizedCategory.toLowerCase()
      if (categoryByDedupeKey.has(dedupeKey)) {
        continue
      }
      categoryByDedupeKey.set(dedupeKey, normalizedCategory)
      normalizedCategories.push(normalizedCategory)
    }
    if (normalizedCategories.length < 1) {
      return new Map()
    }

    const existenceByDedupeKey = new Map()
    const requestChunkSize = 25
    for (let index = 0; index < normalizedCategories.length; index += requestChunkSize) {
      const categoryChunk = normalizedCategories.slice(index, index + requestChunkSize)
      if (categoryChunk.length < 1) {
        continue
      }

      const url = new URL('https://commons.wikimedia.org/w/api.php')
      url.searchParams.set('action', 'query')
      url.searchParams.set('titles', categoryChunk.map((name) => `Category:${name}`).join('|'))
      url.searchParams.set('format', 'json')
      url.searchParams.set('formatversion', '2')
      url.searchParams.set('origin', '*')

      const response = await fetch(url.toString(), { method: 'GET' })
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const payload = await response.json()
      if (payload && typeof payload === 'object' && payload.error && payload.error.info) {
        throw new Error(String(payload.error.info))
      }

      const pages =
        payload &&
        typeof payload === 'object' &&
        payload.query &&
        typeof payload.query === 'object' &&
        Array.isArray(payload.query.pages)
          ? payload.query.pages
          : []
      for (const page of pages) {
        if (!page || typeof page !== 'object') {
          continue
        }
        const normalizedTitle = normalizeCommonsCategoryName(
          typeof page.title === 'string' ? page.title : '',
        )
        if (!normalizedTitle) {
          continue
        }
        const dedupeKey = normalizedTitle.toLowerCase()
        if (!categoryByDedupeKey.has(dedupeKey)) {
          continue
        }
        existenceByDedupeKey.set(dedupeKey, !Object.prototype.hasOwnProperty.call(page, 'missing'))
      }

      for (const categoryName of categoryChunk) {
        const dedupeKey = categoryName.toLowerCase()
        if (!existenceByDedupeKey.has(dedupeKey)) {
          existenceByDedupeKey.set(dedupeKey, false)
        }
      }
    }

    return existenceByDedupeKey
  }

  async function fetchWikidataDepictItemsForQids(qids, {
    limit = SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS,
    lang = null,
  } = {}) {
    const normalizedQids = []
    const seenQids = new Set()
    for (const rawQid of Array.isArray(qids) ? qids : []) {
      const normalizedQid = extractWikidataId(String(rawQid || ''))
      if (!normalizedQid || seenQids.has(normalizedQid)) {
        continue
      }
      seenQids.add(normalizedQid)
      normalizedQids.push(normalizedQid)
    }
    if (normalizedQids.length === 0) {
      return []
    }

    const resultLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS, 50))
    const limitedQids = normalizedQids.slice(0, 50)
    const valuesClause = limitedQids.map((qid) => `wd:${qid}`).join(' ')
    const queryResultLimit = Math.max(resultLimit, Math.min(resultLimit * 15, 600))
    const queryLanguage = normalizeSupportedLocale(lang) || 'en'
    const sparql = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>

SELECT ?seed ?depictItem ?depictItemLabel ?depictItemDescription
WHERE {
  VALUES ?seed { ${valuesClause} }
  {
    BIND(?seed AS ?depictItem)
  }
  UNION
  {
    ?seed wdt:P706 ?depictItem .
  }
  UNION
  {
    ?seed wdt:P276 ?depictItem .
  }
  FILTER(STRSTARTS(STR(?depictItem), "http://www.wikidata.org/entity/Q"))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${queryLanguage},en". }
}
LIMIT ${queryResultLimit}
`.trim()

    const requestBody = new URLSearchParams()
    requestBody.set('query', sparql)
    const requestUrl = new URL(WIKIDATA_SPARQL_ENDPOINT_URL)
    requestUrl.searchParams.set('format', 'json')
    const response = await fetch(requestUrl.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: requestBody.toString(),
    })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    const bindings =
      payload &&
      typeof payload === 'object' &&
      payload.results &&
      typeof payload.results === 'object' &&
      Array.isArray(payload.results.bindings)
        ? payload.results.bindings
        : []

    const depictItemsBySeed = new Map()
    const depictItemKeysBySeed = new Map()
    for (const binding of bindings) {
      if (!binding || typeof binding !== 'object') {
        continue
      }
      const seedQid = extractWikidataId(
        binding.seed &&
        typeof binding.seed === 'object' &&
        typeof binding.seed.value === 'string'
          ? binding.seed.value
          : '',
      )
      if (!seedQid) {
        continue
      }
      const depictQid = extractWikidataId(
        binding.depictItem &&
        typeof binding.depictItem === 'object' &&
        typeof binding.depictItem.value === 'string'
          ? binding.depictItem.value
          : '',
      )
      if (!depictQid) {
        continue
      }
      if (!depictItemsBySeed.has(seedQid)) {
        depictItemsBySeed.set(seedQid, [])
      }
      if (!depictItemKeysBySeed.has(seedQid)) {
        depictItemKeysBySeed.set(seedQid, new Set())
      }
      const dedupeKeys = depictItemKeysBySeed.get(seedQid)
      const depictKey = depictQid.toLowerCase()
      if (dedupeKeys.has(depictKey)) {
        continue
      }
      dedupeKeys.add(depictKey)
      depictItemsBySeed.get(seedQid).push({
        id: depictQid,
        label:
          binding.depictItemLabel &&
          typeof binding.depictItemLabel === 'object' &&
          typeof binding.depictItemLabel.value === 'string'
            ? binding.depictItemLabel.value.trim()
            : '',
        description:
          binding.depictItemDescription &&
          typeof binding.depictItemDescription === 'object' &&
          typeof binding.depictItemDescription.value === 'string'
            ? binding.depictItemDescription.value.trim()
            : '',
      })
    }

    const items = []
    const seenDepictQids = new Set()
    outerLoop:
    for (const seedQid of limitedQids) {
      const seedItems = depictItemsBySeed.get(seedQid)
      if (!Array.isArray(seedItems) || seedItems.length === 0) {
        continue
      }
      for (const item of seedItems) {
        const qid = extractWikidataId(String(item && item.id ? item.id : ''))
        if (!qid || seenDepictQids.has(qid)) {
          continue
        }
        seenDepictQids.add(qid)
        items.push(item)
        if (items.length >= resultLimit) {
          break outerLoop
        }
      }
    }

    return items
  }

  async function fetchNearbyOsmCommonsCategories(latitude, longitude, {
    radiusMeters = SAVE_IMAGE_NEARBY_OSM_RADIUS_METERS,
    limit = SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS,
  } = {}) {
    void latitude
    void longitude
    void radiusMeters
    void limit
    return []
  }

  async function fetchNearbyOsmDepictItems(latitude, longitude, {
    radiusMeters = SAVE_IMAGE_NEARBY_OSM_RADIUS_METERS,
    limit = SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS,
    lang = null,
  } = {}) {
    void latitude
    void longitude
    void radiusMeters
    void limit
    void lang
    return []
  }

  function normalizeOsmTagKeyForWikidataMapping(value) {
    const normalized = String(value || '').trim().toLowerCase()
    if (!normalized) {
      return ''
    }
    if (normalized.length > 64) {
      return ''
    }
    if (!/^[a-z0-9:_-]+$/.test(normalized)) {
      return ''
    }
    return normalized
  }

  function normalizeOsmTagValueForWikidataMapping(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
    if (!normalized) {
      return ''
    }
    if (normalized.length > 96) {
      return ''
    }
    if (/[\n\r\t]/.test(normalized)) {
      return ''
    }
    return normalized
  }

  function normalizeOsmTagPairForWikidataMapping(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
    if (!normalized) {
      return ''
    }
    const separatorIndex = normalized.indexOf('=')
    if (separatorIndex <= 0 || separatorIndex >= normalized.length - 1) {
      return ''
    }
    const key = normalizeOsmTagKeyForWikidataMapping(normalized.slice(0, separatorIndex))
    const tagValue = normalizeOsmTagValueForWikidataMapping(normalized.slice(separatorIndex + 1))
    if (!key || !tagValue) {
      return ''
    }
    return `${key}=${tagValue}`
  }

  function shouldIgnoreOsmTagForWikidataMapping(tagKey) {
    const normalizedKey = normalizeOsmTagKeyForWikidataMapping(tagKey)
    if (!normalizedKey) {
      return true
    }
    if (
      normalizedKey === 'wikidata' ||
      normalizedKey === 'wikipedia' ||
      normalizedKey === 'area' ||
      normalizedKey === 'name' ||
      normalizedKey === 'alt_name' ||
      normalizedKey === 'official_name' ||
      normalizedKey === 'description' ||
      normalizedKey === 'note' ||
      normalizedKey === 'fixme' ||
      normalizedKey === 'source' ||
      normalizedKey === 'image' ||
      normalizedKey === 'website' ||
      normalizedKey === 'url' ||
      normalizedKey === 'email' ||
      normalizedKey === 'phone'
    ) {
      return true
    }
    if (
      normalizedKey.startsWith('addr:') ||
      normalizedKey.startsWith('contact:') ||
      normalizedKey.startsWith('source:') ||
      normalizedKey.startsWith('name:') ||
      normalizedKey.startsWith('ref:') ||
      normalizedKey.startsWith('old_name:')
    ) {
      return true
    }
    return false
  }

  const OSM_FEATURE_TYPE_GENERIC_VALUES = new Set([
    'yes',
    'no',
    '1',
    '0',
    'true',
    'false',
    'unknown',
    'unclassified',
    'undefined',
    'other',
    'none',
    'null',
  ])

  function splitNormalizedOsmTagPair(tagPair) {
    const normalizedTagPair = normalizeOsmTagPairForWikidataMapping(tagPair)
    if (!normalizedTagPair) {
      return { key: '', value: '' }
    }
    const separatorIndex = normalizedTagPair.indexOf('=')
    if (separatorIndex < 1) {
      return { key: '', value: '' }
    }
    return {
      key: normalizedTagPair.slice(0, separatorIndex),
      value: normalizedTagPair.slice(separatorIndex + 1),
    }
  }

  function isGenericOsmFeatureTypeValue(value) {
    const normalizedValue = normalizeOsmTagValueForWikidataMapping(value)
    if (!normalizedValue) {
      return true
    }
    return OSM_FEATURE_TYPE_GENERIC_VALUES.has(normalizedValue)
  }

  function pickPrimaryOsmTypeTagForSuggestion(tagPairs) {
    const normalizedTagPairs = []
    const seenTagPairs = new Set()
    for (const rawTagPair of Array.isArray(tagPairs) ? tagPairs : []) {
      const normalizedTagPair = normalizeOsmTagPairForWikidataMapping(rawTagPair)
      if (!normalizedTagPair || seenTagPairs.has(normalizedTagPair)) {
        continue
      }
      seenTagPairs.add(normalizedTagPair)
      normalizedTagPairs.push(normalizedTagPair)
    }
    if (normalizedTagPairs.length < 1) {
      return ''
    }

    const preferredTypeKeys = [
      'amenity',
      'public_transport',
      'railway',
      'highway',
      'building',
      'tourism',
      'shop',
      'leisure',
      'natural',
      'landuse',
      'waterway',
      'aeroway',
      'historic',
      'man_made',
      'route',
      'healthcare',
      'office',
      'craft',
      'power',
      'boundary',
      'place',
      'barrier',
    ]

    for (const preferredKey of preferredTypeKeys) {
      const specificMatch = normalizedTagPairs.find((tagPair) => {
        const pair = splitNormalizedOsmTagPair(tagPair)
        return pair.key === preferredKey && !isGenericOsmFeatureTypeValue(pair.value)
      })
      if (specificMatch) {
        return specificMatch
      }
      const genericMatch = normalizedTagPairs.find((tagPair) => splitNormalizedOsmTagPair(tagPair).key === preferredKey)
      if (genericMatch) {
        return genericMatch
      }
    }

    return normalizedTagPairs
      .slice()
      .sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }))[0]
  }

  const OSM_FEATURE_TYPE_KEY_LABELS = {
    en: {
      amenity: 'Amenity',
      building: 'Building',
      landuse: 'Land use',
      natural: 'Natural feature',
      boundary: 'Boundary',
      highway: 'Road',
      tourism: 'Tourism',
      shop: 'Shop',
      leisure: 'Leisure',
      historic: 'Historic site',
      man_made: 'Built structure',
      railway: 'Railway',
      public_transport: 'Public transport',
      place: 'Place',
      waterway: 'Waterway',
      aeroway: 'Aeroway',
      route: 'Route',
      power: 'Power infrastructure',
      office: 'Office',
      craft: 'Craft',
      healthcare: 'Healthcare',
      station: 'Station type',
      bus: 'Bus',
      tram: 'Tram',
      subway: 'Subway',
      ferry: 'Ferry',
      parking: 'Parking',
      sport: 'Sport',
      bridge: 'Bridge',
      tunnel: 'Tunnel',
      service: 'Service type',
      aerialway: 'Cable transport',
      barrier: 'Barrier',
      junction: 'Junction',
      water: 'Water type',
      landcover: 'Land cover',
      area: 'Area',
    },
    fi: {
      amenity: 'Palvelu',
      building: 'Rakennus',
      landuse: 'Maankaytto',
      natural: 'Luontokohde',
      boundary: 'Raja',
      highway: 'Tie',
      tourism: 'Matkailukohde',
      shop: 'Liike',
      leisure: 'Vapaa-ajan kohde',
      historic: 'Historiallinen kohde',
      man_made: 'Rakennettu kohde',
      railway: 'Rautatiekohde',
      public_transport: 'Joukkoliikennekohde',
      place: 'Paikka',
      waterway: 'Vesisto',
      aeroway: 'Ilmailukohde',
      route: 'Reitti',
      power: 'Sahkoinfra',
      office: 'Toimisto',
      craft: 'Kasityo',
      healthcare: 'Terveydenhuolto',
      station: 'Aseman tyyppi',
      bus: 'Bussi',
      tram: 'Raitiovaunu',
      subway: 'Metro',
      ferry: 'Lautta',
      parking: 'Pysakointi',
      sport: 'Urheilu',
      bridge: 'Silta',
      tunnel: 'Tunneli',
      service: 'Palvelutyyppi',
      aerialway: 'Koysirata',
      barrier: 'Este',
      junction: 'Liittyma',
      water: 'Vesityyppi',
      landcover: 'Maanpeite',
      area: 'Alue',
    },
    sv: {
      amenity: 'Service',
      building: 'Byggnad',
      landuse: 'Markanvandning',
      natural: 'Naturobjekt',
      boundary: 'Grans',
      highway: 'Vag',
      tourism: 'Turismobjekt',
      shop: 'Butik',
      leisure: 'Fritidsobjekt',
      historic: 'Historiskt objekt',
      man_made: 'Byggd struktur',
      railway: 'Jarnvagsobjekt',
      public_transport: 'Kollektivtrafikobjekt',
      place: 'Plats',
      waterway: 'Vattendrag',
      aeroway: 'Flygobjekt',
      route: 'Rutt',
      power: 'Elinfrastruktur',
      office: 'Kontor',
      craft: 'Handverk',
      healthcare: 'Halsovard',
      station: 'Stationstyp',
      bus: 'Buss',
      tram: 'Sparvagn',
      subway: 'Tunnelbana',
      ferry: 'Farja',
      parking: 'Parkering',
      sport: 'Sport',
      bridge: 'Bro',
      tunnel: 'Tunnel',
      service: 'Servicetyp',
      aerialway: 'Linbana',
      barrier: 'Hinder',
      junction: 'Korsning',
      water: 'Vattentyp',
      landcover: 'Marktacke',
      area: 'Omrade',
    },
  }

  const OSM_FEATURE_TYPE_PAIR_LABELS = {
    en: {
      'building=apartments': 'Apartment building',
      'building=residential': 'Residential building',
      'building=house': 'House',
      'building=detached': 'Detached house',
      'building=commercial': 'Commercial building',
      'building=industrial': 'Industrial building',
      'building=retail': 'Retail building',
      'building=warehouse': 'Warehouse',
      'amenity=school': 'School',
      'amenity=kindergarten': 'Kindergarten',
      'amenity=hospital': 'Hospital',
      'amenity=clinic': 'Clinic',
      'amenity=restaurant': 'Restaurant',
      'amenity=cafe': 'Cafe',
      'amenity=pub': 'Pub',
      'amenity=bar': 'Bar',
      'amenity=parking': 'Parking area',
      'amenity=library': 'Library',
      'amenity=townhall': 'Town hall',
      'amenity=place_of_worship': 'Place of worship',
      'tourism=museum': 'Museum',
      'tourism=attraction': 'Attraction',
      'tourism=viewpoint': 'Viewpoint',
      'leisure=park': 'Park',
      'natural=water': 'Water area',
      'natural=wood': 'Woodland',
      'landuse=residential': 'Residential area',
      'highway=residential': 'Residential street',
      'highway=service': 'Service road',
      'highway=footway': 'Footway',
      'highway=path': 'Path',
      'highway=cycleway': 'Cycleway',
      'boundary=administrative': 'Administrative boundary',
      'railway=station': 'Railway station',
      'place=neighbourhood': 'Neighbourhood',
      'place=suburb': 'Suburb',
    },
    fi: {
      'building=apartments': 'Kerrostalo',
      'building=residential': 'Asuinrakennus',
      'building=house': 'Talo',
      'building=detached': 'Omakotitalo',
      'building=commercial': 'Liikerakennus',
      'building=industrial': 'Teollisuusrakennus',
      'building=retail': 'Myymalarakennus',
      'building=warehouse': 'Varasto',
      'amenity=school': 'Koulu',
      'amenity=kindergarten': 'Paivakoti',
      'amenity=hospital': 'Sairaala',
      'amenity=clinic': 'Klinikka',
      'amenity=restaurant': 'Ravintola',
      'amenity=cafe': 'Kahvila',
      'amenity=pub': 'Pubi',
      'amenity=bar': 'Baari',
      'amenity=parking': 'Pysakointialue',
      'amenity=library': 'Kirjasto',
      'amenity=townhall': 'Kaupungintalo',
      'amenity=place_of_worship': 'Uskonnollinen rakennus',
      'tourism=museum': 'Museo',
      'tourism=attraction': 'Nähtavyys',
      'tourism=viewpoint': 'Nakopaikka',
      'leisure=park': 'Puisto',
      'natural=water': 'Vesialue',
      'natural=wood': 'Metsikko',
      'landuse=residential': 'Asuinalue',
      'highway=residential': 'Asuntokatu',
      'highway=service': 'Huoltotie',
      'highway=footway': 'Kaytava',
      'highway=path': 'Polku',
      'highway=cycleway': 'Pyoratie',
      'boundary=administrative': 'Hallinnollinen raja',
      'railway=station': 'Rautatieasema',
      'place=neighbourhood': 'Kaupunginosa',
      'place=suburb': 'Lahio',
    },
    sv: {
      'building=apartments': 'Flerbostadshus',
      'building=residential': 'Bostadsbyggnad',
      'building=house': 'Hus',
      'building=detached': 'Fristaende hus',
      'building=commercial': 'Affarsbyggnad',
      'building=industrial': 'Industribyggnad',
      'building=retail': 'Butiksbyggnad',
      'building=warehouse': 'Lager',
      'amenity=school': 'Skola',
      'amenity=kindergarten': 'Daghem',
      'amenity=hospital': 'Sjukhus',
      'amenity=clinic': 'Klinik',
      'amenity=restaurant': 'Restaurang',
      'amenity=cafe': 'Kafe',
      'amenity=pub': 'Pub',
      'amenity=bar': 'Bar',
      'amenity=parking': 'Parkeringsomrade',
      'amenity=library': 'Bibliotek',
      'amenity=townhall': 'Stadshus',
      'amenity=place_of_worship': 'Religios byggnad',
      'tourism=museum': 'Museum',
      'tourism=attraction': 'Sevardhet',
      'tourism=viewpoint': 'Utsiktsplats',
      'leisure=park': 'Park',
      'natural=water': 'Vattenomrade',
      'natural=wood': 'Skogsomrade',
      'landuse=residential': 'Bostadsomrade',
      'highway=residential': 'Bostadsgata',
      'highway=service': 'Servic vag',
      'highway=footway': 'Gangvag',
      'highway=path': 'Stig',
      'highway=cycleway': 'Cykelvag',
      'boundary=administrative': 'Administrativ grans',
      'railway=station': 'Jarnvagsstation',
      'place=neighbourhood': 'Stadsdel',
      'place=suburb': 'Forort',
    },
  }

  const OSM_FEATURE_TYPE_VALUE_LABELS = {
    en: {
      amenity: {
        school: 'School',
        kindergarten: 'Kindergarten',
        university: 'University',
        college: 'College',
        hospital: 'Hospital',
        clinic: 'Clinic',
        doctors: 'Doctor clinic',
        dentist: 'Dental clinic',
        pharmacy: 'Pharmacy',
        restaurant: 'Restaurant',
        cafe: 'Cafe',
        pub: 'Pub',
        bar: 'Bar',
        parking: 'Parking area',
        library: 'Library',
        townhall: 'Town hall',
        place_of_worship: 'Place of worship',
        bus_station: 'Bus station',
        ferry_terminal: 'Ferry terminal',
        fuel: 'Fuel station',
        police: 'Police station',
        fire_station: 'Fire station',
        post_office: 'Post office',
        marketplace: 'Market square',
        theatre: 'Theatre',
        cinema: 'Cinema',
        toilets: 'Public toilets',
        grave_yard: 'Graveyard',
      },
      building: {
        yes: 'Building',
        apartments: 'Apartment building',
        residential: 'Residential building',
        house: 'House',
        detached: 'Detached house',
        commercial: 'Commercial building',
        industrial: 'Industrial building',
        retail: 'Retail building',
        warehouse: 'Warehouse',
        school: 'School building',
        hospital: 'Hospital building',
        church: 'Church',
        civic: 'Civic building',
        garage: 'Garage',
        parking: 'Parking garage',
        office: 'Office building',
        train_station: 'Station building',
      },
      highway: {
        motorway: 'Motorway',
        primary: 'Primary road',
        secondary: 'Secondary road',
        tertiary: 'Tertiary road',
        residential: 'Residential street',
        service: 'Service road',
        living_street: 'Living street',
        pedestrian: 'Pedestrian street',
        footway: 'Footway',
        cycleway: 'Cycleway',
        path: 'Path',
        steps: 'Steps',
        track: 'Track',
        bus_stop: 'Bus stop',
      },
      landuse: {
        residential: 'Residential area',
        commercial: 'Commercial area',
        industrial: 'Industrial area',
        retail: 'Retail area',
        forest: 'Forest area',
        cemetery: 'Cemetery',
        recreation_ground: 'Recreation area',
        meadow: 'Meadow',
        farmland: 'Farmland',
        grass: 'Grass area',
        reservoir: 'Reservoir area',
      },
      natural: {
        water: 'Water area',
        wood: 'Woodland',
        scrub: 'Scrubland',
        wetland: 'Wetland',
        grassland: 'Grassland',
        heath: 'Heathland',
        beach: 'Beach',
        peak: 'Peak',
      },
      tourism: {
        museum: 'Museum',
        attraction: 'Attraction',
        viewpoint: 'Viewpoint',
        hotel: 'Hotel',
        hostel: 'Hostel',
        guest_house: 'Guest house',
        camp_site: 'Camp site',
        picnic_site: 'Picnic site',
        information: 'Visitor information',
      },
      shop: {
        supermarket: 'Supermarket',
        convenience: 'Convenience store',
        mall: 'Shopping mall',
        kiosk: 'Kiosk',
        bakery: 'Bakery',
        butcher: 'Butcher',
        clothes: 'Clothing store',
        hardware: 'Hardware store',
        florist: 'Florist',
      },
      leisure: {
        park: 'Park',
        pitch: 'Sports field',
        playground: 'Playground',
        sports_centre: 'Sports centre',
        garden: 'Garden',
        nature_reserve: 'Nature reserve',
        stadium: 'Stadium',
      },
      railway: {
        station: 'Railway station',
        tram_stop: 'Tram stop',
        halt: 'Railway halt',
        subway_entrance: 'Subway entrance',
        level_crossing: 'Level crossing',
      },
      public_transport: {
        station: 'Public transport station',
        platform: 'Public transport platform',
        stop_position: 'Public transport stop',
      },
      place: {
        neighbourhood: 'Neighbourhood',
        suburb: 'Suburb',
        quarter: 'Quarter',
        village: 'Village',
        town: 'Town',
        city: 'City',
        hamlet: 'Hamlet',
      },
      waterway: {
        river: 'River',
        stream: 'Stream',
        canal: 'Canal',
        ditch: 'Ditch',
      },
      aeroway: {
        aerodrome: 'Aerodrome',
        terminal: 'Airport terminal',
        runway: 'Runway',
        taxiway: 'Taxiway',
        helipad: 'Helipad',
        gate: 'Airport gate',
      },
      route: {
        bus: 'Bus route',
        tram: 'Tram route',
        train: 'Train route',
        ferry: 'Ferry route',
        bicycle: 'Bicycle route',
        hiking: 'Hiking route',
      },
      power: {
        substation: 'Substation',
        line: 'Power line',
        tower: 'Power tower',
        plant: 'Power plant',
        generator: 'Generator',
      },
      historic: {
        memorial: 'Memorial',
        monument: 'Monument',
        castle: 'Castle',
        archaeological_site: 'Archaeological site',
      },
      man_made: {
        tower: 'Tower',
        pier: 'Pier',
        bridge: 'Bridge',
        lighthouse: 'Lighthouse',
        chimney: 'Chimney',
      },
      healthcare: {
        hospital: 'Hospital',
        clinic: 'Clinic',
        doctor: 'Doctor service',
        dentist: 'Dental service',
        pharmacy: 'Pharmacy',
      },
      office: {
        company: 'Office',
        government: 'Government office',
        administrative: 'Administrative office',
      },
      craft: {
        carpenter: 'Carpenter',
        electrician: 'Electrician',
        plumber: 'Plumber',
        shoemaker: 'Shoemaker',
      },
      barrier: {
        fence: 'Fence',
        wall: 'Wall',
        bollard: 'Bollard',
        gate: 'Gate',
      },
    },
    fi: {
      amenity: {
        school: 'Koulu',
        kindergarten: 'Paivakoti',
        university: 'Yliopisto',
        college: 'Korkeakoulu',
        hospital: 'Sairaala',
        clinic: 'Klinikka',
        pharmacy: 'Apteekki',
        restaurant: 'Ravintola',
        cafe: 'Kahvila',
        pub: 'Pubi',
        bar: 'Baari',
        parking: 'Pysakointialue',
        library: 'Kirjasto',
        place_of_worship: 'Uskonnollinen rakennus',
        bus_station: 'Linja-autoasema',
        ferry_terminal: 'Lauttaterminaali',
        fuel: 'Huoltoasema',
        police: 'Poliisiasema',
        fire_station: 'Paloasema',
        post_office: 'Posti',
        marketplace: 'Tori',
      },
      building: {
        yes: 'Rakennus',
        apartments: 'Kerrostalo',
        residential: 'Asuinrakennus',
        house: 'Talo',
        detached: 'Omakotitalo',
        commercial: 'Liikerakennus',
        industrial: 'Teollisuusrakennus',
        retail: 'Myymalarakennus',
        warehouse: 'Varasto',
        school: 'Koulurakennus',
        hospital: 'Sairaalarakennus',
        church: 'Kirkko',
        office: 'Toimistorakennus',
      },
      highway: {
        motorway: 'Moottoritie',
        primary: 'Paatie',
        secondary: 'Seututie',
        tertiary: 'Yhdystie',
        residential: 'Asuntokatu',
        service: 'Huoltotie',
        living_street: 'Hidaskatu',
        pedestrian: 'Kavelykatu',
        footway: 'Kaytava',
        cycleway: 'Pyoratie',
        path: 'Polku',
        steps: 'Portaat',
        track: 'Metsatie',
        bus_stop: 'Bussipysakki',
      },
      landuse: {
        residential: 'Asuinalue',
        commercial: 'Liikealue',
        industrial: 'Teollisuusalue',
        retail: 'Kauppa-alue',
        forest: 'Metsa-alue',
        cemetery: 'Hautausmaa',
        recreation_ground: 'Virkistysalue',
        meadow: 'Niitty',
        farmland: 'Viljelysmaa',
      },
      natural: {
        water: 'Vesialue',
        wood: 'Metsikko',
        wetland: 'Kosteikko',
        beach: 'Ranta',
        peak: 'Huippu',
      },
      tourism: {
        museum: 'Museo',
        attraction: 'Nahtavyys',
        viewpoint: 'Nakopaikka',
        hotel: 'Hotelli',
        hostel: 'Hostelli',
        camp_site: 'Leirintaalue',
      },
      shop: {
        supermarket: 'Supermarket',
        convenience: 'Lahikauppa',
        kiosk: 'Kioski',
        bakery: 'Leipomo',
        butcher: 'Lihakauppa',
        clothes: 'Vaatekauppa',
      },
      leisure: {
        park: 'Puisto',
        pitch: 'Urheilukentta',
        playground: 'Leikkipuisto',
        sports_centre: 'Urheilukeskus',
        nature_reserve: 'Luonnonsuojelualue',
        stadium: 'Stadion',
      },
      railway: {
        station: 'Rautatieasema',
        tram_stop: 'Raitiovaunupysakki',
        halt: 'Seisake',
        subway_entrance: 'Metron sisaan kaynti',
      },
      public_transport: {
        station: 'Joukkoliikenneasema',
        platform: 'Joukkoliikennelaituri',
        stop_position: 'Joukkoliikennepysakki',
      },
      place: {
        neighbourhood: 'Kaupunginosa',
        suburb: 'Lahio',
        quarter: 'Kortteli',
        village: 'Kyla',
        town: 'Kaupunki',
        city: 'Suurkaupunki',
      },
      waterway: {
        river: 'Joki',
        stream: 'Puro',
        canal: 'Kanava',
        ditch: 'Oja',
      },
      aeroway: {
        aerodrome: 'Lentokentta',
        terminal: 'Lentoterminaali',
        runway: 'Kiitotie',
        taxiway: 'Rullaustie',
        helipad: 'Helikopterikentta',
      },
      route: {
        bus: 'Bussireitti',
        tram: 'Raitiovaunureitti',
        train: 'Junareitti',
        ferry: 'Lauttareitti',
        bicycle: 'Pyorareitti',
        hiking: 'Retkeilyreitti',
      },
      power: {
        substation: 'Sahkoasema',
        line: 'Sahkolinja',
        tower: 'Sahkomasto',
        plant: 'Voimalaitos',
      },
      historic: {
        memorial: 'Muistomerkki',
        monument: 'Monumentti',
        castle: 'Linna',
      },
      man_made: {
        tower: 'Torni',
        pier: 'Laituri',
        bridge: 'Silta',
        lighthouse: 'Majakka',
      },
      healthcare: {
        hospital: 'Sairaala',
        clinic: 'Klinikka',
        doctor: 'Laakaripalvelu',
        dentist: 'Hammaslaakari',
        pharmacy: 'Apteekki',
      },
      barrier: {
        fence: 'Aita',
        wall: 'Muuri',
        gate: 'Portti',
      },
    },
    sv: {
      amenity: {
        school: 'Skola',
        kindergarten: 'Daghem',
        university: 'Universitet',
        college: 'Hogskola',
        hospital: 'Sjukhus',
        clinic: 'Klinik',
        pharmacy: 'Apotek',
        restaurant: 'Restaurang',
        cafe: 'Kafe',
        pub: 'Pub',
        bar: 'Bar',
        parking: 'Parkeringsomrade',
        library: 'Bibliotek',
        place_of_worship: 'Religios byggnad',
        bus_station: 'Busstation',
        ferry_terminal: 'Farjeterminal',
        fuel: 'Bensinstation',
        police: 'Polisstation',
        fire_station: 'Brandstation',
        post_office: 'Postkontor',
        marketplace: 'Torg',
      },
      building: {
        yes: 'Byggnad',
        apartments: 'Flerbostadshus',
        residential: 'Bostadsbyggnad',
        house: 'Hus',
        detached: 'Fristaende hus',
        commercial: 'Affarsbyggnad',
        industrial: 'Industribyggnad',
        retail: 'Butiksbyggnad',
        warehouse: 'Lager',
        school: 'Skolbyggnad',
        hospital: 'Sjukhusbyggnad',
        church: 'Kyrka',
        office: 'Kontorsbyggnad',
      },
      highway: {
        motorway: 'Motorvag',
        primary: 'Huvudvag',
        secondary: 'Sekundar vag',
        tertiary: 'Tertiar vag',
        residential: 'Bostadsgata',
        service: 'Servicevag',
        living_street: 'Gangfartsomrade',
        pedestrian: 'Ganggata',
        footway: 'Gangvag',
        cycleway: 'Cykelvag',
        path: 'Stig',
        steps: 'Trappa',
        track: 'Skogsvag',
        bus_stop: 'Busshallplats',
      },
      landuse: {
        residential: 'Bostadsomrade',
        commercial: 'Handelsomrade',
        industrial: 'Industriomrade',
        retail: 'Butiksomrade',
        forest: 'Skogsomrade',
        cemetery: 'Begravningsplats',
        recreation_ground: 'Rekreationsomrade',
        meadow: 'Ang',
        farmland: 'Akermark',
      },
      natural: {
        water: 'Vattenomrade',
        wood: 'Skogsomrade',
        wetland: 'Vatmark',
        beach: 'Strand',
        peak: 'Topp',
      },
      tourism: {
        museum: 'Museum',
        attraction: 'Sevardhet',
        viewpoint: 'Utsiktsplats',
        hotel: 'Hotell',
        hostel: 'Vandrarhem',
        camp_site: 'Campingplats',
      },
      shop: {
        supermarket: 'Stormarknad',
        convenience: 'Narbutik',
        kiosk: 'Kiosk',
        bakery: 'Bageri',
        butcher: 'Kottbutik',
        clothes: 'Kladbutik',
      },
      leisure: {
        park: 'Park',
        pitch: 'Idrottsplan',
        playground: 'Lekplats',
        sports_centre: 'Idrottscenter',
        nature_reserve: 'Naturreservat',
        stadium: 'Stadion',
      },
      railway: {
        station: 'Jarnvagsstation',
        tram_stop: 'Sparvagnshallplats',
        halt: 'Taghallplats',
        subway_entrance: 'Tunnelbaneingang',
      },
      public_transport: {
        station: 'Kollektivtrafikstation',
        platform: 'Kollektivtrafikplattform',
        stop_position: 'Kollektivtrafikstopp',
      },
      place: {
        neighbourhood: 'Stadsdel',
        suburb: 'Forort',
        quarter: 'Kvarter',
        village: 'By',
        town: 'Stad',
        city: 'Storstad',
      },
      waterway: {
        river: 'Flod',
        stream: 'Back',
        canal: 'Kanal',
        ditch: 'Dike',
      },
      aeroway: {
        aerodrome: 'Flygplats',
        terminal: 'Flygterminal',
        runway: 'Landningsbana',
        taxiway: 'Taxibana',
        helipad: 'Helikopterplatta',
      },
      route: {
        bus: 'Busslinje',
        tram: 'Sparvagnslinje',
        train: 'Taglinje',
        ferry: 'Farjelinje',
        bicycle: 'Cykelrutt',
        hiking: 'Vandringsled',
      },
      power: {
        substation: 'Elstation',
        line: 'Elledning',
        tower: 'Elmast',
        plant: 'Kraftverk',
      },
      historic: {
        memorial: 'Minnesmarke',
        monument: 'Monument',
        castle: 'Slott',
      },
      man_made: {
        tower: 'Torn',
        pier: 'Brygga',
        bridge: 'Bro',
        lighthouse: 'Fyr',
      },
      healthcare: {
        hospital: 'Sjukhus',
        clinic: 'Klinik',
        doctor: 'Lakartjanst',
        dentist: 'Tandlakare',
        pharmacy: 'Apotek',
      },
      barrier: {
        fence: 'Stangsel',
        wall: 'Mur',
        gate: 'Grind',
      },
    },
  }

  const OSM_FEATURE_TYPE_COMBINATION_LABELS = {
    en: {
      busStop: 'Bus stop',
      busStation: 'Bus station',
      tramStop: 'Tram stop',
      railwayStation: 'Railway station',
      subwayStation: 'Subway station',
      ferryTerminal: 'Ferry terminal',
      airportTerminal: 'Airport terminal',
      runway: 'Runway',
      taxiway: 'Taxiway',
      helipad: 'Helipad',
      multistoreyParking: 'Multi-storey parking',
      footballPitch: 'Football field',
      basketballCourt: 'Basketball court',
      tennisCourt: 'Tennis court',
      iceRink: 'Ice rink',
      cemetery: 'Cemetery',
      protectedArea: 'Protected area',
      forestArea: 'Forest area',
      waterArea: 'Water area',
      placeOfWorship: 'Place of worship',
      roadBridge: 'Road bridge',
      railBridge: 'Railway bridge',
      roadTunnel: 'Road tunnel',
      railTunnel: 'Railway tunnel',
    },
    fi: {
      busStop: 'Bussipysakki',
      busStation: 'Linja-autoasema',
      tramStop: 'Raitiovaunupysakki',
      railwayStation: 'Rautatieasema',
      subwayStation: 'Metroasema',
      ferryTerminal: 'Lauttaterminaali',
      airportTerminal: 'Lentoterminaali',
      runway: 'Kiitotie',
      taxiway: 'Rullaustie',
      helipad: 'Helikopterikentta',
      multistoreyParking: 'Pysakointitalo',
      footballPitch: 'Jalkapallokentta',
      basketballCourt: 'Koripallokentta',
      tennisCourt: 'Tenniskentta',
      iceRink: 'Jaakaukalo',
      cemetery: 'Hautausmaa',
      protectedArea: 'Suojelualue',
      forestArea: 'Metsa-alue',
      waterArea: 'Vesialue',
      placeOfWorship: 'Uskonnollinen rakennus',
      roadBridge: 'Tiesilta',
      railBridge: 'Rautatiesilta',
      roadTunnel: 'Tietunneli',
      railTunnel: 'Rautatietunneli',
    },
    sv: {
      busStop: 'Busshallplats',
      busStation: 'Busstation',
      tramStop: 'Sparvagnshallplats',
      railwayStation: 'Jarnvagsstation',
      subwayStation: 'Tunnelbanestation',
      ferryTerminal: 'Farjeterminal',
      airportTerminal: 'Flygterminal',
      runway: 'Landningsbana',
      taxiway: 'Taxibana',
      helipad: 'Helikopterplatta',
      multistoreyParking: 'Parkeringshus',
      footballPitch: 'Fotbollsplan',
      basketballCourt: 'Basketplan',
      tennisCourt: 'Tennisplan',
      iceRink: 'Isrink',
      cemetery: 'Begravningsplats',
      protectedArea: 'Skyddsomrade',
      forestArea: 'Skogsomrade',
      waterArea: 'Vattenomrade',
      placeOfWorship: 'Religios byggnad',
      roadBridge: 'Vagbro',
      railBridge: 'Jarnvagsbro',
      roadTunnel: 'Vagtunnel',
      railTunnel: 'Jarnvagstunnel',
    },
  }

  function lookupLocalizedOsmPairLabel(pair, locale) {
    const localePairs = OSM_FEATURE_TYPE_PAIR_LABELS[locale] || {}
    if (Object.prototype.hasOwnProperty.call(localePairs, pair)) {
      return localePairs[pair]
    }
    const englishPairs = OSM_FEATURE_TYPE_PAIR_LABELS.en || {}
    if (Object.prototype.hasOwnProperty.call(englishPairs, pair)) {
      return englishPairs[pair]
    }
    return ''
  }

  function lookupLocalizedOsmKeyLabel(key, locale) {
    const localeKeys = OSM_FEATURE_TYPE_KEY_LABELS[locale] || {}
    if (Object.prototype.hasOwnProperty.call(localeKeys, key)) {
      return localeKeys[key]
    }
    const englishKeys = OSM_FEATURE_TYPE_KEY_LABELS.en || {}
    if (Object.prototype.hasOwnProperty.call(englishKeys, key)) {
      return englishKeys[key]
    }
    return ''
  }

  function lookupLocalizedOsmValueLabel(key, value, locale) {
    const localeByKey = OSM_FEATURE_TYPE_VALUE_LABELS[locale] || {}
    const localeValues = localeByKey && localeByKey[key] && typeof localeByKey[key] === 'object'
      ? localeByKey[key]
      : null
    if (localeValues && Object.prototype.hasOwnProperty.call(localeValues, value)) {
      return localeValues[value]
    }
    const englishByKey = OSM_FEATURE_TYPE_VALUE_LABELS.en || {}
    const englishValues = englishByKey && englishByKey[key] && typeof englishByKey[key] === 'object'
      ? englishByKey[key]
      : null
    if (englishValues && Object.prototype.hasOwnProperty.call(englishValues, value)) {
      return englishValues[value]
    }
    return ''
  }

  function lookupLocalizedOsmCombinationLabel(labelKey, locale) {
    const localeLabels = OSM_FEATURE_TYPE_COMBINATION_LABELS[locale] || {}
    if (Object.prototype.hasOwnProperty.call(localeLabels, labelKey)) {
      return localeLabels[labelKey]
    }
    const englishLabels = OSM_FEATURE_TYPE_COMBINATION_LABELS.en || {}
    if (Object.prototype.hasOwnProperty.call(englishLabels, labelKey)) {
      return englishLabels[labelKey]
    }
    return ''
  }

  function normalizeOsmFeatureTagsForUi(tags) {
    const normalizedTagMap = new Map()
    const normalizedPairs = []
    const seenPairs = new Set()
    for (const [rawKey, rawValue] of Object.entries(tags || {})) {
      const normalizedKey = normalizeOsmTagKeyForWikidataMapping(rawKey)
      if (!normalizedKey || shouldIgnoreOsmTagForWikidataMapping(normalizedKey)) {
        continue
      }
      const normalizedValue = normalizeOsmTagValueForWikidataMapping(rawValue)
      if (!normalizedValue) {
        continue
      }
      const normalizedPair = `${normalizedKey}=${normalizedValue}`
      if (seenPairs.has(normalizedPair)) {
        continue
      }
      seenPairs.add(normalizedPair)
      normalizedTagMap.set(normalizedKey, normalizedValue)
      normalizedPairs.push(normalizedPair)
    }
    return {
      normalizedTagMap,
      normalizedPairs,
    }
  }

  function describeOsmFeatureTypeFromTagCombination(normalizedTagMap, locale) {
    if (!(normalizedTagMap instanceof Map) || normalizedTagMap.size < 1) {
      return ''
    }

    const hasPair = (key, value) => normalizedTagMap.get(key) === value
    const hasKey = (key) => normalizedTagMap.has(key)
    const label = (labelKey) => lookupLocalizedOsmCombinationLabel(labelKey, locale)

    if (hasPair('railway', 'station') || hasPair('public_transport', 'station')) {
      if (hasPair('station', 'subway') || hasPair('subway', 'yes')) {
        return label('subwayStation')
      }
      return label('railwayStation')
    }

    if (
      hasPair('railway', 'tram_stop') ||
      ((hasPair('public_transport', 'platform') || hasPair('public_transport', 'stop_position')) && hasPair('tram', 'yes'))
    ) {
      return label('tramStop')
    }

    if (hasPair('amenity', 'bus_station')) {
      return label('busStation')
    }

    if (
      hasPair('highway', 'bus_stop') ||
      ((hasPair('public_transport', 'platform') || hasPair('public_transport', 'stop_position')) && hasPair('bus', 'yes'))
    ) {
      return label('busStop')
    }

    if (
      hasPair('amenity', 'ferry_terminal') ||
      hasPair('route', 'ferry') ||
      ((hasPair('public_transport', 'platform') || hasPair('public_transport', 'stop_position')) && hasPair('ferry', 'yes'))
    ) {
      return label('ferryTerminal')
    }

    if (hasPair('aeroway', 'terminal')) {
      return label('airportTerminal')
    }
    if (hasPair('aeroway', 'runway')) {
      return label('runway')
    }
    if (hasPair('aeroway', 'taxiway')) {
      return label('taxiway')
    }
    if (hasPair('aeroway', 'helipad')) {
      return label('helipad')
    }

    if (hasPair('amenity', 'parking') && (hasPair('parking', 'multi-storey') || hasPair('building', 'parking'))) {
      return label('multistoreyParking')
    }

    if (hasPair('leisure', 'pitch')) {
      if (hasPair('sport', 'football')) {
        return label('footballPitch')
      }
      if (hasPair('sport', 'basketball')) {
        return label('basketballCourt')
      }
      if (hasPair('sport', 'tennis')) {
        return label('tennisCourt')
      }
      if (hasPair('sport', 'ice_hockey')) {
        return label('iceRink')
      }
    }

    if (hasPair('landuse', 'cemetery') || hasPair('amenity', 'grave_yard')) {
      return label('cemetery')
    }
    if (hasPair('boundary', 'protected_area') || hasPair('leisure', 'nature_reserve')) {
      return label('protectedArea')
    }
    if (hasPair('natural', 'wood') || hasPair('landuse', 'forest')) {
      return label('forestArea')
    }
    if (
      hasPair('natural', 'water') ||
      hasPair('water', 'lake') ||
      hasPair('water', 'reservoir') ||
      hasPair('landuse', 'reservoir')
    ) {
      return label('waterArea')
    }
    if (hasPair('building', 'church') || hasPair('amenity', 'place_of_worship')) {
      return label('placeOfWorship')
    }

    if (hasPair('bridge', 'yes')) {
      if (hasKey('railway')) {
        return label('railBridge')
      }
      if (hasKey('highway')) {
        return label('roadBridge')
      }
    }
    if (hasPair('tunnel', 'yes')) {
      if (hasKey('railway')) {
        return label('railTunnel')
      }
      if (hasKey('highway')) {
        return label('roadTunnel')
      }
    }

    return ''
  }

  function resolveOsmFeatureLabelLocale(lang) {
    const normalized = normalizeSupportedLocale(lang) || 'en'
    if (normalized === 'fi' || normalized === 'sv') {
      return normalized
    }
    return 'en'
  }

  function humanizeOsmTagValueForUi(value) {
    return String(value || '')
      .trim()
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
  }

  function describeOsmFeatureTypeForUi(tags, { lang = null, primaryTagPair = '' } = {}) {
    const locale = resolveOsmFeatureLabelLocale(lang)
    const { normalizedTagMap, normalizedPairs } = normalizeOsmFeatureTagsForUi(tags)
    if (normalizedPairs.length < 1) {
      return ''
    }

    const combinationLabel = describeOsmFeatureTypeFromTagCombination(normalizedTagMap, locale)
    if (combinationLabel) {
      return combinationLabel
    }

    let normalizedPair = normalizeOsmTagPairForWikidataMapping(primaryTagPair)
    if (normalizedPair && !normalizedPairs.includes(normalizedPair)) {
      normalizedPair = ''
    }
    if (!normalizedPair) {
      normalizedPair = pickPrimaryOsmTypeTagForSuggestion(normalizedPairs)
    }
    if (!normalizedPair) {
      return ''
    }

    const pairLabel = lookupLocalizedOsmPairLabel(normalizedPair, locale)
    if (pairLabel) {
      return pairLabel
    }

    const pair = splitNormalizedOsmTagPair(normalizedPair)
    if (!pair.key) {
      return normalizedPair
    }

    const valueLabelFromDictionary = lookupLocalizedOsmValueLabel(pair.key, pair.value, locale)
    if (valueLabelFromDictionary) {
      return valueLabelFromDictionary
    }

    const keyLabel = lookupLocalizedOsmKeyLabel(pair.key, locale) || pair.key.replace(/_/g, ' ')
    if (isGenericOsmFeatureTypeValue(pair.value)) {
      return keyLabel
    }

    const valueLabel = humanizeOsmTagValueForUi(pair.value)
    if (!valueLabel) {
      return keyLabel
    }
    return `${keyLabel}: ${valueLabel}`
  }

  function escapeSparqlStringLiteral(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
  }

  function normalizeOsmFeatureNameForWikidataLookup(value) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim()
    if (normalized.length < 2) {
      return ''
    }
    return normalized.slice(0, 200)
  }

  function buildWikidataLookupLanguages(lang = null) {
    const normalizedLocale = normalizeSupportedLocale(lang) || 'en'
    const languages = [normalizedLocale, 'en']
    return Array.from(new Set(
      languages.filter((code) => /^[a-z]{2,12}(?:-[a-z0-9]{2,12})?$/i.test(String(code || '')))
    ))
  }

  const saveImageSubjectWikidataReverseLookupCache = new Map()

  function readCachedWikidataReverseLookupResult(cacheKey) {
    if (!saveImageSubjectWikidataReverseLookupCache.has(cacheKey)) {
      return null
    }
    const cached = saveImageSubjectWikidataReverseLookupCache.get(cacheKey)
    if (!cached || typeof cached !== 'object') {
      return null
    }
    const reverseCandidates = normalizeOsmMapFeatureReverseWikidataCandidates(
      cached.reverseCandidates || cached.reverse_candidates,
    )
    const nearbyNameCandidates = normalizeOsmMapFeatureReverseWikidataCandidates(
      cached.nearbyNameCandidates || cached.nearby_name_candidates,
    )
    return {
      reverseCandidates,
      nearbyNameCandidates,
    }
  }

  function writeCachedWikidataReverseLookupResult(cacheKey, payload) {
    if (!cacheKey) {
      return
    }
    if (saveImageSubjectWikidataReverseLookupCache.has(cacheKey)) {
      saveImageSubjectWikidataReverseLookupCache.delete(cacheKey)
    }
    saveImageSubjectWikidataReverseLookupCache.set(cacheKey, payload)
    while (saveImageSubjectWikidataReverseLookupCache.size > SAVE_IMAGE_SUBJECT_WIKIDATA_REVERSE_LOOKUP_CACHE_MAX_ITEMS) {
      const firstKey = saveImageSubjectWikidataReverseLookupCache.keys().next().value
      if (!firstKey) {
        break
      }
      saveImageSubjectWikidataReverseLookupCache.delete(firstKey)
    }
  }

  async function fetchWikidataReverseAndNearbyNameCandidatesForOsmFeature(
    featureType,
    featureId,
    {
      name = '',
      latitude = null,
      longitude = null,
      municipalityQid = '',
      lang = null,
      limit = SAVE_IMAGE_SUBJECT_WIKIDATA_REVERSE_LOOKUP_LIMIT,
      radiusKm = SAVE_IMAGE_SUBJECT_WIKIDATA_REVERSE_LOOKUP_RADIUS_KM,
    } = {},
  ) {
    const normalizedType = normalizeOsmMapFeatureType(featureType)
    const normalizedId = Number.parseInt(String(featureId), 10)
    if (!normalizedType || !Number.isFinite(normalizedId) || normalizedId < 1) {
      return {
        reverseCandidates: [],
        nearbyNameCandidates: [],
      }
    }

    let propertyId = ''
    if (normalizedType === 'way') {
      propertyId = 'P10689'
    } else if (normalizedType === 'relation') {
      propertyId = 'P402'
    }

    const lookupName = normalizeOsmFeatureNameForWikidataLookup(name)
    const latitudeValue = readOsmMapFeatureCoordinateValue(latitude)
    const longitudeValue = readOsmMapFeatureCoordinateValue(longitude)
    const normalizedMunicipalityQid = extractWikidataId(String(municipalityQid || ''))
    const hasIdLookup = Boolean(propertyId)
    const hasNameLookup = (
      lookupName &&
      latitudeValue !== null &&
      longitudeValue !== null
    )
    if (!hasIdLookup && !hasNameLookup) {
      return {
        reverseCandidates: [],
        nearbyNameCandidates: [],
      }
    }

    const resultLimit = Math.max(
      1,
      Math.min(Number.parseInt(String(limit), 10) || SAVE_IMAGE_SUBJECT_WIKIDATA_REVERSE_LOOKUP_LIMIT, 25),
    )
    const searchRadiusKm = Math.max(0.05, Math.min(Number(radiusKm) || SAVE_IMAGE_SUBJECT_WIKIDATA_REVERSE_LOOKUP_RADIUS_KM, 30))
    const lookupLanguages = buildWikidataLookupLanguages(lang)
    const languageClause = lookupLanguages.map((code) => `"${escapeSparqlStringLiteral(code)}"`).join(', ')
    const queryLanguage = lookupLanguages.join(',') || 'en'

    const cacheKey = [
      WIKIDATA_SPARQL_ENDPOINT_URL,
      normalizedType,
      String(normalizedId),
      lookupName.toLowerCase(),
      normalizedMunicipalityQid,
      latitudeValue === null ? '' : latitudeValue.toFixed(7),
      longitudeValue === null ? '' : longitudeValue.toFixed(7),
      queryLanguage,
      String(resultLimit),
      searchRadiusKm.toFixed(3),
    ].join('|')
    const cached = readCachedWikidataReverseLookupResult(cacheKey)
    if (cached) {
      return cached
    }

    const clauses = []
    if (hasIdLookup) {
      const escapedId = escapeSparqlStringLiteral(String(normalizedId))
      clauses.push(`
  {
    ?item wdt:${propertyId} "${escapedId}" .
    BIND("${propertyId}" AS ?property)
    BIND("ID" AS ?matchType)
    BIND("${escapedId}" AS ?matchValue)
    BIND(0 AS ?matchPriority)
    BIND(0.0 AS ?distanceSort)
  }
`.trim())
    }
    if (hasNameLookup) {
      const escapedName = escapeSparqlStringLiteral(lookupName)
      const municipalityNameFilterClause = normalizedMunicipalityQid
        ? `
    ?item wdt:P131 ?itemP131 .
    ?itemP131 wdt:P131* wd:${normalizedMunicipalityQid} .
`.trim()
        : ''
      clauses.push(`
  {
    SERVICE wikibase:around {
      ?item wdt:P625 ?location .
      bd:serviceParam wikibase:center "Point(${longitudeValue.toFixed(7)} ${latitudeValue.toFixed(7)})"^^geo:wktLiteral .
      bd:serviceParam wikibase:radius "${searchRadiusKm.toFixed(3)}" .
      bd:serviceParam wikibase:distance ?distance .
    }
    {
      ?item rdfs:label ?candidateLabel .
    }
    UNION
    {
      ?item skos:altLabel ?candidateLabel .
    }
    FILTER(LANG(?candidateLabel) IN (${languageClause}))
    FILTER(LCASE(STR(?candidateLabel)) = LCASE("${escapedName}"))
    ${municipalityNameFilterClause}
    BIND("NAME" AS ?property)
    BIND("NAME" AS ?matchType)
    BIND("${escapedName}" AS ?matchValue)
    BIND(1 AS ?matchPriority)
    BIND(?distance AS ?distanceSort)
  }
`.trim())
    }

    const sparql = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?item ?itemLabel ?itemDescription ?property ?matchType ?matchValue ?distanceSort
WHERE {
  ${clauses.join('\n  UNION\n  ')}
  FILTER(STRSTARTS(STR(?item), "http://www.wikidata.org/entity/Q"))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${queryLanguage}". }
}
ORDER BY ASC(?matchPriority) ASC(?distanceSort)
LIMIT ${Math.max(resultLimit * clauses.length, 1)}
`.trim()

    const requestBody = new URLSearchParams()
    requestBody.set('query', sparql)
    const requestUrl = new URL(WIKIDATA_SPARQL_ENDPOINT_URL)
    requestUrl.searchParams.set('format', 'json')
    const response = await fetch(requestUrl.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json, application/json;q=0.9, */*;q=0.1',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: requestBody.toString(),
    })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    const bindings =
      payload &&
      typeof payload === 'object' &&
      payload.results &&
      typeof payload.results === 'object' &&
      Array.isArray(payload.results.bindings)
        ? payload.results.bindings
        : []

    const reverseCandidates = []
    const nearbyNameCandidates = []
    const seenReverseQids = new Set()
    const seenNameQids = new Set()
    for (const binding of bindings) {
      if (!binding || typeof binding !== 'object') {
        continue
      }
      const qid = extractWikidataId(readSparqlBindingValue(binding, 'item'))
      if (!qid) {
        continue
      }
      const propertyValue = String(readSparqlBindingValue(binding, 'property') || propertyId || '').trim().toUpperCase()
      const matchType = String(readSparqlBindingValue(binding, 'matchType') || '').trim().toUpperCase()
      const matchValue = String(readSparqlBindingValue(binding, 'matchValue') || '').trim()
      const item = {
        id: qid,
        label: String(readSparqlBindingValue(binding, 'itemLabel') || '').trim(),
        description: String(readSparqlBindingValue(binding, 'itemDescription') || '').trim(),
        property: propertyValue,
        match_value: matchValue,
      }
      if (matchType === 'NAME' || propertyValue === 'NAME') {
        if (seenNameQids.has(qid)) {
          continue
        }
        seenNameQids.add(qid)
        const distanceValue = Number(readSparqlBindingValue(binding, 'distanceSort'))
        if (Number.isFinite(distanceValue)) {
          item.distance_km = distanceValue.toFixed(3)
        }
        nearbyNameCandidates.push(item)
        continue
      }
      if (seenReverseQids.has(qid)) {
        continue
      }
      seenReverseQids.add(qid)
      reverseCandidates.push(item)
    }

    const normalizedReverseCandidates = normalizeOsmMapFeatureReverseWikidataCandidates(reverseCandidates)
    const normalizedNearbyNameCandidates = normalizeOsmMapFeatureReverseWikidataCandidates(nearbyNameCandidates)
    const result = {
      reverseCandidates: normalizedReverseCandidates,
      nearbyNameCandidates: normalizedNearbyNameCandidates,
    }
    writeCachedWikidataReverseLookupResult(cacheKey, result)
    return result
  }

  async function fetchWikidataItemsForOsmTagMappings(osmKeys, osmTags, {
    limit = SAVE_IMAGE_SUBJECT_OSM_MAX_TAG_MAPPINGS,
    lang = null,
  } = {}) {
    const normalizedKeys = []
    const seenKeys = new Set()
    for (const rawKey of Array.isArray(osmKeys) ? osmKeys : []) {
      const normalizedKey = normalizeOsmTagKeyForWikidataMapping(rawKey)
      if (!normalizedKey || seenKeys.has(normalizedKey)) {
        continue
      }
      seenKeys.add(normalizedKey)
      normalizedKeys.push(normalizedKey)
    }

    const normalizedTags = []
    const seenTags = new Set()
    for (const rawTag of Array.isArray(osmTags) ? osmTags : []) {
      const normalizedTag = normalizeOsmTagPairForWikidataMapping(rawTag)
      if (!normalizedTag || seenTags.has(normalizedTag)) {
        continue
      }
      seenTags.add(normalizedTag)
      normalizedTags.push(normalizedTag)
    }

    const limitedKeys = normalizedKeys.slice(0, SAVE_IMAGE_SUBJECT_OSM_MAX_TAG_MAPPINGS)
    const limitedTags = normalizedTags.slice(0, SAVE_IMAGE_SUBJECT_OSM_MAX_TAG_MAPPINGS)
    if (limitedKeys.length === 0 && limitedTags.length === 0) {
      return {
        keyMatches: new Map(),
        tagMatches: new Map(),
        itemByQid: new Map(),
      }
    }

    const queryLanguage = normalizeSupportedLocale(lang) || 'en'
    const clauses = []
    if (limitedKeys.length > 0) {
      const keyValuesClause = limitedKeys.map((key) => `"${escapeSparqlStringLiteral(key)}"`).join(' ')
      clauses.push(`
  {
    VALUES ?osmKey { ${keyValuesClause} }
    ?item wdt:P13786 ?osmKey .
  }
`.trim())
    }
    if (limitedTags.length > 0) {
      const tagValuesClause = limitedTags.map((tag) => `"${escapeSparqlStringLiteral(tag)}"`).join(' ')
      clauses.push(`
  {
    VALUES ?osmTag { ${tagValuesClause} }
    ?item wdt:P1282 ?osmTag .
  }
`.trim())
    }
    if (clauses.length === 0) {
      return {
        keyMatches: new Map(),
        tagMatches: new Map(),
        itemByQid: new Map(),
      }
    }

    const resultLimit = Math.max(
      limitedKeys.length + limitedTags.length,
      Math.min((limitedKeys.length + limitedTags.length) * 6, 1000),
    )
    const sparql = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>

SELECT ?item ?itemLabel ?itemDescription ?osmKey ?osmTag
WHERE {
  ${clauses.join('\n  UNION\n  ')}
  FILTER(STRSTARTS(STR(?item), "http://www.wikidata.org/entity/Q"))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${queryLanguage},en". }
}
LIMIT ${resultLimit}
`.trim()

    const requestBody = new URLSearchParams()
    requestBody.set('query', sparql)
    const requestUrl = new URL(WIKIDATA_SPARQL_ENDPOINT_URL)
    requestUrl.searchParams.set('format', 'json')
    const response = await fetch(requestUrl.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: requestBody.toString(),
    })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    const bindings =
      payload &&
      typeof payload === 'object' &&
      payload.results &&
      typeof payload.results === 'object' &&
      Array.isArray(payload.results.bindings)
        ? payload.results.bindings
        : []

    const keyMatches = new Map()
    const keyMatchQids = new Map()
    const tagMatches = new Map()
    const tagMatchQids = new Map()
    const itemByQid = new Map()

    const pushMatch = (targetMap, seenMap, mappingKey, item) => {
      if (!mappingKey || !item || typeof item !== 'object') {
        return
      }
      if (!targetMap.has(mappingKey)) {
        targetMap.set(mappingKey, [])
      }
      if (!seenMap.has(mappingKey)) {
        seenMap.set(mappingKey, new Set())
      }
      const seenQidsForKey = seenMap.get(mappingKey)
      const qid = extractWikidataId(String(item.id || ''))
      if (!qid || seenQidsForKey.has(qid)) {
        return
      }
      seenQidsForKey.add(qid)
      targetMap.get(mappingKey).push(item)
    }

    for (const binding of bindings) {
      if (!binding || typeof binding !== 'object') {
        continue
      }
      const qid = extractWikidataId(
        binding.item &&
        typeof binding.item === 'object' &&
        typeof binding.item.value === 'string'
          ? binding.item.value
          : '',
      )
      if (!qid) {
        continue
      }
      const item = {
        id: qid,
        label:
          binding.itemLabel &&
          typeof binding.itemLabel === 'object' &&
          typeof binding.itemLabel.value === 'string'
            ? binding.itemLabel.value.trim()
            : '',
        description:
          binding.itemDescription &&
          typeof binding.itemDescription === 'object' &&
          typeof binding.itemDescription.value === 'string'
            ? binding.itemDescription.value.trim()
            : '',
      }
      if (!itemByQid.has(qid)) {
        itemByQid.set(qid, item)
      }

      const mappingKey = normalizeOsmTagKeyForWikidataMapping(
        binding.osmKey &&
        typeof binding.osmKey === 'object' &&
        typeof binding.osmKey.value === 'string'
          ? binding.osmKey.value
          : '',
      )
      if (mappingKey) {
        pushMatch(keyMatches, keyMatchQids, mappingKey, item)
      }

      const mappingTag = normalizeOsmTagPairForWikidataMapping(
        binding.osmTag &&
        typeof binding.osmTag === 'object' &&
        typeof binding.osmTag.value === 'string'
          ? binding.osmTag.value
          : '',
      )
      if (mappingTag) {
        pushMatch(tagMatches, tagMatchQids, mappingTag, item)
      }
    }

    return {
      keyMatches,
      tagMatches,
      itemByQid,
    }
  }

  async function fetchWikidataItemSummariesForQids(qids, { lang = null } = {}) {
    const normalizedQids = []
    const seenQids = new Set()
    for (const rawQid of Array.isArray(qids) ? qids : []) {
      const normalizedQid = extractWikidataId(String(rawQid || ''))
      if (!normalizedQid || seenQids.has(normalizedQid)) {
        continue
      }
      seenQids.add(normalizedQid)
      normalizedQids.push(normalizedQid)
    }
    if (normalizedQids.length === 0) {
      return new Map()
    }

    const valuesClause = normalizedQids.slice(0, 50).map((qid) => `wd:${qid}`).join(' ')
    const queryLanguage = normalizeSupportedLocale(lang) || 'en'
    const sparql = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>

SELECT ?item ?itemLabel ?itemDescription
WHERE {
  VALUES ?item { ${valuesClause} }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${queryLanguage},en". }
}
LIMIT ${normalizedQids.length}
`.trim()

    const requestBody = new URLSearchParams()
    requestBody.set('query', sparql)
    const requestUrl = new URL(WIKIDATA_SPARQL_ENDPOINT_URL)
    requestUrl.searchParams.set('format', 'json')
    const response = await fetch(requestUrl.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: requestBody.toString(),
    })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    const bindings =
      payload &&
      typeof payload === 'object' &&
      payload.results &&
      typeof payload.results === 'object' &&
      Array.isArray(payload.results.bindings)
        ? payload.results.bindings
        : []

    const itemByQid = new Map()
    for (const binding of bindings) {
      if (!binding || typeof binding !== 'object') {
        continue
      }
      const qid = extractWikidataId(
        binding.item &&
        typeof binding.item === 'object' &&
        typeof binding.item.value === 'string'
          ? binding.item.value
          : '',
      )
      if (!qid) {
        continue
      }
      itemByQid.set(qid, {
        id: qid,
        label:
          binding.itemLabel &&
          typeof binding.itemLabel === 'object' &&
          typeof binding.itemLabel.value === 'string'
            ? binding.itemLabel.value.trim()
            : '',
        description:
          binding.itemDescription &&
          typeof binding.itemDescription === 'object' &&
          typeof binding.itemDescription.value === 'string'
            ? binding.itemDescription.value.trim()
            : '',
      })
    }
    return itemByQid
  }

  async function fetchNearbyOsmDepictItemsFromClickedPoint(latitude, longitude, {
    radiusMeters = SAVE_IMAGE_SUBJECT_OSM_RADIUS_METERS,
    limit = SAVE_IMAGE_SUBJECT_NEARBY_MAP_FEATURE_BASE_LIMIT,
    lang = null,
  } = {}) {
    void latitude
    void longitude
    void radiusMeters
    void limit
    void lang
    return []
  }

  function normalizeOsmMapFeatureType(value) {
    const normalized = String(value || '').trim().toLowerCase()
    if (normalized === 'node' || normalized === 'way' || normalized === 'relation') {
      return normalized
    }
    return ''
  }

  function buildOsmMapFeatureKey(type, id) {
    const normalizedType = normalizeOsmMapFeatureType(type)
    const normalizedId = Number.parseInt(String(id), 10)
    if (!normalizedType || !Number.isFinite(normalizedId)) {
      return ''
    }
    return `${normalizedType}:${normalizedId}`
  }

  function readOsmMapFeatureCoordinateValue(value) {
    if (value === null || value === undefined) {
      return null
    }
    if (typeof value !== 'number' && typeof value !== 'string') {
      return null
    }
    const rawValue = typeof value === 'string' ? value.trim() : String(value)
    if (!rawValue) {
      return null
    }
    const parsed = Number(rawValue)
    return Number.isFinite(parsed) ? parsed : null
  }

  function readOsmMapFeatureCenter(element) {
    if (!element || typeof element !== 'object') {
      return { latitude: null, longitude: null }
    }
    const directLatitude = readOsmMapFeatureCoordinateValue(element.lat)
    const directLongitude = readOsmMapFeatureCoordinateValue(element.lon)
    if (directLatitude !== null && directLongitude !== null) {
      return { latitude: directLatitude, longitude: directLongitude }
    }
    const centerLatitude = (
      element.center && typeof element.center === 'object'
        ? readOsmMapFeatureCoordinateValue(element.center.lat)
        : null
    )
    const centerLongitude = (
      element.center && typeof element.center === 'object'
        ? readOsmMapFeatureCoordinateValue(element.center.lon)
        : null
    )
    if (centerLatitude !== null && centerLongitude !== null) {
      return { latitude: centerLatitude, longitude: centerLongitude }
    }
    if (Array.isArray(element.geometry) && element.geometry.length > 0) {
      const firstPoint = element.geometry.find((point) => (
        point &&
        typeof point === 'object' &&
        readOsmMapFeatureCoordinateValue(point.lat) !== null &&
        readOsmMapFeatureCoordinateValue(point.lon) !== null
      ))
      if (firstPoint) {
        return {
          latitude: readOsmMapFeatureCoordinateValue(firstPoint.lat),
          longitude: readOsmMapFeatureCoordinateValue(firstPoint.lon),
        }
      }
    }
    return { latitude: null, longitude: null }
  }

  function readPreferredOsmMapFeatureName(tags, queryLanguage = null) {
    if (!tags || typeof tags !== 'object') {
      return ''
    }
    const normalizedLanguage = String(normalizeSupportedLocale(queryLanguage) || '').trim().toLowerCase()
    const candidates = []
    if (normalizedLanguage) {
      candidates.push(`name:${normalizedLanguage}`)
      const baseLanguage = normalizedLanguage.split('-')[0]
      if (baseLanguage && baseLanguage !== normalizedLanguage) {
        candidates.push(`name:${baseLanguage}`)
      }
    }
    candidates.push('name', 'name:en')
    for (const key of candidates) {
      const value = typeof tags[key] === 'string' ? tags[key].trim() : ''
      if (value) {
        return value
      }
    }
    return ''
  }

  function hasOsmMapFeatureName(tags) {
    if (!tags || typeof tags !== 'object') {
      return false
    }
    return Object.entries(tags).some(([rawKey, rawValue]) => {
      const key = String(rawKey || '').trim().toLowerCase()
      if (!key || (key !== 'name' && !key.startsWith('name:'))) {
        return false
      }
      return Boolean(String(rawValue || '').trim())
    })
  }

  function readOsmMapFeatureAddressText(tags) {
    if (!tags || typeof tags !== 'object') {
      return ''
    }
    const readFirstTagValue = (...candidateKeys) => {
      for (const candidateKey of candidateKeys) {
        const value = typeof tags[candidateKey] === 'string' ? tags[candidateKey].trim() : ''
        if (value) {
          return value
        }
      }
      return ''
    }
    const street = readFirstTagValue('addr:street', 'addr_street')
    const place = readFirstTagValue('addr:place', 'addr_place')
    const houseNumber = readFirstTagValue('addr:housenumber', 'addr_housenumber')
    const streetOrPlace = street || place
    if (streetOrPlace && houseNumber) {
      return `${streetOrPlace} ${houseNumber}`.trim()
    }
    return streetOrPlace || houseNumber || ''
  }

  function buildOsmMapFeatureFallbackSummary(tags) {
    const pairs = []
    for (const [rawKey, rawValue] of Object.entries(tags || {})) {
      const key = normalizeOsmTagKeyForWikidataMapping(rawKey)
      if (!key || shouldIgnoreOsmTagForWikidataMapping(key)) {
        continue
      }
      const value = normalizeOsmTagValueForWikidataMapping(rawValue)
      if (!value) {
        continue
      }
      pairs.push(`${key}=${value}`)
      if (pairs.length >= 3) {
        break
      }
    }
    return pairs.join(', ')
  }

  function normalizeOsmMapFeatureForQueryList(element, {
    clickLatitude = null,
    clickLongitude = null,
    sourceKind = 'nearby',
    lang = null,
  } = {}) {
    if (!element || typeof element !== 'object') {
      return null
    }
    const type = normalizeOsmMapFeatureType(element.type)
    const id = Number.parseInt(String(element.id), 10)
    if (!type || !Number.isFinite(id)) {
      return null
    }
    const tags = element.tags && typeof element.tags === 'object'
      ? element.tags
      : {}
    const { latitude, longitude } = readOsmMapFeatureCenter(element)
    const distanceKm = haversineDistanceKilometers(
      clickLatitude,
      clickLongitude,
      latitude,
      longitude,
    )
    const distanceSortValue = Number.isFinite(distanceKm) ? Number(distanceKm) : Number.POSITIVE_INFINITY
    const distanceMeters = Number.isFinite(distanceSortValue)
      ? Math.max(0, Math.round(distanceSortValue * 1000))
      : null
    const normalizedTagPairs = []
    const detailTags = []
    for (const [rawKey, rawValue] of Object.entries(tags)) {
      const normalizedKey = normalizeOsmTagKeyForWikidataMapping(rawKey)
      if (!normalizedKey) {
        continue
      }
      const normalizedValue = normalizeOsmTagValueForWikidataMapping(rawValue)
      if (!normalizedValue) {
        continue
      }
      detailTags.push({ key: normalizedKey, value: normalizedValue })
      if (!shouldIgnoreOsmTagForWikidataMapping(normalizedKey)) {
        normalizedTagPairs.push(`${normalizedKey}=${normalizedValue}`)
      }
    }
    detailTags.sort((left, right) => left.key.localeCompare(right.key, 'en', { sensitivity: 'base' }))
    const primaryTypeTag = pickPrimaryOsmTypeTagForSuggestion(normalizedTagPairs)
    const featureTypeDescription = describeOsmFeatureTypeForUi(tags, {
      lang,
      primaryTagPair: primaryTypeTag,
    })
    const preferredName = readPreferredOsmMapFeatureName(tags, lang)
    const addressText = readOsmMapFeatureAddressText(tags)
    const fallbackSummary = buildOsmMapFeatureFallbackSummary(tags)
    const geometryWkt = typeof element.geometryWkt === 'string'
      ? element.geometryWkt.trim()
      : ''
    const displayLabel = preferredName
      || (
        featureTypeDescription
          ? `${featureTypeDescription}${addressText ? ` ${addressText}` : ''}`
          : ''
      )
      || fallbackSummary
      || `${type} ${id}`
    const displayMetaParts = [`${type} ${id}`]
    if (distanceMeters !== null) {
      displayMetaParts.push(`${distanceMeters} m`)
    }
    if (
      featureTypeDescription &&
      featureTypeDescription !== displayLabel &&
      !displayLabel.startsWith(`${featureTypeDescription} `)
    ) {
      displayMetaParts.unshift(featureTypeDescription)
    }
    const key = buildOsmMapFeatureKey(type, id)
    if (!key) {
      return null
    }
    return {
      key,
      type,
      id,
      sourceKind: sourceKind === 'enclosing' ? 'enclosing' : 'nearby',
      displayLabel,
      featureTypeDescription,
      addressText,
      displayMeta: displayMetaParts.join(' · '),
      distanceSortValue,
      distanceMeters,
      hasNameTag: hasOsmMapFeatureName(tags),
      primaryTypeTag,
      tags: detailTags,
      rawTags: tags,
      latitude,
      longitude,
      geometryWkt,
      directQid: extractWikidataId(String(tags.wikidata || '')),
      osmUrl: `https://www.openstreetmap.org/${type}/${id}`,
    }
  }

  function sortSaveImageSubjectNearbyFeaturesInPlace(features) {
    if (!Array.isArray(features)) {
      return
    }
    features.sort((left, right) => {
      const leftDistance = Number.isFinite(Number(left && left.distanceSortValue))
        ? Number(left.distanceSortValue)
        : Number.POSITIVE_INFINITY
      const rightDistance = Number.isFinite(Number(right && right.distanceSortValue))
        ? Number(right && right.distanceSortValue)
        : Number.POSITIVE_INFINITY
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance
      }
      const leftLabel = left && typeof left.displayLabel === 'string'
        ? left.displayLabel
        : ''
      const rightLabel = right && typeof right.displayLabel === 'string'
        ? right.displayLabel
        : ''
      return leftLabel.localeCompare(rightLabel, 'en', { sensitivity: 'base' })
    })
  }

  function buildSaveImageSubjectNameGroupKey(value) {
    const normalizedName = normalizeTextForCompare(value).replace(/\s+/g, ' ')
    if (!normalizedName) {
      return ''
    }
    return `name-group:${normalizedName}`
  }

  function mergeSaveImageSubjectNearbyFeaturesByName(features, { lang = null } = {}) {
    const sourceFeatures = Array.isArray(features) ? features : []
    const ungroupedFeatures = []
    const groupedFeatures = new Map()

    for (const feature of sourceFeatures) {
      if (!feature || typeof feature !== 'object') {
        continue
      }
      const rawTags = feature.rawTags && typeof feature.rawTags === 'object'
        ? feature.rawTags
        : {}
      const featureName = String(readPreferredOsmMapFeatureName(rawTags, lang) || '').trim()
      const groupKey = buildSaveImageSubjectNameGroupKey(featureName)
      if (!groupKey) {
        ungroupedFeatures.push(feature)
        continue
      }
      if (!groupedFeatures.has(groupKey)) {
        groupedFeatures.set(groupKey, [])
      }
      groupedFeatures.get(groupKey).push(feature)
    }

    const mergedFeatures = [...ungroupedFeatures]
    for (const [groupKey, groupItemsRaw] of groupedFeatures.entries()) {
      const groupItems = Array.isArray(groupItemsRaw) ? groupItemsRaw.slice() : []
      if (groupItems.length < 1) {
        continue
      }
      if (groupItems.length === 1) {
        mergedFeatures.push(groupItems[0])
        continue
      }
      sortSaveImageSubjectNearbyFeaturesInPlace(groupItems)
      const primaryFeature = groupItems[0]
      if (!primaryFeature || typeof primaryFeature !== 'object') {
        continue
      }

      const primaryRawTags = primaryFeature.rawTags && typeof primaryFeature.rawTags === 'object'
        ? primaryFeature.rawTags
        : {}
      const groupedName = String(
        readPreferredOsmMapFeatureName(primaryRawTags, lang) ||
        primaryFeature.displayLabel ||
        ''
      ).trim()
      const groupedDistanceMeters = Number.isFinite(Number(primaryFeature.distanceMeters))
        ? Math.max(0, Math.round(Number(primaryFeature.distanceMeters)))
        : null
      const groupedDistanceSortValue = Number.isFinite(Number(primaryFeature.distanceSortValue))
        ? Number(primaryFeature.distanceSortValue)
        : Number.POSITIVE_INFINITY
      const groupedDisplayMetaParts = []
      if (
        primaryFeature.featureTypeDescription &&
        primaryFeature.featureTypeDescription !== groupedName
      ) {
        groupedDisplayMetaParts.push(primaryFeature.featureTypeDescription)
      }
      groupedDisplayMetaParts.push(`x${groupItems.length}`)
      if (groupedDistanceMeters !== null) {
        groupedDisplayMetaParts.push(`${groupedDistanceMeters} m`)
      }
      const groupedLatitude = readOsmMapFeatureCoordinateValue(primaryFeature.latitude)
      const groupedLongitude = readOsmMapFeatureCoordinateValue(primaryFeature.longitude)

      const directQidsInOrder = []
      const seenDirectQids = new Set()
      for (const groupItem of groupItems) {
        const directQid = extractWikidataId(
          String(
            (groupItem && groupItem.directQid)
            || (groupItem && groupItem.rawTags && groupItem.rawTags.wikidata ? groupItem.rawTags.wikidata : '')
            || '',
          ),
        )
        if (!directQid || seenDirectQids.has(directQid)) {
          continue
        }
        seenDirectQids.add(directQid)
        directQidsInOrder.push(directQid)
      }
      const primaryDirectQid = extractWikidataId(
        String(
          primaryFeature.directQid ||
          (primaryRawTags && primaryRawTags.wikidata ? primaryRawTags.wikidata : '') ||
          '',
        ),
      )
      const groupedDirectQid = primaryDirectQid || (directQidsInOrder[0] || '')
      const groupedRawTags = {
        ...primaryRawTags,
      }
      if (groupedName) {
        groupedRawTags.name = groupedName
      }
      if (groupedDirectQid) {
        groupedRawTags.wikidata = groupedDirectQid
      }

      mergedFeatures.push({
        ...primaryFeature,
        key: groupKey,
        type: '',
        id: null,
        sourceKind: 'nearby',
        displayLabel: groupedName || String(primaryFeature.displayLabel || '').trim() || groupKey,
        displayMeta: groupedDisplayMetaParts.join(' · '),
        distanceSortValue: groupedDistanceSortValue,
        distanceMeters: groupedDistanceMeters,
        latitude: groupedLatitude,
        longitude: groupedLongitude,
        rawTags: groupedRawTags,
        directQid: groupedDirectQid,
        mergedDirectQids: directQidsInOrder,
        mergedComponents: groupItems.map((item) => ({ ...item })),
        mergedFeatureCount: groupItems.length,
      })
    }

    sortSaveImageSubjectNearbyFeaturesInPlace(mergedFeatures)
    return mergedFeatures
  }

  function normalizeOsmMapFeatureReverseWikidataCandidates(candidates) {
    const normalizedCandidates = []
    const seenQids = new Set()
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
      if (!candidate || typeof candidate !== 'object') {
        continue
      }
      const qid = extractWikidataId(String(candidate.id || ''))
      if (!qid || seenQids.has(qid)) {
        continue
      }
      seenQids.add(qid)
      normalizedCandidates.push({
        id: qid,
        label: String(candidate.label || '').trim(),
        description: String(candidate.description || '').trim(),
        property: String(candidate.property || '').trim().toUpperCase(),
        matchValue: String(candidate.match_value || candidate.matchValue || '').trim(),
      })
    }
    return normalizedCandidates
  }

  function mergeOsmMapFeatureReverseWikidataCandidates(...candidateGroups) {
    const mergedCandidates = []
    const seenQids = new Set()
    for (const candidates of candidateGroups) {
      const normalizedCandidates = normalizeOsmMapFeatureReverseWikidataCandidates(candidates)
      for (const candidate of normalizedCandidates) {
        const qid = extractWikidataId(String(candidate.id || ''))
        if (!qid || seenQids.has(qid)) {
          continue
        }
        seenQids.add(qid)
        mergedCandidates.push(candidate)
      }
    }
    return mergedCandidates
  }

  function mergeOsmMapFeatureWithLatestMetadata(feature, latestPayload, {
    clickLatitude = null,
    clickLongitude = null,
    lang = null,
  } = {}) {
    if (!feature || typeof feature !== 'object' || !latestPayload || typeof latestPayload !== 'object') {
      return null
    }
    const featureType = normalizeOsmMapFeatureType(feature.type)
    const featureId = Number.parseInt(String(feature.id), 10)
    const payloadType = normalizeOsmMapFeatureType(latestPayload.type)
    const payloadId = Number.parseInt(String(latestPayload.id), 10)
    if (
      !featureType ||
      !Number.isFinite(featureId) ||
      !payloadType ||
      !Number.isFinite(payloadId) ||
      payloadType !== featureType ||
      payloadId !== featureId
    ) {
      return null
    }

    const existingTags = feature.rawTags && typeof feature.rawTags === 'object'
      ? feature.rawTags
      : {}
    const mergedTags = { ...existingTags }
    const isAreaFeature = classifyWktGeometryKind(feature.geometryWkt) === 'area'
    const latestTags = latestPayload.tags && typeof latestPayload.tags === 'object'
      ? latestPayload.tags
      : {}
    for (const [rawKey, rawValue] of Object.entries(latestTags)) {
      const key = String(rawKey || '').trim()
      const normalizedKey = key.toLowerCase()
      const value = String(rawValue || '').trim()
      if (!key || !value) {
        continue
      }
      if (normalizedKey !== 'wikidata' && normalizedKey !== 'name' && !normalizedKey.startsWith('name:')) {
        continue
      }
      mergedTags[key] = value
    }

    const latestName = String(latestPayload.name || '').trim()
    if (latestName) {
      mergedTags.name = latestName
    }

    const directQidFromTags = extractWikidataId(String(mergedTags.wikidata || ''))
    const directQidFromPayload = extractWikidataId(String(latestPayload.wikidata || ''))
    const latestReverseCandidates = normalizeOsmMapFeatureReverseWikidataCandidates(
      latestPayload.wikidata_reverse_candidates || latestPayload.wikidataReverseCandidates,
    )
    const latestNameMatchCandidates = normalizeOsmMapFeatureReverseWikidataCandidates(
      latestPayload.wikidata_name_match_candidates || latestPayload.wikidataNameMatchCandidates,
    )
    const lookupName = normalizeTextForCompare(
      latestName ||
      mergedTags.name ||
      readPreferredOsmMapFeatureName(mergedTags, lang) ||
      feature.displayLabel ||
      '',
    )
    const nameAlignedIdCandidates = lookupName
      ? latestReverseCandidates.filter((candidate) => (
        candidate &&
        typeof candidate === 'object' &&
        candidate.property !== 'NAME' &&
        normalizeTextForCompare(candidate.label) === lookupName
      ))
      : []
    const nameMatchCandidates = mergeOsmMapFeatureReverseWikidataCandidates(
      latestReverseCandidates.filter((candidate) => candidate.property === 'NAME'),
      latestNameMatchCandidates,
      nameAlignedIdCandidates,
    )
    const idReverseCandidates = latestReverseCandidates.filter((candidate) => candidate.property !== 'NAME')
    const reverseCandidates = mergeOsmMapFeatureReverseWikidataCandidates(
      latestReverseCandidates,
      nameMatchCandidates,
    )
    const reverseQidFromPayload = isAreaFeature
      ? extractWikidataId(String(latestPayload.wikidata_reverse_qid || latestPayload.wikidataReverseQid || ''))
      : ''
    const reverseQidFromCandidates = isAreaFeature && idReverseCandidates.length > 0
      ? extractWikidataId(String(idReverseCandidates[0].id || ''))
      : ''
    const resolvedQid = directQidFromPayload || directQidFromTags || reverseQidFromPayload || reverseQidFromCandidates
    if (resolvedQid) {
      mergedTags.wikidata = resolvedQid
    }

    const payloadLatitude = readOsmMapFeatureCoordinateValue(latestPayload.lat)
    const payloadLongitude = readOsmMapFeatureCoordinateValue(latestPayload.lon)
    const fallbackLatitude = readOsmMapFeatureCoordinateValue(feature.latitude)
    const fallbackLongitude = readOsmMapFeatureCoordinateValue(feature.longitude)
    const effectiveLatitude = payloadLatitude !== null ? payloadLatitude : fallbackLatitude
    const effectiveLongitude = payloadLongitude !== null ? payloadLongitude : fallbackLongitude

    const normalizedFeature = normalizeOsmMapFeatureForQueryList(
      {
        type: featureType,
        id: featureId,
        tags: mergedTags,
        lat: effectiveLatitude,
        lon: effectiveLongitude,
        geometryWkt: String(feature.geometryWkt || '').trim(),
      },
      {
        clickLatitude,
        clickLongitude,
        sourceKind: feature.sourceKind,
        lang,
      },
    )
    if (!normalizedFeature) {
      return null
    }

    if (feature.geometryWkt && !normalizedFeature.geometryWkt) {
      normalizedFeature.geometryWkt = String(feature.geometryWkt || '').trim()
    }
    if (
      readOsmMapFeatureCoordinateValue(normalizedFeature.latitude) === null &&
      fallbackLatitude !== null
    ) {
      normalizedFeature.latitude = fallbackLatitude
    }
    if (
      readOsmMapFeatureCoordinateValue(normalizedFeature.longitude) === null &&
      fallbackLongitude !== null
    ) {
      normalizedFeature.longitude = fallbackLongitude
    }
    normalizedFeature.wikidataReverseCandidates = reverseCandidates
    normalizedFeature.wikidataNameMatchCandidates = nameMatchCandidates
    normalizedFeature.directQid = resolvedQid || extractWikidataId(String(feature.directQid || ''))
    return normalizedFeature
  }

  function readSparqlBindingValue(binding, variableName) {
    if (!binding || typeof binding !== 'object') {
      return ''
    }
    const name = String(variableName || '').trim()
    if (!name) {
      return ''
    }
    const valueNode = binding[name]
    if (!valueNode || typeof valueNode !== 'object' || typeof valueNode.value !== 'string') {
      return ''
    }
    return valueNode.value.trim()
  }

  function parseOsmFeatureReferenceFromUri(value) {
    const normalizedValue = String(value || '').trim()
    if (!normalizedValue) {
      return { type: '', id: null }
    }
    const match = normalizedValue.match(/\/(node|way|relation)\/(\d+)(?:[/?#]|$)/i)
    if (!match) {
      return { type: '', id: null }
    }
    const type = normalizeOsmMapFeatureType(match[1])
    const id = Number.parseInt(match[2], 10)
    if (!type || !Number.isFinite(id)) {
      return { type: '', id: null }
    }
    return { type, id }
  }

  function parseLatitudeLongitudeFromWkt(value) {
    const normalizedValue = String(value || '').trim()
    if (!normalizedValue) {
      return { latitude: null, longitude: null }
    }
    const pointMatch = normalizedValue.match(
      /POINT(?:\s+ZM|\s+Z|\s+M)?\s*\(\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)(?:\s+[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)?\s*\)/i,
    )
    if (pointMatch) {
      const longitude = Number(pointMatch[1])
      const latitude = Number(pointMatch[2])
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude }
      }
    }
    const numericTokens = normalizedValue.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g)
    if (!Array.isArray(numericTokens) || numericTokens.length < 2) {
      return { latitude: null, longitude: null }
    }
    const longitude = Number(numericTokens[0])
    const latitude = Number(numericTokens[1])
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { latitude: null, longitude: null }
    }
    return { latitude, longitude }
  }

  function buildSubjectNearbyFeaturesSparqlQuery(
    latitude,
    longitude,
    containerWikidataQid,
    nearbyLimit,
    { distanceMode = 'geof' } = {},
  ) {
    const latitudeValue = Number(latitude)
    const longitudeValue = Number(longitude)
    if (!Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue)) {
      return ''
    }
    const normalizedDistanceMode = (
      distanceMode === 'dist' || distanceMode === 'none'
        ? distanceMode
        : 'geof'
    )
    const normalizedContainerQid = (
      extractWikidataId(String(containerWikidataQid || ''))
      || SAVE_IMAGE_SUBJECT_CONTAINER_FALLBACK_QID
    )
    const resultLimit = Math.max(
      1,
      Math.min(Number.parseInt(String(nearbyLimit), 10) || SAVE_IMAGE_SUBJECT_NEARBY_MAP_FEATURE_BASE_LIMIT, 200),
    )
    const pointWkt = `POINT(${longitudeValue.toFixed(7)} ${latitudeValue.toFixed(7)})`
    const geofPrefix = normalizedDistanceMode === 'geof'
      ? 'PREFIX geof: <http://www.opengis.net/def/function/geosparql/>'
      : ''
    const distanceFunctionName = normalizedDistanceMode === 'dist' ? 'dist' : 'geof:distance'
    const containerDistanceBindClause = normalizedDistanceMode === 'none'
      ? ''
      : `BIND(${distanceFunctionName}(?containerLocation, "${pointWkt}"^^geo:wktLiteral) AS ?distance)`
    const containerDistanceFilterClause = normalizedDistanceMode === 'none'
      ? ''
      : 'FILTER(?distance = 0)'
    const featureDistanceBindClause = normalizedDistanceMode === 'none'
      ? 'BIND(0 AS ?distance)'
      : `BIND(${distanceFunctionName}(?location, "${pointWkt}"^^geo:wktLiteral) AS ?distance)`
    const optionalTagSelectClause = SAVE_IMAGE_SUBJECT_OSM_OPTIONAL_TAG_KEYS
      .map((tagKey) => `?${tagKey}`)
      .join(' ')
    const optionalAddressSelectClause = SAVE_IMAGE_SUBJECT_OSM_OPTIONAL_ADDRESS_BINDINGS
      .map((entry) => `?${entry.variable}`)
      .join(' ')
    const optionalTagWhereClause = SAVE_IMAGE_SUBJECT_OSM_OPTIONAL_TAG_KEYS
      .map((tagKey) => `OPTIONAL { ?osm osmkey:${tagKey} ?${tagKey} }`)
      .join('\n  ')
    const optionalAddressWhereClause = SAVE_IMAGE_SUBJECT_OSM_OPTIONAL_ADDRESS_BINDINGS
      .map((entry) => `OPTIONAL { ?osm <${entry.predicateIri}> ?${entry.variable} }`)
      .join('\n  ')
    return `
PREFIX ogc: <http://www.opengis.net/rdf#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
${geofPrefix}
PREFIX osmkey: <https://www.openstreetmap.org/wiki/Key:>
PREFIX osm: <https://www.openstreetmap.org/>
PREFIX osmrel: <https://www.openstreetmap.org/relation/>
PREFIX osm2rdf: <https://osm2rdf.cs.uni-freiburg.de/rdf#>

SELECT ?osm ?location ?distance ${optionalTagSelectClause} ${optionalAddressSelectClause}
WHERE {
  {
    SELECT ?osm ?location ?distance
    WHERE {
      {
        SELECT ?container
        WHERE {
          ?p131 osmkey:wikidata "${escapeSparqlStringLiteral(normalizedContainerQid)}" .
          ?p131 ogc:sfContains ?container .
          ?container geo:hasGeometry/geo:asWKT ?containerLocation .
          ?container osm2rdf:area ?area .
          ?container osmkey:boundary "administrative" .
          ${containerDistanceBindClause}
          ${containerDistanceFilterClause}
        }
        ORDER BY ASC(?area)
        LIMIT 1
      }
      ?container ogc:sfContains ?osm .
      {
        ?osm osm2rdf:area ?area .
        FILTER(?area > 1000)
      }
      UNION
      {
        ?osm (osmkey:highway|osmkey:bridge) ?highwayType .
        ?osm osmkey:name ?highwayName .
      }
      ?osm geo:hasGeometry/geo:asWKT ?location .
      ${featureDistanceBindClause}
    }
    ORDER BY ASC(?distance)
    LIMIT ${resultLimit}
  }

  ${optionalTagWhereClause}
  ${optionalAddressWhereClause}
}
ORDER BY ASC(?distance)
`.trim()
  }

  async function executeOsmPlanetSparqlQuery(query) {
    const normalizedQuery = String(query || '').trim()
    if (!normalizedQuery) {
      return {
        results: {
          bindings: [],
        },
      }
    }

    const requestBody = new URLSearchParams()
    requestBody.set('query', normalizedQuery)
    requestBody.set('format', 'json')

    const requestUrl = new URL(OSM_PLANET_SPARQL_ENDPOINT_URL)
    const response = await fetch(requestUrl.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json, application/json;q=0.9, */*;q=0.1',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: requestBody.toString(),
    })

    if (!response.ok) {
      let responseDetail = ''
      try {
        responseDetail = String(await response.text()).trim()
      } catch (error) {
        void error
      }
      const detailSuffix = responseDetail ? `: ${responseDetail.slice(0, 320)}` : ''
      throw new Error(`Request failed with status ${response.status}${detailSuffix}`)
    }

    return response.json()
  }

  async function fetchSaveImageSubjectQueryFeatures(latitude, longitude, {
    radiusMeters = SAVE_IMAGE_SUBJECT_OSM_RADIUS_METERS,
    nearbyLimit = SAVE_IMAGE_SUBJECT_NEARBY_MAP_FEATURE_BASE_LIMIT,
    lang = null,
    containerWikidataQid = SAVE_IMAGE_SUBJECT_CONTAINER_FALLBACK_QID,
  } = {}) {
    const latitudeValue = Number(latitude)
    const longitudeValue = Number(longitude)
    if (!Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue)) {
      return {
        nearbyFeatures: [],
      }
    }

    void radiusMeters
    const queryLimit = Math.max(
      1,
      Math.min(Number.parseInt(String(nearbyLimit), 10) || SAVE_IMAGE_SUBJECT_NEARBY_MAP_FEATURE_BASE_LIMIT, 200),
    )
    const visibleLimit = Math.max(
      1,
      Math.min(SAVE_IMAGE_SUBJECT_NEARBY_MAP_FEATURE_VISIBLE_LIMIT, queryLimit),
    )
    let bindings = []
    let lastError = null
    for (const distanceMode of ['geof', 'dist', 'none']) {
      const sparql = buildSubjectNearbyFeaturesSparqlQuery(
        latitudeValue,
        longitudeValue,
        containerWikidataQid,
        queryLimit,
        { distanceMode },
      )
      if (!sparql) {
        continue
      }
      try {
        const payload = await executeOsmPlanetSparqlQuery(sparql)
        const candidateBindings =
          payload &&
          typeof payload === 'object' &&
          payload.results &&
          typeof payload.results === 'object' &&
          Array.isArray(payload.results.bindings)
            ? payload.results.bindings
            : []
        if (candidateBindings.length > 0 || distanceMode === 'none') {
          bindings = candidateBindings
          lastError = null
          break
        }
      } catch (error) {
        lastError = error
      }
    }
    if (bindings.length < 1 && lastError) {
      throw lastError
    }

    const applyDistanceToNearbyFeature = (feature, distanceMetersValue) => {
      if (!feature || typeof feature !== 'object' || !Number.isFinite(Number(distanceMetersValue))) {
        return
      }
      const normalizedDistanceMeters = Math.max(0, Math.round(Number(distanceMetersValue)))
      feature.distanceMeters = normalizedDistanceMeters
      feature.distanceSortValue = normalizedDistanceMeters / 1000
      const displayMetaParts = [`${feature.type} ${feature.id}`, `${normalizedDistanceMeters} m`]
      if (
        feature.featureTypeDescription &&
        feature.featureTypeDescription !== feature.displayLabel &&
        !String(feature.displayLabel || '').startsWith(`${feature.featureTypeDescription} `)
      ) {
        displayMetaParts.unshift(feature.featureTypeDescription)
      }
      feature.displayMeta = displayMetaParts.join(' · ')
    }

    const nearbyFeatureByKey = new Map()
    for (const binding of bindings) {
      if (!binding || typeof binding !== 'object') {
        continue
      }
      const { type, id } = parseOsmFeatureReferenceFromUri(readSparqlBindingValue(binding, 'osm'))
      if (!type || !Number.isFinite(id)) {
        continue
      }
      const locationWkt = readSparqlBindingValue(binding, 'location')
      const parsedCoordinates = parseLatitudeLongitudeFromWkt(locationWkt)
      const tagMap = {}
      for (const tagKey of SAVE_IMAGE_SUBJECT_OSM_OPTIONAL_TAG_KEYS) {
        const tagValue = readSparqlBindingValue(binding, tagKey)
        if (!tagValue) {
          continue
        }
        tagMap[tagKey] = tagValue
      }
      for (const addressBinding of SAVE_IMAGE_SUBJECT_OSM_OPTIONAL_ADDRESS_BINDINGS) {
        const bindingVariable = String(addressBinding && addressBinding.variable ? addressBinding.variable : '').trim()
        const targetTagKey = String(addressBinding && addressBinding.tagKey ? addressBinding.tagKey : '').trim()
        if (!bindingVariable || !targetTagKey) {
          continue
        }
        const tagValue = readSparqlBindingValue(binding, bindingVariable)
        if (!tagValue) {
          continue
        }
        tagMap[targetTagKey] = tagValue
      }

      const normalizedFeature = normalizeOsmMapFeatureForQueryList(
        {
          type,
          id,
          tags: tagMap,
          lat: parsedCoordinates.latitude,
          lon: parsedCoordinates.longitude,
          geometryWkt: locationWkt,
        },
        {
          clickLatitude: latitudeValue,
          clickLongitude: longitudeValue,
          sourceKind: 'nearby',
          lang,
        },
      )
      if (!normalizedFeature) {
        continue
      }

      const dedupeKey = String(normalizedFeature.key || '').trim().toLowerCase()
      if (!dedupeKey) {
        continue
      }

      const calculatedDistanceKm = haversineDistanceKilometers(
        latitudeValue,
        longitudeValue,
        normalizedFeature.latitude,
        normalizedFeature.longitude,
      )
      const fallbackQueryDistance = Number.parseFloat(readSparqlBindingValue(binding, 'distance'))
      const distanceMeters = Number.isFinite(calculatedDistanceKm)
        ? Math.max(0, Math.round(calculatedDistanceKm * 1000))
        : (
          Number.isFinite(fallbackQueryDistance)
            ? Math.max(0, Math.round(fallbackQueryDistance))
            : null
        )
      applyDistanceToNearbyFeature(normalizedFeature, distanceMeters)

      const existingFeature = nearbyFeatureByKey.get(dedupeKey)
      if (!existingFeature || typeof existingFeature !== 'object') {
        nearbyFeatureByKey.set(dedupeKey, normalizedFeature)
        continue
      }

      const mergedRawTags = {
        ...(existingFeature.rawTags && typeof existingFeature.rawTags === 'object'
          ? existingFeature.rawTags
          : {}),
      }
      const incomingRawTags = normalizedFeature.rawTags && typeof normalizedFeature.rawTags === 'object'
        ? normalizedFeature.rawTags
        : {}
      for (const [rawTagKey, rawTagValue] of Object.entries(incomingRawTags)) {
        const tagKey = String(rawTagKey || '').trim()
        const tagValue = String(rawTagValue || '').trim()
        if (!tagKey || !tagValue) {
          continue
        }
        const currentTagValue = String(mergedRawTags[tagKey] || '').trim()
        if (!currentTagValue) {
          mergedRawTags[tagKey] = tagValue
        }
      }

      const existingLatitude = readOsmMapFeatureCoordinateValue(existingFeature.latitude)
      const existingLongitude = readOsmMapFeatureCoordinateValue(existingFeature.longitude)
      const mergedFeatureCandidate = normalizeOsmMapFeatureForQueryList(
        {
          type: existingFeature.type,
          id: existingFeature.id,
          tags: mergedRawTags,
          lat: existingLatitude !== null ? existingFeature.latitude : normalizedFeature.latitude,
          lon: existingLongitude !== null ? existingFeature.longitude : normalizedFeature.longitude,
          geometryWkt: String(existingFeature.geometryWkt || '').trim() || String(normalizedFeature.geometryWkt || '').trim(),
        },
        {
          clickLatitude: latitudeValue,
          clickLongitude: longitudeValue,
          sourceKind: 'nearby',
          lang,
        },
      )
      const mergedFeature = mergedFeatureCandidate && typeof mergedFeatureCandidate === 'object'
        ? {
          ...existingFeature,
          ...mergedFeatureCandidate,
          rawTags: mergedRawTags,
        }
        : {
          ...existingFeature,
          rawTags: mergedRawTags,
        }
      const mergedDirectQid = extractWikidataId(
        String(
          mergedFeature.directQid ||
          existingFeature.directQid ||
          normalizedFeature.directQid ||
          mergedRawTags.wikidata ||
          '',
        ),
      )
      if (mergedDirectQid) {
        mergedFeature.directQid = mergedDirectQid
        mergedFeature.rawTags.wikidata = mergedDirectQid
      }

      const existingDistanceMeters = Number.isFinite(Number(existingFeature.distanceMeters))
        ? Number(existingFeature.distanceMeters)
        : null
      const nextDistanceMeters = Number.isFinite(Number(normalizedFeature.distanceMeters))
        ? Number(normalizedFeature.distanceMeters)
        : null
      const mergedDistanceMeters = (
        existingDistanceMeters !== null && nextDistanceMeters !== null
          ? Math.min(existingDistanceMeters, nextDistanceMeters)
          : (existingDistanceMeters !== null ? existingDistanceMeters : nextDistanceMeters)
      )
      applyDistanceToNearbyFeature(mergedFeature, mergedDistanceMeters)
      nearbyFeatureByKey.set(dedupeKey, mergedFeature)
    }

    const nearbyFeatures = Array.from(nearbyFeatureByKey.values())
    sortSaveImageSubjectNearbyFeaturesInPlace(nearbyFeatures)
    const mergedNearbyFeatures = mergeSaveImageSubjectNearbyFeaturesByName(nearbyFeatures, { lang })

    return {
      nearbyFeatures: mergedNearbyFeatures.slice(0, visibleLimit),
    }
  }

  function collectWikidataMappingCandidatesFromOsmTags(tags) {
    const keyCandidates = new Set()
    const tagCandidates = new Set()
    for (const [rawKey, rawValue] of Object.entries(tags || {})) {
      const normalizedKey = normalizeOsmTagKeyForWikidataMapping(rawKey)
      if (!normalizedKey || shouldIgnoreOsmTagForWikidataMapping(normalizedKey)) {
        continue
      }
      const normalizedValue = normalizeOsmTagValueForWikidataMapping(rawValue)
      if (!normalizedValue) {
        continue
      }
      keyCandidates.add(normalizedKey)
      const tagPair = normalizeOsmTagPairForWikidataMapping(`${normalizedKey}=${normalizedValue}`)
      if (tagPair) {
        tagCandidates.add(tagPair)
      }
      const underscoredValue = normalizedValue.replace(/\s+/g, '_')
      if (underscoredValue !== normalizedValue) {
        const underscoredTag = normalizeOsmTagPairForWikidataMapping(`${normalizedKey}=${underscoredValue}`)
        if (underscoredTag) {
          tagCandidates.add(underscoredTag)
        }
      }
    }
    return {
      keyCandidates: Array.from(keyCandidates),
      tagCandidates: Array.from(tagCandidates),
    }
  }

  function collectReverseWikidataCandidatesForFeatureSuggestion(feature, {
    lang = null,
    additionalReverseCandidates = [],
    additionalNameMatchCandidates = [],
  } = {}) {
    const normalizedReverseCandidates = normalizeOsmMapFeatureReverseWikidataCandidates(
      mergeOsmMapFeatureReverseWikidataCandidates(
        additionalReverseCandidates,
        feature && typeof feature === 'object'
          ? (feature.wikidataReverseCandidates || feature.wikidata_reverse_candidates)
          : [],
      ),
    )
    const normalizedNameMatchCandidates = normalizeOsmMapFeatureReverseWikidataCandidates(
      mergeOsmMapFeatureReverseWikidataCandidates(
        additionalNameMatchCandidates,
        feature && typeof feature === 'object'
          ? (feature.wikidataNameMatchCandidates || feature.wikidata_name_match_candidates)
          : [],
      ),
    )
    const allCandidates = mergeOsmMapFeatureReverseWikidataCandidates(
      normalizedNameMatchCandidates,
      normalizedReverseCandidates,
    )
    const isAreaFeature = isAreaLikeOsmMapFeature(feature)
    const tags = feature && feature.rawTags && typeof feature.rawTags === 'object'
      ? feature.rawTags
      : {}
    const featureNameRaw = String(
      readPreferredOsmMapFeatureName(tags, lang) ||
      (feature && typeof feature.displayLabel === 'string' ? feature.displayLabel : ''),
    ).trim()
    const featureNameNormalized = normalizeTextForCompare(featureNameRaw)

    const includedCandidates = []
    const excludedCandidates = []
    for (const candidate of allCandidates) {
      const property = String(candidate && candidate.property ? candidate.property : '').trim().toUpperCase()
      const labelMatchesName = (
        featureNameNormalized &&
        normalizeTextForCompare(candidate.label) === featureNameNormalized
      )
      const matchValueMatchesName = (
        featureNameNormalized &&
        normalizeTextForCompare(candidate.matchValue) === featureNameNormalized
      )
      const isNameSignal = property === 'NAME' || labelMatchesName || matchValueMatchesName
      const includeForNonArea = isNameSignal
      const shouldInclude = isAreaFeature ? true : includeForNonArea
      if (shouldInclude) {
        includedCandidates.push(candidate)
      } else {
        excludedCandidates.push(candidate)
      }
    }

    return {
      featureNameRaw,
      featureNameNormalized,
      isAreaFeature,
      includedCandidates,
      excludedCandidates,
    }
  }

  function pushWikidataCandidatePriority(priorityByQid, sourcesByQid, qidValue, priority, source) {
    const qid = extractWikidataId(String(qidValue || ''))
    if (!qid) {
      return
    }
    const normalizedPriority = Number.isFinite(Number(priority)) ? Number(priority) : 99
    const existingPriority = priorityByQid.get(qid)
    if (existingPriority === undefined || normalizedPriority < existingPriority) {
      priorityByQid.set(qid, normalizedPriority)
    }
    if (!sourcesByQid.has(qid)) {
      sourcesByQid.set(qid, new Set())
    }
    if (source) {
      sourcesByQid.get(qid).add(String(source))
    }
  }

  async function fetchWikidataCandidatesForOsmMapFeature(feature, {
    lang = null,
    municipalityQid = '',
    limit = SAVE_IMAGE_SUBJECT_NEARBY_WIKIDATA_MAX_ITEMS,
  } = {}) {
    if (!feature || typeof feature !== 'object') {
      return []
    }
    const resultLimit = Math.max(
      1,
      Math.min(Number.parseInt(String(limit), 10) || SAVE_IMAGE_SUBJECT_NEARBY_WIKIDATA_MAX_ITEMS, 50),
    )
    const tags = feature.rawTags && typeof feature.rawTags === 'object'
      ? feature.rawTags
      : {}
    const featureType = normalizeOsmMapFeatureType(feature.type)
    const featureId = Number.parseInt(String(feature.id), 10)
    const normalizedMunicipalityQid = extractWikidataId(String(municipalityQid || ''))
    const featureNameForLookup = String(
      readPreferredOsmMapFeatureName(tags, lang) ||
      (typeof feature.displayLabel === 'string' ? feature.displayLabel : '') ||
      '',
    ).trim()
    let fetchedReverseCandidates = []
    let fetchedNearbyNameCandidates = []
    let reverseLookupError = ''
    const reverseLookupLimit = Math.min(resultLimit, SAVE_IMAGE_SUBJECT_WIKIDATA_REVERSE_LOOKUP_LIMIT)
    const reverseLookupTargets = []
    const seenReverseLookupTargetKeys = new Set()
    const pushReverseLookupTarget = (targetFeature) => {
      if (!targetFeature || typeof targetFeature !== 'object') {
        return
      }
      const targetType = normalizeOsmMapFeatureType(targetFeature.type)
      const targetId = Number.parseInt(String(targetFeature.id), 10)
      if (!targetType || !Number.isFinite(targetId) || targetId < 1) {
        return
      }
      const targetKey = `${targetType}:${targetId}`
      if (seenReverseLookupTargetKeys.has(targetKey)) {
        return
      }
      seenReverseLookupTargetKeys.add(targetKey)
      const targetTags = targetFeature.rawTags && typeof targetFeature.rawTags === 'object'
        ? targetFeature.rawTags
        : {}
      const targetName = String(
        readPreferredOsmMapFeatureName(targetTags, lang) ||
        (typeof targetFeature.displayLabel === 'string' ? targetFeature.displayLabel : '') ||
        featureNameForLookup ||
        '',
      ).trim()
      reverseLookupTargets.push({
        type: targetType,
        id: targetId,
        name: targetName,
        latitude: readOsmMapFeatureCoordinateValue(targetFeature.latitude),
        longitude: readOsmMapFeatureCoordinateValue(targetFeature.longitude),
      })
    }
    if (featureType && Number.isFinite(featureId) && featureId > 0) {
      pushReverseLookupTarget(feature)
    } else {
      for (const mergedComponent of Array.isArray(feature.mergedComponents) ? feature.mergedComponents : []) {
        pushReverseLookupTarget(mergedComponent)
      }
    }
    if (reverseLookupTargets.length > 0) {
      const reverseLookupResults = await Promise.all(
        reverseLookupTargets.map(async (target) => {
          try {
            const payload = await fetchWikidataReverseAndNearbyNameCandidatesForOsmFeature(
              target.type,
              target.id,
              {
                name: target.name,
                latitude: target.latitude,
                longitude: target.longitude,
                municipalityQid: normalizedMunicipalityQid,
                lang,
                limit: reverseLookupLimit,
              },
            )
            return {
              reverseCandidates: normalizeOsmMapFeatureReverseWikidataCandidates(
                payload.reverseCandidates || payload.reverse_candidates,
              ),
              nearbyNameCandidates: normalizeOsmMapFeatureReverseWikidataCandidates(
                payload.nearbyNameCandidates || payload.nearby_name_candidates,
              ),
              error: '',
            }
          } catch (error) {
            return {
              reverseCandidates: [],
              nearbyNameCandidates: [],
              error: String(
                (error && typeof error === 'object' && 'message' in error && error.message)
                  ? error.message
                  : error || '',
              ).trim(),
            }
          }
        }),
      )
      const reverseCandidateGroups = []
      const nearbyNameCandidateGroups = []
      const reverseLookupErrors = []
      for (const reverseLookupResult of reverseLookupResults) {
        reverseCandidateGroups.push(reverseLookupResult.reverseCandidates)
        nearbyNameCandidateGroups.push(reverseLookupResult.nearbyNameCandidates)
        if (reverseLookupResult.error) {
          reverseLookupErrors.push(reverseLookupResult.error)
        }
      }
      fetchedReverseCandidates = mergeOsmMapFeatureReverseWikidataCandidates(...reverseCandidateGroups)
      fetchedNearbyNameCandidates = mergeOsmMapFeatureReverseWikidataCandidates(...nearbyNameCandidateGroups)
      if (reverseLookupErrors.length > 0) {
        reverseLookupError = reverseLookupErrors.join(' | ')
      }
    }

    const directQids = []
    const seenDirectQids = new Set()
    const pushDirectQid = (qidValue) => {
      const directQidCandidate = extractWikidataId(String(qidValue || ''))
      if (!directQidCandidate || seenDirectQids.has(directQidCandidate)) {
        return
      }
      seenDirectQids.add(directQidCandidate)
      directQids.push(directQidCandidate)
    }
    pushDirectQid(feature.directQid)
    pushDirectQid(tags.wikidata)
    for (const mergedDirectQid of Array.isArray(feature.mergedDirectQids) ? feature.mergedDirectQids : []) {
      pushDirectQid(mergedDirectQid)
    }
    let directQid = directQids.length > 0 ? directQids[0] : ''
    const mappingInputs = collectWikidataMappingCandidatesFromOsmTags(tags)
    const reverseCollection = collectReverseWikidataCandidatesForFeatureSuggestion(feature, {
      lang,
      additionalReverseCandidates: fetchedReverseCandidates,
      additionalNameMatchCandidates: fetchedNearbyNameCandidates,
    })
    const effectiveReverseCandidates = reverseCollection.includedCandidates
    if (!directQid && reverseCollection.isAreaFeature) {
      const firstIdBasedCandidate = effectiveReverseCandidates.find((candidate) => (
        String(candidate && candidate.property ? candidate.property : '').trim().toUpperCase() !== 'NAME'
      ))
      const resolvedAreaQid = extractWikidataId(String(firstIdBasedCandidate && firstIdBasedCandidate.id ? firstIdBasedCandidate.id : ''))
      if (resolvedAreaQid) {
        directQid = resolvedAreaQid
        feature.directQid = resolvedAreaQid
        if (feature.rawTags && typeof feature.rawTags === 'object' && !extractWikidataId(String(feature.rawTags.wikidata || ''))) {
          feature.rawTags.wikidata = resolvedAreaQid
        }
        if (!seenDirectQids.has(resolvedAreaQid)) {
          seenDirectQids.add(resolvedAreaQid)
          directQids.unshift(resolvedAreaQid)
        }
      }
    }
    const mappings = await fetchWikidataItemsForOsmTagMappings(
      mappingInputs.keyCandidates,
      mappingInputs.tagCandidates,
      { lang },
    )

    const priorityByQid = new Map()
    const sourcesByQid = new Map()

    for (const directCandidateQid of directQids) {
      pushWikidataCandidatePriority(priorityByQid, sourcesByQid, directCandidateQid, 0, 'direct')
    }
    const hasDirectQids = directQids.length > 0
    for (const reverseCandidate of effectiveReverseCandidates) {
      const reverseProperty = String(reverseCandidate.property || '').trim().toUpperCase() || 'UNKNOWN'
      pushWikidataCandidatePriority(
        priorityByQid,
        sourcesByQid,
        reverseCandidate.id,
        hasDirectQids ? 1 : 0,
        `reverse:${reverseProperty}`,
      )
    }
    for (const tagPair of mappingInputs.tagCandidates) {
      const mappedItems = mappings.tagMatches.get(tagPair)
      if (!Array.isArray(mappedItems)) {
        continue
      }
      for (const mappedItem of mappedItems) {
        pushWikidataCandidatePriority(
          priorityByQid,
          sourcesByQid,
          mappedItem && mappedItem.id ? mappedItem.id : '',
          3,
          `tag:${tagPair}`,
        )
      }
    }
    for (const tagKey of mappingInputs.keyCandidates) {
      const mappedItems = mappings.keyMatches.get(tagKey)
      if (!Array.isArray(mappedItems)) {
        continue
      }
      for (const mappedItem of mappedItems) {
        pushWikidataCandidatePriority(
          priorityByQid,
          sourcesByQid,
          mappedItem && mappedItem.id ? mappedItem.id : '',
          4,
          `key:${tagKey}`,
        )
      }
    }

    if (priorityByQid.size === 0) {
      logSubjectWikidataSuggestionDebug({
        featureKey: String(feature.key || ''),
        featureLabel: String(feature.displayLabel || ''),
        directQid,
        directQids,
        municipalityQid: normalizedMunicipalityQid,
        featureName: reverseCollection.featureNameRaw,
        featureNameNormalized: reverseCollection.featureNameNormalized,
        reverseIncluded: effectiveReverseCandidates,
        reverseExcluded: reverseCollection.excludedCandidates,
        reverseLookupError,
        mappingKeys: mappingInputs.keyCandidates,
        mappingTags: mappingInputs.tagCandidates,
        ranked: [],
      })
      return []
    }

    const itemByQid = new Map(mappings.itemByQid)
    const missingQids = []
    for (const qid of priorityByQid.keys()) {
      const current = itemByQid.get(qid)
      if (!current || (!current.label && !current.description)) {
        missingQids.push(qid)
      }
    }
    if (missingQids.length > 0) {
      try {
        const summaries = await fetchWikidataItemSummariesForQids(missingQids, { lang })
        for (const [qid, item] of summaries.entries()) {
          if (!itemByQid.has(qid) || !(itemByQid.get(qid).label || itemByQid.get(qid).description)) {
            itemByQid.set(qid, item)
          }
        }
      } catch (error) {
        void error
      }
    }

    const rankedQids = Array.from(priorityByQid.keys()).sort((leftQid, rightQid) => {
      const leftPriority = Number(priorityByQid.get(leftQid))
      const rightPriority = Number(priorityByQid.get(rightQid))
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }
      const leftSources = Array.from(sourcesByQid.get(leftQid) || [])
      const rightSources = Array.from(sourcesByQid.get(rightQid) || [])
      const leftHasReverseSource = leftSources.some((source) => source.startsWith('reverse:'))
      const rightHasReverseSource = rightSources.some((source) => source.startsWith('reverse:'))
      if (leftHasReverseSource !== rightHasReverseSource) {
        return leftHasReverseSource ? -1 : 1
      }
      const leftItem = itemByQid.get(leftQid)
      const rightItem = itemByQid.get(rightQid)
      const leftLabel = leftItem && typeof leftItem.label === 'string' ? leftItem.label : leftQid
      const rightLabel = rightItem && typeof rightItem.label === 'string' ? rightItem.label : rightQid
      return leftLabel.localeCompare(rightLabel, 'en', { sensitivity: 'base' })
    })

    const sortedItems = rankedQids
      .slice(0, resultLimit)
      .map((qid) => {
        const item = itemByQid.get(qid)
        return {
          id: qid,
          label: item && typeof item.label === 'string' ? item.label : '',
          description: item && typeof item.description === 'string' ? item.description : '',
        }
      })
      .filter((item) => item && typeof item === 'object' && item.id)

    logSubjectWikidataSuggestionDebug({
      featureKey: String(feature.key || ''),
      featureLabel: String(feature.displayLabel || ''),
      directQid,
      municipalityQid: normalizedMunicipalityQid,
      featureName: reverseCollection.featureNameRaw,
      featureNameNormalized: reverseCollection.featureNameNormalized,
      mappingKeys: mappingInputs.keyCandidates,
      mappingTags: mappingInputs.tagCandidates,
      reverseLookupError,
      reverseIncluded: effectiveReverseCandidates.map((candidate) => ({
        id: candidate.id,
        label: candidate.label,
        property: candidate.property,
        matchValue: candidate.matchValue,
      })),
      reverseExcluded: reverseCollection.excludedCandidates.map((candidate) => ({
        id: candidate.id,
        label: candidate.label,
        property: candidate.property,
        matchValue: candidate.matchValue,
      })),
      ranked: rankedQids.map((qid) => ({
        id: qid,
        priority: priorityByQid.get(qid),
        sources: Array.from(sourcesByQid.get(qid) || []),
      })),
      selected: sortedItems.map((item) => item.id),
    })

    return sortedItems
  }

  function splitWktByTopLevelDelimiter(value, delimiter = ',') {
    const source = String(value || '')
    if (!source) {
      return []
    }
    const parts = []
    let depth = 0
    let segmentStart = 0
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index]
      if (character === '(') {
        depth += 1
        continue
      }
      if (character === ')') {
        depth = Math.max(0, depth - 1)
        continue
      }
      if (character === delimiter && depth === 0) {
        const segment = source.slice(segmentStart, index).trim()
        if (segment) {
          parts.push(segment)
        }
        segmentStart = index + 1
      }
    }
    const tail = source.slice(segmentStart).trim()
    if (tail) {
      parts.push(tail)
    }
    return parts
  }

  function extractWktTopLevelGroups(value) {
    const source = String(value || '')
    if (!source) {
      return []
    }
    const groups = []
    let depth = 0
    let groupStart = -1
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index]
      if (character === '(') {
        if (depth === 0) {
          groupStart = index + 1
        }
        depth += 1
        continue
      }
      if (character !== ')') {
        continue
      }
      depth -= 1
      if (depth === 0 && groupStart >= 0) {
        const group = source.slice(groupStart, index).trim()
        if (group) {
          groups.push(group)
        }
        groupStart = -1
      } else if (depth < 0) {
        depth = 0
        groupStart = -1
      }
    }
    return groups
  }

  function parseWktCoordinatePair(value) {
    const tokens = String(value || '').trim().split(/\s+/)
    if (tokens.length < 2) {
      return null
    }
    const longitude = Number(tokens[0])
    const latitude = Number(tokens[1])
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null
    }
    return [latitude, longitude]
  }

  function parseWktCoordinateSequence(value) {
    const coordinates = []
    for (const item of splitWktByTopLevelDelimiter(value, ',')) {
      const pair = parseWktCoordinatePair(item)
      if (pair) {
        coordinates.push(pair)
      }
    }
    return coordinates
  }

  function readWktGeometryType(value) {
    const rawValue = String(value || '').trim()
    if (!rawValue) {
      return ''
    }
    const sridMatch = rawValue.match(/^SRID=\d+;(.*)$/i)
    const withoutSrid = sridMatch ? String(sridMatch[1] || '').trim() : rawValue
    const typeMatch = withoutSrid.match(/^([A-Z]+)(?:\s+ZM|\s+Z|\s+M)?\s*\(/i)
    if (!typeMatch) {
      return ''
    }
    return String(typeMatch[1] || '').trim().toUpperCase()
  }

  function classifyWktGeometryKind(value) {
    const geometryType = readWktGeometryType(value)
    if (
      geometryType === 'POINT' ||
      geometryType === 'MULTIPOINT'
    ) {
      return 'point'
    }
    if (
      geometryType === 'LINESTRING' ||
      geometryType === 'MULTILINESTRING'
    ) {
      return 'line'
    }
    if (
      geometryType === 'POLYGON' ||
      geometryType === 'MULTIPOLYGON'
    ) {
      return 'area'
    }
    return ''
  }

  function isPointLikeOsmMapFeature(feature) {
    if (!feature || typeof feature !== 'object') {
      return false
    }
    const geometryKind = classifyWktGeometryKind(feature.geometryWkt)
    if (geometryKind) {
      return geometryKind === 'point'
    }
    return normalizeOsmMapFeatureType(feature.type) === 'node'
  }

  function isAreaLikeOsmMapFeature(feature) {
    if (!feature || typeof feature !== 'object') {
      return false
    }
    return classifyWktGeometryKind(feature.geometryWkt) === 'area'
  }

  function buildLeafletLayersFromWktGeometry(value, {
    lineStyle = {},
    markerStyle = {},
  } = {}) {
    if (typeof L === 'undefined') {
      return []
    }
    const rawValue = String(value || '').trim()
    if (!rawValue) {
      return []
    }
    const sridMatch = rawValue.match(/^SRID=\d+;(.*)$/i)
    const withoutSrid = sridMatch ? String(sridMatch[1] || '').trim() : rawValue
    const typeMatch = withoutSrid.match(/^([A-Z]+)(?:\s+ZM|\s+Z|\s+M)?\s*\((.*)\)$/i)
    if (!typeMatch) {
      return []
    }
    const geometryType = String(typeMatch[1] || '').trim().toUpperCase()
    const geometryBody = String(typeMatch[2] || '').trim()
    if (!geometryBody || geometryBody.toUpperCase() === 'EMPTY') {
      return []
    }

    const layers = []
    if (geometryType === 'POINT') {
      const point = parseWktCoordinatePair(geometryBody)
      if (point) {
        layers.push(L.circleMarker(point, markerStyle))
      }
      return layers
    }

    if (geometryType === 'MULTIPOINT') {
      const pointTexts = geometryBody.includes('(')
        ? extractWktTopLevelGroups(geometryBody)
        : splitWktByTopLevelDelimiter(geometryBody, ',')
      for (const pointText of pointTexts) {
        const point = parseWktCoordinatePair(pointText)
        if (point) {
          layers.push(L.circleMarker(point, markerStyle))
        }
      }
      return layers
    }

    if (geometryType === 'LINESTRING') {
      const lineCoordinates = parseWktCoordinateSequence(geometryBody)
      if (lineCoordinates.length >= 2) {
        layers.push(L.polyline(lineCoordinates, lineStyle))
      }
      return layers
    }

    if (geometryType === 'MULTILINESTRING') {
      const lineTexts = extractWktTopLevelGroups(geometryBody)
      for (const lineText of lineTexts) {
        const lineCoordinates = parseWktCoordinateSequence(lineText)
        if (lineCoordinates.length >= 2) {
          layers.push(L.polyline(lineCoordinates, lineStyle))
        }
      }
      return layers
    }

    if (geometryType === 'POLYGON') {
      const ringTexts = extractWktTopLevelGroups(geometryBody)
      const rings = []
      for (const ringText of ringTexts) {
        const ring = parseWktCoordinateSequence(ringText)
        if (ring.length >= 3) {
          rings.push(ring)
        }
      }
      if (rings.length > 0) {
        layers.push(L.polygon(rings, lineStyle))
      }
      return layers
    }

    if (geometryType === 'MULTIPOLYGON') {
      const polygonTexts = extractWktTopLevelGroups(geometryBody)
      for (const polygonText of polygonTexts) {
        const ringTexts = extractWktTopLevelGroups(polygonText)
        const rings = []
        for (const ringText of ringTexts) {
          const ring = parseWktCoordinateSequence(ringText)
          if (ring.length >= 3) {
            rings.push(ring)
          }
        }
        if (rings.length > 0) {
          layers.push(L.polygon(rings, lineStyle))
        }
      }
      return layers
    }

    return layers
  }

  function buildLeafletLayerFromOsmMapFeatureGeometry(feature, geometryElements, style = {}) {
    if (!feature || typeof feature !== 'object' || typeof L === 'undefined') {
      return null
    }

    const color = typeof style.color === 'string' && style.color ? style.color : '#f59e0b'
    const fillColor = typeof style.fillColor === 'string' && style.fillColor ? style.fillColor : color
    const weight = Number.isFinite(Number(style.weight)) ? Number(style.weight) : 3
    const opacity = Number.isFinite(Number(style.opacity)) ? Number(style.opacity) : 0.95
    const fillOpacity = Number.isFinite(Number(style.fillOpacity)) ? Number(style.fillOpacity) : 0.2
    const markerRadius = Number.isFinite(Number(style.markerRadius)) ? Number(style.markerRadius) : 6

    const baseLineStyle = {
      color,
      weight,
      opacity,
      fillColor,
      fillOpacity,
      interactive: false,
    }
    const markerStyle = {
      radius: markerRadius,
      color,
      weight: Math.max(2, weight - 1),
      fillColor,
      fillOpacity: Math.min(1, fillOpacity + 0.35),
      opacity: 1,
      interactive: false,
    }

    const createLineOrPolygon = (rawGeometry) => {
      const latLngs = []
      for (const point of Array.isArray(rawGeometry) ? rawGeometry : []) {
        if (!point || typeof point !== 'object') {
          continue
        }
        const latitude = Number(point.lat)
        const longitude = Number(point.lon)
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          continue
        }
        latLngs.push([latitude, longitude])
      }
      if (latLngs.length < 2) {
        return null
      }
      const first = latLngs[0]
      const last = latLngs[latLngs.length - 1]
      const isClosed = (
        latLngs.length >= 4 &&
        Math.abs(first[0] - last[0]) < 0.0000001 &&
        Math.abs(first[1] - last[1]) < 0.0000001
      )
      if (isClosed) {
        return L.polygon(latLngs, baseLineStyle)
      }
      return L.polyline(latLngs, baseLineStyle)
    }

    const normalizedType = normalizeOsmMapFeatureType(feature.type)
    const normalizedId = Number.parseInt(String(feature.id), 10)
    const featureGeometryKind = classifyWktGeometryKind(feature.geometryWkt)
    const sourceElements = Array.isArray(geometryElements) ? geometryElements : []
    const targetElement = sourceElements.find((element) => (
      element &&
      typeof element === 'object' &&
      normalizeOsmMapFeatureType(element.type) === normalizedType &&
      Number.parseInt(String(element.id), 10) === normalizedId
    ))

    const layers = []
    if (targetElement) {
      if (normalizedType === 'node') {
        const nodeLatitude = readOsmMapFeatureCoordinateValue(targetElement.lat)
        const nodeLongitude = readOsmMapFeatureCoordinateValue(targetElement.lon)
        if (nodeLatitude !== null && nodeLongitude !== null) {
          layers.push(L.circleMarker([nodeLatitude, nodeLongitude], markerStyle))
        }
      } else if (normalizedType === 'way') {
        const wayLayer = createLineOrPolygon(targetElement.geometry)
        if (wayLayer) {
          layers.push(wayLayer)
        }
      } else if (normalizedType === 'relation') {
        const relationLayer = createLineOrPolygon(targetElement.geometry)
        if (relationLayer) {
          layers.push(relationLayer)
        }
        for (const member of Array.isArray(targetElement.members) ? targetElement.members : []) {
          const memberLayer = createLineOrPolygon(member && typeof member === 'object' ? member.geometry : null)
          if (memberLayer) {
            layers.push(memberLayer)
          }
        }
      }
    }

    if (layers.length === 0) {
      const wktLayers = buildLeafletLayersFromWktGeometry(feature.geometryWkt, {
        lineStyle: baseLineStyle,
        markerStyle,
      })
      for (const layer of wktLayers) {
        layers.push(layer)
      }
    }

    if (layers.length === 0) {
      const allowPointFallbackMarker = (
        featureGeometryKind === 'point' ||
        (!featureGeometryKind && normalizedType === 'node')
      )
      if (!allowPointFallbackMarker) {
        return null
      }
      const fallbackLatitude = readOsmMapFeatureCoordinateValue(feature.latitude)
      const fallbackLongitude = readOsmMapFeatureCoordinateValue(feature.longitude)
      if (fallbackLatitude !== null && fallbackLongitude !== null) {
        layers.push(L.circleMarker([fallbackLatitude, fallbackLongitude], markerStyle))
      }
    }

    if (layers.length === 0) {
      return null
    }
    if (layers.length === 1) {
      return layers[0]
    }
    return L.layerGroup(layers)
  }

  function extractWikidataPropertyId(value) {
    if (typeof value !== 'string') {
      return ''
    }
    const match = value.trim().match(/(P\d+)/i)
    return match ? match[1].toUpperCase() : ''
  }

  function extractWikidataPropertyIdFromDynamicKey(value) {
    if (typeof value !== 'string') {
      return ''
    }
    const match = value.trim().match(/^property_(p\d+)$/i)
    return match ? match[1].toUpperCase() : ''
  }

  function dynamicWikidataPropertyKey(propertyId) {
    const normalizedPropertyId = extractWikidataPropertyId(String(propertyId || ''))
    if (!normalizedPropertyId) {
      return ''
    }
    return `${NEW_WIKIDATA_DYNAMIC_PROPERTY_KEY_PREFIX}${normalizedPropertyId.toLowerCase()}`
  }

  function normalizeNewWikidataOptionalPropertyDefinition(optionOrKey) {
    const directKey = typeof optionOrKey === 'string'
      ? optionOrKey.trim()
      : String(optionOrKey && optionOrKey.key ? optionOrKey.key : '').trim()
    if (directKey && NEW_WIKIDATA_OPTIONAL_PROPERTY_BY_KEY.has(directKey)) {
      return NEW_WIKIDATA_OPTIONAL_PROPERTY_BY_KEY.get(directKey)
    }
    const dynamicKeyPropertyId = extractWikidataPropertyIdFromDynamicKey(directKey)
    if (dynamicKeyPropertyId) {
      return {
        key: dynamicWikidataPropertyKey(dynamicKeyPropertyId),
        propertyId: dynamicKeyPropertyId,
        labelKey: '',
        label: '',
        description: '',
        datatype: '',
      }
    }

    function normalizePropertyObject(propertyId, fallbackOption = null) {
      const normalizedPropertyId = extractWikidataPropertyId(String(propertyId || ''))
      if (!normalizedPropertyId) {
        return null
      }
      if (NEW_WIKIDATA_OPTIONAL_PROPERTY_BY_ID.has(normalizedPropertyId)) {
        return NEW_WIKIDATA_OPTIONAL_PROPERTY_BY_ID.get(normalizedPropertyId)
      }
      return {
        key: dynamicWikidataPropertyKey(normalizedPropertyId),
        propertyId: normalizedPropertyId,
        labelKey: '',
        label: String(fallbackOption && fallbackOption.label ? fallbackOption.label : '').trim(),
        description: String(fallbackOption && fallbackOption.description ? fallbackOption.description : '').trim(),
        datatype: String(fallbackOption && fallbackOption.datatype ? fallbackOption.datatype : '').trim().toLowerCase(),
      }
    }

    if (typeof optionOrKey === 'string') {
      const directPropertyId = extractWikidataPropertyId(optionOrKey)
      const normalizedObject = normalizePropertyObject(directPropertyId)
      if (normalizedObject) {
        return normalizedObject
      }
    }

    const propertyId = extractWikidataPropertyId(
      String(
        optionOrKey && typeof optionOrKey === 'object'
          ? (
            optionOrKey.propertyId ||
            optionOrKey.id ||
            optionOrKey.concepturi ||
            ''
          )
          : ''
      )
    )
    return normalizePropertyObject(propertyId, optionOrKey)
  }

  async function searchSupportedNewWikidataProperties(query, lang = null, limit = AUTOCOMPLETE_RESULT_LIMIT) {
    const searchTerm = String(query || '').trim()
    if (!searchTerm) {
      return []
    }

    const requestLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || AUTOCOMPLETE_RESULT_LIMIT, 20))
    const searchUrl = new URL(WIKIDATA_PROPERTY_SEARCH_URL)
    searchUrl.searchParams.set('action', 'wbsearchentities')
    searchUrl.searchParams.set('format', 'json')
    searchUrl.searchParams.set('search', searchTerm)
    searchUrl.searchParams.set('language', normalizeSupportedLocale(lang) || 'en')
    searchUrl.searchParams.set('uselang', normalizeSupportedLocale(lang) || 'en')
    searchUrl.searchParams.set('type', 'property')
    searchUrl.searchParams.set('limit', String(requestLimit))
    searchUrl.searchParams.set('origin', '*')

    const response = await fetch(searchUrl.toString(), { method: 'GET' })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    const items = payload && typeof payload === 'object' && Array.isArray(payload.search)
      ? payload.search
      : []

    const seenKeys = new Set()
    const options = []
    for (const item of items) {
      const definition = normalizeNewWikidataOptionalPropertyDefinition(item)
      if (!definition || seenKeys.has(definition.key)) {
        continue
      }
      seenKeys.add(definition.key)
      options.push({
        key: definition.key,
        propertyId: definition.propertyId,
        labelKey: definition.labelKey,
        label: String(item && item.label ? item.label : '').trim(),
        description: String(item && item.description ? item.description : '').trim(),
      })
    }

    return options
  }

  async function fetchWikidataPropertyMetadata(propertyId, lang = null) {
    const normalizedPropertyId = extractWikidataPropertyId(String(propertyId || ''))
    if (!normalizedPropertyId) {
      return null
    }

    const languages = []
    const normalizedLocale = normalizeSupportedLocale(lang)
    if (normalizedLocale) {
      languages.push(normalizedLocale)
    }
    if (!languages.includes('en')) {
      languages.push('en')
    }

    const requestUrl = new URL(WIKIDATA_PROPERTY_SEARCH_URL)
    requestUrl.searchParams.set('action', 'wbgetentities')
    requestUrl.searchParams.set('format', 'json')
    requestUrl.searchParams.set('ids', normalizedPropertyId)
    requestUrl.searchParams.set('props', 'labels|datatype')
    requestUrl.searchParams.set('languages', languages.join('|'))
    requestUrl.searchParams.set('languagefallback', '1')
    requestUrl.searchParams.set('origin', '*')

    const response = await fetch(requestUrl.toString(), { method: 'GET' })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    const entities = payload && typeof payload === 'object' && payload.entities && typeof payload.entities === 'object'
      ? payload.entities
      : {}
    const entity = entities && typeof entities === 'object' ? entities[normalizedPropertyId] : null
    if (!entity || typeof entity !== 'object') {
      return null
    }

    const labels = entity.labels && typeof entity.labels === 'object' ? entity.labels : {}
    let resolvedLabel = ''
    for (const langCode of languages) {
      const labelEntry = labels[langCode]
      if (labelEntry && typeof labelEntry === 'object' && typeof labelEntry.value === 'string') {
        const candidate = labelEntry.value.trim()
        if (candidate) {
          resolvedLabel = candidate
          break
        }
      }
    }
    if (!resolvedLabel) {
      const firstEntry = Object.values(labels).find((entry) => (
        entry && typeof entry === 'object' && typeof entry.value === 'string' && entry.value.trim()
      ))
      resolvedLabel = firstEntry && typeof firstEntry === 'object' && typeof firstEntry.value === 'string'
        ? firstEntry.value.trim()
        : ''
    }

    return {
      propertyId: normalizedPropertyId,
      label: resolvedLabel,
      datatype: String(entity.datatype || '').trim().toLowerCase(),
    }
  }

  function normalizeLocationId(id) {
    if (typeof id !== 'string') {
      return ''
    }
    const trimmed = id.trim()
    if (!trimmed) {
      return ''
    }

    const decoded = (() => {
      try {
        return decodeURIComponent(trimmed)
      } catch (error) {
        return trimmed
      }
    })()

    const qid = extractWikidataId(decoded)
    if (qid) {
      return qid
    }

    try {
      return encodeURIComponent(decodeURIComponent(trimmed))
    } catch (error) {
      return encodeURIComponent(trimmed)
    }
  }

  function readCookieValue(cookieName) {
    const normalizedName = String(cookieName || '').trim()
    if (!normalizedName || typeof document === 'undefined') {
      return ''
    }
    const cookieChunks = String(document.cookie || '').split(';')
    for (const chunk of cookieChunks) {
      const trimmed = chunk.trim()
      if (!trimmed) {
        continue
      }
      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) {
        continue
      }
      const name = trimmed.slice(0, separatorIndex).trim()
      if (name !== normalizedName) {
        continue
      }
      const value = trimmed.slice(separatorIndex + 1)
      try {
        return decodeURIComponent(value)
      } catch (error) {
        return value
      }
    }
    return ''
  }

  function requestMethodIsCsrfSafe(method) {
    const normalizedMethod = String(method || 'GET').trim().toUpperCase()
    return normalizedMethod === 'GET' ||
      normalizedMethod === 'HEAD' ||
      normalizedMethod === 'OPTIONS' ||
      normalizedMethod === 'TRACE'
  }

  async function request(path, options = {}) {
    const {
      lang = null,
      method = 'GET',
      body = null,
      formData = null,
      queryParams = null,
      returnResponseMeta = false
    } = options

    const url = new URL(`${API_BASE_URL}${path}`, window.location.origin)
    if (lang) {
      url.searchParams.set('lang', lang)
    }
    if (queryParams && typeof queryParams === 'object') {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value))
        }
      })
    }

    const normalizedMethod = String(method || 'GET').trim().toUpperCase() || 'GET'
    const requestOptions = {
      method: normalizedMethod,
      credentials: 'same-origin',
    }
    const requestHeaders = {}
    if (formData !== null) {
      requestOptions.body = formData
    } else if (body !== null) {
      requestHeaders['Content-Type'] = 'application/json'
      requestOptions.body = JSON.stringify(body)
    }
    if (!requestMethodIsCsrfSafe(normalizedMethod)) {
      const csrfToken = readCookieValue('csrftoken')
      if (csrfToken) {
        requestHeaders['X-CSRFToken'] = csrfToken
      }
    }
    if (Object.keys(requestHeaders).length > 0) {
      requestOptions.headers = requestHeaders
    }

    const response = await fetch(url.toString(), requestOptions)

    let payload = null
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      payload = await response.json()
    } else {
      payload = await response.text()
    }

    if (!response.ok) {
      if (payload && typeof payload === 'object' && payload.detail) {
        throw new Error(payload.detail)
      }
      throw new Error(`Request failed with status ${response.status}`)
    }

    if (returnResponseMeta) {
      const headers = {}
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value
      })
      return { payload, headers }
    }

    return payload
  }

  function currentCacheBustMinute() {
    const now = new Date()
    const yyyy = String(now.getFullYear()).padStart(4, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`
  }

  function fetchLocationsWithMeta(lang, { cacheBust = '' } = {}) {
    const cacheBustValue = typeof cacheBust === 'string' ? cacheBust.trim() : ''
    return request('/locations/', {
      lang,
      returnResponseMeta: true,
      queryParams: cacheBustValue ? { cache_bust: cacheBustValue } : null,
    })
  }

  function fetchLocation(id, lang) {
    return request(`/locations/${normalizeLocationId(id)}/`, { lang })
  }

  function fetchLocationChildren(id, lang) {
    return request('/locations/children/', {
      lang,
      queryParams: { location_id: id },
    })
  }

  function addExistingWikidataItem(payload) {
    return request('/wikidata/add-existing/', {
      method: 'POST',
      body: payload,
    })
  }

  function fetchCitoidMetadata(sourceUrl, lang = null) {
    const normalizedUrl = typeof sourceUrl === 'string' ? sourceUrl.trim() : ''
    if (!normalizedUrl) {
      throw new Error('Source URL is required.')
    }
    return request('/citoid/metadata/', {
      lang,
      queryParams: { url: normalizedUrl },
    })
  }

  function createWikidataItem(payload, lang) {
    return request('/wikidata/create/', {
      method: 'POST',
      body: payload,
      lang,
    })
  }

  function uploadCommonsImage(formData, lang = null) {
    return request('/commons/upload/', {
      method: 'POST',
      lang,
      formData,
    })
  }

  function fetchAuthStatus() {
    return request('/auth/status/')
  }

  function searchWikidataEntities(query, lang, limit = AUTOCOMPLETE_RESULT_LIMIT) {
    return request('/wikidata/search/', {
      lang,
      queryParams: { q: query, limit }
    })
  }

  function fetchWikidataEntity(entityId, lang = null) {
    const qid = extractWikidataId(String(entityId || ''))
    if (!qid) {
      throw new Error('Invalid Wikidata id.')
    }
    return request(`/wikidata/entities/${encodeURIComponent(qid)}/`, { lang })
  }

  function fetchLatestOsmFeatureMetadata(featureType, featureId, lang = null, {
    hintLatitude = null,
    hintLongitude = null,
    hintName = '',
  } = {}) {
    const normalizedType = normalizeOsmMapFeatureType(featureType)
    const normalizedId = Number.parseInt(String(featureId), 10)
    if (!normalizedType || !Number.isFinite(normalizedId) || normalizedId < 1) {
      throw new Error('Invalid OSM feature reference.')
    }
    const parsedHintLatitude = readOsmMapFeatureCoordinateValue(hintLatitude)
    const parsedHintLongitude = readOsmMapFeatureCoordinateValue(hintLongitude)
    const queryParams = {}
    if (
      parsedHintLatitude !== null &&
      parsedHintLatitude >= -90 &&
      parsedHintLatitude <= 90
    ) {
      queryParams.lat = parsedHintLatitude
    }
    if (
      parsedHintLongitude !== null &&
      parsedHintLongitude >= -180 &&
      parsedHintLongitude <= 180
    ) {
      queryParams.lon = parsedHintLongitude
    }
    const normalizedHintName = String(hintName || '').trim()
    if (normalizedHintName) {
      queryParams.name = normalizedHintName.slice(0, 200)
    }
    return request(
      `/osm/features/${encodeURIComponent(normalizedType)}/${encodeURIComponent(String(normalizedId))}/latest/`,
      {
        lang,
        queryParams: Object.keys(queryParams).length > 0 ? queryParams : null,
      },
    )
  }

  function searchCommonsCategories(query, limit = AUTOCOMPLETE_RESULT_LIMIT) {
    return request('/commons/categories/', {
      queryParams: { q: query, limit }
    })
  }

  async function fetchCommonsCategoryCoordinates(categoryNames) {
    const normalizedCategories = []
    const seen = new Set()
    for (const rawCategoryName of Array.isArray(categoryNames) ? categoryNames : []) {
      const normalizedCategory = normalizeCommonsCategoryName(rawCategoryName)
      if (!normalizedCategory) {
        continue
      }
      const dedupeKey = normalizedCategory.toLowerCase()
      if (seen.has(dedupeKey)) {
        continue
      }
      seen.add(dedupeKey)
      normalizedCategories.push(normalizedCategory)
    }
    if (normalizedCategories.length < 1) {
      return new Map()
    }

    const coordinatesByCategoryKey = new Map()
    for (
      let start = 0;
      start < normalizedCategories.length;
      start += SAVE_IMAGE_SUBCATEGORY_COORDINATE_BATCH_SIZE
    ) {
      const categoryBatch = normalizedCategories.slice(start, start + SAVE_IMAGE_SUBCATEGORY_COORDINATE_BATCH_SIZE)
      if (categoryBatch.length < 1) {
        continue
      }
      const coordinateUrl = new URL('https://commons.wikimedia.org/w/api.php')
      coordinateUrl.searchParams.set('action', 'query')
      coordinateUrl.searchParams.set('prop', 'coordinates')
      coordinateUrl.searchParams.set('titles', categoryBatch.map((item) => `Category:${item}`).join('|'))
      coordinateUrl.searchParams.set('colimit', '1')
      coordinateUrl.searchParams.set('coprimary', 'all')
      coordinateUrl.searchParams.set('format', 'json')
      coordinateUrl.searchParams.set('formatversion', '2')
      coordinateUrl.searchParams.set('origin', '*')

      const coordinateResponse = await fetch(coordinateUrl.toString(), { method: 'GET' })
      if (!coordinateResponse.ok) {
        continue
      }

      const coordinatePayload = await coordinateResponse.json()
      const pages =
        coordinatePayload &&
        typeof coordinatePayload === 'object' &&
        coordinatePayload.query &&
        typeof coordinatePayload.query === 'object' &&
        Array.isArray(coordinatePayload.query.pages)
          ? coordinatePayload.query.pages
          : []
      for (const page of pages) {
        if (!page || typeof page !== 'object') {
          continue
        }
        const pageTitle = typeof page.title === 'string' ? page.title : ''
        const categoryNameFromTitle = normalizeCommonsCategoryName(pageTitle)
        if (!categoryNameFromTitle) {
          continue
        }
        const dedupeKey = categoryNameFromTitle.toLowerCase()
        if (coordinatesByCategoryKey.has(dedupeKey)) {
          continue
        }
        const coordinateList = Array.isArray(page.coordinates) ? page.coordinates : []
        const primaryCoordinate = coordinateList.find((candidate) => {
          if (!candidate || typeof candidate !== 'object') {
            return false
          }
          const latitude = Number.parseFloat(String(candidate.lat))
          const longitude = Number.parseFloat(String(candidate.lon))
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return false
          }
          if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return false
          }
          return true
        })
        if (!primaryCoordinate) {
          continue
        }
        coordinatesByCategoryKey.set(dedupeKey, {
          latitude: Number.parseFloat(String(primaryCoordinate.lat)),
          longitude: Number.parseFloat(String(primaryCoordinate.lon)),
        })
      }
    }
    return coordinatesByCategoryKey
  }

  async function fetchCommonsCategoryChildren(categoryName, limit = AUTOCOMPLETE_RESULT_LIMIT) {
    const rawCategory = typeof categoryName === 'string' ? categoryName.trim() : ''
    const normalizedCategory = rawCategory.replace(/^category:/i, '').trim().replace(/\s+/g, '_')
    if (!normalizedCategory) {
      return []
    }

    const parsedLimit = Number(limit)
    const requestedLimit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(Math.trunc(parsedLimit), 50))
      : AUTOCOMPLETE_RESULT_LIMIT

    const url = new URL('https://commons.wikimedia.org/w/api.php')
    url.searchParams.set('action', 'query')
    url.searchParams.set('list', 'categorymembers')
    url.searchParams.set('cmtitle', `Category:${normalizedCategory}`)
    url.searchParams.set('cmtype', 'subcat')
    url.searchParams.set('cmlimit', String(requestedLimit))
    url.searchParams.set('format', 'json')
    url.searchParams.set('formatversion', '2')
    url.searchParams.set('origin', '*')

    const response = await fetch(url.toString(), { method: 'GET' })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    if (payload && typeof payload === 'object' && payload.error && payload.error.info) {
      throw new Error(String(payload.error.info))
    }

    const members =
      payload &&
      typeof payload === 'object' &&
      payload.query &&
      typeof payload.query === 'object' &&
      Array.isArray(payload.query.categorymembers)
        ? payload.query.categorymembers
        : []

    const seen = new Set()
    const categories = []
    for (const member of members) {
      if (!member || typeof member !== 'object') {
        continue
      }
      const title = typeof member.title === 'string' ? member.title : ''
      const normalizedTitle = title.replace(/^category:/i, '').trim().replace(/\s+/g, '_')
      if (!normalizedTitle) {
        continue
      }
      const dedupeKey = normalizedTitle.toLowerCase()
      if (seen.has(dedupeKey)) {
        continue
      }
      seen.add(dedupeKey)
      categories.push({
        name: normalizedTitle,
        title: `Category:${normalizedTitle}`,
        commons_category: normalizedTitle,
      })
    }

    if (categories.length < 1) {
      return categories
    }

    try {
      const coordinatesByCategoryKey = await fetchCommonsCategoryCoordinates(
        categories.map((item) => item.name),
      )

      for (const category of categories) {
        if (!category || typeof category !== 'object') {
          continue
        }
        const categoryNameValue = typeof category.name === 'string' ? category.name : ''
        const coordinateItem = coordinatesByCategoryKey.get(categoryNameValue.toLowerCase())
        if (!coordinateItem) {
          continue
        }
        category.latitude = coordinateItem.latitude
        category.longitude = coordinateItem.longitude
      }
    } catch (error) {
      void error
    }
    return categories
  }

  async function fetchCommonsCategoryParents(categoryName, limit = AUTOCOMPLETE_RESULT_LIMIT) {
    const rawCategory = typeof categoryName === 'string' ? categoryName.trim() : ''
    const normalizedCategory = rawCategory.replace(/^category:/i, '').trim().replace(/\s+/g, '_')
    if (!normalizedCategory) {
      return []
    }

    const parsedLimit = Number(limit)
    const requestedLimit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(Math.trunc(parsedLimit), 50))
      : AUTOCOMPLETE_RESULT_LIMIT

    const url = new URL('https://commons.wikimedia.org/w/api.php')
    url.searchParams.set('action', 'query')
    url.searchParams.set('prop', 'categories')
    url.searchParams.set('titles', `Category:${normalizedCategory}`)
    url.searchParams.set('clshow', '!hidden')
    url.searchParams.set('cllimit', String(requestedLimit))
    url.searchParams.set('format', 'json')
    url.searchParams.set('formatversion', '2')
    url.searchParams.set('origin', '*')

    const response = await fetch(url.toString(), { method: 'GET' })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    if (payload && typeof payload === 'object' && payload.error && payload.error.info) {
      throw new Error(String(payload.error.info))
    }

    const pages =
      payload &&
      typeof payload === 'object' &&
      payload.query &&
      typeof payload.query === 'object' &&
      Array.isArray(payload.query.pages)
        ? payload.query.pages
        : []
    const page =
      pages.length > 0 && pages[0] && typeof pages[0] === 'object'
        ? pages[0]
        : null
    const categoryList =
      page &&
      typeof page === 'object' &&
      Array.isArray(page.categories)
        ? page.categories
        : []

    const seen = new Set()
    const categories = []
    for (const category of categoryList) {
      if (!category || typeof category !== 'object') {
        continue
      }
      const title = typeof category.title === 'string' ? category.title : ''
      const normalizedTitle = title.replace(/^category:/i, '').trim().replace(/\s+/g, '_')
      if (!normalizedTitle) {
        continue
      }
      const dedupeKey = normalizedTitle.toLowerCase()
      if (seen.has(dedupeKey)) {
        continue
      }
      seen.add(dedupeKey)
      categories.push({
        name: normalizedTitle,
        title: `Category:${normalizedTitle}`,
        commons_category: normalizedTitle,
      })
    }
    return categories
  }

  function normalizeCommonsFilenameCandidate(value) {
    const normalized = String(value || '')
      .trim()
      .replace(/^file:/i, '')
      .trim()
      .replace(/\s+/g, ' ')
    return normalized
  }

  function normalizeCommonsFilenameExtension(value) {
    const rawValue = String(value || '').trim()
    if (!rawValue) {
      return ''
    }
    const extension = rawValue.startsWith('.') ? rawValue : `.${rawValue}`
    if (!/^\.[A-Za-z0-9]{1,10}$/.test(extension)) {
      return ''
    }
    return extension
  }

  function splitCommonsFilenameBaseAndExtension(value) {
    const normalizedFilename = normalizeCommonsFilenameCandidate(value)
    if (!normalizedFilename) {
      return { base: '', extension: '' }
    }
    const extensionMatch = normalizedFilename.match(/^(.*?)(\.[A-Za-z0-9]{1,10})$/)
    if (!extensionMatch) {
      return { base: normalizedFilename, extension: '' }
    }

    const base = String(extensionMatch[1] || '').trim()
    const extension = String(extensionMatch[2] || '')
    if (!base) {
      return { base: normalizedFilename, extension: '' }
    }
    return { base, extension }
  }

  function buildCommonsFilenameAvailabilityCandidates(filename, fallbackExtension = '') {
    const normalizedFilename = normalizeCommonsFilenameCandidate(filename)
    if (!normalizedFilename) {
      return []
    }

    const { base, extension } = splitCommonsFilenameBaseAndExtension(normalizedFilename)
    const normalizedFallbackExtension = normalizeCommonsFilenameExtension(fallbackExtension)
    const candidates = []
    const seen = new Set()
    const addCandidate = (candidateValue) => {
      const normalizedCandidate = normalizeCommonsFilenameCandidate(candidateValue)
      if (!normalizedCandidate) {
        return
      }
      const dedupeKey = normalizedCandidate.toLowerCase()
      if (seen.has(dedupeKey)) {
        return
      }
      seen.add(dedupeKey)
      candidates.push(normalizedCandidate)
    }

    addCandidate(normalizedFilename)
    if (extension) {
      addCandidate(base)
    } else if (normalizedFallbackExtension) {
      addCandidate(`${normalizedFilename}${normalizedFallbackExtension}`)
    }

    return candidates
  }

  async function checkCommonsFilenameAvailability(filename, { fallbackExtension = '' } = {}) {
    const filenameCandidates = buildCommonsFilenameAvailabilityCandidates(filename, fallbackExtension)
    if (filenameCandidates.length === 0) {
      return null
    }

    const url = new URL('https://commons.wikimedia.org/w/api.php')
    url.searchParams.set('action', 'query')
    url.searchParams.set('titles', filenameCandidates.map((candidate) => `File:${candidate}`).join('|'))
    url.searchParams.set('format', 'json')
    url.searchParams.set('formatversion', '2')
    url.searchParams.set('origin', '*')

    const response = await fetch(url.toString(), { method: 'GET' })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const payload = await response.json()
    if (payload && typeof payload === 'object' && payload.error && payload.error.info) {
      throw new Error(String(payload.error.info))
    }

    const pages =
      payload &&
      typeof payload === 'object' &&
      payload.query &&
      typeof payload.query === 'object' &&
      Array.isArray(payload.query.pages)
        ? payload.query.pages
        : []

    if (pages.length === 0) {
      return null
    }
    const exists = pages.some((page) => (
      page &&
      typeof page === 'object' &&
      !Object.prototype.hasOwnProperty.call(page, 'missing')
    ))
    return !exists
  }

  function searchGeocodePlaces(query, limit = AUTOCOMPLETE_RESULT_LIMIT) {
    return request('/geocode/search/', {
      queryParams: { q: query, limit }
    })
  }

  function reverseGeocodeCoordinates(latitude, longitude, lang = null) {
    return request('/geocode/reverse/', {
      lang,
      queryParams: { lat: latitude, lon: longitude }
    })
  }

  function normalizeSupportedLocale(candidate) {
    if (typeof candidate !== 'string' || candidate.trim() === '') {
      return null
    }

    const normalized = candidate.trim().toLowerCase().replace('_', '-')
    if (SUPPORTED_LOCALES.includes(normalized)) {
      return normalized
    }

    const baseLocale = normalized.split('-')[0]
    if (SUPPORTED_LOCALES.includes(baseLocale)) {
      return baseLocale
    }

    return null
  }

  function extractWikidataId(value) {
    if (typeof value !== 'string') {
      return ''
    }
    const match = value.trim().match(/(Q\d+)/i)
    return match ? match[1].toUpperCase() : ''
  }

  function normalizeCommonsCategoryName(value) {
    if (typeof value !== 'string') {
      return ''
    }
    return value
      .trim()
      .replace(/^category:/i, '')
      .trim()
      .replace(/\s+/g, '_')
  }

  function normalizeLocationUri(value) {
    if (typeof value !== 'string') {
      return ''
    }
    const trimmed = value.trim()
    if (!trimmed) {
      return ''
    }
    const wikidataMatch = trimmed.match(/^https?:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/i)
    if (wikidataMatch) {
      return `https://www.wikidata.org/entity/${wikidataMatch[1].toUpperCase()}`
    }
    return trimmed
  }

  function locationOptionLabel(item) {
    if (!item || typeof item !== 'object') {
      return ''
    }
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const uri = typeof item.uri === 'string' ? item.uri.trim() : ''
    if (name && uri) {
      return `${name} (${uri})`
    }
    return name || uri
  }

  function wikidataAutocompleteLabel(item) {
    if (!item || typeof item !== 'object') {
      return ''
    }
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    const label = typeof item.label === 'string' ? item.label.trim() : ''
    const description = typeof item.description === 'string' ? item.description.trim() : ''
    const base = id ? `${label || id} (${id})` : (label || '')
    if (!description) {
      return base
    }
    return `${base} - ${description}`
  }

  function debounce(fn, delayMs) {
    let timerId = null
    return (...args) => {
      if (timerId) {
        window.clearTimeout(timerId)
      }
      timerId = window.setTimeout(() => {
        fn(...args)
      }, delayMs)
    }
  }

  function normalizeTextForCompare(value) {
    if (value === null || value === undefined) {
      return ''
    }
    return String(value).trim().toLowerCase()
  }

  function logSubjectWikidataSuggestionDebug(payload) {
    if (!SUBJECT_WIKIDATA_DEBUG_LOG_ENABLED || !payload || typeof payload !== 'object') {
      return
    }
    try {
      console.info('[SUBJECT-WIKIDATA-DEBUG]', payload)
    } catch (error) {
      void error
    }
  }

  function logSubjectFeatureSelectionDebug(payload) {
    if (!SUBJECT_WIKIDATA_DEBUG_LOG_ENABLED || !payload || typeof payload !== 'object') {
      return
    }
    try {
      console.info('[SUBJECT-FEATURE-SELECT-DEBUG]', payload)
    } catch (error) {
      void error
    }
  }

  function textValuesDiffer(manualValue, wikidataValue) {
    return normalizeTextForCompare(manualValue) !== normalizeTextForCompare(wikidataValue)
  }

  function parseCoordinate(value) {
    const parsed = Number.parseFloat(String(value))
    return Number.isNaN(parsed) ? null : parsed
  }

  function coordinatesDiffer(manualLat, manualLon, wikidataLat, wikidataLon) {
    const mLat = parseCoordinate(manualLat)
    const mLon = parseCoordinate(manualLon)
    const wLat = parseCoordinate(wikidataLat)
    const wLon = parseCoordinate(wikidataLon)

    if (mLat === null || mLon === null || wLat === null || wLon === null) {
      return !(mLat === null && mLon === null && wLat === null && wLon === null)
    }

    return Math.abs(mLat - wLat) > 0.00001 || Math.abs(mLon - wLon) > 0.00001
  }

  function displayValue(value, emptyPlaceholder) {
    if (value === null || value === undefined) {
      return emptyPlaceholder
    }
    const text = String(value).trim()
    return text ? text : emptyPlaceholder
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return ''
    }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function isHttpUrl(value) {
    if (typeof value !== 'string') {
      return false
    }
    const trimmed = value.trim()
    return trimmed.startsWith('http://') || trimmed.startsWith('https://')
  }

  function formatCountValue(value, locale, emptyPlaceholder = '-') {
    const parsed = Number.parseInt(String(value), 10)
    if (Number.isNaN(parsed)) {
      return emptyPlaceholder
    }
    return new Intl.NumberFormat(locale).format(parsed)
  }

  function parseImageCountValue(value) {
    const parsed = Number.parseInt(String(value), 10)
    if (Number.isNaN(parsed)) {
      return null
    }
    return parsed < 0 ? 0 : parsed
  }

  function preferredCommonsImageSource(location) {
    if (!location || typeof location !== 'object') {
      return ''
    }

    const petscanCount = parseImageCountValue(location.commons_image_count_petscan)
    const viewItCount = parseImageCountValue(location.view_it_image_count)

    if (petscanCount === null && viewItCount === null) {
      return ''
    }
    if (petscanCount === null) {
      return 'view-it'
    }
    if (viewItCount === null) {
      return 'petscan'
    }
    return viewItCount > petscanCount ? 'view-it' : 'petscan'
  }

  function preferredCommonsImageCount(location) {
    const sourceKey = preferredCommonsImageSource(location)
    if (sourceKey === 'view-it') {
      return location && typeof location === 'object' ? location.view_it_image_count : ''
    }
    if (sourceKey === 'petscan') {
      return location && typeof location === 'object' ? location.commons_image_count_petscan : ''
    }
    return ''
  }

  function preferredCommonsImageHref(location) {
    if (!location || typeof location !== 'object') {
      return ''
    }
    const sourceKey = preferredCommonsImageSource(location)
    if (sourceKey === 'view-it') {
      const url = typeof location.view_it_url === 'string' ? location.view_it_url.trim() : ''
      return isHttpUrl(url) ? url : ''
    }
    if (sourceKey === 'petscan') {
      const url = typeof location.commons_category_url === 'string' ? location.commons_category_url.trim() : ''
      return isHttpUrl(url) ? url : ''
    }
    return ''
  }

  function formatCoordinatePair(latitude, longitude, locale, fractionDigits = 4, emptyPlaceholder = '-') {
    const lat = Number.parseFloat(String(latitude))
    const lon = Number.parseFloat(String(longitude))
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return emptyPlaceholder
    }
    const numberFormat = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    })
    return `${numberFormat.format(lat)}, ${numberFormat.format(lon)}`
  }

  function hasTextValue(value) {
    return normalizeTextForCompare(value) !== ''
  }

  function handleImageLoadError(event, fallbackUrl = '') {
    const target = event && event.target ? event.target : null
    if (!target) {
      return
    }

    const normalizedFallback = typeof fallbackUrl === 'string' ? fallbackUrl.trim() : ''
    if (normalizedFallback && target.src !== normalizedFallback) {
      target.src = normalizedFallback
      return
    }

    target.style.display = 'none'
  }

  function parseWikidataDateParts(value) {
    if (typeof value !== 'string') {
      return null
    }

    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const match = trimmed.match(/^([+-]?\d{1,6})-(\d{2})-(\d{2})(?:T.*)?$/)
    if (!match) {
      return null
    }

    const year = Number.parseInt(match[1], 10)
    const month = Number.parseInt(match[2], 10)
    const day = Number.parseInt(match[3], 10)
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return null
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null
    }

    return { year, month, day }
  }

  function parseIsoDateTimestamp(value) {
    if (typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const timestamp = Date.parse(trimmed)
    if (!Number.isFinite(timestamp)) {
      return null
    }
    return timestamp
  }

  function formatDateTimeValue(value, locale, fallback) {
    const timestamp = parseIsoDateTimestamp(value)
    if (timestamp === null) {
      return fallback
    }
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(timestamp))
    } catch (error) {
      void error
      return new Date(timestamp).toISOString()
    }
  }

  function haversineDistanceKilometers(fromLatitude, fromLongitude, toLatitude, toLongitude) {
    const lat1 = Number(fromLatitude)
    const lon1 = Number(fromLongitude)
    const lat2 = Number(toLatitude)
    const lon2 = Number(toLongitude)
    if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
      return null
    }

    const earthRadiusKm = 6371
    const toRadians = (degrees) => (degrees * Math.PI) / 180
    const dLat = toRadians(lat2 - lat1)
    const dLon = toRadians(lon2 - lon1)
    const a = (
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    )
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return earthRadiusKm * c
  }

  function normalizeHeadingDegrees(value) {
    const parsed = Number.parseFloat(String(value))
    if (!Number.isFinite(parsed)) {
      return null
    }
    let normalized = parsed % 360
    if (normalized < 0) {
      normalized += 360
    }
    return normalized
  }

  function bearingBetweenCoordinates(fromLatitude, fromLongitude, toLatitude, toLongitude) {
    const lat1 = Number(fromLatitude)
    const lon1 = Number(fromLongitude)
    const lat2 = Number(toLatitude)
    const lon2 = Number(toLongitude)
    if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
      return null
    }

    const toRadians = (degrees) => (degrees * Math.PI) / 180
    const toDegrees = (radians) => (radians * 180) / Math.PI
    const lat1Rad = toRadians(lat1)
    const lat2Rad = toRadians(lat2)
    const deltaLonRad = toRadians(lon2 - lon1)
    const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad)
    const x = (
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad)
    )
    const rawDegrees = toDegrees(Math.atan2(y, x))
    return normalizeHeadingDegrees(rawDegrees)
  }

  const EXIF_TYPE_BYTE_SIZES = {
    1: 1, // BYTE
    2: 1, // ASCII
    3: 2, // SHORT
    4: 4, // LONG
    5: 8, // RATIONAL
    7: 1, // UNDEFINED
    9: 4, // SLONG
    10: 8, // SRATIONAL
  }

  function _asciiFromDataView(view, offset, length) {
    if (!(view instanceof DataView) || !Number.isInteger(offset) || !Number.isInteger(length)) {
      return ''
    }
    if (offset < 0 || length < 0 || offset + length > view.byteLength) {
      return ''
    }
    let value = ''
    for (let index = 0; index < length; index += 1) {
      const byte = view.getUint8(offset + index)
      if (byte === 0) {
        break
      }
      value += String.fromCharCode(byte)
    }
    return value
  }

  function _readExifEntryValue(view, entryOffset, tiffStart, littleEndian) {
    if (!(view instanceof DataView)) {
      return null
    }
    if (entryOffset < 0 || entryOffset + 12 > view.byteLength) {
      return null
    }

    const valueType = view.getUint16(entryOffset + 2, littleEndian)
    const count = view.getUint32(entryOffset + 4, littleEndian)
    const typeSize = EXIF_TYPE_BYTE_SIZES[valueType]
    if (!typeSize || !Number.isFinite(count) || count < 1) {
      return null
    }
    const totalByteLength = count * typeSize
    if (!Number.isFinite(totalByteLength) || totalByteLength < 1) {
      return null
    }

    const inlineValueOffset = entryOffset + 8
    const pointerValueOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian)
    const valueOffset = totalByteLength <= 4 ? inlineValueOffset : pointerValueOffset
    if (!Number.isInteger(valueOffset) || valueOffset < 0 || valueOffset + totalByteLength > view.byteLength) {
      return null
    }

    const readValues = (reader, step) => {
      const values = []
      for (let index = 0; index < count; index += 1) {
        values.push(reader(valueOffset + index * step))
      }
      return count === 1 ? values[0] : values
    }

    switch (valueType) {
      case 1:
      case 7:
        return readValues((position) => view.getUint8(position), 1)
      case 2:
        return _asciiFromDataView(view, valueOffset, totalByteLength).trim()
      case 3:
        return readValues((position) => view.getUint16(position, littleEndian), 2)
      case 4:
        return readValues((position) => view.getUint32(position, littleEndian), 4)
      case 5:
        return readValues((position) => {
          const numerator = view.getUint32(position, littleEndian)
          const denominator = view.getUint32(position + 4, littleEndian)
          if (!denominator) {
            return null
          }
          return numerator / denominator
        }, 8)
      case 9:
        return readValues((position) => view.getInt32(position, littleEndian), 4)
      case 10:
        return readValues((position) => {
          const numerator = view.getInt32(position, littleEndian)
          const denominator = view.getInt32(position + 4, littleEndian)
          if (!denominator) {
            return null
          }
          return numerator / denominator
        }, 8)
      default:
        return null
    }
  }

  function _readExifIfdTags(view, ifdOffset, tiffStart, littleEndian) {
    const tags = new Map()
    if (!(view instanceof DataView) || !Number.isFinite(ifdOffset)) {
      return tags
    }
    const absoluteIfdOffset = tiffStart + Number(ifdOffset)
    if (!Number.isInteger(absoluteIfdOffset) || absoluteIfdOffset < 0 || absoluteIfdOffset + 2 > view.byteLength) {
      return tags
    }

    const entryCount = view.getUint16(absoluteIfdOffset, littleEndian)
    for (let index = 0; index < entryCount; index += 1) {
      const entryOffset = absoluteIfdOffset + 2 + index * 12
      if (entryOffset + 12 > view.byteLength) {
        break
      }
      const tagId = view.getUint16(entryOffset, littleEndian)
      const tagValue = _readExifEntryValue(view, entryOffset, tiffStart, littleEndian)
      tags.set(tagId, tagValue)
    }

    return tags
  }

  function _normalizeExifDateParts(rawValue) {
    const text = String(rawValue || '').trim()
    if (!text) {
      return { date: '', display: '' }
    }

    const match = text.match(/^(\d{4}):(\d{2}):(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/)
    if (!match) {
      return { date: '', display: '' }
    }

    const dateValue = `${match[1]}-${match[2]}-${match[3]}`
    const timeValue = match[4] ? `${match[4]}:${match[5]}:${match[6]}` : ''
    return {
      date: dateValue,
      display: timeValue ? `${dateValue} ${timeValue}` : dateValue,
    }
  }

  function _gpsDmsToDecimal(value, reference) {
    if (!Array.isArray(value) || value.length < 3) {
      return null
    }
    const degrees = Number(value[0])
    const minutes = Number(value[1])
    const seconds = Number(value[2])
    if (!Number.isFinite(degrees) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return null
    }
    let decimal = degrees + (minutes / 60) + (seconds / 3600)
    const normalizedRef = String(reference || '').trim().toUpperCase()
    if (normalizedRef === 'S' || normalizedRef === 'W') {
      decimal *= -1
    }
    return decimal
  }

  function extractExifMetadataFromJpegArrayBuffer(arrayBuffer) {
    const emptyResult = {
      dateTaken: '',
      dateTakenDate: '',
      latitude: null,
      longitude: null,
      heading: null,
      altitude: null,
    }
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      return emptyResult
    }

    const view = new DataView(arrayBuffer)
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) {
      return emptyResult
    }

    let offset = 2
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xFF) {
        offset += 1
        continue
      }

      const marker = view.getUint8(offset + 1)
      offset += 2
      if (marker === 0xD9 || marker === 0xDA) {
        break
      }

      if (offset + 2 > view.byteLength) {
        break
      }
      const segmentLength = view.getUint16(offset, false)
      if (segmentLength < 2 || offset + segmentLength > view.byteLength) {
        break
      }

      if (marker === 0xE1 && segmentLength >= 8) {
        const exifHeader = _asciiFromDataView(view, offset + 2, 6)
        if (exifHeader === 'Exif') {
          const tiffStart = offset + 2 + 6
          if (tiffStart + 8 > view.byteLength) {
            return emptyResult
          }

          const byteOrder = _asciiFromDataView(view, tiffStart, 2)
          const littleEndian = byteOrder === 'II'
          if (!littleEndian && byteOrder !== 'MM') {
            return emptyResult
          }
          const tiffMagic = view.getUint16(tiffStart + 2, littleEndian)
          if (tiffMagic !== 42) {
            return emptyResult
          }

          const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian)
          const ifd0 = _readExifIfdTags(view, firstIfdOffset, tiffStart, littleEndian)
          const exifIfdPointer = Number(ifd0.get(0x8769))
          const gpsIfdPointer = Number(ifd0.get(0x8825))
          const exifIfd = Number.isFinite(exifIfdPointer)
            ? _readExifIfdTags(view, exifIfdPointer, tiffStart, littleEndian)
            : new Map()
          const gpsIfd = Number.isFinite(gpsIfdPointer)
            ? _readExifIfdTags(view, gpsIfdPointer, tiffStart, littleEndian)
            : new Map()

          const rawDateValue = (
            exifIfd.get(0x9003) || // DateTimeOriginal
            exifIfd.get(0x9004) || // DateTimeDigitized
            ifd0.get(0x0132) || // DateTime
            ''
          )
          const normalizedDate = _normalizeExifDateParts(rawDateValue)

          const latitude = _gpsDmsToDecimal(gpsIfd.get(0x0002), gpsIfd.get(0x0001))
          const longitude = _gpsDmsToDecimal(gpsIfd.get(0x0004), gpsIfd.get(0x0003))
          const rawHeading = Number(gpsIfd.get(0x0011))
          const heading = normalizeHeadingDegrees(rawHeading)
          const rawAltitude = Number(gpsIfd.get(0x0006))
          const rawAltitudeRef = Number(gpsIfd.get(0x0005))
          let altitude = Number.isFinite(rawAltitude) ? rawAltitude : null
          if (altitude !== null && rawAltitudeRef === 1) {
            altitude = -altitude
          }

          return {
            dateTaken: normalizedDate.display,
            dateTakenDate: normalizedDate.date,
            latitude: Number.isFinite(latitude) ? latitude : null,
            longitude: Number.isFinite(longitude) ? longitude : null,
            heading: heading === null ? null : heading,
            altitude: altitude !== null && Number.isFinite(altitude) ? altitude : null,
          }
        }
      }

      offset += segmentLength
    }

    return emptyResult
  }

  function readImageExifMetadata(file) {
    return new Promise((resolve) => {
      if (!file) {
        resolve({
          dateTaken: '',
          dateTakenDate: '',
          latitude: null,
          longitude: null,
          heading: null,
          altitude: null,
        })
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const result = extractExifMetadataFromJpegArrayBuffer(reader.result)
          resolve(result)
        } catch (error) {
          void error
          resolve({
            dateTaken: '',
            dateTakenDate: '',
            latitude: null,
            longitude: null,
            heading: null,
            altitude: null,
          })
        }
      }
      reader.onerror = () => {
        resolve({
          dateTaken: '',
          dateTakenDate: '',
          latitude: null,
          longitude: null,
          heading: null,
          altitude: null,
        })
      }
      reader.readAsArrayBuffer(file)
    })
  }

  const messages = {
    en: {
      appTitle: 'Locations Explorer',
      navList: 'List',
      navMap: 'Map',
      navDetail: 'Details',
      loading: 'Loading...',
      loadError: 'Could not load data.',
      noData: 'No locations found.',
      sortBy: 'Sort by',
      sortDirection: 'Direction',
      sortByLastModified: 'Last modified',
      sortByName: 'Name',
      sortByDistance: 'Distance from you',
      sortDirectionAsc: 'Ascending',
      sortDirectionDesc: 'Descending',
      openListQueryInWikidata: 'Open the list query in query.wikidata.org',
      openDetails: 'Open details',
      backToList: 'Back to list',
      coordinates: 'Coordinates',
      lastModified: 'Last modified',
      distanceFromYou: 'Distance from you',
      distanceLocating: 'Detecting your location...',
      distanceLocationUnsupported: 'Browser geolocation is not available.',
      distanceLocationDenied: 'Location access was denied.',
      distanceLocationUnavailable: 'Could not determine your location.',
      distanceLocationTimeout: 'Location request timed out.',
      distanceLocationUnknown: 'Location lookup failed.',
      locationOnMap: 'Location on map',
      language: 'Language',
      detailHint: 'Choose a location from list or map.',
      basicInformation: 'Basic information',
      sourcesSectionTitle: 'Sources',
      mediaAndCounts: 'Media and image counts',
      additionalProperties: 'Additional properties',
      sourceUri: 'Source URI',
      wikidataIdLabel: 'WIKIDATA ID',
      collectionMembershipSourcesP5008: 'Collection membership sources (P5008)',
      newLocation: 'Create location',
      createSubLocation: 'Create sub-location',
      saveImage: 'Save image',
      saveImageWizardLocationStep: 'Step 1: Choose photographer location',
      saveImageWizardSubjectStep: 'Step 2: Image type',
      saveImageWizardSubjectLocationStep: 'Step 3: Describe what is in the image',
      saveImageApiFormTitle: 'Save image with Wikimedia API',
      saveImageApiFormHelp: 'Use this separate form to upload a file and provide metadata before saving.',
      saveImageSubjectPrompt: 'Is this image...',
      saveImageSubjectTypeInterior: 'Indoor image',
      saveImageSubjectTypeExterior: 'Outdoor image',
      saveImageSubjectTypeAerial: 'Aerial image',
      saveImageSubjectTypePortrait: 'Portrait photo',
      saveImageSubjectTypeObject: 'Image of an object',
      saveImageSubjectTypePlant: 'Image of a plant',
      saveImageSubjectTypeGeneral: 'Other',
      saveImageSubjectLocationRelevantHelp: 'This type needs place linking. Continue with step 3.',
      saveImageSubjectLocationNotRelevantHelp: 'This type usually does not require place linking.',
      saveImageSubjectLocationToolHelp: 'Click the map, choose the matching feature from the list, and then select matching Wikidata item and image point.',
      saveImageSubjectNoMapToolHelp: 'Select matching Wikidata item and click its location in the image.',
      saveImageSubjectLinkModeLabel: 'Add depicted item using map or without map',
      saveImageSubjectLinkModeMap: 'Using map',
      saveImageSubjectLinkModeImageOnly: 'Without map',
      saveImageSubjectMapClickHelp: 'Click the map where the depicted place/object is located.',
      saveImageSubjectMapZoomLevel: 'Map zoom level',
      saveImageSubjectImageClickHelp: 'Click the image where that same place/object appears.',
      saveImageSubjectImageRequiresFile: 'Select an image file to enable image-point selection.',
      saveImageSubjectImagePointLabel: 'Image point',
      saveImageSubjectWikidataLabel: 'Matching Wikidata item',
      saveImageSubjectWikidataHelp: 'Search by name or choose one of the suggestions for the selected feature.',
      saveImageSubjectDirectWikidataSearchTitle: 'Search Wikidata item',
      saveImageSubjectPairHelp: 'Select the same place in the image and on the map.',
      saveImageSubjectNearbyWikidataSuggestions: 'Suggested map features near the clicked point',
      saveImageSubjectNearbyOsmTagSelectHint: 'Select a map feature first, then choose the matching Wikidata item.',
      saveImageSubjectNearbyWikidataItemsForSelectedTag: 'Matching Wikidata items for selected map feature',
      saveImageSubjectLinkButton: 'Add linked place',
      saveImageSubjectLinkAdded: 'Linked places added: {count}',
      saveImageSubjectTypeRequired: 'Choose image type.',
      saveImageSubjectMapPointRequired: 'Select the related point on the map first.',
      saveImageSubjectImagePointRequired: 'Select the related point in the image first.',
      saveImageSubjectWikidataRequired: 'Select a matching Wikidata item for the linked place.',
      saveImageSubjectLinkRequired: 'For location-relevant images, link at least one place between map, image, and Wikidata.',
      saveImageSubjectFeatureFetchFailed: 'Could not load nearby map features right now.',
      saveImageSubjectNearbyFeaturesTitle: 'Nearby features',
      saveImageSubjectLoadingInfo: 'Loading info...',
      saveImageSubjectNoNearbyFeatures: 'No nearby features found for this click.',
      saveImageSubjectSelectedFeatureTitle: 'Selected feature details',
      saveImageSubjectFeatureDistanceLabel: 'Distance from clicked point',
      saveImageSubjectOpenInOsm: 'Open in OpenStreetMap',
      saveImageSubjectSelectedFeatureWikidataSuggestions: 'Wikidata suggestions for selected feature',
      saveImageCoordinateSource: 'Coordinate source',
      saveImageCoordinateSourceMap: 'Map coordinates',
      saveImageCoordinateSourceExif: 'Image EXIF coordinates',
      saveImageResetToExifCoordinates: 'Reset to EXIF coordinates',
      saveImageResetToWikidataCoordinates: 'Reset to Wikidata item coordinates',
      saveImageCoordinateModeLabel: 'Coordinate picking mode',
      saveImageCoordinateModePhotographer: 'Photographer location + direction (recommended)',
      saveImageCoordinateModeImage: 'Image location only (raw location)',
      saveImageMapModePhotographerShort: 'Photographer + direction',
      saveImageMapModeImageShort: 'Point only',
      saveImageMapToggleCoordinateMode: 'Toggle coordinate mode',
      saveImageMapPickHelpPhotographerStart: 'Move the map so the center camera icon is at photographer location, then click map to set direction.',
      saveImageMapPickHelpPhotographerTarget: 'Click map to update direction. Moving the map keeps heading unchanged.',
      saveImageMapPickHelpImage: 'Move the map so the center point is at image location.',
      saveImageCaption: 'Caption text',
      saveImageDescription: 'Description text',
      saveImageFile: 'Image file',
      saveImageExifReading: 'Reading EXIF metadata from image...',
      saveImageExifDateTaken: 'Date taken (from EXIF)',
      saveImageExifCoordinates: 'Coordinates (from EXIF)',
      saveImageExifHeading: 'Heading (from EXIF)',
      saveImageExifElevation: 'Elevation above sea level (from EXIF)',
      saveImageExifMetadataMissing: 'No EXIF date, coordinates, heading, or elevation found in this file.',
      saveImageHeading: 'Camera heading (degrees)',
      saveImageHeadingPickFromMap: 'Pick heading from map',
      saveImageHeadingPickActive: 'Click the map to set heading direction.',
      saveImageHeadingClear: 'Clear heading',
      saveImageHeadingHelp: 'Optional. Use map picking or type value between 0 and 360.',
      saveImageElevation: 'Elevation above sea level (meters)',
      saveImageElevationUse: 'Include elevation in upload metadata',
      saveImageCoordinatePreviewHide: 'Hide photo preview',
      saveImageCoordinatePreviewShow: 'Show photo preview',
      saveImageFileRequired: 'Select an image file first.',
      saveImageApiTargetFilename: 'Target filename on Commons',
      saveImageFilenameBuilderTitle: 'Build filename',
      saveImageFilenameBuilderHelp: 'Tap parts to include in filename.',
      saveImageFilenameBuilderPartSubjects: 'Subjects',
      saveImageFilenameBuilderPartDate: 'Date',
      saveImageFilenameBuilderPartLocation: 'Location',
      saveImageFilenameBuilderPartCategories: 'Categories',
      saveImageFilenameBuilderPreview: 'Suggested filename',
      saveImageFilenameBuilderPreviewEmpty: 'Select parts to generate filename.',
      saveImageFilenameBuilderApply: 'Use suggestion',
      saveImageFilenameFallbackBase: 'Image',
      saveImageFilenameChecking: 'Checking filename availability...',
      saveImageFilenameAvailable: 'Filename is available on Commons.',
      saveImageFilenameTakenWarning: 'Filename is already in use on Commons.',
      saveImageFilenameCheckFailed: 'Could not verify filename availability right now.',
      saveImageOwnPhotoQuestion: 'Is this photo taken by you?',
      saveImageOwnPhotoYes: 'Yes, own photo',
      saveImageOwnPhotoNo: 'No, not own photo',
      saveImageApiAuthor: 'Author',
      saveImageApiSourceUrl: 'Source URL',
      saveImageApiDateCreated: 'Date created',
      saveImageCommonsMetadataOnlyNote: 'This affects Commons metadata only; it does not edit image EXIF data.',
      saveImageApiLicenseTemplate: 'License template',
      saveImageApiLicenseCcBySa40: 'CC BY-SA 4.0',
      saveImageApiLicenseCcBy40: 'CC BY 4.0',
      saveImageApiLicenseCcZero: 'CC0',
      saveImageCategories: 'Categories',
      saveImageCategoriesHelp: 'Search categories and add them to the list.',
      saveImageCategorySuggestionsEmpty: 'No category suggestions.',
      saveImageNearbyCategorySuggestions: 'Suggested categories from nearby Wikidata and OpenStreetMap items',
      saveImageSubcategorySuggestions: 'Suggested subcategories from selected categories',
      saveImageSubcategoryFarSuggestions: 'Suggested subcategories farther than 1 km from photographer',
      saveImageDepicts: 'Depicts (Wikidata P180)',
      saveImageDepictsHelp: 'Search depicts values and add them to the list.',
      saveImageDepictSuggestionsEmpty: 'No depicts suggestions.',
      saveImageNearbyDepictSuggestions: 'Suggested depicts from nearby Wikidata and OpenStreetMap items',
      saveImageCategoryHierarchyWarning: 'Both broader and more specific categories are selected. Remove broader categories to keep categorization precise.',
      addCategory: 'Add',
      removeCategory: 'Remove',
      addProperty: 'Add property',
      removeProperty: 'Remove property',
      propertySearchPlaceholder: 'Search Wikidata property...',
      propertyValuePlaceholder: 'Property value',
      propertyQuickPicks: 'Quick picks',
      noPropertiesAvailable: 'All suggested properties are already added.',
      saveImageUploadWithApi: 'Save image with MediaWiki API',
      saveImageUploadConfirm: 'Upload this file to Wikimedia Commons now?',
      saveImageUploadSuccess: 'Image uploaded: {filename}',
      saveImageOpenUploadedFile: 'Open uploaded file page',
      saveImageCoordinatesRequired: 'Select coordinates on map or enable EXIF coordinates.',
      createLocationTitle: 'Create Draft Location',
      editLocationTitle: 'Edit Draft Location',
      editLocationData: 'Edit details',
      locationName: 'Location name',
      locationDescription: 'Description text',
      locationType: 'Type',
      wikidataItem: 'Wikidata item',
      latitude: 'Latitude',
      longitude: 'Longitude',
      addressText: 'Address',
      postalCode: 'Postal code',
      municipalityP131: 'Municipality (P131)',
      locatedInAdministrativeTerritorialEntityP131: 'Located in the administrative territorial entity (P131)',
      streetAddressP6375: 'Street address (P6375)',
      postalCodeP281: 'Postal code (P281)',
      locatedOnStreetP669: 'Located on street (P669)',
      houseNumberP670: 'House number (P670)',
      heritageDesignationP1435: 'Heritage designation (P1435)',
      instanceOfP31: 'instance of (P31)',
      architecturalStyleP149: 'Architectural style (P149)',
      routeInstructionP2795: 'Route instruction (P2795)',
      ysoIdP2347: 'YSO ID (P2347)',
      kantoIdP8980: 'KANTO ID (P8980)',
      protectedBuildingsRegisterInFinlandIdP5310: 'Protected Buildings Register in Finland ID (P5310)',
      rkyNationalBuiltHeritageEnvironmentIdP4009: 'RKY national built heritage environment ID (P4009)',
      registerIds: 'Register IDs',
      permanentBuildingNumberVtjPrtP3824: 'Permanent building number VTJ-PRT (P3824)',
      protectedBuildingsRegisterInFinlandBuildingIdP5313: 'Protected Buildings Register in Finland Building ID (P5313)',
      helsinkiPersistentBuildingIdRatuP8355: 'Helsinki persistent building ID Ratu (P8355)',
      commonsCategory: 'Wikimedia Commons category',
      commonsImagesPetScan: 'Commons images (PetScan)',
      viewItImages: 'View-it images',
      commonsImagesWithSource: 'Commons images ({source})',
      imageSourcePetScan: 'petscan',
      imageSourceViewIt: 'view-it',
      inceptionP571: 'Inception (P571)',
      partOfP361: 'Part of (P361)',
      locationP276: 'Location (P276)',
      architectP84: 'Architect (P84)',
      officialClosureDateP3999: 'Date of official closure (P3999)',
      stateOfUseP5817: 'State of use (P5817)',
      image: 'Image',
      imagePlaceholderLabel: 'No image available yet',
      parentLocation: 'Parent location',
      parentLocationPlaceholder: 'Search parent location...',
      clearParent: 'Clear parent',
      wikidataItemPlaceholder: 'Search Wikidata item...',
      create: 'Create',
      saveChanges: 'Save changes',
      cancel: 'Cancel',
      saving: 'Saving...',
      locationNameRequired: 'Location name is required.',
      locationTypeRequired: 'Location type is required.',
      latitudeRequired: 'Latitude is required.',
      longitudeRequired: 'Longitude is required.',
      municipalitySelectionRequired: 'Select municipality from suggestions.',
      commonsSelectionRequired: 'Select Commons category from suggestions.',
      parentSelectionRequired: 'Select parent location from suggestions.',
      wikidataLookupLoading: 'Loading Wikidata details...',
      wikidataLookupFailed: 'Could not load Wikidata details.',
      wikidataSourceNotice: 'Values are read from Wikidata. Clear Wikidata item to edit fields manually.',
      wikidataEditDiffNotice: 'Wikidata values are primary. Local values are shown for comparison and cannot be edited.',
      wikidataCoordinatesMissing: 'Wikidata item has no coordinates.',
      pickCoordinates: 'Pick from map',
      coordinatePickerTitle: 'Pick coordinates',
      placeSearch: 'Place search',
      search: 'Search',
      searching: 'Searching...',
      noSearchResults: 'No matches found.',
      useSelectedCoordinates: 'Use selected coordinates',
      typePlaceholder: 'Search Wikidata type...',
      municipalityPlaceholder: 'Search municipality (Wikidata)...',
      commonsPlaceholder: 'Search Commons category...',
      autocompleteNoMatches: 'No suggestions.',
      lockedField: 'Locked',
      manualValue: 'Manual',
      wikidataValue: 'Wikidata',
      differentValue: 'Different',
      noValue: '-',
      coordMapLegendManual: 'Manual coordinates',
      coordMapLegendWikidata: 'Wikidata coordinates',
      subLocations: 'Sub-locations',
      noSubLocations: 'No sub-locations yet.',
      openDetailsFor: 'Open details for {name}',
      back: 'Back',
      createLocationTypeStepTitle: 'How do you want to create the location?',
      createWizardIntro: 'Choose the creation method first. You can return and change this selection.',
      createModeExistingTitle: 'Add existing Wikidata item',
      createModeExistingDesc: 'Pick an existing Wikidata item and add it to the Wikikuvaajat endangered buildings list.',
      createModeNewWikidataTitle: 'Create new Wikidata item',
      createModeNewWikidataDesc: 'Use a guided form to create a new Wikidata item for a building.',
      addExistingWikidataTitle: 'Add Existing Wikidata Item',
      addExistingWikidataHelp: 'Select an existing Wikidata item and add it to the Wikikuvaajat endangered buildings list.',
      addExistingWikidataSourceHelp: 'Add a source for this item.',
      addExistingWikidataSuccess: 'Added successfully. The list has been refreshed.',
      createNewWikidataTitle: 'Create New Wikidata Item',
      createNewWikidataHelp: 'Required for building: at least one FI/SV/EN name-description pair, location, P31, and source.',
      newWikidataPrimaryLanguageHelp: 'Fill name and description in Finnish, Swedish, and English. At least one language pair is required.',
      languageGroupFi: 'Finnish',
      languageGroupSv: 'Swedish',
      languageGroupEn: 'English',
      additionalLanguages: 'Additional languages',
      additionalLanguagesHelp: 'You can add name and description in other languages too.',
      languageCode: 'Language code',
      languageCodePlaceholder: 'Type code or language name (e.g. de or German)',
      addLanguage: 'Add language',
      removeLanguage: 'Remove language',
      locationAndCoordinates: 'Location and coordinates',
      createWikidataItem: 'Create Wikidata item',
      addToList: 'Add to list',
      next: 'Next',
      wikidataItemRequired: 'Wikidata item is required.',
      locationDescriptionRequired: 'Description is required.',
      locationNameDescriptionPairRequired: 'Fill at least one name and description pair in FI, SV, or EN.',
      locationNameRequiredForLanguage: 'Name is required for language {language}.',
      locationDescriptionRequiredForLanguage: 'Description is required for language {language}.',
      additionalLanguageCodeRequired: 'Language code is required for additional language entries.',
      additionalLanguageCodeInvalid: 'Use a valid language code or select a language from suggestions.',
      countryP17: 'Country (P17)',
      countrySelectionRequired: 'Select country from suggestions.',
      detailedLocationP276: 'Detailed location (P276)',
      partOfPlaceholder: 'Search parent item (Wikidata)...',
      sourceUrl: 'Source URL',
      sourceUrlPlaceholder: 'https://example.org/source',
      sourceTitle: 'Source title',
      sourceTitleLanguage: 'Title language',
      sourceAuthor: 'Source author',
      sourcePublicationDate: 'Publication date',
      sourceRetrievedDate: 'Retrieved date',
      sourcePublicationDatePlaceholder: 'YYYY-MM-DD or D.M.YYYY',
      sourcePublisherP123: 'Publisher (P123)',
      sourcePublisherPlaceholder: 'Search publisher (Wikidata)...',
      sourcePublisherInvalid: 'Publisher (P123) must be a valid Wikidata item.',
      sourcePublishedInP1433: 'Published in (P1433)',
      sourcePublishedInPlaceholder: 'Search publication (Wikidata)...',
      sourcePublishedInInvalid: 'Published in (P1433) must be a valid Wikidata item.',
      sourceLanguageOfWorkP407: 'Language of work or name (P407)',
      sourceLanguageOfWorkPlaceholder: 'Search language (Wikidata)...',
      sourceLanguageOfWorkInvalid: 'Language of work or name (P407) must be a valid Wikidata item.',
      sourceUrlRequiredForAddExisting: 'Source URL is required.',
      newWikidataSourceHelp: 'Add the source for the new item using the same format as for existing Wikidata items.',
      autofillSourceWithCitoid: 'Auto-fill metadata (Citoid)',
      citoidAutofillLoading: 'Loading source metadata...',
      sourceUrlRequiredForArchitect: 'Architect source URL is required.',
      sourceUrlRequiredForInception: 'Inception source URL is required.',
      sourceUrlRequiredForOfficialClosure: 'Official closure date source URL is required.',
      sourceUrlRequiredForHeritage: 'Heritage status source URL is required.',
      keyPropertiesWithSources: 'Key properties with source',
      optionalProperties: 'Optional properties',
      countryPlaceholder: 'Search country (Wikidata)...',
      detailedLocationPlaceholder: 'Search detailed location (Wikidata)...',
      signInWikimedia: 'Sign in with Wikimedia',
      signOut: 'Sign out',
      signedInAs: 'Signed in as {name}',
      addLocationWithCradle: 'Add location with Cradle',
      cradleGuideTitle: 'Add location with Cradle',
      cradleGuideIntro: 'Cradle is a tool for creating new Wikidata items with a form. To use Cradle:',
      cradleGuideStep1: 'Select English as language if it is not already selected.',
      cradleGuideStep2: 'Sign in to Cradle first from the top-right corner.',
      cradleGuideStep3: 'If you are not on the form page, choose form "Building (Wikikuvaajat)".',
      cradleGuideStep4: 'Fill at least Labels, instance of, country, and located in the administrative entity (municipality). Tip: the row supports multi-select. For text fields, set language to "fi".',
      cradleGuideStep5: 'When all required fields are filled, click "Create item" at the bottom of the page.',
      cradleGuideStep6: 'Wait for creation. There is a busy indicator at the top, but it may never finish; verify completion directly from Wikidata.',
      openCradle: 'Open Cradle',
      authRequiredForWikidataWrites: 'Sign in with Wikimedia before editing Wikidata.',
      authRequiredForLocationWrites: 'Sign in with Wikimedia before adding locations.'
    },
    sv: {
      appTitle: 'Platsutforskare',
      navList: 'Lista',
      navMap: 'Karta',
      navDetail: 'Detaljer',
      loading: 'Laddar...',
      loadError: 'Kunde inte ladda data.',
      noData: 'Inga platser hittades.',
      sortBy: 'Sortera efter',
      sortDirection: 'Ordning',
      sortByLastModified: 'Senast ändrad',
      sortByName: 'Namn',
      sortByDistance: 'Avstånd från dig',
      sortDirectionAsc: 'Stigande',
      sortDirectionDesc: 'Fallande',
      openListQueryInWikidata: 'Öppna listans fråga i query.wikidata.org',
      openDetails: 'Visa detaljer',
      backToList: 'Tillbaka till listan',
      coordinates: 'Koordinater',
      lastModified: 'Senast ändrad',
      distanceFromYou: 'Avstånd från dig',
      distanceLocating: 'Hämtar din position...',
      distanceLocationUnsupported: 'Geolokalisering stöds inte i webbläsaren.',
      distanceLocationDenied: 'Åtkomst till position nekades.',
      distanceLocationUnavailable: 'Kunde inte bestämma din position.',
      distanceLocationTimeout: 'Positionsförfrågan tog för lång tid.',
      distanceLocationUnknown: 'Positionshämtning misslyckades.',
      locationOnMap: 'Plats på karta',
      language: 'Språk',
      detailHint: 'Välj en plats från lista eller karta.',
      basicInformation: 'Grundinformation',
      sourcesSectionTitle: 'Källor',
      mediaAndCounts: 'Media och bildantal',
      additionalProperties: 'Ytterligare egenskaper',
      sourceUri: 'Käll-URI',
      wikidataIdLabel: 'WIKIDATA ID',
      collectionMembershipSourcesP5008: 'Källor för listmedlemskap (P5008)',
      newLocation: 'Skapa plats',
      createSubLocation: 'Skapa underplats',
      saveImage: 'Spara bild',
      saveImageWizardLocationStep: 'Steg 1: Välj fotografens plats',
      saveImageWizardSubjectStep: 'Steg 2: Bildtyp',
      saveImageWizardSubjectLocationStep: 'Steg 3: Beskriv vad som finns i bilden',
      saveImageApiFormTitle: 'Spara bild med Wikimedia API',
      saveImageApiFormHelp: 'Använd detta separata formulär för att ladda upp fil och ange metadata före sparning.',
      saveImageSubjectPrompt: 'Är bilden...',
      saveImageSubjectTypeInterior: 'Inomhusbild',
      saveImageSubjectTypeExterior: 'Utomhusbild',
      saveImageSubjectTypeAerial: 'Flygbild',
      saveImageSubjectTypePortrait: 'Porträttbild',
      saveImageSubjectTypeObject: 'Bild av ett föremål',
      saveImageSubjectTypePlant: 'Bild av en växt',
      saveImageSubjectTypeGeneral: 'Övrigt',
      saveImageSubjectLocationRelevantHelp: 'Den här typen kräver platskoppling. Fortsätt till steg 3.',
      saveImageSubjectLocationNotRelevantHelp: 'Den här typen kräver vanligtvis ingen platskoppling.',
      saveImageSubjectLocationToolHelp: 'Klicka på kartan, välj rätt objekt i listan och välj sedan motsvarande Wikidata-objekt och punkt i bilden.',
      saveImageSubjectNoMapToolHelp: 'Välj motsvarande Wikidata-objekt och klicka dess plats i bilden.',
      saveImageSubjectLinkModeLabel: 'Lägg till det som syns i bilden med karta eller utan karta',
      saveImageSubjectLinkModeMap: 'Med karta',
      saveImageSubjectLinkModeImageOnly: 'Utan karta',
      saveImageSubjectMapClickHelp: 'Klicka på kartan där den avbildade platsen/saken finns.',
      saveImageSubjectMapZoomLevel: 'Kartans zoomnivå',
      saveImageSubjectImageClickHelp: 'Klicka i bilden där samma plats/sak syns.',
      saveImageSubjectImageRequiresFile: 'Välj en bildfil för att kunna markera punkt i bilden.',
      saveImageSubjectImagePointLabel: 'Punkt i bild',
      saveImageSubjectWikidataLabel: 'Motsvarande Wikidata-objekt',
      saveImageSubjectWikidataHelp: 'Sök med namn eller välj ett förslag för det valda objektet.',
      saveImageSubjectDirectWikidataSearchTitle: 'Sök Wikidata-objekt',
      saveImageSubjectPairHelp: 'Välj samma plats i bilden och på kartan.',
      saveImageSubjectNearbyWikidataSuggestions: 'Föreslagna kartobjekt nära den klickade punkten',
      saveImageSubjectNearbyOsmTagSelectHint: 'Välj först ett kartobjekt och sedan motsvarande Wikidata-objekt.',
      saveImageSubjectNearbyWikidataItemsForSelectedTag: 'Matchande Wikidata-objekt för valt kartobjekt',
      saveImageSubjectLinkButton: 'Lägg till kopplad plats',
      saveImageSubjectLinkAdded: 'Kopplade platser: {count}',
      saveImageSubjectTypeRequired: 'Välj bildtyp.',
      saveImageSubjectMapPointRequired: 'Välj först motsvarande punkt på kartan.',
      saveImageSubjectImagePointRequired: 'Välj först motsvarande punkt i bilden.',
      saveImageSubjectWikidataRequired: 'Välj ett motsvarande Wikidata-objekt för den kopplade platsen.',
      saveImageSubjectLinkRequired: 'För platsrelevanta bilder, koppla minst en plats mellan karta, bild och Wikidata.',
      saveImageSubjectFeatureFetchFailed: 'Kunde inte läsa in närliggande kartobjekt just nu.',
      saveImageSubjectNearbyFeaturesTitle: 'Närliggande objekt',
      saveImageSubjectLoadingInfo: 'Laddar information...',
      saveImageSubjectNoNearbyFeatures: 'Inga närliggande objekt hittades för klickpunkten.',
      saveImageSubjectSelectedFeatureTitle: 'Detaljer för valt objekt',
      saveImageSubjectFeatureDistanceLabel: 'Avstånd från klickpunkten',
      saveImageSubjectOpenInOsm: 'Öppna i OpenStreetMap',
      saveImageSubjectSelectedFeatureWikidataSuggestions: 'Wikidata-förslag för valt objekt',
      saveImageCoordinateSource: 'Koordinatkälla',
      saveImageCoordinateSourceMap: 'Kartkoordinater',
      saveImageCoordinateSourceExif: 'Bildens EXIF-koordinater',
      saveImageResetToExifCoordinates: 'Återställ till EXIF-koordinater',
      saveImageResetToWikidataCoordinates: 'Återställ till Wikidata-objektets koordinater',
      saveImageCoordinateModeLabel: 'Läge för koordinatval',
      saveImageCoordinateModePhotographer: 'Fotografens plats + riktning (rekommenderat)',
      saveImageCoordinateModeImage: 'Endast bildens plats (rå position)',
      saveImageMapModePhotographerShort: 'Fotograf + riktning',
      saveImageMapModeImageShort: 'Endast bild',
      saveImageMapToggleCoordinateMode: 'Växla koordinatläge',
      saveImageMapPickHelpPhotographerStart: 'Flytta kartan så att kameraikonen i mitten är vid fotografens plats, klicka sedan på kartan för att ange riktning.',
      saveImageMapPickHelpPhotographerTarget: 'Klicka på kartan för att uppdatera riktning. Att flytta kartan behåller samma riktning.',
      saveImageMapPickHelpImage: 'Flytta kartan så att mittpunkten är vid bildens plats.',
      saveImageCaption: 'Bildtext',
      saveImageDescription: 'Beskrivning',
      saveImageFile: 'Bildfil',
      saveImageExifReading: 'Läser EXIF-metadata från bilden...',
      saveImageExifDateTaken: 'Fotodatum (från EXIF)',
      saveImageExifCoordinates: 'Koordinater (från EXIF)',
      saveImageExifHeading: 'Riktning (från EXIF)',
      saveImageExifElevation: 'Höjd över havet (från EXIF)',
      saveImageExifMetadataMissing: 'Ingen EXIF-datum, koordinater, riktning eller höjd hittades i filen.',
      saveImageHeading: 'Kamerariktning (grader)',
      saveImageHeadingPickFromMap: 'Välj riktning på kartan',
      saveImageHeadingPickActive: 'Klicka på kartan för att ange riktning.',
      saveImageHeadingClear: 'Rensa riktning',
      saveImageHeadingHelp: 'Valfritt. Välj på kartan eller ange värde mellan 0 och 360.',
      saveImageElevation: 'Höjd över havet (meter)',
      saveImageElevationUse: 'Inkludera höjd i uppladdningsmetadata',
      saveImageCoordinatePreviewHide: 'Dölj förhandsvisning',
      saveImageCoordinatePreviewShow: 'Visa förhandsvisning',
      saveImageFileRequired: 'Välj en bildfil först.',
      saveImageApiTargetFilename: 'Målfilnamn på Commons',
      saveImageFilenameBuilderTitle: 'Bygg filnamn',
      saveImageFilenameBuilderHelp: 'Tryck på delar som ska ingå i filnamnet.',
      saveImageFilenameBuilderPartSubjects: 'Motiv',
      saveImageFilenameBuilderPartDate: 'Datum',
      saveImageFilenameBuilderPartLocation: 'Plats',
      saveImageFilenameBuilderPartCategories: 'Kategorier',
      saveImageFilenameBuilderPreview: 'Föreslaget filnamn',
      saveImageFilenameBuilderPreviewEmpty: 'Välj delar för att skapa filnamn.',
      saveImageFilenameBuilderApply: 'Använd förslag',
      saveImageFilenameFallbackBase: 'Bild',
      saveImageFilenameChecking: 'Kontrollerar om filnamnet är ledigt...',
      saveImageFilenameAvailable: 'Filnamnet är ledigt på Commons.',
      saveImageFilenameTakenWarning: 'Filnamnet används redan på Commons.',
      saveImageFilenameCheckFailed: 'Det gick inte att kontrollera filnamnets tillgänglighet just nu.',
      saveImageOwnPhotoQuestion: 'Är bilden tagen av dig?',
      saveImageOwnPhotoYes: 'Ja, egen bild',
      saveImageOwnPhotoNo: 'Nej, inte egen bild',
      saveImageApiAuthor: 'Upphovsperson',
      saveImageApiSourceUrl: 'Käll-URL',
      saveImageApiDateCreated: 'Skapandedatum',
      saveImageCommonsMetadataOnlyNote: 'Gäller endast metadata på Commons; bildens EXIF-data ändras inte.',
      saveImageApiLicenseTemplate: 'Licensmall',
      saveImageApiLicenseCcBySa40: 'CC BY-SA 4.0',
      saveImageApiLicenseCcBy40: 'CC BY 4.0',
      saveImageApiLicenseCcZero: 'CC0',
      saveImageCategories: 'Kategorier',
      saveImageCategoriesHelp: 'Sök kategorier och lägg till dem i listan.',
      saveImageCategorySuggestionsEmpty: 'Inga kategoriförslag.',
      saveImageNearbyCategorySuggestions: 'Föreslagna kategorier från närliggande Wikidata- och OpenStreetMap-objekt',
      saveImageSubcategorySuggestions: 'Föreslagna underkategorier från valda kategorier',
      saveImageSubcategoryFarSuggestions: 'Föreslagna underkategorier mer än 1 km från fotografen',
      saveImageDepicts: 'Avbildar (Wikidata P180)',
      saveImageDepictsHelp: 'Sök avbildar-värden och lägg till dem i listan.',
      saveImageDepictSuggestionsEmpty: 'Inga avbildar-förslag.',
      saveImageNearbyDepictSuggestions: 'Föreslagna avbildar-värden från närliggande Wikidata- och OpenStreetMap-objekt',
      saveImageCategoryHierarchyWarning: 'Både över- och underkategorier är valda. Ta bort bredare kategorier för mer exakt kategorisering.',
      addCategory: 'Lägg till',
      removeCategory: 'Ta bort',
      addProperty: 'Lägg till egenskap',
      removeProperty: 'Ta bort egenskap',
      propertySearchPlaceholder: 'Sök Wikidata-egenskap...',
      propertyValuePlaceholder: 'Egenskapsvärde',
      propertyQuickPicks: 'Snabbval',
      noPropertiesAvailable: 'Alla föreslagna egenskaper har redan lagts till.',
      saveImageUploadWithApi: 'Spara bild med MediaWiki API',
      saveImageUploadConfirm: 'Ladda upp den här filen till Wikimedia Commons nu?',
      saveImageUploadSuccess: 'Bild uppladdad: {filename}',
      saveImageOpenUploadedFile: 'Öppna den uppladdade filsidan',
      saveImageCoordinatesRequired: 'Välj koordinater på kartan eller aktivera EXIF-koordinater.',
      createLocationTitle: 'Skapa utkastplats',
      editLocationTitle: 'Redigera utkastplats',
      editLocationData: 'Redigera uppgifter',
      locationName: 'Platsnamn',
      locationDescription: 'Beskrivningstext',
      locationType: 'Typ',
      wikidataItem: 'Wikidata-objekt',
      latitude: 'Latitud',
      longitude: 'Longitud',
      addressText: 'Adress',
      postalCode: 'Postnummer',
      municipalityP131: 'Kommun (P131)',
      locatedInAdministrativeTerritorialEntityP131: 'Belägen i administrativ enhet (P131)',
      streetAddressP6375: 'Gatuadress (P6375)',
      postalCodeP281: 'Postnummer (P281)',
      locatedOnStreetP669: 'Belägen på gata (P669)',
      houseNumberP670: 'Husnummer (P670)',
      heritageDesignationP1435: 'Kulturminnesklassning (P1435)',
      instanceOfP31: 'instans av (P31)',
      architecturalStyleP149: 'Arkitektonisk stil (P149)',
      routeInstructionP2795: 'Vägbeskrivning (P2795)',
      ysoIdP2347: 'YSO-ID (P2347)',
      kantoIdP8980: 'KANTO-ID (P8980)',
      protectedBuildingsRegisterInFinlandIdP5310: 'ID i skyddade byggnaders register i Finland (P5310)',
      rkyNationalBuiltHeritageEnvironmentIdP4009: 'RKY nationellt byggt kulturmiljö-ID (P4009)',
      registerIds: 'Register-ID:n',
      permanentBuildingNumberVtjPrtP3824: 'Permanent byggnadsnummer VTJ-PRT (P3824)',
      protectedBuildingsRegisterInFinlandBuildingIdP5313: 'Byggnads-ID i skyddade byggnaders register i Finland (P5313)',
      helsinkiPersistentBuildingIdRatuP8355: 'Helsingfors beständiga byggnads-ID Ratu (P8355)',
      commonsCategory: 'Wikimedia Commons-kategori',
      commonsImagesPetScan: 'Commons-bilder (PetScan)',
      viewItImages: 'View-it-bilder',
      commonsImagesWithSource: 'Commons-bilder ({source})',
      imageSourcePetScan: 'petscan',
      imageSourceViewIt: 'view-it',
      inceptionP571: 'Starttid (P571)',
      partOfP361: 'Del av (P361)',
      locationP276: 'Plats (P276)',
      architectP84: 'Arkitekt (P84)',
      officialClosureDateP3999: 'Datum för officiell stängning (P3999)',
      stateOfUseP5817: 'Användningsstatus (P5817)',
      image: 'Bild',
      imagePlaceholderLabel: 'Ingen bild ännu',
      parentLocation: 'Överordnad plats',
      parentLocationPlaceholder: 'Sök överordnad plats...',
      clearParent: 'Rensa overordnad',
      wikidataItemPlaceholder: 'Sök Wikidata-objekt...',
      create: 'Skapa',
      saveChanges: 'Spara ändringar',
      cancel: 'Avbryt',
      saving: 'Sparar...',
      locationNameRequired: 'Platsnamn krävs.',
      locationTypeRequired: 'Platstyp krävs.',
      latitudeRequired: 'Latitud krävs.',
      longitudeRequired: 'Longitud krävs.',
      municipalitySelectionRequired: 'Välj kommun från förslag.',
      commonsSelectionRequired: 'Välj Commons-kategori från förslag.',
      parentSelectionRequired: 'Välj överordnad plats från förslag.',
      wikidataLookupLoading: 'Laddar Wikidata-uppgifter...',
      wikidataLookupFailed: 'Kunde inte hämta Wikidata-uppgifter.',
      wikidataSourceNotice: 'Värden kommer från Wikidata. Töm Wikidata-fältet för manuell redigering.',
      wikidataEditDiffNotice: 'Wikidata-värden är primära. Lokala värden visas för jämförelse och kan inte redigeras.',
      wikidataCoordinatesMissing: 'Wikidata-objektet saknar koordinater.',
      pickCoordinates: 'Välj på karta',
      coordinatePickerTitle: 'Välj koordinater',
      placeSearch: 'Sök plats',
      search: 'Sök',
      searching: 'Söker...',
      noSearchResults: 'Inga träffar.',
      useSelectedCoordinates: 'Använd valda koordinater',
      typePlaceholder: 'Sök Wikidata-typ...',
      municipalityPlaceholder: 'Sök kommun (Wikidata)...',
      commonsPlaceholder: 'Sök Commons-kategori...',
      autocompleteNoMatches: 'Inga förslag.',
      lockedField: 'Låst',
      manualValue: 'Manuell',
      wikidataValue: 'Wikidata',
      differentValue: 'Avviker',
      noValue: '-',
      coordMapLegendManual: 'Manuella koordinater',
      coordMapLegendWikidata: 'Wikidata-koordinater',
      subLocations: 'Underplatser',
      noSubLocations: 'Inga underplatser ännu.',
      openDetailsFor: 'Visa detaljer för {name}',
      back: 'Tillbaka',
      createLocationTypeStepTitle: 'Hur vill du skapa platsen?',
      createWizardIntro: 'Välj först hur platsen ska skapas. Du kan gå tillbaka och byta val.',
      createModeExistingTitle: 'Lägg till befintligt Wikidata-objekt',
      createModeExistingDesc: 'Välj ett befintligt Wikidata-objekt och lägg till det i Wikikuvaajat-listan över hotade byggnader.',
      createModeNewWikidataTitle: 'Skapa nytt Wikidata-objekt',
      createModeNewWikidataDesc: 'Använd ett guidat formulär för att skapa ett nytt Wikidata-objekt för en byggnad.',
      addExistingWikidataTitle: 'Lägg till befintligt Wikidata-objekt',
      addExistingWikidataHelp: 'Välj ett befintligt Wikidata-objekt och lägg till det i Wikikuvaajat-listan över hotade byggnader.',
      addExistingWikidataSourceHelp: 'Lägg till en källa för objektet.',
      addExistingWikidataSuccess: 'Tillägg lyckades. Listan har uppdaterats.',
      createNewWikidataTitle: 'Skapa nytt Wikidata-objekt',
      createNewWikidataHelp: 'Obligatoriskt för byggnad: minst ett namn-beskrivningspar på FI/SV/EN, plats, P31 och källa.',
      newWikidataPrimaryLanguageHelp: 'Fyll i namn och beskrivning på finska, svenska och engelska. Minst ett språkpar krävs.',
      languageGroupFi: 'Finska',
      languageGroupSv: 'Svenska',
      languageGroupEn: 'Engelska',
      additionalLanguages: 'Ytterligare språk',
      additionalLanguagesHelp: 'Du kan också lägga till namn och beskrivning på andra språk.',
      languageCode: 'Språkkod',
      languageCodePlaceholder: 'Skriv kod eller språkets namn (t.ex. de eller tyska)',
      addLanguage: 'Lägg till språk',
      removeLanguage: 'Ta bort språk',
      locationAndCoordinates: 'Plats och koordinater',
      createWikidataItem: 'Skapa Wikidata-objekt',
      addToList: 'Lägg till i listan',
      next: 'Nästa',
      wikidataItemRequired: 'Wikidata-objekt krävs.',
      locationDescriptionRequired: 'Beskrivning krävs.',
      locationNameDescriptionPairRequired: 'Fyll i minst ett namn- och beskrivningspar på FI, SV eller EN.',
      locationNameRequiredForLanguage: 'Namn krävs för språket {language}.',
      locationDescriptionRequiredForLanguage: 'Beskrivning krävs för språket {language}.',
      additionalLanguageCodeRequired: 'Språkkod krävs för ytterligare språkrader.',
      additionalLanguageCodeInvalid: 'Använd en giltig språkkod eller välj ett språk från förslagen.',
      countryP17: 'Land (P17)',
      countrySelectionRequired: 'Välj land från förslag.',
      detailedLocationP276: 'Noggrannare plats (P276)',
      partOfPlaceholder: 'Sök överordnat objekt (Wikidata)...',
      sourceUrl: 'Käll-URL',
      sourceUrlPlaceholder: 'https://example.org/source',
      sourceTitle: 'Källtitel',
      sourceTitleLanguage: 'Titelns språk',
      sourceAuthor: 'Källans författare',
      sourcePublicationDate: 'Publiceringsdatum',
      sourceRetrievedDate: 'Hämtningsdatum',
      sourcePublicationDatePlaceholder: 'ÅÅÅÅ-MM-DD eller D.M.ÅÅÅÅ',
      sourcePublisherP123: 'Utgivare (P123)',
      sourcePublisherPlaceholder: 'Sök utgivare (Wikidata)...',
      sourcePublisherInvalid: 'Utgivare (P123) måste vara ett giltigt Wikidata-objekt.',
      sourcePublishedInP1433: 'Publicerad i (P1433)',
      sourcePublishedInPlaceholder: 'Sök publikation (Wikidata)...',
      sourcePublishedInInvalid: 'Publicerad i (P1433) måste vara ett giltigt Wikidata-objekt.',
      sourceLanguageOfWorkP407: 'Språk för verk eller namn (P407)',
      sourceLanguageOfWorkPlaceholder: 'Sök språk (Wikidata)...',
      sourceLanguageOfWorkInvalid: 'Språk för verk eller namn (P407) måste vara ett giltigt Wikidata-objekt.',
      sourceUrlRequiredForAddExisting: 'Käll-URL krävs.',
      newWikidataSourceHelp: 'Lägg till källa för det nya objektet i samma format som för befintliga Wikidata-objekt.',
      autofillSourceWithCitoid: 'Autofyll metadata (Citoid)',
      citoidAutofillLoading: 'Hämtar källmetadata...',
      sourceUrlRequiredForArchitect: 'Käll-URL krävs för arkitekt.',
      sourceUrlRequiredForInception: 'Käll-URL krävs för starttid.',
      sourceUrlRequiredForOfficialClosure: 'Käll-URL krävs för datum för officiell stängning.',
      sourceUrlRequiredForHeritage: 'Käll-URL krävs för kulturminnesstatus.',
      keyPropertiesWithSources: 'Nyckelegenskaper med källa',
      optionalProperties: 'Valfria egenskaper',
      countryPlaceholder: 'Sök land (Wikidata)...',
      detailedLocationPlaceholder: 'Sök noggrannare plats (Wikidata)...',
      signInWikimedia: 'Logga in med Wikimedia',
      signOut: 'Logga ut',
      signedInAs: 'Inloggad som {name}',
      addLocationWithCradle: 'Lägg till plats med Cradle',
      cradleGuideTitle: 'Lägg till plats med Cradle',
      cradleGuideIntro: 'Cradle är ett verktyg för att skapa nya Wikidata-objekt med ett formulär. För att använda Cradle:',
      cradleGuideStep1: 'Välj engelska som språk om det inte redan är valt.',
      cradleGuideStep2: 'Logga först in i Cradle från övre högra hörnet.',
      cradleGuideStep3: 'Om du inte är på formulärsidan, välj formuläret "Building (Wikikuvaajat)".',
      cradleGuideStep4: 'Fyll minst i Labels, instance of, country och located in the administrative entity (kommun). Tips: raden stöder flerval. För textfält, sätt språk till "fi".',
      cradleGuideStep5: 'När alla obligatoriska fält är ifyllda, klicka på "Create item" längst ner på sidan.',
      cradleGuideStep6: 'Vänta på skapandet. Det finns en busy-indikator högst upp, men den kan fastna; kontrollera resultatet direkt i Wikidata.',
      openCradle: 'Öppna Cradle',
      authRequiredForWikidataWrites: 'Logga in med Wikimedia innan du redigerar Wikidata.',
      authRequiredForLocationWrites: 'Logga in med Wikimedia innan du lägger till platser.'
    },
    fi: {
      appTitle: 'Sijaintiselain',
      navList: 'Lista',
      navMap: 'Kartta',
      navDetail: 'Tiedot',
      loading: 'Ladataan...',
      loadError: 'Tietojen lataus ei onnistunut.',
      noData: 'Sijainteja ei löytynyt.',
      sortBy: 'Järjestä',
      sortDirection: 'Suunta',
      sortByLastModified: 'Viimeksi muokattu',
      sortByName: 'Nimi',
      sortByDistance: 'Etäisyys käyttäjästä',
      sortDirectionAsc: 'Nouseva',
      sortDirectionDesc: 'Laskeva',
      openListQueryInWikidata: 'Avaa listan kysely query.wikidata.orgissa',
      openDetails: 'Avaa tiedot',
      backToList: 'Takaisin listaan',
      coordinates: 'Koordinaatit',
      lastModified: 'Viimeksi muokattu',
      distanceFromYou: 'Etäisyys käyttäjästä',
      distanceLocating: 'Haetaan sijaintiasi...',
      distanceLocationUnsupported: 'Selaimen geopaikannus ei ole käytettävissä.',
      distanceLocationDenied: 'Sijainnin käyttö estettiin.',
      distanceLocationUnavailable: 'Sijaintia ei voitu määrittää.',
      distanceLocationTimeout: 'Sijaintipyyntö aikakatkaistiin.',
      distanceLocationUnknown: 'Sijainnin haku epäonnistui.',
      locationOnMap: 'Sijainti kartalla',
      language: 'Kieli',
      detailHint: 'Valitse sijainti listasta tai kartalta.',
      basicInformation: 'Perustiedot',
      sourcesSectionTitle: 'Lisätietoja',
      mediaAndCounts: 'Media ja kuvamäärät',
      additionalProperties: 'Lisäominaisuudet',
      sourceUri: 'Lähde-URI',
      wikidataIdLabel: 'WIKIDATA ID',
      collectionMembershipSourcesP5008: 'Listajäsenyyden lähteet (P5008)',
      newLocation: 'Luo kohde',
      createSubLocation: 'Luo alakohde',
      saveImage: 'Tallenna kuva',
      saveImageWizardLocationStep: 'Vaihe 1: Valitse kuvaajan sijainti',
      saveImageWizardSubjectStep: 'Vaihe 2: Kuvan tyyppi',
      saveImageWizardSubjectLocationStep: 'Vaihe 3: Kerro mitä kuvassa on',
      saveImageApiFormTitle: 'Tallenna kuva Wikimedia API:lla',
      saveImageApiFormHelp: 'Käytä tätä erillistä lomaketta tiedoston lataamiseen ja metatietojen antamiseen ennen tallennusta.',
      saveImageSubjectPrompt: 'Onko kuva...',
      saveImageSubjectTypeInterior: 'Sisäkuva',
      saveImageSubjectTypeExterior: 'Ulkokuva',
      saveImageSubjectTypeAerial: 'Ilmakuva',
      saveImageSubjectTypePortrait: 'Henkilökuva',
      saveImageSubjectTypeObject: 'Kuva esineestä',
      saveImageSubjectTypePlant: 'Kuva kasvista',
      saveImageSubjectTypeGeneral: 'Muu',
      saveImageSubjectLocationRelevantHelp: 'Tämä kuvatyyppi vaatii paikan linkityksen. Jatka vaiheeseen 3.',
      saveImageSubjectLocationNotRelevantHelp: 'Tämä kuvatyyppi ei yleensä vaadi paikan linkitystä.',
      saveImageSubjectLocationToolHelp: 'Klikkaa karttaa, valitse listasta oikea kohde ja valitse sitten sitä vastaava Wikidata-kohde sekä piste kuvasta.',
      saveImageSubjectNoMapToolHelp: 'Valitse vastaava Wikidata-kohde ja klikkaa sen sijainti kuvasta.',
      saveImageSubjectLinkModeLabel: 'Lisää kuvassa näkyvä asia käyttäen karttaa ja ilman karttaa',
      saveImageSubjectLinkModeMap: 'Kartalla',
      saveImageSubjectLinkModeImageOnly: 'Ilman karttaa',
      saveImageSubjectMapClickHelp: 'Klikkaa karttaa kohdasta, jossa kuvassa näkyvä paikka tai kohde sijaitsee.',
      saveImageSubjectMapZoomLevel: 'Kartan zoom-taso',
      saveImageSubjectImageClickHelp: 'Klikkaa kuvaa kohdasta, jossa sama paikka tai kohde näkyy.',
      saveImageSubjectImageRequiresFile: 'Valitse kuvatiedosto, jotta voit merkitä kohdan kuvasta.',
      saveImageSubjectImagePointLabel: 'Kuvan piste',
      saveImageSubjectWikidataLabel: 'Vastaava Wikidata-kohde',
      saveImageSubjectWikidataHelp: 'Hae nimellä tai valitse valitulle kohteelle ehdotettu Wikidata-kohde.',
      saveImageSubjectDirectWikidataSearchTitle: 'Etsi Wikidata-kohdetta',
      saveImageSubjectPairHelp: 'Valitse sama paikka kuvasta ja kartasta.',
      saveImageSubjectNearbyWikidataSuggestions: 'Klikatun pisteen lähellä olevat karttakohteet',
      saveImageSubjectNearbyOsmTagSelectHint: 'Valitse ensin karttakohde ja sitten sitä vastaava Wikidata-kohde.',
      saveImageSubjectNearbyWikidataItemsForSelectedTag: 'Valitun karttakohteen mahdolliset Wikidata-kohteet',
      saveImageSubjectLinkButton: 'Lisää linkitetty paikka',
      saveImageSubjectLinkAdded: 'Linkitettyjä paikkoja: {count}',
      saveImageSubjectTypeRequired: 'Valitse kuvan tyyppi.',
      saveImageSubjectMapPointRequired: 'Valitse ensin vastaava piste kartalta.',
      saveImageSubjectImagePointRequired: 'Valitse ensin vastaava piste kuvasta.',
      saveImageSubjectWikidataRequired: 'Valitse linkitetylle paikalle vastaava Wikidata-kohde.',
      saveImageSubjectLinkRequired: 'Sijaintiriippuvaisissa kuvissa linkitä vähintään yksi paikka kartan, kuvan ja Wikidatan välillä.',
      saveImageSubjectFeatureFetchFailed: 'Lähikohteiden lataaminen epäonnistui.',
      saveImageSubjectNearbyFeaturesTitle: 'Lähellä olevat kohteet',
      saveImageSubjectLoadingInfo: 'Ladataan tietoja...',
      saveImageSubjectNoNearbyFeatures: 'Klikatun pisteen läheltä ei löytynyt kohteita.',
      saveImageSubjectSelectedFeatureTitle: 'Valitun kohteen lisätiedot',
      saveImageSubjectFeatureDistanceLabel: 'Etäisyys klikatusta pisteestä',
      saveImageSubjectOpenInOsm: 'Avaa OpenStreetMapissa',
      saveImageSubjectSelectedFeatureWikidataSuggestions: 'Valitun kohteen Wikidata-ehdotukset',
      saveImageCoordinateSource: 'Koordinaattien lähde',
      saveImageCoordinateSourceMap: 'Karttakoordinaatit',
      saveImageCoordinateSourceExif: 'Kuvan EXIF-koordinaatit',
      saveImageResetToExifCoordinates: 'Palauta EXIF-koordinaatteihin',
      saveImageResetToWikidataCoordinates: 'Palauta Wikidata-kohteen koordinaatteihin',
      saveImageCoordinateModeLabel: 'Koordinaattien poimintatapa',
      saveImageCoordinateModePhotographer: 'Kuvaajan sijainti + suunta (suositus)',
      saveImageCoordinateModeImage: 'Vain kuvan sijainti (raakatieto)',
      saveImageMapModePhotographerShort: 'Kuvaaja + suunta',
      saveImageMapModeImageShort: 'Vain kuva',
      saveImageMapToggleCoordinateMode: 'Vaihda koordinaattitapaa',
      saveImageMapPickHelpPhotographerStart: 'Liikuta karttaa niin, että keskellä oleva kameraikoni on kuvaajan sijainnissa, ja klikkaa sitten karttaa suunnan asettamiseksi.',
      saveImageMapPickHelpPhotographerTarget: 'Klikkaa karttaa suunnan päivittämiseksi. Kartan liikuttaminen säilyttää suunnan samana.',
      saveImageMapPickHelpImage: 'Liikuta karttaa niin, että keskipiste on kuvan sijainnissa.',
      saveImageCaption: 'Kuvateksti',
      saveImageDescription: 'Kuvaus',
      saveImageFile: 'Kuvatiedosto',
      saveImageExifReading: 'Luetaan kuvan EXIF-metatietoja...',
      saveImageExifDateTaken: 'Kuvauspäivä (EXIF)',
      saveImageExifCoordinates: 'Koordinaatit (EXIF)',
      saveImageExifHeading: 'Suunta (EXIF)',
      saveImageExifElevation: 'Korkeus merenpinnasta (EXIF)',
      saveImageExifMetadataMissing: 'Tiedostosta ei löytynyt EXIF-päivämäärää, koordinaatteja, suuntaa tai korkeutta.',
      saveImageHeading: 'Kuvaussuunta (astetta)',
      saveImageHeadingPickFromMap: 'Valitse suunta kartalta',
      saveImageHeadingPickActive: 'Aseta suunta klikkaamalla karttaa.',
      saveImageHeadingClear: 'Tyhjennä suunta',
      saveImageHeadingHelp: 'Valinnainen. Valitse kartalta tai anna arvo väliltä 0-360.',
      saveImageElevation: 'Korkeus merenpinnasta (metriä)',
      saveImageElevationUse: 'Sisällytä korkeus ladattaviin metatietoihin',
      saveImageCoordinatePreviewHide: 'Piilota esikatselukuva',
      saveImageCoordinatePreviewShow: 'Näytä esikatselukuva',
      saveImageFileRequired: 'Valitse ensin kuvatiedosto.',
      saveImageApiTargetFilename: 'Commonsin kohdetiedoston nimi',
      saveImageFilenameBuilderTitle: 'Muodosta tiedostonimi',
      saveImageFilenameBuilderHelp: 'Napauta mukaan otettavat osat.',
      saveImageFilenameBuilderPartSubjects: 'Kohteet',
      saveImageFilenameBuilderPartDate: 'Päivämäärä',
      saveImageFilenameBuilderPartLocation: 'Sijainti',
      saveImageFilenameBuilderPartCategories: 'Luokat',
      saveImageFilenameBuilderPreview: 'Ehdotettu tiedostonimi',
      saveImageFilenameBuilderPreviewEmpty: 'Valitse osia tiedostonimen muodostamiseen.',
      saveImageFilenameBuilderApply: 'Käytä ehdotusta',
      saveImageFilenameFallbackBase: 'Kuva',
      saveImageFilenameChecking: 'Tarkistetaan tiedostonimen saatavuutta...',
      saveImageFilenameAvailable: 'Tiedostonimi on vapaana Commonsissa.',
      saveImageFilenameTakenWarning: 'Tiedostonimi on jo käytössä Commonsissa.',
      saveImageFilenameCheckFailed: 'Tiedostonimen saatavuuden tarkistus epäonnistui juuri nyt.',
      saveImageOwnPhotoQuestion: 'Onko kuva itse ottamasi?',
      saveImageOwnPhotoYes: 'Kyllä, oma kuva',
      saveImageOwnPhotoNo: 'Ei, ei oma kuva',
      saveImageApiAuthor: 'Tekijä',
      saveImageApiSourceUrl: 'Lähde-URL',
      saveImageApiDateCreated: 'Luontipäivä',
      saveImageCommonsMetadataOnlyNote: 'Tämä koskee vain Commonsin metatietoja eikä muuta kuvan EXIF-tietoja.',
      saveImageApiLicenseTemplate: 'Lisenssipohja',
      saveImageApiLicenseCcBySa40: 'CC BY-SA 4.0',
      saveImageApiLicenseCcBy40: 'CC BY 4.0',
      saveImageApiLicenseCcZero: 'CC0',
      saveImageCategories: 'Luokat',
      saveImageCategoriesHelp: 'Hae luokkia ja lisää ne listaan.',
      saveImageCategorySuggestionsEmpty: 'Ei luokkaehdotuksia.',
      saveImageNearbyCategorySuggestions: 'Lähialueen Wikidata- ja OpenStreetMap-kohteiden ehdotetut luokat',
      saveImageSubcategorySuggestions: 'Ehdotetut alaluokat nykyisten luokkien perusteella',
      saveImageSubcategoryFarSuggestions: 'Ehdotetut alaluokat yli 1 km päässä kuvaajasta',
      saveImageDepicts: 'Kuvassa (Wikidata P180)',
      saveImageDepictsHelp: 'Hae P180-arvoja ja lisää ne listaan.',
      saveImageDepictSuggestionsEmpty: 'Ei P180-ehdotuksia.',
      saveImageNearbyDepictSuggestions: 'Lähialueen Wikidata- ja OpenStreetMap-kohteiden ehdotetut P180-arvot',
      saveImageCategoryHierarchyWarning: 'Valittuna on sekä ylä- että alaluokkia. Poista epätarkemmat yläluokat, jotta luokitus pysyy tarkkana.',
      addCategory: 'Lisää',
      removeCategory: 'Poista',
      addProperty: 'Lisää ominaisuus',
      removeProperty: 'Poista ominaisuus',
      propertySearchPlaceholder: 'Hae Wikidata-ominaisuutta...',
      propertyValuePlaceholder: 'Ominaisuuden arvo',
      propertyQuickPicks: 'Pikavalinnat',
      noPropertiesAvailable: 'Kaikki ehdotetut ominaisuudet on jo lisätty.',
      saveImageUploadWithApi: 'Tallenna kuva MediaWiki API:lla',
      saveImageUploadConfirm: 'Ladataanko tämä tiedosto nyt Wikimedia Commonsiin?',
      saveImageUploadSuccess: 'Kuva ladattu: {filename}',
      saveImageOpenUploadedFile: 'Avaa ladatun tiedoston sivu',
      saveImageCoordinatesRequired: 'Valitse koordinaatit kartalta tai ota EXIF-koordinaatit käyttöön.',
      createLocationTitle: 'Luo kohdeluonnos',
      editLocationTitle: 'Muokkaa kohdeluonnosta',
      editLocationData: 'Muokkaa tietoja',
      locationName: 'Kohteen nimi',
      locationDescription: 'Kuvausteksti',
      locationType: 'Tyyppi',
      wikidataItem: 'Wikidata-kohde',
      latitude: 'Leveysaste',
      longitude: 'Pituusaste',
      addressText: 'Osoite',
      postalCode: 'Postinumero',
      municipalityP131: 'Kunta (P131)',
      locatedInAdministrativeTerritorialEntityP131: 'Sijaitsee hallinnollisella alueella (P131)',
      streetAddressP6375: 'Katuosoite (P6375)',
      postalCodeP281: 'Postinumero (P281)',
      locatedOnStreetP669: 'Sijaitsee kadulla (P669)',
      houseNumberP670: 'Talonumero (P670)',
      heritageDesignationP1435: 'Suojelustatus (P1435)',
      instanceOfP31: 'Esiintymä kohteesta (P31)',
      architecturalStyleP149: 'Arkkitehtoninen tyyli (P149)',
      routeInstructionP2795: 'Reittiohje (P2795)',
      ysoIdP2347: 'YSO-tunniste (P2347)',
      kantoIdP8980: 'KANTO-tunniste (P8980)',
      protectedBuildingsRegisterInFinlandIdP5310: 'Suomen suojeltujen rakennusten rekisterin tunniste (P5310)',
      rkyNationalBuiltHeritageEnvironmentIdP4009: 'RKY valtakunnallisesti merkittävän rakennetun kulttuuriympäristön tunniste (P4009)',
      registerIds: 'Rekisteritunnisteet',
      permanentBuildingNumberVtjPrtP3824: 'Pysyvä rakennustunnus VTJ-PRT (P3824)',
      protectedBuildingsRegisterInFinlandBuildingIdP5313: 'Suojeltujen rakennusten rekisterin rakennustunnus (P5313)',
      helsinkiPersistentBuildingIdRatuP8355: 'Helsingin pysyvä rakennustunnus Ratu (P8355)',
      commonsCategory: 'Wikimedia Commons -luokka',
      commonsImagesPetScan: 'Commons-kuvat (PetScan)',
      viewItImages: 'View-it-kuvat',
      commonsImagesWithSource: 'Commons-kuvat ({source})',
      imageSourcePetScan: 'petscan',
      imageSourceViewIt: 'view-it',
      inceptionP571: 'Aloitusajankohta (P571)',
      partOfP361: 'Osa kohdetta (P361)',
      locationP276: 'Sijainti (P276)',
      architectP84: 'Arkkitehti (P84)',
      officialClosureDateP3999: 'Virallinen sulkemispäivä (P3999)',
      stateOfUseP5817: 'Käytön tila (P5817)',
      image: 'Kuva',
      imagePlaceholderLabel: 'Kuva puuttuu toistaiseksi',
      parentLocation: 'Yläkohde',
      parentLocationPlaceholder: 'Hae yläkohdetta...',
      clearParent: 'Tyhjennä yläkohde',
      wikidataItemPlaceholder: 'Hae Wikidata-kohdetta...',
      create: 'Luo',
      saveChanges: 'Tallenna muutokset',
      cancel: 'Peruuta',
      saving: 'Tallennetaan...',
      locationNameRequired: 'Kohteen nimi vaaditaan.',
      locationTypeRequired: 'Kohteen tyyppi vaaditaan.',
      latitudeRequired: 'Leveysaste vaaditaan.',
      longitudeRequired: 'Pituusaste vaaditaan.',
      municipalitySelectionRequired: 'Valitse kunta ehdotuksista.',
      commonsSelectionRequired: 'Valitse Commons-luokka ehdotuksista.',
      parentSelectionRequired: 'Valitse yläkohde ehdotuksista.',
      wikidataLookupLoading: 'Haetaan Wikidata-tietoja...',
      wikidataLookupFailed: 'Wikidata-tietojen haku ei onnistunut.',
      wikidataSourceNotice: 'Arvot tulevat Wikidatasta. Tyhjennä Wikidata-kohde muokataksesi kenttiä.',
      wikidataEditDiffNotice: 'Wikidata-arvot ovat ensisijaisia. Paikalliset arvot näytetään vertailua varten eikä niitä voi muokata.',
      wikidataCoordinatesMissing: 'Wikidata-kohteella ei ole koordinaatteja.',
      pickCoordinates: 'Valitse kartalta',
      coordinatePickerTitle: 'Valitse koordinaatit',
      placeSearch: 'Paikannimihaku',
      search: 'Hae',
      searching: 'Haetaan...',
      noSearchResults: 'Ei hakutuloksia.',
      useSelectedCoordinates: 'Käytä valittuja koordinaatteja',
      typePlaceholder: 'Hae Wikidata-tyyppiä...',
      municipalityPlaceholder: 'Hae kuntaa (Wikidata)...',
      commonsPlaceholder: 'Hae Commons-luokkaa...',
      autocompleteNoMatches: 'Ei ehdotuksia.',
      lockedField: 'Lukittu',
      manualValue: 'Manuaalinen',
      wikidataValue: 'Wikidata',
      differentValue: 'Poikkeaa',
      noValue: '-',
      coordMapLegendManual: 'Manuaaliset koordinaatit',
      coordMapLegendWikidata: 'Wikidata-koordinaatit',
      subLocations: 'Alakohteet',
      noSubLocations: 'Ei alakohteita vielä.',
      openDetailsFor: 'Avaa kohteen {name} tiedot',
      back: 'Takaisin',
      createLocationTypeStepTitle: 'Miten haluat luoda kohteen?',
      createWizardIntro: 'Valitse ensin luontitapa. Voit palata taakse ja vaihtaa valintaa.',
      createModeExistingTitle: 'Lisää olemassa oleva Wikidata-kohde',
      createModeExistingDesc: 'Valitse olemassa oleva Wikidata-kohde ja lisää se Wikikuvaajien vaarassa olevat rakennukset -listaan.',
      createModeNewWikidataTitle: 'Luo uusi Wikidata-kohde',
      createModeNewWikidataDesc: 'Luo rakennukselle uusi Wikidata-kohde ohjatulla lomakkeella.',
      addExistingWikidataTitle: 'Lisää olemassa oleva Wikidata-kohde',
      addExistingWikidataHelp: 'Valitse olemassa oleva Wikidata-kohde ja lisää se Wikikuvaajien vaarassa olevat rakennukset -listaan.',
      addExistingWikidataSourceHelp: 'Lisää kohteelle lähde.',
      addExistingWikidataSuccess: 'Lisäys onnistui. Luettelo päivitettiin.',
      createNewWikidataTitle: 'Luo uusi Wikidata-kohde',
      createNewWikidataHelp: 'Rakennukselle pakolliset tiedot: vähintään yksi FI/SV/EN nimi-kuvauspari, sijainti, P31 ja lähde.',
      newWikidataPrimaryLanguageHelp: 'Täytä nimi ja kuvaus suomeksi, ruotsiksi ja englanniksi. Vähintään yksi kielipari vaaditaan.',
      languageGroupFi: 'Suomi',
      languageGroupSv: 'Ruotsi',
      languageGroupEn: 'Englanti',
      additionalLanguages: 'Muut kielet',
      additionalLanguagesHelp: 'Voit lisätä nimen ja kuvauksen myös muilla kielillä.',
      languageCode: 'Kielikoodi',
      languageCodePlaceholder: 'Kirjoita koodi tai kielen nimi (esim. de tai saksa)',
      addLanguage: 'Lisää kieli',
      removeLanguage: 'Poista kieli',
      locationAndCoordinates: 'Sijainti ja koordinaatit',
      createWikidataItem: 'Luo Wikidata-kohde',
      addToList: 'Lisää listaan',
      next: 'Seuraava',
      wikidataItemRequired: 'Wikidata-kohde vaaditaan.',
      locationDescriptionRequired: 'Kuvaus vaaditaan.',
      locationNameDescriptionPairRequired: 'Täytä vähintään yksi nimi- ja kuvauspari kielillä FI, SV tai EN.',
      locationNameRequiredForLanguage: 'Nimi vaaditaan kielelle {language}.',
      locationDescriptionRequiredForLanguage: 'Kuvaus vaaditaan kielelle {language}.',
      additionalLanguageCodeRequired: 'Lisäkieliriville vaaditaan kielikoodi.',
      additionalLanguageCodeInvalid: 'Anna kelvollinen kielikoodi tai valitse kieli ehdotuksista.',
      countryP17: 'Maa (P17)',
      countrySelectionRequired: 'Valitse maa ehdotuksista.',
      detailedLocationP276: 'Tarkempi sijainti (P276)',
      partOfPlaceholder: 'Hae yläkohdetta (Wikidata)...',
      sourceUrl: 'Lähde-URL',
      sourceUrlPlaceholder: 'https://example.org/source',
      sourceTitle: 'Lähteen otsikko',
      sourceTitleLanguage: 'Otsikon kieli',
      sourceAuthor: 'Lähteen tekijä',
      sourcePublicationDate: 'Julkaisupäivä',
      sourceRetrievedDate: 'Hakupäivä',
      sourcePublicationDatePlaceholder: 'YYYY-MM-DD tai D.M.YYYY',
      sourcePublisherP123: 'Julkaisija (P123)',
      sourcePublisherPlaceholder: 'Hae julkaisija (Wikidata)...',
      sourcePublisherInvalid: 'Julkaisija (P123) pitää olla kelvollinen Wikidata-kohde.',
      sourcePublishedInP1433: 'Julkaistu teoksessa (P1433)',
      sourcePublishedInPlaceholder: 'Hae julkaisua (Wikidata)...',
      sourcePublishedInInvalid: 'Julkaistu teoksessa (P1433) pitää olla kelvollinen Wikidata-kohde.',
      sourceLanguageOfWorkP407: 'Teoksen tai nimen kieli (P407)',
      sourceLanguageOfWorkPlaceholder: 'Hae kieli (Wikidata)...',
      sourceLanguageOfWorkInvalid: 'Teoksen tai nimen kieli (P407) pitää olla kelvollinen Wikidata-kohde.',
      sourceUrlRequiredForAddExisting: 'Lähde-URL vaaditaan.',
      newWikidataSourceHelp: 'Lisää uuden kohteen lähde samalla tavalla kuin olemassa olevan Wikidata-kohteen kohdalla.',
      autofillSourceWithCitoid: 'Täytä metatiedot automaattisesti (Citoid)',
      citoidAutofillLoading: 'Haetaan lähteen metatietoja...',
      sourceUrlRequiredForArchitect: 'Arkkitehdin lähde-URL vaaditaan.',
      sourceUrlRequiredForInception: 'Luomisvuoden lähde-URL vaaditaan.',
      sourceUrlRequiredForOfficialClosure: 'Virallisen sulkemispäivän lähde-URL vaaditaan.',
      sourceUrlRequiredForHeritage: 'Suojelustatuksen lähde-URL vaaditaan.',
      keyPropertiesWithSources: 'Keskeiset ominaisuudet ja lähteet',
      optionalProperties: 'Valinnaiset ominaisuudet',
      countryPlaceholder: 'Hae maa (Wikidata)...',
      detailedLocationPlaceholder: 'Hae tarkempaa sijaintia (Wikidata)...',
      signInWikimedia: 'Kirjaudu Wikimediaan',
      signOut: 'Kirjaudu ulos',
      signedInAs: 'Kirjautunut: {name}',
      addLocationWithCradle: 'Lisää kohde Cradlella',
      cradleGuideTitle: 'Lisää kohde Cradlella',
      cradleGuideIntro: 'Cradle on työkalu jolla voi luoda uusia wikidata-kohteita lomakkeella. Käyttääksesi Cradlea:',
      cradleGuideStep1: 'Valitse kieleksi englanti jos se ei ole vielä se.',
      cradleGuideStep2: 'Kirjaudu ensin sisälle Cradleen oikeasta yläreunasta.',
      cradleGuideStep3: 'Jos et ole lomakesivulla, niin valitse lomakkeeksi "Building (Wikikuvaajat)".',
      cradleGuideStep4: 'Täytä vähintään Labels, instance of, country, located in the admistrative entity (kunta). Vinkkinä rivillä on mahdollisuus monivalintaan. Tekstit vaatii kielen kohdalle arvon "fi".',
      cradleGuideStep5: 'Kun kaikki vaaditut tiedot on täytetty niin sivun alareunassa on "Create item" -nappi.',
      cradleGuideStep6: 'Odota luontia. Sivun yläreunassa on busy-indikaattori, mutta se ei valmistu ikinä ja valmistuminen pitää varmistaa Wikidatasta.',
      openCradle: 'Avaa Cradle',
      authRequiredForWikidataWrites: 'Kirjaudu Wikimediaan ennen Wikidata-muutoksia.',
      authRequiredForLocationWrites: 'Kirjaudu Wikimediaan ennen kohteiden lisäämistä.'
    }
  }

  const initialLocale =
    normalizeSupportedLocale(localStorage.getItem('locale')) ||
    normalizeSupportedLocale(navigator.language) ||
    normalizeSupportedLocale(Array.isArray(navigator.languages) ? navigator.languages[0] : null) ||
    'en'

  const i18n = createI18n({
    legacy: false,
    locale: initialLocale,
    fallbackLocale: 'en',
    messages
  })

  const locationsVersion = ref(0)
  const locationsCache = ref({})
  const locationsQueryUrlCache = ref({})
  const locationDetailCache = ref({})
  const locationChildrenCache = ref({})
  const pendingLocationLoads = new Map()
  const pendingDetailLoads = new Map()
  const pendingChildrenLoads = new Map()

  function locationsCacheKey(lang) {
    return normalizeSupportedLocale(lang) || 'en'
  }

  function invalidateLocationsCache() {
    locationsCache.value = {}
    locationsQueryUrlCache.value = {}
    locationDetailCache.value = {}
    locationChildrenCache.value = {}
  }

  function normalizeCacheLocationId(locationId) {
    if (typeof locationId !== 'string' || !locationId.trim()) {
      return ''
    }
    return normalizeLocationId(locationId.trim())
  }

  function detailCacheKey(lang, locationId) {
    return `${locationsCacheKey(lang)}|${normalizeCacheLocationId(locationId)}`
  }

  function childrenCacheKey(lang, locationId) {
    return `${locationsCacheKey(lang)}|${normalizeCacheLocationId(locationId)}`
  }

  function findLocationInCachedList(locationId, lang) {
    const normalizedId = normalizeCacheLocationId(locationId)
    if (!normalizedId) {
      return null
    }

    const cachedList = locationsCache.value[locationsCacheKey(lang)]
    if (!Array.isArray(cachedList)) {
      return null
    }

    for (const item of cachedList) {
      if (!item || typeof item !== 'object') {
        continue
      }
      const candidateId = normalizeCacheLocationId(String(item.id || ''))
      if (candidateId && candidateId === normalizedId) {
        return item
      }

      const candidateUri = normalizeCacheLocationId(String(item.uri || ''))
      if (candidateUri && candidateUri === normalizedId) {
        return item
      }
    }

    return null
  }

  function getLocationFromListCache(locationId, lang) {
    const cached = findLocationInCachedList(locationId, lang)
    if (!cached || typeof cached !== 'object') {
      return null
    }
    return { ...cached }
  }

  async function getLocationsCached(lang, { force = false } = {}) {
    const key = locationsCacheKey(lang)
    const hasCachedValue = Object.prototype.hasOwnProperty.call(locationsCache.value, key)
    if (!force && hasCachedValue) {
      return locationsCache.value[key]
    }

    if (!force && pendingLocationLoads.has(key)) {
      return pendingLocationLoads.get(key)
    }

    const requestPromise = (async () => {
      const cacheBust = force ? currentCacheBustMinute() : ''
      const loadedResponse = await fetchLocationsWithMeta(key, { cacheBust })
      const loaded =
        loadedResponse && typeof loadedResponse === 'object' && 'payload' in loadedResponse
          ? loadedResponse.payload
          : loadedResponse
      const queryUrl =
        loadedResponse &&
        typeof loadedResponse === 'object' &&
        loadedResponse.headers &&
        typeof loadedResponse.headers === 'object'
          ? String(loadedResponse.headers['x-wikidata-query-url'] || '')
          : ''
      const normalized = Array.isArray(loaded) ? loaded : []
      locationsCache.value = {
        ...locationsCache.value,
        [key]: normalized,
      }
      locationsQueryUrlCache.value = {
        ...locationsQueryUrlCache.value,
        [key]: queryUrl,
      }
      return normalized
    })()

    pendingLocationLoads.set(key, requestPromise)
    try {
      return await requestPromise
    } finally {
      pendingLocationLoads.delete(key)
    }
  }

  async function getLocationDetailCached(locationId, lang, { force = false } = {}) {
    const key = detailCacheKey(lang, locationId)
    const hasCachedDetail = Object.prototype.hasOwnProperty.call(locationDetailCache.value, key)
    if (!force && hasCachedDetail) {
      return locationDetailCache.value[key]
    }

    if (!force && pendingDetailLoads.has(key)) {
      return pendingDetailLoads.get(key)
    }

    const requestPromise = (async () => {
      const loaded = await fetchLocation(locationId, lang)
      locationDetailCache.value = {
        ...locationDetailCache.value,
        [key]: loaded,
      }
      if (loaded && typeof loaded === 'object' && Array.isArray(loaded.children)) {
        locationChildrenCache.value = {
          ...locationChildrenCache.value,
          [childrenCacheKey(lang, locationId)]: loaded.children,
        }
      }
      return loaded
    })()

    pendingDetailLoads.set(key, requestPromise)
    try {
      return await requestPromise
    } finally {
      pendingDetailLoads.delete(key)
    }
  }

  function getLocationsQueryUrl(lang) {
    const key = locationsCacheKey(lang)
    const value = locationsQueryUrlCache.value[key]
    return typeof value === 'string' ? value : ''
  }

  async function getLocationChildrenCached(locationId, lang, { force = false } = {}) {
    const key = childrenCacheKey(lang, locationId)
    const hasCachedChildren = Object.prototype.hasOwnProperty.call(locationChildrenCache.value, key)
    if (!force && hasCachedChildren) {
      return locationChildrenCache.value[key]
    }

    if (!force && pendingChildrenLoads.has(key)) {
      return pendingChildrenLoads.get(key)
    }

    const requestPromise = (async () => {
      const loaded = await fetchLocationChildren(locationId, lang)
      const normalized = Array.isArray(loaded) ? loaded : []
      locationChildrenCache.value = {
        ...locationChildrenCache.value,
        [key]: normalized,
      }
      return normalized
    })()

    pendingChildrenLoads.set(key, requestPromise)
    try {
      return await requestPromise
    } finally {
      pendingChildrenLoads.delete(key)
    }
  }

  function notifyLocationsChanged() {
    invalidateLocationsCache()
    locationsVersion.value += 1
  }

  const locationStore = {
    locationsVersion,
    notifyLocationsChanged,
    getLocationsCached,
    getLocationsQueryUrl,
    getLocationFromListCache,
    getLocationDetailCached,
    getLocationChildrenCached,
  }

  const authStore = {
    authEnabled: ref(false),
    authAuthenticated: ref(false),
    authUsername: ref(''),
    authLoginUrl: ref('/auth/login/mediawiki/?next=/'),
    authLogoutUrl: ref('/auth/logout/?next=/'),
    authStatusLoading: ref(true),
  }

  const LanguageSwitcher = {
    setup() {
      const { t, locale } = useI18n()

      function onChange(event) {
        const selectedLocale = normalizeSupportedLocale(event.target.value) || 'en'
        locale.value = selectedLocale
        localStorage.setItem('locale', selectedLocale)
      }

      return { t, locale, onChange }
    },
    template: `
      <label class="language-switcher">
        <span>{{ t('language') }}</span>
        <select :value="locale" @change="onChange" aria-label="language selector">
          <option value="en">EN</option>
          <option value="sv">SV</option>
          <option value="fi">FI</option>
        </select>
      </label>
    `
  }

  const ListView = {
    setup() {
      const { t, locale } = useI18n()
      const { locationsVersion, getLocationsCached, getLocationsQueryUrl } = locationStore
      const locations = ref([])
      const loading = ref(false)
      const error = ref('')
      const listQueryUrl = computed(() => getLocationsQueryUrl(locale.value))
      const sortBy = ref('last-modified')
      const sortDirection = ref('desc')
      const userCoordinates = ref(null)
      const geolocationLoading = ref(false)
      const geolocationErrorKey = ref('')
      let silentRefreshTimer = null
      let loadToken = 0

      function clearSilentRefreshTimer() {
        if (silentRefreshTimer !== null) {
          clearTimeout(silentRefreshTimer)
          silentRefreshTimer = null
        }
      }

      function scheduleSilentRefresh(lang, token) {
        clearSilentRefreshTimer()
        silentRefreshTimer = setTimeout(async () => {
          silentRefreshTimer = null
          try {
            const refreshed = await getLocationsCached(lang, { force: true })
            if (token !== loadToken) {
              return
            }
            locations.value = Array.isArray(refreshed) ? refreshed : []
          } catch (silentRefreshError) {
            void silentRefreshError
          }
        }, LOCATION_SILENT_REFRESH_DELAY_MS)
      }

      async function loadLocations() {
        const token = ++loadToken
        const currentLang = locale.value
        loading.value = true
        error.value = ''
        clearSilentRefreshTimer()

        try {
          const loaded = await getLocationsCached(currentLang)
          if (token !== loadToken) {
            return
          }
          locations.value = Array.isArray(loaded) ? loaded : []
          scheduleSilentRefresh(currentLang, token)
        } catch (err) {
          if (token !== loadToken) {
            return
          }
          error.value = err.message || t('loadError')
        } finally {
          if (token === loadToken) {
            loading.value = false
          }
        }
      }

      onMounted(loadLocations)
      onBeforeUnmount(clearSilentRefreshTimer)
      watch([() => locale.value, () => locationsVersion.value], loadLocations)
      watch(
        () => sortBy.value,
        (nextSortBy) => {
          if (nextSortBy === 'distance') {
            void ensureUserCoordinates()
          }
        },
      )

      function formatImageCount(value) {
        return formatCountValue(value, locale.value, t('noValue'))
      }

      function hasImageCount(value) {
        return value !== null && value !== undefined && value !== ''
      }

      function preferredImageSource(item) {
        return preferredCommonsImageSource(item)
      }

      function preferredImageCount(item) {
        return preferredCommonsImageCount(item)
      }

      function preferredImageHref(item) {
        return preferredCommonsImageHref(item)
      }

      function commonsImagesLabel(item) {
        const sourceKey = preferredImageSource(item)
        if (!sourceKey) {
          return ''
        }
        const sourceLabel = sourceKey === 'view-it' ? t('imageSourceViewIt') : t('imageSourcePetScan')
        return t('commonsImagesWithSource', { source: sourceLabel })
      }

      function formatCoordinates(latitude, longitude) {
        return formatCoordinatePair(latitude, longitude, locale.value)
      }

      function locationDisplayName(item) {
        if (!item || typeof item !== 'object') {
          return t('noValue')
        }
        if (typeof item.name === 'string' && item.name.trim()) {
          return item.name.trim()
        }
        if (typeof item.uri === 'string' && item.uri.trim()) {
          return item.uri.trim()
        }
        return t('noValue')
      }

      function locationRouteId(item) {
        if (!item || typeof item !== 'object') {
          return ''
        }
        const idValue = typeof item.id === 'string' ? item.id.trim() : ''
        if (idValue) {
          const normalizedId = normalizeLocationId(idValue)
          if (normalizedId) {
            return normalizedId
          }
        }
        const uriValue = typeof item.uri === 'string' ? item.uri.trim() : ''
        if (!uriValue) {
          return ''
        }
        return normalizeLocationId(uriValue)
      }

      function formatDescription(value) {
        return displayValue(value, t('noValue'))
      }

      function detailsAriaLabel(item) {
        return t('openDetailsFor', { name: locationDisplayName(item) })
      }

      function geolocationErrorTranslationKey(errorCode) {
        if (errorCode === 1) {
          return 'distanceLocationDenied'
        }
        if (errorCode === 2) {
          return 'distanceLocationUnavailable'
        }
        if (errorCode === 3) {
          return 'distanceLocationTimeout'
        }
        return 'distanceLocationUnknown'
      }

      function ensureUserCoordinates() {
        if (userCoordinates.value || geolocationLoading.value) {
          return Promise.resolve(userCoordinates.value)
        }
        if (!navigator || !navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== 'function') {
          geolocationErrorKey.value = 'distanceLocationUnsupported'
          return Promise.resolve(null)
        }

        geolocationLoading.value = true
        geolocationErrorKey.value = ''
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const coords = position && position.coords ? position.coords : null
              if (!coords) {
                geolocationErrorKey.value = 'distanceLocationUnknown'
                userCoordinates.value = null
                geolocationLoading.value = false
                resolve(null)
                return
              }
              const latitude = Number(coords.latitude)
              const longitude = Number(coords.longitude)
              if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                geolocationErrorKey.value = 'distanceLocationUnknown'
                userCoordinates.value = null
                geolocationLoading.value = false
                resolve(null)
                return
              }
              userCoordinates.value = { latitude, longitude }
              geolocationErrorKey.value = ''
              geolocationLoading.value = false
              resolve(userCoordinates.value)
            },
            (geoError) => {
              geolocationErrorKey.value = geolocationErrorTranslationKey(geoError && geoError.code)
              userCoordinates.value = null
              geolocationLoading.value = false
              resolve(null)
            },
            {
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: 60000,
            },
          )
        })
      }

      function locationDistanceKilometers(item) {
        if (!item || typeof item !== 'object') {
          return null
        }
        const origin = userCoordinates.value
        if (!origin || typeof origin !== 'object') {
          return null
        }
        return haversineDistanceKilometers(
          origin.latitude,
          origin.longitude,
          item.latitude,
          item.longitude,
        )
      }

      function formatDistanceKilometers(value) {
        if (!Number.isFinite(value)) {
          return t('noValue')
        }
        const formatted = new Intl.NumberFormat(locale.value, {
          maximumFractionDigits: 1,
          minimumFractionDigits: value < 10 ? 1 : 0,
        }).format(value)
        return `${formatted} km`
      }

      function locationDistanceLabel(item) {
        const distance = locationDistanceKilometers(item)
        if (!Number.isFinite(distance)) {
          return ''
        }
        return formatDistanceKilometers(distance)
      }

      function formatDateModified(value) {
        return formatDateTimeValue(value, locale.value, t('noValue'))
      }

      function compareNumericNullable(aValue, bValue, directionMultiplier = 1) {
        const hasA = Number.isFinite(aValue)
        const hasB = Number.isFinite(bValue)
        if (!hasA && !hasB) {
          return 0
        }
        if (!hasA) {
          return 1
        }
        if (!hasB) {
          return -1
        }
        if (aValue === bValue) {
          return 0
        }
        return (aValue < bValue ? -1 : 1) * directionMultiplier
      }

      function compareByName(aItem, bItem) {
        const nameA = locationDisplayName(aItem)
        const nameB = locationDisplayName(bItem)
        const compared = nameA.localeCompare(nameB, locale.value, {
          sensitivity: 'base',
          numeric: true,
        })
        if (compared !== 0) {
          return compared
        }
        const idA = String((aItem && aItem.id) || '')
        const idB = String((bItem && bItem.id) || '')
        return idA.localeCompare(idB, 'en', { sensitivity: 'base', numeric: true })
      }

      const geolocationErrorMessage = computed(() => {
        const key = geolocationErrorKey.value
        return key ? t(key) : ''
      })

      const sortedLocations = computed(() => {
        const source = Array.isArray(locations.value) ? locations.value : []
        const sorted = [...source]
        const directionMultiplier = sortDirection.value === 'asc' ? 1 : -1

        sorted.sort((aItem, bItem) => {
          if (sortBy.value === 'name') {
            return compareByName(aItem, bItem) * directionMultiplier
          }

          if (sortBy.value === 'distance') {
            const distanceA = locationDistanceKilometers(aItem)
            const distanceB = locationDistanceKilometers(bItem)
            const distanceCompare = compareNumericNullable(distanceA, distanceB, directionMultiplier)
            if (distanceCompare !== 0) {
              return distanceCompare
            }
            return compareByName(aItem, bItem)
          }

          const modifiedA = parseIsoDateTimestamp(aItem && aItem.date_modified)
          const modifiedB = parseIsoDateTimestamp(bItem && bItem.date_modified)
          const modifiedCompare = compareNumericNullable(modifiedA, modifiedB, directionMultiplier)
          if (modifiedCompare !== 0) {
            return modifiedCompare
          }
          return compareByName(aItem, bItem)
        })

        return sorted
      })

      return {
        t,
        locations,
        sortedLocations,
        loading,
        error,
        sortBy,
        sortDirection,
        geolocationLoading,
        geolocationErrorMessage,
        formatImageCount,
        hasImageCount,
        preferredImageSource,
        preferredImageCount,
        preferredImageHref,
        commonsImagesLabel,
        formatCoordinates,
        formatDateModified,
        locationDistanceLabel,
        locationDisplayName,
        locationRouteId,
        formatDescription,
        detailsAriaLabel,
        listQueryUrl,
        handleImageLoadError
      }
    },
    template: `
      <section class="view-section list-view" :aria-busy="loading ? 'true' : 'false'">
        <p v-if="loading" class="status" role="status" aria-live="polite">{{ t('loading') }}</p>
        <p v-else-if="error" class="status error" role="alert">{{ error }}</p>
        <p v-else-if="locations.length === 0" class="status" role="status" aria-live="polite">{{ t('noData') }}</p>

        <div v-else class="list-sort-controls" role="group" :aria-label="t('sortBy')">
          <label class="list-sort-control">
            <span>{{ t('sortBy') }}</span>
            <select v-model="sortBy">
              <option value="last-modified">{{ t('sortByLastModified') }}</option>
              <option value="name">{{ t('sortByName') }}</option>
              <option value="distance">{{ t('sortByDistance') }}</option>
            </select>
          </label>
          <label class="list-sort-control">
            <span>{{ t('sortDirection') }}</span>
            <select v-model="sortDirection">
              <option value="asc">{{ t('sortDirectionAsc') }}</option>
              <option value="desc">{{ t('sortDirectionDesc') }}</option>
            </select>
          </label>
        </div>

        <p v-if="!loading && !error && locations.length > 0 && sortBy === 'distance' && geolocationLoading" class="status" role="status" aria-live="polite">
          {{ t('distanceLocating') }}
        </p>
        <p v-if="!loading && !error && locations.length > 0 && sortBy === 'distance' && geolocationErrorMessage" class="status error" role="alert">
          {{ geolocationErrorMessage }}
        </p>

        <ul v-if="!loading && !error && locations.length > 0" class="locations-grid" :aria-label="t('navList')">
          <li v-for="location in sortedLocations" :key="location.id" class="location-card">
            <article class="card-content">
              <header class="card-header">
                <h2>
                  <RouterLink
                    class="text-link"
                    :to="{ name: 'detail', params: { id: locationRouteId(location) } }"
                    :aria-label="detailsAriaLabel(location)"
                  >
                    {{ locationDisplayName(location) }}
                  </RouterLink>
                </h2>
              </header>
              <figure v-if="location.image_thumb_url || location.image_url" class="location-thumb">
                <RouterLink
                  :to="{ name: 'detail', params: { id: locationRouteId(location) } }"
                  :aria-label="detailsAriaLabel(location)"
                >
                  <img
                    class="thumb-image"
                    :src="location.image_thumb_url || location.image_url"
                    :alt="location.image_name || locationDisplayName(location)"
                    loading="lazy"
                    @error="(event) => handleImageLoadError(event, location.image_url)"
                  />
                </RouterLink>
              </figure>
              <p class="desc">{{ formatDescription(location.description) }}</p>
              <dl class="meta-list">
                <div class="meta-row">
                  <dt>{{ t('coordinates') }}</dt>
                  <dd>{{ formatCoordinates(location.latitude, location.longitude) }}</dd>
                </div>
                <div v-if="location.date_modified" class="meta-row">
                  <dt>{{ t('lastModified') }}</dt>
                  <dd>{{ formatDateModified(location.date_modified) }}</dd>
                </div>
                <div v-if="sortBy === 'distance' && locationDistanceLabel(location)" class="meta-row">
                  <dt>{{ t('distanceFromYou') }}</dt>
                  <dd>{{ locationDistanceLabel(location) }}</dd>
                </div>
                <div v-if="location.commons_category" class="meta-row">
                  <dt>{{ t('commonsCategory') }}</dt>
                  <dd>
                    <a
                      v-if="location.commons_category_url"
                      :href="location.commons_category_url"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {{ location.commons_category }}
                    </a>
                    <span v-else>{{ location.commons_category }}</span>
                  </dd>
                </div>
                <div v-if="preferredImageSource(location)" class="meta-row">
                  <dt>{{ commonsImagesLabel(location) }}</dt>
                  <dd>
                    <a
                      v-if="preferredImageHref(location)"
                      :href="preferredImageHref(location)"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {{ formatImageCount(preferredImageCount(location)) }}
                    </a>
                    <span v-else>{{ formatImageCount(preferredImageCount(location)) }}</span>
                  </dd>
                </div>
              </dl>
            </article>
          </li>
        </ul>

        <p v-if="!loading && !error && locations.length > 0 && listQueryUrl" class="query-link-footer">
          <a class="text-link" :href="listQueryUrl" target="_blank" rel="noopener noreferrer">
            {{ t('openListQueryInWikidata') }}
          </a>
        </p>
      </section>
    `
  }

  const MapView = {
    setup() {
      const { t, locale } = useI18n()
      const { locationsVersion, getLocationsCached } = locationStore
      const mapElement = ref(null)
      const locations = ref([])
      const loading = ref(false)
      const error = ref('')
      let mapInstance = null
      let silentRefreshTimer = null
      let loadToken = 0

      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://tools-static.wmflabs.org/cdnjs/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://tools-static.wmflabs.org/cdnjs/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://tools-static.wmflabs.org/cdnjs/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
      })

      function destroyMap() {
        if (mapInstance) {
          mapInstance.remove()
          mapInstance = null
        }
      }

      function clearSilentRefreshTimer() {
        if (silentRefreshTimer !== null) {
          clearTimeout(silentRefreshTimer)
          silentRefreshTimer = null
        }
      }

      function scheduleSilentRefresh(lang, token) {
        clearSilentRefreshTimer()
        silentRefreshTimer = setTimeout(async () => {
          silentRefreshTimer = null
          try {
            const refreshed = await getLocationsCached(lang, { force: true })
            if (token !== loadToken) {
              return
            }
            locations.value = Array.isArray(refreshed) ? refreshed : []
            await nextTick()
            if (token !== loadToken) {
              return
            }
            drawMap()
          } catch (silentRefreshError) {
            void silentRefreshError
          }
        }, LOCATION_SILENT_REFRESH_DELAY_MS)
      }

      function locationDisplayName(item) {
        if (!item || typeof item !== 'object') {
          return t('noValue')
        }
        if (typeof item.name === 'string' && item.name.trim()) {
          return item.name.trim()
        }
        if (typeof item.uri === 'string' && item.uri.trim()) {
          return item.uri.trim()
        }
        return t('noValue')
      }

      function hasImageCount(value) {
        return value !== null && value !== undefined && value !== ''
      }

      function formatImageCount(value) {
        return formatCountValue(value, locale.value, t('noValue'))
      }

      function preferredImageSource(item) {
        return preferredCommonsImageSource(item)
      }

      function preferredImageCount(item) {
        return preferredCommonsImageCount(item)
      }

      function preferredImageHref(item) {
        return preferredCommonsImageHref(item)
      }

      function commonsImagesLabel(item) {
        const sourceKey = preferredImageSource(item)
        if (!sourceKey) {
          return ''
        }
        const sourceLabel = sourceKey === 'view-it' ? t('imageSourceViewIt') : t('imageSourcePetScan')
        return t('commonsImagesWithSource', { source: sourceLabel })
      }

      function formatCoordinates(latitude, longitude) {
        return formatCoordinatePair(latitude, longitude, locale.value, 4, t('noValue'))
      }

      function popupExternalLink(urlValue, labelValue) {
        const label = displayValue(labelValue, t('noValue'))
        const url = typeof urlValue === 'string' ? urlValue.trim() : ''
        if (!isHttpUrl(url)) {
          return escapeHtml(label)
        }
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`
      }

      function popupMetaRow(label, valueHtml) {
        return `
          <div class="meta-row">
            <dt>${escapeHtml(label)}</dt>
            <dd>${valueHtml}</dd>
          </div>
        `
      }

      function popupContent(location) {
        const name = locationDisplayName(location)
        const description = typeof location.description === 'string' ? location.description.trim() : ''
        const coordinates = formatCoordinates(location.latitude, location.longitude)
        const rows = [popupMetaRow(t('coordinates'), escapeHtml(coordinates))]

        const commonsCategory = typeof location.commons_category === 'string'
          ? location.commons_category.trim()
          : ''
        if (commonsCategory) {
          rows.push(
            popupMetaRow(
              t('commonsCategory'),
              popupExternalLink(location.commons_category_url, commonsCategory),
            )
          )
        }
        if (preferredImageSource(location)) {
          rows.push(
            popupMetaRow(
              commonsImagesLabel(location),
              popupExternalLink(
                preferredImageHref(location),
                formatImageCount(preferredImageCount(location)),
              ),
            )
          )
        }

        const locationIdSource = (typeof location.id === 'string' && location.id.trim())
          ? location.id.trim()
          : String(location.uri || '')
        const locationId = normalizeLocationId(locationIdSource)
        const detailsLink = locationId
          ? `<a class="text-link map-popup-link" href="#/location/${escapeHtml(locationId)}">${escapeHtml(t('openDetails'))}</a>`
          : ''

        return `
          <article class="map-popup-card">
            <h3>${escapeHtml(name)}</h3>
            ${description ? `<p class="map-popup-description">${escapeHtml(description)}</p>` : ''}
            <dl class="meta-list map-popup-meta">${rows.join('')}</dl>
            ${detailsLink}
          </article>
        `
      }

      function drawMap() {
        destroyMap()

        if (!mapElement.value || locations.value.length === 0) {
          return
        }

        mapInstance = L.map(mapElement.value).setView(
          [locations.value[0].latitude, locations.value[0].longitude],
          5
        )

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapInstance)

        locations.value.forEach((location) => {
          L.marker([location.latitude, location.longitude]).addTo(mapInstance).bindPopup(popupContent(location))
        })
      }

      async function loadLocations() {
        const token = ++loadToken
        const currentLang = locale.value
        loading.value = true
        error.value = ''
        clearSilentRefreshTimer()

        try {
          const loaded = await getLocationsCached(currentLang)
          if (token !== loadToken) {
            return
          }
          locations.value = Array.isArray(loaded) ? loaded : []
          await nextTick()
          if (token !== loadToken) {
            return
          }
          drawMap()
          scheduleSilentRefresh(currentLang, token)
        } catch (err) {
          if (token !== loadToken) {
            return
          }
          error.value = err.message || t('loadError')
        } finally {
          if (token === loadToken) {
            loading.value = false
          }
        }
      }

      onMounted(loadLocations)
      onBeforeUnmount(() => {
        clearSilentRefreshTimer()
        destroyMap()
      })
      watch([() => locale.value, () => locationsVersion.value], loadLocations)

      return { t, mapElement, locations, loading, error }
    },
    template: `
      <section class="view-section map-view" :aria-busy="loading ? 'true' : 'false'">
        <p v-if="loading" class="status" role="status" aria-live="polite">{{ t('loading') }}</p>
        <p v-else-if="error" class="status error" role="alert">{{ error }}</p>
        <p v-else-if="locations.length === 0" class="status" role="status" aria-live="polite">{{ t('noData') }}</p>

        <div v-show="locations.length > 0" ref="mapElement" class="map-canvas" aria-label="locations map"></div>
      </section>
    `
  }

  const CoordinatePickerWidget = {
    props: {
      title: {
        type: String,
        required: false,
        default: '',
      },
      helpText: {
        type: String,
        required: false,
        default: '',
      },
      coordinatesLabel: {
        type: String,
        required: false,
        default: 'Coordinates',
      },
      latitudeDisplay: {
        type: String,
        required: false,
        default: '',
      },
      longitudeDisplay: {
        type: String,
        required: false,
        default: '',
      },
      mapAriaLabel: {
        type: String,
        required: false,
        default: 'coordinate picker map',
      },
      showModeToggle: {
        type: Boolean,
        required: false,
        default: false,
      },
      usesPhotographerCoordinates: {
        type: Boolean,
        required: false,
        default: true,
      },
      modeToggleTitle: {
        type: String,
        required: false,
        default: '',
      },
      modeLabel: {
        type: String,
        required: false,
        default: '',
      },
      modePhotographerText: {
        type: String,
        required: false,
        default: '',
      },
      modeImageText: {
        type: String,
        required: false,
        default: '',
      },
      showHeading: {
        type: Boolean,
        required: false,
        default: false,
      },
      headingLabel: {
        type: String,
        required: false,
        default: '',
      },
      headingDisplay: {
        type: String,
        required: false,
        default: '',
      },
    },
    emits: ['map-element-ready', 'toggle-mode', 'set-mode'],
    setup(props, { emit }) {
      const mapElement = ref(null)

      function emitMapElement() {
        emit('map-element-ready', mapElement.value || null)
      }

      watch(
        () => mapElement.value,
        () => {
          emitMapElement()
        }
      )

      onMounted(() => {
        emitMapElement()
      })

      onBeforeUnmount(() => {
        emit('map-element-ready', null)
      })

      function toggleMode(event) {
        emit('toggle-mode', event)
      }

      function setMode(mode) {
        emit('set-mode', mode)
      }

      return {
        mapElement,
        toggleMode,
        setMode,
      }
    },
    template: `
      <div class="coordinate-picker-widget">
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="helpText" class="dialog-help">{{ helpText }}</p>
        <div v-if="$slots.actions" class="save-image-coordinate-reset-actions">
          <slot name="actions"></slot>
        </div>
        <div :class="showModeToggle ? 'save-image-map-shell' : 'coordinate-picker-map-shell'">
          <div
            ref="mapElement"
            :class="
              showModeToggle
                ? ['map-canvas', 'picker-map', usesPhotographerCoordinates ? 'picker-map-camera-center' : 'picker-map-center-point']
                : ['map-canvas', 'picker-map']
            "
            :aria-label="mapAriaLabel"
          ></div>
          <button
            v-if="showModeToggle"
            type="button"
            class="save-image-map-center-toggle"
            :title="modeToggleTitle"
            :aria-label="modeToggleTitle"
            @click="toggleMode"
          ></button>
          <div v-if="showModeToggle" class="save-image-map-mode-controls" role="group" :aria-label="modeLabel">
            <button
              type="button"
              class="save-image-map-mode-btn"
              :class="{ active: usesPhotographerCoordinates }"
              :aria-pressed="usesPhotographerCoordinates ? 'true' : 'false'"
              @click="setMode('photographer')"
            >
              {{ modePhotographerText }}
            </button>
            <button
              type="button"
              class="save-image-map-mode-btn"
              :class="{ active: !usesPhotographerCoordinates }"
              :aria-pressed="!usesPhotographerCoordinates ? 'true' : 'false'"
              @click="setMode('image')"
            >
              {{ modeImageText }}
            </button>
          </div>
        </div>
        <p class="dialog-help">
          {{ coordinatesLabel }}: {{ latitudeDisplay }}, {{ longitudeDisplay }}
          <template v-if="showHeading">
            | {{ headingLabel }}: {{ headingDisplay }}
          </template>
        </p>
        <slot name="after"></slot>
      </div>
    `,
  }

  const DetailView = {
    props: {
      id: {
        type: String,
        required: false,
        default: ''
      }
    },
    setup(props) {
      const { t, locale } = useI18n()
      const {
        locationsVersion,
        getLocationFromListCache,
        getLocationDetailCached,
        getLocationChildrenCached,
      } = locationStore
      const { authEnabled, authAuthenticated, authStatusLoading, authUsername } = authStore
      const location = ref(null)
      const loading = ref(false)
      const error = ref('')
      const children = ref([])
      const childrenLoading = ref(false)
      const childrenError = ref('')
      let locationLoadToken = 0
      let childrenLoadToken = 0
      const childLocations = computed(() => (Array.isArray(children.value) ? children.value : []))
      const canCreateSubLocation = computed(() => {
        if (!location.value || !location.value.uri) {
          return false
        }
        return !authStatusLoading.value && authAuthenticated.value
      })
      const canSaveImage = computed(() => Boolean(location.value && location.value.uri))
      const detailMapElement = ref(null)
      let detailMapInstance = null
      let detailMapMarker = null
      const showSaveImageApiForm = ref(false)
      const showSaveImageCoordinatePickerDialog = ref(false)
      const saveImageCoordinatePickerPreviewCollapsed = ref(false)
      const saveImageMapElement = ref(null)
      const saveImageCoordinatePreviewMapElement = ref(null)
      const saveImageLatitude = ref('')
      const saveImageLongitude = ref('')
      const saveImageHeading = ref('')
      const saveImageApiCoordinateMode = ref('photographer')
      const saveImageCaption = ref('')
      const saveImageCaptionLanguage = ref(normalizeSupportedLocale(locale.value) || 'en')
      const saveImageDescription = ref('')
      const saveImageDescriptionLanguage = ref(normalizeSupportedLocale(locale.value) || 'en')
      const saveImageSubjectType = ref('')
      const saveImageSubjectLinkMode = ref('map')
      const saveImageSubjectMapElement = ref(null)
      const saveImageSubjectMapLatitude = ref('')
      const saveImageSubjectMapLongitude = ref('')
      const saveImageSubjectMapZoomLevel = ref(null)
      const saveImageSubjectImageXPercent = ref(null)
      const saveImageSubjectImageYPercent = ref(null)
      const saveImageSubjectWikidataSearch = ref('')
      const saveImageSubjectWikidataSuggestions = ref([])
      const saveImageSubjectWikidataLoading = ref(false)
      const saveImageSubjectNearbyMapFeatures = ref([])
      const saveImageSubjectMapFeaturesLoading = ref(false)
      const saveImageSubjectMapFeaturesError = ref('')
      const saveImageSubjectMapFeaturesLoadedLatitude = ref(null)
      const saveImageSubjectMapFeaturesLoadedLongitude = ref(null)
      const saveImageSubjectHoveredMapFeatureKey = ref('')
      const saveImageSubjectSelectedMapFeatureKey = ref('')
      const saveImageSubjectSelectedFeatureWikidataSuggestions = ref([])
      const saveImageSubjectSelectedFeatureWikidataLoading = ref(false)
      const saveImageSubjectSelectedWikidataItem = ref(null)
      const saveImageSubjectDirectWikidataItem = ref(null)
      const saveImageSubjectSelectionError = ref('')
      const saveImageLinkedSubjects = ref([])
      const saveImageCategorySearch = ref('')
      const saveImageCategorySuggestions = ref([])
      const saveImageCategoryLoading = ref(false)
      const saveImageNearbyCategorySuggestions = ref([])
      const saveImageNearbyCategoryLoading = ref(false)
      const saveImageDepictSearch = ref('')
      const saveImageDepictSuggestions = ref([])
      const saveImageDepictLoading = ref(false)
      const saveImageNearbyDepictSuggestions = ref([])
      const saveImageNearbyDepictLoading = ref(false)
      const saveImageSelectedDepicts = ref([])
      const saveImageSelectedCategoryAncestorDedupeKeys = ref([])
      const saveImageSelectedBroadCategoryConflictDedupeKeys = ref([])
      const saveImageSubcategorySuggestions = ref([])
      const saveImageSubcategoryFarSuggestions = ref([])
      const saveImageSubcategoryLoading = ref(false)
      const saveImageSelectedCategories = ref([])
      const saveImageCategoryExistence = ref({})
      const saveImageError = ref('')
      const saveImageFileInputElement = ref(null)
      const saveImageSelectedFile = ref(null)
      const saveImagePreviewUrl = ref('')
      const saveImageExifMetadataLoading = ref(false)
      const saveImageExifDateTaken = ref('')
      const saveImageExifLatitude = ref(null)
      const saveImageExifLongitude = ref(null)
      const saveImageExifHeading = ref(null)
      const saveImageExifElevation = ref(null)
      const saveImageInitialWikidataLatitude = ref(null)
      const saveImageInitialWikidataLongitude = ref(null)
      const saveImageApiUploading = ref(false)
      const saveImageUploadResult = ref(null)
      const saveImageApiTargetFilename = ref('')
      const saveImageApiTargetFilenameTouched = ref(false)
      const saveImageApiTargetFilenameChecking = ref(false)
      const saveImageApiTargetFilenameAvailable = ref(null)
      const saveImageApiTargetFilenameCheckError = ref('')
      const saveImageFilenameBuilderUseSubjects = ref(true)
      const saveImageFilenameBuilderUseDate = ref(true)
      const saveImageFilenameBuilderUseLocation = ref(true)
      const saveImageFilenameBuilderUseCategories = ref(true)
      const saveImageIsOwnPhoto = ref(true)
      const saveImageApiAuthor = ref('')
      const saveImageApiSourceUrl = ref('')
      const saveImageApiDateCreated = ref('')
      const saveImageApiLicenseTemplate = ref('Cc-by-sa-4.0')
      const saveImageApiElevationMeters = ref('')
      const saveImageElevationFromExif = ref(false)
      const saveImageIncludeElevation = ref(false)
      let saveImageMapInstance = null
      let saveImageMapMarker = null
      let saveImageMapHeadingLine = null
      let saveImageMapHeadingClickTimeout = null
      let saveImageMapHeadingFallbackTimeout = null
      let saveImageMapHeadingBeforeDoubleClick = null
      let saveImageMapHeadingFallbackActive = false
      let saveImageCoordinatePickerLastZoom = null
      let saveImageCoordinatePreviewMapInstance = null
      let saveImageCoordinatePreviewMarker = null
      let saveImageCoordinatePreviewHeadingLine = null
      let saveImageSubjectMapInstance = null
      let saveImageSubjectMapMarker = null
      let saveImageSubjectMapMarkerIcon = null
      let saveImageSubjectMapLinkedMarkersLayer = null
      const saveImageSubjectMapLinkedMarkerIconByColor = new Map()
      let saveImageSubjectMapHoverLayer = null
      let saveImageSubjectMapSelectedLayer = null
      let saveImageSubjectMapListViewBeforeSelection = null
      const saveImageSubjectMapFeatureGeometryCache = new Map()
      const saveImageFallbackEntityCache = new Map()
      const saveImageSubjectCategorySuggestionCache = new Map()
      const saveImageSubcategoryCache = new Map()
      const saveImageParentCategoryCache = new Map()
      const saveImageCategoryExistenceRequestCache = new Map()
      let saveImageFallbackToken = 0
      let saveImageNearbyCategoryToken = 0
      let saveImageNearbyDepictToken = 0
      let saveImageSelectedCategoryAncestorToken = 0
      let saveImageSubcategoryToken = 0
      let saveImageExifReadToken = 0
      let saveImageTargetFilenameCheckToken = 0
      let saveImageSubjectMapFeaturesToken = 0
      let saveImageSubjectSelectedFeatureWikidataToken = 0
      let saveImageSubjectLatestMetadataToken = 0
      let saveImageSubjectMapHoverRenderToken = 0
      let saveImageSubjectMapSelectedRenderToken = 0
      const isSaveImageDialogOpen = computed(() => showSaveImageApiForm.value)
      const saveImageSelectedFileName = computed(() => {
        if (!saveImageSelectedFile.value || typeof saveImageSelectedFile.value !== 'object') {
          return ''
        }
        const fileName = typeof saveImageSelectedFile.value.name === 'string' ? saveImageSelectedFile.value.name : ''
        return fileName.trim()
      })
      const saveImageCoordinatePickerHasPreview = computed(() => Boolean(saveImagePreviewUrl.value))
      const saveImageHasExifCoordinates = computed(() => (
        Number.isFinite(saveImageExifLatitude.value) &&
        Number.isFinite(saveImageExifLongitude.value)
      ))
      const saveImageHasInitialWikidataCoordinates = computed(() => (
        Number.isFinite(saveImageInitialWikidataLatitude.value) &&
        Number.isFinite(saveImageInitialWikidataLongitude.value)
      ))
      const saveImageExifCoordinatesDisplay = computed(() => {
        if (!saveImageHasExifCoordinates.value) {
          return ''
        }
        return formatCoordinatePair(
          saveImageExifLatitude.value,
          saveImageExifLongitude.value,
          locale.value,
          ''
        )
      })
      const saveImageWikidataCoordinatesDisplay = computed(() => {
        if (!saveImageHasInitialWikidataCoordinates.value) {
          return ''
        }
        return formatCoordinatePair(
          saveImageInitialWikidataLatitude.value,
          saveImageInitialWikidataLongitude.value,
          locale.value,
          ''
        )
      })
      const saveImageHasCoordinatePreview = computed(() => {
        const latitude = parseCoordinate(saveImageLatitude.value)
        const longitude = parseCoordinate(saveImageLongitude.value)
        return latitude !== null && longitude !== null
      })
      const saveImageHasExifMetadata = computed(() => (
        Boolean(saveImageExifDateTaken.value) ||
        saveImageHasExifCoordinates.value ||
        Number.isFinite(saveImageExifHeading.value) ||
        Number.isFinite(saveImageExifElevation.value)
      ))
      const saveImageSubjectTypeLocationRelevant = computed(
        () => saveImageSubjectTypeIsLocationRelevant(saveImageSubjectType.value),
      )
      const saveImageSubjectMapHasPoint = computed(() => (
        parseCoordinate(saveImageSubjectMapLatitude.value) !== null &&
        parseCoordinate(saveImageSubjectMapLongitude.value) !== null
      ))
      const saveImageSubjectImageHasPoint = computed(() => (
        Number.isFinite(saveImageSubjectImageXPercent.value) &&
        Number.isFinite(saveImageSubjectImageYPercent.value)
      ))
      function _saveImageSubjectCurrentPointLinkedPinColor() {
        if (saveImageSelectedSubjectMapFeature.value) {
          return ''
        }
        const currentX = Number(saveImageSubjectImageXPercent.value)
        const currentY = Number(saveImageSubjectImageYPercent.value)
        if (!Number.isFinite(currentX) || !Number.isFinite(currentY)) {
          return ''
        }
        const currentLatitude = parseCoordinate(saveImageSubjectMapLatitude.value)
        const currentLongitude = parseCoordinate(saveImageSubjectMapLongitude.value)
        const hasCurrentMapPoint = currentLatitude !== null && currentLongitude !== null
        const coordinateEpsilon = 0.000001
        const imagePointEpsilon = 0.0005

        for (let index = saveImageLinkedSubjects.value.length - 1; index >= 0; index -= 1) {
          const linkedItem = saveImageLinkedSubjects.value[index]
          if (!linkedItem || typeof linkedItem !== 'object') {
            continue
          }
          const linkedX = Number(linkedItem.image_x_percent)
          const linkedY = Number(linkedItem.image_y_percent)
          if (
            !Number.isFinite(linkedX) ||
            !Number.isFinite(linkedY) ||
            Math.abs(linkedX - currentX) > imagePointEpsilon ||
            Math.abs(linkedY - currentY) > imagePointEpsilon
          ) {
            continue
          }
          if (hasCurrentMapPoint) {
            const linkedLatitude = parseCoordinate(linkedItem.map_latitude)
            const linkedLongitude = parseCoordinate(linkedItem.map_longitude)
            if (
              linkedLatitude === null ||
              linkedLongitude === null ||
              Math.abs(linkedLatitude - currentLatitude) > coordinateEpsilon ||
              Math.abs(linkedLongitude - currentLongitude) > coordinateEpsilon
            ) {
              continue
            }
          }
          return getSaveImageSubjectLinkedPinColor(index)
        }
        return ''
      }
      const saveImageSubjectImageMarkerStyle = computed(() => {
        if (!saveImageSubjectImageHasPoint.value) {
          return {}
        }
        const linkedPinColor = _saveImageSubjectCurrentPointLinkedPinColor()
        const markerColor = linkedPinColor || SAVE_IMAGE_SUBJECT_PIN_COLOR
        return {
          left: `${Number(saveImageSubjectImageXPercent.value).toFixed(2)}%`,
          top: `${Number(saveImageSubjectImageYPercent.value).toFixed(2)}%`,
          backgroundImage: `url('${getSaveImageSubjectPinDataUri(markerColor)}')`,
        }
      })
      const saveImageSubjectAllMapFeatures = computed(() => {
        const mergedFeatures = []
        const seenKeys = new Set()
        for (const feature of saveImageSubjectNearbyMapFeatures.value) {
          if (!feature || typeof feature !== 'object') {
            continue
          }
          const key = String(feature.key || '').trim().toLowerCase()
          if (!key || seenKeys.has(key)) {
            continue
          }
          seenKeys.add(key)
          mergedFeatures.push(feature)
        }
        return mergedFeatures
      })
      const saveImageSelectedSubjectMapFeature = computed(() => {
        const selectedKey = String(saveImageSubjectSelectedMapFeatureKey.value || '').trim().toLowerCase()
        if (!selectedKey) {
          return null
        }
        const selectedFeature = saveImageSubjectAllMapFeatures.value.find((feature) => (
          feature &&
          typeof feature === 'object' &&
          String(feature.key || '').trim().toLowerCase() === selectedKey
        ))
        return selectedFeature || null
      })
      const saveImageSubjectLinkUsesMap = computed(() => (
        String(saveImageSubjectLinkMode.value || '').trim().toLowerCase() !== 'image-only'
      ))
      const saveImageSubjectHasActiveSelection = computed(() => (
        Boolean(saveImageSelectedSubjectMapFeature.value || saveImageSubjectDirectWikidataItem.value)
      ))
      const saveImageSubjectSelectedWikidataQid = computed(() => extractWikidataId(
        String(
          (saveImageSubjectSelectedWikidataItem.value && saveImageSubjectSelectedWikidataItem.value.id)
            || saveImageSubjectWikidataSearch.value
            || '',
        ),
      ))
      const saveImageSubjectCanAddLink = computed(() => {
        if (!saveImageSubjectImageHasPoint.value || !saveImageSubjectSelectedWikidataQid.value) {
          return false
        }
        if (!saveImageSubjectLinkUsesMap.value) {
          return true
        }
        return saveImageSubjectHasActiveSelection.value && saveImageSubjectMapHasPoint.value
      })
      const saveImageSubjectPendingLinkedSubject = computed(() => {
        if (saveImageSubjectLinkUsesMap.value && !saveImageSubjectHasActiveSelection.value) {
          return null
        }
        const mapLatitude = parseCoordinate(saveImageSubjectMapLatitude.value)
        const mapLongitude = parseCoordinate(saveImageSubjectMapLongitude.value)
        if (saveImageSubjectLinkUsesMap.value && (mapLatitude === null || mapLongitude === null)) {
          return null
        }
        const imageX = Number(saveImageSubjectImageXPercent.value)
        const imageY = Number(saveImageSubjectImageYPercent.value)
        if (!Number.isFinite(imageX) || !Number.isFinite(imageY)) {
          return null
        }
        const selectedQid = saveImageSubjectSelectedWikidataQid.value
        if (!selectedQid) {
          return null
        }
        const selectedItem = saveImageSubjectSelectedWikidataItem.value
        const selectedLabel = selectedItem && typeof selectedItem.label === 'string'
          ? selectedItem.label.trim()
          : ''
        const selectedMapFeature = saveImageSelectedSubjectMapFeature.value
        const selectedMapFeatureKey = selectedMapFeature && typeof selectedMapFeature.key === 'string'
          ? selectedMapFeature.key.trim()
          : ''
        const selectedMapFeatureType = selectedMapFeature && typeof selectedMapFeature.type === 'string'
          ? selectedMapFeature.type.trim()
          : ''
        const selectedMapFeatureId = selectedMapFeature && Number.isFinite(Number(selectedMapFeature.id))
          ? Number.parseInt(String(selectedMapFeature.id), 10)
          : null
        const selectedMapFeatureLabel = selectedMapFeature && typeof selectedMapFeature.displayLabel === 'string'
          ? selectedMapFeature.displayLabel.trim()
          : ''
        const mapDedupPart = mapLatitude === null || mapLongitude === null
          ? 'no-map'
          : `${mapLatitude.toFixed(6)},${mapLongitude.toFixed(6)}`
        const dedupeKey = [
          selectedQid.toLowerCase(),
          mapDedupPart,
          imageX.toFixed(3),
          imageY.toFixed(3),
        ].join('|')
        return {
          dedupeKey,
          id: selectedQid,
          label: selectedLabel,
          map_latitude: saveImageSubjectLinkUsesMap.value ? mapLatitude : null,
          map_longitude: saveImageSubjectLinkUsesMap.value ? mapLongitude : null,
          image_x_percent: imageX,
          image_y_percent: imageY,
          osm_feature_key: saveImageSubjectLinkUsesMap.value ? selectedMapFeatureKey : '',
          osm_feature_type: saveImageSubjectLinkUsesMap.value ? selectedMapFeatureType : '',
          osm_feature_id: saveImageSubjectLinkUsesMap.value ? selectedMapFeatureId : null,
          osm_feature_label: saveImageSubjectLinkUsesMap.value ? selectedMapFeatureLabel : '',
        }
      })
      const saveImageSubjectLinkedImageMarkers = computed(() => {
        if (!saveImageSubjectTypeLocationRelevant.value || saveImageSubjectHasActiveSelection.value) {
          return []
        }
        const markers = []
        for (let index = 0; index < saveImageLinkedSubjects.value.length; index += 1) {
          const linkedItem = saveImageLinkedSubjects.value[index]
          if (!linkedItem || typeof linkedItem !== 'object') {
            continue
          }
          const imageX = Number(linkedItem.image_x_percent)
          const imageY = Number(linkedItem.image_y_percent)
          if (!Number.isFinite(imageX) || !Number.isFinite(imageY)) {
            continue
          }
          const pinColor = getSaveImageSubjectLinkedPinColor(index)
          const markerKey = String(linkedItem.dedupeKey || '').trim() || `index-${index}`
          markers.push({
            key: markerKey,
            style: {
              left: `${Math.max(0, Math.min(100, imageX)).toFixed(2)}%`,
              top: `${Math.max(0, Math.min(100, imageY)).toFixed(2)}%`,
              backgroundImage: `url('${getSaveImageSubjectPinDataUri(pinColor)}')`,
            },
          })
        }
        return markers
      })
      const saveImageVisibleSubjectSelectedFeatureWikidataSuggestions = computed(() => {
        const visibleSuggestions = []
        const seenQids = new Set()
        for (const suggestion of saveImageSubjectSelectedFeatureWikidataSuggestions.value) {
          const normalizedItem = _normalizeSaveImageDepictItem(suggestion)
          if (!normalizedItem) {
            continue
          }
          const qid = normalizedItem.id.toLowerCase()
          if (seenQids.has(qid) || _isSaveImageDepictSelected(normalizedItem.id)) {
            continue
          }
          seenQids.add(qid)
          visibleSuggestions.push(normalizedItem)
          if (visibleSuggestions.length >= SAVE_IMAGE_SUBJECT_NEARBY_WIKIDATA_MAX_ITEMS) {
            break
          }
        }
        return visibleSuggestions
      })
      const saveImageVisibleNearbyCategorySuggestions = computed(() => {
        const selectedDedupeKeys = new Set(
          saveImageSelectedCategories.value
            .map((categoryName) => _normalizeUploadCategory(categoryName).toLowerCase())
            .filter(Boolean),
        )
        const ancestorDedupeKeys = new Set(
          Array.isArray(saveImageSelectedCategoryAncestorDedupeKeys.value)
            ? saveImageSelectedCategoryAncestorDedupeKeys.value
            : [],
        )
        const visibleSuggestions = []
        const seenDedupeKeys = new Set()
        for (const categoryName of saveImageNearbyCategorySuggestions.value) {
          const normalized = _normalizeUploadCategory(categoryName)
          if (!normalized) {
            continue
          }
          const dedupeKey = normalized.toLowerCase()
          if (
            selectedDedupeKeys.has(dedupeKey) ||
            ancestorDedupeKeys.has(dedupeKey) ||
            seenDedupeKeys.has(dedupeKey)
          ) {
            continue
          }
          seenDedupeKeys.add(dedupeKey)
          visibleSuggestions.push(normalized)
        }
        return visibleSuggestions
      })
      const saveImageVisibleNearbyDepictSuggestions = computed(() => {
        const visibleSuggestions = []
        const seenQids = new Set()
        for (const suggestion of saveImageNearbyDepictSuggestions.value) {
          if (!suggestion || typeof suggestion !== 'object') {
            continue
          }
          const qid = extractWikidataId(String(suggestion.id || ''))
          if (!qid || seenQids.has(qid)) {
            continue
          }
          seenQids.add(qid)
          visibleSuggestions.push({
            id: qid,
            label: typeof suggestion.label === 'string' ? suggestion.label.trim() : '',
            description: typeof suggestion.description === 'string' ? suggestion.description.trim() : '',
          })
          if (visibleSuggestions.length >= SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS) {
            break
          }
        }
        return visibleSuggestions
      })
      const saveImageSelectedBroadCategoryConflicts = computed(() => {
        const selectedCategoryByDedupeKey = new Map()
        for (const categoryName of saveImageSelectedCategories.value) {
          const normalizedCategory = _normalizeUploadCategory(categoryName)
          if (!normalizedCategory) {
            continue
          }
          const dedupeKey = normalizedCategory.toLowerCase()
          if (selectedCategoryByDedupeKey.has(dedupeKey)) {
            continue
          }
          selectedCategoryByDedupeKey.set(dedupeKey, normalizedCategory)
        }

        const conflicts = []
        const seen = new Set()
        const conflictDedupeKeys = Array.isArray(saveImageSelectedBroadCategoryConflictDedupeKeys.value)
          ? saveImageSelectedBroadCategoryConflictDedupeKeys.value
          : []
        for (const dedupeKeyRaw of conflictDedupeKeys) {
          const dedupeKey = String(dedupeKeyRaw || '').toLowerCase()
          if (!dedupeKey || seen.has(dedupeKey)) {
            continue
          }
          const selectedCategory = selectedCategoryByDedupeKey.get(dedupeKey)
          if (!selectedCategory) {
            continue
          }
          seen.add(dedupeKey)
          conflicts.push(selectedCategory)
        }
        return conflicts
      })
      const saveImageShowSourceUrl = computed(() => !saveImageIsOwnPhoto.value)
      const saveImageApiUsesPhotographerCoordinates = computed(
        () => saveImageApiCoordinateMode.value !== 'image',
      )
      const saveImageMapPickHelpText = computed(() => {
        if (!showSaveImageApiForm.value) {
          return ''
        }
        if (!saveImageApiUsesPhotographerCoordinates.value) {
          return t('saveImageMapPickHelpImage')
        }
        if (normalizeHeadingDegrees(saveImageHeading.value) === null) {
          return ''
        }
        return t('saveImageMapPickHelpPhotographerTarget')
      })
      const saveImageHeadingDisplay = computed(() => {
        const heading = normalizeHeadingDegrees(saveImageHeading.value)
        if (heading === null) {
          return t('noValue')
        }
        return `${heading.toFixed(1).replace(/\.0$/, '')}\u00b0`
      })
      const saveImagePreviewUsesHeadingIndicator = computed(() => {
        if (!saveImageApiUsesPhotographerCoordinates.value) {
          return false
        }
        return normalizeHeadingDegrees(saveImageHeading.value) !== null
      })
      const saveImageElevationValue = computed(() => parseCoordinate(saveImageApiElevationMeters.value))
      const saveImageHasElevationValue = computed(() => saveImageElevationValue.value !== null)
      const saveImageElevationDisplay = computed(() => {
        const elevation = saveImageElevationValue.value
        if (elevation === null) {
          return t('noValue')
        }
        return `${elevation.toFixed(1).replace(/\.0$/, '')} m`
      })

      function isSaveImageBroaderCategoryConflict(categoryName) {
        const normalizedCategory = _normalizeUploadCategory(categoryName)
        if (!normalizedCategory) {
          return false
        }
        const dedupeKey = normalizedCategory.toLowerCase()
        return saveImageSelectedBroadCategoryConflictDedupeKeys.value.some(
          (existingKey) => String(existingKey || '').toLowerCase() === dedupeKey,
        )
      }

      function _normalizedAuthUsername() {
        return typeof authUsername.value === 'string' ? authUsername.value.trim() : ''
      }

      function _syncSaveImageAuthorFromOwnershipSelection() {
        if (saveImageIsOwnPhoto.value) {
          saveImageApiAuthor.value = _normalizedAuthUsername()
          return
        }
        saveImageApiAuthor.value = ''
      }

      function _normalizeSaveImageMetadataLanguage(value) {
        const normalized = normalizeSupportedLocale(String(value || ''))
        if (normalized) {
          return normalized
        }
        return normalizeSupportedLocale(locale.value) || 'en'
      }

      function _saveImageCurrentIsoDate() {
        const now = new Date()
        const year = String(now.getFullYear()).padStart(4, '0')
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      function _saveImageFilenameDatePart() {
        const rawDateCreated = typeof saveImageApiDateCreated.value === 'string' ? saveImageApiDateCreated.value.trim() : ''
        const dateMatch = rawDateCreated.match(/^(\d{4}(?:-\d{2}(?:-\d{2})?)?)/)
        if (dateMatch && dateMatch[1]) {
          return dateMatch[1]
        }
        return _saveImageCurrentIsoDate()
      }

      function _saveImageSelectedFileExtension() {
        const fileName = saveImageSelectedFileName.value
        const extensionMatch = fileName.match(/(\.[A-Za-z0-9]{1,10})$/)
        return extensionMatch && extensionMatch[1] ? extensionMatch[1] : ''
      }

      function _normalizeSaveImageFilenameBase(value) {
        return String(value || '')
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[\\/:*?"<>|#\[\]{}]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }

      function _saveImageFilenameToken(value, { replaceUnderscores = false, maxLength = 72 } = {}) {
        let rawValue = String(value || '').trim()
        if (!rawValue) {
          return ''
        }
        if (replaceUnderscores) {
          rawValue = rawValue.replace(/_/g, ' ')
        }
        const normalizedToken = _normalizeSaveImageFilenameBase(rawValue)
        if (!normalizedToken) {
          return ''
        }
        if (normalizedToken.length <= maxLength) {
          return normalizedToken
        }
        return normalizedToken.slice(0, maxLength).trim()
      }

      function _saveImageFilenameBuilderSelectedSubjectLabels() {
        const labels = []
        const seen = new Set()
        for (const linkedItem of Array.isArray(saveImageLinkedSubjects.value) ? saveImageLinkedSubjects.value : []) {
          if (!linkedItem || typeof linkedItem !== 'object') {
            continue
          }
          const linkedQid = extractWikidataId(String(linkedItem.id || ''))
          const rawLabel = typeof linkedItem.label === 'string' ? linkedItem.label.trim() : ''
          const labelCandidate = rawLabel || linkedQid
          const normalizedLabel = _saveImageFilenameToken(labelCandidate, { maxLength: 56 })
          if (!normalizedLabel) {
            continue
          }
          const dedupeKey = normalizedLabel.toLowerCase()
          if (seen.has(dedupeKey)) {
            continue
          }
          seen.add(dedupeKey)
          labels.push(normalizedLabel)
          if (labels.length >= SAVE_IMAGE_FILENAME_BUILDER_MAX_SUBJECTS) {
            break
          }
        }
        return labels
      }

      function _saveImageFilenameBuilderSelectedCategoryLabels() {
        const labels = []
        const seen = new Set()
        for (const categoryName of Array.isArray(saveImageSelectedCategories.value) ? saveImageSelectedCategories.value : []) {
          const normalizedCategory = _normalizeUploadCategory(categoryName)
          if (!normalizedCategory) {
            continue
          }
          const normalizedLabel = _saveImageFilenameToken(normalizedCategory, {
            replaceUnderscores: true,
            maxLength: 48,
          })
          if (!normalizedLabel) {
            continue
          }
          const dedupeKey = normalizedLabel.toLowerCase()
          if (seen.has(dedupeKey)) {
            continue
          }
          seen.add(dedupeKey)
          labels.push(normalizedLabel)
          if (labels.length >= SAVE_IMAGE_FILENAME_BUILDER_MAX_CATEGORIES) {
            break
          }
        }
        return labels
      }

      function _buildSaveImageSuggestedTargetFilename() {
        const filenameParts = []

        if (saveImageFilenameBuilderUseLocation.value) {
          const locationName = (
            location.value &&
            typeof location.value === 'object' &&
            typeof location.value.name === 'string'
          )
            ? location.value.name.trim()
            : ''
          const locationToken = _saveImageFilenameToken(locationName, { maxLength: 72 })
          if (locationToken) {
            filenameParts.push(locationToken)
          }
        }

        if (saveImageFilenameBuilderUseSubjects.value) {
          const subjectLabels = _saveImageFilenameBuilderSelectedSubjectLabels()
          if (subjectLabels.length > 0) {
            filenameParts.push(subjectLabels.join(', '))
          }
        }

        if (saveImageFilenameBuilderUseDate.value) {
          const datePart = _saveImageFilenameDatePart()
          const normalizedDatePart = _saveImageFilenameToken(datePart, { maxLength: 20 })
          if (normalizedDatePart) {
            filenameParts.push(normalizedDatePart)
          }
        }

        if (saveImageFilenameBuilderUseCategories.value) {
          const categoryLabels = _saveImageFilenameBuilderSelectedCategoryLabels()
          if (categoryLabels.length > 0) {
            filenameParts.push(categoryLabels.join(', '))
          }
        }

        if (filenameParts.length < 1) {
          filenameParts.push(t('saveImageFilenameFallbackBase'))
          filenameParts.push(_saveImageFilenameDatePart())
        }

        const extension = _saveImageSelectedFileExtension()
        let filenameBase = _normalizeSaveImageFilenameBase(filenameParts.join(' - '))
        if (!filenameBase) {
          filenameBase = t('saveImageFilenameFallbackBase')
        }
        if (filenameBase.length > SAVE_IMAGE_FILENAME_BUILDER_MAX_BASE_LENGTH) {
          filenameBase = filenameBase.slice(0, SAVE_IMAGE_FILENAME_BUILDER_MAX_BASE_LENGTH).trim()
        }
        const suggestedFilename = `${filenameBase}${extension}`.trim()
        return normalizeCommonsFilenameCandidate(suggestedFilename)
      }

      const saveImageFilenameBuilderPreview = computed(() => _buildSaveImageSuggestedTargetFilename())

      function isSaveImageFilenameBuilderPartEnabled(partKey) {
        const normalizedPart = String(partKey || '').trim().toLowerCase()
        if (normalizedPart === 'subjects') {
          return Boolean(saveImageFilenameBuilderUseSubjects.value)
        }
        if (normalizedPart === 'date') {
          return Boolean(saveImageFilenameBuilderUseDate.value)
        }
        if (normalizedPart === 'location') {
          return Boolean(saveImageFilenameBuilderUseLocation.value)
        }
        if (normalizedPart === 'categories') {
          return Boolean(saveImageFilenameBuilderUseCategories.value)
        }
        return false
      }

      function toggleSaveImageFilenameBuilderPart(partKey) {
        const normalizedPart = String(partKey || '').trim().toLowerCase()
        if (normalizedPart === 'subjects') {
          saveImageFilenameBuilderUseSubjects.value = !saveImageFilenameBuilderUseSubjects.value
          return
        }
        if (normalizedPart === 'date') {
          saveImageFilenameBuilderUseDate.value = !saveImageFilenameBuilderUseDate.value
          return
        }
        if (normalizedPart === 'location') {
          saveImageFilenameBuilderUseLocation.value = !saveImageFilenameBuilderUseLocation.value
          return
        }
        if (normalizedPart === 'categories') {
          saveImageFilenameBuilderUseCategories.value = !saveImageFilenameBuilderUseCategories.value
        }
      }

      function applySaveImageFilenameBuilderSuggestion() {
        const suggestedFilename = _buildSaveImageSuggestedTargetFilename()
        if (!suggestedFilename) {
          return
        }
        saveImageApiTargetFilename.value = suggestedFilename
        saveImageApiTargetFilenameTouched.value = true
        checkSaveImageApiTargetFilenameAvailabilityDebounced()
      }

      function _resetSaveImageApiTargetFilenameAvailability() {
        saveImageTargetFilenameCheckToken += 1
        saveImageApiTargetFilenameChecking.value = false
        saveImageApiTargetFilenameAvailable.value = null
        saveImageApiTargetFilenameCheckError.value = ''
      }

      async function _checkSaveImageApiTargetFilenameAvailability() {
        const normalizedFilename = normalizeCommonsFilenameCandidate(saveImageApiTargetFilename.value)
        if (!normalizedFilename) {
          _resetSaveImageApiTargetFilenameAvailability()
          return
        }
        const selectedFileExtension = _saveImageSelectedFileExtension()

        const currentToken = ++saveImageTargetFilenameCheckToken
        saveImageApiTargetFilenameChecking.value = true
        saveImageApiTargetFilenameAvailable.value = null
        saveImageApiTargetFilenameCheckError.value = ''
        try {
          const isAvailable = await checkCommonsFilenameAvailability(normalizedFilename, {
            fallbackExtension: selectedFileExtension,
          })
          if (currentToken !== saveImageTargetFilenameCheckToken) {
            return
          }
          saveImageApiTargetFilenameAvailable.value = typeof isAvailable === 'boolean' ? isAvailable : null
        } catch (error) {
          if (currentToken !== saveImageTargetFilenameCheckToken) {
            return
          }
          saveImageApiTargetFilenameAvailable.value = null
          saveImageApiTargetFilenameCheckError.value = t('saveImageFilenameCheckFailed')
        } finally {
          if (currentToken === saveImageTargetFilenameCheckToken) {
            saveImageApiTargetFilenameChecking.value = false
          }
        }
      }

      const checkSaveImageApiTargetFilenameAvailabilityDebounced = debounce(() => {
        void _checkSaveImageApiTargetFilenameAvailability()
      }, 350)

      function _applySuggestedSaveImageTargetFilenameIfAllowed({ force = false } = {}) {
        if (!force && saveImageApiTargetFilenameTouched.value) {
          return
        }
        const suggestedFilename = _buildSaveImageSuggestedTargetFilename()
        if (!suggestedFilename) {
          return
        }
        saveImageApiTargetFilename.value = suggestedFilename
        saveImageApiTargetFilenameTouched.value = false
        checkSaveImageApiTargetFilenameAvailabilityDebounced()
      }

      function onSaveImageApiTargetFilenameInput() {
        saveImageApiTargetFilenameTouched.value = true
        saveImageTargetFilenameCheckToken += 1
        saveImageApiTargetFilenameChecking.value = false
        saveImageApiTargetFilenameAvailable.value = null
        saveImageApiTargetFilenameCheckError.value = ''
        checkSaveImageApiTargetFilenameAvailabilityDebounced()
      }

      function onSaveImageApiTargetFilenameBlur() {
        const normalizedFilename = normalizeCommonsFilenameCandidate(saveImageApiTargetFilename.value)
        if (normalizedFilename !== saveImageApiTargetFilename.value) {
          saveImageApiTargetFilename.value = normalizedFilename
        }
        if (!normalizedFilename) {
          _resetSaveImageApiTargetFilenameAvailability()
          return
        }
        void _checkSaveImageApiTargetFilenameAvailability()
      }

      function _saveImageCoordinatesMatchCurrent(latitude, longitude) {
        const targetLatitude = Number(latitude)
        const targetLongitude = Number(longitude)
        if (!Number.isFinite(targetLatitude) || !Number.isFinite(targetLongitude)) {
          return false
        }
        const currentLatitude = parseCoordinate(saveImageLatitude.value)
        const currentLongitude = parseCoordinate(saveImageLongitude.value)
        if (currentLatitude === null || currentLongitude === null) {
          return false
        }
        return (
          Math.abs(currentLatitude - targetLatitude) < 0.000001 &&
          Math.abs(currentLongitude - targetLongitude) < 0.000001
        )
      }

      const saveImageCanResetToExifCoordinates = computed(() => (
        saveImageHasExifCoordinates.value &&
        !_saveImageCoordinatesMatchCurrent(saveImageExifLatitude.value, saveImageExifLongitude.value)
      ))

      const saveImageCanResetToWikidataCoordinates = computed(() => (
        saveImageHasInitialWikidataCoordinates.value &&
        !_saveImageCoordinatesMatchCurrent(saveImageInitialWikidataLatitude.value, saveImageInitialWikidataLongitude.value)
      ))

      function currentDetailCoordinates() {
        if (!location.value) {
          return null
        }
        const latitude = parseCoordinate(location.value.latitude)
        const longitude = parseCoordinate(location.value.longitude)
        if (latitude === null || longitude === null) {
          return null
        }
        return [latitude, longitude]
      }

      const hasDetailMapCoordinates = computed(() => currentDetailCoordinates() !== null)

      function destroyDetailMap() {
        if (detailMapInstance) {
          detailMapInstance.remove()
          detailMapInstance = null
          detailMapMarker = null
        }
      }

      function ensureDetailMap() {
        const coordinates = currentDetailCoordinates()
        if (!detailMapElement.value || !coordinates) {
          destroyDetailMap()
          return
        }

        if (!detailMapInstance) {
          detailMapInstance = L.map(detailMapElement.value).setView(coordinates, 12)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(detailMapInstance)
        }

        if (!detailMapMarker) {
          detailMapMarker = L.circleMarker(coordinates, {
            radius: 7,
            color: '#0369a1',
            fillColor: '#0369a1',
            fillOpacity: 0.8,
          }).addTo(detailMapInstance)
        } else {
          detailMapMarker.setLatLng(coordinates)
        }

        detailMapInstance.setView(coordinates, 12)
        window.setTimeout(() => {
          if (detailMapInstance) {
            detailMapInstance.invalidateSize()
          }
        }, 0)
      }

      function _clearSaveImageHeadingDoubleClickTracking() {
        if (saveImageMapHeadingClickTimeout !== null) {
          window.clearTimeout(saveImageMapHeadingClickTimeout)
          saveImageMapHeadingClickTimeout = null
        }
        if (saveImageMapHeadingFallbackTimeout !== null) {
          window.clearTimeout(saveImageMapHeadingFallbackTimeout)
          saveImageMapHeadingFallbackTimeout = null
        }
        saveImageMapHeadingBeforeDoubleClick = null
        saveImageMapHeadingFallbackActive = false
      }

      function _armSaveImageHeadingDoubleClickFallback() {
        if (!saveImageMapHeadingFallbackActive) {
          saveImageMapHeadingBeforeDoubleClick = _currentSaveImageHeadingDegrees()
          saveImageMapHeadingFallbackActive = true
        }
        if (saveImageMapHeadingFallbackTimeout !== null) {
          window.clearTimeout(saveImageMapHeadingFallbackTimeout)
        }
        saveImageMapHeadingFallbackTimeout = window.setTimeout(() => {
          saveImageMapHeadingFallbackTimeout = null
          saveImageMapHeadingBeforeDoubleClick = null
          saveImageMapHeadingFallbackActive = false
        }, 520)
      }

      function destroySaveImageWizardMap() {
        _clearSaveImageHeadingDoubleClickTracking()
        if (saveImageMapInstance) {
          const currentZoom = Number(saveImageMapInstance.getZoom())
          if (Number.isFinite(currentZoom)) {
            saveImageCoordinatePickerLastZoom = currentZoom
          }
          saveImageMapInstance.remove()
          saveImageMapInstance = null
          saveImageMapMarker = null
          saveImageMapHeadingLine = null
        }
      }

      function destroySaveImageCoordinatePreviewMap() {
        if (saveImageCoordinatePreviewMapInstance) {
          saveImageCoordinatePreviewMapInstance.remove()
          saveImageCoordinatePreviewMapInstance = null
          saveImageCoordinatePreviewMarker = null
          saveImageCoordinatePreviewHeadingLine = null
        }
        _setSaveImageCoordinatePreviewCameraHeadingCssVariable(null)
      }

      function _clearSaveImageCoordinatePreviewHeadingVisuals() {
        if (!saveImageCoordinatePreviewMapInstance) {
          saveImageCoordinatePreviewHeadingLine = null
          _setSaveImageCoordinatePreviewCameraHeadingCssVariable(null)
          return
        }
        if (saveImageCoordinatePreviewHeadingLine) {
          saveImageCoordinatePreviewMapInstance.removeLayer(saveImageCoordinatePreviewHeadingLine)
          saveImageCoordinatePreviewHeadingLine = null
        }
        _setSaveImageCoordinatePreviewCameraHeadingCssVariable(null)
      }

      function _updateSaveImageCoordinatePreviewHeadingVisuals(latitude, longitude) {
        if (!saveImageCoordinatePreviewMapInstance) {
          return
        }
        if (!saveImageApiUsesPhotographerCoordinates.value) {
          _clearSaveImageCoordinatePreviewHeadingVisuals()
          return
        }
        const heading = _currentSaveImageHeadingDegrees()
        if (heading === null) {
          _clearSaveImageCoordinatePreviewHeadingVisuals()
          return
        }
        const headingLinePoints = _headingLinePointsForMapView(
          saveImageCoordinatePreviewMapInstance,
          latitude,
          longitude,
          heading,
        )
        if (!headingLinePoints) {
          _clearSaveImageCoordinatePreviewHeadingVisuals()
          return
        }
        const fromPoint = [headingLinePoints.fromLatitude, headingLinePoints.fromLongitude]
        const toPoint = [headingLinePoints.toLatitude, headingLinePoints.toLongitude]
        _setSaveImageCoordinatePreviewCameraHeadingCssVariable(heading)

        if (!saveImageCoordinatePreviewHeadingLine) {
          saveImageCoordinatePreviewHeadingLine = L.polyline([fromPoint, toPoint], {
            color: '#b45309',
            weight: 3,
            opacity: 0.9,
            dashArray: '6 6',
          }).addTo(saveImageCoordinatePreviewMapInstance)
        } else {
          saveImageCoordinatePreviewHeadingLine.setLatLngs([fromPoint, toPoint])
        }
      }

      function ensureSaveImageCoordinatePreviewMap() {
        if (!showSaveImageApiForm.value || !saveImageCoordinatePreviewMapElement.value) {
          destroySaveImageCoordinatePreviewMap()
          return
        }

        const latitude = parseCoordinate(saveImageLatitude.value)
        const longitude = parseCoordinate(saveImageLongitude.value)
        if (latitude === null || longitude === null) {
          destroySaveImageCoordinatePreviewMap()
          return
        }

        const point = [latitude, longitude]
        if (!saveImageCoordinatePreviewMapInstance) {
          saveImageCoordinatePreviewMapInstance = L.map(saveImageCoordinatePreviewMapElement.value, {
            zoomControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false,
            tap: false,
            attributionControl: false,
          }).setView(point, 14)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(saveImageCoordinatePreviewMapInstance)
        }

        if (saveImagePreviewUsesHeadingIndicator.value) {
          if (saveImageCoordinatePreviewMarker) {
            saveImageCoordinatePreviewMapInstance.removeLayer(saveImageCoordinatePreviewMarker)
            saveImageCoordinatePreviewMarker = null
          }
        } else if (!saveImageCoordinatePreviewMarker) {
          saveImageCoordinatePreviewMarker = L.marker(point).addTo(saveImageCoordinatePreviewMapInstance)
        } else {
          saveImageCoordinatePreviewMarker.setLatLng(point)
        }

        saveImageCoordinatePreviewMapInstance.setView(point, 14)
        _updateSaveImageCoordinatePreviewHeadingVisuals(latitude, longitude)
        window.setTimeout(() => {
          if (saveImageCoordinatePreviewMapInstance) {
            saveImageCoordinatePreviewMapInstance.invalidateSize()
            _updateSaveImageCoordinatePreviewHeadingVisuals(latitude, longitude)
          }
        }, 0)
      }

      function _syncSaveImageSubjectMapZoomLevel() {
        if (!saveImageSubjectMapInstance) {
          saveImageSubjectMapZoomLevel.value = null
          return
        }
        const zoomLevel = Number(saveImageSubjectMapInstance.getZoom())
        saveImageSubjectMapZoomLevel.value = Number.isFinite(zoomLevel) ? zoomLevel : null
      }

      function destroySaveImageSubjectMap() {
        saveImageSubjectMapHoverRenderToken += 1
        saveImageSubjectMapSelectedRenderToken += 1
        saveImageSubjectMapListViewBeforeSelection = null
        saveImageSubjectMapZoomLevel.value = null
        if (saveImageSubjectMapInstance) {
          saveImageSubjectMapInstance.remove()
          saveImageSubjectMapInstance = null
          saveImageSubjectMapMarker = null
          saveImageSubjectMapMarkerIcon = null
          saveImageSubjectMapLinkedMarkersLayer = null
          saveImageSubjectMapLinkedMarkerIconByColor.clear()
          saveImageSubjectMapHoverLayer = null
          saveImageSubjectMapSelectedLayer = null
        }
        saveImageSubjectMapFeatureGeometryCache.clear()
      }

      function _clearSaveImageSubjectMapFeatureHoverLayer({ bumpToken = true } = {}) {
        if (bumpToken) {
          saveImageSubjectMapHoverRenderToken += 1
        }
        if (saveImageSubjectMapInstance && saveImageSubjectMapHoverLayer) {
          saveImageSubjectMapInstance.removeLayer(saveImageSubjectMapHoverLayer)
        }
        saveImageSubjectMapHoverLayer = null
      }

      function _clearSaveImageSubjectMapFeatureSelectedLayer({ bumpToken = true } = {}) {
        if (bumpToken) {
          saveImageSubjectMapSelectedRenderToken += 1
        }
        if (saveImageSubjectMapInstance && saveImageSubjectMapSelectedLayer) {
          saveImageSubjectMapInstance.removeLayer(saveImageSubjectMapSelectedLayer)
        }
        saveImageSubjectMapSelectedLayer = null
      }

      function _clearSaveImageSubjectMapFeatureLayers() {
        _clearSaveImageSubjectMapFeatureHoverLayer()
        _clearSaveImageSubjectMapFeatureSelectedLayer()
      }

      function _clearSaveImageSubjectSelectedFeatureWikidataSuggestions() {
        saveImageSubjectSelectedFeatureWikidataToken += 1
        saveImageSubjectSelectedFeatureWikidataLoading.value = false
        saveImageSubjectSelectedFeatureWikidataSuggestions.value = []
      }

      function _clearSaveImageSubjectMapFeatures() {
        saveImageSubjectMapFeaturesToken += 1
        saveImageSubjectLatestMetadataToken += 1
        saveImageSubjectMapListViewBeforeSelection = null
        saveImageSubjectMapFeaturesLoading.value = false
        saveImageSubjectMapFeaturesError.value = ''
        saveImageSubjectMapFeaturesLoadedLatitude.value = null
        saveImageSubjectMapFeaturesLoadedLongitude.value = null
        saveImageSubjectNearbyMapFeatures.value = []
        saveImageSubjectHoveredMapFeatureKey.value = ''
        saveImageSubjectSelectedMapFeatureKey.value = ''
        saveImageSubjectDirectWikidataItem.value = null
        _clearSaveImageSubjectMapFeatureLayers()
        _clearSaveImageSubjectSelectedFeatureWikidataSuggestions()
        _renderSaveImageSubjectLinkedMarkers()
      }

      function _prepareSaveImageSubjectMapFeatureLoadingState() {
        saveImageSubjectMapFeaturesToken += 1
        saveImageSubjectLatestMetadataToken += 1
        saveImageSubjectMapListViewBeforeSelection = null
        saveImageSubjectMapFeaturesLoading.value = true
        saveImageSubjectMapFeaturesError.value = ''
        saveImageSubjectMapFeaturesLoadedLatitude.value = null
        saveImageSubjectMapFeaturesLoadedLongitude.value = null
        saveImageSubjectNearbyMapFeatures.value = []
        saveImageSubjectHoveredMapFeatureKey.value = ''
        saveImageSubjectSelectedMapFeatureKey.value = ''
        saveImageSubjectDirectWikidataItem.value = null
        _clearSaveImageSubjectMapFeatureLayers()
        _clearSaveImageSubjectSelectedFeatureWikidataSuggestions()
        _renderSaveImageSubjectLinkedMarkers()
      }

      function _hasSaveImageSubjectMapFeaturesLoadedForCoordinates(latitude, longitude) {
        const parsedLatitude = Number(latitude)
        const parsedLongitude = Number(longitude)
        if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
          return false
        }
        const loadedLatitude = Number(saveImageSubjectMapFeaturesLoadedLatitude.value)
        const loadedLongitude = Number(saveImageSubjectMapFeaturesLoadedLongitude.value)
        if (!Number.isFinite(loadedLatitude) || !Number.isFinite(loadedLongitude)) {
          return false
        }
        return (
          Math.abs(loadedLatitude - parsedLatitude) <= 0.000001 &&
          Math.abs(loadedLongitude - parsedLongitude) <= 0.000001
        )
      }

      function _clearSaveImageSubjectMapMarker() {
        if (saveImageSubjectMapInstance && saveImageSubjectMapMarker) {
          saveImageSubjectMapInstance.removeLayer(saveImageSubjectMapMarker)
        }
        saveImageSubjectMapMarker = null
      }

      function _clearSaveImageSubjectMapLinkedMarkersLayer() {
        if (saveImageSubjectMapInstance && saveImageSubjectMapLinkedMarkersLayer) {
          saveImageSubjectMapInstance.removeLayer(saveImageSubjectMapLinkedMarkersLayer)
        }
        saveImageSubjectMapLinkedMarkersLayer = null
      }

      function _getSaveImageSubjectMapMarkerIcon() {
        if (saveImageSubjectMapMarkerIcon) {
          return saveImageSubjectMapMarkerIcon
        }
        if (typeof L === 'undefined' || typeof L.icon !== 'function') {
          return null
        }
        saveImageSubjectMapMarkerIcon = L.icon({
          iconUrl: SAVE_IMAGE_SUBJECT_PIN_DATA_URI,
          iconRetinaUrl: SAVE_IMAGE_SUBJECT_PIN_DATA_URI,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30],
          className: 'save-image-subject-map-pin-icon',
        })
        return saveImageSubjectMapMarkerIcon
      }

      function _getSaveImageSubjectMapLinkedMarkerIcon(pinColor) {
        if (typeof L === 'undefined' || typeof L.icon !== 'function') {
          return null
        }
        const normalizedColor = typeof pinColor === 'string' && pinColor.trim()
          ? pinColor.trim()
          : SAVE_IMAGE_SUBJECT_PIN_COLOR
        if (saveImageSubjectMapLinkedMarkerIconByColor.has(normalizedColor)) {
          return saveImageSubjectMapLinkedMarkerIconByColor.get(normalizedColor)
        }
        const iconDataUri = getSaveImageSubjectPinDataUri(normalizedColor)
        const icon = L.icon({
          iconUrl: iconDataUri,
          iconRetinaUrl: iconDataUri,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30],
          className: 'save-image-subject-map-pin-icon',
        })
        saveImageSubjectMapLinkedMarkerIconByColor.set(normalizedColor, icon)
        return icon
      }

      function saveImageLinkedSubjectListPinStyle(indexValue) {
        const pinColor = getSaveImageSubjectLinkedPinColor(indexValue)
        return {
          backgroundImage: `url('${getSaveImageSubjectPinDataUri(pinColor)}')`,
        }
      }

      function _renderSaveImageSubjectLinkedMarkers() {
        _clearSaveImageSubjectMapLinkedMarkersLayer()
        if (!saveImageSubjectMapInstance || saveImageSubjectHasActiveSelection.value) {
          return
        }
        const layers = []
        for (let index = 0; index < saveImageLinkedSubjects.value.length; index += 1) {
          const linkedItem = saveImageLinkedSubjects.value[index]
          if (!linkedItem || typeof linkedItem !== 'object') {
            continue
          }
          const latitude = parseCoordinate(linkedItem.map_latitude)
          const longitude = parseCoordinate(linkedItem.map_longitude)
          if (latitude === null || longitude === null) {
            continue
          }
          const markerOptions = {
            interactive: false,
            keyboard: false,
          }
          const markerIcon = _getSaveImageSubjectMapLinkedMarkerIcon(getSaveImageSubjectLinkedPinColor(index))
          if (markerIcon) {
            markerOptions.icon = markerIcon
          }
          layers.push(L.marker([latitude, longitude], markerOptions))
        }
        if (layers.length < 1) {
          return
        }
        saveImageSubjectMapLinkedMarkersLayer = L.layerGroup(layers).addTo(saveImageSubjectMapInstance)
      }

      function _setSaveImageSubjectMapCoordinates(latitude, longitude, {
        updateMapView = true,
        minimumZoom = 13,
        showMarker = true,
      } = {}) {
        const parsedLatitude = Number(latitude)
        const parsedLongitude = Number(longitude)
        if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
          return
        }
        saveImageSubjectMapLatitude.value = parsedLatitude.toFixed(6)
        saveImageSubjectMapLongitude.value = parsedLongitude.toFixed(6)

        if (!saveImageSubjectMapInstance) {
          return
        }
        const point = [parsedLatitude, parsedLongitude]
        if (showMarker) {
          if (!saveImageSubjectMapMarker) {
            const markerOptions = {}
            const markerIcon = _getSaveImageSubjectMapMarkerIcon()
            if (markerIcon) {
              markerOptions.icon = markerIcon
            }
            saveImageSubjectMapMarker = L.marker(point, markerOptions).addTo(saveImageSubjectMapInstance)
          } else {
            saveImageSubjectMapMarker.setLatLng(point)
          }
        } else {
          _clearSaveImageSubjectMapMarker()
        }
        if (updateMapView) {
          saveImageSubjectMapInstance.setView(point, Math.max(saveImageSubjectMapInstance.getZoom(), minimumZoom))
          _syncSaveImageSubjectMapZoomLevel()
        }
      }

      function _findSaveImageSubjectMapFeatureByKey(featureKeyValue) {
        const targetKey = String(featureKeyValue || '').trim().toLowerCase()
        if (!targetKey) {
          return null
        }
        for (const feature of saveImageSubjectAllMapFeatures.value) {
          if (!feature || typeof feature !== 'object') {
            continue
          }
          if (String(feature.key || '').trim().toLowerCase() === targetKey) {
            return feature
          }
        }
        return null
      }

      function _replaceSaveImageSubjectNearbyMapFeature(updatedFeature) {
        if (!updatedFeature || typeof updatedFeature !== 'object') {
          return
        }
        const targetKey = String(updatedFeature.key || '').trim().toLowerCase()
        if (!targetKey) {
          return
        }
        const currentFeatures = Array.isArray(saveImageSubjectNearbyMapFeatures.value)
          ? saveImageSubjectNearbyMapFeatures.value
          : []
        let changed = false
        const nextFeatures = currentFeatures.map((candidateFeature) => {
          if (
            candidateFeature &&
            typeof candidateFeature === 'object' &&
            String(candidateFeature.key || '').trim().toLowerCase() === targetKey
          ) {
            changed = true
            return updatedFeature
          }
          return candidateFeature
        })
        if (changed) {
          saveImageSubjectNearbyMapFeatures.value = nextFeatures
        }
      }

      async function _refreshSaveImageSubjectMapFeatureFromLatestSources(feature, selectionToken) {
        if (!feature || typeof feature !== 'object') {
          return feature
        }
        const clickLatitude = parseCoordinate(saveImageSubjectMapLatitude.value)
        const clickLongitude = parseCoordinate(saveImageSubjectMapLongitude.value)
        const refreshSingleFeature = async (targetFeature) => {
          if (!targetFeature || typeof targetFeature !== 'object') {
            return targetFeature
          }
          const targetFeatureType = normalizeOsmMapFeatureType(targetFeature.type)
          const targetFeatureId = Number.parseInt(String(targetFeature.id), 10)
          if (!targetFeatureType || !Number.isFinite(targetFeatureId) || targetFeatureId < 1) {
            return targetFeature
          }
          const targetFeatureLatitude = readOsmMapFeatureCoordinateValue(targetFeature.latitude)
          const targetFeatureLongitude = readOsmMapFeatureCoordinateValue(targetFeature.longitude)
          const targetFeatureTags = targetFeature.rawTags && typeof targetFeature.rawTags === 'object'
            ? targetFeature.rawTags
            : {}
          const targetFeatureNameHint = (
            readPreferredOsmMapFeatureName(targetFeatureTags, locale.value) ||
            (typeof targetFeature.displayLabel === 'string' ? targetFeature.displayLabel.trim() : '')
          )
          const hintLatitude = targetFeatureLatitude !== null ? targetFeatureLatitude : clickLatitude
          const hintLongitude = targetFeatureLongitude !== null ? targetFeatureLongitude : clickLongitude
          const latestPayload = await fetchLatestOsmFeatureMetadata(targetFeatureType, targetFeatureId, locale.value, {
            hintLatitude,
            hintLongitude,
            hintName: targetFeatureNameHint,
          })
          if (selectionToken !== saveImageSubjectLatestMetadataToken) {
            return null
          }
          const mergedFeature = mergeOsmMapFeatureWithLatestMetadata(targetFeature, latestPayload, {
            clickLatitude,
            clickLongitude,
            lang: locale.value,
          })
          return mergedFeature && typeof mergedFeature === 'object'
            ? mergedFeature
            : targetFeature
        }

        const mergedComponents = Array.isArray(feature.mergedComponents)
          ? feature.mergedComponents.filter((entry) => entry && typeof entry === 'object')
          : []
        if (mergedComponents.length > 0) {
          try {
            const refreshedMergedComponents = await Promise.all(
              mergedComponents.map(async (mergedComponent) => {
                try {
                  return await refreshSingleFeature(mergedComponent)
                } catch (error) {
                  void error
                  return mergedComponent
                }
              }),
            )
            if (selectionToken !== saveImageSubjectLatestMetadataToken) {
              return null
            }
            const resolvedMergedComponents = refreshedMergedComponents.map((entry, index) => (
              entry && typeof entry === 'object'
                ? entry
                : mergedComponents[index]
            ))
            const updatedFeature = {
              ...feature,
              mergedComponents: resolvedMergedComponents,
              mergedFeatureCount: resolvedMergedComponents.length,
            }
            const mergedDirectQids = []
            const seenMergedDirectQids = new Set()
            for (const mergedComponent of resolvedMergedComponents) {
              if (!mergedComponent || typeof mergedComponent !== 'object') {
                continue
              }
              const directQid = extractWikidataId(
                String(
                  mergedComponent.directQid ||
                  (mergedComponent.rawTags && mergedComponent.rawTags.wikidata
                    ? mergedComponent.rawTags.wikidata
                    : '') ||
                  '',
                ),
              )
              if (!directQid || seenMergedDirectQids.has(directQid)) {
                continue
              }
              seenMergedDirectQids.add(directQid)
              mergedDirectQids.push(directQid)
            }
            updatedFeature.mergedDirectQids = mergedDirectQids

            const baseRawTags = updatedFeature.rawTags && typeof updatedFeature.rawTags === 'object'
              ? { ...updatedFeature.rawTags }
              : {}
            const resolvedDirectQid = extractWikidataId(String(updatedFeature.directQid || '')) || (mergedDirectQids[0] || '')
            if (resolvedDirectQid) {
              updatedFeature.directQid = resolvedDirectQid
              baseRawTags.wikidata = resolvedDirectQid
            }
            updatedFeature.rawTags = baseRawTags
            _replaceSaveImageSubjectNearbyMapFeature(updatedFeature)
            return updatedFeature
          } catch (error) {
            if (selectionToken !== saveImageSubjectLatestMetadataToken) {
              return null
            }
            return feature
          }
        }

        const featureType = normalizeOsmMapFeatureType(feature.type)
        const featureId = Number.parseInt(String(feature.id), 10)
        if (!featureType || !Number.isFinite(featureId) || featureId < 1) {
          return feature
        }
        const featureLatitude = readOsmMapFeatureCoordinateValue(feature.latitude)
        const featureLongitude = readOsmMapFeatureCoordinateValue(feature.longitude)
        const featureTags = feature.rawTags && typeof feature.rawTags === 'object'
          ? feature.rawTags
          : {}
        const featureNameHint = (
          readPreferredOsmMapFeatureName(featureTags, locale.value) ||
          (typeof feature.displayLabel === 'string' ? feature.displayLabel.trim() : '')
        )
        const hintLatitude = featureLatitude !== null ? featureLatitude : clickLatitude
        const hintLongitude = featureLongitude !== null ? featureLongitude : clickLongitude
        try {
          const latestPayload = await fetchLatestOsmFeatureMetadata(featureType, featureId, locale.value, {
            hintLatitude,
            hintLongitude,
            hintName: featureNameHint,
          })
          if (selectionToken !== saveImageSubjectLatestMetadataToken) {
            return null
          }
          const mergedFeature = mergeOsmMapFeatureWithLatestMetadata(feature, latestPayload, {
            clickLatitude,
            clickLongitude,
            lang: locale.value,
          })
          if (!mergedFeature) {
            return feature
          }
          _replaceSaveImageSubjectNearbyMapFeature(mergedFeature)
          return mergedFeature
        } catch (error) {
          if (selectionToken !== saveImageSubjectLatestMetadataToken) {
            return null
          }
          return feature
        }
      }

      async function _renderSaveImageSubjectMapFeatureLayer(feature, { mode = 'hover' } = {}) {
        const targetMode = mode === 'selected' ? 'selected' : 'hover'
        const renderToken = targetMode === 'selected'
          ? ++saveImageSubjectMapSelectedRenderToken
          : ++saveImageSubjectMapHoverRenderToken
        if (targetMode === 'selected') {
          _clearSaveImageSubjectMapFeatureSelectedLayer({ bumpToken: false })
        } else {
          _clearSaveImageSubjectMapFeatureHoverLayer({ bumpToken: false })
        }
        if (!saveImageSubjectMapInstance || !feature || typeof feature !== 'object') {
          return
        }
        const featureKey = String(feature.key || '').trim().toLowerCase()
        if (!featureKey) {
          return
        }
        let geometryElements = null
        if (saveImageSubjectMapFeatureGeometryCache.has(featureKey)) {
          geometryElements = saveImageSubjectMapFeatureGeometryCache.get(featureKey)
        } else {
          geometryElements = []
          saveImageSubjectMapFeatureGeometryCache.set(featureKey, geometryElements)
        }
        if (
          (targetMode === 'selected' && renderToken !== saveImageSubjectMapSelectedRenderToken) ||
          (targetMode === 'hover' && renderToken !== saveImageSubjectMapHoverRenderToken)
        ) {
          return
        }
        const featureLayerStyle = targetMode === 'selected'
          ? {
            color: '#0ea5e9',
            fillColor: '#38bdf8',
            weight: 4,
            opacity: 0.95,
            fillOpacity: 0.24,
            markerRadius: 7,
          }
          : {
            color: '#f59e0b',
            fillColor: '#fbbf24',
            weight: 3,
            opacity: 0.92,
            fillOpacity: 0.2,
            markerRadius: 6,
          }
        let layer = null
        const mergedComponents = Array.isArray(feature.mergedComponents)
          ? feature.mergedComponents.filter((entry) => entry && typeof entry === 'object')
          : []
        if (mergedComponents.length > 0) {
          const mergedLayers = []
          for (const mergedComponent of mergedComponents) {
            const mergedLayer = buildLeafletLayerFromOsmMapFeatureGeometry(
              mergedComponent,
              [],
              featureLayerStyle,
            )
            if (mergedLayer) {
              mergedLayers.push(mergedLayer)
            }
          }
          if (mergedLayers.length === 1) {
            layer = mergedLayers[0]
          } else if (mergedLayers.length > 1) {
            layer = L.layerGroup(mergedLayers)
          }
        }
        if (!layer) {
          layer = buildLeafletLayerFromOsmMapFeatureGeometry(
            feature,
            geometryElements,
            featureLayerStyle,
          )
        }
        if (!layer) {
          return
        }
        layer.addTo(saveImageSubjectMapInstance)
        if (typeof layer.bringToFront === 'function') {
          layer.bringToFront()
        }
        if (targetMode === 'selected') {
          saveImageSubjectMapSelectedLayer = layer
          return
        }
        saveImageSubjectMapHoverLayer = layer
      }

      function _zoomSaveImageSubjectMapToFeature(feature) {
        if (!saveImageSubjectMapInstance || !feature || typeof feature !== 'object') {
          return
        }
        const selectedLayer = saveImageSubjectMapSelectedLayer
        if (selectedLayer && typeof selectedLayer.getBounds === 'function') {
          const bounds = selectedLayer.getBounds()
          if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
            saveImageSubjectMapInstance.fitBounds(bounds.pad(0.2), { maxZoom: 17 })
            _syncSaveImageSubjectMapZoomLevel()
            return
          }
        }
        if (selectedLayer && typeof selectedLayer.getLatLng === 'function') {
          const latLng = selectedLayer.getLatLng()
          if (
            latLng &&
            Number.isFinite(Number(latLng.lat)) &&
            Number.isFinite(Number(latLng.lng))
          ) {
            const targetZoom = Math.max(saveImageSubjectMapInstance.getZoom(), 17)
            saveImageSubjectMapInstance.setView([Number(latLng.lat), Number(latLng.lng)], targetZoom)
            _syncSaveImageSubjectMapZoomLevel()
            return
          }
        }
        const fallbackLatitude = readOsmMapFeatureCoordinateValue(feature.latitude)
        const fallbackLongitude = readOsmMapFeatureCoordinateValue(feature.longitude)
        if (fallbackLatitude !== null && fallbackLongitude !== null) {
          const targetZoom = Math.max(saveImageSubjectMapInstance.getZoom(), 17)
          saveImageSubjectMapInstance.setView([fallbackLatitude, fallbackLongitude], targetZoom)
          _syncSaveImageSubjectMapZoomLevel()
        }
      }

      async function _loadSaveImageSubjectSelectedFeatureWikidataSuggestions(feature) {
        const currentToken = ++saveImageSubjectSelectedFeatureWikidataToken
        saveImageSubjectSelectedFeatureWikidataLoading.value = true
        saveImageSubjectSelectedFeatureWikidataSuggestions.value = []
        try {
          const imageMunicipalityQid = (
            location.value && typeof location.value === 'object'
              ? extractWikidataId(String(location.value.municipality_p131 || ''))
              : ''
          )
          const items = await fetchWikidataCandidatesForOsmMapFeature(feature, {
            lang: locale.value,
            municipalityQid: imageMunicipalityQid,
            limit: SAVE_IMAGE_SUBJECT_NEARBY_WIKIDATA_MAX_ITEMS,
          })
          if (currentToken !== saveImageSubjectSelectedFeatureWikidataToken) {
            return
          }
          saveImageSubjectSelectedFeatureWikidataSuggestions.value = Array.isArray(items) ? items : []
        } catch (error) {
          if (currentToken !== saveImageSubjectSelectedFeatureWikidataToken) {
            return
          }
          saveImageSubjectSelectedFeatureWikidataSuggestions.value = []
        } finally {
          if (currentToken === saveImageSubjectSelectedFeatureWikidataToken) {
            saveImageSubjectSelectedFeatureWikidataLoading.value = false
          }
        }
      }

      async function selectSaveImageSubjectMapFeature(
        feature,
        {
          updateMapView = true,
          refreshLatest = false,
          resetPointPair = false,
        } = {},
      ) {
        if (!feature || typeof feature !== 'object') {
          return
        }
        const featureKey = String(feature.key || '').trim()
        if (!featureKey) {
          return
        }
        const hadSelectedFeature = saveImageSubjectHasActiveSelection.value
        const previousSelectedFeatureKey = String(saveImageSubjectSelectedMapFeatureKey.value || '').trim().toLowerCase()
        const normalizedFeatureKey = featureKey.toLowerCase()
        if (resetPointPair && previousSelectedFeatureKey !== normalizedFeatureKey) {
          saveImageSubjectMapLatitude.value = ''
          saveImageSubjectMapLongitude.value = ''
          saveImageSubjectImageXPercent.value = null
          saveImageSubjectImageYPercent.value = null
          _clearSaveImageSubjectMapMarker()
        }
        if (updateMapView && !hadSelectedFeature && saveImageSubjectMapInstance) {
          const viewCenter = saveImageSubjectMapInstance.getCenter()
          const viewZoom = saveImageSubjectMapInstance.getZoom()
          if (
            viewCenter &&
            Number.isFinite(Number(viewCenter.lat)) &&
            Number.isFinite(Number(viewCenter.lng)) &&
            Number.isFinite(Number(viewZoom))
          ) {
            saveImageSubjectMapListViewBeforeSelection = {
              lat: Number(viewCenter.lat),
              lng: Number(viewCenter.lng),
              zoom: Number(viewZoom),
            }
          } else {
            saveImageSubjectMapListViewBeforeSelection = null
          }
        }
        const selectionToken = ++saveImageSubjectLatestMetadataToken
        saveImageSubjectSelectionError.value = ''
        saveImageSubjectDirectWikidataItem.value = null
        saveImageSubjectSelectedMapFeatureKey.value = featureKey
        saveImageSubjectHoveredMapFeatureKey.value = ''
        _clearSaveImageSubjectMapFeatureHoverLayer()
        _renderSaveImageSubjectLinkedMarkers()
        let selectedFeature = feature
        await _renderSaveImageSubjectMapFeatureLayer(selectedFeature, { mode: 'selected' })
        if (updateMapView) {
          _zoomSaveImageSubjectMapToFeature(selectedFeature)
        }

        if (refreshLatest) {
          const refreshedFeature = await _refreshSaveImageSubjectMapFeatureFromLatestSources(selectedFeature, selectionToken)
          if (selectionToken !== saveImageSubjectLatestMetadataToken) {
            return
          }
          if (refreshedFeature && typeof refreshedFeature === 'object') {
            selectedFeature = refreshedFeature
            await _renderSaveImageSubjectMapFeatureLayer(selectedFeature, { mode: 'selected' })
            if (updateMapView) {
              _zoomSaveImageSubjectMapToFeature(selectedFeature)
            }
          }
        }

        if (selectionToken !== saveImageSubjectLatestMetadataToken) {
          return
        }
        const selectionDebugQids = []
        const seenSelectionDebugQids = new Set()
        const pushSelectionDebugQid = (qidValue) => {
          const qid = extractWikidataId(String(qidValue || ''))
          if (!qid || seenSelectionDebugQids.has(qid)) {
            return
          }
          seenSelectionDebugQids.add(qid)
          selectionDebugQids.push(qid)
        }
        pushSelectionDebugQid(selectedFeature.directQid)
        pushSelectionDebugQid(
          selectedFeature.rawTags && selectedFeature.rawTags.wikidata
            ? selectedFeature.rawTags.wikidata
            : '',
        )
        for (const mergedDirectQid of Array.isArray(selectedFeature.mergedDirectQids) ? selectedFeature.mergedDirectQids : []) {
          pushSelectionDebugQid(mergedDirectQid)
        }
        const mergedComponentWikidata = []
        for (const mergedComponent of Array.isArray(selectedFeature.mergedComponents) ? selectedFeature.mergedComponents : []) {
          if (!mergedComponent || typeof mergedComponent !== 'object') {
            continue
          }
          const componentQid = extractWikidataId(
            String(
              mergedComponent.directQid ||
              (mergedComponent.rawTags && mergedComponent.rawTags.wikidata ? mergedComponent.rawTags.wikidata : '') ||
              '',
            ),
          )
          if (componentQid) {
            mergedComponentWikidata.push(componentQid)
            pushSelectionDebugQid(componentQid)
          }
        }
        logSubjectFeatureSelectionDebug({
          featureKey: String(selectedFeature.key || ''),
          featureLabel: String(selectedFeature.displayLabel || ''),
          featureType: String(selectedFeature.type || ''),
          featureId: Number.isFinite(Number(selectedFeature.id)) ? Number(selectedFeature.id) : null,
          directQid: extractWikidataId(String(selectedFeature.directQid || '')),
          rawWikidata: String(
            selectedFeature.rawTags && selectedFeature.rawTags.wikidata
              ? selectedFeature.rawTags.wikidata
              : '',
          ),
          mergedDirectQids: Array.isArray(selectedFeature.mergedDirectQids) ? selectedFeature.mergedDirectQids : [],
          mergedFeatureCount: Number.isFinite(Number(selectedFeature.mergedFeatureCount))
            ? Number(selectedFeature.mergedFeatureCount)
            : 0,
          mergedComponentWikidata,
          allDetectedQids: selectionDebugQids,
        })
        await _loadSaveImageSubjectSelectedFeatureWikidataSuggestions(selectedFeature)
        const directQid = extractWikidataId(
          String(
            selectedFeature.directQid ||
            (selectedFeature.rawTags && selectedFeature.rawTags.wikidata ? selectedFeature.rawTags.wikidata : '') ||
            '',
          )
        )
        if (directQid) {
          const currentQid = extractWikidataId(String(saveImageSubjectWikidataSearch.value || ''))
          const currentSelection = _normalizeSaveImageDepictItem(saveImageSubjectSelectedWikidataItem.value)
          const hasCurrentLabel = Boolean(
            currentSelection &&
            currentSelection.id === directQid &&
            currentSelection.label,
          )
          if (!currentQid || currentQid !== directQid || !hasCurrentLabel) {
            const resolvedDirectItem = _resolveSaveImageSubjectWikidataItem({
              id: directQid,
              label: '',
              description: '',
            })
            if (resolvedDirectItem) {
              saveImageSubjectSelectedWikidataItem.value = resolvedDirectItem
              saveImageSubjectWikidataSearch.value = saveImageDepictDisplayLabel(resolvedDirectItem)
            } else {
              saveImageSubjectWikidataSearch.value = directQid
              saveImageSubjectSelectedWikidataItem.value = {
                id: directQid,
                label: '',
                description: '',
              }
            }
          }
        }
      }

      function showSaveImageSubjectNearbyFeatureList() {
        saveImageSubjectSelectionError.value = ''
        saveImageSubjectSelectedMapFeatureKey.value = ''
        saveImageSubjectHoveredMapFeatureKey.value = ''
        saveImageSubjectDirectWikidataItem.value = null
        _clearSaveImageSubjectMapFeatureLayers()
        _clearSaveImageSubjectSelectedFeatureWikidataSuggestions()
        clearSaveImageSubjectWikidataSelection()
        if (
          saveImageSubjectMapInstance &&
          saveImageSubjectMapListViewBeforeSelection &&
          Number.isFinite(Number(saveImageSubjectMapListViewBeforeSelection.lat)) &&
          Number.isFinite(Number(saveImageSubjectMapListViewBeforeSelection.lng)) &&
          Number.isFinite(Number(saveImageSubjectMapListViewBeforeSelection.zoom))
        ) {
          saveImageSubjectMapInstance.setView(
            [
              Number(saveImageSubjectMapListViewBeforeSelection.lat),
              Number(saveImageSubjectMapListViewBeforeSelection.lng),
            ],
            Number(saveImageSubjectMapListViewBeforeSelection.zoom),
          )
        }
        saveImageSubjectMapListViewBeforeSelection = null
        _renderSaveImageSubjectLinkedMarkers()
      }

      function isSaveImageSubjectMapFeatureSelected(feature) {
        if (!feature || typeof feature !== 'object') {
          return false
        }
        return String(saveImageSubjectSelectedMapFeatureKey.value || '').trim().toLowerCase() === String(feature.key || '').trim().toLowerCase()
      }

      function isSaveImageSubjectMapFeatureHovered(feature) {
        if (!feature || typeof feature !== 'object') {
          return false
        }
        return String(saveImageSubjectHoveredMapFeatureKey.value || '').trim().toLowerCase() === String(feature.key || '').trim().toLowerCase()
      }

      function onSaveImageSubjectMapFeatureMouseEnter(feature) {
        if (!feature || typeof feature !== 'object') {
          return
        }
        const featureKey = String(feature.key || '').trim()
        if (!featureKey) {
          return
        }
        saveImageSubjectHoveredMapFeatureKey.value = featureKey
        if (isSaveImageSubjectMapFeatureSelected(feature)) {
          _clearSaveImageSubjectMapFeatureHoverLayer()
          return
        }
        void _renderSaveImageSubjectMapFeatureLayer(feature, { mode: 'hover' })
      }

      function onSaveImageSubjectMapFeatureMouseLeave(feature) {
        const featureKey = String(feature && feature.key ? feature.key : '').trim().toLowerCase()
        if (
          !featureKey ||
          String(saveImageSubjectHoveredMapFeatureKey.value || '').trim().toLowerCase() !== featureKey
        ) {
          return
        }
        saveImageSubjectHoveredMapFeatureKey.value = ''
        _clearSaveImageSubjectMapFeatureHoverLayer()
      }

      function formatSaveImageSubjectMapFeatureCoordinates(feature) {
        if (!feature || typeof feature !== 'object') {
          return t('noValue')
        }
        return formatCoordinatePair(
          feature.latitude,
          feature.longitude,
          locale.value,
          6,
          t('noValue'),
        )
      }

      function formatSaveImageSubjectMapFeatureDistance(feature) {
        if (!feature || typeof feature !== 'object' || !Number.isFinite(Number(feature.distanceMeters))) {
          return t('noValue')
        }
        return `${new Intl.NumberFormat(locale.value).format(Number(feature.distanceMeters))} m`
      }

      async function _loadSaveImageSubjectMapFeatures(latitude, longitude) {
        const parsedLatitude = Number(latitude)
        const parsedLongitude = Number(longitude)
        if (
          !Number.isFinite(parsedLatitude) ||
          !Number.isFinite(parsedLongitude) ||
          !showSaveImageApiForm.value ||
          !saveImageSubjectTypeLocationRelevant.value
        ) {
          _clearSaveImageSubjectMapFeatures()
          return
        }

        const currentToken = ++saveImageSubjectMapFeaturesToken
        saveImageSubjectMapFeaturesLoading.value = true
        saveImageSubjectMapFeaturesError.value = ''
        try {
          const containerWikidataQid = (
            location.value && typeof location.value === 'object'
              ? extractWikidataId(String(location.value.municipality_p131 || ''))
              : ''
          ) || SAVE_IMAGE_SUBJECT_CONTAINER_FALLBACK_QID
          const featureGroups = await fetchSaveImageSubjectQueryFeatures(parsedLatitude, parsedLongitude, {
            radiusMeters: SAVE_IMAGE_SUBJECT_OSM_RADIUS_METERS,
            nearbyLimit: SAVE_IMAGE_SUBJECT_NEARBY_MAP_FEATURE_BASE_LIMIT,
            lang: locale.value,
            containerWikidataQid,
          })
          if (
            currentToken !== saveImageSubjectMapFeaturesToken ||
            !showSaveImageApiForm.value ||
            !saveImageSubjectTypeLocationRelevant.value
          ) {
            return
          }
          const nearbyFeatures = Array.isArray(featureGroups && featureGroups.nearbyFeatures)
            ? featureGroups.nearbyFeatures
            : []
          saveImageSubjectMapFeaturesLoadedLatitude.value = parsedLatitude
          saveImageSubjectMapFeaturesLoadedLongitude.value = parsedLongitude
          saveImageSubjectNearbyMapFeatures.value = nearbyFeatures
          const allFeatures = []
          const seenFeatureKeys = new Set()
          for (const feature of nearbyFeatures) {
            if (!feature || typeof feature !== 'object') {
              continue
            }
            const featureKey = String(feature.key || '').trim().toLowerCase()
            if (!featureKey || seenFeatureKeys.has(featureKey)) {
              continue
            }
            seenFeatureKeys.add(featureKey)
            allFeatures.push(feature)
          }
          if (allFeatures.length < 1) {
            saveImageSubjectSelectedMapFeatureKey.value = ''
            _clearSaveImageSubjectMapFeatureLayers()
            _clearSaveImageSubjectSelectedFeatureWikidataSuggestions()
            _renderSaveImageSubjectLinkedMarkers()
            return
          }
          const selectedFeatureKey = String(saveImageSubjectSelectedMapFeatureKey.value || '').trim().toLowerCase()
          const selectedFeature = selectedFeatureKey
            ? allFeatures.find((feature) => String(feature.key || '').trim().toLowerCase() === selectedFeatureKey)
            : null
          if (selectedFeature) {
            await selectSaveImageSubjectMapFeature(selectedFeature, { updateMapView: false })
            return
          }
          saveImageSubjectSelectedMapFeatureKey.value = ''
          _clearSaveImageSubjectMapFeatureLayers()
          _clearSaveImageSubjectSelectedFeatureWikidataSuggestions()
          _renderSaveImageSubjectLinkedMarkers()
        } catch (error) {
          if (currentToken !== saveImageSubjectMapFeaturesToken) {
            return
          }
          saveImageSubjectMapFeaturesLoadedLatitude.value = null
          saveImageSubjectMapFeaturesLoadedLongitude.value = null
          saveImageSubjectNearbyMapFeatures.value = []
          saveImageSubjectSelectedMapFeatureKey.value = ''
          saveImageSubjectMapFeaturesError.value = t('saveImageSubjectFeatureFetchFailed')
          _clearSaveImageSubjectMapFeatureLayers()
          _clearSaveImageSubjectSelectedFeatureWikidataSuggestions()
          _renderSaveImageSubjectLinkedMarkers()
        } finally {
          if (currentToken === saveImageSubjectMapFeaturesToken) {
            saveImageSubjectMapFeaturesLoading.value = false
          }
        }
      }

      const refreshSaveImageSubjectMapFeaturesDebounced = debounce((latitude, longitude) => {
        void _loadSaveImageSubjectMapFeatures(latitude, longitude)
      }, 250)

      function ensureSaveImageSubjectMap() {
        if (
          !showSaveImageApiForm.value ||
          !saveImageSubjectTypeLocationRelevant.value ||
          !saveImageSubjectMapElement.value
        ) {
          destroySaveImageSubjectMap()
          return
        }
        const selectedLatitude = parseCoordinate(saveImageSubjectMapLatitude.value)
        const selectedLongitude = parseCoordinate(saveImageSubjectMapLongitude.value)
        const currentLatitude = parseCoordinate(saveImageLatitude.value)
        const currentLongitude = parseCoordinate(saveImageLongitude.value)
        const hasSubjectPoint = selectedLatitude !== null && selectedLongitude !== null
        const hasCurrentCoordinates = currentLatitude !== null && currentLongitude !== null
        const center = hasSubjectPoint
          ? [selectedLatitude, selectedLongitude]
          : (hasCurrentCoordinates ? [currentLatitude, currentLongitude] : [60.1699, 24.9384])
        const initialZoom = Number.isFinite(saveImageCoordinatePickerLastZoom)
          ? saveImageCoordinatePickerLastZoom
          : (hasCurrentCoordinates ? 14 : 6)

        if (!saveImageSubjectMapInstance) {
          saveImageSubjectMapInstance = L.map(saveImageSubjectMapElement.value, {
            scrollWheelZoom: 'center',
            doubleClickZoom: true,
            touchZoom: 'center',
          }).setView(center, initialZoom)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(saveImageSubjectMapInstance)
          saveImageSubjectMapInstance.on('click', (event) => {
            if (!event || !event.latlng) {
              return
            }
            _setSaveImageSubjectMapCoordinates(event.latlng.lat, event.latlng.lng, { updateMapView: false })
            saveImageSubjectSelectionError.value = ''
            if (saveImageSubjectHasActiveSelection.value) {
              return
            }
            _prepareSaveImageSubjectMapFeatureLoadingState()
            refreshSaveImageSubjectMapFeaturesDebounced(event.latlng.lat, event.latlng.lng)
          })
          saveImageSubjectMapInstance.on('zoomend', () => {
            _syncSaveImageSubjectMapZoomLevel()
          })
        }

        if (hasSubjectPoint) {
          _setSaveImageSubjectMapCoordinates(selectedLatitude, selectedLongitude, {
            updateMapView: false,
            showMarker: true,
          })
          const mapCenter = saveImageSubjectMapInstance.getCenter()
          const centerMatches = mapCenter && (
            Math.abs(mapCenter.lat - selectedLatitude) < 0.000001 &&
            Math.abs(mapCenter.lng - selectedLongitude) < 0.000001
          )
          if (!centerMatches) {
            saveImageSubjectMapInstance.setView(center, Math.max(saveImageSubjectMapInstance.getZoom(), 14))
            _syncSaveImageSubjectMapZoomLevel()
          }
        } else {
          if (saveImageSubjectMapMarker) {
            saveImageSubjectMapInstance.removeLayer(saveImageSubjectMapMarker)
            saveImageSubjectMapMarker = null
          }
          saveImageSubjectMapInstance.setView(center, initialZoom)
          _syncSaveImageSubjectMapZoomLevel()
        }

        if (saveImageSelectedSubjectMapFeature.value) {
          void _renderSaveImageSubjectMapFeatureLayer(saveImageSelectedSubjectMapFeature.value, { mode: 'selected' })
        } else {
          _clearSaveImageSubjectMapFeatureSelectedLayer()
        }
        _renderSaveImageSubjectLinkedMarkers()
        _syncSaveImageSubjectMapZoomLevel()

        window.setTimeout(() => {
          if (saveImageSubjectMapInstance) {
            saveImageSubjectMapInstance.invalidateSize()
            _syncSaveImageSubjectMapZoomLevel()
          }
        }, 0)
      }

      function onSaveImageSubjectTypeChange() {
        saveImageSubjectSelectionError.value = ''
        const normalizedType = normalizeSaveImageSubjectType(saveImageSubjectType.value)
        saveImageSubjectType.value = normalizedType
        saveImageSubjectLinkMode.value = preferredSaveImageSubjectLinkMode(normalizedType)
        if (saveImageSubjectTypeLocationRelevant.value) {
          if (saveImageSubjectLinkUsesMap.value && !saveImageSubjectMapHasPoint.value) {
            const latitude = parseCoordinate(saveImageLatitude.value)
            const longitude = parseCoordinate(saveImageLongitude.value)
            if (latitude !== null && longitude !== null) {
              saveImageSubjectMapLatitude.value = latitude.toFixed(6)
              saveImageSubjectMapLongitude.value = longitude.toFixed(6)
            }
          }
          if (!saveImageSubjectLinkUsesMap.value) {
            destroySaveImageSubjectMap()
            _clearSaveImageSubjectMapFeatures()
            return
          }
          const subjectLatitude = parseCoordinate(saveImageSubjectMapLatitude.value)
          const subjectLongitude = parseCoordinate(saveImageSubjectMapLongitude.value)
          if (subjectLatitude !== null && subjectLongitude !== null) {
            _prepareSaveImageSubjectMapFeatureLoadingState()
            refreshSaveImageSubjectMapFeaturesDebounced(subjectLatitude, subjectLongitude)
          } else {
            _clearSaveImageSubjectMapFeatures()
          }
          void nextTick().then(() => {
            ensureSaveImageSubjectMap()
          })
          return
        }
        destroySaveImageSubjectMap()
        _clearSaveImageSubjectMapFeatures()
      }

      function onSaveImageSubjectLinkModeChange() {
        saveImageSubjectSelectionError.value = ''
        if (!saveImageSubjectTypeLocationRelevant.value) {
          return
        }
        if (!saveImageSubjectLinkUsesMap.value) {
          destroySaveImageSubjectMap()
          return
        }
        const subjectLatitude = parseCoordinate(saveImageSubjectMapLatitude.value)
        const subjectLongitude = parseCoordinate(saveImageSubjectMapLongitude.value)
        if (subjectLatitude !== null && subjectLongitude !== null) {
          if (!_hasSaveImageSubjectMapFeaturesLoadedForCoordinates(subjectLatitude, subjectLongitude)) {
            _prepareSaveImageSubjectMapFeatureLoadingState()
            refreshSaveImageSubjectMapFeaturesDebounced(subjectLatitude, subjectLongitude)
          }
        }
        void nextTick().then(() => {
          ensureSaveImageSubjectMap()
        })
      }

      function onSaveImageSubjectImagePreviewClick(event) {
        if (!event || !event.currentTarget || !saveImagePreviewUrl.value) {
          return
        }
        const bounds = event.currentTarget.getBoundingClientRect
          ? event.currentTarget.getBoundingClientRect()
          : null
        if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) {
          return
        }
        const clickX = Number(event.clientX)
        const clickY = Number(event.clientY)
        if (!Number.isFinite(clickX) || !Number.isFinite(clickY)) {
          return
        }
        const xPercent = ((clickX - bounds.left) / bounds.width) * 100
        const yPercent = ((clickY - bounds.top) / bounds.height) * 100
        saveImageSubjectImageXPercent.value = Math.max(0, Math.min(100, xPercent))
        saveImageSubjectImageYPercent.value = Math.max(0, Math.min(100, yPercent))
        saveImageSubjectSelectionError.value = ''
      }

      function _resolveSaveImageSubjectWikidataItem(item) {
        const normalizedItem = _normalizeSaveImageDepictItem(item)
        if (!normalizedItem) {
          return null
        }
        let resolvedLabel = normalizedItem.label
        let resolvedDescription = normalizedItem.description
        const targetQid = normalizedItem.id

        const tryApplyCandidate = (candidate) => {
          const normalizedCandidate = _normalizeSaveImageDepictItem(candidate)
          if (!normalizedCandidate || normalizedCandidate.id !== targetQid) {
            return
          }
          if (!resolvedLabel && normalizedCandidate.label) {
            resolvedLabel = normalizedCandidate.label
          }
          if (!resolvedDescription && normalizedCandidate.description) {
            resolvedDescription = normalizedCandidate.description
          }
        }

        tryApplyCandidate(saveImageSubjectSelectedWikidataItem.value)
        tryApplyCandidate(saveImageSubjectDirectWikidataItem.value)
        for (const sourceCollection of [
          saveImageSubjectSelectedFeatureWikidataSuggestions.value,
          saveImageSubjectWikidataSuggestions.value,
          saveImageNearbyDepictSuggestions.value,
          saveImageSelectedDepicts.value,
        ]) {
          for (const candidate of Array.isArray(sourceCollection) ? sourceCollection : []) {
            tryApplyCandidate(candidate)
            if (resolvedLabel && resolvedDescription) {
              break
            }
          }
          if (resolvedLabel && resolvedDescription) {
            break
          }
        }

        const selectedFeature = saveImageSelectedSubjectMapFeature.value
        if (selectedFeature && typeof selectedFeature === 'object') {
          const selectedFeatureDirectQids = new Set()
          const pushSelectedFeatureDirectQid = (candidateValue) => {
            const candidateQid = extractWikidataId(String(candidateValue || ''))
            if (candidateQid) {
              selectedFeatureDirectQids.add(candidateQid)
            }
          }
          pushSelectedFeatureDirectQid(selectedFeature.directQid)
          pushSelectedFeatureDirectQid(
            selectedFeature.rawTags && selectedFeature.rawTags.wikidata
              ? selectedFeature.rawTags.wikidata
              : '',
          )
          for (const mergedDirectQid of Array.isArray(selectedFeature.mergedDirectQids) ? selectedFeature.mergedDirectQids : []) {
            pushSelectedFeatureDirectQid(mergedDirectQid)
          }
          if (!resolvedLabel && selectedFeatureDirectQids.has(targetQid)) {
            const fallbackFeatureLabel = typeof selectedFeature.displayLabel === 'string'
              ? selectedFeature.displayLabel.trim()
              : ''
            if (
              fallbackFeatureLabel &&
              fallbackFeatureLabel.toLowerCase() !== targetQid.toLowerCase()
            ) {
              resolvedLabel = fallbackFeatureLabel
            }
          }
          if (!resolvedLabel || !resolvedDescription) {
            for (const reverseCandidate of [
              ...(Array.isArray(selectedFeature.wikidataReverseCandidates) ? selectedFeature.wikidataReverseCandidates : []),
              ...(Array.isArray(selectedFeature.wikidataNameMatchCandidates) ? selectedFeature.wikidataNameMatchCandidates : []),
            ]) {
              const normalizedReverseCandidate = _normalizeSaveImageDepictItem(reverseCandidate)
              if (!normalizedReverseCandidate || normalizedReverseCandidate.id !== targetQid) {
                continue
              }
              if (!resolvedLabel && normalizedReverseCandidate.label) {
                resolvedLabel = normalizedReverseCandidate.label
              }
              if (!resolvedDescription && normalizedReverseCandidate.description) {
                resolvedDescription = normalizedReverseCandidate.description
              }
              if (resolvedLabel && resolvedDescription) {
                break
              }
            }
          }
        }

        return {
          id: targetQid,
          label: resolvedLabel,
          description: resolvedDescription,
        }
      }

      function _setSaveImageSubjectWikidataSelection(item) {
        const resolvedItem = _resolveSaveImageSubjectWikidataItem(item)
        if (!resolvedItem) {
          saveImageSubjectSelectedWikidataItem.value = null
          return null
        }
        saveImageSubjectSelectedWikidataItem.value = resolvedItem
        return resolvedItem
      }

      const searchSaveImageSubjectWikidataDebounced = debounce(async (searchTerm) => {
        saveImageSubjectWikidataLoading.value = true
        try {
          const items = await searchWikidataEntities(searchTerm, locale.value, AUTOCOMPLETE_RESULT_LIMIT)
          const suggestions = Array.isArray(items) ? items : []
          const uniqueSuggestions = []
          const seen = new Set()
          for (const suggestion of suggestions) {
            const normalizedSuggestion = _saveImageDepictFromWikidataSuggestion(suggestion)
            if (!normalizedSuggestion) {
              continue
            }
            const dedupeKey = normalizedSuggestion.id.toLowerCase()
            if (seen.has(dedupeKey)) {
              continue
            }
            seen.add(dedupeKey)
            uniqueSuggestions.push(normalizedSuggestion)
          }
          saveImageSubjectWikidataSuggestions.value = uniqueSuggestions
        } catch (error) {
          saveImageSubjectWikidataSuggestions.value = []
        } finally {
          saveImageSubjectWikidataLoading.value = false
        }
      }, 250)

      function onSaveImageSubjectWikidataInput() {
        saveImageSubjectSelectionError.value = ''
        const query = saveImageSubjectWikidataSearch.value.trim()
        saveImageSubjectSelectedWikidataItem.value = null
        if (!query) {
          saveImageSubjectWikidataSuggestions.value = []
          saveImageSubjectWikidataLoading.value = false
          return
        }
        searchSaveImageSubjectWikidataDebounced(query)
      }

      function onSaveImageSubjectWikidataFocus() {
        if (saveImageSubjectWikidataSearch.value.trim()) {
          onSaveImageSubjectWikidataInput()
        }
      }

      function hideSaveImageSubjectWikidataSuggestionsSoon() {
        window.setTimeout(() => {
          saveImageSubjectWikidataSuggestions.value = []
        }, 140)
      }

      function onSaveImageSubjectWikidataKeydown(event) {
        if (!event || event.key !== 'Enter') {
          return
        }
        event.preventDefault()
        addSaveImageSubjectLink()
      }

      function selectSaveImageSubjectWikidataSuggestion(item) {
        const selectedItem = _setSaveImageSubjectWikidataSelection(item)
        if (!selectedItem) {
          return
        }
        const qid = selectedItem.id
        if (!saveImageSelectedSubjectMapFeature.value) {
          saveImageSubjectDirectWikidataItem.value = selectedItem
        }
        saveImageSubjectWikidataSearch.value = saveImageDepictDisplayLabel(selectedItem)
        saveImageSubjectWikidataSuggestions.value = []
        saveImageSubjectWikidataLoading.value = false
      }

      function isSaveImageSubjectWikidataSuggestionSelected(item) {
        const candidateQid = extractWikidataId(
          String(
            item && typeof item === 'object'
              ? (item.id || item.qid || '')
              : '',
          ),
        )
        if (!candidateQid) {
          return false
        }
        return candidateQid === saveImageSubjectSelectedWikidataQid.value
      }

      function selectSaveImageSubjectDirectWikidataSuggestion(item, { resetPointPair = true } = {}) {
        const normalizedItem = _normalizeSaveImageDepictItem(item)
        if (!normalizedItem) {
          return
        }
        const hadSelectedFeature = saveImageSubjectHasActiveSelection.value
        if (!hadSelectedFeature && saveImageSubjectMapInstance) {
          const viewCenter = saveImageSubjectMapInstance.getCenter()
          const viewZoom = saveImageSubjectMapInstance.getZoom()
          if (
            viewCenter &&
            Number.isFinite(Number(viewCenter.lat)) &&
            Number.isFinite(Number(viewCenter.lng)) &&
            Number.isFinite(Number(viewZoom))
          ) {
            saveImageSubjectMapListViewBeforeSelection = {
              lat: Number(viewCenter.lat),
              lng: Number(viewCenter.lng),
              zoom: Number(viewZoom),
            }
          } else {
            saveImageSubjectMapListViewBeforeSelection = null
          }
        }
        if (resetPointPair) {
          saveImageSubjectMapLatitude.value = ''
          saveImageSubjectMapLongitude.value = ''
          saveImageSubjectImageXPercent.value = null
          saveImageSubjectImageYPercent.value = null
          _clearSaveImageSubjectMapMarker()
        }
        saveImageSubjectSelectionError.value = ''
        saveImageSubjectSelectedMapFeatureKey.value = ''
        saveImageSubjectHoveredMapFeatureKey.value = ''
        _clearSaveImageSubjectMapFeatureLayers()
        _clearSaveImageSubjectSelectedFeatureWikidataSuggestions()
        const selectedItem = _setSaveImageSubjectWikidataSelection(normalizedItem)
        if (!selectedItem) {
          return
        }
        saveImageSubjectDirectWikidataItem.value = selectedItem
        saveImageSubjectWikidataSearch.value = saveImageDepictDisplayLabel(selectedItem)
        saveImageSubjectWikidataSuggestions.value = []
        saveImageSubjectWikidataLoading.value = false
        _renderSaveImageSubjectLinkedMarkers()
      }

      function clearSaveImageSubjectWikidataSelection() {
        saveImageSubjectSelectionError.value = ''
        saveImageSubjectSelectedWikidataItem.value = null
        saveImageSubjectWikidataSearch.value = ''
        saveImageSubjectWikidataSuggestions.value = []
        saveImageSubjectWikidataLoading.value = false
        if (!saveImageSelectedSubjectMapFeature.value) {
          saveImageSubjectDirectWikidataItem.value = null
        }
      }

      function addSaveImageSubjectLink() {
        saveImageSubjectSelectionError.value = ''
        if (!saveImageSubjectTypeLocationRelevant.value) {
          return
        }
        const requiresMapPoint = saveImageSubjectLinkUsesMap.value
        const mapLatitude = parseCoordinate(saveImageSubjectMapLatitude.value)
        const mapLongitude = parseCoordinate(saveImageSubjectMapLongitude.value)
        if (requiresMapPoint && (mapLatitude === null || mapLongitude === null)) {
          saveImageSubjectSelectionError.value = t('saveImageSubjectMapPointRequired')
          return
        }
        if (!saveImageSubjectImageHasPoint.value) {
          saveImageSubjectSelectionError.value = t('saveImageSubjectImagePointRequired')
          return
        }
        const selectedItem = saveImageSubjectSelectedWikidataItem.value
        const selectedQid = extractWikidataId(
          String(selectedItem && selectedItem.id ? selectedItem.id : saveImageSubjectWikidataSearch.value)
        )
        if (!selectedQid) {
          saveImageSubjectSelectionError.value = t('saveImageSubjectWikidataRequired')
          return
        }
        const selectedLabel = selectedItem && typeof selectedItem.label === 'string'
          ? selectedItem.label.trim()
          : ''
        const selectedDescription = selectedItem && typeof selectedItem.description === 'string'
          ? selectedItem.description.trim()
          : ''
        _addSaveImageDepict({ id: selectedQid, label: selectedLabel, description: selectedDescription })

        const imageX = Number(saveImageSubjectImageXPercent.value)
        const imageY = Number(saveImageSubjectImageYPercent.value)
        const selectedMapFeature = saveImageSelectedSubjectMapFeature.value
        const selectedMapFeatureKey = selectedMapFeature && typeof selectedMapFeature.key === 'string'
          ? selectedMapFeature.key.trim()
          : ''
        const selectedMapFeatureType = selectedMapFeature && typeof selectedMapFeature.type === 'string'
          ? selectedMapFeature.type.trim()
          : ''
        const selectedMapFeatureId = selectedMapFeature && Number.isFinite(Number(selectedMapFeature.id))
          ? Number.parseInt(String(selectedMapFeature.id), 10)
          : null
        const selectedMapFeatureLabel = selectedMapFeature && typeof selectedMapFeature.displayLabel === 'string'
          ? selectedMapFeature.displayLabel.trim()
          : ''
        const mapDedupPart = requiresMapPoint && mapLatitude !== null && mapLongitude !== null
          ? `${mapLatitude.toFixed(6)},${mapLongitude.toFixed(6)}`
          : 'no-map'
        const dedupeKey = [
          selectedQid.toLowerCase(),
          mapDedupPart,
          imageX.toFixed(3),
          imageY.toFixed(3),
        ].join('|')
        const hasDuplicate = saveImageLinkedSubjects.value.some((entry) => (
          entry &&
          typeof entry === 'object' &&
          String(entry.dedupeKey || '').toLowerCase() === dedupeKey
        ))
        let linkedSubjectAdded = false
        if (!hasDuplicate) {
          saveImageLinkedSubjects.value = [
            ...saveImageLinkedSubjects.value,
            {
              dedupeKey,
              id: selectedQid,
              label: selectedLabel,
              map_latitude: requiresMapPoint ? mapLatitude : null,
              map_longitude: requiresMapPoint ? mapLongitude : null,
              image_x_percent: imageX,
              image_y_percent: imageY,
              osm_feature_key: requiresMapPoint ? selectedMapFeatureKey : '',
              osm_feature_type: requiresMapPoint ? selectedMapFeatureType : '',
              osm_feature_id: requiresMapPoint ? selectedMapFeatureId : null,
              osm_feature_label: requiresMapPoint ? selectedMapFeatureLabel : '',
            },
          ]
          linkedSubjectAdded = true
        }
        saveImageSubjectWikidataSearch.value = saveImageDepictDisplayLabel({
          id: selectedQid,
          label: selectedLabel,
          description: selectedDescription,
        })
        saveImageSubjectWikidataSuggestions.value = []
        if (linkedSubjectAdded) {
          refreshSaveImageNearbyCategorySuggestionsDebounced()
          if (requiresMapPoint) {
            showSaveImageSubjectNearbyFeatureList()
            return
          }
          clearSaveImageSubjectWikidataSelection()
          saveImageSubjectImageXPercent.value = null
          saveImageSubjectImageYPercent.value = null
          return
        }
        _renderSaveImageSubjectLinkedMarkers()
      }

      function selectSaveImageSubjectFeatureWikidataSuggestion(item) {
        selectSaveImageSubjectWikidataSuggestion(item)
      }

      function formatSaveImageLinkedSubjectCoordinates(item) {
        if (!item || typeof item !== 'object') {
          return t('noValue')
        }
        return formatCoordinatePair(
          item.map_latitude,
          item.map_longitude,
          locale.value,
          6,
          t('noValue'),
        )
      }

      function formatSaveImageLinkedSubjectImagePoint(item) {
        if (!item || typeof item !== 'object') {
          return t('noValue')
        }
        const x = Number(item.image_x_percent)
        const y = Number(item.image_y_percent)
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return t('noValue')
        }
        const numberFormat = new Intl.NumberFormat(locale.value, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
        return `${numberFormat.format(Math.max(0, Math.min(100, x)))}%, ${numberFormat.format(Math.max(0, Math.min(100, y)))}%`
      }

      function removeSaveImageLinkedSubject(item) {
        if (!item || typeof item !== 'object') {
          return
        }
        const removeKey = typeof item.dedupeKey === 'string' ? item.dedupeKey : ''
        const removeId = extractWikidataId(String(item.id || ''))
        saveImageLinkedSubjects.value = saveImageLinkedSubjects.value.filter((entry) => {
          if (!entry || typeof entry !== 'object') {
            return false
          }
          if (removeKey && String(entry.dedupeKey || '') === removeKey) {
            return false
          }
          if (!removeKey && removeId && extractWikidataId(String(entry.id || '')) === removeId) {
            return false
          }
          return true
        })
        saveImageSubjectSelectionError.value = ''
        _renderSaveImageSubjectLinkedMarkers()
        refreshSaveImageNearbyCategorySuggestionsDebounced()
      }

      function _normalizeUploadCategory(value) {
        return normalizeCommonsCategoryName(value)
      }

      function _normalizeSaveImageDepictItem(item) {
        if (!item || typeof item !== 'object') {
          return null
        }
        const qid = extractWikidataId(String(item.id || item.qid || item.value || ''))
        if (!qid) {
          return null
        }
        const label = typeof item.label === 'string' ? item.label.trim() : ''
        const description = typeof item.description === 'string' ? item.description.trim() : ''
        return {
          id: qid,
          label,
          description,
        }
      }

      function saveImageDepictDisplayLabel(item) {
        const normalizedItem = _normalizeSaveImageDepictItem(item)
        if (!normalizedItem) {
          return ''
        }
        if (normalizedItem.label && normalizedItem.label.toLowerCase() !== normalizedItem.id.toLowerCase()) {
          return `${normalizedItem.label} (${normalizedItem.id})`
        }
        return normalizedItem.id
      }

      function saveImageDepictHref(item) {
        const normalizedItem = _normalizeSaveImageDepictItem(item)
        if (!normalizedItem) {
          return ''
        }
        return `https://www.wikidata.org/wiki/${encodeURIComponent(normalizedItem.id)}`
      }

      function _coordinatesFromLocation() {
        if (!location.value || typeof location.value !== 'object') {
          return null
        }
        const latitude = parseCoordinate(location.value.latitude)
        const longitude = parseCoordinate(location.value.longitude)
        if (latitude === null || longitude === null) {
          return null
        }
        return { latitude, longitude }
      }

      function _locationWikidataQid() {
        if (!location.value || typeof location.value !== 'object') {
          return ''
        }
        const fromItem = extractWikidataId(String(location.value.wikidata_item || ''))
        if (fromItem) {
          return fromItem
        }
        return extractWikidataId(String(location.value.uri || ''))
      }

      function _geographicQidsFromLocationFields() {
        if (!location.value || typeof location.value !== 'object') {
          return []
        }

        const qids = []
        const seen = new Set()
        const addQid = (candidateValue) => {
          const qid = extractWikidataId(String(candidateValue || ''))
          if (!qid) {
            return
          }
          if (seen.has(qid)) {
            return
          }
          seen.add(qid)
          qids.push(qid)
        }

        const directValue = location.value.location_p706
        if (Array.isArray(directValue)) {
          for (const entry of directValue) {
            if (entry && typeof entry === 'object') {
              addQid(entry.id || entry.value || entry.uri)
            } else {
              addQid(entry)
            }
          }
        } else {
          addQid(directValue)
        }

        const geographicEntities = location.value.geographic_entities
        if (Array.isArray(geographicEntities)) {
          for (const entry of geographicEntities) {
            if (entry && typeof entry === 'object') {
              addQid(entry.id || entry.value || entry.uri)
            } else {
              addQid(entry)
            }
          }
        }

        return qids
      }

      function _entityMunicipalityQid(entity) {
        if (!entity || typeof entity !== 'object') {
          return ''
        }
        const municipalityValue =
          entity.municipality && typeof entity.municipality === 'object'
            ? entity.municipality.id
            : ''
        return extractWikidataId(String(municipalityValue || ''))
      }

      async function _fetchWikidataEntityForFallback(qid) {
        const normalizedQid = extractWikidataId(String(qid || ''))
        if (!normalizedQid) {
          return null
        }

        const cacheKey = `${normalizedQid}|${normalizeSupportedLocale(locale.value) || 'en'}`
        if (saveImageFallbackEntityCache.has(cacheKey)) {
          return saveImageFallbackEntityCache.get(cacheKey)
        }

        const requestPromise = (async () => {
          try {
            const payload = await fetchWikidataEntity(normalizedQid, locale.value)
            return payload && typeof payload === 'object' ? payload : null
          } catch (error) {
            return null
          }
        })()
        saveImageFallbackEntityCache.set(cacheKey, requestPromise)
        return requestPromise
      }

      function _clearSaveImageHeadingMapVisuals() {
        if (!saveImageMapInstance) {
          saveImageMapHeadingLine = null
          _setSaveImageCameraHeadingCssVariable(null)
          return
        }
        if (saveImageMapHeadingLine) {
          saveImageMapInstance.removeLayer(saveImageMapHeadingLine)
          saveImageMapHeadingLine = null
        }
        _setSaveImageCameraHeadingCssVariable(null)
      }

      function _setSaveImageCameraHeadingCssVariableForElement(mapElement, headingDegrees) {
        if (!mapElement || !mapElement.style) {
          return
        }
        const normalizedHeading = normalizeHeadingDegrees(headingDegrees)
        const heading = normalizedHeading === null ? 0 : normalizedHeading
        mapElement.style.setProperty('--save-image-camera-heading', `${heading.toFixed(3)}deg`)
      }

      function _setSaveImageCameraHeadingCssVariable(headingDegrees) {
        _setSaveImageCameraHeadingCssVariableForElement(saveImageMapElement.value, headingDegrees)
      }

      function _setSaveImageCoordinatePreviewCameraHeadingCssVariable(headingDegrees) {
        _setSaveImageCameraHeadingCssVariableForElement(saveImageCoordinatePreviewMapElement.value, headingDegrees)
      }

      function _setSaveImageHeadingValue(normalizedHeading) {
        if (!Number.isFinite(normalizedHeading)) {
          return
        }
        saveImageHeading.value = Number(normalizedHeading).toFixed(1).replace(/\.0$/, '')
      }

      function _currentSaveImageHeadingDegrees() {
        return normalizeHeadingDegrees(saveImageHeading.value)
      }

      function _headingLinePointsForMapView(mapInstance, latitude, longitude, headingDegrees) {
        if (!mapInstance) {
          return null
        }
        const mapSize = mapInstance.getSize ? mapInstance.getSize() : null
        if (!mapSize || !Number.isFinite(mapSize.x) || !Number.isFinite(mapSize.y) || mapSize.x <= 0 || mapSize.y <= 0) {
          return null
        }
        const centerContainerPoint = mapInstance.latLngToContainerPoint(L.latLng(latitude, longitude))
        if (
          !centerContainerPoint ||
          !Number.isFinite(centerContainerPoint.x) ||
          !Number.isFinite(centerContainerPoint.y)
        ) {
          return null
        }

        const headingRadians = (headingDegrees * Math.PI) / 180
        const directionX = Math.sin(headingRadians)
        const directionY = -Math.cos(headingRadians)
        const epsilon = 0.0000001
        if (Math.abs(directionX) <= epsilon && Math.abs(directionY) <= epsilon) {
          return null
        }

        const cameraCircleRadiusPx = 12
        const lineStartContainerPoint = L.point(
          centerContainerPoint.x + directionX * cameraCircleRadiusPx,
          centerContainerPoint.y + directionY * cameraCircleRadiusPx,
        )
        const lineStartLatLng = mapInstance.containerPointToLatLng(lineStartContainerPoint)
        if (!lineStartLatLng) {
          return null
        }

        const edgeDistances = []
        if (directionX > epsilon) {
          edgeDistances.push((mapSize.x - centerContainerPoint.x) / directionX)
        } else if (directionX < -epsilon) {
          edgeDistances.push((0 - centerContainerPoint.x) / directionX)
        }
        if (directionY > epsilon) {
          edgeDistances.push((mapSize.y - centerContainerPoint.y) / directionY)
        } else if (directionY < -epsilon) {
          edgeDistances.push((0 - centerContainerPoint.y) / directionY)
        }
        const positiveEdgeDistances = edgeDistances.filter((value) => Number.isFinite(value) && value > 0)
        if (!positiveEdgeDistances.length) {
          return null
        }
        const distanceToEdgePx = Math.min(...positiveEdgeDistances)
        const extensionPx = Math.max(48, Math.min(mapSize.x, mapSize.y) * 0.12)
        const lineLengthPx = distanceToEdgePx + extensionPx
        const lineTargetContainerPoint = L.point(
          centerContainerPoint.x + directionX * lineLengthPx,
          centerContainerPoint.y + directionY * lineLengthPx,
        )
        const lineTargetLatLng = mapInstance.containerPointToLatLng(lineTargetContainerPoint)
        if (!lineTargetLatLng) {
          return null
        }
        return {
          fromLatitude: Number(lineStartLatLng.lat),
          fromLongitude: Number(lineStartLatLng.lng),
          toLatitude: Number(lineTargetLatLng.lat),
          toLongitude: Number(lineTargetLatLng.lng),
        }
      }

      function _updateSaveImageHeadingMapVisuals() {
        if (!saveImageMapInstance) {
          return
        }
        if (showSaveImageCoordinatePickerDialog.value && !saveImageApiUsesPhotographerCoordinates.value) {
          _clearSaveImageHeadingMapVisuals()
          return
        }

        const latitude = parseCoordinate(saveImageLatitude.value)
        const longitude = parseCoordinate(saveImageLongitude.value)
        if (latitude === null || longitude === null) {
          _clearSaveImageHeadingMapVisuals()
          return
        }

        let heading = _currentSaveImageHeadingDegrees()
        if (heading === null) {
          _clearSaveImageHeadingMapVisuals()
          return
        }
        const headingLinePoints = _headingLinePointsForMapView(saveImageMapInstance, latitude, longitude, heading)
        if (!headingLinePoints) {
          _clearSaveImageHeadingMapVisuals()
          return
        }
        const fromPoint = [headingLinePoints.fromLatitude, headingLinePoints.fromLongitude]
        const toPoint = [headingLinePoints.toLatitude, headingLinePoints.toLongitude]
        _setSaveImageCameraHeadingCssVariable(heading)

        if (!saveImageMapHeadingLine) {
          saveImageMapHeadingLine = L.polyline([fromPoint, toPoint], {
            color: '#b45309',
            weight: 3,
            opacity: 0.9,
            dashArray: '6 6',
          }).addTo(saveImageMapInstance)
        } else {
          saveImageMapHeadingLine.setLatLngs([fromPoint, toPoint])
        }
      }

      function _setSaveImageHeading(value) {
        const normalizedHeading = normalizeHeadingDegrees(value)
        if (normalizedHeading === null) {
          saveImageHeading.value = ''
          _clearSaveImageHeadingMapVisuals()
          return
        }
        _setSaveImageHeadingValue(normalizedHeading)
        _updateSaveImageHeadingMapVisuals()
      }

      function _setSaveImageHeadingFromMapClick(latitude, longitude) {
        const centerPoint = saveImageMapInstance ? saveImageMapInstance.getCenter() : null
        const baseLatitude = centerPoint ? Number(centerPoint.lat) : parseCoordinate(saveImageLatitude.value)
        const baseLongitude = centerPoint ? Number(centerPoint.lng) : parseCoordinate(saveImageLongitude.value)
        if (!Number.isFinite(baseLatitude) || !Number.isFinite(baseLongitude)) {
          return
        }
        const heading = bearingBetweenCoordinates(baseLatitude, baseLongitude, latitude, longitude)
        if (heading === null) {
          return
        }
        _setSaveImageHeading(heading)
      }

      function _setSaveImageCoordinates(latitude, longitude, updateMapView = true) {
        const parsedLatitude = Number(latitude)
        const parsedLongitude = Number(longitude)
        if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
          return
        }

        saveImageLatitude.value = parsedLatitude.toFixed(6)
        saveImageLongitude.value = parsedLongitude.toFixed(6)

        if (!saveImageMapInstance) {
          return
        }

        const point = [parsedLatitude, parsedLongitude]
        if (showSaveImageCoordinatePickerDialog.value) {
          if (saveImageMapMarker) {
            saveImageMapInstance.removeLayer(saveImageMapMarker)
            saveImageMapMarker = null
          }
          if (updateMapView) {
            saveImageMapInstance.setView(point, Math.max(saveImageMapInstance.getZoom(), 13))
          }
          _updateSaveImageHeadingMapVisuals()
          return
        }

        if (!saveImageMapMarker) {
          saveImageMapMarker = L.marker(point).addTo(saveImageMapInstance)
        } else {
          saveImageMapMarker.setLatLng(point)
        }

        if (updateMapView) {
          saveImageMapInstance.setView(point, Math.max(saveImageMapInstance.getZoom(), 13))
        }
        _updateSaveImageHeadingMapVisuals()
      }

      function _syncSaveImageCoordinatesFromMapCenter() {
        if (!saveImageMapInstance || !showSaveImageCoordinatePickerDialog.value) {
          return
        }
        const centerPoint = saveImageMapInstance.getCenter()
        if (!centerPoint) {
          return
        }
        saveImageLatitude.value = Number(centerPoint.lat).toFixed(6)
        saveImageLongitude.value = Number(centerPoint.lng).toFixed(6)
        if (saveImageMapMarker) {
          saveImageMapInstance.removeLayer(saveImageMapMarker)
          saveImageMapMarker = null
        }
        _updateSaveImageHeadingMapVisuals()
      }

      function onSaveImageApiCoordinateModeChange() {
        const normalizedMode = saveImageApiCoordinateMode.value === 'image' ? 'image' : 'photographer'
        saveImageApiCoordinateMode.value = normalizedMode
        if (showSaveImageCoordinatePickerDialog.value) {
          _syncSaveImageCoordinatesFromMapCenter()
        }
        if (normalizedMode === 'photographer') {
          _updateSaveImageHeadingMapVisuals()
        }
      }

      function setSaveImageApiCoordinateMode(mode) {
        const normalizedMode = mode === 'image' ? 'image' : 'photographer'
        if (saveImageApiCoordinateMode.value !== normalizedMode) {
          saveImageApiCoordinateMode.value = normalizedMode
        }
        onSaveImageApiCoordinateModeChange()
      }

      function onSaveImageMapCenterIconClick(event) {
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault()
        }
        if (event && typeof event.stopPropagation === 'function') {
          event.stopPropagation()
        }
        const nextMode = saveImageApiUsesPhotographerCoordinates.value ? 'image' : 'photographer'
        setSaveImageApiCoordinateMode(nextMode)
      }

      function resetSaveImageCoordinatesToExif() {
        if (!saveImageHasExifCoordinates.value) {
          return
        }
        _setSaveImageCoordinates(saveImageExifLatitude.value, saveImageExifLongitude.value)
      }

      function resetSaveImageCoordinatesToWikidata() {
        if (!saveImageHasInitialWikidataCoordinates.value) {
          return
        }
        _setSaveImageCoordinates(saveImageInitialWikidataLatitude.value, saveImageInitialWikidataLongitude.value)
      }

      function onSaveImageOwnPhotoChange() {
        _syncSaveImageAuthorFromOwnershipSelection()
      }

      function ensureSaveImageWizardMap() {
        if (!showSaveImageCoordinatePickerDialog.value || !saveImageMapElement.value) {
          destroySaveImageWizardMap()
          return
        }

        const latitude = parseCoordinate(saveImageLatitude.value)
        const longitude = parseCoordinate(saveImageLongitude.value)
        const hasSelectedCoordinates = latitude !== null && longitude !== null
        const initialCoordinates = _coordinatesFromLocation()
        const fallbackCenter = initialCoordinates
          ? [initialCoordinates.latitude, initialCoordinates.longitude]
          : [60.1699, 24.9384]
        const center = hasSelectedCoordinates ? [latitude, longitude] : fallbackCenter
        const initialZoom = Number.isFinite(saveImageCoordinatePickerLastZoom)
          ? saveImageCoordinatePickerLastZoom
          : (hasSelectedCoordinates ? 13 : 6)

        if (!saveImageMapInstance) {
          saveImageMapInstance = L.map(saveImageMapElement.value, {
            scrollWheelZoom: 'center',
            doubleClickZoom: 'center',
            touchZoom: 'center',
          }).setView(center, initialZoom)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(saveImageMapInstance)

          saveImageMapInstance.on('click', (event) => {
            if (showSaveImageCoordinatePickerDialog.value) {
              if (saveImageApiUsesPhotographerCoordinates.value) {
                const clickedLatitude = event.latlng.lat
                const clickedLongitude = event.latlng.lng
                _armSaveImageHeadingDoubleClickFallback()
                if (saveImageMapHeadingClickTimeout !== null) {
                  window.clearTimeout(saveImageMapHeadingClickTimeout)
                  saveImageMapHeadingClickTimeout = null
                }
                saveImageMapHeadingClickTimeout = window.setTimeout(() => {
                  saveImageMapHeadingClickTimeout = null
                  if (!showSaveImageCoordinatePickerDialog.value || !saveImageApiUsesPhotographerCoordinates.value) {
                    return
                  }
                  _setSaveImageHeadingFromMapClick(clickedLatitude, clickedLongitude)
                }, 200)
              }
              return
            }
            _setSaveImageCoordinates(event.latlng.lat, event.latlng.lng)
          })
          saveImageMapInstance.on('dblclick', () => {
            if (saveImageMapHeadingFallbackActive) {
              if (saveImageMapHeadingBeforeDoubleClick === null) {
                _setSaveImageHeading('')
              } else {
                _setSaveImageHeading(saveImageMapHeadingBeforeDoubleClick)
              }
            }
            _clearSaveImageHeadingDoubleClickTracking()
          })
          saveImageMapInstance.on('move', () => {
            if (showSaveImageCoordinatePickerDialog.value) {
              _syncSaveImageCoordinatesFromMapCenter()
            }
          })
          saveImageMapInstance.on('zoom', () => {
            if (showSaveImageCoordinatePickerDialog.value) {
              const currentZoom = Number(saveImageMapInstance.getZoom())
              if (Number.isFinite(currentZoom)) {
                saveImageCoordinatePickerLastZoom = currentZoom
              }
              _syncSaveImageCoordinatesFromMapCenter()
            }
          })
        }

        if (hasSelectedCoordinates) {
          _setSaveImageCoordinates(latitude, longitude, false)
          if (showSaveImageCoordinatePickerDialog.value) {
            const mapCenter = saveImageMapInstance.getCenter()
            const centerMatches = mapCenter && (
              Math.abs(mapCenter.lat - latitude) < 0.000001 &&
              Math.abs(mapCenter.lng - longitude) < 0.000001
            )
            if (!centerMatches) {
              saveImageMapInstance.setView(center, Math.max(saveImageMapInstance.getZoom(), 13))
            }
            _syncSaveImageCoordinatesFromMapCenter()
          } else {
            saveImageMapInstance.setView(center, Math.max(saveImageMapInstance.getZoom(), 13))
          }
        } else if (saveImageMapMarker) {
          saveImageMapInstance.removeLayer(saveImageMapMarker)
          saveImageMapMarker = null
          saveImageMapInstance.setView(center, saveImageMapInstance.getZoom())
          if (showSaveImageCoordinatePickerDialog.value) {
            _syncSaveImageCoordinatesFromMapCenter()
          } else {
            _clearSaveImageHeadingMapVisuals()
          }
        } else {
          if (showSaveImageCoordinatePickerDialog.value) {
            _syncSaveImageCoordinatesFromMapCenter()
          } else {
            _clearSaveImageHeadingMapVisuals()
          }
        }

        window.setTimeout(() => {
          if (saveImageMapInstance) {
            saveImageMapInstance.invalidateSize()
          }
        }, 0)
      }

      function _initializeSaveImageWizard() {
        const currentFallbackToken = ++saveImageFallbackToken
        saveImageError.value = ''
        saveImageUploadResult.value = null
        saveImageApiUploading.value = false
        saveImageHeading.value = ''
        saveImageApiCoordinateMode.value = 'photographer'
        saveImageSubjectType.value = ''
        saveImageSubjectLinkMode.value = 'map'
        saveImageSubjectMapLatitude.value = ''
        saveImageSubjectMapLongitude.value = ''
        saveImageSubjectImageXPercent.value = null
        saveImageSubjectImageYPercent.value = null
        saveImageSubjectWikidataSearch.value = ''
        saveImageSubjectWikidataSuggestions.value = []
        saveImageSubjectWikidataLoading.value = false
        _clearSaveImageSubjectMapFeatures()
        saveImageSubjectSelectedWikidataItem.value = null
        saveImageSubjectSelectionError.value = ''
        saveImageLinkedSubjects.value = []
        destroySaveImageSubjectMap()
        saveImageCategorySearch.value = ''
        saveImageCategorySuggestions.value = []
        saveImageCategoryLoading.value = false
        saveImageNearbyCategorySuggestions.value = []
        saveImageNearbyCategoryLoading.value = false
        saveImageNearbyCategoryToken += 1
        saveImageDepictSearch.value = ''
        saveImageDepictSuggestions.value = []
        saveImageDepictLoading.value = false
        saveImageNearbyDepictSuggestions.value = []
        saveImageNearbyDepictLoading.value = false
        saveImageNearbyDepictToken += 1
        saveImageSubcategorySuggestions.value = []
        saveImageSubcategoryFarSuggestions.value = []
        saveImageSubcategoryLoading.value = false
        saveImageSubcategoryToken += 1
        _clearSaveImageSelectedCategoryAncestors()
        saveImageSelectedCategories.value = []
        saveImageSelectedDepicts.value = []
        const primaryWikidataQid = _locationWikidataQid()
        if (primaryWikidataQid) {
          const primaryLabel =
            location.value && typeof location.value === 'object' && typeof location.value.name === 'string'
              ? location.value.name.trim()
              : ''
          saveImageSelectedDepicts.value = [
            {
              id: primaryWikidataQid,
              label: primaryLabel,
              description: '',
            },
          ]
        }
        saveImageCategoryExistence.value = {}
        saveImageCategoryExistenceRequestCache.clear()
        saveImageSelectedFile.value = null
        saveImageExifReadToken += 1
        saveImageExifMetadataLoading.value = false
        saveImageExifDateTaken.value = ''
        saveImageExifLatitude.value = null
        saveImageExifLongitude.value = null
        saveImageExifHeading.value = null
        saveImageExifElevation.value = null
        saveImageInitialWikidataLatitude.value = null
        saveImageInitialWikidataLongitude.value = null
        saveImageApiTargetFilename.value = ''
        saveImageApiTargetFilenameTouched.value = false
        _resetSaveImageApiTargetFilenameAvailability()
        saveImageFilenameBuilderUseSubjects.value = true
        saveImageFilenameBuilderUseDate.value = true
        saveImageFilenameBuilderUseLocation.value = true
        saveImageFilenameBuilderUseCategories.value = true
        saveImageIsOwnPhoto.value = true
        saveImageApiAuthor.value = ''
        saveImageApiSourceUrl.value = ''
        saveImageApiDateCreated.value = ''
        saveImageApiLicenseTemplate.value = 'Cc-by-sa-4.0'
        saveImageApiElevationMeters.value = ''
        saveImageElevationFromExif.value = false
        saveImageIncludeElevation.value = false
        saveImageCaptionLanguage.value = _normalizeSaveImageMetadataLanguage(locale.value)
        saveImageDescription.value = ''
        saveImageDescriptionLanguage.value = _normalizeSaveImageMetadataLanguage(locale.value)
        _syncSaveImageAuthorFromOwnershipSelection()
        if (saveImageFileInputElement.value) {
          saveImageFileInputElement.value.value = ''
        }

        const locationCoordinates = _coordinatesFromLocation()
        if (locationCoordinates) {
          saveImageLatitude.value = locationCoordinates.latitude.toFixed(6)
          saveImageLongitude.value = locationCoordinates.longitude.toFixed(6)
          saveImageInitialWikidataLatitude.value = locationCoordinates.latitude
          saveImageInitialWikidataLongitude.value = locationCoordinates.longitude
        } else {
          saveImageLatitude.value = ''
          saveImageLongitude.value = ''
          saveImageInitialWikidataLatitude.value = null
          saveImageInitialWikidataLongitude.value = null
        }

        saveImageCaption.value = location.value ? locationDisplayName(location.value) : ''
        const rawCommonsCategory =
          location.value && typeof location.value === 'object'
            ? String(location.value.commons_category || '')
            : ''
        let hasOwnCategory = false
        for (const category of rawCommonsCategory.split(/[|,\n]/)) {
          const normalized = _normalizeUploadCategory(category)
          if (!normalized) {
            continue
          }
          hasOwnCategory = true
          _addSaveImageCategory(normalized)
        }

        if (!hasOwnCategory) {
          void _loadSaveImageFallbackCategories(currentFallbackToken)
        }

        _applySuggestedSaveImageTargetFilenameIfAllowed({ force: true })
      }

      function displayUploadCategory(categoryName) {
        const normalized = _normalizeUploadCategory(categoryName)
        if (!normalized) {
          return ''
        }
        return normalized.replace(/_/g, ' ')
      }

      function saveImageCategoryHref(categoryName) {
        const normalized = _normalizeUploadCategory(categoryName)
        if (!normalized) {
          return ''
        }
        return `https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(normalized)}`
      }

      function saveImageCategoryExists(categoryName) {
        const normalized = _normalizeUploadCategory(categoryName)
        if (!normalized) {
          return null
        }
        const dedupeKey = normalized.toLowerCase()
        const exists = saveImageCategoryExistence.value[dedupeKey]
        return typeof exists === 'boolean' ? exists : null
      }

      function _setSaveImageCategoryExists(categoryName, exists) {
        const normalized = _normalizeUploadCategory(categoryName)
        if (!normalized || typeof exists !== 'boolean') {
          return
        }
        const dedupeKey = normalized.toLowerCase()
        saveImageCategoryExistence.value = {
          ...saveImageCategoryExistence.value,
          [dedupeKey]: exists,
        }
      }

      function _isSaveImageCategorySelected(categoryName) {
        const normalized = _normalizeUploadCategory(categoryName)
        if (!normalized) {
          return false
        }
        const dedupeKey = normalized.toLowerCase()
        return saveImageSelectedCategories.value.some(
          (existingCategory) => String(existingCategory || '').toLowerCase() === dedupeKey,
        )
      }

      function _selectedSaveImageLinkedSubjectQids() {
        const qids = []
        const seenQids = new Set()
        for (const linkedItem of Array.isArray(saveImageLinkedSubjects.value) ? saveImageLinkedSubjects.value : []) {
          const qid = extractWikidataId(
            String(
              linkedItem && typeof linkedItem === 'object'
                ? linkedItem.id || ''
                : '',
            ),
          )
          if (!qid || seenQids.has(qid)) {
            continue
          }
          seenQids.add(qid)
          qids.push(qid)
          if (qids.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_QIDS) {
            break
          }
        }
        return qids
      }

      function _saveImageCategorySuggestionYear() {
        const rawDateValue = typeof saveImageApiDateCreated.value === 'string'
          ? saveImageApiDateCreated.value.trim()
          : ''
        if (!rawDateValue) {
          return ''
        }

        const parsedDate = parseWikidataDateParts(rawDateValue)
        if (parsedDate && Number.isFinite(parsedDate.year) && parsedDate.year >= 1) {
          return String(parsedDate.year)
        }

        const yearMatch = rawDateValue.match(/^([+-]?\d{1,6})/)
        if (!yearMatch || !yearMatch[1]) {
          return ''
        }
        const parsedYear = Number.parseInt(yearMatch[1], 10)
        if (!Number.isFinite(parsedYear) || parsedYear < 1) {
          return ''
        }
        return String(parsedYear)
      }

      function _saveImageCategorySuggestionLocationPlaceLabels() {
        if (!location.value || typeof location.value !== 'object') {
          return []
        }

        const labels = []
        const seenLabelKeys = new Set()
        const pushLabel = (rawLabel) => {
          const label = typeof rawLabel === 'string' ? rawLabel.trim() : ''
          if (!label) {
            return false
          }
          if (/^https?:\/\//i.test(label) || /^wd:Q\d+$/i.test(label)) {
            return false
          }
          const maybeQid = extractWikidataId(label)
          if (maybeQid && maybeQid.toLowerCase() === label.toLowerCase()) {
            return false
          }
          const dedupeKey = label.toLowerCase()
          if (seenLabelKeys.has(dedupeKey)) {
            return false
          }
          seenLabelKeys.add(dedupeKey)
          labels.push(label)
          return true
        }

        pushLabel(location.value.municipality_p131_label)
        pushLabel(location.value.location_p276_label)

        const locationP706 = location.value.location_p706
        if (Array.isArray(locationP706)) {
          for (const entry of locationP706) {
            if (entry && typeof entry === 'object') {
              pushLabel(entry.label || entry.name)
            } else {
              pushLabel(entry)
            }
            if (labels.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_PLACES) {
              break
            }
          }
        } else if (locationP706 && typeof locationP706 === 'object') {
          pushLabel(locationP706.label || locationP706.name)
        } else {
          pushLabel(locationP706)
        }

        const geographicEntities = Array.isArray(location.value.geographic_entities)
          ? location.value.geographic_entities
          : []
        for (const entry of geographicEntities) {
          if (entry && typeof entry === 'object') {
            pushLabel(entry.label || entry.name)
          } else {
            pushLabel(entry)
          }
          if (labels.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_PLACES) {
            break
          }
        }

        return labels.slice(0, SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_PLACES)
      }

      function _buildSaveImageSubjectCategorySuggestionCacheKey(subjectQids, yearValue, placeLabels = []) {
        const normalizedQids = []
        const seenQids = new Set()
        for (const rawQid of Array.isArray(subjectQids) ? subjectQids : []) {
          const qid = extractWikidataId(String(rawQid || ''))
          if (!qid || seenQids.has(qid)) {
            continue
          }
          seenQids.add(qid)
          normalizedQids.push(qid)
        }
        if (normalizedQids.length < 1) {
          return ''
        }
        normalizedQids.sort()
        const normalizedLocale = normalizeSupportedLocale(locale.value) || 'en'
        const normalizedYear = String(yearValue || '').trim() || '-'
        const normalizedPlaces = []
        const seenPlaces = new Set()
        for (const rawPlaceLabel of Array.isArray(placeLabels) ? placeLabels : []) {
          const normalizedPlaceLabel = String(rawPlaceLabel || '').trim()
          if (!normalizedPlaceLabel) {
            continue
          }
          const dedupeKey = normalizedPlaceLabel.toLowerCase()
          if (seenPlaces.has(dedupeKey)) {
            continue
          }
          seenPlaces.add(dedupeKey)
          normalizedPlaces.push(normalizedPlaceLabel)
        }
        normalizedPlaces.sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }))
        const normalizedPlaceSegment = normalizedPlaces.length > 0 ? normalizedPlaces.join('|') : '-'
        return `${normalizedLocale}|${normalizedYear}|${normalizedQids.join(',')}|${normalizedPlaceSegment}`
      }

      function _readSaveImageSubjectCategorySuggestionCache(cacheKey) {
        const normalizedKey = String(cacheKey || '').trim()
        if (!normalizedKey || !saveImageSubjectCategorySuggestionCache.has(normalizedKey)) {
          return null
        }
        const cached = saveImageSubjectCategorySuggestionCache.get(normalizedKey)
        if (!Array.isArray(cached)) {
          saveImageSubjectCategorySuggestionCache.delete(normalizedKey)
          return null
        }
        saveImageSubjectCategorySuggestionCache.delete(normalizedKey)
        saveImageSubjectCategorySuggestionCache.set(normalizedKey, cached)
        return cached.slice()
      }

      function _writeSaveImageSubjectCategorySuggestionCache(cacheKey, categories) {
        const normalizedKey = String(cacheKey || '').trim()
        if (!normalizedKey) {
          return
        }
        const normalizedCategories = []
        const seenKeys = new Set()
        for (const candidateCategory of Array.isArray(categories) ? categories : []) {
          const normalizedCategory = _normalizeUploadCategory(String(candidateCategory || ''))
          if (!normalizedCategory) {
            continue
          }
          const dedupeKey = normalizedCategory.toLowerCase()
          if (seenKeys.has(dedupeKey)) {
            continue
          }
          seenKeys.add(dedupeKey)
          normalizedCategories.push(normalizedCategory)
        }
        if (saveImageSubjectCategorySuggestionCache.has(normalizedKey)) {
          saveImageSubjectCategorySuggestionCache.delete(normalizedKey)
        }
        saveImageSubjectCategorySuggestionCache.set(normalizedKey, normalizedCategories)
        while (saveImageSubjectCategorySuggestionCache.size > SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_CACHE_MAX_ITEMS) {
          const oldestKey = saveImageSubjectCategorySuggestionCache.keys().next().value
          if (!oldestKey) {
            break
          }
          saveImageSubjectCategorySuggestionCache.delete(oldestKey)
        }
      }

      async function _loadSaveImageLinkedSubjectCategorySuggestions() {
        const selectedQids = _selectedSaveImageLinkedSubjectQids()
        if (selectedQids.length < 1) {
          return []
        }
        const suggestionYear = _saveImageCategorySuggestionYear()
        const locationPlaceLabels = _saveImageCategorySuggestionLocationPlaceLabels()
        const cacheKey = _buildSaveImageSubjectCategorySuggestionCacheKey(
          selectedQids,
          suggestionYear,
          locationPlaceLabels,
        )
        const cachedSuggestions = _readSaveImageSubjectCategorySuggestionCache(cacheKey)
        if (Array.isArray(cachedSuggestions)) {
          return cachedSuggestions
        }

        const contextPayload = await fetchWikidataCategoryContextForQids(selectedQids, {
          lang: locale.value,
        })
        const subjectCategories = []
        const seenSubjectCategoryKeys = new Set()
        for (const rawCategory of (
          contextPayload &&
          typeof contextPayload === 'object' &&
          Array.isArray(contextPayload.subjectCategories)
            ? contextPayload.subjectCategories
            : []
        )) {
          const normalizedCategory = _normalizeUploadCategory(String(rawCategory || ''))
          if (!normalizedCategory) {
            continue
          }
          const dedupeKey = normalizedCategory.toLowerCase()
          if (seenSubjectCategoryKeys.has(dedupeKey)) {
            continue
          }
          seenSubjectCategoryKeys.add(dedupeKey)
          subjectCategories.push(normalizedCategory)
          if (subjectCategories.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_P373) {
            break
          }
        }

        const placeLabels = []
        const seenPlaceLabelKeys = new Set()
        const pushPlaceLabel = (rawPlaceLabel) => {
          const placeLabel = String(rawPlaceLabel || '').trim()
          if (!placeLabel) {
            return false
          }
          const maybeQid = extractWikidataId(placeLabel)
          if (maybeQid && maybeQid.toLowerCase() === placeLabel.toLowerCase()) {
            return false
          }
          const dedupeKey = placeLabel.toLowerCase()
          if (seenPlaceLabelKeys.has(dedupeKey)) {
            return false
          }
          seenPlaceLabelKeys.add(dedupeKey)
          placeLabels.push(placeLabel)
          return true
        }
        for (const placeLabel of locationPlaceLabels) {
          pushPlaceLabel(placeLabel)
          if (placeLabels.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_PLACES) {
            break
          }
        }
        if (placeLabels.length < SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_PLACES) {
          for (const place of (
            contextPayload &&
            typeof contextPayload === 'object' &&
            Array.isArray(contextPayload.places)
              ? contextPayload.places
              : []
          )) {
            pushPlaceLabel(
              place && typeof place === 'object'
                ? place.label || ''
                : '',
            )
            if (placeLabels.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_PLACES) {
              break
            }
          }
        }

        const candidateCategories = []
        const seenCandidateKeys = new Set()
        const pushCandidateCategory = (rawCategory) => {
          if (candidateCategories.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_CANDIDATES) {
            return false
          }
          const normalizedCategory = _normalizeUploadCategory(String(rawCategory || ''))
          if (!normalizedCategory) {
            return false
          }
          const dedupeKey = normalizedCategory.toLowerCase()
          if (seenCandidateKeys.has(dedupeKey)) {
            return false
          }
          seenCandidateKeys.add(dedupeKey)
          candidateCategories.push(normalizedCategory)
          return true
        }

        if (suggestionYear) {
          for (const placeLabel of placeLabels) {
            pushCandidateCategory(`${suggestionYear} in ${placeLabel}`)
            if (candidateCategories.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_CANDIDATES) {
              break
            }
          }
        }

        for (const subjectCategory of subjectCategories) {
          const subjectCategoryDisplay = subjectCategory.replace(/_/g, ' ')
          for (const placeLabel of placeLabels) {
            pushCandidateCategory(`${subjectCategoryDisplay} in ${placeLabel}`)
            if (candidateCategories.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_CANDIDATES) {
              break
            }
          }
          if (candidateCategories.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_CANDIDATES) {
            break
          }
        }

        for (const subjectCategory of subjectCategories) {
          if (!pushCandidateCategory(subjectCategory)) {
            continue
          }
        }

        if (suggestionYear) {
          for (const subjectCategory of subjectCategories) {
            const subjectCategoryDisplay = subjectCategory.replace(/_/g, ' ')
            pushCandidateCategory(`${subjectCategoryDisplay} in ${suggestionYear}`)
            if (candidateCategories.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_CANDIDATES) {
              break
            }
            pushCandidateCategory(`${subjectCategoryDisplay} photographed in ${suggestionYear}`)
            if (candidateCategories.length >= SAVE_IMAGE_SUBJECT_CATEGORY_CONTEXT_MAX_CANDIDATES) {
              break
            }
          }
        }

        if (candidateCategories.length < 1) {
          _writeSaveImageSubjectCategorySuggestionCache(cacheKey, [])
          return []
        }

        const existenceByDedupeKey = await fetchCommonsCategoryExistenceMap(candidateCategories)
        const existingCategories = []
        for (const candidateCategory of candidateCategories) {
          const dedupeKey = candidateCategory.toLowerCase()
          if (existenceByDedupeKey.get(dedupeKey) !== true) {
            continue
          }
          existingCategories.push(candidateCategory)
        }
        if (SUBJECT_WIKIDATA_DEBUG_LOG_ENABLED) {
          console.log('[SUBJECT-CATEGORY-SUGGESTIONS-DEBUG]', {
            selectedQids,
            locationPlaceLabels,
            placeLabels,
            subjectCategories,
            candidateCategories,
            existingCategories,
          })
        }
        _writeSaveImageSubjectCategorySuggestionCache(cacheKey, existingCategories)
        return existingCategories
      }

      async function _fetchCommonsCategoryExists(categoryName) {
        const normalized = _normalizeUploadCategory(categoryName)
        if (!normalized) {
          return false
        }

        const url = new URL('https://commons.wikimedia.org/w/api.php')
        url.searchParams.set('action', 'query')
        url.searchParams.set('titles', `Category:${normalized}`)
        url.searchParams.set('format', 'json')
        url.searchParams.set('formatversion', '2')
        url.searchParams.set('origin', '*')

        const response = await fetch(url.toString(), { method: 'GET' })
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        if (payload && typeof payload === 'object' && payload.error && payload.error.info) {
          throw new Error(String(payload.error.info))
        }

        const pages =
          payload &&
          typeof payload === 'object' &&
          payload.query &&
          typeof payload.query === 'object' &&
          Array.isArray(payload.query.pages)
            ? payload.query.pages
            : []
        const page = pages.length > 0 && pages[0] && typeof pages[0] === 'object' ? pages[0] : null
        if (!page) {
          return false
        }
        return !Object.prototype.hasOwnProperty.call(page, 'missing')
      }

      async function _ensureSaveImageCategoryExists(categoryName) {
        const normalized = _normalizeUploadCategory(categoryName)
        if (!normalized) {
          return null
        }

        const dedupeKey = normalized.toLowerCase()
        const known = saveImageCategoryExistence.value[dedupeKey]
        if (typeof known === 'boolean') {
          return known
        }

        if (saveImageCategoryExistenceRequestCache.has(dedupeKey)) {
          return saveImageCategoryExistenceRequestCache.get(dedupeKey)
        }

        const requestPromise = (async () => {
          try {
            const exists = await _fetchCommonsCategoryExists(normalized)
            if (_isSaveImageCategorySelected(normalized)) {
              _setSaveImageCategoryExists(normalized, exists)
            }
            return exists
          } catch (error) {
            return null
          } finally {
            saveImageCategoryExistenceRequestCache.delete(dedupeKey)
          }
        })()
        saveImageCategoryExistenceRequestCache.set(dedupeKey, requestPromise)
        return requestPromise
      }

      function _refreshSaveImageCategoryExistenceState() {
        const selectedCategories = Array.isArray(saveImageSelectedCategories.value)
          ? saveImageSelectedCategories.value
          : []
        const selectedKeys = new Set()
        for (const categoryName of selectedCategories) {
          const normalized = _normalizeUploadCategory(categoryName)
          if (!normalized) {
            continue
          }
          const dedupeKey = normalized.toLowerCase()
          selectedKeys.add(dedupeKey)
          void _ensureSaveImageCategoryExists(normalized)
        }

        const filtered = {}
        for (const [dedupeKey, exists] of Object.entries(saveImageCategoryExistence.value)) {
          if (!selectedKeys.has(dedupeKey)) {
            continue
          }
          filtered[dedupeKey] = exists
        }
        saveImageCategoryExistence.value = filtered
      }

      function _addSaveImageCategory(categoryName) {
        const normalized = _normalizeUploadCategory(categoryName)
        if (!normalized) {
          return false
        }

        const dedupeKey = normalized.toLowerCase()
        const exists = saveImageSelectedCategories.value.some(
          (existingCategory) => existingCategory.toLowerCase() === dedupeKey,
        )
        if (exists) {
          return false
        }

        saveImageSelectedCategories.value = [
          ...saveImageSelectedCategories.value,
          normalized,
        ]
        void _ensureSaveImageCategoryExists(normalized)
        return true
      }

      function removeSaveImageCategory(categoryName) {
        const normalized = _normalizeUploadCategory(categoryName)
        if (!normalized) {
          return
        }
        const dedupeKey = normalized.toLowerCase()
        saveImageSelectedCategories.value = saveImageSelectedCategories.value.filter(
          (existingCategory) => existingCategory.toLowerCase() !== dedupeKey,
        )
        if (Object.prototype.hasOwnProperty.call(saveImageCategoryExistence.value, dedupeKey)) {
          const nextState = { ...saveImageCategoryExistence.value }
          delete nextState[dedupeKey]
          saveImageCategoryExistence.value = nextState
        }
      }

      async function _loadSaveImageFallbackCategories(fallbackToken) {
        if (!location.value || typeof location.value !== 'object') {
          return
        }

        const locationP276Qid = extractWikidataId(String(location.value.location_p276 || ''))
        const locationP131Qid = extractWikidataId(String(location.value.municipality_p131 || ''))
        const geographicQids = _geographicQidsFromLocationFields()

        if (geographicQids.length === 0) {
          const locationQid = _locationWikidataQid()
          if (locationQid) {
            const currentEntity = await _fetchWikidataEntityForFallback(locationQid)
            if (fallbackToken !== saveImageFallbackToken) {
              return
            }
            if (currentEntity && Array.isArray(currentEntity.geographic_entities)) {
              for (const geographicEntity of currentEntity.geographic_entities) {
                const candidateQid = extractWikidataId(
                  String(
                    geographicEntity && typeof geographicEntity === 'object'
                      ? geographicEntity.id || geographicEntity.value || geographicEntity.uri || ''
                      : geographicEntity,
                  ),
                )
                if (!candidateQid) {
                  continue
                }
                if (!geographicQids.includes(candidateQid)) {
                  geographicQids.push(candidateQid)
                }
              }
            }
          }
        }

        const orderedCandidateQids = []
        const seenCandidateQids = new Set()
        const addCandidateQid = (qid) => {
          const normalizedQid = extractWikidataId(String(qid || ''))
          if (!normalizedQid) {
            return
          }
          if (seenCandidateQids.has(normalizedQid)) {
            return
          }
          seenCandidateQids.add(normalizedQid)
          orderedCandidateQids.push(normalizedQid)
        }

        addCandidateQid(locationP276Qid)
        for (const geographicQid of geographicQids) {
          addCandidateQid(geographicQid)
        }
        addCandidateQid(locationP131Qid)

        if (orderedCandidateQids.length === 0) {
          return
        }

        const entityByQid = {}
        await Promise.all(
          orderedCandidateQids.map(async (qid) => {
            entityByQid[qid] = await _fetchWikidataEntityForFallback(qid)
          }),
        )

        if (fallbackToken !== saveImageFallbackToken) {
          return
        }

        if (saveImageSelectedCategories.value.length > 0) {
          return
        }

        const relatedP131Qids = new Set()
        if (locationP276Qid) {
          const municipalityQid = _entityMunicipalityQid(entityByQid[locationP276Qid])
          if (municipalityQid) {
            relatedP131Qids.add(municipalityQid)
          }
        }
        for (const geographicQid of geographicQids) {
          const municipalityQid = _entityMunicipalityQid(entityByQid[geographicQid])
          if (municipalityQid) {
            relatedP131Qids.add(municipalityQid)
          }
        }

        const skipAdministrativeFallback = Boolean(
          locationP131Qid && relatedP131Qids.has(locationP131Qid),
        )

        const fallbackCategories = []
        const pushCategory = (candidateCategory) => {
          const normalizedCategory = _normalizeUploadCategory(candidateCategory)
          if (!normalizedCategory) {
            return
          }
          if (fallbackCategories.includes(normalizedCategory)) {
            return
          }
          fallbackCategories.push(normalizedCategory)
        }

        if (locationP276Qid) {
          pushCategory(
            entityByQid[locationP276Qid] && typeof entityByQid[locationP276Qid] === 'object'
              ? entityByQid[locationP276Qid].commons_category
              : '',
          )
        }

        for (const geographicQid of geographicQids) {
          pushCategory(
            entityByQid[geographicQid] && typeof entityByQid[geographicQid] === 'object'
              ? entityByQid[geographicQid].commons_category
              : '',
          )
        }

        if (!skipAdministrativeFallback && locationP131Qid) {
          pushCategory(
            entityByQid[locationP131Qid] && typeof entityByQid[locationP131Qid] === 'object'
              ? entityByQid[locationP131Qid].commons_category
              : '',
          )
        }

        for (const category of fallbackCategories) {
          _addSaveImageCategory(category)
        }
      }

      function _clearSaveImageNearbyCategorySuggestions() {
        saveImageNearbyCategoryToken += 1
        saveImageNearbyCategoryLoading.value = false
        saveImageNearbyCategorySuggestions.value = []
      }

      function _clearSaveImageNearbyDepictSuggestions() {
        saveImageNearbyDepictToken += 1
        saveImageNearbyDepictLoading.value = false
        saveImageNearbyDepictSuggestions.value = []
      }

      async function _loadSaveImageNearbyCategorySuggestions(latitude, longitude) {
        const parsedLatitude = Number(latitude)
        const parsedLongitude = Number(longitude)
        if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude) || !isSaveImageDialogOpen.value) {
          _clearSaveImageNearbyCategorySuggestions()
          _clearSaveImageNearbyDepictSuggestions()
          return
        }

        const currentToken = ++saveImageNearbyCategoryToken
        const currentDepictToken = ++saveImageNearbyDepictToken
        saveImageNearbyCategoryLoading.value = true
        saveImageNearbyDepictLoading.value = true
        try {
          const [
            linkedSubjectCategoryResult,
            wikidataNearbyCategoryResult,
            osmNearbyCategoryResult,
            wikidataNearbyDepictResult,
            osmNearbyDepictResult,
          ] = await Promise.allSettled([
            _loadSaveImageLinkedSubjectCategorySuggestions(),
            fetchNearbyWikidataCommonsCategories(parsedLatitude, parsedLongitude, {
              radiusMeters: SAVE_IMAGE_NEARBY_WIKIDATA_RADIUS_METERS,
              limit: SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS,
              lang: locale.value,
            }),
            fetchNearbyOsmCommonsCategories(parsedLatitude, parsedLongitude, {
              radiusMeters: SAVE_IMAGE_NEARBY_OSM_RADIUS_METERS,
              limit: SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS,
            }),
            fetchNearbyWikidataDepictItems(parsedLatitude, parsedLongitude, {
              radiusMeters: SAVE_IMAGE_NEARBY_WIKIDATA_RADIUS_METERS,
              limit: SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS,
              lang: locale.value,
            }),
            fetchNearbyOsmDepictItems(parsedLatitude, parsedLongitude, {
              radiusMeters: SAVE_IMAGE_NEARBY_OSM_RADIUS_METERS,
              limit: SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS,
              lang: locale.value,
            }),
          ])
          if (
            currentToken !== saveImageNearbyCategoryToken
            || currentDepictToken !== saveImageNearbyDepictToken
            || !isSaveImageDialogOpen.value
          ) {
            return
          }

          const wikidataNearbyCategoryItems = (
            wikidataNearbyCategoryResult.status === 'fulfilled' && Array.isArray(wikidataNearbyCategoryResult.value)
              ? wikidataNearbyCategoryResult.value
              : []
          )
          const linkedSubjectCategoryItems = (
            linkedSubjectCategoryResult.status === 'fulfilled' && Array.isArray(linkedSubjectCategoryResult.value)
              ? linkedSubjectCategoryResult.value
              : []
          ).map((categoryName) => ({
            category: _normalizeUploadCategory(String(categoryName || '')),
          })).filter((item) => item.category)
          const osmNearbyCategoryItems = (
            osmNearbyCategoryResult.status === 'fulfilled' && Array.isArray(osmNearbyCategoryResult.value)
              ? osmNearbyCategoryResult.value
              : []
          )
          const wikidataNearbyDepictItems = (
            wikidataNearbyDepictResult.status === 'fulfilled' && Array.isArray(wikidataNearbyDepictResult.value)
              ? wikidataNearbyDepictResult.value
              : []
          )
          const osmNearbyDepictItems = (
            osmNearbyDepictResult.status === 'fulfilled' && Array.isArray(osmNearbyDepictResult.value)
              ? osmNearbyDepictResult.value
              : []
          )

          const combinedNearbyCategoryItems = []
          const categorySourceItems = [linkedSubjectCategoryItems, wikidataNearbyCategoryItems, osmNearbyCategoryItems]
          let sourceIndex = 0
          while (combinedNearbyCategoryItems.length < SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS) {
            let addedAtLeastOne = false
            for (const items of categorySourceItems) {
              if (sourceIndex >= items.length) {
                continue
              }
              combinedNearbyCategoryItems.push(items[sourceIndex])
              addedAtLeastOne = true
              if (combinedNearbyCategoryItems.length >= SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS) {
                break
              }
            }
            if (!addedAtLeastOne) {
              break
            }
            sourceIndex += 1
          }

          const normalizedSuggestions = []
          const seenDedupeKeys = new Set()
          for (const nearbyItem of combinedNearbyCategoryItems) {
            if (!nearbyItem || typeof nearbyItem !== 'object') {
              continue
            }
            const normalizedCategory = _normalizeUploadCategory(nearbyItem.category)
            if (!normalizedCategory) {
              continue
            }
            const dedupeKey = normalizedCategory.toLowerCase()
            if (seenDedupeKeys.has(dedupeKey)) {
              continue
            }
            seenDedupeKeys.add(dedupeKey)
            normalizedSuggestions.push(normalizedCategory)
            if (normalizedSuggestions.length >= SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS) {
              break
            }
          }
          saveImageNearbyCategorySuggestions.value = normalizedSuggestions

          const nearbyDepictSuggestions = []
          const seenDepictQids = new Set()
          for (const sourceItems of [wikidataNearbyDepictItems, osmNearbyDepictItems]) {
            for (const nearbyItem of sourceItems) {
              const normalizedItem = _normalizeSaveImageDepictItem(nearbyItem)
              if (!normalizedItem) {
                continue
              }
              const dedupeKey = normalizedItem.id.toLowerCase()
              if (seenDepictQids.has(dedupeKey)) {
                continue
              }
              seenDepictQids.add(dedupeKey)
              nearbyDepictSuggestions.push(normalizedItem)
              if (nearbyDepictSuggestions.length >= SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS) {
                break
              }
            }
            if (nearbyDepictSuggestions.length >= SAVE_IMAGE_NEARBY_WIKIDATA_MAX_ITEMS) {
              break
            }
          }
          saveImageNearbyDepictSuggestions.value = nearbyDepictSuggestions
        } catch (error) {
          if (
            currentToken !== saveImageNearbyCategoryToken
            || currentDepictToken !== saveImageNearbyDepictToken
          ) {
            return
          }
          saveImageNearbyCategorySuggestions.value = []
          saveImageNearbyDepictSuggestions.value = []
        } finally {
          if (currentToken === saveImageNearbyCategoryToken) {
            saveImageNearbyCategoryLoading.value = false
          }
          if (currentDepictToken === saveImageNearbyDepictToken) {
            saveImageNearbyDepictLoading.value = false
          }
        }
      }

      const refreshSaveImageNearbyCategorySuggestionsDebounced = debounce(() => {
        const latitude = parseCoordinate(saveImageLatitude.value)
        const longitude = parseCoordinate(saveImageLongitude.value)
        void _loadSaveImageNearbyCategorySuggestions(latitude, longitude)
      }, 300)

      function _categoryFromCommonsSuggestion(item) {
        if (!item || typeof item !== 'object') {
          return ''
        }
        const name = typeof item.name === 'string' ? item.name : ''
        const title = typeof item.title === 'string' ? item.title : ''
        return _normalizeUploadCategory(name || title)
      }

      function _categoryFromCommonsSubcategory(item) {
        if (!item || typeof item !== 'object') {
          return ''
        }
        const commonsCategory = typeof item.commons_category === 'string' ? item.commons_category : ''
        const name = typeof item.name === 'string' ? item.name : ''
        const title = typeof item.title === 'string' ? item.title : ''
        return _normalizeUploadCategory(commonsCategory || name || title)
      }

      function _clearSaveImageSelectedCategoryAncestors() {
        saveImageSelectedCategoryAncestorToken += 1
        saveImageSelectedCategoryAncestorDedupeKeys.value = []
        saveImageSelectedBroadCategoryConflictDedupeKeys.value = []
      }

      async function _fetchSaveImageParentCategoriesForCategory(categoryName) {
        const normalizedCategory = _normalizeUploadCategory(categoryName)
        if (!normalizedCategory) {
          return []
        }
        const cacheKey = normalizedCategory.toLowerCase()
        if (saveImageParentCategoryCache.has(cacheKey)) {
          return saveImageParentCategoryCache.get(cacheKey)
        }

        const requestPromise = (async () => {
          try {
            const payload = await fetchCommonsCategoryParents(normalizedCategory, AUTOCOMPLETE_RESULT_LIMIT)
            return Array.isArray(payload) ? payload : []
          } catch (error) {
            return []
          }
        })()
        saveImageParentCategoryCache.set(cacheKey, requestPromise)
        return requestPromise
      }

      async function refreshSaveImageSelectedCategoryAncestorDedupeKeys() {
        const currentToken = ++saveImageSelectedCategoryAncestorToken
        const selectedCategories = Array.isArray(saveImageSelectedCategories.value)
          ? saveImageSelectedCategories.value
          : []

        const normalizedSelectedCategories = []
        const selectedDedupeKeys = new Set()
        for (const categoryName of selectedCategories) {
          const normalizedCategory = _normalizeUploadCategory(categoryName)
          if (!normalizedCategory) {
            continue
          }
          const dedupeKey = normalizedCategory.toLowerCase()
          if (selectedDedupeKeys.has(dedupeKey)) {
            continue
          }
          selectedDedupeKeys.add(dedupeKey)
          normalizedSelectedCategories.push(normalizedCategory)
        }

        if (!isSaveImageDialogOpen.value || normalizedSelectedCategories.length === 0) {
          saveImageSelectedCategoryAncestorDedupeKeys.value = []
          saveImageSelectedBroadCategoryConflictDedupeKeys.value = []
          return
        }

        saveImageSelectedCategoryAncestorDedupeKeys.value = []
        saveImageSelectedBroadCategoryConflictDedupeKeys.value = []
        const ancestorDedupeKeys = new Set()
        const broadCategoryConflictDedupeKeys = new Set()
        const visitedDedupeKeys = new Set(selectedDedupeKeys)
        let currentLevelCategories = [...normalizedSelectedCategories]

        for (let level = 1; level <= SAVE_IMAGE_SELECTED_CATEGORY_ANCESTOR_DEPTH; level += 1) {
          if (currentLevelCategories.length === 0) {
            break
          }

          const parentGroups = await Promise.all(
            currentLevelCategories.map((categoryName) => _fetchSaveImageParentCategoriesForCategory(categoryName)),
          )
          if (currentToken !== saveImageSelectedCategoryAncestorToken || !isSaveImageDialogOpen.value) {
            return
          }

          const nextLevelCategories = []
          for (const parents of parentGroups) {
            for (const parent of parents) {
              const normalizedParent = _categoryFromCommonsSubcategory(parent)
              if (!normalizedParent) {
                continue
              }
              const dedupeKey = normalizedParent.toLowerCase()
              if (selectedDedupeKeys.has(dedupeKey)) {
                broadCategoryConflictDedupeKeys.add(dedupeKey)
                continue
              }
              ancestorDedupeKeys.add(dedupeKey)
              if (visitedDedupeKeys.has(dedupeKey)) {
                continue
              }
              visitedDedupeKeys.add(dedupeKey)
              nextLevelCategories.push(normalizedParent)
            }
          }
          currentLevelCategories = nextLevelCategories
        }

        if (currentToken !== saveImageSelectedCategoryAncestorToken || !isSaveImageDialogOpen.value) {
          return
        }
        saveImageSelectedCategoryAncestorDedupeKeys.value = Array.from(ancestorDedupeKeys)
        saveImageSelectedBroadCategoryConflictDedupeKeys.value = Array.from(broadCategoryConflictDedupeKeys)
      }

      async function _fetchSaveImageSubcategoriesForCategory(categoryName) {
        const normalizedCategory = _normalizeUploadCategory(categoryName)
        if (!normalizedCategory) {
          return []
        }
        const cacheKey = normalizedCategory.toLowerCase()
        if (saveImageSubcategoryCache.has(cacheKey)) {
          return saveImageSubcategoryCache.get(cacheKey)
        }

        const requestPromise = (async () => {
          try {
            const payload = await fetchCommonsCategoryChildren(normalizedCategory, AUTOCOMPLETE_RESULT_LIMIT)
            return Array.isArray(payload) ? payload : []
          } catch (error) {
            return []
          }
        })()
        saveImageSubcategoryCache.set(cacheKey, requestPromise)
        return requestPromise
      }

      async function loadSaveImageSubcategorySuggestions() {
        const currentToken = ++saveImageSubcategoryToken
        if (!isSaveImageDialogOpen.value) {
          return
        }

        const selectedCategories = Array.isArray(saveImageSelectedCategories.value)
          ? [...saveImageSelectedCategories.value]
          : []
        if (selectedCategories.length === 0) {
          saveImageSubcategorySuggestions.value = []
          saveImageSubcategoryFarSuggestions.value = []
          saveImageSubcategoryLoading.value = false
          return
        }

        saveImageSubcategoryLoading.value = true
        const childrenByParent = await Promise.all(
          selectedCategories.map((categoryName) => _fetchSaveImageSubcategoriesForCategory(categoryName)),
        )

        if (currentToken !== saveImageSubcategoryToken || !isSaveImageDialogOpen.value) {
          return
        }

        const selectedDedupeKeys = new Set(
          selectedCategories.map((categoryName) => _normalizeUploadCategory(categoryName).toLowerCase()).filter(Boolean),
        )
        const nearSuggestions = []
        const farSuggestions = []
        const suggestionByDedupeKey = new Map()
        for (const children of childrenByParent) {
          for (const child of children) {
            const categoryName = _categoryFromCommonsSubcategory(child)
            if (!categoryName) {
              continue
            }
            const dedupeKey = categoryName.toLowerCase()
            if (selectedDedupeKeys.has(dedupeKey)) {
              continue
            }
            if (!suggestionByDedupeKey.has(dedupeKey)) {
              suggestionByDedupeKey.set(dedupeKey, categoryName)
            }
          }
        }

        for (const categoryName of suggestionByDedupeKey.values()) {
          nearSuggestions.push(categoryName)
        }

        saveImageSubcategorySuggestions.value = nearSuggestions
        saveImageSubcategoryFarSuggestions.value = farSuggestions
        saveImageSubcategoryLoading.value = false
      }

      const searchSaveImageCategoriesDebounced = debounce(async (searchTerm) => {
        saveImageCategoryLoading.value = true
        try {
          const payload = await searchCommonsCategories(searchTerm, AUTOCOMPLETE_RESULT_LIMIT)
          const suggestions = Array.isArray(payload) ? payload : []
          const uniqueSuggestions = []
          const seen = new Set()
          for (const suggestion of suggestions) {
            const categoryName = _categoryFromCommonsSuggestion(suggestion)
            if (!categoryName) {
              continue
            }
            const alreadySelected = saveImageSelectedCategories.value.some(
              (selectedCategory) => selectedCategory.toLowerCase() === categoryName.toLowerCase(),
            )
            if (alreadySelected) {
              continue
            }
            const dedupeKey = categoryName.toLowerCase()
            if (seen.has(dedupeKey)) {
              continue
            }
            seen.add(dedupeKey)
            uniqueSuggestions.push(categoryName)
          }
          saveImageCategorySuggestions.value = uniqueSuggestions
        } catch (error) {
          saveImageCategorySuggestions.value = []
        } finally {
          saveImageCategoryLoading.value = false
        }
      }, 250)

      function onSaveImageCategoryInput() {
        const query = saveImageCategorySearch.value.trim()
        if (!query) {
          saveImageCategorySuggestions.value = []
          saveImageCategoryLoading.value = false
          return
        }
        searchSaveImageCategoriesDebounced(query)
      }

      function onSaveImageCategoryFocus() {
        if (saveImageCategorySearch.value.trim()) {
          onSaveImageCategoryInput()
        }
      }

      function hideSaveImageCategorySuggestionsSoon() {
        window.setTimeout(() => {
          saveImageCategorySuggestions.value = []
        }, 140)
      }

      function selectSaveImageCategory(categoryName) {
        _addSaveImageCategory(categoryName)
        saveImageCategorySearch.value = ''
        saveImageCategorySuggestions.value = []
        saveImageCategoryLoading.value = false
      }

      function addSaveImageCategoriesFromInput() {
        const query = saveImageCategorySearch.value.trim()
        if (!query) {
          return
        }

        const wasAdded = _addSaveImageCategory(query)
        if (wasAdded) {
          saveImageCategorySearch.value = ''
        }
        saveImageCategorySuggestions.value = []
        saveImageCategoryLoading.value = false
      }

      function onSaveImageCategoryKeydown(event) {
        if (!event || event.key !== 'Enter') {
          return
        }
        event.preventDefault()
        addSaveImageCategoriesFromInput()
      }

      function _saveImageDepictFromWikidataSuggestion(item) {
        if (!item || typeof item !== 'object') {
          return null
        }
        const qid = extractWikidataId(String(item.id || item.value || ''))
        if (!qid) {
          return null
        }
        return {
          id: qid,
          label: typeof item.label === 'string' ? item.label.trim() : '',
          description: typeof item.description === 'string' ? item.description.trim() : '',
        }
      }

      function _isSaveImageDepictSelected(qidValue) {
        const qid = extractWikidataId(String(qidValue || ''))
        if (!qid) {
          return false
        }
        return saveImageSelectedDepicts.value.some(
          (item) => extractWikidataId(String(item && item.id ? item.id : '')) === qid,
        )
      }

      function _addSaveImageDepict(item) {
        const normalizedItem = _normalizeSaveImageDepictItem(item)
        if (!normalizedItem) {
          return false
        }
        if (_isSaveImageDepictSelected(normalizedItem.id)) {
          return false
        }
        saveImageSelectedDepicts.value = [
          ...saveImageSelectedDepicts.value,
          normalizedItem,
        ]
        return true
      }

      function removeSaveImageDepict(item) {
        const qid = extractWikidataId(String(item && item.id ? item.id : item || ''))
        if (!qid) {
          return
        }
        saveImageSelectedDepicts.value = saveImageSelectedDepicts.value.filter(
          (entry) => extractWikidataId(String(entry && entry.id ? entry.id : '')) !== qid,
        )
        saveImageLinkedSubjects.value = saveImageLinkedSubjects.value.filter(
          (entry) => extractWikidataId(String(entry && entry.id ? entry.id : '')) !== qid,
        )
        _renderSaveImageSubjectLinkedMarkers()
      }

      const searchSaveImageDepictsDebounced = debounce(async (searchTerm) => {
        saveImageDepictLoading.value = true
        try {
          const items = await searchWikidataEntities(searchTerm, locale.value, AUTOCOMPLETE_RESULT_LIMIT)
          const suggestions = Array.isArray(items) ? items : []
          const uniqueSuggestions = []
          const seen = new Set()
          for (const suggestion of suggestions) {
            const normalizedSuggestion = _saveImageDepictFromWikidataSuggestion(suggestion)
            if (!normalizedSuggestion) {
              continue
            }
            const dedupeKey = normalizedSuggestion.id.toLowerCase()
            if (_isSaveImageDepictSelected(normalizedSuggestion.id) || seen.has(dedupeKey)) {
              continue
            }
            seen.add(dedupeKey)
            uniqueSuggestions.push(normalizedSuggestion)
          }
          saveImageDepictSuggestions.value = uniqueSuggestions
        } catch (error) {
          saveImageDepictSuggestions.value = []
        } finally {
          saveImageDepictLoading.value = false
        }
      }, 250)

      function onSaveImageDepictInput() {
        const query = saveImageDepictSearch.value.trim()
        if (!query) {
          saveImageDepictSuggestions.value = []
          saveImageDepictLoading.value = false
          return
        }
        searchSaveImageDepictsDebounced(query)
      }

      function onSaveImageDepictFocus() {
        if (saveImageDepictSearch.value.trim()) {
          onSaveImageDepictInput()
        }
      }

      function hideSaveImageDepictSuggestionsSoon() {
        window.setTimeout(() => {
          saveImageDepictSuggestions.value = []
        }, 140)
      }

      function selectSaveImageDepictSuggestion(item) {
        const wasAdded = _addSaveImageDepict(item)
        if (wasAdded) {
          saveImageDepictSearch.value = ''
        }
        saveImageDepictSuggestions.value = []
        saveImageDepictLoading.value = false
      }

      function addSaveImageDepictsFromInput() {
        const query = saveImageDepictSearch.value.trim()
        if (!query) {
          return
        }
        const qid = extractWikidataId(query)
        if (!qid) {
          return
        }
        const wasAdded = _addSaveImageDepict({ id: qid, label: '', description: '' })
        if (wasAdded) {
          saveImageDepictSearch.value = ''
        }
        saveImageDepictSuggestions.value = []
        saveImageDepictLoading.value = false
      }

      function onSaveImageDepictKeydown(event) {
        if (!event || event.key !== 'Enter') {
          return
        }
        event.preventDefault()
        addSaveImageDepictsFromInput()
      }

      function selectSaveImageNearbyDepictSuggestion(item) {
        _addSaveImageDepict(item)
      }

      async function onSaveImageFileInputChange(event) {
        const fileList = event && event.target && event.target.files ? event.target.files : null
        const nextFile = fileList && fileList.length > 0 ? fileList[0] : null
        saveImageSelectedFile.value = nextFile
        saveImageSubjectImageXPercent.value = null
        saveImageSubjectImageYPercent.value = null
        saveImageSubjectSelectionError.value = ''
        saveImageError.value = ''
        saveImageUploadResult.value = null
        saveImageExifReadToken += 1
        const currentExifReadToken = saveImageExifReadToken
        saveImageExifMetadataLoading.value = false
        saveImageExifDateTaken.value = ''
        saveImageExifLatitude.value = null
        saveImageExifLongitude.value = null
        saveImageExifHeading.value = null
        saveImageExifElevation.value = null
        saveImageApiElevationMeters.value = ''
        saveImageElevationFromExif.value = false
        saveImageIncludeElevation.value = false

        if (!nextFile) {
          return
        }

        saveImageExifMetadataLoading.value = true
        try {
          const exifMetadata = await readImageExifMetadata(nextFile)
          if (currentExifReadToken !== saveImageExifReadToken) {
            return
          }
          if (!exifMetadata || typeof exifMetadata !== 'object') {
            return
          }

          const exifDateTaken = typeof exifMetadata.dateTaken === 'string' ? exifMetadata.dateTaken.trim() : ''
          const exifDateTakenDate =
            typeof exifMetadata.dateTakenDate === 'string' ? exifMetadata.dateTakenDate.trim() : ''
          saveImageExifDateTaken.value = exifDateTaken || exifDateTakenDate

          const exifLatitude = Number(exifMetadata.latitude)
          const exifLongitude = Number(exifMetadata.longitude)
          if (Number.isFinite(exifLatitude) && Number.isFinite(exifLongitude)) {
            saveImageExifLatitude.value = exifLatitude
            saveImageExifLongitude.value = exifLongitude
            _setSaveImageCoordinates(exifLatitude, exifLongitude)
          }

          const exifHeading = normalizeHeadingDegrees(exifMetadata.heading)
          if (exifHeading !== null) {
            saveImageExifHeading.value = exifHeading
            if (saveImageApiCoordinateMode.value !== 'photographer') {
              saveImageApiCoordinateMode.value = 'photographer'
              if (showSaveImageCoordinatePickerDialog.value) {
                _syncSaveImageCoordinatesFromMapCenter()
              }
            }
            _setSaveImageHeading(exifHeading)
          }

          const exifElevation = Number(exifMetadata.altitude)
          if (Number.isFinite(exifElevation)) {
            saveImageExifElevation.value = exifElevation
            saveImageApiElevationMeters.value = exifElevation.toFixed(1).replace(/\.0$/, '')
            saveImageElevationFromExif.value = true
          }

          if (!saveImageApiDateCreated.value.trim() && exifDateTakenDate) {
            saveImageApiDateCreated.value = exifDateTakenDate
          }

          _applySuggestedSaveImageTargetFilenameIfAllowed()
        } catch (error) {
          void error
        } finally {
          if (currentExifReadToken === saveImageExifReadToken) {
            saveImageExifMetadataLoading.value = false
          }
        }
      }

      function selectSaveImageSubcategorySuggestion(categoryName) {
        _addSaveImageCategory(categoryName)
      }

      function selectSaveImageNearbyCategorySuggestion(categoryName) {
        _addSaveImageCategory(categoryName)
      }

      function _uploadWizardCategories() {
        const uniqueCategories = []
        const seen = new Set()

        for (const category of saveImageSelectedCategories.value) {
          const normalized = _normalizeUploadCategory(category)
          if (!normalized) {
            continue
          }
          const dedupeKey = normalized.toLowerCase()
          if (seen.has(dedupeKey)) {
            continue
          }
          seen.add(dedupeKey)
          uniqueCategories.push(normalized)
        }

        return uniqueCategories
      }

      function _selectedSaveImageDepictQids() {
        const uniqueQids = []
        const seen = new Set()
        for (const item of saveImageSelectedDepicts.value) {
          const qid = extractWikidataId(String(item && item.id ? item.id : ''))
          if (!qid) {
            continue
          }
          const dedupeKey = qid.toLowerCase()
          if (seen.has(dedupeKey)) {
            continue
          }
          seen.add(dedupeKey)
          uniqueQids.push(qid)
        }
        return uniqueQids
      }

      function openSaveImageApiForm() {
        if (!canSaveImage.value) {
          return
        }
        _initializeSaveImageWizard()
        showSaveImageApiForm.value = true
      }

      function onSaveImageMapElementReady(element) {
        saveImageMapElement.value = element || null
        if (showSaveImageCoordinatePickerDialog.value && saveImageMapElement.value) {
          void nextTick().then(() => {
            ensureSaveImageWizardMap()
          })
        }
      }

      function toggleSaveImageCoordinatePickerPreview() {
        saveImageCoordinatePickerPreviewCollapsed.value = !saveImageCoordinatePickerPreviewCollapsed.value
        void nextTick().then(() => {
          if (saveImageMapInstance) {
            saveImageMapInstance.invalidateSize()
            _updateSaveImageHeadingMapVisuals()
          }
        })
      }

      async function openSaveImageCoordinatePickerDialog() {
        if (!showSaveImageApiForm.value) {
          return
        }
        saveImageCoordinatePickerPreviewCollapsed.value = false
        showSaveImageCoordinatePickerDialog.value = true
        await nextTick()
        ensureSaveImageWizardMap()
      }

      function closeSaveImageCoordinatePickerDialog() {
        showSaveImageCoordinatePickerDialog.value = false
        destroySaveImageWizardMap()
      }

      function _closeSaveImageDialogs() {
        saveImageFallbackToken += 1
        saveImageSubcategoryToken += 1
        showSaveImageCoordinatePickerDialog.value = false
        saveImageCoordinatePickerPreviewCollapsed.value = false
        showSaveImageApiForm.value = false
        saveImageError.value = ''
        saveImageApiUploading.value = false
        saveImageUploadResult.value = null
        saveImageHeading.value = ''
        saveImageApiCoordinateMode.value = 'photographer'
        saveImageSubjectType.value = ''
        saveImageSubjectLinkMode.value = 'map'
        saveImageSubjectMapLatitude.value = ''
        saveImageSubjectMapLongitude.value = ''
        saveImageSubjectImageXPercent.value = null
        saveImageSubjectImageYPercent.value = null
        saveImageSubjectWikidataSearch.value = ''
        saveImageSubjectWikidataSuggestions.value = []
        saveImageSubjectWikidataLoading.value = false
        _clearSaveImageSubjectMapFeatures()
        saveImageSubjectSelectedWikidataItem.value = null
        saveImageSubjectSelectionError.value = ''
        saveImageLinkedSubjects.value = []
        saveImageSelectedFile.value = null
        saveImageExifReadToken += 1
        saveImageExifMetadataLoading.value = false
        saveImageExifDateTaken.value = ''
        saveImageExifLatitude.value = null
        saveImageExifLongitude.value = null
        saveImageExifHeading.value = null
        saveImageExifElevation.value = null
        saveImageInitialWikidataLatitude.value = null
        saveImageInitialWikidataLongitude.value = null
        saveImageApiTargetFilename.value = ''
        saveImageApiTargetFilenameTouched.value = false
        _resetSaveImageApiTargetFilenameAvailability()
        saveImageFilenameBuilderUseSubjects.value = true
        saveImageFilenameBuilderUseDate.value = true
        saveImageFilenameBuilderUseLocation.value = true
        saveImageFilenameBuilderUseCategories.value = true
        saveImageIsOwnPhoto.value = true
        saveImageApiAuthor.value = ''
        saveImageApiSourceUrl.value = ''
        saveImageApiDateCreated.value = ''
        saveImageApiLicenseTemplate.value = 'Cc-by-sa-4.0'
        saveImageApiElevationMeters.value = ''
        saveImageElevationFromExif.value = false
        saveImageIncludeElevation.value = false
        saveImageCaption.value = ''
        saveImageCaptionLanguage.value = _normalizeSaveImageMetadataLanguage(locale.value)
        saveImageDescription.value = ''
        saveImageDescriptionLanguage.value = _normalizeSaveImageMetadataLanguage(locale.value)
        if (saveImageFileInputElement.value) {
          saveImageFileInputElement.value.value = ''
        }
        saveImageCategorySuggestions.value = []
        saveImageCategoryLoading.value = false
        saveImageNearbyCategorySuggestions.value = []
        saveImageNearbyCategoryLoading.value = false
        saveImageNearbyCategoryToken += 1
        saveImageDepictSearch.value = ''
        saveImageDepictSuggestions.value = []
        saveImageDepictLoading.value = false
        saveImageNearbyDepictSuggestions.value = []
        saveImageNearbyDepictLoading.value = false
        saveImageNearbyDepictToken += 1
        saveImageSelectedDepicts.value = []
        _clearSaveImageSelectedCategoryAncestors()
        saveImageSubcategorySuggestions.value = []
        saveImageSubcategoryFarSuggestions.value = []
        saveImageSubcategoryLoading.value = false
        destroySaveImageWizardMap()
        destroySaveImageCoordinatePreviewMap()
        destroySaveImageSubjectMap()
      }

      function closeSaveImageApiForm() {
        _closeSaveImageDialogs()
      }

      async function saveImageViaMediaWikiApi() {
        saveImageError.value = ''
        saveImageUploadResult.value = null

        if (!saveImageSelectedFile.value) {
          saveImageError.value = t('saveImageFileRequired')
          return
        }
        if (!authStatusLoading.value && !authAuthenticated.value) {
          saveImageError.value = t('authRequiredForWikidataWrites')
          return
        }
        const normalizedSubjectType = normalizeSaveImageSubjectType(saveImageSubjectType.value)
        if (!normalizedSubjectType) {
          saveImageError.value = t('saveImageSubjectTypeRequired')
          return
        }
        if (saveImageSubjectTypeIsLocationRelevant(normalizedSubjectType) && saveImageLinkedSubjects.value.length < 1) {
          saveImageError.value = t('saveImageSubjectLinkRequired')
          return
        }

        const latitude = parseCoordinate(saveImageLatitude.value)
        const longitude = parseCoordinate(saveImageLongitude.value)
        if (latitude === null || longitude === null) {
          saveImageError.value = t('saveImageCoordinatesRequired')
          return
        }
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          const uploadConfirmed = window.confirm(t('saveImageUploadConfirm'))
          if (!uploadConfirmed) {
            return
          }
        }

        const uploadFormData = new FormData()
        uploadFormData.append('file', saveImageSelectedFile.value)
        uploadFormData.append('coordinate_source', 'map')
        const captionLanguage = _normalizeSaveImageMetadataLanguage(saveImageCaptionLanguage.value)
        const descriptionLanguage = _normalizeSaveImageMetadataLanguage(saveImageDescriptionLanguage.value)
        uploadFormData.append('caption_language', captionLanguage)
        uploadFormData.append('description_language', descriptionLanguage)
        uploadFormData.append('license_template', String(saveImageApiLicenseTemplate.value || 'Cc-by-sa-4.0'))

        const caption = typeof saveImageCaption.value === 'string' ? saveImageCaption.value.trim() : ''
        if (caption) {
          uploadFormData.append('caption', caption)
        }
        const description = typeof saveImageDescription.value === 'string' ? saveImageDescription.value.trim() : ''
        if (description) {
          uploadFormData.append('description', description)
        }

        const targetFilename = normalizeCommonsFilenameCandidate(saveImageApiTargetFilename.value)
        if (targetFilename) {
          uploadFormData.append('target_filename', targetFilename)
        }

        const author = typeof saveImageApiAuthor.value === 'string' ? saveImageApiAuthor.value.trim() : ''
        if (author) {
          uploadFormData.append('author', author)
        }

        const sourceUrl = typeof saveImageApiSourceUrl.value === 'string' ? saveImageApiSourceUrl.value.trim() : ''
        if (!saveImageIsOwnPhoto.value && sourceUrl) {
          uploadFormData.append('source_url', sourceUrl)
        }

        const dateCreated = typeof saveImageApiDateCreated.value === 'string'
          ? saveImageApiDateCreated.value.trim()
          : ''
        if (dateCreated) {
          uploadFormData.append('date_created', dateCreated)
        }

        uploadFormData.append('latitude', String(latitude))
        uploadFormData.append('longitude', String(longitude))

        const heading = saveImageApiUsesPhotographerCoordinates.value
          ? normalizeHeadingDegrees(saveImageHeading.value)
          : null
        if (heading !== null) {
          uploadFormData.append('heading', String(heading))
        }
        const elevationMeters = (
          saveImageElevationFromExif.value && saveImageIncludeElevation.value
        )
          ? parseCoordinate(saveImageApiElevationMeters.value)
          : null
        if (elevationMeters !== null) {
          uploadFormData.append('elevation_meters', String(elevationMeters))
        }

        const categories = _uploadWizardCategories()
        if (categories.length > 0) {
          uploadFormData.append('categories_json', JSON.stringify(categories))
        }
        const depicts = _selectedSaveImageDepictQids()
        if (depicts.length > 0) {
          uploadFormData.append('depicts_json', JSON.stringify(depicts))
        }

        const wikidataItemQid = _locationWikidataQid()
        if (wikidataItemQid) {
          uploadFormData.append('wikidata_item', wikidataItemQid)
        }

        saveImageApiUploading.value = true
        try {
          const payload = await uploadCommonsImage(uploadFormData, locale.value)
          if (payload && typeof payload === 'object') {
            saveImageUploadResult.value = payload
          } else {
            saveImageUploadResult.value = {}
          }
          if (saveImageFileInputElement.value) {
            saveImageFileInputElement.value.value = ''
          }
          saveImageSelectedFile.value = null
          saveImageExifReadToken += 1
          saveImageExifMetadataLoading.value = false
          saveImageExifDateTaken.value = ''
          saveImageExifLatitude.value = null
          saveImageExifLongitude.value = null
          saveImageExifHeading.value = null
          saveImageExifElevation.value = null
          saveImageApiElevationMeters.value = ''
          saveImageElevationFromExif.value = false
          saveImageIncludeElevation.value = false
        } catch (err) {
          saveImageError.value = err instanceof Error ? err.message : t('loadError')
        } finally {
          saveImageApiUploading.value = false
        }
      }

      async function loadChildren() {
        if (!props.id) {
          children.value = []
          childrenLoading.value = false
          childrenError.value = ''
          return
        }

        const currentToken = ++childrenLoadToken
        childrenLoading.value = true
        childrenError.value = ''

        try {
          const loadedChildren = await getLocationChildrenCached(props.id, locale.value)
          if (currentToken !== childrenLoadToken) {
            return
          }
          children.value = Array.isArray(loadedChildren) ? loadedChildren : []
          if (location.value && typeof location.value === 'object') {
            location.value = {
              ...location.value,
              children: children.value,
            }
          }
        } catch (err) {
          if (currentToken !== childrenLoadToken) {
            return
          }
          children.value = []
          childrenError.value = err.message || t('loadError')
        } finally {
          if (currentToken === childrenLoadToken) {
            childrenLoading.value = false
          }
        }
      }

      async function loadLocation() {
        const currentLoadToken = ++locationLoadToken
        if (!props.id) {
          location.value = null
          loading.value = false
          error.value = ''
          children.value = []
          childrenLoading.value = false
          childrenError.value = ''
          destroyDetailMap()
          return
        }

        childrenLoadToken += 1
        error.value = ''
        childrenError.value = ''

        const listCachedLocation = getLocationFromListCache(props.id, locale.value)
        if (listCachedLocation) {
          location.value = listCachedLocation
          children.value = Array.isArray(listCachedLocation.children) ? listCachedLocation.children : []
          loading.value = false
          await nextTick()
          ensureDetailMap()
        } else {
          location.value = null
          children.value = []
          loading.value = true
          destroyDetailMap()
        }

        // Load children asynchronously so detail metadata is rendered without waiting for child query.
        void loadChildren()

        try {
          const loadedLocation = await getLocationDetailCached(
            props.id,
            locale.value,
            { force: Boolean(listCachedLocation) },
          )
          if (currentLoadToken !== locationLoadToken) {
            return
          }
          location.value = loadedLocation
          if (loadedLocation && typeof loadedLocation === 'object' && Array.isArray(loadedLocation.children)) {
            children.value = loadedLocation.children
          }
          loading.value = false
          await nextTick()
          ensureDetailMap()
        } catch (err) {
          if (currentLoadToken !== locationLoadToken) {
            return
          }
          childrenLoadToken += 1
          loading.value = false
          if (listCachedLocation) {
            return
          }
          error.value = err.message || t('loadError')
          location.value = null
          children.value = []
          childrenLoading.value = false
          childrenError.value = ''
          destroyDetailMap()
        }
      }

      function openSubLocationCreator() {
        if (!canCreateSubLocation.value) {
          return
        }
        window.dispatchEvent(
          new CustomEvent('open-create-sub-location', {
            detail: {
              parentUri: location.value.uri,
              parentName: location.value.name,
              parentLatitude: location.value.latitude,
              parentLongitude: location.value.longitude,
            }
          })
        )
      }

      function resolveLocationId(item) {
        if (!item || typeof item !== 'object') {
          return ''
        }
        if (typeof item.id === 'string' && item.id.trim()) {
          const normalizedId = normalizeLocationId(item.id.trim())
          if (normalizedId) {
            return normalizedId
          }
        }
        if (typeof item.uri === 'string' && item.uri.trim()) {
          return normalizeLocationId(item.uri)
        }
        return ''
      }

      function isInternalChildLocation(item) {
        if (!item || typeof item !== 'object') {
          return false
        }
        const uri = typeof item.uri === 'string' ? item.uri.trim() : ''
        if (!uri) {
          return false
        }
        const normalizedUri = normalizeLocationUri(uri)
        return normalizedUri.startsWith('https://www.wikidata.org/entity/')
      }

      function parentLocationId() {
        if (!location.value) {
          return ''
        }
        if (typeof location.value.parent_id === 'string' && location.value.parent_id.trim()) {
          const normalizedParentId = normalizeLocationId(location.value.parent_id.trim())
          if (normalizedParentId) {
            return normalizedParentId
          }
        }
        if (typeof location.value.parent_uri === 'string' && location.value.parent_uri.trim()) {
          return normalizeLocationId(location.value.parent_uri)
        }
        return ''
      }

      function isHttpUrl(value) {
        if (typeof value !== 'string') {
          return false
        }
        const trimmed = value.trim()
        return trimmed.startsWith('http://') || trimmed.startsWith('https://')
      }

      function isWikidataEntityUri(value) {
        if (typeof value !== 'string') {
          return false
        }
        return /^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/i.test(value.trim())
      }

      function wikidataQid(value) {
        return extractWikidataId(typeof value === 'string' ? value : '')
      }

      function wikidataEntityUrl(value) {
        const qid = wikidataQid(value)
        return qid ? `https://www.wikidata.org/entity/${qid}` : ''
      }

      function isQidText(value) {
        return /^Q\d+$/i.test((value || '').trim())
      }

      function wikidataLinkText(value) {
        const qid = wikidataQid(value)
        if (qid) {
          return qid
        }
        return typeof value === 'string' ? value.trim() : ''
      }

      function displayUriLabel(value) {
        const qid = wikidataQid(value)
        if (qid) {
          return qid
        }
        return typeof value === 'string' ? value.trim() : ''
      }

      function sourceUriLabel(item) {
        if (!item || typeof item !== 'object') {
          return t('noValue')
        }
        const uri = typeof item.uri === 'string' ? item.uri.trim() : ''
        const qid = wikidataQid(uri)
        const name = typeof item.name === 'string' ? item.name.trim() : ''
        if (name && qid && name.toUpperCase() !== qid.toUpperCase()) {
          return `${name} (${qid})`
        }
        if (name) {
          return name
        }
        return displayUriLabel(uri)
      }

      function wikidataItemLabel(item) {
        if (!item || typeof item !== 'object') {
          return t('noValue')
        }
        const rawValue = typeof item.wikidata_item === 'string' ? item.wikidata_item.trim() : ''
        const qid = wikidataQid(rawValue)
        const name = typeof item.name === 'string' ? item.name.trim() : ''
        if (name && qid && name.toUpperCase() !== qid.toUpperCase()) {
          return `${name} (${qid})`
        }
        if (name) {
          return name
        }
        if (qid) {
          return qid
        }
        return rawValue
      }

      function parentUriLabel(item) {
        if (!item || typeof item !== 'object') {
          return t('noValue')
        }
        const parentUri = typeof item.parent_uri === 'string' ? item.parent_uri.trim() : ''
        if (!parentUri) {
          return t('noValue')
        }
        const locationUri = typeof item.location_p276 === 'string' ? item.location_p276.trim() : ''
        const locationLabel = typeof item.location_p276_label === 'string' ? item.location_p276_label.trim() : ''
        if (
          locationUri &&
          normalizeLocationUri(parentUri) === normalizeLocationUri(locationUri) &&
          locationLabel
        ) {
          return linkedEntityLabel(locationUri, locationLabel)
        }
        return displayUriLabel(parentUri)
      }

      function linkedEntityLabel(uriValue, labelValue = '') {
        const label = typeof labelValue === 'string' ? labelValue.trim() : ''
        if (label && !isQidText(label)) {
          return label
        }
        const qid = wikidataQid(uriValue || label)
        if (qid) {
          return qid
        }
        if (label) {
          return label
        }
        return typeof uriValue === 'string' ? uriValue.trim() : ''
      }

      function linkedEntityHref(uriValue, labelValue = '', wikipediaUrl = '') {
        const label = typeof labelValue === 'string' ? labelValue.trim() : ''
        if (isHttpUrl(wikipediaUrl) && label && !isQidText(label)) {
          return wikipediaUrl.trim()
        }
        const wikidataUrl = wikidataEntityUrl(uriValue || label)
        if (wikidataUrl) {
          return wikidataUrl
        }
        if (isHttpUrl(uriValue)) {
          return uriValue.trim()
        }
        return ''
      }

      function combineStreetAndHouseNumber(streetValue, houseNumberValue) {
        const street = typeof streetValue === 'string' ? streetValue.trim() : ''
        const houseNumber = typeof houseNumberValue === 'string' ? houseNumberValue.trim() : ''
        if (street && houseNumber) {
          return `${street} ${houseNumber}`
        }
        return street || houseNumber
      }

      function normalizeAddressPart(value) {
        if (value === null || value === undefined) {
          return ''
        }
        return String(value)
          .toLowerCase()
          .replace(/[.,;:()]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }

      function addressContainsPart(addressText, partText) {
        const normalizedAddress = normalizeAddressPart(addressText)
        const normalizedPart = normalizeAddressPart(partText)
        if (!normalizedAddress || !normalizedPart) {
          return false
        }
        if (normalizedAddress === normalizedPart) {
          return true
        }
        return ` ${normalizedAddress} `.includes(` ${normalizedPart} `)
      }

      function uniqueAddressTexts(values) {
        const uniqueValues = []
        const seenValues = new Set()
        for (const rawValue of values) {
          const text = String(rawValue || '').trim()
          if (!text) {
            continue
          }
          const dedupeKey = normalizeAddressPart(text)
          if (!dedupeKey || seenValues.has(dedupeKey)) {
            continue
          }
          seenValues.add(dedupeKey)
          uniqueValues.push(text)
        }
        return uniqueValues
      }

      function localizedAddressTextsP6375(item) {
        if (!item || typeof item !== 'object') {
          return []
        }

        const fallbackAddressText = String(item.address_text || '').trim()
        const rawValues = Array.isArray(item.address_text_values) ? item.address_text_values : []
        const values = []
        for (const rawValue of rawValues) {
          const entry = rawValue && typeof rawValue === 'object' ? rawValue : {}
          const text = String(entry.text || entry.value || '').trim()
          if (!text) {
            continue
          }
          const language = String(entry.language || entry.lang || '').trim().toLowerCase()
          values.push({ text, language })
        }
        if (!values.length) {
          return fallbackAddressText ? [fallbackAddressText] : []
        }

        const preferredLocale = normalizeSupportedLocale(locale.value) || ''
        const languageCandidates = []
        if (preferredLocale) {
          languageCandidates.push(preferredLocale)
          const baseLanguage = preferredLocale.split('-')[0]
          if (baseLanguage) {
            languageCandidates.push(baseLanguage)
          }
        }

        for (const candidate of languageCandidates) {
          const normalizedCandidate = String(candidate || '').trim().toLowerCase()
          if (!normalizedCandidate) {
            continue
          }
          const matches = values
            .filter((entry) => entry.language === normalizedCandidate)
            .map((entry) => entry.text)
          if (matches.length) {
            return uniqueAddressTexts(matches)
          }
        }

        if (fallbackAddressText) {
          return [fallbackAddressText]
        }

        const noLanguageMatches = values
          .filter((entry) => !entry.language)
          .map((entry) => entry.text)
        if (noLanguageMatches.length) {
          return uniqueAddressTexts(noLanguageMatches)
        }

        const firstLanguage = String(values[0].language || '').trim().toLowerCase()
        if (firstLanguage) {
          return uniqueAddressTexts(
            values
              .filter((entry) => entry.language === firstLanguage)
              .map((entry) => entry.text)
          )
        }
        return uniqueAddressTexts(values.map((entry) => entry.text))
      }

      function streetAddressTextsP669P670(item) {
        if (!item || typeof item !== 'object') {
          return []
        }

        const rawValues = Array.isArray(item.located_on_street_p669_values)
          ? item.located_on_street_p669_values
          : []
        const streetValues = []
        for (const rawValue of rawValues) {
          const entry = rawValue && typeof rawValue === 'object' ? rawValue : {}
          const streetText = combineStreetAndHouseNumber(
            linkedEntityLabel(entry.value, entry.label),
            entry.house_number || entry.houseNumber || '',
          )
          if (streetText) {
            streetValues.push(streetText)
          }
        }

        if (!streetValues.length) {
          const fallbackStreetText = combineStreetAndHouseNumber(
            linkedEntityLabel(item.located_on_street_p669, item.located_on_street_p669_label),
            item.house_number_p670,
          )
          if (fallbackStreetText) {
            streetValues.push(fallbackStreetText)
          }
        }

        return uniqueAddressTexts(streetValues)
      }

      function inlineAddressText(item) {
        if (!item || typeof item !== 'object') {
          return ''
        }

        const addressTextsP6375 = localizedAddressTextsP6375(item)
        const streetTextsP669P670 = streetAddressTextsP669P670(item)
        const postalCodeP281 = String(item.postal_code || '').trim()
        const municipalityTextP131 = linkedEntityLabel(item.municipality_p131, item.municipality_p131_label)

        const buildAddressLine = (baseAddressText) => {
          const parts = []
          const addPart = (rawPart) => {
            const part = String(rawPart || '').trim()
            if (!part) {
              return
            }
            let replaceIndex = -1
            for (let index = 0; index < parts.length; index += 1) {
              const existingPart = parts[index]
              if (normalizeAddressPart(existingPart) === normalizeAddressPart(part)) {
                return
              }
              if (addressContainsPart(existingPart, part)) {
                return
              }
              if (addressContainsPart(part, existingPart)) {
                replaceIndex = index
              }
            }
            if (replaceIndex >= 0) {
              parts[replaceIndex] = part
              return
            }
            parts.push(part)
          }

          addPart(baseAddressText)
          addPart(postalCodeP281)
          addPart(municipalityTextP131)
          return parts.join(', ')
        }

        const lines = []
        const addLine = (rawLine) => {
          const line = String(rawLine || '').trim()
          if (!line) {
            return
          }
          let replaceIndex = -1
          for (let index = 0; index < lines.length; index += 1) {
            const existingLine = lines[index]
            if (normalizeAddressPart(existingLine) === normalizeAddressPart(line)) {
              return
            }
            if (addressContainsPart(existingLine, line)) {
              return
            }
            if (addressContainsPart(line, existingLine)) {
              replaceIndex = index
            }
          }
          if (replaceIndex >= 0) {
            lines[replaceIndex] = line
            return
          }
          lines.push(line)
        }

        for (const addressText of addressTextsP6375) {
          addLine(buildAddressLine(addressText))
        }
        for (const streetText of streetTextsP669P670) {
          addLine(buildAddressLine(streetText))
        }

        if (!lines.length) {
          return ''
        }
        return lines.join('; ')
      }

      function externalIdHref(idType, value) {
        if (typeof value !== 'string') {
          return ''
        }
        const normalizedValue = value.trim()
        if (!normalizedValue) {
          return ''
        }
        if (isHttpUrl(normalizedValue)) {
          return normalizedValue
        }

        if (idType === 'yso') {
          if (/^p\d+$/i.test(normalizedValue)) {
            return `https://www.yso.fi/onto/yso/${normalizedValue.toLowerCase()}`
          }
          if (/^\d+$/.test(normalizedValue)) {
            return `https://www.yso.fi/onto/yso/p${normalizedValue}`
          }
          return `https://www.yso.fi/onto/yso/${encodeURIComponent(normalizedValue)}`
        }
        if (idType === 'yle-topic') {
          return `https://yle.fi/aihe/t/${encodeURIComponent(normalizedValue)}`
        }
        if (idType === 'kanto') {
          return `https://urn.fi/URN:NBN:fi:au:finaf:${encodeURIComponent(normalizedValue)}`
        }
        if (idType === 'protected-buildings-register') {
          return `https://www.kyppi.fi/to.aspx?id=100.${encodeURIComponent(normalizedValue)}`
        }
        if (idType === 'rky') {
          return `https://www.rky.fi/read/asp/r_kohde_det.aspx?KOHDE_ID=${encodeURIComponent(normalizedValue)}`
        }
        return ''
      }

      function linkedEntityValues(item, valueField, labelField, wikipediaField, valuesField = '') {
        if (!item || typeof item !== 'object') {
          return []
        }

        const values = []
        const seenKeys = new Set()
        const addValue = (rawValue, rawLabel = '', rawWikipediaUrl = '') => {
          const value = typeof rawValue === 'string' ? rawValue.trim() : ''
          const label = typeof rawLabel === 'string' ? rawLabel.trim() : ''
          const wikipedia_url = typeof rawWikipediaUrl === 'string' ? rawWikipediaUrl.trim() : ''
          if (!value && !label && !wikipedia_url) {
            return
          }

          const dedupeKey = `${value.toLowerCase()}|${label.toLowerCase()}|${wikipedia_url.toLowerCase()}`
          if (seenKeys.has(dedupeKey)) {
            return
          }
          seenKeys.add(dedupeKey)
          values.push({ value, label, wikipedia_url })
        }

        if (valuesField && Array.isArray(item[valuesField])) {
          for (const entry of item[valuesField]) {
            if (!entry || typeof entry !== 'object') {
              continue
            }
            addValue(entry.value, entry.label, entry.wikipedia_url)
          }
        }

        addValue(item[valueField], item[labelField], item[wikipediaField])
        return values
      }

      const architectP84Entries = computed(() =>
        linkedEntityValues(
          location.value,
          'architect_p84',
          'architect_p84_label',
          'architect_p84_wikipedia_url',
          'architect_p84_values',
        )
      )

      function normalizeSourceEntity(rawEntity, fallbackValue = '', fallbackLabel = '', fallbackWikipediaUrl = '') {
        const entity = rawEntity && typeof rawEntity === 'object' ? rawEntity : {}
        const value = (
          (typeof entity.value === 'string' ? entity.value : '') ||
          (typeof fallbackValue === 'string' ? fallbackValue : '')
        ).trim()
        const label = (
          (typeof entity.label === 'string' ? entity.label : '') ||
          (typeof fallbackLabel === 'string' ? fallbackLabel : '')
        ).trim()
        const wikipedia_url = (
          (typeof entity.wikipedia_url === 'string' ? entity.wikipedia_url : '') ||
          (typeof fallbackWikipediaUrl === 'string' ? fallbackWikipediaUrl : '')
        ).trim()
        return { value, label, wikipedia_url }
      }

      const collectionMembershipSources = computed(() => {
        if (!location.value || typeof location.value !== 'object') {
          return []
        }

        const sources = []
        const seenSources = new Set()
        const addSource = (rawSource) => {
          const source = rawSource && typeof rawSource === 'object' ? rawSource : {}
          const url = String(source.url || source.source_url || '').trim()
          const title = String(source.title || source.source_title || '').trim()
          const title_language = String(source.title_language || source.source_title_language || '').trim()
          const author = String(source.author || source.source_author || '').trim()
          const publication_date = String(
            source.publication_date || source.source_publication_date || ''
          ).trim()
          const retrieved_date = String(source.retrieved_date || source.source_retrieved_date || '').trim()
          const publisher = normalizeSourceEntity(
            source.publisher,
            source.source_publisher_p123 || source.publisher_value || '',
            source.source_publisher_p123_label || source.publisher_label || '',
            source.source_publisher_p123_wikipedia_url || source.publisher_wikipedia_url || '',
          )
          const published_in = normalizeSourceEntity(
            source.published_in,
            source.source_published_in_p1433 || source.published_in_value || '',
            source.source_published_in_p1433_label || source.published_in_label || '',
            source.source_published_in_p1433_wikipedia_url || source.published_in_wikipedia_url || '',
          )
          const language_of_work = normalizeSourceEntity(
            source.language_of_work,
            source.source_language_of_work_p407 || source.language_of_work_value || '',
            source.source_language_of_work_p407_label || source.language_of_work_label || '',
            source.source_language_of_work_p407_wikipedia_url || source.language_of_work_wikipedia_url || '',
          )

          if (
            !url &&
            !title &&
            !title_language &&
            !author &&
            !publication_date &&
            !retrieved_date &&
            !publisher.value &&
            !publisher.label &&
            !published_in.value &&
            !published_in.label
          ) {
            return
          }

          const dedupeKey = url
            ? `url|${url.toLowerCase()}`
            : [
                title.toLowerCase(),
                author.toLowerCase(),
                publication_date.toLowerCase(),
                retrieved_date.toLowerCase(),
                publisher.value.toLowerCase(),
                published_in.value.toLowerCase(),
              ].join('|')
          if (seenSources.has(dedupeKey)) {
            return
          }
          seenSources.add(dedupeKey)
          const citationParts = []
          if (author) {
            citationParts.push({ text: author, href: '' })
          }

          const titleOrUrl = title || url
          if (titleOrUrl) {
            const titleText = title ? `"${title}"` : titleOrUrl
            citationParts.push({
              text: titleText,
              href: isHttpUrl(url) ? url : '',
            })
          }

          const appendEntityCitationPart = (entity) => {
            if (!entity || typeof entity !== 'object') {
              return
            }
            const text = linkedEntityLabel(entity.value, entity.label)
            const href = linkedEntityHref(entity.value, entity.label, entity.wikipedia_url)
            if (!text) {
              return
            }
            citationParts.push({ text, href })
          }
          appendEntityCitationPart(published_in)
          appendEntityCitationPart(publisher)
          if (publication_date) {
            citationParts.push({
              text: formatWikidataDate(publication_date),
              href: '',
            })
          }

          if (citationParts.length === 0) {
            citationParts.push({ text: t('noValue'), href: '' })
          }

          sources.push({
            url,
            title,
            title_language,
            author,
            publication_date,
            retrieved_date,
            publisher,
            published_in,
            citation_parts: citationParts,
          })
        }

        if (Array.isArray(location.value.collection_membership_sources)) {
          for (const source of location.value.collection_membership_sources) {
            addSource(source)
          }
        }
        if (Array.isArray(location.value.collection_membership_source_urls)) {
          for (const sourceUrl of location.value.collection_membership_source_urls) {
            addSource({ url: sourceUrl })
          }
        }
        addSource({ url: location.value.collection_membership_source_url })
        return sources
      })

      function formatWikidataDate(value) {
        if (typeof value !== 'string') {
          return ''
        }

        const trimmed = value.trim()
        if (!trimmed) {
          return ''
        }

        const parsed = parseWikidataDateParts(trimmed)
        if (!parsed) {
          return trimmed.replace(/^\+/, '')
        }

        const year = parsed.year
        const month = String(parsed.month).padStart(2, '0')
        const day = String(parsed.day).padStart(2, '0')
        if (year >= 1 && year <= 9999) {
          const isoDate = `${String(year).padStart(4, '0')}-${month}-${day}T00:00:00Z`
          const date = new Date(isoDate)
          if (!Number.isNaN(date.getTime())) {
            return new Intl.DateTimeFormat(locale.value, {
              timeZone: 'UTC',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }).format(date)
          }
        }

        return `${String(year).replace(/^\+/, '')}-${month}-${day}`
      }

      function formatImageCount(value) {
        return formatCountValue(value, locale.value, t('noValue'))
      }

      function hasImageCount(value) {
        return value !== null && value !== undefined && value !== ''
      }

      function preferredImageSource(item) {
        return preferredCommonsImageSource(item)
      }

      function preferredImageCount(item) {
        return preferredCommonsImageCount(item)
      }

      function preferredImageHref(item) {
        return preferredCommonsImageHref(item)
      }

      function commonsImagesLabel(item) {
        const sourceKey = preferredImageSource(item)
        if (!sourceKey) {
          return ''
        }
        const sourceLabel = sourceKey === 'view-it' ? t('imageSourceViewIt') : t('imageSourcePetScan')
        return t('commonsImagesWithSource', { source: sourceLabel })
      }

      function formatCoordinates(latitude, longitude) {
        return formatCoordinatePair(latitude, longitude, locale.value)
      }

      function locationDisplayName(item) {
        if (!item || typeof item !== 'object') {
          return t('noValue')
        }
        if (typeof item.name === 'string' && item.name.trim()) {
          return item.name.trim()
        }
        if (typeof item.uri === 'string' && item.uri.trim()) {
          return item.uri.trim()
        }
        return t('noValue')
      }

      function hasDetailImage(item) {
        if (!item || typeof item !== 'object') {
          return false
        }
        const thumbUrl = typeof item.image_thumb_url === 'string' ? item.image_thumb_url.trim() : ''
        const imageUrl = typeof item.image_url === 'string' ? item.image_url.trim() : ''
        return Boolean(thumbUrl || imageUrl)
      }

      function detailImageSrc(item) {
        if (!item || typeof item !== 'object') {
          return DETAIL_IMAGE_PLACEHOLDER_DATA_URI
        }
        const thumbUrl = typeof item.image_thumb_url === 'string' ? item.image_thumb_url.trim() : ''
        if (thumbUrl) {
          return thumbUrl
        }
        const imageUrl = typeof item.image_url === 'string' ? item.image_url.trim() : ''
        if (imageUrl) {
          return imageUrl
        }
        return DETAIL_IMAGE_PLACEHOLDER_DATA_URI
      }

      function detailImageFallbackSrc(item) {
        if (!item || typeof item !== 'object') {
          return DETAIL_IMAGE_PLACEHOLDER_DATA_URI
        }
        const thumbUrl = typeof item.image_thumb_url === 'string' ? item.image_thumb_url.trim() : ''
        const imageUrl = typeof item.image_url === 'string' ? item.image_url.trim() : ''
        if (thumbUrl && imageUrl && thumbUrl !== imageUrl) {
          return imageUrl
        }
        return DETAIL_IMAGE_PLACEHOLDER_DATA_URI
      }

      const detailInlineAddress = computed(() => inlineAddressText(location.value))

      const hasMediaMetadata = computed(() => {
        if (!location.value) {
          return false
        }
        return Boolean(
          location.value.commons_category ||
          preferredImageSource(location.value)
        )
      })

      function detailsAriaLabel(nameValue) {
        return t('openDetailsFor', { name: displayValue(nameValue, t('noValue')) })
      }

      watch(
        [() => props.id, () => locale.value, () => locationsVersion.value],
        loadLocation,
        { immediate: true }
      )
      watch(
        () => props.id,
        () => {
          if (showSaveImageApiForm.value || showSaveImageCoordinatePickerDialog.value) {
            _closeSaveImageDialogs()
          }
        }
      )
      watch(
        [
          () => isSaveImageDialogOpen.value,
          () => saveImageLatitude.value,
          () => saveImageLongitude.value,
        ],
        async ([isOpen], previousValues = []) => {
          const previousOpen = Array.isArray(previousValues) ? Boolean(previousValues[0]) : false
          if (!isOpen) {
            destroySaveImageWizardMap()
            destroySaveImageSubjectMap()
            _clearSaveImageNearbyCategorySuggestions()
            _clearSaveImageNearbyDepictSuggestions()
            _clearSaveImageSubjectMapFeatures()
            return
          }
          refreshSaveImageNearbyCategorySuggestionsDebounced()
          if (!previousOpen) {
            await nextTick()
            ensureSaveImageWizardMap()
          }
        }
      )
      watch(
        [
          () => showSaveImageApiForm.value,
          () => saveImageLatitude.value,
          () => saveImageLongitude.value,
          () => saveImageHeading.value,
          () => saveImageApiCoordinateMode.value,
        ],
        async ([isOpen]) => {
          if (!isOpen) {
            destroySaveImageCoordinatePreviewMap()
            return
          }
          await nextTick()
          ensureSaveImageCoordinatePreviewMap()
        }
      )
      watch(
        [
          () => showSaveImageApiForm.value,
          () => saveImageSubjectTypeLocationRelevant.value,
          () => saveImageSubjectMapElement.value,
        ],
        async ([isOpen, isLocationRelevant]) => {
          if (!isOpen || !isLocationRelevant) {
            destroySaveImageSubjectMap()
            _clearSaveImageSubjectMapFeatures()
            return
          }
          await nextTick()
          ensureSaveImageSubjectMap()
        }
      )
      watch(
        [
          () => isSaveImageDialogOpen.value,
          () => saveImageSelectedCategories.value.map((categoryName) => String(categoryName || '').toLowerCase()).join('|'),
          () => saveImageLatitude.value,
          () => saveImageLongitude.value,
        ],
        ([isOpen]) => {
          if (!isOpen) {
            saveImageSubcategoryToken += 1
            saveImageSubcategorySuggestions.value = []
            saveImageSubcategoryFarSuggestions.value = []
            saveImageSubcategoryLoading.value = false
            _clearSaveImageSelectedCategoryAncestors()
            return
          }
          _refreshSaveImageCategoryExistenceState()
          void refreshSaveImageSelectedCategoryAncestorDedupeKeys()
          void loadSaveImageSubcategorySuggestions()
        }
      )
      watch(
        () => saveImageSelectedFile.value,
        (nextFile) => {
          if (saveImagePreviewUrl.value && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(saveImagePreviewUrl.value)
          }
          saveImagePreviewUrl.value = ''
          if (!nextFile || typeof nextFile !== 'object') {
            return
          }
          const fileType = typeof nextFile.type === 'string' ? nextFile.type.trim().toLowerCase() : ''
          if (fileType && !fileType.startsWith('image/')) {
            return
          }
          if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
            return
          }
          try {
            saveImagePreviewUrl.value = URL.createObjectURL(nextFile)
          } catch (error) {
            void error
            saveImagePreviewUrl.value = ''
          }
        }
      )
      watch(
        [() => saveImageIsOwnPhoto.value, () => authUsername.value],
        () => {
          _syncSaveImageAuthorFromOwnershipSelection()
        }
      )
      watch(
        [
          () => isSaveImageDialogOpen.value,
          () => (
            Array.isArray(saveImageLinkedSubjects.value)
              ? saveImageLinkedSubjects.value
              : []
          ).map((linkedItem) => extractWikidataId(
            String(
              linkedItem && typeof linkedItem === 'object'
                ? linkedItem.id || ''
                : '',
            ),
          )).filter(Boolean).sort().join('|'),
          () => (
            location.value && typeof location.value === 'object'
              ? [
                String(location.value.municipality_p131_label || '').trim(),
                String(location.value.location_p276_label || '').trim(),
                String(location.value.name || '').trim(),
              ].filter(Boolean).join('|')
              : ''
          ),
        ],
        ([isOpen]) => {
          if (!isOpen) {
            return
          }
          refreshSaveImageNearbyCategorySuggestionsDebounced()
        },
      )
      watch(
        () => saveImageApiDateCreated.value,
        () => {
          _applySuggestedSaveImageTargetFilenameIfAllowed()
          if (!isSaveImageDialogOpen.value) {
            return
          }
          refreshSaveImageNearbyCategorySuggestionsDebounced()
        }
      )
      watch(
        [
          () => (
            Array.isArray(saveImageSelectedCategories.value)
              ? saveImageSelectedCategories.value
              : []
          ).map((categoryName) => _normalizeUploadCategory(categoryName).toLowerCase()).filter(Boolean).join('|'),
          () => (
            Array.isArray(saveImageLinkedSubjects.value)
              ? saveImageLinkedSubjects.value
              : []
          ).map((linkedItem) => {
            if (!linkedItem || typeof linkedItem !== 'object') {
              return ''
            }
            const qid = extractWikidataId(String(linkedItem.id || ''))
            const label = typeof linkedItem.label === 'string' ? linkedItem.label.trim().toLowerCase() : ''
            return `${qid}|${label}`
          }).filter(Boolean).join('|'),
          () => (
            location.value &&
            typeof location.value === 'object' &&
            typeof location.value.name === 'string'
          ) ? location.value.name.trim() : '',
          () => saveImageFilenameBuilderUseSubjects.value,
          () => saveImageFilenameBuilderUseDate.value,
          () => saveImageFilenameBuilderUseLocation.value,
          () => saveImageFilenameBuilderUseCategories.value,
        ],
        () => {
          _applySuggestedSaveImageTargetFilenameIfAllowed()
        },
      )
      onBeforeUnmount(() => {
        destroyDetailMap()
        destroySaveImageWizardMap()
        destroySaveImageCoordinatePreviewMap()
        destroySaveImageSubjectMap()
        if (saveImagePreviewUrl.value && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(saveImagePreviewUrl.value)
          saveImagePreviewUrl.value = ''
        }
      })

      return {
        t,
        location,
        loading,
        error,
        childLocations,
        childrenLoading,
        childrenError,
        canCreateSubLocation,
        canSaveImage,
        detailMapElement,
        hasDetailMapCoordinates,
        openSubLocationCreator,
        showSaveImageApiForm,
        showSaveImageCoordinatePickerDialog,
        saveImageCoordinatePickerHasPreview,
        saveImageCoordinatePickerPreviewCollapsed,
        saveImageMapElement,
        saveImageCoordinatePreviewMapElement,
        saveImageLatitude,
        saveImageLongitude,
        saveImageHeading,
        saveImageApiCoordinateMode,
        saveImageApiUsesPhotographerCoordinates,
        saveImagePreviewUsesHeadingIndicator,
        saveImageMapPickHelpText,
        saveImageHeadingDisplay,
        saveImageCaption,
        saveImageCaptionLanguage,
        saveImageDescription,
        saveImageDescriptionLanguage,
        saveImageSubjectType,
        saveImageSubjectLinkMode,
        saveImageSubjectLinkUsesMap,
        saveImageSubjectTypeLocationRelevant,
        saveImageSubjectMapElement,
        saveImageSubjectMapLatitude,
        saveImageSubjectMapLongitude,
        saveImageSubjectMapHasPoint,
        saveImageSubjectMapZoomLevel,
        saveImageSubjectImageXPercent,
        saveImageSubjectImageYPercent,
        saveImageSubjectImageHasPoint,
        saveImageSubjectImageMarkerStyle,
        saveImageSubjectLinkedImageMarkers,
        saveImageSubjectWikidataSearch,
        saveImageSubjectWikidataSuggestions,
        saveImageSubjectWikidataLoading,
        saveImageSubjectSelectedWikidataItem,
        saveImageSubjectSelectedWikidataQid,
        saveImageSubjectDirectWikidataItem,
        saveImageSubjectCanAddLink,
        saveImageSubjectPendingLinkedSubject,
        saveImageSubjectNearbyMapFeatures,
        saveImageSubjectMapFeaturesLoading,
        saveImageSubjectMapFeaturesError,
        saveImageSelectedSubjectMapFeature,
        saveImageSubjectHasActiveSelection,
        saveImageVisibleSubjectSelectedFeatureWikidataSuggestions,
        saveImageSubjectSelectedFeatureWikidataLoading,
        formatSaveImageSubjectMapFeatureCoordinates,
        formatSaveImageSubjectMapFeatureDistance,
        formatSaveImageLinkedSubjectCoordinates,
        formatSaveImageLinkedSubjectImagePoint,
        saveImageLinkedSubjectListPinStyle,
        saveImageSubjectSelectionError,
        saveImageLinkedSubjects,
        saveImageFileInputElement,
        saveImageSelectedFileName,
        saveImagePreviewUrl,
        saveImageExifMetadataLoading,
        saveImageExifDateTaken,
        saveImageExifHeading,
        saveImageExifElevation,
        saveImageHasExifCoordinates,
        saveImageExifCoordinatesDisplay,
        saveImageCanResetToExifCoordinates,
        saveImageHasInitialWikidataCoordinates,
        saveImageWikidataCoordinatesDisplay,
        saveImageCanResetToWikidataCoordinates,
        saveImageHasCoordinatePreview,
        saveImageHasElevationValue,
        saveImageElevationDisplay,
        saveImageHasExifMetadata,
        saveImageApiUploading,
        saveImageUploadResult,
        saveImageApiTargetFilename,
        saveImageFilenameBuilderPreview,
        saveImageApiTargetFilenameChecking,
        saveImageApiTargetFilenameAvailable,
        saveImageApiTargetFilenameCheckError,
        saveImageIsOwnPhoto,
        saveImageShowSourceUrl,
        saveImageApiAuthor,
        saveImageApiSourceUrl,
        saveImageApiDateCreated,
        saveImageApiLicenseTemplate,
        saveImageApiElevationMeters,
        saveImageIncludeElevation,
        saveImageCategorySearch,
        saveImageCategorySuggestions,
        saveImageCategoryLoading,
        saveImageVisibleNearbyCategorySuggestions,
        saveImageSelectedBroadCategoryConflicts,
        saveImageNearbyCategoryLoading,
        saveImageDepictSearch,
        saveImageDepictSuggestions,
        saveImageDepictLoading,
        saveImageVisibleNearbyDepictSuggestions,
        saveImageNearbyDepictLoading,
        saveImageSubcategorySuggestions,
        saveImageSubcategoryFarSuggestions,
        saveImageSubcategoryLoading,
        saveImageSelectedCategories,
        saveImageSelectedDepicts,
        saveImageCategoryExists,
        saveImageError,
        openSaveImageApiForm,
        openSaveImageCoordinatePickerDialog,
        toggleSaveImageCoordinatePickerPreview,
        closeSaveImageCoordinatePickerDialog,
        onSaveImageMapElementReady,
        closeSaveImageApiForm,
        onSaveImageOwnPhotoChange,
        onSaveImageSubjectTypeChange,
        onSaveImageSubjectLinkModeChange,
        onSaveImageSubjectImagePreviewClick,
        onSaveImageSubjectWikidataInput,
        onSaveImageSubjectWikidataFocus,
        onSaveImageSubjectWikidataKeydown,
        hideSaveImageSubjectWikidataSuggestionsSoon,
        selectSaveImageSubjectWikidataSuggestion,
        selectSaveImageSubjectDirectWikidataSuggestion,
        isSaveImageSubjectWikidataSuggestionSelected,
        clearSaveImageSubjectWikidataSelection,
        selectSaveImageSubjectMapFeature,
        showSaveImageSubjectNearbyFeatureList,
        isSaveImageSubjectMapFeatureSelected,
        isSaveImageSubjectMapFeatureHovered,
        onSaveImageSubjectMapFeatureMouseEnter,
        onSaveImageSubjectMapFeatureMouseLeave,
        selectSaveImageSubjectFeatureWikidataSuggestion,
        addSaveImageSubjectLink,
        removeSaveImageLinkedSubject,
        onSaveImageApiCoordinateModeChange,
        setSaveImageApiCoordinateMode,
        onSaveImageMapCenterIconClick,
        onSaveImageApiTargetFilenameInput,
        onSaveImageApiTargetFilenameBlur,
        isSaveImageFilenameBuilderPartEnabled,
        toggleSaveImageFilenameBuilderPart,
        applySaveImageFilenameBuilderSuggestion,
        resetSaveImageCoordinatesToExif,
        resetSaveImageCoordinatesToWikidata,
        saveImageViaMediaWikiApi,
        onSaveImageFileInputChange,
        onSaveImageCategoryInput,
        onSaveImageCategoryFocus,
        onSaveImageCategoryKeydown,
        addSaveImageCategoriesFromInput,
        hideSaveImageCategorySuggestionsSoon,
        selectSaveImageCategory,
        selectSaveImageNearbyCategorySuggestion,
        selectSaveImageSubcategorySuggestion,
        removeSaveImageCategory,
        onSaveImageDepictInput,
        onSaveImageDepictFocus,
        onSaveImageDepictKeydown,
        addSaveImageDepictsFromInput,
        hideSaveImageDepictSuggestionsSoon,
        selectSaveImageDepictSuggestion,
        selectSaveImageNearbyDepictSuggestion,
        removeSaveImageDepict,
        isSaveImageBroaderCategoryConflict,
        displayUploadCategory,
        saveImageCategoryHref,
        saveImageDepictDisplayLabel,
        saveImageDepictHref,
        resolveLocationId,
        isInternalChildLocation,
        parentLocationId,
        isHttpUrl,
        isWikidataEntityUri,
        wikidataQid,
        wikidataEntityUrl,
        wikidataLinkText,
        displayUriLabel,
        linkedEntityLabel,
        linkedEntityHref,
        sourceUriLabel,
        detailInlineAddress,
        wikidataItemLabel,
        parentUriLabel,
        architectP84Entries,
        collectionMembershipSources,
        formatWikidataDate,
        formatImageCount,
        hasImageCount,
        preferredImageSource,
        preferredImageCount,
        preferredImageHref,
        commonsImagesLabel,
        formatCoordinates,
        locationDisplayName,
        hasDetailImage,
        detailImageSrc,
        detailImageFallbackSrc,
        hasMediaMetadata,
        detailsAriaLabel,
        handleImageLoadError,
        externalIdHref,
        combineStreetAndHouseNumber,
        displayValue,
      }
    },
    template: `
      <section class="view-section detail-view" :aria-busy="loading ? 'true' : 'false'">
        <p v-if="!id" class="status" role="status" aria-live="polite">{{ t('detailHint') }}</p>
        <p v-else-if="loading" class="status" role="status" aria-live="polite">{{ t('loading') }}</p>
        <p v-else-if="error" class="status error" role="alert">{{ error }}</p>

        <article v-else-if="location" class="detail-card">
          <header class="detail-header">
            <div class="detail-header-main">
              <h2 class="detail-title">
                <span>{{ locationDisplayName(location) }}</span>
                <span
                  v-if="wikidataQid(location.uri || location.wikidata_item)"
                  class="detail-title-qid"
                >
                  (<a
                    class="detail-title-qid-link"
                    :href="wikidataEntityUrl(location.uri || location.wikidata_item)"
                    target="_blank"
                    rel="noreferrer"
                  >{{ wikidataQid(location.uri || location.wikidata_item) }}</a>)
                </span>
              </h2>
              <p v-if="location.description" class="detail-description">{{ location.description }}</p>
            </div>
            <div v-if="canSaveImage" class="detail-header-actions">
              <button type="button" class="primary-btn" @click="openSaveImageApiForm">
                {{ t('saveImage') }}
              </button>
            </div>
          </header>
          <div class="detail-media-layout">
            <figure class="detail-image">
              <img
                :class="['thumb-image', { 'thumb-image--placeholder': !hasDetailImage(location) }]"
                :src="detailImageSrc(location)"
                :alt="location.image_name || locationDisplayName(location)"
                loading="lazy"
                @error="(event) => handleImageLoadError(event, detailImageFallbackSrc(location))"
              />
              <figcaption
                v-if="hasMediaMetadata || !hasDetailImage(location)"
                class="detail-media-caption"
                :aria-label="t('mediaAndCounts')"
              >
                <span v-if="!hasDetailImage(location)" class="detail-media-caption-line">
                  {{ t('imagePlaceholderLabel') }}
                </span>
                <span v-if="location.commons_category" class="detail-media-caption-line">
                  <span class="detail-media-caption-label">{{ t('commonsCategory') }}:</span>
                  <a
                    v-if="isHttpUrl(location.commons_category_url)"
                    :href="location.commons_category_url"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ location.commons_category }}
                  </a>
                  <span v-else>{{ location.commons_category }}</span>
                </span>
                <span v-if="preferredImageSource(location)" class="detail-media-caption-line">
                  <span class="detail-media-caption-label">{{ commonsImagesLabel(location) }}:</span>
                  <a
                    v-if="preferredImageHref(location)"
                    :href="preferredImageHref(location)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ formatImageCount(preferredImageCount(location)) }}
                  </a>
                  <span v-else>{{ formatImageCount(preferredImageCount(location)) }}</span>
                </span>
              </figcaption>
            </figure>
            <div v-if="hasDetailMapCoordinates" class="detail-mini-map-wrap">
              <p class="detail-mini-map-title">{{ t('locationOnMap') }}</p>
              <div
                ref="detailMapElement"
                class="map-canvas detail-mini-map"
                :aria-label="t('locationOnMap')"
              ></div>
              <p class="detail-mini-map-coordinates">
                <strong>{{ t('coordinates') }}:</strong>
                <span>{{ formatCoordinates(location.latitude, location.longitude) }}</span>
              </p>
            </div>
          </div>
          <section class="detail-section">
            <h3>{{ t('basicInformation') }}</h3>
            <dl class="meta-list detail-meta-list">
              <div v-if="location.location_type" class="meta-row">
                <dt>{{ t('locationType') }}</dt>
                <dd>{{ location.location_type }}</dd>
              </div>
              <div v-if="location.wikidata_item" class="meta-row">
                <dt>{{ t('wikidataItem') }}</dt>
                <dd>
                  <a
                    v-if="wikidataEntityUrl(location.wikidata_item)"
                    :href="wikidataEntityUrl(location.wikidata_item)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ wikidataItemLabel(location) }}
                  </a>
                  <span v-else>{{ wikidataItemLabel(location) }}</span>
                </dd>
              </div>
              <div v-if="!hasDetailMapCoordinates" class="meta-row">
                <dt>{{ t('coordinates') }}</dt>
                <dd>{{ formatCoordinates(location.latitude, location.longitude) }}</dd>
              </div>
              <div v-if="detailInlineAddress" class="meta-row">
                <dt>{{ t('addressText') }}</dt>
                <dd>{{ detailInlineAddress }}</dd>
              </div>
              <div v-if="location.instance_of_p31" class="meta-row">
                <dt>{{ t('instanceOfP31') }}</dt>
                <dd>
                  <a
                    v-if="linkedEntityHref(location.instance_of_p31, location.instance_of_p31_label, location.instance_of_p31_wikipedia_url)"
                    :href="linkedEntityHref(location.instance_of_p31, location.instance_of_p31_label, location.instance_of_p31_wikipedia_url)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ linkedEntityLabel(location.instance_of_p31, location.instance_of_p31_label) }}
                  </a>
                  <span v-else>{{ linkedEntityLabel(location.instance_of_p31, location.instance_of_p31_label) }}</span>
                </dd>
              </div>
              <div v-if="location.architectural_style_p149" class="meta-row">
                <dt>{{ t('architecturalStyleP149') }}</dt>
                <dd>
                  <a
                    v-if="linkedEntityHref(location.architectural_style_p149, location.architectural_style_p149_label, location.architectural_style_p149_wikipedia_url)"
                    :href="linkedEntityHref(location.architectural_style_p149, location.architectural_style_p149_label, location.architectural_style_p149_wikipedia_url)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ linkedEntityLabel(location.architectural_style_p149, location.architectural_style_p149_label) }}
                  </a>
                  <span v-else>{{ linkedEntityLabel(location.architectural_style_p149, location.architectural_style_p149_label) }}</span>
                </dd>
              </div>
              <div v-if="location.heritage_designation_p1435" class="meta-row">
                <dt>{{ t('heritageDesignationP1435') }}</dt>
                <dd>
                  <a
                    v-if="linkedEntityHref(location.heritage_designation_p1435, location.heritage_designation_p1435_label, location.heritage_designation_p1435_wikipedia_url)"
                    :href="linkedEntityHref(location.heritage_designation_p1435, location.heritage_designation_p1435_label, location.heritage_designation_p1435_wikipedia_url)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ linkedEntityLabel(location.heritage_designation_p1435, location.heritage_designation_p1435_label) }}
                  </a>
                  <span v-else>{{ linkedEntityLabel(location.heritage_designation_p1435, location.heritage_designation_p1435_label) }}</span>
                </dd>
              </div>
              <div v-if="location.route_instruction_p2795" class="meta-row">
                <dt>{{ t('routeInstructionP2795') }}</dt>
                <dd>{{ location.route_instruction_p2795 }}</dd>
              </div>
              <div v-if="location.parent_uri" class="meta-row">
                <dt>{{ t('parentLocation') }}</dt>
                <dd>
                  <RouterLink
                    v-if="parentLocationId()"
                    :to="{ name: 'detail', params: { id: parentLocationId() } }"
                    :aria-label="detailsAriaLabel(location.parent_uri)"
                  >
                    {{ parentUriLabel(location) }}
                  </RouterLink>
                  <span v-else>{{ parentUriLabel(location) }}</span>
                </dd>
              </div>
              <div v-if="location.uri && !isWikidataEntityUri(location.uri)" class="meta-row">
                <dt>{{ t('sourceUri') }}</dt>
                <dd>
                  <a
                    v-if="isHttpUrl(location.uri)"
                    :href="location.uri"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ sourceUriLabel(location) }}
                  </a>
                  <span v-else>{{ sourceUriLabel(location) }}</span>
                </dd>
              </div>
              <div v-if="location.inception_p571" class="meta-row">
                <dt>{{ t('inceptionP571') }}</dt>
                <dd>{{ formatWikidataDate(location.inception_p571) }}</dd>
              </div>
              <div v-if="location.location_p276" class="meta-row">
                <dt>{{ t('locationP276') }}</dt>
                <dd>
                  <a
                    v-if="linkedEntityHref(location.location_p276, location.location_p276_label, location.location_p276_wikipedia_url)"
                    :href="linkedEntityHref(location.location_p276, location.location_p276_label, location.location_p276_wikipedia_url)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ linkedEntityLabel(location.location_p276, location.location_p276_label) }}
                  </a>
                  <span v-else>{{ linkedEntityLabel(location.location_p276, location.location_p276_label) }}</span>
                </dd>
              </div>
              <div v-if="architectP84Entries.length > 0" class="meta-row">
                <dt>{{ t('architectP84') }}</dt>
                <dd>
                  <template v-for="(architect, index) in architectP84Entries" :key="index">
                    <a
                      v-if="linkedEntityHref(architect.value, architect.label, architect.wikipedia_url)"
                      :href="linkedEntityHref(architect.value, architect.label, architect.wikipedia_url)"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {{ linkedEntityLabel(architect.value, architect.label) }}
                    </a>
                    <span v-else>{{ linkedEntityLabel(architect.value, architect.label) }}</span>
                    <span v-if="index < architectP84Entries.length - 1">, </span>
                  </template>
                </dd>
              </div>
              <div v-if="location.official_closure_date_p3999" class="meta-row">
                <dt>{{ t('officialClosureDateP3999') }}</dt>
                <dd>{{ formatWikidataDate(location.official_closure_date_p3999) }}</dd>
              </div>
              <div v-if="location.state_of_use_p5817" class="meta-row">
                <dt>{{ t('stateOfUseP5817') }}</dt>
                <dd>
                  <a
                    v-if="linkedEntityHref(location.state_of_use_p5817, location.state_of_use_p5817_label, location.state_of_use_p5817_wikipedia_url)"
                    :href="linkedEntityHref(location.state_of_use_p5817, location.state_of_use_p5817_label, location.state_of_use_p5817_wikipedia_url)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ linkedEntityLabel(location.state_of_use_p5817, location.state_of_use_p5817_label) }}
                  </a>
                  <span v-else>{{ linkedEntityLabel(location.state_of_use_p5817, location.state_of_use_p5817_label) }}</span>
                </dd>
              </div>
              <div v-if="location.yso_id_p2347" class="meta-row">
                <dt>{{ t('ysoIdP2347') }}</dt>
                <dd>
                  <a
                    v-if="externalIdHref('yso', location.yso_id_p2347)"
                    :href="externalIdHref('yso', location.yso_id_p2347)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ location.yso_id_p2347 }}
                  </a>
                  <span v-else>{{ location.yso_id_p2347 }}</span>
                </dd>
              </div>
              <div v-if="location.kanto_id_p8980" class="meta-row">
                <dt>{{ t('kantoIdP8980') }}</dt>
                <dd>
                  <a
                    v-if="externalIdHref('kanto', location.kanto_id_p8980)"
                    :href="externalIdHref('kanto', location.kanto_id_p8980)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ location.kanto_id_p8980 }}
                  </a>
                  <span v-else>{{ location.kanto_id_p8980 }}</span>
                </dd>
              </div>
              <div v-if="location.protected_buildings_register_in_finland_id_p5310" class="meta-row">
                <dt>{{ t('protectedBuildingsRegisterInFinlandIdP5310') }}</dt>
                <dd>
                  <a
                    v-if="externalIdHref('protected-buildings-register', location.protected_buildings_register_in_finland_id_p5310)"
                    :href="externalIdHref('protected-buildings-register', location.protected_buildings_register_in_finland_id_p5310)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ location.protected_buildings_register_in_finland_id_p5310 }}
                  </a>
                  <span v-else>{{ location.protected_buildings_register_in_finland_id_p5310 }}</span>
                </dd>
              </div>
              <div v-if="location.rky_national_built_heritage_environment_id_p4009" class="meta-row">
                <dt>{{ t('rkyNationalBuiltHeritageEnvironmentIdP4009') }}</dt>
                <dd>
                  <a
                    v-if="externalIdHref('rky', location.rky_national_built_heritage_environment_id_p4009)"
                    :href="externalIdHref('rky', location.rky_national_built_heritage_environment_id_p4009)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ location.rky_national_built_heritage_environment_id_p4009 }}
                  </a>
                  <span v-else>{{ location.rky_national_built_heritage_environment_id_p4009 }}</span>
                </dd>
              </div>
              <div v-if="location.permanent_building_number_vtj_prt_p3824" class="meta-row">
                <dt>{{ t('permanentBuildingNumberVtjPrtP3824') }}</dt>
                <dd>{{ location.permanent_building_number_vtj_prt_p3824 }}</dd>
              </div>
              <div v-if="location.protected_buildings_register_in_finland_building_id_p5313" class="meta-row">
                <dt>{{ t('protectedBuildingsRegisterInFinlandBuildingIdP5313') }}</dt>
                <dd>{{ location.protected_buildings_register_in_finland_building_id_p5313 }}</dd>
              </div>
              <div v-if="location.helsinki_persistent_building_id_ratu_p8355" class="meta-row">
                <dt>{{ t('helsinkiPersistentBuildingIdRatuP8355') }}</dt>
                <dd>{{ location.helsinki_persistent_building_id_ratu_p8355 }}</dd>
              </div>
            </dl>
          </section>
          <section v-if="collectionMembershipSources.length > 0" class="detail-section">
            <h3>{{ t('sourcesSectionTitle') }}</h3>
            <ol class="source-citation-list">
              <li
                v-for="(source, index) in collectionMembershipSources"
                :key="'collection-source-' + index"
                class="source-citation-item"
              >
                <cite class="source-citation-text">
                  <template v-for="(part, partIndex) in source.citation_parts" :key="'source-citation-' + index + '-' + partIndex">
                    <span v-if="partIndex > 0">, </span>
                    <a
                      v-if="part.href"
                      :href="part.href"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {{ part.text }}
                    </a>
                    <span v-else>{{ part.text }}</span>
                  </template>
                  <span>.</span>
                </cite>
              </li>
            </ol>
          </section>
          <section class="detail-tree">
            <h3>{{ t('subLocations') }}</h3>
            <p v-if="childrenError" class="status error" role="alert">{{ childrenError }}</p>
            <p v-else-if="childrenLoading && childLocations.length === 0" class="status" role="status" aria-live="polite">{{ t('loading') }}</p>
            <p v-else-if="childLocations.length === 0" class="status">{{ t('noSubLocations') }}</p>
            <ul v-else class="tree-list">
              <li v-for="(child, index) in childLocations" :key="resolveLocationId(child) || child.uri || ('child-' + index)">
                <RouterLink
                  v-if="isInternalChildLocation(child) && resolveLocationId(child)"
                  :to="{ name: 'detail', params: { id: resolveLocationId(child) } }"
                  :aria-label="detailsAriaLabel(child.name || child.uri)"
                >
                  {{ locationDisplayName(child) }}
                </RouterLink>
                <a
                  v-else-if="isHttpUrl(child.uri)"
                  :href="child.uri"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ locationDisplayName(child) }}
                </a>
                <span v-else>{{ locationDisplayName(child) }}</span>
              </li>
            </ul>
          </section>
          <div class="detail-actions">
            <RouterLink to="/">{{ t('backToList') }}</RouterLink>
          </div>

          <div v-if="showSaveImageApiForm" class="dialog-backdrop" @click.self="closeSaveImageApiForm">
            <section class="dialog-card dialog-card-wide" role="dialog" aria-modal="true">
              <h2>{{ t('saveImageApiFormTitle') }}</h2>
              <fieldset class="dialog-fieldset">
                <p class="dialog-help">{{ t('saveImageApiFormHelp') }}</p>

                <label class="form-field">
                  <span>{{ t('saveImageFile') }}</span>
                  <input
                    ref="saveImageFileInputElement"
                    type="file"
                    accept=".mp3,.flac,.ogg,.svg,.png,.tif,.tiff,.webp,.webm,.jpg,.jpeg,audio/mpeg,audio/mp3,audio/flac,audio/x-flac,audio/ogg,video/ogg,application/ogg,image/svg+xml,image/png,image/tiff,image/x-tiff,image/webp,video/webm,audio/webm,image/jpeg,image/jpg,image/pjpeg"
                    @change="onSaveImageFileInputChange"
                  />
                  <p v-if="saveImageSelectedFileName" class="dialog-help">{{ saveImageSelectedFileName }}</p>
                  <div v-if="saveImagePreviewUrl" class="save-image-file-preview">
                    <img
                      class="save-image-file-preview-image"
                      :src="saveImagePreviewUrl"
                      :alt="saveImageSelectedFileName || t('image')"
                    />
                  </div>
                  <p
                    v-if="saveImageExifMetadataLoading"
                    class="dialog-help"
                    role="status"
                    aria-live="polite"
                  >
                    {{ t('saveImageExifReading') }}
                  </p>
                  <p v-if="saveImageExifDateTaken" class="dialog-help">
                    {{ t('saveImageExifDateTaken') }}: {{ saveImageExifDateTaken }}
                  </p>
                  <p v-if="saveImageHasExifCoordinates" class="dialog-help">
                    {{ t('saveImageExifCoordinates') }}: {{ saveImageExifCoordinatesDisplay }}
                  </p>
                  <p v-if="saveImageExifHeading !== null" class="dialog-help">
                    {{ t('saveImageExifHeading') }}: {{ saveImageExifHeading.toFixed(1).replace(/\.0$/, '') }}°
                  </p>
                  <p v-if="saveImageExifElevation !== null" class="dialog-help">
                    {{ t('saveImageExifElevation') }}: {{ saveImageExifElevation.toFixed(1).replace(/\.0$/, '') }} m
                  </p>
                  <p
                    v-if="saveImageSelectedFileName && !saveImageExifMetadataLoading && !saveImageHasExifMetadata"
                    class="dialog-help"
                  >
                    {{ t('saveImageExifMetadataMissing') }}
                  </p>
                </label>

                <div class="form-field">
                  <span>{{ t('saveImageOwnPhotoQuestion') }}</span>
                  <div class="toggle-switch" role="radiogroup" :aria-label="t('saveImageOwnPhotoQuestion')">
                    <label class="toggle-option" :class="{ active: saveImageIsOwnPhoto }">
                      <input v-model="saveImageIsOwnPhoto" type="radio" :value="true" @change="onSaveImageOwnPhotoChange" />
                      <span>{{ t('saveImageOwnPhotoYes') }}</span>
                    </label>
                    <label class="toggle-option" :class="{ active: !saveImageIsOwnPhoto }">
                      <input v-model="saveImageIsOwnPhoto" type="radio" :value="false" @change="onSaveImageOwnPhotoChange" />
                      <span>{{ t('saveImageOwnPhotoNo') }}</span>
                    </label>
                  </div>
                </div>

                <div class="form-field">
                  <span>{{ t('saveImageApiDateCreated') }}</span>
                  <input v-model="saveImageApiDateCreated" type="text" maxlength="32" placeholder="YYYY-MM-DD" />
                  <p class="dialog-help">
                    {{ t('saveImageCommonsMetadataOnlyNote') }}
                  </p>
                  <template v-if="saveImageHasElevationValue">
                    <p class="dialog-help">
                      {{ t('saveImageElevation') }}: {{ saveImageElevationDisplay }}
                    </p>
                    <label class="checkbox-field save-image-elevation-opt-in">
                      <input v-model="saveImageIncludeElevation" type="checkbox" />
                      <span>{{ t('saveImageElevationUse') }}</span>
                    </label>
                  </template>
                </div>

                <div class="wizard-section">
                  <h3>{{ t('saveImageWizardLocationStep') }}</h3>
                  <p v-if="saveImageMapPickHelpText" class="dialog-help">{{ saveImageMapPickHelpText }}</p>
                  <div v-if="saveImageHasCoordinatePreview" class="save-image-location-preview">
                    <div
                      ref="saveImageCoordinatePreviewMapElement"
                      :class="[
                        'map-canvas',
                        'coords-inline-map',
                        'save-image-location-preview-map',
                        'picker-map',
                        saveImagePreviewUsesHeadingIndicator ? 'picker-map-camera-center' : '',
                      ]"
                      :aria-label="t('locationOnMap')"
                    ></div>
                    <p class="dialog-help">
                      {{ t('coordinates') }}:
                      {{ displayValue(saveImageLatitude, t('noValue')) }},
                      {{ displayValue(saveImageLongitude, t('noValue')) }}
                      <template v-if="saveImageApiUsesPhotographerCoordinates">
                        | {{ t('saveImageHeading') }}: {{ saveImageHeadingDisplay }}
                      </template>
                    </p>
                  </div>
                  <div class="save-image-coordinate-picker-actions">
                    <button type="button" class="primary-btn" @click="openSaveImageCoordinatePickerDialog">
                      {{ t('pickCoordinates') }}
                    </button>
                    <button
                      v-if="saveImageHasExifCoordinates"
                      type="button"
                      class="secondary-btn"
                      :title="saveImageExifCoordinatesDisplay"
                      :disabled="!saveImageCanResetToExifCoordinates"
                      @click="resetSaveImageCoordinatesToExif"
                    >
                      {{ t('saveImageResetToExifCoordinates') }}
                    </button>
                    <button
                      v-if="saveImageHasInitialWikidataCoordinates"
                      type="button"
                      class="secondary-btn"
                      :title="saveImageWikidataCoordinatesDisplay"
                      :disabled="!saveImageCanResetToWikidataCoordinates"
                      @click="resetSaveImageCoordinatesToWikidata"
                    >
                      {{ t('saveImageResetToWikidataCoordinates') }}
                    </button>
                  </div>
                </div>

                <div class="wizard-section">
                  <h3>{{ t('saveImageWizardSubjectStep') }}</h3>
                  <p class="dialog-help">{{ t('saveImageSubjectPrompt') }}</p>
                  <div class="save-image-subject-type-grid" role="radiogroup" :aria-label="t('saveImageSubjectPrompt')">
                    <label class="save-image-subject-type-option" :class="{ active: saveImageSubjectType === 'interior' }">
                      <input v-model="saveImageSubjectType" type="radio" value="interior" @change="onSaveImageSubjectTypeChange" />
                      <span>{{ t('saveImageSubjectTypeInterior') }}</span>
                    </label>
                    <label class="save-image-subject-type-option" :class="{ active: saveImageSubjectType === 'exterior' }">
                      <input v-model="saveImageSubjectType" type="radio" value="exterior" @change="onSaveImageSubjectTypeChange" />
                      <span>{{ t('saveImageSubjectTypeExterior') }}</span>
                    </label>
                    <label class="save-image-subject-type-option" :class="{ active: saveImageSubjectType === 'aerial' }">
                      <input v-model="saveImageSubjectType" type="radio" value="aerial" @change="onSaveImageSubjectTypeChange" />
                      <span>{{ t('saveImageSubjectTypeAerial') }}</span>
                    </label>
                    <label class="save-image-subject-type-option" :class="{ active: saveImageSubjectType === 'portrait' }">
                      <input v-model="saveImageSubjectType" type="radio" value="portrait" @change="onSaveImageSubjectTypeChange" />
                      <span>{{ t('saveImageSubjectTypePortrait') }}</span>
                    </label>
                    <label class="save-image-subject-type-option" :class="{ active: saveImageSubjectType === 'general' }">
                      <input v-model="saveImageSubjectType" type="radio" value="general" @change="onSaveImageSubjectTypeChange" />
                      <span>{{ t('saveImageSubjectTypeGeneral') }}</span>
                    </label>
                  </div>
                  <p v-if="saveImageSubjectTypeLocationRelevant" class="dialog-help">
                    {{ t('saveImageSubjectLocationRelevantHelp') }}
                  </p>
                  <p v-else-if="saveImageSubjectType" class="dialog-help">
                    {{ t('saveImageSubjectLocationNotRelevantHelp') }}
                  </p>
                </div>

                <div v-if="saveImageSubjectTypeLocationRelevant" class="wizard-section">
                  <h3>{{ t('saveImageWizardSubjectLocationStep') }}</h3>
                  <div v-if="saveImageLinkedSubjects.length > 0" class="save-image-linked-subjects save-image-linked-subjects-step3-start">
                    <p class="dialog-help success">
                      {{ t('saveImageSubjectLinkAdded', { count: saveImageLinkedSubjects.length }) }}
                    </p>
                    <ul class="save-image-linked-subject-list">
                      <li
                        v-for="(linkedItem, index) in saveImageLinkedSubjects"
                        :key="'linked-subject-' + linkedItem.dedupeKey + '-' + index"
                        class="save-image-linked-subject-row"
                      >
                        <div class="save-image-linked-subject-title-row">
                          <span
                            class="save-image-linked-subject-pin"
                            :style="saveImageLinkedSubjectListPinStyle(index)"
                            aria-hidden="true"
                          ></span>
                          <a
                            :href="saveImageDepictHref(linkedItem)"
                            target="_blank"
                            rel="noreferrer"
                            class="save-image-linked-subject-title"
                          >
                            {{ saveImageDepictDisplayLabel(linkedItem) }}
                          </a>
                        </div>
                        <p class="save-image-linked-subject-meta">
                          {{ t('coordinates') }}: {{ formatSaveImageLinkedSubjectCoordinates(linkedItem) }}
                        </p>
                        <p class="save-image-linked-subject-meta">
                          {{ t('saveImageSubjectImagePointLabel') }}: {{ formatSaveImageLinkedSubjectImagePoint(linkedItem) }}
                        </p>
                        <button
                          type="button"
                          class="secondary-btn"
                          :aria-label="t('removeCategory')"
                          @click="removeSaveImageLinkedSubject(linkedItem)"
                        >
                          {{ t('removeCategory') }}
                        </button>
                      </li>
                    </ul>
                  </div>

                  <div class="form-field save-image-subject-link-mode-field">
                    <span>{{ t('saveImageSubjectLinkModeLabel') }}</span>
                    <div class="toggle-switch" role="radiogroup" :aria-label="t('saveImageSubjectLinkModeLabel')">
                      <label class="toggle-option" :class="{ active: saveImageSubjectLinkMode === 'map' }">
                        <input v-model="saveImageSubjectLinkMode" type="radio" value="map" @change="onSaveImageSubjectLinkModeChange" />
                        <span>{{ t('saveImageSubjectLinkModeMap') }}</span>
                      </label>
                      <label class="toggle-option" :class="{ active: saveImageSubjectLinkMode === 'image-only' }">
                        <input v-model="saveImageSubjectLinkMode" type="radio" value="image-only" @change="onSaveImageSubjectLinkModeChange" />
                        <span>{{ t('saveImageSubjectLinkModeImageOnly') }}</span>
                      </label>
                    </div>
                  </div>

                  <p v-if="saveImageSubjectLinkUsesMap" class="dialog-help">{{ t('saveImageSubjectLocationToolHelp') }}</p>
                  <p v-else class="dialog-help">{{ t('saveImageSubjectNoMapToolHelp') }}</p>

                  <div v-if="saveImageSubjectPendingLinkedSubject" class="save-image-subject-accept-actions">
                    <div class="save-image-linked-subject-row save-image-linked-subject-row-preview">
                      <div class="save-image-linked-subject-title-row">
                        <span
                          class="save-image-linked-subject-pin"
                          :style="saveImageLinkedSubjectListPinStyle(saveImageLinkedSubjects.length)"
                          aria-hidden="true"
                        ></span>
                        <a
                          :href="saveImageDepictHref(saveImageSubjectPendingLinkedSubject)"
                          target="_blank"
                          rel="noreferrer"
                          class="save-image-linked-subject-title"
                        >
                          {{ saveImageDepictDisplayLabel(saveImageSubjectPendingLinkedSubject) }}
                        </a>
                      </div>
                      <p class="save-image-linked-subject-meta">
                        {{ t('coordinates') }}: {{ formatSaveImageLinkedSubjectCoordinates(saveImageSubjectPendingLinkedSubject) }}
                      </p>
                      <p class="save-image-linked-subject-meta">
                        {{ t('saveImageSubjectImagePointLabel') }}: {{ formatSaveImageLinkedSubjectImagePoint(saveImageSubjectPendingLinkedSubject) }}
                      </p>
                      <div class="save-image-subject-accept-action-row">
                        <button
                          type="button"
                          class="primary-btn"
                          :disabled="!saveImageSubjectCanAddLink"
                          @click="addSaveImageSubjectLink"
                        >
                          {{ t('saveImageSubjectLinkButton') }}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div v-if="saveImageSubjectLinkUsesMap" class="save-image-subject-query-layout">
                    <div class="save-image-subject-query-sidebar">
                      <p class="dialog-help">{{ t('saveImageSubjectMapClickHelp') }}</p>
                      <p v-if="saveImageSubjectMapZoomLevel !== null" class="dialog-help">
                        {{ t('saveImageSubjectMapZoomLevel') }}: {{ saveImageSubjectMapZoomLevel }}
                      </p>
                      <div
                        v-if="!saveImageSubjectHasActiveSelection"
                        class="save-image-subject-feature-list-section"
                        :aria-busy="saveImageSubjectMapFeaturesLoading ? 'true' : 'false'"
                      >
                        <div class="save-image-subject-direct-wikidata-search">
                          <h4>{{ t('saveImageSubjectDirectWikidataSearchTitle') }}</h4>
                          <div class="save-image-subject-wikidata-entry">
                            <input
                              v-model="saveImageSubjectWikidataSearch"
                              type="text"
                              :aria-label="t('saveImageSubjectDirectWikidataSearchTitle')"
                              :placeholder="t('wikidataItemPlaceholder')"
                              @input="onSaveImageSubjectWikidataInput"
                              @focus="onSaveImageSubjectWikidataFocus"
                              @blur="hideSaveImageSubjectWikidataSuggestionsSoon"
                            />
                          </div>
                          <ul v-if="saveImageSubjectWikidataSuggestions.length > 0" class="save-image-subject-feature-list save-image-subject-wikidata-autocomplete">
                            <li v-for="item in saveImageSubjectWikidataSuggestions" :key="'subject-list-direct-wikidata-' + item.id">
                              <button
                                type="button"
                                class="save-image-subject-feature-row-btn save-image-subject-wikidata-suggestion-btn"
                                :class="{ active: isSaveImageSubjectWikidataSuggestionSelected(item) }"
                                @mousedown.prevent.stop
                                @click.stop="selectSaveImageSubjectDirectWikidataSuggestion(item)"
                              >
                                <span class="save-image-subject-feature-title save-image-subject-wikidata-option-label">
                                  {{ saveImageDepictDisplayLabel(item) }}
                                </span>
                                <span
                                  v-if="item.description"
                                  class="save-image-subject-feature-meta save-image-subject-wikidata-option-description"
                                >
                                  {{ item.description }}
                                </span>
                              </button>
                            </li>
                          </ul>
                          <div
                            v-if="saveImageSubjectWikidataLoading"
                            class="loading-indicator loading-indicator-compact"
                            role="status"
                            aria-live="polite"
                          >
                            <span class="loading-indicator-text">{{ t('searching') }}</span>
                          </div>
                        </div>
                        <h4>{{ t('saveImageSubjectNearbyFeaturesTitle') }}</h4>
                        <div
                          v-if="saveImageSubjectMapFeaturesLoading"
                          class="loading-indicator loading-indicator-prominent"
                          role="status"
                          aria-live="polite"
                        >
                          <span class="loading-indicator-text">{{ t('saveImageSubjectLoadingInfo') }}</span>
                        </div>
                        <ul
                          v-if="saveImageSubjectMapFeaturesLoading"
                          class="save-image-subject-feature-list save-image-subject-feature-list-loading"
                          aria-hidden="true"
                        >
                          <li v-for="loadingRow in 4" :key="'subject-nearby-feature-loading-' + loadingRow">
                            <span class="save-image-subject-feature-loading-row"></span>
                          </li>
                        </ul>
                        <p v-else-if="saveImageSubjectMapFeaturesError" class="dialog-help warning">
                          {{ saveImageSubjectMapFeaturesError }}
                        </p>
                        <ul v-else-if="saveImageSubjectNearbyMapFeatures.length > 0" class="save-image-subject-feature-list">
                          <li
                            v-for="feature in saveImageSubjectNearbyMapFeatures"
                            :key="'subject-nearby-feature-' + feature.key"
                          >
                            <button
                              type="button"
                              class="save-image-subject-feature-row-btn"
                              :class="{
                                active: isSaveImageSubjectMapFeatureSelected(feature),
                                hovered: isSaveImageSubjectMapFeatureHovered(feature),
                              }"
                              @mouseenter="onSaveImageSubjectMapFeatureMouseEnter(feature)"
                              @mouseleave="onSaveImageSubjectMapFeatureMouseLeave(feature)"
                              @focus="onSaveImageSubjectMapFeatureMouseEnter(feature)"
                              @blur="onSaveImageSubjectMapFeatureMouseLeave(feature)"
                              @click="selectSaveImageSubjectMapFeature(feature, { refreshLatest: true, resetPointPair: true })"
                            >
                              <span class="save-image-subject-feature-title">{{ feature.displayLabel }}</span>
                              <span class="save-image-subject-feature-meta">{{ feature.displayMeta }}</span>
                            </button>
                          </li>
                        </ul>
                        <p v-else class="dialog-help">{{ t('saveImageSubjectNoNearbyFeatures') }}</p>
                      </div>
                      <div v-if="saveImageSubjectHasActiveSelection" class="save-image-subject-feature-details">
                        <div class="save-image-subject-feature-details-header">
                          <h4>{{ t('saveImageSubjectSelectedFeatureTitle') }}</h4>
                          <div class="save-image-subject-feature-details-actions">
                            <button type="button" class="secondary-btn" @click="showSaveImageSubjectNearbyFeatureList">
                              {{ t('backToList') }}
                            </button>
                          </div>
                        </div>
                        <p class="save-image-subject-feature-details-name">
                          {{
                            saveImageSelectedSubjectMapFeature
                              ? saveImageSelectedSubjectMapFeature.displayLabel
                              : saveImageDepictDisplayLabel(saveImageSubjectDirectWikidataItem)
                          }}
                        </p>
                        <p
                          class="dialog-help save-image-subject-pair-help"
                          :class="{ 'save-image-subject-pair-help-pending': !(saveImageSubjectMapHasPoint && saveImageSubjectImageHasPoint) }"
                        >
                          {{ t('saveImageSubjectPairHelp') }}
                        </p>
                        <div class="save-image-subject-feature-links">
                          <a
                            v-if="saveImageSelectedSubjectMapFeature && saveImageSelectedSubjectMapFeature.osmUrl"
                            :href="saveImageSelectedSubjectMapFeature.osmUrl"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {{ t('saveImageSubjectOpenInOsm') }}
                          </a>
                          <a
                            v-if="(saveImageSelectedSubjectMapFeature && saveImageSelectedSubjectMapFeature.directQid) || (saveImageSubjectDirectWikidataItem && saveImageSubjectDirectWikidataItem.id)"
                            :href="'https://www.wikidata.org/wiki/' + ((saveImageSelectedSubjectMapFeature && saveImageSelectedSubjectMapFeature.directQid) || (saveImageSubjectDirectWikidataItem && saveImageSubjectDirectWikidataItem.id))"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {{ (saveImageSelectedSubjectMapFeature && saveImageSelectedSubjectMapFeature.directQid) || (saveImageSubjectDirectWikidataItem && saveImageSubjectDirectWikidataItem.id) }}
                          </a>
                        </div>
                        <div
                          class="save-image-subject-feature-wikidata"
                          :aria-busy="(saveImageSubjectSelectedFeatureWikidataLoading || saveImageSubjectWikidataLoading) ? 'true' : 'false'"
                        >
                          <h5 class="save-image-subject-wikidata-title">{{ t('saveImageSubjectWikidataLabel') }}</h5>
                          <p class="dialog-help save-image-subject-wikidata-help">{{ t('saveImageSubjectWikidataHelp') }}</p>
                          <div class="save-image-subject-wikidata-entry">
                            <input
                              v-model="saveImageSubjectWikidataSearch"
                              type="text"
                              :aria-label="t('saveImageSubjectWikidataLabel')"
                              :placeholder="t('wikidataItemPlaceholder')"
                              @input="onSaveImageSubjectWikidataInput"
                              @focus="onSaveImageSubjectWikidataFocus"
                              @blur="hideSaveImageSubjectWikidataSuggestionsSoon"
                              @keydown="onSaveImageSubjectWikidataKeydown"
                            />
                          </div>
                          <ul v-if="saveImageSubjectWikidataSuggestions.length > 0" class="save-image-subject-feature-list save-image-subject-wikidata-autocomplete">
                            <li v-for="item in saveImageSubjectWikidataSuggestions" :key="'subject-wikidata-' + item.id">
                              <button
                                type="button"
                                class="save-image-subject-feature-row-btn save-image-subject-wikidata-suggestion-btn"
                                :class="{ active: isSaveImageSubjectWikidataSuggestionSelected(item) }"
                                @mousedown.prevent.stop
                                @click.stop="selectSaveImageSubjectWikidataSuggestion(item)"
                              >
                                <span class="save-image-subject-feature-title save-image-subject-wikidata-option-label">
                                  {{ saveImageDepictDisplayLabel(item) }}
                                </span>
                                <span
                                  v-if="item.description"
                                  class="save-image-subject-feature-meta save-image-subject-wikidata-option-description"
                                >
                                  {{ item.description }}
                                </span>
                              </button>
                            </li>
                          </ul>
                          <div
                            v-if="saveImageSubjectWikidataLoading"
                            class="loading-indicator loading-indicator-compact"
                            role="status"
                            aria-live="polite"
                          >
                            <span class="loading-indicator-text">{{ t('searching') }}</span>
                          </div>
                          <div
                            v-if="saveImageSelectedSubjectMapFeature && saveImageVisibleSubjectSelectedFeatureWikidataSuggestions.length > 0"
                            class="save-image-subcategory-suggestions"
                          >
                            <p class="dialog-help">{{ t('saveImageSubjectSelectedFeatureWikidataSuggestions') }}</p>
                            <ul class="save-image-subject-feature-list save-image-subject-wikidata-suggestion-list">
                              <li
                                v-for="suggestion in saveImageVisibleSubjectSelectedFeatureWikidataSuggestions"
                                :key="'subject-feature-wikidata-' + suggestion.id"
                              >
                                <button
                                  type="button"
                                  class="save-image-subject-feature-row-btn save-image-subject-wikidata-suggestion-btn"
                                  :class="{ active: isSaveImageSubjectWikidataSuggestionSelected(suggestion) }"
                                  @click="selectSaveImageSubjectFeatureWikidataSuggestion(suggestion)"
                                >
                                  <span class="save-image-subject-feature-title save-image-subject-wikidata-option-label">
                                    {{ saveImageDepictDisplayLabel(suggestion) }}
                                  </span>
                                  <span
                                    v-if="suggestion.description"
                                    class="save-image-subject-feature-meta save-image-subject-wikidata-option-description"
                                  >
                                    {{ suggestion.description }}
                                  </span>
                                </button>
                              </li>
                            </ul>
                          </div>
                          <div
                            v-else-if="saveImageSelectedSubjectMapFeature && saveImageSubjectSelectedFeatureWikidataLoading"
                            class="loading-indicator loading-indicator-compact"
                            role="status"
                            aria-live="polite"
                          >
                            <span class="loading-indicator-text">{{ t('searching') }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="save-image-subject-query-map-wrap">
                      <div
                        ref="saveImageSubjectMapElement"
                        class="map-canvas coords-inline-map save-image-subject-map"
                        :aria-label="t('locationOnMap')"
                      ></div>
                      <div class="save-image-subject-image-pane">
                        <p class="dialog-help">{{ t('saveImageSubjectImageClickHelp') }}</p>
                        <p
                          v-if="saveImageSubjectHasActiveSelection && saveImageSubjectMapHasPoint"
                          class="dialog-help save-image-subject-map-point-coordinates"
                        >
                          {{ t('coordinates') }}: {{ saveImageSubjectMapLatitude }}, {{ saveImageSubjectMapLongitude }}
                        </p>
                        <div v-if="saveImagePreviewUrl" class="save-image-subject-image-picker">
                          <img
                            class="save-image-subject-image"
                            :src="saveImagePreviewUrl"
                            :alt="saveImageSelectedFileName || t('image')"
                            @click="onSaveImageSubjectImagePreviewClick"
                          />
                          <span
                            v-for="marker in saveImageSubjectLinkedImageMarkers"
                            :key="'save-image-subject-linked-marker-' + marker.key"
                            class="save-image-subject-image-marker save-image-subject-linked-image-marker"
                            :style="marker.style"
                          ></span>
                          <span
                            v-if="saveImageSubjectImageHasPoint"
                            class="save-image-subject-image-marker"
                            :style="saveImageSubjectImageMarkerStyle"
                          ></span>
                        </div>
                        <p v-else class="dialog-help warning">{{ t('saveImageSubjectImageRequiresFile') }}</p>
                        <p v-if="saveImageSubjectImageHasPoint" class="dialog-help">
                          {{ t('saveImageSubjectImagePointLabel') }}:
                          {{ saveImageSubjectImageXPercent.toFixed(1) }}%, {{ saveImageSubjectImageYPercent.toFixed(1) }}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div v-else class="save-image-subject-no-map-layout">
                    <div class="save-image-subject-feature-details save-image-subject-no-map-wikidata">
                      <h4>{{ t('saveImageSubjectWikidataLabel') }}</h4>
                      <p class="dialog-help save-image-subject-wikidata-help">{{ t('saveImageSubjectWikidataHelp') }}</p>
                      <div class="save-image-subject-wikidata-entry">
                        <input
                          v-model="saveImageSubjectWikidataSearch"
                          type="text"
                          :aria-label="t('saveImageSubjectWikidataLabel')"
                          :placeholder="t('wikidataItemPlaceholder')"
                          @input="onSaveImageSubjectWikidataInput"
                          @focus="onSaveImageSubjectWikidataFocus"
                          @blur="hideSaveImageSubjectWikidataSuggestionsSoon"
                          @keydown="onSaveImageSubjectWikidataKeydown"
                        />
                      </div>
                      <ul v-if="saveImageSubjectWikidataSuggestions.length > 0" class="save-image-subject-feature-list save-image-subject-wikidata-autocomplete">
                        <li v-for="item in saveImageSubjectWikidataSuggestions" :key="'subject-image-only-wikidata-' + item.id">
                          <button
                            type="button"
                            class="save-image-subject-feature-row-btn save-image-subject-wikidata-suggestion-btn"
                            :class="{ active: isSaveImageSubjectWikidataSuggestionSelected(item) }"
                            @mousedown.prevent.stop
                            @click.stop="selectSaveImageSubjectWikidataSuggestion(item)"
                          >
                            <span class="save-image-subject-feature-title save-image-subject-wikidata-option-label">
                              {{ saveImageDepictDisplayLabel(item) }}
                            </span>
                            <span
                              v-if="item.description"
                              class="save-image-subject-feature-meta save-image-subject-wikidata-option-description"
                            >
                              {{ item.description }}
                            </span>
                          </button>
                        </li>
                      </ul>
                      <div
                        v-if="saveImageSubjectWikidataLoading"
                        class="loading-indicator loading-indicator-compact"
                        role="status"
                        aria-live="polite"
                      >
                        <span class="loading-indicator-text">{{ t('searching') }}</span>
                      </div>
                      <div v-if="saveImageVisibleNearbyDepictSuggestions.length > 0" class="save-image-subcategory-suggestions">
                        <p class="dialog-help">{{ t('saveImageNearbyDepictSuggestions') }}</p>
                        <ul class="save-image-subject-feature-list save-image-subject-wikidata-suggestion-list">
                          <li v-for="depictItem in saveImageVisibleNearbyDepictSuggestions" :key="'subject-image-only-nearby-depict-' + depictItem.id">
                            <button
                              type="button"
                              class="save-image-subject-feature-row-btn save-image-subject-wikidata-suggestion-btn"
                              :class="{ active: isSaveImageSubjectWikidataSuggestionSelected(depictItem) }"
                              @click="selectSaveImageSubjectWikidataSuggestion(depictItem)"
                            >
                              <span class="save-image-subject-feature-title save-image-subject-wikidata-option-label">
                                {{ saveImageDepictDisplayLabel(depictItem) }}
                              </span>
                              <span
                                v-if="depictItem.description"
                                class="save-image-subject-feature-meta save-image-subject-wikidata-option-description"
                              >
                                {{ depictItem.description }}
                              </span>
                            </button>
                          </li>
                        </ul>
                      </div>
                      <div
                        v-else-if="saveImageNearbyDepictLoading"
                        class="loading-indicator loading-indicator-compact"
                        role="status"
                        aria-live="polite"
                      >
                        <span class="loading-indicator-text">{{ t('searching') }}</span>
                      </div>
                    </div>
                    <div class="save-image-subject-image-pane">
                      <p class="dialog-help">{{ t('saveImageSubjectImageClickHelp') }}</p>
                      <div v-if="saveImagePreviewUrl" class="save-image-subject-image-picker">
                        <img
                          class="save-image-subject-image"
                          :src="saveImagePreviewUrl"
                          :alt="saveImageSelectedFileName || t('image')"
                          @click="onSaveImageSubjectImagePreviewClick"
                        />
                        <span
                          v-for="marker in saveImageSubjectLinkedImageMarkers"
                          :key="'save-image-subject-linked-marker-image-only-' + marker.key"
                          class="save-image-subject-image-marker save-image-subject-linked-image-marker"
                          :style="marker.style"
                        ></span>
                        <span
                          v-if="saveImageSubjectImageHasPoint"
                          class="save-image-subject-image-marker"
                          :style="saveImageSubjectImageMarkerStyle"
                        ></span>
                      </div>
                      <p v-else class="dialog-help warning">{{ t('saveImageSubjectImageRequiresFile') }}</p>
                      <p v-if="saveImageSubjectImageHasPoint" class="dialog-help">
                        {{ t('saveImageSubjectImagePointLabel') }}:
                        {{ saveImageSubjectImageXPercent.toFixed(1) }}%, {{ saveImageSubjectImageYPercent.toFixed(1) }}%
                      </p>
                    </div>
                  </div>

                  <p v-if="saveImageSubjectSelectionError" class="status error" role="alert">
                    {{ saveImageSubjectSelectionError }}
                  </p>
                </div>

                <label class="form-field">
                  <span>{{ t('saveImageApiAuthor') }}</span>
                  <input v-model="saveImageApiAuthor" type="text" maxlength="255" readonly />
                </label>

                <label v-if="saveImageShowSourceUrl" class="form-field">
                  <span>{{ t('saveImageApiSourceUrl') }}</span>
                  <input v-model="saveImageApiSourceUrl" type="url" maxlength="500" />
                </label>

                <div class="form-field">
                  <span>{{ t('saveImageCategories') }}</span>
                  <ul v-if="saveImageSelectedCategories.length > 0" class="category-chip-list">
                    <li
                      v-for="category in saveImageSelectedCategories"
                      :key="category"
                      class="category-chip"
                      :class="{ 'broader-category-conflict': isSaveImageBroaderCategoryConflict(category) }"
                    >
                      <a
                        :href="saveImageCategoryHref(category)"
                        target="_blank"
                        rel="noreferrer"
                        class="category-chip-link"
                        :class="{
                          missing: saveImageCategoryExists(category) === false,
                          'broader-category-conflict-link': isSaveImageBroaderCategoryConflict(category),
                        }"
                      >
                        {{ displayUploadCategory(category) }}
                      </a>
                      <button
                        type="button"
                        class="chip-remove"
                        :aria-label="t('removeCategory')"
                        @click="removeSaveImageCategory(category)"
                      >
                        ×
                      </button>
                    </li>
                  </ul>
                  <div
                    v-if="saveImageSelectedBroadCategoryConflicts.length > 0"
                    class="save-image-subcategory-suggestions"
                    role="status"
                    aria-live="polite"
                  >
                    <p class="dialog-help warning">{{ t('saveImageCategoryHierarchyWarning') }}</p>
                  </div>
                  <div class="save-image-category-entry">
                    <input
                      v-model="saveImageCategorySearch"
                      type="text"
                      :placeholder="t('commonsPlaceholder')"
                      @input="onSaveImageCategoryInput"
                      @focus="onSaveImageCategoryFocus"
                      @blur="hideSaveImageCategorySuggestionsSoon"
                      @keydown="onSaveImageCategoryKeydown"
                    />
                    <button
                      type="button"
                      class="secondary-btn"
                      :disabled="!saveImageCategorySearch.trim()"
                      @click.stop="addSaveImageCategoriesFromInput"
                    >
                      {{ t('addCategory') }}
                    </button>
                  </div>
                  <ul v-if="saveImageCategorySuggestions.length > 0" class="autocomplete-list">
                    <li v-for="category in saveImageCategorySuggestions" :key="category">
                      <button type="button" class="autocomplete-option" @mousedown.prevent.stop @click.stop="selectSaveImageCategory(category)">
                        {{ displayUploadCategory(category) }}
                      </button>
                    </li>
                  </ul>
                  <p v-if="saveImageCategoryLoading" class="dialog-help">{{ t('searching') }}</p>
                  <p
                    v-else-if="saveImageCategorySearch.trim() && !saveImageCategoryLoading && saveImageCategorySuggestions.length === 0"
                    class="autocomplete-empty"
                  >
                    {{ t('saveImageCategorySuggestionsEmpty') }}
                  </p>
                  <div v-if="saveImageSubcategorySuggestions.length > 0" class="save-image-subcategory-suggestions">
                    <p class="dialog-help">{{ t('saveImageSubcategorySuggestions') }}</p>
                    <ul class="category-chip-list">
                      <li v-for="category in saveImageSubcategorySuggestions" :key="'subcategory-' + category">
                        <button type="button" class="subcategory-suggestion-btn" @click="selectSaveImageSubcategorySuggestion(category)">
                          + {{ displayUploadCategory(category) }}
                        </button>
                      </li>
                    </ul>
                  </div>
                  <div v-if="saveImageSubcategoryFarSuggestions.length > 0" class="save-image-subcategory-suggestions">
                    <p class="dialog-help">{{ t('saveImageSubcategoryFarSuggestions') }}</p>
                    <ul class="category-chip-list">
                      <li v-for="category in saveImageSubcategoryFarSuggestions" :key="'subcategory-far-' + category">
                        <button type="button" class="subcategory-suggestion-btn" @click="selectSaveImageSubcategorySuggestion(category)">
                          + {{ displayUploadCategory(category) }}
                        </button>
                      </li>
                    </ul>
                  </div>
                  <p
                    v-else-if="saveImageSubcategoryLoading && saveImageSelectedCategories.length > 0"
                    class="dialog-help"
                  >
                    {{ t('searching') }}
                  </p>
                  <div v-if="saveImageVisibleNearbyCategorySuggestions.length > 0" class="save-image-subcategory-suggestions">
                    <p class="dialog-help">{{ t('saveImageNearbyCategorySuggestions') }}</p>
                    <ul class="category-chip-list">
                      <li v-for="category in saveImageVisibleNearbyCategorySuggestions" :key="'nearby-' + category">
                        <button type="button" class="subcategory-suggestion-btn" @click="selectSaveImageNearbyCategorySuggestion(category)">
                          + {{ displayUploadCategory(category) }}
                        </button>
                      </li>
                    </ul>
                  </div>
                  <p
                    v-else-if="saveImageNearbyCategoryLoading"
                    class="dialog-help"
                  >
                    {{ t('searching') }}
                  </p>
                  <p class="dialog-help">{{ t('saveImageCategoriesHelp') }}</p>
                </div>

                <div class="wizard-section">
                  <label class="form-field">
                    <span>{{ t('saveImageApiTargetFilename') }}</span>
                    <input
                      v-model="saveImageApiTargetFilename"
                      type="text"
                      maxlength="255"
                      @input="onSaveImageApiTargetFilenameInput"
                      @blur="onSaveImageApiTargetFilenameBlur"
                    />
                    <p v-if="saveImageApiTargetFilenameChecking" class="dialog-help">
                      {{ t('saveImageFilenameChecking') }}
                    </p>
                    <p v-else-if="saveImageApiTargetFilenameAvailable === false" class="dialog-help warning" role="status" aria-live="polite">
                      {{ t('saveImageFilenameTakenWarning') }}
                    </p>
                    <p v-else-if="saveImageApiTargetFilenameAvailable === true" class="dialog-help success" role="status" aria-live="polite">
                      {{ t('saveImageFilenameAvailable') }}
                    </p>
                    <p v-else-if="saveImageApiTargetFilenameCheckError" class="dialog-help warning" role="status" aria-live="polite">
                      {{ saveImageApiTargetFilenameCheckError }}
                    </p>
                  </label>

                  <div class="save-image-filename-builder">
                    <p class="save-image-filename-builder-title">{{ t('saveImageFilenameBuilderTitle') }}</p>
                    <p class="dialog-help">{{ t('saveImageFilenameBuilderHelp') }}</p>
                    <div class="save-image-filename-builder-toggles">
                      <button
                        type="button"
                        class="save-image-filename-part-btn"
                        :class="{ active: isSaveImageFilenameBuilderPartEnabled('subjects') }"
                        @click="toggleSaveImageFilenameBuilderPart('subjects')"
                      >
                        {{ t('saveImageFilenameBuilderPartSubjects') }}
                      </button>
                      <button
                        type="button"
                        class="save-image-filename-part-btn"
                        :class="{ active: isSaveImageFilenameBuilderPartEnabled('date') }"
                        @click="toggleSaveImageFilenameBuilderPart('date')"
                      >
                        {{ t('saveImageFilenameBuilderPartDate') }}
                      </button>
                      <button
                        type="button"
                        class="save-image-filename-part-btn"
                        :class="{ active: isSaveImageFilenameBuilderPartEnabled('location') }"
                        @click="toggleSaveImageFilenameBuilderPart('location')"
                      >
                        {{ t('saveImageFilenameBuilderPartLocation') }}
                      </button>
                      <button
                        type="button"
                        class="save-image-filename-part-btn"
                        :class="{ active: isSaveImageFilenameBuilderPartEnabled('categories') }"
                        @click="toggleSaveImageFilenameBuilderPart('categories')"
                      >
                        {{ t('saveImageFilenameBuilderPartCategories') }}
                      </button>
                    </div>
                    <p class="save-image-filename-builder-preview-label">{{ t('saveImageFilenameBuilderPreview') }}</p>
                    <p class="save-image-filename-builder-preview">
                      {{ saveImageFilenameBuilderPreview || t('saveImageFilenameBuilderPreviewEmpty') }}
                    </p>
                    <div class="save-image-filename-builder-actions">
                      <button
                        type="button"
                        class="secondary-btn"
                        :disabled="!saveImageFilenameBuilderPreview"
                        @click="applySaveImageFilenameBuilderSuggestion"
                      >
                        {{ t('saveImageFilenameBuilderApply') }}
                      </button>
                    </div>
                  </div>

                  <div class="form-row form-row-language">
                    <label class="form-field">
                      <span>{{ t('saveImageCaption') }}</span>
                      <input v-model="saveImageCaption" type="text" maxlength="500" />
                    </label>
                    <label class="form-field form-field-language">
                      <span>{{ t('language') }}</span>
                      <select v-model="saveImageCaptionLanguage">
                        <option value="fi">{{ t('languageGroupFi') }} (fi)</option>
                        <option value="sv">{{ t('languageGroupSv') }} (sv)</option>
                        <option value="en">{{ t('languageGroupEn') }} (en)</option>
                      </select>
                    </label>
                  </div>

                  <div class="form-row form-row-language">
                    <label class="form-field">
                      <span>{{ t('saveImageDescription') }}</span>
                      <textarea v-model="saveImageDescription" maxlength="500" rows="2"></textarea>
                    </label>
                    <label class="form-field form-field-language">
                      <span>{{ t('language') }}</span>
                      <select v-model="saveImageDescriptionLanguage">
                        <option value="fi">{{ t('languageGroupFi') }} (fi)</option>
                        <option value="sv">{{ t('languageGroupSv') }} (sv)</option>
                        <option value="en">{{ t('languageGroupEn') }} (en)</option>
                      </select>
                    </label>
                  </div>

                  <label class="form-field">
                    <span>{{ t('saveImageApiLicenseTemplate') }}</span>
                    <select v-model="saveImageApiLicenseTemplate">
                      <option value="Cc-by-sa-4.0">{{ t('saveImageApiLicenseCcBySa40') }}</option>
                      <option value="Cc-by-4.0">{{ t('saveImageApiLicenseCcBy40') }}</option>
                      <option value="Cc-zero">{{ t('saveImageApiLicenseCcZero') }}</option>
                    </select>
                  </label>
                </div>

                <p v-if="saveImageError" class="status error" role="alert">{{ saveImageError }}</p>
                <p
                  v-if="saveImageUploadResult && saveImageUploadResult.filename"
                  class="status"
                  role="status"
                  aria-live="polite"
                >
                  {{ t('saveImageUploadSuccess', { filename: saveImageUploadResult.filename }) }}
                  <a
                    v-if="isHttpUrl(saveImageUploadResult.file_page_url)"
                    :href="saveImageUploadResult.file_page_url"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ t('saveImageOpenUploadedFile') }}
                  </a>
                </p>
              </fieldset>
              <div class="dialog-actions">
                <button type="button" class="secondary-btn" @click="closeSaveImageApiForm">
                  {{ t('cancel') }}
                </button>
                <button
                  type="button"
                  class="primary-btn"
                  :disabled="saveImageApiUploading"
                  @click="saveImageViaMediaWikiApi"
                >
                  {{ saveImageApiUploading ? t('saving') : t('saveImageUploadWithApi') }}
                </button>
              </div>
            </section>
          </div>

          <div
            v-if="showSaveImageCoordinatePickerDialog"
            class="dialog-backdrop"
            @click.self="closeSaveImageCoordinatePickerDialog"
          >
            <section class="dialog-card dialog-card-wide" role="dialog" aria-modal="true">
              <h2>{{ t('coordinatePickerTitle') }}</h2>
              <div v-if="saveImageCoordinatePickerHasPreview" class="save-image-coordinate-picker-toolbar">
                <button type="button" class="secondary-btn" @click="toggleSaveImageCoordinatePickerPreview">
                  {{
                    saveImageCoordinatePickerPreviewCollapsed
                      ? t('saveImageCoordinatePreviewShow')
                      : t('saveImageCoordinatePreviewHide')
                  }}
                </button>
              </div>
              <div
                class="save-image-coordinate-picker-layout"
                :class="{ 'preview-collapsed': saveImageCoordinatePickerPreviewCollapsed || !saveImageCoordinatePickerHasPreview }"
              >
                <coordinate-picker-widget
                  :title="t('saveImageWizardLocationStep')"
                  :help-text="saveImageMapPickHelpText"
                  :coordinates-label="t('coordinates')"
                  :latitude-display="displayValue(saveImageLatitude, t('noValue'))"
                  :longitude-display="displayValue(saveImageLongitude, t('noValue'))"
                  :show-mode-toggle="true"
                  :uses-photographer-coordinates="saveImageApiUsesPhotographerCoordinates"
                  :mode-toggle-title="t('saveImageMapToggleCoordinateMode')"
                  :mode-label="t('saveImageCoordinateModeLabel')"
                  :mode-photographer-text="t('saveImageMapModePhotographerShort')"
                  :mode-image-text="t('saveImageMapModeImageShort')"
                  :show-heading="saveImageApiUsesPhotographerCoordinates"
                  :heading-label="t('saveImageHeading')"
                  :heading-display="saveImageHeadingDisplay"
                  map-aria-label="api upload coordinate picker map"
                  @map-element-ready="onSaveImageMapElementReady"
                  @toggle-mode="onSaveImageMapCenterIconClick"
                  @set-mode="setSaveImageApiCoordinateMode"
                />
                <aside
                  v-if="saveImageCoordinatePickerHasPreview && !saveImageCoordinatePickerPreviewCollapsed"
                  class="save-image-coordinate-picker-preview"
                >
                  <h3>{{ t('saveImageFile') }}</h3>
                  <img
                    class="save-image-coordinate-picker-preview-image"
                    :src="saveImagePreviewUrl"
                    :alt="saveImageSelectedFileName || t('image')"
                  />
                  <p v-if="saveImageSelectedFileName" class="save-image-coordinate-picker-preview-filename">
                    {{ saveImageSelectedFileName }}
                  </p>
                </aside>
              </div>
              <div class="dialog-actions">
                <button type="button" class="secondary-btn" @click="closeSaveImageCoordinatePickerDialog">
                  {{ t('cancel') }}
                </button>
                <button type="button" class="primary-btn" @click="closeSaveImageCoordinatePickerDialog">
                  {{ t('useSelectedCoordinates') }}
                </button>
              </div>
            </section>
          </div>
        </article>
      </section>
    `
  }

  const routes = [
    { path: '/', name: 'list', component: ListView },
    { path: '/map', name: 'map', component: MapView },
    { path: '/location/:id', name: 'detail', component: DetailView, props: true }
  ]

  const router = createRouter({
    history: createWebHashHistory(),
    routes
  })

  router.beforeEach((to) => {
    if (to.name !== 'detail') {
      return true
    }
    const rawId = typeof to.params.id === 'string' ? to.params.id.trim() : ''
    if (!rawId) {
      return true
    }
    const qid = extractWikidataId(rawId)
    if (!qid || rawId.toUpperCase() === qid) {
      return true
    }
    return {
      name: 'detail',
      params: { ...to.params, id: qid },
      query: to.query,
      hash: to.hash,
      replace: true,
    }
  })

  const AppRoot = {
    components: { LanguageSwitcher },
    setup() {
      const { t, locale } = useI18n()
      const route = useRoute()
      const {
        locationsVersion,
        notifyLocationsChanged,
        getLocationsCached,
        getLocationFromListCache,
        getLocationDetailCached,
      } = locationStore

      const detailHref = computed(() => (route.name === 'detail' ? route.fullPath : '/'))
      const {
        authEnabled,
        authAuthenticated,
        authUsername,
        authLoginUrl,
        authLogoutUrl,
        authStatusLoading,
      } = authStore
      const showCradleGuideDialog = ref(false)
      const showCreateLocationDialog = ref(false)
      const createWizardStep = ref('choose')
      const createWizardMode = ref('')
      const newWikidataWizardStep = ref('basic')
      const wizardChoiceLocked = ref(false)
      const wizardSaving = ref(false)
      const wizardError = ref('')
      const wizardExistingWikidataItem = ref('')
      const wizardExistingWikidataSearch = ref('')
      const wizardExistingSuggestions = ref([])
      const wizardExistingLoading = ref(false)
      const wizardExistingSourceUrl = ref('')
      const wizardExistingSourceTitle = ref('')
      const wizardExistingSourceTitleLanguage = ref(defaultWikidataTextLanguage())
      const wizardExistingSourceAuthor = ref('')
      const wizardExistingSourcePublicationDate = ref('')
      const wizardExistingSourcePublisherP123 = ref('')
      const wizardExistingSourcePublisherSearch = ref('')
      const wizardExistingSourcePublisherSuggestions = ref([])
      const wizardExistingSourcePublisherLoading = ref(false)
      const wizardExistingSourcePublishedInP1433 = ref('')
      const wizardExistingSourcePublishedInSearch = ref('')
      const wizardExistingSourcePublishedInSuggestions = ref([])
      const wizardExistingSourcePublishedInLoading = ref(false)
      const wizardExistingSourceLanguageOfWorkP407 = ref('')
      const wizardExistingSourceLanguageOfWorkSearch = ref('')
      const wizardExistingSourceLanguageOfWorkSuggestions = ref([])
      const wizardExistingSourceLanguageOfWorkLoading = ref(false)
      const wizardExistingCitoidLoading = ref(false)
      const wizardExistingCitoidError = ref('')
      const wizardExistingLastCitoidUrl = ref('')
      const wikidataTextLanguageOptions = [...SUPPORTED_LOCALES]
      const wikidataAddressLanguageOptions = [...SUPPORTED_LOCALES, 'se', 'smn', 'sms']
      const wikidataLanguageCodePattern = /^[a-z]{2,12}$/
      function defaultWikidataTextLanguage() {
        return normalizeSupportedLocale(locale.value) || 'en'
      }
      const newWikidataPrimaryLabels = ref({ fi: '', sv: '', en: '' })
      const newWikidataPrimaryDescriptions = ref({ fi: '', sv: '', en: '' })
      const newWikidataAdditionalLanguageEntries = ref([])
      const newWikidataPartOfP361 = ref('')
      const newWikidataPartOfP361Values = ref([])
      const newWikidataPartOfSearch = ref('')
      const newWikidataPartOfSuggestions = ref([])
      const newWikidataPartOfLoading = ref(false)
      const newWikidataInstanceOf = ref('')
      const newWikidataInstanceOfValues = ref([])
      const newWikidataInstanceSearch = ref('')
      const newWikidataInstanceSuggestions = ref([])
      const newWikidataInstanceLoading = ref(false)
      const newWikidataCountryP17 = ref('')
      const newWikidataCountrySearch = ref('')
      const newWikidataCountrySuggestions = ref([])
      const newWikidataCountryLoading = ref(false)
      const newWikidataMunicipalityP131 = ref('')
      const newWikidataMunicipalitySearch = ref('')
      const newWikidataMunicipalitySuggestions = ref([])
      const newWikidataMunicipalityLoading = ref(false)
      const newWikidataLocationP276 = ref('')
      const newWikidataLocationSearch = ref('')
      const newWikidataLocationSuggestions = ref([])
      const newWikidataLocationLoading = ref(false)
      const newWikidataLatitude = ref('')
      const newWikidataLongitude = ref('')
      const newWikidataArchitectP84 = ref('')
      const newWikidataArchitectP84Values = ref([])
      const newWikidataArchitectSearch = ref('')
      const newWikidataArchitectSuggestions = ref([])
      const newWikidataArchitectLoading = ref(false)
      const newWikidataInceptionP571 = ref('')
      const newWikidataArchitectSourceUrl = ref('')
      const newWikidataInceptionSourceUrl = ref('')
      const newWikidataHeritageP1435 = ref('')
      const newWikidataHeritageP1435Values = ref([])
      const newWikidataHeritageSearch = ref('')
      const newWikidataHeritageSuggestions = ref([])
      const newWikidataHeritageLoading = ref(false)
      const newWikidataHeritageSourceUrl = ref('')
      const newWikidataAddressTextP6375 = ref('')
      const newWikidataAddressTextLanguageP6375 = ref(defaultWikidataTextLanguage())
      const newWikidataPostalCodeP281 = ref('')
      const newWikidataCommonsCategoryP373 = ref('')
      const newWikidataCommonsSearch = ref('')
      const newWikidataCommonsSuggestions = ref([])
      const newWikidataCommonsLoading = ref(false)
      const newWikidataArchitecturalStyleP149 = ref('')
      const newWikidataArchitecturalStyleSearch = ref('')
      const newWikidataArchitecturalStyleSuggestions = ref([])
      const newWikidataArchitecturalStyleLoading = ref(false)
      const newWikidataOfficialClosureDateP3999 = ref('')
      const newWikidataOfficialClosureDateSourceUrl = ref('')
      const newWikidataRouteInstructionP2795 = ref('')
      const newWikidataRouteInstructionLanguageP2795 = ref(defaultWikidataTextLanguage())
      const newWikidataOptionalPropertyKeys = ref([])
      const newWikidataCustomPropertyDefinitions = ref({})
      const newWikidataCustomPropertyValues = ref({})
      const newWikidataPropertySearch = ref('')
      const newWikidataPropertySuggestions = ref([])
      const newWikidataPropertyLoading = ref(false)
      const showCoordinatePickerDialog = ref(false)
      const coordinatePickerMapElement = ref(null)
      const coordinateSearchQuery = ref('')
      const coordinateSearchResults = ref([])
      const coordinateSearchLoading = ref(false)
      const coordinateSearchError = ref('')
      const isWizardChoiceStep = computed(() => createWizardStep.value === 'choose')
      const isWizardExistingMode = computed(() => createWizardMode.value === 'existing-wikidata' && createWizardStep.value === 'form')
      const wizardExistingHasSelectedItem = computed(() => Boolean(
        resolveWizardQid(wizardExistingWikidataItem.value, wizardExistingWikidataSearch.value)
      ))
      const isWizardNewMode = computed(() => createWizardMode.value === 'new-wikidata' && createWizardStep.value === 'form')
      const isWizardNewBasicStep = computed(() => isWizardNewMode.value && newWikidataWizardStep.value === 'basic')
      const isWizardNewLocationStep = computed(() => isWizardNewMode.value && newWikidataWizardStep.value === 'location')
      const isWizardNewPropertiesStep = computed(() => isWizardNewMode.value && newWikidataWizardStep.value === 'properties')
      const isWizardNewIdentifiersStep = computed(() => isWizardNewMode.value && newWikidataWizardStep.value === 'identifiers')
      const isWizardNewSourceStep = computed(() => isWizardNewMode.value && newWikidataWizardStep.value === 'source')
      const canReturnToWizardChoice = computed(() => !wizardChoiceLocked.value && createWizardStep.value === 'form')
      const canCreateLocation = computed(() => !authStatusLoading.value && authAuthenticated.value)
      const showCradleGuideButton = computed(() => authEnabled.value && !authAuthenticated.value && !authStatusLoading.value)
      const isCreateActionBusy = computed(() => wizardSaving.value)
      const cradleUrl = 'https://cradle.toolforge.org/#/subject/building_(wikikuvaajat)'
      const locationDialogTitle = computed(() => {
        if (isWizardChoiceStep.value) {
          return t('createLocationTypeStepTitle')
        }
        if (isWizardExistingMode.value) {
          return t('addExistingWikidataTitle')
        }
        if (isWizardNewMode.value) {
          return t('createNewWikidataTitle')
        }
        return t('createLocationTitle')
      })
      const locationDialogSubmitLabel = computed(() => {
        if (isWizardExistingMode.value) {
          return t('addToList')
        }
        if (isWizardNewMode.value) {
          if (!isWizardNewSourceStep.value) {
            return t('next')
          }
          return t('createWikidataItem')
        }
        return t('create')
      })
      const newWikidataOptionalPropertySet = computed(() => new Set(newWikidataOptionalPropertyKeys.value))

      function isNewWikidataIdentifierProperty(optionOrKey) {
        const definition = resolveNewWikidataOptionalPropertyDefinition(optionOrKey)
        if (!definition) {
          return false
        }
        if (NEW_WIKIDATA_IDENTIFIER_PROPERTY_KEYS.has(definition.key)) {
          return true
        }
        return String(definition.datatype || '').trim().toLowerCase() === 'external-id'
      }

      const newWikidataQuickPropertyOptions = computed(() => {
        return NEW_WIKIDATA_OPTIONAL_PROPERTY_DEFINITIONS.filter(
          (entry) => (
            entry.key !== 'location_p276'
            && !newWikidataOptionalPropertySet.value.has(entry.key)
            && !isNewWikidataIdentifierProperty(entry)
          )
        )
      })
      const newWikidataQuickIdentifierPropertyOptions = computed(() => {
        return NEW_WIKIDATA_OPTIONAL_PROPERTY_DEFINITIONS.filter(
          (entry) => !newWikidataOptionalPropertySet.value.has(entry.key) && isNewWikidataIdentifierProperty(entry)
        )
      })

      function resolveNewWikidataOptionalPropertyDefinition(optionOrKey) {
        const normalizedDefinition = normalizeNewWikidataOptionalPropertyDefinition(optionOrKey)
        if (!normalizedDefinition) {
          return null
        }
        if (NEW_WIKIDATA_OPTIONAL_PROPERTY_BY_KEY.has(normalizedDefinition.key)) {
          return normalizedDefinition
        }
        const storedDefinition = newWikidataCustomPropertyDefinitions.value[normalizedDefinition.key]
        if (!storedDefinition || typeof storedDefinition !== 'object') {
          return normalizedDefinition
        }
        const storedPropertyId = extractWikidataPropertyId(String(storedDefinition.propertyId || ''))
        return {
          ...normalizedDefinition,
          propertyId: storedPropertyId || normalizedDefinition.propertyId,
          label: String(storedDefinition.label || normalizedDefinition.label || '').trim(),
          description: String(storedDefinition.description || normalizedDefinition.description || '').trim(),
          datatype: String(storedDefinition.datatype || normalizedDefinition.datatype || '').trim().toLowerCase(),
        }
      }

      const newWikidataCustomPropertyOptions = computed(() => {
        const options = []
        for (const propertyKey of newWikidataOptionalPropertyKeys.value) {
          if (NEW_WIKIDATA_DEDICATED_PROPERTY_KEYS.has(propertyKey)) {
            continue
          }
          const definition = resolveNewWikidataOptionalPropertyDefinition(propertyKey)
          if (!definition) {
            continue
          }
          options.push(definition)
        }
        return options
      })
      const newWikidataNonIdentifierCustomPropertyOptions = computed(() => (
        newWikidataCustomPropertyOptions.value.filter((entry) => !isNewWikidataIdentifierProperty(entry))
      ))
      const newWikidataIdentifierCustomPropertyOptions = computed(() => (
        newWikidataCustomPropertyOptions.value.filter((entry) => isNewWikidataIdentifierProperty(entry))
      ))
      const newWikidataPropertySuggestionsForProperties = computed(() => (
        newWikidataPropertySuggestions.value.filter((entry) => !isNewWikidataIdentifierProperty(entry))
      ))

      function formatWikidataPropertyDisplayLabel(label, propertyId = '') {
        const normalizedPropertyId = extractWikidataPropertyId(String(propertyId || ''))
        const rawLabel = String(label || '').trim()
        const hasPropertyInLabel = normalizedPropertyId && rawLabel.toUpperCase().includes(`(${normalizedPropertyId})`)
        const withPropertyId = normalizedPropertyId && rawLabel && !hasPropertyInLabel
          ? `${rawLabel} (${normalizedPropertyId})`
          : (rawLabel || normalizedPropertyId)
        return withPropertyId.toLocaleUpperCase()
      }

      function newWikidataP31Label() {
        return formatWikidataPropertyDisplayLabel(t('instanceOfP31'), 'P31')
      }

      function newWikidataOptionalPropertyLabel(optionOrKey) {
        const definition = resolveNewWikidataOptionalPropertyDefinition(optionOrKey)
        if (!definition) {
          return ''
        }
        const propertyId = String(definition.propertyId || '').trim().toUpperCase()
        if (definition.labelKey) {
          return formatWikidataPropertyDisplayLabel(t(definition.labelKey), propertyId)
        }
        const rawLabel = String(definition.label || '').trim()
        return formatWikidataPropertyDisplayLabel(rawLabel, propertyId)
      }

      function newWikidataPropertySuggestionLabel(option) {
        const definition = resolveNewWikidataOptionalPropertyDefinition(option)
        if (!definition) {
          return ''
        }
        const propertyId = String(definition.propertyId || '').trim().toUpperCase()
        const fallbackLabel = definition.labelKey ? t(definition.labelKey) : propertyId
        const rawLabel = String(
          option && option.label
            ? option.label
            : definition.label || ''
        ).trim()
        const hasPropertyInLabel = propertyId && rawLabel.toUpperCase().includes(`(${propertyId})`)
        const baseLabel = rawLabel
          ? (hasPropertyInLabel ? rawLabel : `${rawLabel} (${propertyId})`)
          : fallbackLabel
        return baseLabel
      }

      function isNewWikidataPropertyEnabled(propertyKey) {
        const definition = resolveNewWikidataOptionalPropertyDefinition(propertyKey)
        if (!definition) {
          return false
        }
        return newWikidataOptionalPropertySet.value.has(definition.key)
      }

      function newWikidataCustomPropertyValue(propertyKey) {
        const definition = resolveNewWikidataOptionalPropertyDefinition(propertyKey)
        if (!definition) {
          return ''
        }
        return String(newWikidataCustomPropertyValues.value[definition.key] || '')
      }

      function setNewWikidataCustomPropertyValue(propertyKey, value) {
        const definition = resolveNewWikidataOptionalPropertyDefinition(propertyKey)
        if (!definition) {
          return
        }
        newWikidataCustomPropertyValues.value = {
          ...newWikidataCustomPropertyValues.value,
          [definition.key]: String(value || ''),
        }
      }

      function hydrateNewWikidataCustomPropertyMetadata(propertyKey) {
        const definition = resolveNewWikidataOptionalPropertyDefinition(propertyKey)
        if (!definition || NEW_WIKIDATA_OPTIONAL_PROPERTY_BY_KEY.has(definition.key)) {
          return
        }
        const existingDefinition = newWikidataCustomPropertyDefinitions.value[definition.key]
        if (!existingDefinition || typeof existingDefinition !== 'object') {
          return
        }
        const hasLabel = String(existingDefinition.label || '').trim() !== ''
        const hasDatatype = String(existingDefinition.datatype || '').trim() !== ''
        if (hasLabel && hasDatatype) {
          return
        }

        void (async () => {
          try {
            const metadata = await fetchWikidataPropertyMetadata(definition.propertyId, locale.value)
            if (!metadata) {
              return
            }
            const latestDefinition = newWikidataCustomPropertyDefinitions.value[definition.key]
            if (!latestDefinition || typeof latestDefinition !== 'object') {
              return
            }
            const nextLabel = String(latestDefinition.label || metadata.label || '').trim()
            const nextDatatype = String(latestDefinition.datatype || metadata.datatype || '').trim().toLowerCase()
            if (
              nextLabel === String(latestDefinition.label || '').trim()
              && nextDatatype === String(latestDefinition.datatype || '').trim().toLowerCase()
            ) {
              return
            }
            newWikidataCustomPropertyDefinitions.value = {
              ...newWikidataCustomPropertyDefinitions.value,
              [definition.key]: {
                ...latestDefinition,
                label: nextLabel,
                datatype: nextDatatype,
              },
            }
          } catch (error) {
            void error
          }
        })()
      }

      function clearNewWikidataOptionalPropertyValue(propertyKey) {
        switch (propertyKey) {
          case 'part_of_p361':
            newWikidataPartOfP361.value = ''
            newWikidataPartOfP361Values.value = []
            newWikidataPartOfSearch.value = ''
            newWikidataPartOfSuggestions.value = []
            return
          case 'architect_p84':
            newWikidataArchitectP84.value = ''
            newWikidataArchitectP84Values.value = []
            newWikidataArchitectSearch.value = ''
            newWikidataArchitectSuggestions.value = []
            return
          case 'inception_p571':
            newWikidataInceptionP571.value = ''
            return
          case 'heritage_designation_p1435':
            newWikidataHeritageP1435.value = ''
            newWikidataHeritageP1435Values.value = []
            newWikidataHeritageSearch.value = ''
            newWikidataHeritageSuggestions.value = []
            return
          case 'commons_category_p373':
            newWikidataCommonsCategoryP373.value = ''
            newWikidataCommonsSearch.value = ''
            newWikidataCommonsSuggestions.value = []
            return
          default:
            if (Object.prototype.hasOwnProperty.call(newWikidataCustomPropertyValues.value, propertyKey)) {
              const nextValues = { ...newWikidataCustomPropertyValues.value }
              delete nextValues[propertyKey]
              newWikidataCustomPropertyValues.value = nextValues
            }
            return
        }
      }

      function addNewWikidataOptionalProperty(optionOrKey) {
        const definition = resolveNewWikidataOptionalPropertyDefinition(optionOrKey)
        if (!definition) {
          return
        }
        if (!NEW_WIKIDATA_OPTIONAL_PROPERTY_BY_KEY.has(definition.key)) {
          const existingDefinition = newWikidataCustomPropertyDefinitions.value[definition.key] || {}
          newWikidataCustomPropertyDefinitions.value = {
            ...newWikidataCustomPropertyDefinitions.value,
            [definition.key]: {
              key: definition.key,
              propertyId: definition.propertyId,
              label: String(definition.label || existingDefinition.label || '').trim(),
              description: String(definition.description || existingDefinition.description || '').trim(),
              datatype: String(definition.datatype || existingDefinition.datatype || '').trim().toLowerCase(),
            },
          }
        }
        if (
          !NEW_WIKIDATA_DEDICATED_PROPERTY_KEYS.has(definition.key)
          && !Object.prototype.hasOwnProperty.call(newWikidataCustomPropertyValues.value, definition.key)
        ) {
          newWikidataCustomPropertyValues.value = {
            ...newWikidataCustomPropertyValues.value,
            [definition.key]: '',
          }
        }
        hydrateNewWikidataCustomPropertyMetadata(definition.key)
        if (!newWikidataOptionalPropertySet.value.has(definition.key)) {
          newWikidataOptionalPropertyKeys.value = [...newWikidataOptionalPropertyKeys.value, definition.key]
        }
        newWikidataPropertySearch.value = ''
        newWikidataPropertySuggestions.value = []
      }

      function removeNewWikidataOptionalProperty(propertyKey) {
        const definition = resolveNewWikidataOptionalPropertyDefinition(propertyKey)
        if (!definition) {
          return
        }
        newWikidataOptionalPropertyKeys.value = newWikidataOptionalPropertyKeys.value.filter(
          (entry) => entry !== definition.key
        )
        if (!NEW_WIKIDATA_OPTIONAL_PROPERTY_BY_KEY.has(definition.key)) {
          const nextDefinitions = { ...newWikidataCustomPropertyDefinitions.value }
          delete nextDefinitions[definition.key]
          newWikidataCustomPropertyDefinitions.value = nextDefinitions
        }
        clearNewWikidataOptionalPropertyValue(definition.key)
      }

      function onNewWikidataPropertyInput() {
        const inputValue = String(newWikidataPropertySearch.value || '').trim()
        if (!inputValue) {
          newWikidataPropertySuggestions.value = []
          return
        }
        searchNewWikidataPropertySuggestionsDebounced(inputValue)
      }

      function addNewWikidataPropertyFromInput(onlyNonIdentifier = false) {
        const inputValue = String(newWikidataPropertySearch.value || '').trim()
        if (!inputValue) {
          return
        }

        const canAddDefinition = (definition) => {
          if (!definition) {
            return false
          }
          if (!onlyNonIdentifier) {
            return true
          }
          return !isNewWikidataIdentifierProperty(definition)
        }

        const fromInput = normalizeNewWikidataOptionalPropertyDefinition(inputValue)
        if (fromInput && canAddDefinition(fromInput)) {
          addNewWikidataOptionalProperty(fromInput)
          return
        }

        const normalizedInput = inputValue.toLowerCase()
        const byLabel = NEW_WIKIDATA_OPTIONAL_PROPERTY_DEFINITIONS.find((entry) => {
          const localizedLabel = String(t(entry.labelKey) || '').trim().toLowerCase()
          return localizedLabel === normalizedInput
        })
        if (byLabel && canAddDefinition(byLabel)) {
          addNewWikidataOptionalProperty(byLabel)
          return
        }

        const suggestions = onlyNonIdentifier
          ? newWikidataPropertySuggestionsForProperties.value
          : newWikidataPropertySuggestions.value
        if (suggestions.length === 1) {
          addNewWikidataOptionalProperty(suggestions[0])
        }
      }

      function selectNewWikidataPropertySuggestion(option) {
        addNewWikidataOptionalProperty(option)
      }

      function hideNewWikidataPropertySuggestionsSoon() {
        hideSuggestionsSoon(newWikidataPropertySuggestions)
      }

      const coordinatePickerLatitudeValue = computed(() => newWikidataLatitude.value)
      const coordinatePickerLongitudeValue = computed(() => newWikidataLongitude.value)
      const coordinatePickerLatitudeDisplay = computed(() => (
        hasTextValue(coordinatePickerLatitudeValue.value)
          ? String(coordinatePickerLatitudeValue.value).trim()
          : '-'
      ))
      const coordinatePickerLongitudeDisplay = computed(() => (
        hasTextValue(coordinatePickerLongitudeValue.value)
          ? String(coordinatePickerLongitudeValue.value).trim()
          : '-'
      ))
      const hasValidCoordinates = computed(() => {
        const lat = Number.parseFloat(String(coordinatePickerLatitudeValue.value))
        const lon = Number.parseFloat(String(coordinatePickerLongitudeValue.value))
        return !Number.isNaN(lat) && !Number.isNaN(lon)
      })

      let coordinatePickerMapInstance = null
      let coordinatePickerMarker = null
      let coordinatePickerLastZoom = null

      const searchNewWikidataPropertySuggestionsDebounced = debounce(async (searchTerm) => {
        newWikidataPropertyLoading.value = true
        try {
          const items = await searchSupportedNewWikidataProperties(
            searchTerm,
            locale.value,
            AUTOCOMPLETE_RESULT_LIMIT,
          )
          const filtered = Array.isArray(items)
            ? items.filter((item) => !newWikidataOptionalPropertySet.value.has(item.key))
            : []
          newWikidataPropertySuggestions.value = filtered
        } catch (error) {
          newWikidataPropertySuggestions.value = []
        } finally {
          newWikidataPropertyLoading.value = false
        }
      }, 250)

      function createWikidataSuggestionSearch(targetSuggestionsRef, targetLoadingRef) {
        return debounce(async (searchTerm) => {
          targetLoadingRef.value = true
          try {
            const items = await searchWikidataEntities(searchTerm, locale.value, AUTOCOMPLETE_RESULT_LIMIT)
            targetSuggestionsRef.value = Array.isArray(items) ? items : []
          } catch (error) {
            targetSuggestionsRef.value = []
          } finally {
            targetLoadingRef.value = false
          }
        }, 250)
      }

      function createCommonsSuggestionSearch(targetSuggestionsRef, targetLoadingRef) {
        return debounce(async (searchTerm) => {
          targetLoadingRef.value = true
          try {
            const items = await searchCommonsCategories(searchTerm, AUTOCOMPLETE_RESULT_LIMIT)
            targetSuggestionsRef.value = Array.isArray(items) ? items : []
          } catch (error) {
            targetSuggestionsRef.value = []
          } finally {
            targetLoadingRef.value = false
          }
        }, 250)
      }

      const searchWizardExistingSuggestionsDebounced = createWikidataSuggestionSearch(
        wizardExistingSuggestions,
        wizardExistingLoading,
      )
      const searchWizardExistingSourcePublisherSuggestionsDebounced = createWikidataSuggestionSearch(
        wizardExistingSourcePublisherSuggestions,
        wizardExistingSourcePublisherLoading,
      )
      const searchWizardExistingSourcePublishedInSuggestionsDebounced = createWikidataSuggestionSearch(
        wizardExistingSourcePublishedInSuggestions,
        wizardExistingSourcePublishedInLoading,
      )
      const searchWizardExistingSourceLanguageOfWorkSuggestionsDebounced = createWikidataSuggestionSearch(
        wizardExistingSourceLanguageOfWorkSuggestions,
        wizardExistingSourceLanguageOfWorkLoading,
      )
      const searchNewPartOfSuggestionsDebounced = createWikidataSuggestionSearch(
        newWikidataPartOfSuggestions,
        newWikidataPartOfLoading,
      )
      const searchNewInstanceSuggestionsDebounced = createWikidataSuggestionSearch(
        newWikidataInstanceSuggestions,
        newWikidataInstanceLoading,
      )
      const searchNewCountrySuggestionsDebounced = createWikidataSuggestionSearch(
        newWikidataCountrySuggestions,
        newWikidataCountryLoading,
      )
      const searchNewMunicipalitySuggestionsDebounced = createWikidataSuggestionSearch(
        newWikidataMunicipalitySuggestions,
        newWikidataMunicipalityLoading,
      )
      const searchNewLocationSuggestionsDebounced = createWikidataSuggestionSearch(
        newWikidataLocationSuggestions,
        newWikidataLocationLoading,
      )
      const searchNewArchitectSuggestionsDebounced = createWikidataSuggestionSearch(
        newWikidataArchitectSuggestions,
        newWikidataArchitectLoading,
      )
      const searchNewHeritageSuggestionsDebounced = createWikidataSuggestionSearch(
        newWikidataHeritageSuggestions,
        newWikidataHeritageLoading,
      )
      const searchNewStyleSuggestionsDebounced = createWikidataSuggestionSearch(
        newWikidataArchitecturalStyleSuggestions,
        newWikidataArchitecturalStyleLoading,
      )
      const searchNewCommonsSuggestionsDebounced = createCommonsSuggestionSearch(
        newWikidataCommonsSuggestions,
        newWikidataCommonsLoading,
      )
      let wikidataSelectionUidCounter = 0

      function nextWikidataSelectionUid() {
        wikidataSelectionUidCounter += 1
        return `wdsel-${wikidataSelectionUidCounter}`
      }

      function resolveWizardQid(rawValue, searchValue = '') {
        return extractWikidataId(rawValue || searchValue || '')
      }

      function extractWikidataSelectionLabel(searchValue, qid) {
        const normalizedQid = extractWikidataId(qid)
        if (!normalizedQid) {
          return ''
        }
        const text = String(searchValue || '').trim()
        if (!text) {
          return ''
        }

        const qidMatch = text.match(/^(.*)\(\s*(Q\d+)\s*\)\s*$/i)
        if (qidMatch) {
          const matchedQid = extractWikidataId(qidMatch[2])
          if (matchedQid && matchedQid === normalizedQid) {
            return String(qidMatch[1] || '').trim()
          }
        }

        if (text.toUpperCase() === normalizedQid) {
          return ''
        }

        return text
      }

      function normalizeWikidataSelection(option, fallbackSearchValue = '') {
        let qid = ''
        let label = ''
        let description = ''

        if (option && typeof option === 'object') {
          const nestedTextCandidates = (
            option.value && typeof option.value === 'object'
              ? [
                option.value.label,
                option.value.name,
                option.value.title,
                option.value.text,
              ]
              : []
          )
          const textCandidates = [
            option.label,
            option.name,
            option.title,
            option.text,
            ...nestedTextCandidates,
          ]
          const nestedValue = (
            option.value && typeof option.value === 'object'
              ? (
                option.value.id ||
                option.value.uri ||
                option.value.qid ||
                option.value.value ||
                ''
              )
              : option.value
          )
          const qidCandidates = [
            option.id,
            option.qid,
            option.entityId,
            option.concepturi,
            option.uri,
            nestedValue,
            option.description,
            ...textCandidates,
            fallbackSearchValue,
          ]
          for (const candidate of qidCandidates) {
            qid = extractWikidataId(String(candidate || ''))
            if (qid) {
              break
            }
          }
          label = String(textCandidates.find((candidate) => String(candidate || '').trim()) || '').trim()
          description = String(option.description || option.desc || option.info || '').trim()
        } else {
          qid = extractWikidataId(String(option || ''))
        }

        if (!qid) {
          return null
        }
        if (!label) {
          label = extractWikidataSelectionLabel(fallbackSearchValue, qid)
        }

        return {
          uid: nextWikidataSelectionUid(),
          id: qid,
          label,
          description,
        }
      }

      function enrichWikidataSelectionLabel(targetValuesRef, rawQid) {
        const qid = extractWikidataId(rawQid)
        if (!qid) {
          return
        }
        const hasMissingLabel = targetValuesRef.value.some((item) => {
          const itemQid = extractWikidataId(String(item && item.id ? item.id : ''))
          const itemLabel = String(item && item.label ? item.label : '').trim()
          return itemQid === qid && !itemLabel
        })
        if (!hasMissingLabel) {
          return
        }

        void (async () => {
          try {
            const entity = await fetchWikidataEntity(qid, locale.value)
            const resolvedLabel = entity && typeof entity === 'object'
              ? String(entity.label || '').trim()
              : ''
            if (!resolvedLabel) {
              return
            }
            targetValuesRef.value = targetValuesRef.value.map((item) => {
              const itemQid = extractWikidataId(String(item && item.id ? item.id : ''))
              const itemLabel = String(item && item.label ? item.label : '').trim()
              if (itemQid !== qid || itemLabel) {
                return item
              }
              return {
                ...(item && typeof item === 'object' ? item : {}),
                uid: item && typeof item === 'object' && item.uid ? item.uid : nextWikidataSelectionUid(),
                id: qid,
                label: resolvedLabel,
              }
            })
          } catch (error) {
            void error
          }
        })()
      }

      function setWikidataSelectionInputFromOption(option, targetValueRef, targetSearchRef, targetSuggestionsRef) {
        const normalizedSelection = normalizeWikidataSelection(option)
        if (!normalizedSelection) {
          return false
        }
        targetValueRef.value = normalizedSelection.id
        targetSearchRef.value = normalizedSelection.label
          ? `${normalizedSelection.label} (${normalizedSelection.id})`
          : normalizedSelection.id
        targetSuggestionsRef.value = []
        return true
      }

      function addNewWikidataSelection(
        targetValuesRef,
        targetValueRef,
        targetSearchRef,
        targetSuggestionsRef,
        selectedOption = null,
      ) {
        targetValuesRef.value = targetValuesRef.value.map((item) => {
          if (item && typeof item === 'object' && item.uid) {
            return item
          }
          return {
            ...(item && typeof item === 'object' ? item : {}),
            uid: nextWikidataSelectionUid(),
          }
        })

        const currentSearchValue = String(targetSearchRef.value || '').trim()
        let normalizedSelection = normalizeWikidataSelection(
          selectedOption,
          currentSearchValue,
        )
        if (!normalizedSelection) {
          const resolvedQid = resolveWizardQid(targetValueRef.value, targetSearchRef.value)
          normalizedSelection = normalizeWikidataSelection(
            resolvedQid,
            currentSearchValue,
          )
        }
        if (!normalizedSelection) {
          return false
        }

        const alreadySelected = targetValuesRef.value.some(
          (item) => extractWikidataId(String(item && item.id ? item.id : '')) === normalizedSelection.id
        )
        if (!alreadySelected) {
          targetValuesRef.value = [...targetValuesRef.value, normalizedSelection]
          if (!normalizedSelection.label) {
            enrichWikidataSelectionLabel(targetValuesRef, normalizedSelection.id)
          }
        }

        targetValueRef.value = ''
        targetSearchRef.value = ''
        targetSuggestionsRef.value = []
        return true
      }

      function removeNewWikidataSelection(targetValuesRef, rawUid, rawIndex = null) {
        const uid = String(rawUid || '').trim()
        if (uid) {
          const originalLength = targetValuesRef.value.length
          targetValuesRef.value = targetValuesRef.value.filter(
            (item) => String(item && item.uid ? item.uid : '').trim() !== uid
          )
          if (targetValuesRef.value.length !== originalLength) {
            return
          }
        }

        const index = Number.parseInt(String(rawIndex), 10)
        if (!Number.isNaN(index) && index >= 0 && index < targetValuesRef.value.length) {
          targetValuesRef.value = targetValuesRef.value.filter((_, itemIndex) => itemIndex !== index)
        }
      }

      function collectWikidataSelectionQids(selectedValues, pendingValue = '', pendingSearchValue = '') {
        const normalizedQids = []
        const seenQids = new Set()

        const addQid = (rawValue) => {
          const qid = extractWikidataId(rawValue)
          if (!qid || seenQids.has(qid)) {
            return
          }
          seenQids.add(qid)
          normalizedQids.push(qid)
        }

        if (Array.isArray(selectedValues)) {
          for (const item of selectedValues) {
            if (!item || typeof item !== 'object') {
              continue
            }
            addQid(String(item.id || item.value || ''))
          }
        }
        addQid(resolveWizardQid(pendingValue, pendingSearchValue))

        return normalizedQids
      }

      function wikidataSelectionChipLabel(item) {
        if (!item || typeof item !== 'object') {
          return ''
        }
        const qid = extractWikidataId(String(item.id || item.value || ''))
        if (!qid) {
          return ''
        }
        const label = String(item.label || '').trim()
        if (label) {
          return `${label} (${qid})`
        }
        return qid
      }

      async function loadAuthStatus() {
        authStatusLoading.value = true
        try {
          const payload = await fetchAuthStatus()
          const isPayloadObject = payload && typeof payload === 'object'
          authEnabled.value = isPayloadObject ? Boolean(payload.enabled) : false
          authAuthenticated.value = isPayloadObject ? Boolean(payload.authenticated) : false
          authUsername.value = isPayloadObject ? String(payload.username || '') : ''
          authLoginUrl.value = isPayloadObject
            ? String(payload.login_url || '/auth/login/mediawiki/?next=/')
            : '/auth/login/mediawiki/?next=/'
          authLogoutUrl.value = isPayloadObject
            ? String(payload.logout_url || '/auth/logout/?next=/')
            : '/auth/logout/?next=/'
        } catch (error) {
          authEnabled.value = false
          authAuthenticated.value = false
          authUsername.value = ''
        } finally {
          authStatusLoading.value = false
        }
      }

      function startWikimediaLogin() {
        window.location.href = authLoginUrl.value || '/auth/login/mediawiki/?next=/'
      }

      function logoutWikimedia() {
        window.location.href = authLogoutUrl.value || '/auth/logout/?next=/'
      }

      function openCradleGuideDialog() {
        showCradleGuideDialog.value = true
      }

      function closeCradleGuideDialog() {
        showCradleGuideDialog.value = false
      }

      function openCradle() {
        window.open(cradleUrl, '_blank', 'noopener,noreferrer')
      }

      function resetWikidataCreationForm() {
        newWikidataWizardStep.value = 'basic'
        wizardError.value = ''
        wizardSaving.value = false
        wizardExistingWikidataItem.value = ''
        wizardExistingWikidataSearch.value = ''
        wizardExistingSuggestions.value = []
        wizardExistingLoading.value = false
        wizardExistingSourceUrl.value = ''
        wizardExistingSourceTitle.value = ''
        wizardExistingSourceTitleLanguage.value = defaultWikidataTextLanguage()
        wizardExistingSourceAuthor.value = ''
        wizardExistingSourcePublicationDate.value = ''
        wizardExistingSourcePublisherP123.value = ''
        wizardExistingSourcePublisherSearch.value = ''
        wizardExistingSourcePublisherSuggestions.value = []
        wizardExistingSourcePublisherLoading.value = false
        wizardExistingSourcePublishedInP1433.value = ''
        wizardExistingSourcePublishedInSearch.value = ''
        wizardExistingSourcePublishedInSuggestions.value = []
        wizardExistingSourcePublishedInLoading.value = false
        wizardExistingSourceLanguageOfWorkP407.value = ''
        wizardExistingSourceLanguageOfWorkSearch.value = ''
        wizardExistingSourceLanguageOfWorkSuggestions.value = []
        wizardExistingSourceLanguageOfWorkLoading.value = false
        wizardExistingCitoidLoading.value = false
        wizardExistingCitoidError.value = ''
        wizardExistingLastCitoidUrl.value = ''
        newWikidataPrimaryLabels.value = { fi: '', sv: '', en: '' }
        newWikidataPrimaryDescriptions.value = { fi: '', sv: '', en: '' }
        clearAllNewWikidataAdditionalLanguageEntries()
        newWikidataAdditionalLanguageEntries.value = []
        newWikidataPartOfP361.value = ''
        newWikidataPartOfP361Values.value = []
        newWikidataPartOfSearch.value = ''
        newWikidataPartOfSuggestions.value = []
        newWikidataPartOfLoading.value = false
        newWikidataInstanceOf.value = ''
        newWikidataInstanceOfValues.value = []
        newWikidataInstanceSearch.value = ''
        newWikidataInstanceSuggestions.value = []
        newWikidataInstanceLoading.value = false
        newWikidataCountryP17.value = ''
        newWikidataCountrySearch.value = ''
        newWikidataCountrySuggestions.value = []
        newWikidataCountryLoading.value = false
        newWikidataMunicipalityP131.value = ''
        newWikidataMunicipalitySearch.value = ''
        newWikidataMunicipalitySuggestions.value = []
        newWikidataMunicipalityLoading.value = false
        newWikidataLocationP276.value = ''
        newWikidataLocationSearch.value = ''
        newWikidataLocationSuggestions.value = []
        newWikidataLocationLoading.value = false
        newWikidataLatitude.value = ''
        newWikidataLongitude.value = ''
        newWikidataArchitectP84.value = ''
        newWikidataArchitectP84Values.value = []
        newWikidataArchitectSearch.value = ''
        newWikidataArchitectSuggestions.value = []
        newWikidataArchitectLoading.value = false
        newWikidataInceptionP571.value = ''
        newWikidataArchitectSourceUrl.value = ''
        newWikidataInceptionSourceUrl.value = ''
        newWikidataHeritageP1435.value = ''
        newWikidataHeritageP1435Values.value = []
        newWikidataHeritageSearch.value = ''
        newWikidataHeritageSuggestions.value = []
        newWikidataHeritageLoading.value = false
        newWikidataHeritageSourceUrl.value = ''
        newWikidataAddressTextP6375.value = ''
        newWikidataAddressTextLanguageP6375.value = defaultWikidataTextLanguage()
        newWikidataPostalCodeP281.value = ''
        newWikidataCommonsCategoryP373.value = ''
        newWikidataCommonsSearch.value = ''
        newWikidataCommonsSuggestions.value = []
        newWikidataCommonsLoading.value = false
        newWikidataArchitecturalStyleP149.value = ''
        newWikidataArchitecturalStyleSearch.value = ''
        newWikidataArchitecturalStyleSuggestions.value = []
        newWikidataArchitecturalStyleLoading.value = false
        newWikidataOfficialClosureDateP3999.value = ''
        newWikidataOfficialClosureDateSourceUrl.value = ''
        newWikidataRouteInstructionP2795.value = ''
        newWikidataRouteInstructionLanguageP2795.value = defaultWikidataTextLanguage()
        newWikidataOptionalPropertyKeys.value = []
        newWikidataCustomPropertyDefinitions.value = {}
        newWikidataCustomPropertyValues.value = {}
        newWikidataPropertySearch.value = ''
        newWikidataPropertySuggestions.value = []
        newWikidataPropertyLoading.value = false
      }

      function chooseCreateWizardMode(mode) {
        createWizardMode.value = mode
        newWikidataWizardStep.value = 'basic'
        createWizardStep.value = 'form'
        wizardError.value = ''
      }

      function returnToCreateWizardChoice() {
        if (wizardChoiceLocked.value || isCreateActionBusy.value) {
          return
        }
        createWizardMode.value = ''
        newWikidataWizardStep.value = 'basic'
        createWizardStep.value = 'choose'
        wizardError.value = ''
      }

      let newWikidataAdditionalLanguageLookupSequence = 0

      function wikidataLanguageOptionDisplayName(option) {
        const normalizedOption = normalizeWikidataLanguageOption(option)
        if (!normalizedOption) {
          return ''
        }

        const code = String(normalizedOption.code || '').trim().toUpperCase()
        const name = String(normalizedOption.name || '').trim()
        const autonym = String(normalizedOption.autonym || '').trim()
        const normalizedName = normalizeLanguageSearchToken(name)
        const normalizedAutonym = normalizeLanguageSearchToken(autonym)

        const labelParts = []
        if (name) {
          labelParts.push(name)
        }
        if (autonym && normalizedAutonym && normalizedAutonym !== normalizedName) {
          labelParts.push(autonym)
        }
        const label = labelParts.join(' / ')

        if (label && code) {
          return `${label} (${code})`
        }
        if (label) {
          return label
        }
        return code
      }

      function languageOptionSearchTokens(option) {
        const normalizedOption = normalizeWikidataLanguageOption(option)
        if (!normalizedOption) {
          return []
        }

        const tokens = new Set()
        for (const token of normalizedOption.searchTokens) {
          const normalizedToken = normalizeLanguageSearchToken(token)
          if (normalizedToken) {
            tokens.add(normalizedToken)
          }
        }

        const displayLabel = normalizeLanguageSearchToken(wikidataLanguageOptionDisplayName(normalizedOption))
        if (displayLabel) {
          tokens.add(displayLabel)
        }

        return Array.from(tokens)
      }

      function resolveWikidataLanguageCode(value, suggestions = []) {
        const rawValue = String(value || '').trim()
        if (!rawValue) {
          return ''
        }
        const normalizedSuggestions = Array.isArray(suggestions) ? suggestions : []

        const explicitCodeMatch = rawValue.match(/\(([a-z]{2,12})\)\s*$/i)
        if (explicitCodeMatch) {
          return normalizeLanguageCode(explicitCodeMatch[1])
        }

        const loweredRawValue = rawValue.toLowerCase()
        if (wikidataLanguageCodePattern.test(loweredRawValue)) {
          return normalizeLanguageCode(loweredRawValue)
        }

        const normalizedValue = normalizeLanguageSearchToken(rawValue)
        for (const suggestion of normalizedSuggestions) {
          const normalizedSuggestion = normalizeWikidataLanguageOption(suggestion)
          if (!normalizedSuggestion) {
            continue
          }
          const searchTokens = languageOptionSearchTokens(normalizedSuggestion)
          if (searchTokens.includes(normalizedValue)) {
            return normalizedSuggestion.code
          }
        }
        return ''
      }

      function disposeNewWikidataAdditionalLanguageEntry(entry) {
        if (!entry || typeof entry !== 'object') {
          return
        }
        if (entry.languageSearchTimer) {
          window.clearTimeout(entry.languageSearchTimer)
          entry.languageSearchTimer = null
        }
        entry.languageLookupToken = 0
        entry.languageLoading = false
        entry.languageSuggestionsOpen = false
        entry.languageSuggestions = []
      }

      function clearAllNewWikidataAdditionalLanguageEntries() {
        for (const entry of newWikidataAdditionalLanguageEntries.value) {
          disposeNewWikidataAdditionalLanguageEntry(entry)
        }
      }

      async function loadNewWikidataAdditionalLanguageSuggestions(entry, query) {
        if (!entry || typeof entry !== 'object') {
          return
        }

        const searchTerm = String(query || '').trim()
        if (!searchTerm) {
          entry.languageLookupToken = 0
          entry.languageLoading = false
          entry.languageSuggestionsOpen = false
          entry.languageSuggestions = []
          return
        }

        const lookupToken = ++newWikidataAdditionalLanguageLookupSequence
        entry.languageLookupToken = lookupToken
        entry.languageLoading = true

        try {
          const items = await searchWikidataLanguages(searchTerm, locale.value, AUTOCOMPLETE_RESULT_LIMIT)
          if (entry.languageLookupToken !== lookupToken) {
            return
          }

          entry.languageSuggestions = Array.isArray(items) ? items : []
          const resolvedCode = resolveWikidataLanguageCode(entry.languageSearch, entry.languageSuggestions)
          if (resolvedCode) {
            entry.language = resolvedCode
          }
        } catch (error) {
          if (entry.languageLookupToken !== lookupToken) {
            return
          }
          entry.languageSuggestions = []
        } finally {
          if (entry.languageLookupToken === lookupToken) {
            entry.languageLoading = false
          }
        }
      }

      function scheduleNewWikidataAdditionalLanguageSearch(entry, query) {
        if (!entry || typeof entry !== 'object') {
          return
        }
        if (entry.languageSearchTimer) {
          window.clearTimeout(entry.languageSearchTimer)
          entry.languageSearchTimer = null
        }

        const searchTerm = String(query || '').trim()
        if (!searchTerm) {
          entry.languageLookupToken = 0
          entry.languageLoading = false
          entry.languageSuggestions = []
          return
        }

        entry.languageSearchTimer = window.setTimeout(() => {
          entry.languageSearchTimer = null
          loadNewWikidataAdditionalLanguageSuggestions(entry, searchTerm)
        }, 250)
      }

      function addNewWikidataAdditionalLanguage() {
        newWikidataAdditionalLanguageEntries.value.push({
          language: '',
          languageSearch: '',
          languageSuggestions: [],
          languageSuggestionsOpen: false,
          languageLoading: false,
          languageLookupToken: 0,
          languageSearchTimer: null,
          label: '',
          description: '',
        })
      }

      function removeNewWikidataAdditionalLanguage(index) {
        const parsedIndex = Number(index)
        if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex >= newWikidataAdditionalLanguageEntries.value.length) {
          return
        }
        const entry = newWikidataAdditionalLanguageEntries.value[parsedIndex]
        disposeNewWikidataAdditionalLanguageEntry(entry)
        newWikidataAdditionalLanguageEntries.value.splice(parsedIndex, 1)
      }

      function onNewWikidataAdditionalLanguageInput(index) {
        const parsedIndex = Number(index)
        if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex >= newWikidataAdditionalLanguageEntries.value.length) {
          return
        }
        const entry = newWikidataAdditionalLanguageEntries.value[parsedIndex]
        if (!entry || typeof entry !== 'object') {
          return
        }
        entry.language = ''
        const query = String(entry.languageSearch || '').trim()
        const normalizedCode = normalizeLanguageCode(query)
        if (wikidataLanguageCodePattern.test(normalizedCode) && wikidataLanguageCodePattern.test(query.toLowerCase())) {
          entry.language = normalizedCode
        }
        entry.languageSuggestionsOpen = Boolean(query)
        scheduleNewWikidataAdditionalLanguageSearch(entry, query)
      }

      function onNewWikidataAdditionalLanguageFocus(index) {
        const parsedIndex = Number(index)
        if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex >= newWikidataAdditionalLanguageEntries.value.length) {
          return
        }
        const entry = newWikidataAdditionalLanguageEntries.value[parsedIndex]
        if (!entry || typeof entry !== 'object') {
          return
        }
        const query = String(entry.languageSearch || '').trim()
        if (!query) {
          return
        }
        entry.languageSuggestionsOpen = true
        if (entry.languageSearchTimer) {
          window.clearTimeout(entry.languageSearchTimer)
          entry.languageSearchTimer = null
        }
        loadNewWikidataAdditionalLanguageSuggestions(entry, query)
      }

      function selectNewWikidataAdditionalLanguage(index, option) {
        const parsedIndex = Number(index)
        if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex >= newWikidataAdditionalLanguageEntries.value.length) {
          return
        }
        if (!option || typeof option !== 'object') {
          return
        }
        const entry = newWikidataAdditionalLanguageEntries.value[parsedIndex]
        if (!entry || typeof entry !== 'object') {
          return
        }
        const normalizedOption = normalizeWikidataLanguageOption(option)
        if (!normalizedOption) {
          return
        }
        entry.language = normalizedOption.code
        entry.languageSearch = wikidataLanguageOptionDisplayName(normalizedOption)
        entry.languageLookupToken = 0
        entry.languageLoading = false
        if (entry.languageSearchTimer) {
          window.clearTimeout(entry.languageSearchTimer)
          entry.languageSearchTimer = null
        }
        entry.languageSuggestionsOpen = false
        entry.languageSuggestions = []
      }

      function hideNewWikidataAdditionalLanguageSuggestionsSoon(index) {
        const parsedIndex = Number(index)
        if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex >= newWikidataAdditionalLanguageEntries.value.length) {
          return
        }
        window.setTimeout(() => {
          const entry = newWikidataAdditionalLanguageEntries.value[parsedIndex]
          if (!entry || typeof entry !== 'object') {
            return
          }
          entry.languageSuggestionsOpen = false
        }, 120)
      }

      function collectNewWikidataLabelsAndDescriptions() {
        const labels = {}
        const descriptions = {}
        let hasPrimaryPair = false

        for (const langCode of ['fi', 'sv', 'en']) {
          const label = String(newWikidataPrimaryLabels.value[langCode] || '').trim()
          const description = String(newWikidataPrimaryDescriptions.value[langCode] || '').trim()
          if (!label && !description) {
            continue
          }
          if (!label) {
            return {
              error: t('locationNameRequiredForLanguage', { language: langCode.toUpperCase() }),
            }
          }
          if (!description) {
            return {
              error: t('locationDescriptionRequiredForLanguage', { language: langCode.toUpperCase() }),
            }
          }
          labels[langCode] = label
          descriptions[langCode] = description
          hasPrimaryPair = true
        }

        if (!hasPrimaryPair) {
          return { error: t('locationNameDescriptionPairRequired') }
        }

        for (const entry of newWikidataAdditionalLanguageEntries.value) {
          if (!entry || typeof entry !== 'object') {
            continue
          }
          const languageInput = String(entry.language || entry.languageSearch || '').trim()
          const label = String(entry.label || '').trim()
          const description = String(entry.description || '').trim()
          if (!languageInput && !label && !description) {
            continue
          }
          if (!languageInput) {
            return { error: t('additionalLanguageCodeRequired') }
          }
          const language = resolveWikidataLanguageCode(languageInput, entry.languageSuggestions || [])
          if (!wikidataLanguageCodePattern.test(language)) {
            return { error: t('additionalLanguageCodeInvalid') }
          }
          if (!label) {
            return {
              error: t('locationNameRequiredForLanguage', { language: language.toUpperCase() }),
            }
          }
          if (!description) {
            return {
              error: t('locationDescriptionRequiredForLanguage', { language: language.toUpperCase() }),
            }
          }
          labels[language] = label
          descriptions[language] = description
        }

        return { labels, descriptions }
      }

      function validateNewWikidataTextStep() {
        const textPayload = collectNewWikidataLabelsAndDescriptions()
        if (textPayload.error) {
          wizardError.value = textPayload.error
          return false
        }
        return true
      }

      function validateNewWikidataLocationStep() {
        const countryQid = resolveWizardQid(newWikidataCountryP17.value, newWikidataCountrySearch.value)
        const municipalityQid = resolveWizardQid(newWikidataMunicipalityP131.value, newWikidataMunicipalitySearch.value)
        if (!countryQid) {
          wizardError.value = t('countrySelectionRequired')
          return false
        }
        if (!municipalityQid) {
          wizardError.value = t('municipalitySelectionRequired')
          return false
        }

        const latitude = Number.parseFloat(String(newWikidataLatitude.value))
        const longitude = Number.parseFloat(String(newWikidataLongitude.value))
        if (Number.isNaN(latitude)) {
          wizardError.value = t('latitudeRequired')
          return false
        }
        if (Number.isNaN(longitude)) {
          wizardError.value = t('longitudeRequired')
          return false
        }
        return true
      }

      function validateNewWikidataPropertiesStep() {
        const instanceQids = collectWikidataSelectionQids(
          newWikidataInstanceOfValues.value,
          newWikidataInstanceOf.value,
          newWikidataInstanceSearch.value,
        )
        if (instanceQids.length === 0) {
          wizardError.value = t('locationTypeRequired')
          return false
        }
        return true
      }

      function goToNextNewWikidataStep() {
        if (!isWizardNewMode.value || isCreateActionBusy.value) {
          return
        }
        wizardError.value = ''
        if (newWikidataWizardStep.value === 'basic') {
          if (!validateNewWikidataTextStep()) {
            return
          }
          newWikidataWizardStep.value = 'location'
          return
        }
        if (newWikidataWizardStep.value === 'location') {
          if (!validateNewWikidataLocationStep()) {
            return
          }
          newWikidataWizardStep.value = 'properties'
          return
        }
        if (newWikidataWizardStep.value === 'properties') {
          if (!validateNewWikidataPropertiesStep()) {
            return
          }
          newWikidataWizardStep.value = 'identifiers'
          return
        }
        if (newWikidataWizardStep.value === 'identifiers') {
          newWikidataWizardStep.value = 'source'
        }
      }

      function goToPreviousNewWikidataStep() {
        if (!isWizardNewMode.value || isCreateActionBusy.value) {
          return
        }
        wizardError.value = ''
        if (newWikidataWizardStep.value === 'source') {
          newWikidataWizardStep.value = 'identifiers'
          return
        }
        if (newWikidataWizardStep.value === 'identifiers') {
          newWikidataWizardStep.value = 'properties'
          return
        }
        if (newWikidataWizardStep.value === 'properties') {
          newWikidataWizardStep.value = 'location'
          return
        }
        if (newWikidataWizardStep.value === 'location') {
          newWikidataWizardStep.value = 'basic'
        }
      }

      function openCreateLocationDialog() {
        if (!canCreateLocation.value) {
          return
        }

        wizardSaving.value = false
        resetWikidataCreationForm()
        wizardChoiceLocked.value = false
        createWizardMode.value = ''
        createWizardStep.value = 'choose'
        showCreateLocationDialog.value = true
      }

      function closeCreateLocationDialog() {
        if (wizardSaving.value) {
          return
        }
        showCreateLocationDialog.value = false
        createWizardMode.value = ''
        createWizardStep.value = 'choose'
        wizardChoiceLocked.value = false
        wizardSaving.value = false
        wizardError.value = ''
      }

      function hideSuggestionsSoon(targetSuggestionsRef) {
        window.setTimeout(() => {
          targetSuggestionsRef.value = []
        }, 120)
      }

      function selectWikidataSuggestion(option, targetIdRef, targetSearchRef, targetSuggestionsRef) {
        targetIdRef.value = option.id
        targetSearchRef.value = `${option.label} (${option.id})`
        targetSuggestionsRef.value = []
      }

      async function setWikidataSearchDisplayFromQid(targetSearchRef, rawValue) {
        const normalizedQid = extractWikidataId(String(rawValue || ''))
        if (!normalizedQid) {
          targetSearchRef.value = String(rawValue || '').trim()
          return
        }
        targetSearchRef.value = normalizedQid
        try {
          const entity = await fetchWikidataEntity(normalizedQid, locale.value)
          const label = entity && typeof entity === 'object'
            ? String(entity.label || '').trim()
            : ''
          if (!label) {
            return
          }
          if (extractWikidataId(targetSearchRef.value) === normalizedQid) {
            targetSearchRef.value = `${label} (${normalizedQid})`
          }
        } catch (error) {
          // Keep plain QID on lookup failure.
        }
      }

      function onWizardExistingWikidataInput() {
        wizardExistingWikidataItem.value = ''
        const inputValue = wizardExistingWikidataSearch.value.trim()
        if (!inputValue) {
          wizardExistingSuggestions.value = []
          return
        }

        searchWizardExistingSuggestionsDebounced(inputValue)
      }

      function selectWizardExistingWikidataItem(option) {
        wizardExistingWikidataItem.value = option.id
        wizardExistingWikidataSearch.value = `${option.label} (${option.id})`
        wizardExistingSuggestions.value = []
      }

      function hideWizardExistingSuggestionsSoon() {
        hideSuggestionsSoon(wizardExistingSuggestions)
      }

      function onWizardExistingSourceUrlInput() {
        wizardExistingCitoidError.value = ''
      }

      async function autofillWizardExistingSourceMetadata(force = false) {
        const sourceUrl = String(wizardExistingSourceUrl.value || '').trim()
        if (!isHttpUrl(sourceUrl)) {
          return
        }
        if (!force && wizardExistingLastCitoidUrl.value === sourceUrl) {
          return
        }

        wizardExistingCitoidLoading.value = true
        wizardExistingCitoidError.value = ''
        try {
          const metadata = await fetchCitoidMetadata(sourceUrl, locale.value)
          const normalizedMetadata = metadata && typeof metadata === 'object' ? metadata : {}

          wizardExistingSourceTitle.value = String(normalizedMetadata.source_title || '').trim()
          wizardExistingSourceTitleLanguage.value = String(normalizedMetadata.source_title_language || '').trim() || defaultWikidataTextLanguage()
          wizardExistingSourceAuthor.value = String(normalizedMetadata.source_author || '').trim()
          wizardExistingSourcePublicationDate.value = String(normalizedMetadata.source_publication_date || '').trim()
          wizardExistingSourcePublisherP123.value = String(normalizedMetadata.source_publisher_p123 || '').trim()
          void setWikidataSearchDisplayFromQid(
            wizardExistingSourcePublisherSearch,
            wizardExistingSourcePublisherP123.value,
          )
          wizardExistingSourcePublishedInP1433.value = String(normalizedMetadata.source_published_in_p1433 || '').trim()
          void setWikidataSearchDisplayFromQid(
            wizardExistingSourcePublishedInSearch,
            wizardExistingSourcePublishedInP1433.value,
          )
          wizardExistingSourceLanguageOfWorkP407.value = String(normalizedMetadata.source_language_of_work_p407 || '').trim()
          void setWikidataSearchDisplayFromQid(
            wizardExistingSourceLanguageOfWorkSearch,
            wizardExistingSourceLanguageOfWorkP407.value,
          )
          wizardExistingLastCitoidUrl.value = sourceUrl
        } catch (error) {
          wizardExistingCitoidError.value = error && error.message ? error.message : t('loadError')
        } finally {
          wizardExistingCitoidLoading.value = false
        }
      }

      function onWizardExistingSourceUrlBlur() {
        void autofillWizardExistingSourceMetadata(false)
      }

      function onWizardExistingSourcePublisherInput() {
        wizardExistingSourcePublisherP123.value = ''
        const inputValue = wizardExistingSourcePublisherSearch.value.trim()
        if (!inputValue) {
          wizardExistingSourcePublisherSuggestions.value = []
          return
        }
        searchWizardExistingSourcePublisherSuggestionsDebounced(inputValue)
      }

      function selectWizardExistingSourcePublisher(option) {
        selectWikidataSuggestion(
          option,
          wizardExistingSourcePublisherP123,
          wizardExistingSourcePublisherSearch,
          wizardExistingSourcePublisherSuggestions,
        )
      }

      function hideWizardExistingSourcePublisherSuggestionsSoon() {
        hideSuggestionsSoon(wizardExistingSourcePublisherSuggestions)
      }

      function onWizardExistingSourcePublishedInInput() {
        wizardExistingSourcePublishedInP1433.value = ''
        const inputValue = wizardExistingSourcePublishedInSearch.value.trim()
        if (!inputValue) {
          wizardExistingSourcePublishedInSuggestions.value = []
          return
        }
        searchWizardExistingSourcePublishedInSuggestionsDebounced(inputValue)
      }

      function selectWizardExistingSourcePublishedIn(option) {
        selectWikidataSuggestion(
          option,
          wizardExistingSourcePublishedInP1433,
          wizardExistingSourcePublishedInSearch,
          wizardExistingSourcePublishedInSuggestions,
        )
      }

      function hideWizardExistingSourcePublishedInSuggestionsSoon() {
        hideSuggestionsSoon(wizardExistingSourcePublishedInSuggestions)
      }

      function onWizardExistingSourceLanguageOfWorkInput() {
        wizardExistingSourceLanguageOfWorkP407.value = ''
        const inputValue = wizardExistingSourceLanguageOfWorkSearch.value.trim()
        if (!inputValue) {
          wizardExistingSourceLanguageOfWorkSuggestions.value = []
          return
        }
        searchWizardExistingSourceLanguageOfWorkSuggestionsDebounced(inputValue)
      }

      function selectWizardExistingSourceLanguageOfWork(option) {
        selectWikidataSuggestion(
          option,
          wizardExistingSourceLanguageOfWorkP407,
          wizardExistingSourceLanguageOfWorkSearch,
          wizardExistingSourceLanguageOfWorkSuggestions,
        )
      }

      function hideWizardExistingSourceLanguageOfWorkSuggestionsSoon() {
        hideSuggestionsSoon(wizardExistingSourceLanguageOfWorkSuggestions)
      }

      function onNewWikidataPartOfInput() {
        newWikidataPartOfP361.value = ''
        if (!newWikidataPartOfSearch.value.trim()) {
          newWikidataPartOfSuggestions.value = []
          return
        }
        searchNewPartOfSuggestionsDebounced(newWikidataPartOfSearch.value.trim())
      }

      function addNewWikidataPartOfFromInput() {
        addNewWikidataSelection(
          newWikidataPartOfP361Values,
          newWikidataPartOfP361,
          newWikidataPartOfSearch,
          newWikidataPartOfSuggestions,
        )
      }

      function selectNewWikidataPartOf(option) {
        if (!setWikidataSelectionInputFromOption(
          option,
          newWikidataPartOfP361,
          newWikidataPartOfSearch,
          newWikidataPartOfSuggestions,
        )) {
          return
        }
        addNewWikidataSelection(
          newWikidataPartOfP361Values,
          newWikidataPartOfP361,
          newWikidataPartOfSearch,
          newWikidataPartOfSuggestions,
        )
      }

      function removeNewWikidataPartOf(uid, index = null) {
        removeNewWikidataSelection(newWikidataPartOfP361Values, uid, index)
      }

      function hideNewWikidataPartOfSuggestionsSoon() {
        hideSuggestionsSoon(newWikidataPartOfSuggestions)
      }

      function onNewWikidataInstanceInput() {
        newWikidataInstanceOf.value = ''
        if (!newWikidataInstanceSearch.value.trim()) {
          newWikidataInstanceSuggestions.value = []
          return
        }
        searchNewInstanceSuggestionsDebounced(newWikidataInstanceSearch.value.trim())
      }

      function addNewWikidataInstanceFromInput() {
        addNewWikidataSelection(
          newWikidataInstanceOfValues,
          newWikidataInstanceOf,
          newWikidataInstanceSearch,
          newWikidataInstanceSuggestions,
        )
      }

      function selectNewWikidataInstance(option) {
        if (!setWikidataSelectionInputFromOption(
          option,
          newWikidataInstanceOf,
          newWikidataInstanceSearch,
          newWikidataInstanceSuggestions,
        )) {
          return
        }
        addNewWikidataSelection(
          newWikidataInstanceOfValues,
          newWikidataInstanceOf,
          newWikidataInstanceSearch,
          newWikidataInstanceSuggestions,
        )
      }

      function removeNewWikidataInstance(uid, index = null) {
        removeNewWikidataSelection(newWikidataInstanceOfValues, uid, index)
      }

      function hideNewWikidataInstanceSuggestionsSoon() {
        hideSuggestionsSoon(newWikidataInstanceSuggestions)
      }

      function onNewWikidataCountryInput() {
        newWikidataCountryP17.value = ''
        if (!newWikidataCountrySearch.value.trim()) {
          newWikidataCountrySuggestions.value = []
          return
        }
        searchNewCountrySuggestionsDebounced(newWikidataCountrySearch.value.trim())
      }

      function selectNewWikidataCountry(option) {
        selectWikidataSuggestion(
          option,
          newWikidataCountryP17,
          newWikidataCountrySearch,
          newWikidataCountrySuggestions,
        )
      }

      function hideNewWikidataCountrySuggestionsSoon() {
        hideSuggestionsSoon(newWikidataCountrySuggestions)
      }

      function onNewWikidataMunicipalityInput() {
        newWikidataMunicipalityP131.value = ''
        if (!newWikidataMunicipalitySearch.value.trim()) {
          newWikidataMunicipalitySuggestions.value = []
          return
        }
        searchNewMunicipalitySuggestionsDebounced(newWikidataMunicipalitySearch.value.trim())
      }

      function selectNewWikidataMunicipality(option) {
        selectWikidataSuggestion(
          option,
          newWikidataMunicipalityP131,
          newWikidataMunicipalitySearch,
          newWikidataMunicipalitySuggestions,
        )
      }

      function hideNewWikidataMunicipalitySuggestionsSoon() {
        hideSuggestionsSoon(newWikidataMunicipalitySuggestions)
      }

      function onNewWikidataLocationInput() {
        newWikidataLocationP276.value = ''
        if (!newWikidataLocationSearch.value.trim()) {
          newWikidataLocationSuggestions.value = []
          return
        }
        searchNewLocationSuggestionsDebounced(newWikidataLocationSearch.value.trim())
      }

      function selectNewWikidataLocation(option) {
        selectWikidataSuggestion(
          option,
          newWikidataLocationP276,
          newWikidataLocationSearch,
          newWikidataLocationSuggestions,
        )
      }

      function hideNewWikidataLocationSuggestionsSoon() {
        hideSuggestionsSoon(newWikidataLocationSuggestions)
      }

      function onNewWikidataArchitectInput() {
        newWikidataArchitectP84.value = ''
        if (!newWikidataArchitectSearch.value.trim()) {
          newWikidataArchitectSuggestions.value = []
          return
        }
        searchNewArchitectSuggestionsDebounced(newWikidataArchitectSearch.value.trim())
      }

      function addNewWikidataArchitectFromInput() {
        addNewWikidataSelection(
          newWikidataArchitectP84Values,
          newWikidataArchitectP84,
          newWikidataArchitectSearch,
          newWikidataArchitectSuggestions,
        )
      }

      function selectNewWikidataArchitect(option) {
        if (!setWikidataSelectionInputFromOption(
          option,
          newWikidataArchitectP84,
          newWikidataArchitectSearch,
          newWikidataArchitectSuggestions,
        )) {
          return
        }
        addNewWikidataSelection(
          newWikidataArchitectP84Values,
          newWikidataArchitectP84,
          newWikidataArchitectSearch,
          newWikidataArchitectSuggestions,
        )
      }

      function removeNewWikidataArchitect(uid, index = null) {
        removeNewWikidataSelection(newWikidataArchitectP84Values, uid, index)
      }

      function hideNewWikidataArchitectSuggestionsSoon() {
        hideSuggestionsSoon(newWikidataArchitectSuggestions)
      }

      function onNewWikidataHeritageInput() {
        newWikidataHeritageP1435.value = ''
        if (!newWikidataHeritageSearch.value.trim()) {
          newWikidataHeritageSuggestions.value = []
          return
        }
        searchNewHeritageSuggestionsDebounced(newWikidataHeritageSearch.value.trim())
      }

      function addNewWikidataHeritageFromInput() {
        addNewWikidataSelection(
          newWikidataHeritageP1435Values,
          newWikidataHeritageP1435,
          newWikidataHeritageSearch,
          newWikidataHeritageSuggestions,
        )
      }

      function selectNewWikidataHeritage(option) {
        if (!setWikidataSelectionInputFromOption(
          option,
          newWikidataHeritageP1435,
          newWikidataHeritageSearch,
          newWikidataHeritageSuggestions,
        )) {
          return
        }
        addNewWikidataSelection(
          newWikidataHeritageP1435Values,
          newWikidataHeritageP1435,
          newWikidataHeritageSearch,
          newWikidataHeritageSuggestions,
        )
      }

      function removeNewWikidataHeritage(uid, index = null) {
        removeNewWikidataSelection(newWikidataHeritageP1435Values, uid, index)
      }

      function hideNewWikidataHeritageSuggestionsSoon() {
        hideSuggestionsSoon(newWikidataHeritageSuggestions)
      }

      function onNewWikidataArchitecturalStyleInput() {
        newWikidataArchitecturalStyleP149.value = ''
        if (!newWikidataArchitecturalStyleSearch.value.trim()) {
          newWikidataArchitecturalStyleSuggestions.value = []
          return
        }
        searchNewStyleSuggestionsDebounced(newWikidataArchitecturalStyleSearch.value.trim())
      }

      function selectNewWikidataArchitecturalStyle(option) {
        selectWikidataSuggestion(
          option,
          newWikidataArchitecturalStyleP149,
          newWikidataArchitecturalStyleSearch,
          newWikidataArchitecturalStyleSuggestions,
        )
      }

      function hideNewWikidataArchitecturalStyleSuggestionsSoon() {
        hideSuggestionsSoon(newWikidataArchitecturalStyleSuggestions)
      }

      function onNewWikidataCommonsInput() {
        newWikidataCommonsCategoryP373.value = ''
        if (!newWikidataCommonsSearch.value.trim()) {
          newWikidataCommonsSuggestions.value = []
          return
        }
        searchNewCommonsSuggestionsDebounced(newWikidataCommonsSearch.value.trim())
      }

      function selectNewWikidataCommons(option) {
        newWikidataCommonsCategoryP373.value = option.name
        newWikidataCommonsSearch.value = option.title
        newWikidataCommonsSuggestions.value = []
      }

      function hideNewWikidataCommonsSuggestionsSoon() {
        hideSuggestionsSoon(newWikidataCommonsSuggestions)
      }

      async function submitExistingWikidataSelection() {
        wizardError.value = ''
        if (!authAuthenticated.value) {
          wizardError.value = t('authRequiredForWikidataWrites')
          return
        }
        const qid = resolveWizardQid(
          wizardExistingWikidataItem.value,
          wizardExistingWikidataSearch.value,
        )
        if (!qid) {
          wizardError.value = t('wikidataItemRequired')
          return
        }
        const sourceUrl = String(wizardExistingSourceUrl.value || '').trim()
        if (!sourceUrl) {
          wizardError.value = t('sourceUrlRequiredForAddExisting')
          return
        }
        if (!isHttpUrl(sourceUrl)) {
          wizardError.value = t('sourceUrlRequiredForAddExisting')
          return
        }
        const sourcePublisherQid = resolveWizardQid(
          wizardExistingSourcePublisherP123.value,
          wizardExistingSourcePublisherSearch.value,
        )
        if (wizardExistingSourcePublisherSearch.value.trim() && !sourcePublisherQid) {
          wizardError.value = t('sourcePublisherInvalid')
          return
        }
        const sourcePublishedInQid = resolveWizardQid(
          wizardExistingSourcePublishedInP1433.value,
          wizardExistingSourcePublishedInSearch.value,
        )
        if (wizardExistingSourcePublishedInSearch.value.trim() && !sourcePublishedInQid) {
          wizardError.value = t('sourcePublishedInInvalid')
          return
        }
        const sourceLanguageOfWorkQid = resolveWizardQid(
          wizardExistingSourceLanguageOfWorkP407.value,
          wizardExistingSourceLanguageOfWorkSearch.value,
        )
        if (wizardExistingSourceLanguageOfWorkSearch.value.trim() && !sourceLanguageOfWorkQid) {
          wizardError.value = t('sourceLanguageOfWorkInvalid')
          return
        }

        wizardSaving.value = true
        try {
          await addExistingWikidataItem({
            wikidata_item: qid,
            source_url: sourceUrl,
            source_title: String(wizardExistingSourceTitle.value || '').trim(),
            source_title_language: String(wizardExistingSourceTitleLanguage.value || '').trim(),
            source_author: String(wizardExistingSourceAuthor.value || '').trim(),
            source_publication_date: String(wizardExistingSourcePublicationDate.value || '').trim(),
            source_publisher_p123: sourcePublisherQid,
            source_published_in_p1433: sourcePublishedInQid,
            source_language_of_work_p407: sourceLanguageOfWorkQid,
          })
          window.alert(t('addExistingWikidataSuccess'))
          notifyLocationsChanged()
          await getLocationsCached(locale.value, { force: true })
          showCreateLocationDialog.value = false
        } catch (error) {
          wizardError.value = error.message || t('loadError')
        } finally {
          wizardSaving.value = false
        }
      }

      async function submitNewWikidataItem() {
        wizardError.value = ''
        if (!authAuthenticated.value) {
          wizardError.value = t('authRequiredForWikidataWrites')
          return
        }

        const textPayload = collectNewWikidataLabelsAndDescriptions()
        if (textPayload.error) {
          wizardError.value = textPayload.error
          return
        }
        const labels = textPayload.labels
        const descriptions = textPayload.descriptions
        const legacyLanguagePreference = ['fi', 'sv', 'en']
        const legacyLanguage = legacyLanguagePreference.find((langCode) => labels[langCode] && descriptions[langCode])
          || Object.keys(labels)[0]
          || defaultWikidataTextLanguage()

        const includePartOf = isNewWikidataPropertyEnabled('part_of_p361')
        const includeArchitect = isNewWikidataPropertyEnabled('architect_p84')
        const includeInception = isNewWikidataPropertyEnabled('inception_p571')
        const includeHeritage = isNewWikidataPropertyEnabled('heritage_designation_p1435')
        const includeCommonsCategory = isNewWikidataPropertyEnabled('commons_category_p373')

        const partOfQids = includePartOf
          ? collectWikidataSelectionQids(
            newWikidataPartOfP361Values.value,
            newWikidataPartOfP361.value,
            newWikidataPartOfSearch.value,
          )
          : []
        const instanceQids = collectWikidataSelectionQids(
          newWikidataInstanceOfValues.value,
          newWikidataInstanceOf.value,
          newWikidataInstanceSearch.value,
        )
        const countryQid = resolveWizardQid(newWikidataCountryP17.value, newWikidataCountrySearch.value)
        const municipalityQid = resolveWizardQid(newWikidataMunicipalityP131.value, newWikidataMunicipalitySearch.value)
        const locationQid = resolveWizardQid(newWikidataLocationP276.value, newWikidataLocationSearch.value)
        const architectQids = includeArchitect
          ? collectWikidataSelectionQids(
            newWikidataArchitectP84Values.value,
            newWikidataArchitectP84.value,
            newWikidataArchitectSearch.value,
          )
          : []
        const inceptionValue = includeInception
          ? String(newWikidataInceptionP571.value || '').trim()
          : ''
        const heritageQids = includeHeritage
          ? collectWikidataSelectionQids(
            newWikidataHeritageP1435Values.value,
            newWikidataHeritageP1435.value,
            newWikidataHeritageSearch.value,
          )
          : []
        const commonsCategoryValue = includeCommonsCategory
          ? newWikidataCommonsCategoryP373.value.trim()
          : ''
        const normalizedAddressLanguage = normalizeLanguageCode(newWikidataAddressTextLanguageP6375.value)
        const addressLanguage = wikidataLanguageCodePattern.test(normalizedAddressLanguage)
          ? normalizedAddressLanguage
          : defaultWikidataTextLanguage()
        const sourceUrl = String(wizardExistingSourceUrl.value || '').trim()
        const sourcePublisherQid = resolveWizardQid(
          wizardExistingSourcePublisherP123.value,
          wizardExistingSourcePublisherSearch.value,
        )
        const sourcePublishedInQid = resolveWizardQid(
          wizardExistingSourcePublishedInP1433.value,
          wizardExistingSourcePublishedInSearch.value,
        )
        const sourceLanguageOfWorkQid = resolveWizardQid(
          wizardExistingSourceLanguageOfWorkP407.value,
          wizardExistingSourceLanguageOfWorkSearch.value,
        )
        const customProperties = newWikidataCustomPropertyOptions.value
          .map((property) => {
            const rawValue = String(newWikidataCustomPropertyValues.value[property.key] || '').trim()
            if (!rawValue) {
              return null
            }
            return {
              property_id: property.propertyId,
              value: rawValue,
              datatype: String(property.datatype || '').trim().toLowerCase(),
            }
          })
          .filter(Boolean)

        if (instanceQids.length === 0) {
          wizardError.value = t('locationTypeRequired')
          return
        }
        if (!countryQid) {
          wizardError.value = t('countrySelectionRequired')
          return
        }
        if (!municipalityQid) {
          wizardError.value = t('municipalitySelectionRequired')
          return
        }

        const latitude = Number.parseFloat(String(newWikidataLatitude.value))
        const longitude = Number.parseFloat(String(newWikidataLongitude.value))
        if (Number.isNaN(latitude)) {
          wizardError.value = t('latitudeRequired')
          return
        }
        if (Number.isNaN(longitude)) {
          wizardError.value = t('longitudeRequired')
          return
        }
        if (!sourceUrl || !isHttpUrl(sourceUrl)) {
          wizardError.value = t('sourceUrlRequiredForAddExisting')
          return
        }
        if (wizardExistingSourcePublisherSearch.value.trim() && !sourcePublisherQid) {
          wizardError.value = t('sourcePublisherInvalid')
          return
        }
        if (wizardExistingSourcePublishedInSearch.value.trim() && !sourcePublishedInQid) {
          wizardError.value = t('sourcePublishedInInvalid')
          return
        }
        if (wizardExistingSourceLanguageOfWorkSearch.value.trim() && !sourceLanguageOfWorkQid) {
          wizardError.value = t('sourceLanguageOfWorkInvalid')
          return
        }

        const instanceQid = instanceQids[0] || ''
        const partOfQid = partOfQids[0] || ''
        const architectQid = architectQids[0] || ''
        const heritageQid = heritageQids[0] || ''

        const payload = {
          labels,
          descriptions,
          label: labels[legacyLanguage],
          label_language: legacyLanguage,
          description: descriptions[legacyLanguage],
          description_language: legacyLanguage,
          part_of_p361: partOfQid,
          part_of_p361_values: partOfQids,
          instance_of_p31: instanceQid,
          instance_of_p31_values: instanceQids,
          country_p17: countryQid,
          municipality_p131: municipalityQid,
          location_p276: locationQid,
          architect_p84: architectQid,
          architect_p84_values: architectQids,
          architect_source_url: architectQids.length > 0 ? sourceUrl : '',
          inception_p571: inceptionValue,
          inception_source_url: inceptionValue ? sourceUrl : '',
          latitude,
          longitude,
          heritage_designation_p1435: heritageQid,
          heritage_designation_p1435_values: heritageQids,
          heritage_source_url: heritageQids.length > 0 ? sourceUrl : '',
          address_text_p6375: newWikidataAddressTextP6375.value.trim(),
          address_text_language_p6375: addressLanguage,
          commons_category_p373: commonsCategoryValue,
          custom_properties: customProperties,
          source_url: sourceUrl,
          source_title: String(wizardExistingSourceTitle.value || '').trim(),
          source_title_language: String(wizardExistingSourceTitleLanguage.value || '').trim(),
          source_author: String(wizardExistingSourceAuthor.value || '').trim(),
          source_publication_date: String(wizardExistingSourcePublicationDate.value || '').trim(),
          source_publisher_p123: sourcePublisherQid,
          source_published_in_p1433: sourcePublishedInQid,
          source_language_of_work_p407: sourceLanguageOfWorkQid,
        }

        wizardSaving.value = true
        try {
          await createWikidataItem(payload, locale.value)
          window.alert(t('addExistingWikidataSuccess'))
          notifyLocationsChanged()
          await getLocationsCached(locale.value, { force: true })
          showCreateLocationDialog.value = false
        } catch (error) {
          wizardError.value = error.message || t('loadError')
        } finally {
          wizardSaving.value = false
        }
      }

      function destroyCoordinatePickerMap() {
        if (coordinatePickerMapInstance) {
          const currentZoom = Number(coordinatePickerMapInstance.getZoom())
          if (Number.isFinite(currentZoom)) {
            coordinatePickerLastZoom = currentZoom
          }
          coordinatePickerMapInstance.remove()
          coordinatePickerMapInstance = null
          coordinatePickerMarker = null
        }
      }

      function setCoordinateSelection(latitude, longitude, zoom = null, fillAdministrativeFields = false) {
        newWikidataLatitude.value = Number(latitude).toFixed(6)
        newWikidataLongitude.value = Number(longitude).toFixed(6)

        if (!coordinatePickerMapInstance) {
          return
        }

        if (!coordinatePickerMarker) {
          coordinatePickerMarker = L.marker([latitude, longitude]).addTo(coordinatePickerMapInstance)
        } else {
          coordinatePickerMarker.setLatLng([latitude, longitude])
        }

        if (zoom !== null) {
          coordinatePickerMapInstance.setView([latitude, longitude], zoom)
        }

        if (fillAdministrativeFields) {
          void fillNewWikidataAdministrativeFieldsFromCoordinates(latitude, longitude)
        }
      }

      function initCoordinatePickerMap() {
        destroyCoordinatePickerMap()
        if (!coordinatePickerMapElement.value) {
          return
        }

        const lat = Number.parseFloat(String(coordinatePickerLatitudeValue.value))
        const lon = Number.parseFloat(String(coordinatePickerLongitudeValue.value))
        const initialLat = Number.isNaN(lat) ? 60.1699 : lat
        const initialLon = Number.isNaN(lon) ? 24.9384 : lon
        const rememberedZoom = coordinatePickerLastZoom
        const initialZoom = Number.isFinite(rememberedZoom)
          ? rememberedZoom
          : (Number.isNaN(lat) || Number.isNaN(lon) ? 5 : 12)

        coordinatePickerMapInstance = L.map(coordinatePickerMapElement.value, {
          scrollWheelZoom: 'center',
          doubleClickZoom: 'center',
          touchZoom: 'center',
        }).setView([initialLat, initialLon], initialZoom)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(coordinatePickerMapInstance)

        coordinatePickerMapInstance.on('click', (event) => {
          const latitude = event.latlng.lat
          const longitude = event.latlng.lng
          setCoordinateSelection(latitude, longitude, null, true)
        })
        coordinatePickerMapInstance.on('zoom', () => {
          const currentZoom = Number(coordinatePickerMapInstance.getZoom())
          if (!Number.isFinite(currentZoom)) {
            return
          }
          coordinatePickerLastZoom = currentZoom
        })

        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          setCoordinateSelection(lat, lon)
        }
      }

      function onCoordinatePickerMapElementReady(element) {
        coordinatePickerMapElement.value = element || null
      }

      async function openCoordinatePickerDialog() {
        showCoordinatePickerDialog.value = true
        coordinateSearchError.value = ''
        await nextTick()
        initCoordinatePickerMap()
      }

      function closeCoordinatePickerDialog() {
        showCoordinatePickerDialog.value = false
        destroyCoordinatePickerMap()
      }

      async function runCoordinateSearch() {
        coordinateSearchError.value = ''
        const query = coordinateSearchQuery.value.trim()
        if (!query) {
          coordinateSearchResults.value = []
          return
        }

        coordinateSearchLoading.value = true
        try {
          const results = await searchGeocodePlaces(query, AUTOCOMPLETE_RESULT_LIMIT)
          coordinateSearchResults.value = Array.isArray(results) ? results : []
        } catch (error) {
          coordinateSearchResults.value = []
          coordinateSearchError.value = error.message || t('loadError')
        } finally {
          coordinateSearchLoading.value = false
        }
      }

      function chooseCoordinateSearchResult(item) {
        setCoordinateSelection(item.latitude, item.longitude, 13, true)
      }

      async function fillNewWikidataAdministrativeFieldsFromCoordinates(latitude, longitude) {
        const hasCountry = (
          hasTextValue(newWikidataCountryP17.value) ||
          hasTextValue(newWikidataCountrySearch.value)
        )
        const hasMunicipality = (
          hasTextValue(newWikidataMunicipalityP131.value) ||
          hasTextValue(newWikidataMunicipalitySearch.value)
        )
        const hasDetailedLocation = (
          hasTextValue(newWikidataLocationP276.value) ||
          hasTextValue(newWikidataLocationSearch.value)
        )
        if (hasCountry && hasMunicipality && hasDetailedLocation) {
          return
        }

        try {
          const result = await reverseGeocodeCoordinates(latitude, longitude, locale.value)
          if (!hasCountry && result?.country?.id && result?.country?.label) {
            newWikidataCountryP17.value = result.country.id
            newWikidataCountrySearch.value = `${result.country.label} (${result.country.id})`
          }
          if (!hasMunicipality && result?.municipality?.id && result?.municipality?.label) {
            newWikidataMunicipalityP131.value = result.municipality.id
            newWikidataMunicipalitySearch.value = `${result.municipality.label} (${result.municipality.id})`
          }
          if (!hasDetailedLocation && result?.detailed_location?.id && result?.detailed_location?.label) {
            newWikidataLocationP276.value = result.detailed_location.id
            newWikidataLocationSearch.value = `${result.detailed_location.label} (${result.detailed_location.id})`
          }
        } catch (error) {
          void error
        }
      }

      async function submitCreateLocation() {
        if (isWizardChoiceStep.value || isCreateActionBusy.value) {
          return
        }
        if (!canCreateLocation.value) {
          wizardError.value = t('authRequiredForLocationWrites')
          return
        }
        if (isWizardExistingMode.value) {
          await submitExistingWikidataSelection()
          return
        }
        if (isWizardNewMode.value) {
          if (!isWizardNewSourceStep.value) {
            goToNextNewWikidataStep()
            return
          }
          await submitNewWikidataItem()
          return
        }
        return
      }

      onMounted(() => {
        loadAuthStatus()
      })
      onBeforeUnmount(() => {
        destroyCoordinatePickerMap()
      })
      watch(
        () => locale.value,
        () => {
          for (const propertyKey of Object.keys(newWikidataCustomPropertyDefinitions.value)) {
            hydrateNewWikidataCustomPropertyMetadata(propertyKey)
          }
        }
      )

      return {
        t,
        detailHref,
        authEnabled,
        authAuthenticated,
        authUsername,
        authLoginUrl,
        authStatusLoading,
        showCradleGuideDialog,
        showCradleGuideButton,
        cradleUrl,
        showCreateLocationDialog,
        locationDialogTitle,
        locationDialogSubmitLabel,
        isWizardChoiceStep,
        isWizardExistingMode,
        wizardExistingHasSelectedItem,
        isWizardNewMode,
        isWizardNewBasicStep,
        isWizardNewLocationStep,
        isWizardNewPropertiesStep,
        isWizardNewIdentifiersStep,
        isWizardNewSourceStep,
        canCreateLocation,
        canReturnToWizardChoice,
        isCreateActionBusy,
        wizardSaving,
        wizardError,
        showCoordinatePickerDialog,
        coordinatePickerMapElement,
        onCoordinatePickerMapElementReady,
        coordinateSearchQuery,
        coordinateSearchResults,
        coordinateSearchLoading,
        coordinateSearchError,
        coordinatePickerLatitudeDisplay,
        coordinatePickerLongitudeDisplay,
        hasValidCoordinates,
        wizardExistingWikidataItem,
        wizardExistingWikidataSearch,
        wizardExistingSuggestions,
        wizardExistingLoading,
        wizardExistingSourceUrl,
        wizardExistingSourceTitle,
        wizardExistingSourceTitleLanguage,
        wizardExistingSourceAuthor,
        wizardExistingSourcePublicationDate,
        wizardExistingSourcePublisherSearch,
        wizardExistingSourcePublisherSuggestions,
        wizardExistingSourcePublisherLoading,
        wizardExistingSourcePublishedInSearch,
        wizardExistingSourcePublishedInSuggestions,
        wizardExistingSourcePublishedInLoading,
        wizardExistingSourceLanguageOfWorkSearch,
        wizardExistingSourceLanguageOfWorkSuggestions,
        wizardExistingSourceLanguageOfWorkLoading,
        wizardExistingCitoidLoading,
        wizardExistingCitoidError,
        wikidataTextLanguageOptions,
        wikidataAddressLanguageOptions,
        newWikidataPrimaryLabels,
        newWikidataPrimaryDescriptions,
        newWikidataAdditionalLanguageEntries,
        newWikidataPartOfP361Values,
        newWikidataPartOfSearch,
        newWikidataPartOfSuggestions,
        newWikidataPartOfLoading,
        newWikidataInstanceOfValues,
        newWikidataInstanceSearch,
        newWikidataInstanceSuggestions,
        newWikidataInstanceLoading,
        newWikidataPropertySearch,
        newWikidataPropertySuggestions,
        newWikidataPropertyLoading,
        newWikidataQuickPropertyOptions,
        newWikidataQuickIdentifierPropertyOptions,
        newWikidataCustomPropertyOptions,
        newWikidataNonIdentifierCustomPropertyOptions,
        newWikidataIdentifierCustomPropertyOptions,
        newWikidataPropertySuggestionsForProperties,
        newWikidataCountrySearch,
        newWikidataCountrySuggestions,
        newWikidataCountryLoading,
        newWikidataMunicipalitySearch,
        newWikidataMunicipalitySuggestions,
        newWikidataMunicipalityLoading,
        newWikidataLocationSearch,
        newWikidataLocationSuggestions,
        newWikidataLocationLoading,
        newWikidataLatitude,
        newWikidataLongitude,
        newWikidataArchitectP84Values,
        newWikidataArchitectSearch,
        newWikidataArchitectSuggestions,
        newWikidataArchitectLoading,
        newWikidataArchitectSourceUrl,
        newWikidataInceptionP571,
        newWikidataInceptionSourceUrl,
        newWikidataHeritageP1435Values,
        newWikidataHeritageSearch,
        newWikidataHeritageSuggestions,
        newWikidataHeritageLoading,
        newWikidataHeritageSourceUrl,
        newWikidataAddressTextP6375,
        newWikidataAddressTextLanguageP6375,
        newWikidataPostalCodeP281,
        newWikidataCommonsSearch,
        newWikidataCommonsSuggestions,
        newWikidataCommonsLoading,
        newWikidataArchitecturalStyleSearch,
        newWikidataArchitecturalStyleSuggestions,
        newWikidataArchitecturalStyleLoading,
        newWikidataOfficialClosureDateP3999,
        newWikidataOfficialClosureDateSourceUrl,
        newWikidataRouteInstructionP2795,
        newWikidataRouteInstructionLanguageP2795,
        openCreateLocationDialog,
        closeCreateLocationDialog,
        chooseCreateWizardMode,
        returnToCreateWizardChoice,
        goToPreviousNewWikidataStep,
        addNewWikidataAdditionalLanguage,
        removeNewWikidataAdditionalLanguage,
        onNewWikidataAdditionalLanguageInput,
        onNewWikidataAdditionalLanguageFocus,
        selectNewWikidataAdditionalLanguage,
        hideNewWikidataAdditionalLanguageSuggestionsSoon,
        wikidataLanguageOptionDisplayName,
        onWizardExistingWikidataInput,
        selectWizardExistingWikidataItem,
        hideWizardExistingSuggestionsSoon,
        onWizardExistingSourceUrlInput,
        onWizardExistingSourceUrlBlur,
        autofillWizardExistingSourceMetadata,
        onWizardExistingSourcePublisherInput,
        selectWizardExistingSourcePublisher,
        hideWizardExistingSourcePublisherSuggestionsSoon,
        onWizardExistingSourcePublishedInInput,
        selectWizardExistingSourcePublishedIn,
        hideWizardExistingSourcePublishedInSuggestionsSoon,
        onWizardExistingSourceLanguageOfWorkInput,
        selectWizardExistingSourceLanguageOfWork,
        hideWizardExistingSourceLanguageOfWorkSuggestionsSoon,
        wikidataSelectionChipLabel,
        onNewWikidataPartOfInput,
        addNewWikidataPartOfFromInput,
        selectNewWikidataPartOf,
        removeNewWikidataPartOf,
        hideNewWikidataPartOfSuggestionsSoon,
        onNewWikidataInstanceInput,
        addNewWikidataInstanceFromInput,
        selectNewWikidataInstance,
        removeNewWikidataInstance,
        hideNewWikidataInstanceSuggestionsSoon,
        newWikidataP31Label,
        newWikidataOptionalPropertyLabel,
        newWikidataPropertySuggestionLabel,
        isNewWikidataPropertyEnabled,
        newWikidataCustomPropertyValue,
        setNewWikidataCustomPropertyValue,
        onNewWikidataPropertyInput,
        addNewWikidataPropertyFromInput,
        selectNewWikidataPropertySuggestion,
        hideNewWikidataPropertySuggestionsSoon,
        addNewWikidataOptionalProperty,
        removeNewWikidataOptionalProperty,
        onNewWikidataCountryInput,
        selectNewWikidataCountry,
        hideNewWikidataCountrySuggestionsSoon,
        onNewWikidataMunicipalityInput,
        selectNewWikidataMunicipality,
        hideNewWikidataMunicipalitySuggestionsSoon,
        onNewWikidataLocationInput,
        selectNewWikidataLocation,
        hideNewWikidataLocationSuggestionsSoon,
        onNewWikidataArchitectInput,
        addNewWikidataArchitectFromInput,
        selectNewWikidataArchitect,
        removeNewWikidataArchitect,
        hideNewWikidataArchitectSuggestionsSoon,
        onNewWikidataHeritageInput,
        addNewWikidataHeritageFromInput,
        selectNewWikidataHeritage,
        removeNewWikidataHeritage,
        hideNewWikidataHeritageSuggestionsSoon,
        onNewWikidataArchitecturalStyleInput,
        selectNewWikidataArchitecturalStyle,
        hideNewWikidataArchitecturalStyleSuggestionsSoon,
        onNewWikidataCommonsInput,
        selectNewWikidataCommons,
        hideNewWikidataCommonsSuggestionsSoon,
        openCoordinatePickerDialog,
        closeCoordinatePickerDialog,
        runCoordinateSearch,
        chooseCoordinateSearchResult,
        submitCreateLocation,
        startWikimediaLogin,
        logoutWikimedia,
        openCradleGuideDialog,
        closeCradleGuideDialog,
        openCradle,
        displayValue,
        wikidataAutocompleteLabel,
        extractWikidataId,
        handleImageLoadError,
      }
    },
    template: `
      <div class="app-shell">
        <header class="topbar">
          <div class="title-block">
            <h1>{{ t('appTitle') }}</h1>
          </div>

          <div class="topbar-controls">
            <span v-if="authEnabled && authAuthenticated && authUsername" class="auth-chip">
              {{ t('signedInAs', { name: authUsername }) }}
            </span>
            <button
              v-if="showCradleGuideButton"
              type="button"
              class="secondary-btn"
              @click="openCradleGuideDialog"
            >
              {{ t('addLocationWithCradle') }}
            </button>
            <button
              v-if="authEnabled && !authAuthenticated && authLoginUrl !== '#'"
              type="button"
              class="secondary-btn"
              :disabled="authStatusLoading"
              @click="startWikimediaLogin"
            >
              {{ t('signInWikimedia') }}
            </button>
            <button
              v-if="authEnabled && authAuthenticated"
              type="button"
              class="secondary-btn"
              @click="logoutWikimedia"
            >
              {{ t('signOut') }}
            </button>
            <button v-if="canCreateLocation" type="button" class="secondary-btn" @click="openCreateLocationDialog()">
              {{ t('newLocation') }}
            </button>

            <LanguageSwitcher />
          </div>
        </header>

        <nav class="tabs">
          <RouterLink to="/">{{ t('navList') }}</RouterLink>
          <RouterLink to="/map">{{ t('navMap') }}</RouterLink>
          <RouterLink :to="detailHref">{{ t('navDetail') }}</RouterLink>
        </nav>

        <main class="content">
          <RouterView />
        </main>

        <div v-if="showCradleGuideDialog" class="dialog-backdrop" @click.self="closeCradleGuideDialog">
          <section class="dialog-card" role="dialog" aria-modal="true">
            <h2>{{ t('cradleGuideTitle') }}</h2>
            <p class="dialog-help">{{ t('cradleGuideIntro') }}</p>
            <ol class="cradle-guide-list">
              <li>{{ t('cradleGuideStep1') }}</li>
              <li>{{ t('cradleGuideStep2') }}</li>
              <li>{{ t('cradleGuideStep3') }}</li>
              <li>{{ t('cradleGuideStep4') }}</li>
              <li>{{ t('cradleGuideStep5') }}</li>
              <li>{{ t('cradleGuideStep6') }}</li>
            </ol>
            <p class="dialog-help">{{ cradleUrl }}</p>
            <div class="dialog-actions">
              <button type="button" class="secondary-btn" @click="closeCradleGuideDialog">{{ t('cancel') }}</button>
              <button type="button" class="primary-btn" @click="openCradle">{{ t('openCradle') }}</button>
            </div>
          </section>
        </div>

        <div v-if="showCreateLocationDialog" class="dialog-backdrop" @click.self="closeCreateLocationDialog">
          <section class="dialog-card dialog-card-form" role="dialog" aria-modal="true">
            <h2>{{ locationDialogTitle }}</h2>
            <fieldset class="dialog-fieldset" :disabled="isCreateActionBusy">

              <div v-if="isWizardChoiceStep" class="wizard-choice-grid">
                <p class="dialog-help">{{ t('createWizardIntro') }}</p>
                <button type="button" class="wizard-choice-card" @click="chooseCreateWizardMode('existing-wikidata')">
                  <span class="wizard-choice-title">{{ t('createModeExistingTitle') }}</span>
                  <span class="wizard-choice-description">{{ t('createModeExistingDesc') }}</span>
                </button>
                <button type="button" class="wizard-choice-card" @click="chooseCreateWizardMode('new-wikidata')">
                  <span class="wizard-choice-title">{{ t('createModeNewWikidataTitle') }}</span>
                  <span class="wizard-choice-description">{{ t('createModeNewWikidataDesc') }}</span>
                </button>
              </div>

              <template v-else-if="isWizardExistingMode">
                <p class="dialog-help">{{ t('addExistingWikidataHelp') }}</p>
                <label class="form-field">
                  <span>{{ t('wikidataItem') }}</span>
                  <input
                    v-model="wizardExistingWikidataSearch"
                    type="text"
                    :placeholder="t('wikidataItemPlaceholder')"
                    @input="onWizardExistingWikidataInput"
                    @blur="hideWizardExistingSuggestionsSoon"
                  />
                  <ul v-if="wizardExistingSuggestions.length > 0" class="autocomplete-list">
                    <li v-for="item in wizardExistingSuggestions" :key="item.id">
                      <button type="button" class="autocomplete-option" @mousedown.prevent @click="selectWizardExistingWikidataItem(item)">
                        {{ wikidataAutocompleteLabel(item) }}
                      </button>
                    </li>
                  </ul>
                  <p v-if="wizardExistingLoading" class="dialog-help">{{ t('searching') }}</p>
                </label>
                <div v-if="wizardExistingHasSelectedItem" class="wizard-section">
                  <p class="dialog-help">{{ t('addExistingWikidataSourceHelp') }}</p>
                  <label class="form-field">
                    <span>{{ t('sourceUrl') }}</span>
                    <input
                      v-model="wizardExistingSourceUrl"
                      type="url"
                      :placeholder="t('sourceUrlPlaceholder')"
                      @input="onWizardExistingSourceUrlInput"
                      @blur="onWizardExistingSourceUrlBlur"
                    />
                    <div class="inline-form-actions">
                      <button
                        type="button"
                        class="text-btn"
                        :disabled="!wizardExistingSourceUrl.trim() || wizardExistingCitoidLoading"
                        @click="autofillWizardExistingSourceMetadata(true)"
                      >
                        {{ t('autofillSourceWithCitoid') }}
                      </button>
                    </div>
                    <p v-if="wizardExistingCitoidLoading" class="dialog-help">{{ t('citoidAutofillLoading') }}</p>
                    <p v-else-if="wizardExistingCitoidError" class="status error">{{ wizardExistingCitoidError }}</p>
                  </label>
                  <div class="form-row form-row-language">
                    <label class="form-field">
                      <span>{{ t('sourceTitle') }}</span>
                      <input v-model="wizardExistingSourceTitle" type="text" maxlength="500" />
                    </label>
                    <label class="form-field form-field-language">
                      <span>{{ t('sourceTitleLanguage') }}</span>
                      <select v-model="wizardExistingSourceTitleLanguage">
                        <option
                          v-for="langCode in wikidataTextLanguageOptions"
                          :key="'existing-source-language-' + langCode"
                          :value="langCode"
                        >
                          {{ langCode.toUpperCase() }}
                        </option>
                      </select>
                    </label>
                  </div>
                  <div class="form-row">
                    <label class="form-field">
                      <span>{{ t('sourceAuthor') }}</span>
                      <input v-model="wizardExistingSourceAuthor" type="text" maxlength="500" />
                    </label>
                    <label class="form-field">
                      <span>{{ t('sourcePublicationDate') }}</span>
                      <input
                        v-model="wizardExistingSourcePublicationDate"
                        type="text"
                        maxlength="32"
                        :placeholder="t('sourcePublicationDatePlaceholder')"
                      />
                    </label>
                  </div>
                  <div class="form-row">
                    <label class="form-field">
                      <span>{{ t('sourcePublishedInP1433') }}</span>
                      <input
                        v-model="wizardExistingSourcePublishedInSearch"
                        type="text"
                        :placeholder="t('sourcePublishedInPlaceholder')"
                        @input="onWizardExistingSourcePublishedInInput"
                        @blur="hideWizardExistingSourcePublishedInSuggestionsSoon"
                      />
                      <ul v-if="wizardExistingSourcePublishedInSuggestions.length > 0" class="autocomplete-list">
                        <li v-for="item in wizardExistingSourcePublishedInSuggestions" :key="'source-p1433-' + item.id">
                          <button type="button" class="autocomplete-option" @mousedown.prevent @click="selectWizardExistingSourcePublishedIn(item)">
                            {{ wikidataAutocompleteLabel(item) }}
                          </button>
                        </li>
                      </ul>
                      <p v-if="wizardExistingSourcePublishedInLoading" class="dialog-help">{{ t('searching') }}</p>
                    </label>
                    <label class="form-field">
                      <span>{{ t('sourcePublisherP123') }}</span>
                      <input
                        v-model="wizardExistingSourcePublisherSearch"
                        type="text"
                        :placeholder="t('sourcePublisherPlaceholder')"
                        @input="onWizardExistingSourcePublisherInput"
                        @blur="hideWizardExistingSourcePublisherSuggestionsSoon"
                      />
                      <ul v-if="wizardExistingSourcePublisherSuggestions.length > 0" class="autocomplete-list">
                        <li v-for="item in wizardExistingSourcePublisherSuggestions" :key="'source-p123-' + item.id">
                          <button type="button" class="autocomplete-option" @mousedown.prevent @click="selectWizardExistingSourcePublisher(item)">
                            {{ wikidataAutocompleteLabel(item) }}
                          </button>
                        </li>
                      </ul>
                      <p v-if="wizardExistingSourcePublisherLoading" class="dialog-help">{{ t('searching') }}</p>
                    </label>
                  </div>
                  <div class="form-row">
                    <label class="form-field">
                      <span>{{ t('sourceLanguageOfWorkP407') }}</span>
                      <input
                        v-model="wizardExistingSourceLanguageOfWorkSearch"
                        type="text"
                        :placeholder="t('sourceLanguageOfWorkPlaceholder')"
                        @input="onWizardExistingSourceLanguageOfWorkInput"
                        @blur="hideWizardExistingSourceLanguageOfWorkSuggestionsSoon"
                      />
                      <ul v-if="wizardExistingSourceLanguageOfWorkSuggestions.length > 0" class="autocomplete-list">
                        <li v-for="item in wizardExistingSourceLanguageOfWorkSuggestions" :key="'source-p407-' + item.id">
                          <button type="button" class="autocomplete-option" @mousedown.prevent @click="selectWizardExistingSourceLanguageOfWork(item)">
                            {{ wikidataAutocompleteLabel(item) }}
                          </button>
                        </li>
                      </ul>
                      <p v-if="wizardExistingSourceLanguageOfWorkLoading" class="dialog-help">{{ t('searching') }}</p>
                    </label>
                  </div>
                </div>
              </template>

              <template v-else-if="isWizardNewMode">
                <div v-if="isWizardNewBasicStep" class="wizard-section">
                  <h3>{{ t('basicInformation') }} (1/5)</h3>
                  <p class="dialog-help">{{ t('newWikidataPrimaryLanguageHelp') }}</p>
                  <div class="wizard-section">
                    <label class="form-field">
                      <span>{{ t('locationName') }} ({{ t('languageGroupFi') }})</span>
                      <input v-model="newWikidataPrimaryLabels.fi" type="text" maxlength="250" />
                    </label>
                    <label class="form-field">
                      <span>{{ t('locationDescription') }} ({{ t('languageGroupFi') }})</span>
                      <input v-model="newWikidataPrimaryDescriptions.fi" type="text" maxlength="500" />
                    </label>
                  </div>
                  <div class="wizard-section">
                    <label class="form-field">
                      <span>{{ t('locationName') }} ({{ t('languageGroupSv') }})</span>
                      <input v-model="newWikidataPrimaryLabels.sv" type="text" maxlength="250" />
                    </label>
                    <label class="form-field">
                      <span>{{ t('locationDescription') }} ({{ t('languageGroupSv') }})</span>
                      <input v-model="newWikidataPrimaryDescriptions.sv" type="text" maxlength="500" />
                    </label>
                  </div>
                  <div class="wizard-section">
                    <label class="form-field">
                      <span>{{ t('locationName') }} ({{ t('languageGroupEn') }})</span>
                      <input v-model="newWikidataPrimaryLabels.en" type="text" maxlength="250" />
                    </label>
                    <label class="form-field">
                      <span>{{ t('locationDescription') }} ({{ t('languageGroupEn') }})</span>
                      <input v-model="newWikidataPrimaryDescriptions.en" type="text" maxlength="500" />
                    </label>
                  </div>
                  <h3>{{ t('additionalLanguages') }}</h3>
                  <p class="dialog-help">{{ t('additionalLanguagesHelp') }}</p>
                  <div
                    v-for="(entry, index) in newWikidataAdditionalLanguageEntries"
                    :key="'new-wikidata-language-' + index"
                    class="wizard-section"
                  >
                    <label class="form-field form-field-language">
                      <span>{{ t('languageCode') }}</span>
                      <input
                        v-model="entry.languageSearch"
                        type="text"
                        maxlength="80"
                        :placeholder="t('languageCodePlaceholder')"
                        @input="onNewWikidataAdditionalLanguageInput(index)"
                        @focus="onNewWikidataAdditionalLanguageFocus(index)"
                        @blur="hideNewWikidataAdditionalLanguageSuggestionsSoon(index)"
                      />
                      <ul
                        v-if="entry.languageSuggestionsOpen && entry.languageSuggestions && entry.languageSuggestions.length > 0"
                        class="autocomplete-list"
                      >
                        <li v-for="option in entry.languageSuggestions" :key="'additional-language-option-' + index + '-' + option.code">
                          <button
                            type="button"
                            class="autocomplete-option"
                            @mousedown.prevent
                            @click="selectNewWikidataAdditionalLanguage(index, option)"
                          >
                            {{ wikidataLanguageOptionDisplayName(option) }}
                          </button>
                        </li>
                      </ul>
                    </label>
                    <label class="form-field">
                      <span>{{ t('locationName') }}</span>
                      <input v-model="entry.label" type="text" maxlength="250" />
                    </label>
                    <label class="form-field">
                      <span>{{ t('locationDescription') }}</span>
                      <input v-model="entry.description" type="text" maxlength="500" />
                    </label>
                    <div class="form-row single-action">
                      <button
                        type="button"
                        class="text-btn"
                        @click="removeNewWikidataAdditionalLanguage(index)"
                      >
                        {{ t('removeLanguage') }}
                      </button>
                    </div>
                  </div>
                  <div class="form-row single-action">
                    <button type="button" class="secondary-btn" @click="addNewWikidataAdditionalLanguage">
                      {{ t('addLanguage') }}
                    </button>
                  </div>
                </div>
                <div v-else-if="isWizardNewLocationStep" class="wizard-section">
                  <h3>{{ t('locationAndCoordinates') }} (2/5)</h3>
                  <div class="form-row single-action">
                    <button type="button" class="secondary-btn" @click="openCoordinatePickerDialog">
                      {{ t('pickCoordinates') }}
                    </button>
                  </div>
                  <p class="dialog-help">
                    {{ t('coordinates') }}: {{ displayValue(newWikidataLatitude, '-') }}, {{ displayValue(newWikidataLongitude, '-') }}
                  </p>
                  <div class="form-row">
                    <label class="form-field">
                      <span>{{ t('countryP17') }}</span>
                      <input
                        v-model="newWikidataCountrySearch"
                        type="text"
                        :placeholder="t('countryPlaceholder')"
                        @input="onNewWikidataCountryInput"
                        @blur="hideNewWikidataCountrySuggestionsSoon"
                      />
                      <ul v-if="newWikidataCountrySuggestions.length > 0" class="autocomplete-list">
                        <li v-for="item in newWikidataCountrySuggestions" :key="item.id">
                          <button type="button" class="autocomplete-option" @mousedown.prevent @click="selectNewWikidataCountry(item)">
                            {{ wikidataAutocompleteLabel(item) }}
                          </button>
                        </li>
                      </ul>
                      <p v-if="newWikidataCountryLoading" class="dialog-help">{{ t('searching') }}</p>
                    </label>
                    <label class="form-field">
                      <span>{{ t('municipalityP131') }}</span>
                      <input
                        v-model="newWikidataMunicipalitySearch"
                        type="text"
                        :placeholder="t('municipalityPlaceholder')"
                        @input="onNewWikidataMunicipalityInput"
                        @blur="hideNewWikidataMunicipalitySuggestionsSoon"
                      />
                      <ul v-if="newWikidataMunicipalitySuggestions.length > 0" class="autocomplete-list">
                        <li v-for="item in newWikidataMunicipalitySuggestions" :key="item.id">
                          <button type="button" class="autocomplete-option" @mousedown.prevent @click="selectNewWikidataMunicipality(item)">
                            {{ wikidataAutocompleteLabel(item) }}
                          </button>
                        </li>
                      </ul>
                      <p v-if="newWikidataMunicipalityLoading" class="dialog-help">{{ t('searching') }}</p>
                    </label>
                  </div>
                  <label class="form-field">
                    <span>{{ t('detailedLocationP276') }}</span>
                    <input
                      v-model="newWikidataLocationSearch"
                      type="text"
                      :placeholder="t('detailedLocationPlaceholder')"
                      @input="onNewWikidataLocationInput"
                      @blur="hideNewWikidataLocationSuggestionsSoon"
                    />
                    <ul v-if="newWikidataLocationSuggestions.length > 0" class="autocomplete-list">
                      <li v-for="item in newWikidataLocationSuggestions" :key="item.id">
                        <button type="button" class="autocomplete-option" @mousedown.prevent @click="selectNewWikidataLocation(item)">
                          {{ wikidataAutocompleteLabel(item) }}
                        </button>
                      </li>
                    </ul>
                    <p v-if="newWikidataLocationLoading" class="dialog-help">{{ t('searching') }}</p>
                  </label>
                  <div class="form-row form-row-language">
                    <label class="form-field">
                      <span>{{ t('addressText') }}</span>
                      <input v-model="newWikidataAddressTextP6375" type="text" maxlength="255" />
                    </label>
                    <label class="form-field form-field-language">
                      <span>{{ t('language') }}</span>
                      <select v-model="newWikidataAddressTextLanguageP6375">
                        <option
                          v-for="langCode in wikidataAddressLanguageOptions"
                          :key="'address-language-' + langCode"
                          :value="langCode"
                        >
                          {{ langCode.toUpperCase() }}
                        </option>
                      </select>
                    </label>
                  </div>
                  <div class="form-row">
                    <label class="form-field">
                      <span>{{ t('latitude') }}</span>
                      <input v-model="newWikidataLatitude" type="number" step="any" />
                    </label>
                    <label class="form-field">
                      <span>{{ t('longitude') }}</span>
                      <input v-model="newWikidataLongitude" type="number" step="any" />
                    </label>
                  </div>
                </div>
                <div v-else-if="isWizardNewPropertiesStep" class="wizard-section">
                  <h3>{{ t('keyPropertiesWithSources') }} (3/5)</h3>
                  <label class="form-field">
                    <span>{{ newWikidataP31Label() }}</span>
                    <ul v-if="newWikidataInstanceOfValues.length > 0" class="category-chip-list">
                      <li v-for="(item, index) in newWikidataInstanceOfValues" :key="item.uid || ('instance-p31-' + item.id + '-' + index)" class="category-chip">
                        <span>{{ wikidataSelectionChipLabel(item) }}</span>
                        <button
                          type="button"
                          class="chip-remove"
                          :aria-label="t('removeCategory')"
                          @mousedown.stop.prevent="removeNewWikidataInstance(item.uid, index)"
                          @click.stop.prevent
                        >
                          ×
                        </button>
                      </li>
                    </ul>
                    <div class="save-image-category-entry">
                      <input
                        v-model="newWikidataInstanceSearch"
                        type="text"
                        :placeholder="t('typePlaceholder')"
                        @input="onNewWikidataInstanceInput"
                        @blur="hideNewWikidataInstanceSuggestionsSoon"
                        @keydown.enter.prevent="addNewWikidataInstanceFromInput"
                      />
                      <button
                        type="button"
                        class="secondary-btn"
                        :disabled="!newWikidataInstanceSearch.trim()"
                        @click.stop="addNewWikidataInstanceFromInput"
                      >
                        {{ t('addCategory') }}
                      </button>
                    </div>
                    <ul v-if="newWikidataInstanceSuggestions.length > 0" class="autocomplete-list">
                      <li v-for="item in newWikidataInstanceSuggestions" :key="item.id">
                        <button
                          type="button"
                          class="autocomplete-option"
                          @mousedown.prevent.stop="selectNewWikidataInstance(item)"
                          @click.prevent.stop
                        >
                          {{ wikidataAutocompleteLabel(item) }}
                        </button>
                      </li>
                    </ul>
                    <p v-if="newWikidataInstanceLoading" class="dialog-help">{{ t('searching') }}</p>
                  </label>
                  <label v-if="isNewWikidataPropertyEnabled('part_of_p361')" class="form-field">
                    <span>{{ newWikidataOptionalPropertyLabel('part_of_p361') }}</span>
                    <ul v-if="newWikidataPartOfP361Values.length > 0" class="category-chip-list">
                      <li v-for="(item, index) in newWikidataPartOfP361Values" :key="item.uid || ('part-of-p361-' + item.id + '-' + index)" class="category-chip">
                        <span>{{ wikidataSelectionChipLabel(item) }}</span>
                        <button
                          type="button"
                          class="chip-remove"
                          :aria-label="t('removeCategory')"
                          @mousedown.stop.prevent="removeNewWikidataPartOf(item.uid, index)"
                          @click.stop.prevent
                        >
                          ×
                        </button>
                      </li>
                    </ul>
                    <div class="save-image-category-entry">
                      <input
                        v-model="newWikidataPartOfSearch"
                        type="text"
                        :placeholder="t('partOfPlaceholder')"
                        @input="onNewWikidataPartOfInput"
                        @blur="hideNewWikidataPartOfSuggestionsSoon"
                        @keydown.enter.prevent="addNewWikidataPartOfFromInput"
                      />
                      <button
                        type="button"
                        class="secondary-btn"
                        :disabled="!newWikidataPartOfSearch.trim()"
                        @click.stop="addNewWikidataPartOfFromInput"
                      >
                        {{ t('addCategory') }}
                      </button>
                    </div>
                    <ul v-if="newWikidataPartOfSuggestions.length > 0" class="autocomplete-list">
                      <li v-for="item in newWikidataPartOfSuggestions" :key="item.id">
                        <button
                          type="button"
                          class="autocomplete-option"
                          @mousedown.prevent.stop="selectNewWikidataPartOf(item)"
                          @click.prevent.stop
                        >
                          {{ wikidataAutocompleteLabel(item) }}
                        </button>
                      </li>
                    </ul>
                    <p v-if="newWikidataPartOfLoading" class="dialog-help">{{ t('searching') }}</p>
                  </label>
                  <label v-if="isNewWikidataPropertyEnabled('architect_p84')" class="form-field">
                    <span>{{ newWikidataOptionalPropertyLabel('architect_p84') }}</span>
                    <ul v-if="newWikidataArchitectP84Values.length > 0" class="category-chip-list">
                      <li v-for="(item, index) in newWikidataArchitectP84Values" :key="item.uid || ('architect-p84-' + item.id + '-' + index)" class="category-chip">
                        <span>{{ wikidataSelectionChipLabel(item) }}</span>
                        <button
                          type="button"
                          class="chip-remove"
                          :aria-label="t('removeCategory')"
                          @mousedown.stop.prevent="removeNewWikidataArchitect(item.uid, index)"
                          @click.stop.prevent
                        >
                          ×
                        </button>
                      </li>
                    </ul>
                    <div class="save-image-category-entry">
                      <input
                        v-model="newWikidataArchitectSearch"
                        type="text"
                        :placeholder="t('typePlaceholder')"
                        @input="onNewWikidataArchitectInput"
                        @blur="hideNewWikidataArchitectSuggestionsSoon"
                        @keydown.enter.prevent="addNewWikidataArchitectFromInput"
                      />
                      <button
                        type="button"
                        class="secondary-btn"
                        :disabled="!newWikidataArchitectSearch.trim()"
                        @click.stop="addNewWikidataArchitectFromInput"
                      >
                        {{ t('addCategory') }}
                      </button>
                    </div>
                    <ul v-if="newWikidataArchitectSuggestions.length > 0" class="autocomplete-list">
                      <li v-for="item in newWikidataArchitectSuggestions" :key="item.id">
                        <button
                          type="button"
                          class="autocomplete-option"
                          @mousedown.prevent.stop="selectNewWikidataArchitect(item)"
                          @click.prevent.stop
                        >
                          {{ wikidataAutocompleteLabel(item) }}
                        </button>
                      </li>
                    </ul>
                    <p v-if="newWikidataArchitectLoading" class="dialog-help">{{ t('searching') }}</p>
                  </label>
                  <label v-if="isNewWikidataPropertyEnabled('inception_p571')" class="form-field">
                    <span>{{ newWikidataOptionalPropertyLabel('inception_p571') }}</span>
                    <input
                      v-model="newWikidataInceptionP571"
                      type="text"
                      maxlength="32"
                      :placeholder="t('sourcePublicationDatePlaceholder')"
                    />
                  </label>
                  <label v-if="isNewWikidataPropertyEnabled('heritage_designation_p1435')" class="form-field">
                    <span>{{ newWikidataOptionalPropertyLabel('heritage_designation_p1435') }}</span>
                    <ul v-if="newWikidataHeritageP1435Values.length > 0" class="category-chip-list">
                      <li v-for="(item, index) in newWikidataHeritageP1435Values" :key="item.uid || ('heritage-p1435-' + item.id + '-' + index)" class="category-chip">
                        <span>{{ wikidataSelectionChipLabel(item) }}</span>
                        <button
                          type="button"
                          class="chip-remove"
                          :aria-label="t('removeCategory')"
                          @mousedown.stop.prevent="removeNewWikidataHeritage(item.uid, index)"
                          @click.stop.prevent
                        >
                          ×
                        </button>
                      </li>
                    </ul>
                    <div class="save-image-category-entry">
                      <input
                        v-model="newWikidataHeritageSearch"
                        type="text"
                        :placeholder="t('typePlaceholder')"
                        @input="onNewWikidataHeritageInput"
                        @blur="hideNewWikidataHeritageSuggestionsSoon"
                        @keydown.enter.prevent="addNewWikidataHeritageFromInput"
                      />
                      <button
                        type="button"
                        class="secondary-btn"
                        :disabled="!newWikidataHeritageSearch.trim()"
                        @click.stop="addNewWikidataHeritageFromInput"
                      >
                        {{ t('addCategory') }}
                      </button>
                    </div>
                    <ul v-if="newWikidataHeritageSuggestions.length > 0" class="autocomplete-list">
                      <li v-for="item in newWikidataHeritageSuggestions" :key="item.id">
                        <button
                          type="button"
                          class="autocomplete-option"
                          @mousedown.prevent.stop="selectNewWikidataHeritage(item)"
                          @click.prevent.stop
                        >
                          {{ wikidataAutocompleteLabel(item) }}
                        </button>
                      </li>
                    </ul>
                    <p v-if="newWikidataHeritageLoading" class="dialog-help">{{ t('searching') }}</p>
                  </label>
                  <label v-if="isNewWikidataPropertyEnabled('commons_category_p373')" class="form-field">
                    <span>{{ newWikidataOptionalPropertyLabel('commons_category_p373') }}</span>
                    <input
                      v-model="newWikidataCommonsSearch"
                      type="text"
                      :placeholder="t('commonsPlaceholder')"
                      @input="onNewWikidataCommonsInput"
                      @blur="hideNewWikidataCommonsSuggestionsSoon"
                    />
                    <ul v-if="newWikidataCommonsSuggestions.length > 0" class="autocomplete-list">
                      <li v-for="item in newWikidataCommonsSuggestions" :key="item.title">
                        <button type="button" class="autocomplete-option" @mousedown.prevent @click="selectNewWikidataCommons(item)">
                          {{ item.title }}
                        </button>
                      </li>
                    </ul>
                    <p v-if="newWikidataCommonsLoading" class="dialog-help">{{ t('searching') }}</p>
                  </label>
                  <label
                    v-for="property in newWikidataNonIdentifierCustomPropertyOptions"
                    :key="'new-wikidata-custom-property-' + property.key"
                    class="form-field"
                  >
                    <span>{{ newWikidataOptionalPropertyLabel(property) }}</span>
                    <input
                      :value="newWikidataCustomPropertyValue(property.key)"
                      type="text"
                      :placeholder="t('propertyValuePlaceholder')"
                      @input="setNewWikidataCustomPropertyValue(property.key, $event.target.value)"
                    />
                  </label>
                  <section class="wizard-section">
                    <div class="form-field">
                      <span>{{ t('addProperty') }}</span>
                      <div class="save-image-category-entry">
                        <input
                          v-model="newWikidataPropertySearch"
                          type="text"
                          :placeholder="t('propertySearchPlaceholder')"
                          @input="onNewWikidataPropertyInput"
                          @blur="hideNewWikidataPropertySuggestionsSoon"
                          @keydown.enter.prevent="addNewWikidataPropertyFromInput(true)"
                        />
                        <button
                          type="button"
                          class="secondary-btn"
                          :disabled="!newWikidataPropertySearch.trim()"
                          @click.stop="addNewWikidataPropertyFromInput(true)"
                        >
                          {{ t('addCategory') }}
                        </button>
                      </div>
                      <ul v-if="newWikidataPropertySuggestionsForProperties.length > 0" class="autocomplete-list">
                        <li v-for="item in newWikidataPropertySuggestionsForProperties" :key="'new-property-' + item.key">
                          <button
                            type="button"
                            class="autocomplete-option"
                            @mousedown.prevent.stop="selectNewWikidataPropertySuggestion(item)"
                            @click.prevent.stop
                          >
                            {{ newWikidataPropertySuggestionLabel(item) }}
                          </button>
                        </li>
                      </ul>
                      <p v-if="newWikidataPropertyLoading" class="dialog-help">{{ t('searching') }}</p>
                      <p
                        v-else-if="newWikidataPropertySearch.trim() && !newWikidataPropertyLoading && newWikidataPropertySuggestionsForProperties.length === 0"
                        class="autocomplete-empty"
                      >
                        {{ t('autocompleteNoMatches') }}
                      </p>
                    </div>
                    <div v-if="newWikidataQuickPropertyOptions.length > 0" class="save-image-subcategory-suggestions">
                      <p class="dialog-help">{{ t('propertyQuickPicks') }}</p>
                      <ul class="category-chip-list">
                        <li v-for="item in newWikidataQuickPropertyOptions" :key="'new-property-quick-' + item.key">
                          <button
                            type="button"
                            class="subcategory-suggestion-btn"
                            @click="addNewWikidataOptionalProperty(item)"
                          >
                            + {{ newWikidataOptionalPropertyLabel(item) }}
                          </button>
                        </li>
                      </ul>
                    </div>
                  </section>
                </div>
                <div v-else-if="isWizardNewIdentifiersStep" class="wizard-section">
                  <h3>{{ t('registerIds') }} (4/5)</h3>
                  <label
                    v-for="property in newWikidataIdentifierCustomPropertyOptions"
                    :key="'new-wikidata-identifier-property-' + property.key"
                    class="form-field"
                  >
                    <span>{{ newWikidataOptionalPropertyLabel(property) }}</span>
                    <input
                      :value="newWikidataCustomPropertyValue(property.key)"
                      type="text"
                      :placeholder="t('propertyValuePlaceholder')"
                      @input="setNewWikidataCustomPropertyValue(property.key, $event.target.value)"
                    />
                  </label>
                  <section class="wizard-section">
                    <div class="form-field">
                      <span>{{ t('addProperty') }}</span>
                      <div class="save-image-category-entry">
                        <input
                          v-model="newWikidataPropertySearch"
                          type="text"
                          :placeholder="t('propertySearchPlaceholder')"
                          @input="onNewWikidataPropertyInput"
                          @blur="hideNewWikidataPropertySuggestionsSoon"
                          @keydown.enter.prevent="addNewWikidataPropertyFromInput"
                        />
                        <button
                          type="button"
                          class="secondary-btn"
                          :disabled="!newWikidataPropertySearch.trim()"
                          @click.stop="addNewWikidataPropertyFromInput"
                        >
                          {{ t('addCategory') }}
                        </button>
                      </div>
                      <ul v-if="newWikidataPropertySuggestions.length > 0" class="autocomplete-list">
                        <li v-for="item in newWikidataPropertySuggestions" :key="'new-identifier-property-' + item.key">
                          <button
                            type="button"
                            class="autocomplete-option"
                            @mousedown.prevent.stop="selectNewWikidataPropertySuggestion(item)"
                            @click.prevent.stop
                          >
                            {{ newWikidataPropertySuggestionLabel(item) }}
                          </button>
                        </li>
                      </ul>
                      <p v-if="newWikidataPropertyLoading" class="dialog-help">{{ t('searching') }}</p>
                      <p
                        v-else-if="newWikidataPropertySearch.trim() && !newWikidataPropertyLoading && newWikidataPropertySuggestions.length === 0"
                        class="autocomplete-empty"
                      >
                        {{ t('autocompleteNoMatches') }}
                      </p>
                    </div>
                    <div v-if="newWikidataQuickIdentifierPropertyOptions.length > 0" class="save-image-subcategory-suggestions">
                      <p class="dialog-help">{{ t('propertyQuickPicks') }}</p>
                      <ul class="category-chip-list">
                        <li v-for="item in newWikidataQuickIdentifierPropertyOptions" :key="'new-identifier-property-quick-' + item.key">
                          <button
                            type="button"
                            class="subcategory-suggestion-btn"
                            @click="addNewWikidataOptionalProperty(item)"
                          >
                            + {{ newWikidataOptionalPropertyLabel(item) }}
                          </button>
                        </li>
                      </ul>
                    </div>
                  </section>
                </div>
                <div v-else-if="isWizardNewSourceStep" class="wizard-section">
                  <h3>{{ t('sourcesSectionTitle') }} (5/5)</h3>
                  <p class="dialog-help">{{ t('newWikidataSourceHelp') }}</p>
                  <label class="form-field">
                    <span>{{ t('sourceUrl') }}</span>
                    <input
                      v-model="wizardExistingSourceUrl"
                      type="url"
                      :placeholder="t('sourceUrlPlaceholder')"
                      @input="onWizardExistingSourceUrlInput"
                      @blur="onWizardExistingSourceUrlBlur"
                    />
                    <div class="inline-form-actions">
                      <button
                        type="button"
                        class="text-btn"
                        :disabled="!wizardExistingSourceUrl.trim() || wizardExistingCitoidLoading"
                        @click="autofillWizardExistingSourceMetadata(true)"
                      >
                        {{ t('autofillSourceWithCitoid') }}
                      </button>
                    </div>
                    <p v-if="wizardExistingCitoidLoading" class="dialog-help">{{ t('citoidAutofillLoading') }}</p>
                    <p v-else-if="wizardExistingCitoidError" class="status error">{{ wizardExistingCitoidError }}</p>
                  </label>
                  <div class="form-row form-row-language">
                    <label class="form-field">
                      <span>{{ t('sourceTitle') }}</span>
                      <input v-model="wizardExistingSourceTitle" type="text" maxlength="500" />
                    </label>
                    <label class="form-field form-field-language">
                      <span>{{ t('sourceTitleLanguage') }}</span>
                      <select v-model="wizardExistingSourceTitleLanguage">
                        <option
                          v-for="langCode in wikidataTextLanguageOptions"
                          :key="'new-source-language-' + langCode"
                          :value="langCode"
                        >
                          {{ langCode.toUpperCase() }}
                        </option>
                      </select>
                    </label>
                  </div>
                  <div class="form-row">
                    <label class="form-field">
                      <span>{{ t('sourceAuthor') }}</span>
                      <input v-model="wizardExistingSourceAuthor" type="text" maxlength="500" />
                    </label>
                    <label class="form-field">
                      <span>{{ t('sourcePublicationDate') }}</span>
                      <input
                        v-model="wizardExistingSourcePublicationDate"
                        type="text"
                        maxlength="32"
                        :placeholder="t('sourcePublicationDatePlaceholder')"
                      />
                    </label>
                  </div>
                  <div class="form-row">
                    <label class="form-field">
                      <span>{{ t('sourcePublishedInP1433') }}</span>
                      <input
                        v-model="wizardExistingSourcePublishedInSearch"
                        type="text"
                        :placeholder="t('sourcePublishedInPlaceholder')"
                        @input="onWizardExistingSourcePublishedInInput"
                        @blur="hideWizardExistingSourcePublishedInSuggestionsSoon"
                      />
                      <ul v-if="wizardExistingSourcePublishedInSuggestions.length > 0" class="autocomplete-list">
                        <li v-for="item in wizardExistingSourcePublishedInSuggestions" :key="'new-source-p1433-' + item.id">
                          <button type="button" class="autocomplete-option" @mousedown.prevent @click="selectWizardExistingSourcePublishedIn(item)">
                            {{ wikidataAutocompleteLabel(item) }}
                          </button>
                        </li>
                      </ul>
                      <p v-if="wizardExistingSourcePublishedInLoading" class="dialog-help">{{ t('searching') }}</p>
                    </label>
                    <label class="form-field">
                      <span>{{ t('sourcePublisherP123') }}</span>
                      <input
                        v-model="wizardExistingSourcePublisherSearch"
                        type="text"
                        :placeholder="t('sourcePublisherPlaceholder')"
                        @input="onWizardExistingSourcePublisherInput"
                        @blur="hideWizardExistingSourcePublisherSuggestionsSoon"
                      />
                      <ul v-if="wizardExistingSourcePublisherSuggestions.length > 0" class="autocomplete-list">
                        <li v-for="item in wizardExistingSourcePublisherSuggestions" :key="'new-source-p123-' + item.id">
                          <button type="button" class="autocomplete-option" @mousedown.prevent @click="selectWizardExistingSourcePublisher(item)">
                            {{ wikidataAutocompleteLabel(item) }}
                          </button>
                        </li>
                      </ul>
                      <p v-if="wizardExistingSourcePublisherLoading" class="dialog-help">{{ t('searching') }}</p>
                    </label>
                  </div>
                  <div class="form-row">
                    <label class="form-field">
                      <span>{{ t('sourceLanguageOfWorkP407') }}</span>
                      <input
                        v-model="wizardExistingSourceLanguageOfWorkSearch"
                        type="text"
                        :placeholder="t('sourceLanguageOfWorkPlaceholder')"
                        @input="onWizardExistingSourceLanguageOfWorkInput"
                        @blur="hideWizardExistingSourceLanguageOfWorkSuggestionsSoon"
                      />
                      <ul v-if="wizardExistingSourceLanguageOfWorkSuggestions.length > 0" class="autocomplete-list">
                        <li v-for="item in wizardExistingSourceLanguageOfWorkSuggestions" :key="'new-source-p407-' + item.id">
                          <button type="button" class="autocomplete-option" @mousedown.prevent @click="selectWizardExistingSourceLanguageOfWork(item)">
                            {{ wikidataAutocompleteLabel(item) }}
                          </button>
                        </li>
                      </ul>
                      <p v-if="wizardExistingSourceLanguageOfWorkLoading" class="dialog-help">{{ t('searching') }}</p>
                    </label>
                  </div>
                </div>

              </template>
            </fieldset>

            <p v-if="wizardError" class="status error">{{ wizardError }}</p>

            <div class="dialog-actions">
              <button type="button" class="secondary-btn" :disabled="isCreateActionBusy" @click="closeCreateLocationDialog">{{ t('cancel') }}</button>
              <button
                v-if="isWizardNewMode && !isWizardNewBasicStep"
                type="button"
                class="secondary-btn"
                :disabled="isCreateActionBusy"
                @click="goToPreviousNewWikidataStep"
              >
                {{ t('back') }}
              </button>
              <button
                v-else-if="canReturnToWizardChoice"
                type="button"
                class="secondary-btn"
                :disabled="isCreateActionBusy"
                @click="returnToCreateWizardChoice"
              >
                {{ t('back') }}
              </button>
              <button
                v-if="!isWizardChoiceStep"
                type="button"
                class="primary-btn"
                :disabled="isCreateActionBusy || !canCreateLocation"
                @click="submitCreateLocation"
              >
                {{ wizardSaving ? t('saving') : locationDialogSubmitLabel }}
              </button>
            </div>
          </section>
        </div>

        <div v-if="showCoordinatePickerDialog" class="dialog-backdrop" @click.self="closeCoordinatePickerDialog">
          <section class="dialog-card dialog-card-wide" role="dialog" aria-modal="true">
            <h2>{{ t('coordinatePickerTitle') }}</h2>

            <form class="inline-search" @submit.prevent="runCoordinateSearch">
              <input
                v-model="coordinateSearchQuery"
                type="text"
                :placeholder="t('placeSearch')"
              />
              <button type="submit" class="secondary-btn">{{ t('search') }}</button>
            </form>

            <p v-if="coordinateSearchLoading" class="status">{{ t('searching') }}</p>
            <p v-if="coordinateSearchError" class="status error">{{ coordinateSearchError }}</p>
            <p
              v-if="!coordinateSearchLoading && coordinateSearchQuery.trim() && coordinateSearchResults.length === 0"
              class="status"
            >
              {{ t('noSearchResults') }}
            </p>

            <ul v-if="coordinateSearchResults.length > 0" class="search-result-list">
              <li v-for="item in coordinateSearchResults" :key="item.name + ':' + item.latitude + ':' + item.longitude">
                <button type="button" class="autocomplete-option" @click="chooseCoordinateSearchResult(item)">
                  {{ item.name }}
                </button>
              </li>
            </ul>

            <coordinate-picker-widget
              :coordinates-label="t('coordinates')"
              :latitude-display="coordinatePickerLatitudeDisplay"
              :longitude-display="coordinatePickerLongitudeDisplay"
              map-aria-label="coordinate picker map"
              @map-element-ready="onCoordinatePickerMapElementReady"
            />

            <div class="dialog-actions">
              <button type="button" class="secondary-btn" @click="closeCoordinatePickerDialog">{{ t('cancel') }}</button>
              <button type="button" class="primary-btn" :disabled="!hasValidCoordinates" @click="closeCoordinatePickerDialog">
                {{ t('useSelectedCoordinates') }}
              </button>
            </div>
          </section>
        </div>
      </div>
    `
  }

  createApp(AppRoot)
    .component('coordinate-picker-widget', CoordinatePickerWidget)
    .use(router)
    .use(i18n)
    .mount('#app')
})()
