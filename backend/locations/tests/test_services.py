from datetime import timedelta
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from locations.models import CommonsCategoryImageCountCache, ViewItImageCountCache
from locations.services import (
    SPARQLServiceError,
    fetch_commons_subcategory_children,
    _fetch_petscan_image_count,
    _language_fallbacks,
    _query_sparql,
    decode_location_id,
    enrich_locations_with_image_counts,
    encode_location_id,
    fetch_location_children,
    fetch_location_detail,
    fetch_locations,
    fetch_wikidata_entity,
)


class LocationServiceTests(SimpleTestCase):
    @patch('locations.services.requests.get')
    def test_query_sparql_raises_for_non_json_response(self, requests_get_mock):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.side_effect = ValueError('invalid json')
        response.text = '<html>Too many requests</html>'
        response.headers = {'Content-Type': 'text/html'}
        requests_get_mock.return_value = response

        with self.assertRaises(SPARQLServiceError):
            _query_sparql('SELECT * WHERE { ?s ?p ?o } LIMIT 1')

    @patch('locations.services.requests.get')
    def test_query_sparql_accepts_xml_response(self, requests_get_mock):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.side_effect = ValueError('invalid json')
        response.text = """<?xml version='1.0' encoding='UTF-8'?>
<sparql xmlns='http://www.w3.org/2005/sparql-results#'>
  <head>
    <variable name='item'/>
    <variable name='itemLabel'/>
    <variable name='coord'/>
  </head>
  <results>
    <result>
      <binding name='item'><uri>https://www.wikidata.org/entity/Q1757</uri></binding>
      <binding name='itemLabel'><literal>Helsinki</literal></binding>
      <binding name='coord'><literal>Point(24.9384 60.1699)</literal></binding>
    </result>
  </results>
</sparql>"""
        response.headers = {'Content-Type': 'application/sparql-results+xml;charset=utf-8'}
        requests_get_mock.return_value = response

        result = _query_sparql('SELECT ?item ?itemLabel ?coord WHERE { ?s ?p ?o } LIMIT 1')

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['itemLabel']['value'], 'Helsinki')

    def test_language_fallbacks_support_regional_locale(self):
        self.assertEqual(_language_fallbacks('sv-SE'), ['sv', 'en', 'mul'])

    def test_language_fallbacks_for_unsupported_locale(self):
        self.assertEqual(_language_fallbacks('de-DE'), ['en', 'mul'])

    def test_encode_decode_roundtrip(self):
        uri = 'https://www.wikidata.org/entity/Q1757'
        encoded = encode_location_id(uri)
        self.assertEqual(decode_location_id(encoded), uri)

    @patch('locations.services._query_sparql')
    def test_fetch_locations_uses_wikidata_membership_query(self, query_mock):
        query_mock.return_value = []

        fetch_locations(lang='fi', limit=20)

        first_query = query_mock.call_args_list[0].args[0]
        expected_lang = _language_fallbacks('fi', include_mul=False)[0].split('-', 1)[0]
        self.assertIn('wdt:P5008 wd:Q138299296', first_query)
        self.assertIn('wdt:P373 ?commonsCategory', first_query)
        self.assertIn('wdt:P18 ?imageName', first_query)
        self.assertIn('wdt:P571 ?inceptionP571', first_query)
        self.assertIn('wdt:P276 ?locationP276', first_query)
        self.assertIn('wdt:P84 ?architectP84', first_query)
        self.assertIn('wdt:P3999 ?officialClosureDateP3999', first_query)
        self.assertIn('wdt:P5817 ?stateOfUseP5817', first_query)
        self.assertIn('wdt:P131 ?municipalityP131', first_query)
        self.assertIn('wdt:P6375 ?addressTextP6375', first_query)
        self.assertIn('wdt:P281 ?postalCodeP281', first_query)
        self.assertIn('?item p:P669 ?locatedOnStreetStatementP669', first_query)
        self.assertIn('?locatedOnStreetStatementP669 pq:P670 ?houseNumberP670', first_query)
        self.assertIn('wdt:P1435 ?heritageDesignationP1435', first_query)
        self.assertIn('wdt:P31 ?instanceOfP31', first_query)
        self.assertIn('wdt:P149 ?architecturalStyleP149', first_query)
        self.assertIn('wdt:P2795 ?routeInstructionP2795', first_query)
        self.assertIn('wdt:P2347 ?ysoIdP2347', first_query)
        self.assertIn('wdt:P8309 ?yleTopicIdP8309', first_query)
        self.assertIn('wdt:P8980 ?kantoIdP8980', first_query)
        self.assertIn('wdt:P5310 ?protectedBuildingsRegisterInFinlandIdP5310', first_query)
        self.assertIn('wdt:P4009 ?rkyNationalBuiltHeritageEnvironmentIdP4009', first_query)
        self.assertIn('wdt:P3824 ?permanentBuildingNumberVtjPrtP3824', first_query)
        self.assertIn('wdt:P5313 ?protectedBuildingsRegisterInFinlandBuildingIdP5313', first_query)
        self.assertIn('wdt:P8355 ?helsinkiPersistentBuildingIdRatuP8355', first_query)
        self.assertIn('PREFIX p: <http://www.wikidata.org/prop/>', first_query)
        self.assertIn('PREFIX ps: <http://www.wikidata.org/prop/statement/>', first_query)
        self.assertIn('PREFIX pq: <http://www.wikidata.org/prop/qualifier/>', first_query)
        self.assertIn('PREFIX schema: <http://schema.org/>', first_query)
        self.assertIn('?locationP276WikipediaUrl schema:about ?locationP276', first_query)
        self.assertIn('?architectP84WikipediaUrl schema:about ?architectP84', first_query)
        self.assertIn('?stateOfUseP5817WikipediaUrl schema:about ?stateOfUseP5817', first_query)
        self.assertIn('?municipalityP131WikipediaUrl schema:about ?municipalityP131', first_query)
        self.assertIn('?locatedOnStreetP669WikipediaUrl schema:about ?locatedOnStreetP669', first_query)
        self.assertIn('?heritageDesignationP1435WikipediaUrl schema:about ?heritageDesignationP1435', first_query)
        self.assertIn('?instanceOfP31WikipediaUrl schema:about ?instanceOfP31', first_query)
        self.assertIn('?architecturalStyleP149WikipediaUrl schema:about ?architecturalStyleP149', first_query)
        self.assertIn(
            f'schema:isPartOf <https://{expected_lang}.wikipedia.org/>',
            first_query,
        )
        self.assertIn('en,mul', first_query)
        self.assertIn('LIMIT 20', first_query)

    @patch('locations.services._query_sparql')
    def test_fetch_locations_includes_additional_wikidata_qids_in_query(self, query_mock):
        query_mock.return_value = []

        fetch_locations(
            lang='fi',
            limit=20,
            additional_wikidata_qids=[
                'Q1757',
                'https://www.wikidata.org/entity/Q33',
                'q1757',
                'invalid',
            ],
        )

        first_query = query_mock.call_args_list[0].args[0]
        self.assertIn('VALUES ?item {', first_query)
        self.assertIn('wd:Q1757', first_query)
        self.assertIn('wd:Q33', first_query)
        self.assertEqual(first_query.count('wd:Q1757'), 1)
        self.assertIn('wdt:P5008 wd:Q138299296', first_query)

    @patch('locations.services._query_sparql')
    def test_fetch_locations_fallbacks_to_en(self, query_mock):
        query_mock.side_effect = [
            [],
            [
                {
                    'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                    'itemLabel': {'value': 'Helsinki'},
                    'itemDescription': {'value': 'Capital of Finland'},
                    'coord': {'value': 'Point(24.9384 60.1699)'},
                    'commonsCategory': {'value': 'Category:Helsinki'},
                    'imageName': {'value': 'Helsinki city center.jpg'},
                    'inceptionP571': {'value': '1550-01-01T00:00:00Z'},
                    'locationP276': {'value': 'https://www.wikidata.org/entity/Q33'},
                    'locationP276Label': {'value': 'Finland'},
                    'locationP276WikipediaUrl': {'value': 'https://fi.wikipedia.org/wiki/Suomi'},
                    'architectP84': {'value': 'https://www.wikidata.org/entity/Q6313'},
                    'architectP84Label': {'value': 'Carl Ludwig Engel'},
                    'architectP84WikipediaUrl': {'value': 'https://fi.wikipedia.org/wiki/Carl_Ludwig_Engel'},
                    'officialClosureDateP3999': {'value': '1990-01-01T00:00:00Z'},
                    'stateOfUseP5817': {'value': 'https://www.wikidata.org/entity/Q30185'},
                    'stateOfUseP5817Label': {'value': 'in use'},
                    'stateOfUseP5817WikipediaUrl': {'value': 'https://fi.wikipedia.org/wiki/K%C3%A4yt%C3%B6ss%C3%A4'},
                    'municipalityP131': {'value': 'https://www.wikidata.org/entity/Q1757'},
                    'municipalityP131Label': {'value': 'Helsinki'},
                    'municipalityP131WikipediaUrl': {'value': 'https://fi.wikipedia.org/wiki/Helsinki'},
                    'addressTextP6375': {'value': 'Mannerheimintie 1'},
                    'postalCodeP281': {'value': '00100'},
                    'locatedOnStreetP669': {'value': 'https://www.wikidata.org/entity/Q674771'},
                    'locatedOnStreetP669Label': {'value': 'Mannerheimintie'},
                    'locatedOnStreetP669WikipediaUrl': {'value': 'https://fi.wikipedia.org/wiki/Mannerheimintie'},
                    'houseNumberP670': {'value': '1'},
                    'heritageDesignationP1435': {'value': 'https://www.wikidata.org/entity/Q916333'},
                    'heritageDesignationP1435Label': {'value': 'built heritage monument'},
                    'heritageDesignationP1435WikipediaUrl': {
                        'value': 'https://en.wikipedia.org/wiki/Monument'
                    },
                    'instanceOfP31': {'value': 'https://www.wikidata.org/entity/Q16970'},
                    'instanceOfP31Label': {'value': 'church building'},
                    'instanceOfP31WikipediaUrl': {'value': 'https://en.wikipedia.org/wiki/Church_(building)'},
                    'architecturalStyleP149': {'value': 'https://www.wikidata.org/entity/Q176483'},
                    'architecturalStyleP149Label': {'value': 'Gothic architecture'},
                    'architecturalStyleP149WikipediaUrl': {
                        'value': 'https://en.wikipedia.org/wiki/Gothic_architecture'
                    },
                    'routeInstructionP2795': {'value': 'Walk from the station and turn right at the square.'},
                    'ysoIdP2347': {'value': '12345'},
                    'yleTopicIdP8309': {'value': '18-12345'},
                    'kantoIdP8980': {'value': '0012345'},
                    'protectedBuildingsRegisterInFinlandIdP5310': {'value': '20033'},
                    'rkyNationalBuiltHeritageEnvironmentIdP4009': {'value': '1234'},
                    'permanentBuildingNumberVtjPrtP3824': {'value': '103456789A'},
                    'protectedBuildingsRegisterInFinlandBuildingIdP5313': {'value': 'B-90001'},
                    'helsinkiPersistentBuildingIdRatuP8355': {'value': '123456'},
                }
            ],
        ]

        results = fetch_locations(lang='fi', limit=1)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Helsinki')
        self.assertEqual(results[0]['commons_category'], 'Helsinki')
        self.assertEqual(results[0]['image_name'], 'Helsinki city center.jpg')
        self.assertEqual(
            results[0]['image_url'],
            'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg',
        )
        self.assertEqual(
            results[0]['image_thumb_url'],
            'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg?width=320',
        )
        self.assertEqual(results[0]['inception_p571'], '1550-01-01T00:00:00Z')
        self.assertEqual(results[0]['location_p276'], 'https://www.wikidata.org/entity/Q33')
        self.assertEqual(results[0]['location_p276_label'], 'Finland')
        self.assertEqual(results[0]['location_p276_wikipedia_url'], 'https://fi.wikipedia.org/wiki/Suomi')
        self.assertEqual(results[0]['architect_p84'], 'https://www.wikidata.org/entity/Q6313')
        self.assertEqual(results[0]['architect_p84_label'], 'Carl Ludwig Engel')
        self.assertEqual(
            results[0]['architect_p84_wikipedia_url'],
            'https://fi.wikipedia.org/wiki/Carl_Ludwig_Engel',
        )
        self.assertEqual(results[0]['official_closure_date_p3999'], '1990-01-01T00:00:00Z')
        self.assertEqual(results[0]['state_of_use_p5817'], 'https://www.wikidata.org/entity/Q30185')
        self.assertEqual(results[0]['state_of_use_p5817_label'], 'in use')
        self.assertEqual(results[0]['state_of_use_p5817_wikipedia_url'], 'https://fi.wikipedia.org/wiki/K%C3%A4yt%C3%B6ss%C3%A4')
        self.assertEqual(results[0]['municipality_p131'], 'https://www.wikidata.org/entity/Q1757')
        self.assertEqual(results[0]['municipality_p131_label'], 'Helsinki')
        self.assertEqual(results[0]['municipality_p131_wikipedia_url'], 'https://fi.wikipedia.org/wiki/Helsinki')
        self.assertEqual(results[0]['address_text'], 'Mannerheimintie 1')
        self.assertEqual(results[0]['postal_code'], '00100')
        self.assertEqual(results[0]['located_on_street_p669'], 'https://www.wikidata.org/entity/Q674771')
        self.assertEqual(results[0]['located_on_street_p669_label'], 'Mannerheimintie')
        self.assertEqual(
            results[0]['located_on_street_p669_wikipedia_url'],
            'https://fi.wikipedia.org/wiki/Mannerheimintie',
        )
        self.assertEqual(results[0]['house_number_p670'], '1')
        self.assertEqual(results[0]['heritage_designation_p1435'], 'https://www.wikidata.org/entity/Q916333')
        self.assertEqual(results[0]['heritage_designation_p1435_label'], 'built heritage monument')
        self.assertEqual(results[0]['instance_of_p31'], 'https://www.wikidata.org/entity/Q16970')
        self.assertEqual(results[0]['instance_of_p31_label'], 'church building')
        self.assertEqual(results[0]['architectural_style_p149'], 'https://www.wikidata.org/entity/Q176483')
        self.assertEqual(results[0]['architectural_style_p149_label'], 'Gothic architecture')
        self.assertEqual(
            results[0]['architectural_style_p149_wikipedia_url'],
            'https://en.wikipedia.org/wiki/Gothic_architecture',
        )
        self.assertEqual(
            results[0]['route_instruction_p2795'],
            'Walk from the station and turn right at the square.',
        )
        self.assertEqual(results[0]['yso_id_p2347'], '12345')
        self.assertEqual(results[0]['yle_topic_id_p8309'], '18-12345')
        self.assertEqual(results[0]['kanto_id_p8980'], '0012345')
        self.assertEqual(results[0]['protected_buildings_register_in_finland_id_p5310'], '20033')
        self.assertEqual(results[0]['rky_national_built_heritage_environment_id_p4009'], '1234')
        self.assertEqual(results[0]['permanent_building_number_vtj_prt_p3824'], '103456789A')
        self.assertEqual(results[0]['protected_buildings_register_in_finland_building_id_p5313'], 'B-90001')
        self.assertEqual(results[0]['helsinki_persistent_building_id_ratu_p8355'], '123456')
        self.assertEqual(query_mock.call_count, 2)

    @patch('locations.services._query_sparql')
    def test_fetch_locations_parses_coord_wkt(self, query_mock):
        query_mock.return_value = [
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': '<http://www.opengis.net/def/crs/EPSG/0/4326> Point(24.9384 60.1699)'},
            }
        ]

        results = fetch_locations(lang='fi')

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Helsinki')
        self.assertAlmostEqual(results[0]['latitude'], 60.1699)
        self.assertAlmostEqual(results[0]['longitude'], 24.9384)

    @patch('locations.services._query_sparql')
    def test_fetch_locations_aggregates_multiple_architect_values(self, query_mock):
        query_mock.return_value = [
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'architectP84': {'value': 'https://www.wikidata.org/entity/Q6313'},
                'architectP84Label': {'value': 'Carl Ludwig Engel'},
                'architectP84WikipediaUrl': {'value': 'https://fi.wikipedia.org/wiki/Carl_Ludwig_Engel'},
            },
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'architectP84': {'value': 'https://www.wikidata.org/entity/Q263212'},
                'architectP84Label': {'value': 'Eliel Saarinen'},
                'architectP84WikipediaUrl': {'value': 'https://fi.wikipedia.org/wiki/Eliel_Saarinen'},
            },
        ]

        results = fetch_locations(lang='fi', limit=1)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['architect_p84'], 'https://www.wikidata.org/entity/Q6313')
        self.assertEqual(
            results[0]['architect_p84_values'],
            [
                {
                    'value': 'https://www.wikidata.org/entity/Q6313',
                    'label': 'Carl Ludwig Engel',
                    'wikipedia_url': 'https://fi.wikipedia.org/wiki/Carl_Ludwig_Engel',
                },
                {
                    'value': 'https://www.wikidata.org/entity/Q263212',
                    'label': 'Eliel Saarinen',
                    'wikipedia_url': 'https://fi.wikipedia.org/wiki/Eliel_Saarinen',
                },
            ],
        )

    @patch('locations.services._query_sparql')
    def test_fetch_locations_supports_sparql_image_url_binding(self, query_mock):
        query_mock.return_value = [
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'imageName': {
                    'value': 'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg'
                },
            }
        ]

        results = fetch_locations(lang='fi')

        self.assertEqual(len(results), 1)
        self.assertEqual(
            results[0]['image_url'],
            'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg',
        )
        self.assertEqual(
            results[0]['image_thumb_url'],
            'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg?width=320',
        )

    @patch('locations.services._query_sparql')
    def test_fetch_locations_raises_when_all_queries_fail(self, query_mock):
        query_mock.side_effect = SPARQLServiceError('endpoint down')

        with self.assertRaises(SPARQLServiceError):
            fetch_locations(lang='fi')

    @patch('locations.services._query_sparql')
    def test_fetch_locations_returns_empty_after_partial_failure(self, query_mock):
        query_mock.side_effect = [SPARQLServiceError('temporary fail'), []]

        results = fetch_locations(lang='fi')

        self.assertEqual(results, [])

    @patch('locations.services._query_sparql')
    def test_fetch_location_detail_none_for_missing(self, query_mock):
        query_mock.return_value = []

        result = fetch_location_detail('https://www.wikidata.org/entity/Q999999999', lang='en')

        self.assertIsNone(result)

    @patch('locations.services._query_sparql')
    def test_fetch_location_detail_uses_fallback_chain(self, query_mock):
        query_mock.side_effect = [
            [],
            [
                {
                    'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                    'itemLabel': {'value': 'Helsinki'},
                    'itemDescription': {'value': 'Capital of Finland'},
                    'coord': {'value': 'Point(24.9384 60.1699)'},
                    'locationP276': {'value': 'https://www.wikidata.org/entity/Q33'},
                    'locationP276WikipediaUrl': {'value': 'https://fi.wikipedia.org/wiki/Suomi'},
                }
            ],
        ]

        result = fetch_location_detail('https://www.wikidata.org/entity/Q1757', lang='fi-FI')

        expected_lang = _language_fallbacks('fi-FI', include_mul=False)[0].split('-', 1)[0]
        self.assertIsNotNone(result)
        self.assertEqual(result['name'], 'Helsinki')
        self.assertEqual(result['location_p276_wikipedia_url'], 'https://fi.wikipedia.org/wiki/Suomi')
        self.assertEqual(query_mock.call_count, 2)
        detail_query = query_mock.call_args_list[0].args[0]
        self.assertIn('PREFIX schema: <http://schema.org/>', detail_query)
        self.assertIn('PREFIX p: <http://www.wikidata.org/prop/>', detail_query)
        self.assertIn('PREFIX pq: <http://www.wikidata.org/prop/qualifier/>', detail_query)
        self.assertIn('?locationP276WikipediaUrl schema:about ?locationP276', detail_query)
        self.assertIn('?municipalityP131WikipediaUrl schema:about ?municipalityP131', detail_query)
        self.assertIn('?locatedOnStreetP669WikipediaUrl schema:about ?locatedOnStreetP669', detail_query)
        self.assertIn('?heritageDesignationP1435WikipediaUrl schema:about ?heritageDesignationP1435', detail_query)
        self.assertIn('?instanceOfP31WikipediaUrl schema:about ?instanceOfP31', detail_query)
        self.assertIn('?architecturalStyleP149WikipediaUrl schema:about ?architecturalStyleP149', detail_query)
        self.assertIn(f'schema:isPartOf <https://{expected_lang}.wikipedia.org/>', detail_query)

    @patch('locations.services._query_sparql')
    def test_fetch_location_detail_aggregates_multiple_architect_values(self, query_mock):
        query_mock.return_value = [
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'architectP84': {'value': 'https://www.wikidata.org/entity/Q6313'},
                'architectP84Label': {'value': 'Carl Ludwig Engel'},
                'architectP84WikipediaUrl': {'value': 'https://fi.wikipedia.org/wiki/Carl_Ludwig_Engel'},
            },
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'architectP84': {'value': 'https://www.wikidata.org/entity/Q263212'},
                'architectP84Label': {'value': 'Eliel Saarinen'},
                'architectP84WikipediaUrl': {'value': 'https://fi.wikipedia.org/wiki/Eliel_Saarinen'},
            },
        ]

        result = fetch_location_detail('https://www.wikidata.org/entity/Q1757', lang='fi')

        self.assertIsNotNone(result)
        self.assertEqual(result['architect_p84'], 'https://www.wikidata.org/entity/Q6313')
        self.assertEqual(
            result['architect_p84_values'],
            [
                {
                    'value': 'https://www.wikidata.org/entity/Q6313',
                    'label': 'Carl Ludwig Engel',
                    'wikipedia_url': 'https://fi.wikipedia.org/wiki/Carl_Ludwig_Engel',
                },
                {
                    'value': 'https://www.wikidata.org/entity/Q263212',
                    'label': 'Eliel Saarinen',
                    'wikipedia_url': 'https://fi.wikipedia.org/wiki/Eliel_Saarinen',
                },
            ],
        )

    @patch('locations.services._query_sparql')
    def test_fetch_location_detail_normalizes_https_wikidata_uri_to_http_iri(self, query_mock):
        query_mock.return_value = []

        fetch_location_detail('https://www.wikidata.org/entity/Q3572332', lang='fi')

        detail_query = query_mock.call_args_list[0].args[0]
        self.assertIn('VALUES ?item { <http://www.wikidata.org/entity/Q3572332> }', detail_query)

    @patch('locations.services._query_sparql')
    def test_fetch_location_detail_raises_when_all_queries_fail(self, query_mock):
        query_mock.side_effect = SPARQLServiceError('endpoint down')

        with self.assertRaises(SPARQLServiceError):
            fetch_location_detail('https://www.wikidata.org/entity/Q1757', lang='fi')

    @patch('locations.services._query_sparql')
    def test_fetch_location_children_uses_p361_and_p527(self, query_mock):
        query_mock.return_value = []

        fetch_location_children('https://www.wikidata.org/entity/Q1757', lang='fi', limit=25)

        query = query_mock.call_args_list[0].args[0]
        self.assertIn('?subitem wdt:P361 ?item', query)
        self.assertIn('?item wdt:P527 ?subitem', query)
        self.assertIn('OPTIONAL { ?subitem wdt:P373 ?commonsCategory . }', query)
        self.assertIn('wikibase:language "fi,en,mul"', query)
        self.assertIn('LIMIT 25', query)

    @patch('locations.services._query_sparql')
    def test_fetch_location_children_formats_child_items(self, query_mock):
        query_mock.return_value = [
            {
                'subitem': {'value': 'https://www.wikidata.org/entity/Q42'},
                'subitemLabel': {'value': 'Sub item'},
                'commonsCategory': {'value': 'Category:Sub item category'},
            }
        ]

        result = fetch_location_children('https://www.wikidata.org/entity/Q1757', lang='fi')

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['uri'], 'https://www.wikidata.org/entity/Q42')
        self.assertEqual(result[0]['name'], 'Sub item')
        self.assertEqual(result[0]['source'], 'sparql')
        self.assertEqual(result[0]['commons_category'], 'Sub item category')

    @patch('locations.services._external_json_get')
    def test_fetch_commons_subcategory_children_formats_and_dedupes(self, external_json_get_mock):
        external_json_get_mock.return_value = {
            'query': {
                'categorymembers': [
                    {'ns': 14, 'title': 'Category:Helsinki districts'},
                    {'ns': 14, 'title': 'Category:Helsinki districts'},
                    {'ns': 14, 'title': 'Category:Helsinki buildings'},
                ]
            }
        }

        result = fetch_commons_subcategory_children('Helsinki', limit=10)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['name'], 'Helsinki districts')
        self.assertEqual(
            result[0]['uri'],
            'https://commons.wikimedia.org/wiki/Category:Helsinki_districts',
        )
        self.assertEqual(result[0]['source'], 'commons')
        self.assertEqual(result[1]['name'], 'Helsinki buildings')

    @patch('locations.services._external_json_get')
    def test_fetch_wikidata_entity_maps_requested_properties(self, external_json_get_mock):
        external_json_get_mock.side_effect = [
            {
                'entities': {
                    'Q1757': {
                        'labels': {'fi': {'value': 'Helsinki'}},
                        'descriptions': {'fi': {'value': 'kaupunki Suomessa'}},
                        'claims': {
                            'P625': [
                                {
                                    'mainsnak': {
                                        'datavalue': {
                                            'value': {'latitude': 60.1699, 'longitude': 24.9384}
                                        }
                                    }
                                }
                            ],
                            'P31': [
                                {'mainsnak': {'datavalue': {'value': {'id': 'Q515'}}}}
                            ],
                            'P131': [
                                {'mainsnak': {'datavalue': {'value': {'id': 'Q1757'}}}}
                            ],
                            'P706': [
                                {'mainsnak': {'datavalue': {'value': {'id': 'Q33'}}}}
                            ],
                            'P6375': [
                                {
                                    'mainsnak': {
                                        'datavalue': {
                                            'value': {'text': 'Mannerheimintie 1', 'language': 'fi'}
                                        }
                                    }
                                }
                            ],
                            'P281': [
                                {'mainsnak': {'datavalue': {'value': '00100'}}}
                            ],
                            'P373': [
                                {'mainsnak': {'datavalue': {'value': 'Helsinki'}}}
                            ],
                            'P18': [
                                {'mainsnak': {'datavalue': {'value': 'Helsinki city center.jpg'}}}
                            ],
                        },
                    }
                }
            },
            {
                'entities': {
                    'Q515': {'labels': {'fi': {'value': 'kaupunki'}}},
                    'Q1757': {'labels': {'fi': {'value': 'Helsinki'}}},
                    'Q33': {'labels': {'fi': {'value': 'Suomi'}}},
                }
            },
        ]

        entity = fetch_wikidata_entity('Q1757', lang='fi')

        self.assertIsNotNone(entity)
        self.assertEqual(entity['label'], 'Helsinki')
        self.assertEqual(entity['description'], 'kaupunki Suomessa')
        self.assertEqual(entity['address_text'], 'Mannerheimintie 1')
        self.assertEqual(entity['postal_code'], '00100')
        self.assertEqual(entity['municipality']['id'], 'Q1757')
        self.assertEqual(entity['geographic_entities'][0]['id'], 'Q33')
        self.assertEqual(entity['geographic_entities'][0]['label'], 'Suomi')
        self.assertEqual(entity['commons_category'], 'Helsinki')
        self.assertEqual(entity['image_name'], 'Helsinki city center.jpg')
        self.assertEqual(
            entity['image_url'],
            'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg',
        )
        self.assertEqual(
            entity['image_thumb_url'],
            'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg?width=320',
        )

    @patch('locations.services._external_json_get')
    def test_fetch_wikidata_entity_uses_mul_label_fallback(self, external_json_get_mock):
        external_json_get_mock.side_effect = [
            {
                'entities': {
                    'Q1757': {
                        'labels': {'mul': {'value': 'Helsinki (mul)'}},
                        'descriptions': {'mul': {'value': 'city (mul)'}},
                        'claims': {
                            'P625': [
                                {
                                    'mainsnak': {
                                        'datavalue': {
                                            'value': {'latitude': 60.1699, 'longitude': 24.9384}
                                        }
                                    }
                                }
                            ],
                            'P31': [
                                {'mainsnak': {'datavalue': {'value': {'id': 'Q515'}}}}
                            ],
                            'P131': [
                                {'mainsnak': {'datavalue': {'value': {'id': 'Q1757'}}}}
                            ],
                        },
                    }
                }
            },
            {
                'entities': {
                    'Q515': {'labels': {'mul': {'value': 'city (mul)'}}},
                    'Q1757': {'labels': {'mul': {'value': 'Helsinki (mul)'}}},
                }
            },
        ]

        entity = fetch_wikidata_entity('Q1757', lang='sv')

        self.assertIsNotNone(entity)
        self.assertEqual(entity['label'], 'Helsinki (mul)')
        self.assertEqual(entity['description'], 'city (mul)')
        self.assertEqual(entity['instance_of']['label'], 'city (mul)')
        self.assertEqual(entity['municipality']['label'], 'Helsinki (mul)')

    @patch('locations.services._external_json_get')
    def test_fetch_petscan_image_count_uses_expected_query_params(self, external_json_get_mock):
        external_json_get_mock.return_value = {
            '*': [
                {
                    'a': {
                        'n': '7',
                    }
                }
            ]
        }

        count = _fetch_petscan_image_count('Aalto University')

        self.assertEqual(count, 7)
        self.assertEqual(external_json_get_mock.call_count, 1)
        args = external_json_get_mock.call_args.args
        self.assertEqual(args[0], 'https://petscan.wmcloud.org/')
        self.assertEqual(args[1]['project'], 'wikimedia')
        self.assertEqual(args[1]['language'], 'commons')
        self.assertEqual(args[1]['categories'], 'Aalto_University')
        self.assertEqual(args[1]['depth'], 3)
        self.assertEqual(args[1]['output_compatability'], 'catscan')
        self.assertEqual(args[1]['ns[6]'], '1')
        self.assertEqual(args[1]['doit'], '1')

class LocationImageCountCacheTests(TestCase):
    @patch('locations.services._queue_image_count_refresh')
    def test_enrich_locations_with_image_counts_returns_cached_values_and_queues_stale_entries(
        self,
        queue_refresh_mock,
    ):
        stale_time = timezone.now() - timedelta(days=2)
        CommonsCategoryImageCountCache.objects.create(
            category_name='Finland',
            image_count=123,
            fetched_at=stale_time,
        )
        ViewItImageCountCache.objects.create(
            wikidata_qid='Q33',
            image_count=456,
            fetched_at=stale_time,
        )
        payload = [
            {
                'id': encode_location_id('https://www.wikidata.org/entity/Q33'),
                'uri': 'https://www.wikidata.org/entity/Q33',
                'name': 'Finland',
                'description': 'country in northern Europe',
                'latitude': 64.0,
                'longitude': 26.0,
                'commons_category': 'Category:Finland',
            }
        ]

        result = enrich_locations_with_image_counts(payload)

        self.assertEqual(result[0]['commons_category'], 'Finland')
        self.assertEqual(result[0]['commons_image_count_petscan'], 123)
        self.assertEqual(result[0]['view_it_qid'], 'Q33')
        self.assertEqual(result[0]['view_it_image_count'], 456)
        self.assertEqual(
            result[0]['commons_category_url'],
            'https://commons.wikimedia.org/wiki/Category:Finland',
        )
        self.assertEqual(result[0]['view_it_url'], 'https://view-it.toolforge.org/?q=Q33')

        queue_refresh_mock.assert_called_once_with(
            stale_categories={'Finland'},
            stale_qids={'Q33'},
        )
        self.assertEqual(CommonsCategoryImageCountCache.objects.count(), 1)
        self.assertEqual(ViewItImageCountCache.objects.count(), 1)

    @patch('locations.services._queue_image_count_refresh')
    def test_enrich_locations_with_image_counts_queues_missing_entries_without_waiting(
        self,
        queue_refresh_mock,
    ):
        payload = [
            {
                'id': encode_location_id('https://www.wikidata.org/entity/Q33'),
                'uri': 'https://www.wikidata.org/entity/Q33',
                'name': 'Finland',
                'description': 'country in northern Europe',
                'latitude': 64.0,
                'longitude': 26.0,
                'commons_category': 'Category:Finland',
            }
        ]

        result = enrich_locations_with_image_counts(payload)

        self.assertIsNone(result[0]['commons_image_count_petscan'])
        self.assertIsNone(result[0]['view_it_image_count'])
        queue_refresh_mock.assert_called_once_with(
            stale_categories={'Finland'},
            stale_qids={'Q33'},
        )

    @patch('locations.services._queue_image_count_refresh')
    def test_enrich_locations_with_image_counts_does_not_queue_fresh_cache_entries(
        self,
        queue_refresh_mock,
    ):
        fresh_time = timezone.now()
        CommonsCategoryImageCountCache.objects.create(
            category_name='Finland',
            image_count=123,
            fetched_at=fresh_time,
        )
        ViewItImageCountCache.objects.create(
            wikidata_qid='Q33',
            image_count=456,
            fetched_at=fresh_time,
        )
        payload = [
            {
                'id': encode_location_id('https://www.wikidata.org/entity/Q33'),
                'uri': 'https://www.wikidata.org/entity/Q33',
                'name': 'Finland',
                'description': 'country in northern Europe',
                'latitude': 64.0,
                'longitude': 26.0,
                'commons_category': 'Category:Finland',
            }
        ]

        result = enrich_locations_with_image_counts(payload)

        self.assertEqual(result[0]['commons_image_count_petscan'], 123)
        self.assertEqual(result[0]['view_it_image_count'], 456)
        queue_refresh_mock.assert_called_once_with(
            stale_categories=set(),
            stale_qids=set(),
        )
