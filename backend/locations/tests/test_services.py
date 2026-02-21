import json
from datetime import timedelta
from unittest.mock import Mock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

import locations.services as services
from locations.models import CommonsCategoryImageCountCache, ViewItImageCountCache
from locations.services import (
    ExternalServiceError,
    SPARQLServiceError,
    WikidataWriteError,
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


class WikidataWriteAuthTests(SimpleTestCase):
    @override_settings(
        DEBUG=True,
        SOCIAL_AUTH_MEDIAWIKI_KEY='consumer-key',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='consumer-secret',
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='local-access-token',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='local-access-secret',
    )
    @patch('locations.services.OAuth1')
    @patch('locations.services._wikidata_api_get')
    @patch('locations.services.requests.Session')
    def test_wikidata_oauth_session_uses_local_access_token_when_oauth_tokens_missing(
        self,
        requests_session_mock,
        wikidata_api_get_mock,
        oauth1_mock,
    ):
        session = Mock()
        requests_session_mock.return_value = session
        wikidata_api_get_mock.return_value = {'query': {'tokens': {'csrftoken': 'csrf-token'}}}
        oauth1_instance = Mock()
        oauth1_mock.return_value = oauth1_instance

        returned_session, csrf_token = services._wikidata_oauth_session()

        self.assertIs(returned_session, session)
        self.assertEqual(csrf_token, 'csrf-token')
        oauth1_mock.assert_called_once_with(
            client_key='consumer-key',
            client_secret='consumer-secret',
            resource_owner_key='local-access-token',
            resource_owner_secret='local-access-secret',
            signature_type='auth_header',
        )
        self.assertIs(session.auth, oauth1_instance)

    @override_settings(
        DEBUG=True,
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='',
    )
    def test_wikidata_oauth_session_raises_when_tokens_missing(self):
        with self.assertRaises(WikidataWriteError):
            services._wikidata_oauth_session()

    @override_settings(
        DEBUG=True,
        SOCIAL_AUTH_MEDIAWIKI_KEY='consumer-key',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='consumer-secret',
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='local-access-token',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='local-access-secret',
    )
    @patch('locations.services.OAuth1')
    @patch('locations.services.requests.Session')
    def test_fetch_wikidata_authenticated_username_returns_user_name(
        self,
        requests_session_mock,
        oauth1_mock,
    ):
        session = Mock()
        requests_session_mock.return_value = session
        response = Mock()
        response.raise_for_status.return_value = None
        response.status_code = 200
        response.text = '{"query":{"userinfo":{"name":"Zache"}}}'
        response.json.return_value = {'query': {'userinfo': {'name': 'Zache'}}}
        session.get.return_value = response
        oauth1_instance = Mock()
        oauth1_mock.return_value = oauth1_instance

        username = services.fetch_wikidata_authenticated_username()

        self.assertEqual(username, 'Zache')
        oauth1_mock.assert_called_once_with(
            client_key='consumer-key',
            client_secret='consumer-secret',
            resource_owner_key='local-access-token',
            resource_owner_secret='local-access-secret',
            signature_type='auth_header',
        )
        session.get.assert_called_once_with(
            services._WIKIDATA_API_URL,
            params={
                'action': 'query',
                'meta': 'userinfo',
                'format': 'json',
            },
            timeout=services._external_timeout_seconds(),
        )

    @override_settings(
        DEBUG=True,
        SOCIAL_AUTH_MEDIAWIKI_KEY='consumer-key',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='consumer-secret',
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='local-access-token',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='local-access-secret',
    )
    @patch('builtins.print')
    @patch('locations.services.OAuth1')
    @patch('locations.services.requests.Session')
    def test_fetch_wikidata_authenticated_username_returns_empty_when_name_missing(
        self,
        requests_session_mock,
        oauth1_mock,
        print_mock,
    ):
        session = Mock()
        requests_session_mock.return_value = session
        response = Mock()
        response.raise_for_status.return_value = None
        response.status_code = 200
        response.text = '{"query":{"userinfo":{}}}'
        response.json.return_value = {'query': {'userinfo': {}}}
        session.get.return_value = response
        oauth1_mock.return_value = Mock()

        username = services.fetch_wikidata_authenticated_username()

        self.assertEqual(username, '')
        print_mock.assert_called_once()
        self.assertIn('userinfo', str(print_mock.call_args))

    def test_wikidata_source_snaks_include_optional_metadata_fields(self):
        snaks = services._wikidata_source_snaks(
            source_url='https://example.org/article',
            source_title='Example article',
            source_title_language='fi',
            source_author='Example Author',
            source_publication_date='2026-01-21',
            source_publisher_p123='Q12321',
            source_published_in_p1433='Q12345',
            source_language_of_work_p407='Q1860',
        )

        self.assertIn('P854', snaks)
        self.assertIn('P813', snaks)
        self.assertIn('P1476', snaks)
        self.assertIn('P2093', snaks)
        self.assertIn('P577', snaks)
        self.assertIn('P123', snaks)
        self.assertIn('P1433', snaks)
        self.assertIn('P407', snaks)
        self.assertEqual(
            snaks['P1476'][0]['datavalue']['value'],
            {'text': 'Example article', 'language': 'fi'},
        )
        self.assertEqual(snaks['P2093'][0]['datavalue']['value'], 'Example Author')
        self.assertEqual(
            snaks['P123'][0]['datavalue']['value']['numeric-id'],
            12321,
        )
        self.assertEqual(
            snaks['P1433'][0]['datavalue']['value']['numeric-id'],
            12345,
        )
        self.assertEqual(
            snaks['P407'][0]['datavalue']['value']['numeric-id'],
            1860,
        )

    def test_wikidata_time_datavalue_accepts_finnish_date_format(self):
        datavalue = services._wikidata_time_datavalue('1.11.2026')

        self.assertEqual(datavalue['time'], '+2026-11-01T00:00:00Z')
        self.assertEqual(datavalue['precision'], 11)

    def test_wikidata_coordinate_datavalue_accepts_latitude_and_longitude(self):
        datavalue = services._wikidata_coordinate_datavalue('60.1699, 24.9384')

        self.assertEqual(datavalue['latitude'], 60.1699)
        self.assertEqual(datavalue['longitude'], 24.9384)
        self.assertEqual(datavalue['globe'], services._WIKIDATA_GLOBE)

    def test_wikidata_quantity_datavalue_accepts_amount_and_unit(self):
        datavalue = services._wikidata_quantity_datavalue('12.5 Q11573')

        self.assertEqual(datavalue['amount'], '+12.5')
        self.assertEqual(datavalue['unit'], 'http://www.wikidata.org/entity/Q11573')

    @patch('locations.services._set_claim_reference')
    @patch('locations.services._wikidata_api_get')
    @patch('locations.services._wikidata_oauth_session')
    def test_ensure_collection_membership_adds_source_reference_to_existing_p5008_claim(
        self,
        wikidata_oauth_session_mock,
        wikidata_api_get_mock,
        set_claim_reference_mock,
    ):
        session = Mock()
        wikidata_oauth_session_mock.return_value = (session, 'csrf-token')
        wikidata_api_get_mock.return_value = {
            'entities': {
                'Q1757': {
                    'claims': {
                        'P5008': [
                            {
                                'id': 'Q1757$P5008-claim',
                                'mainsnak': {
                                    'datavalue': {'value': {'id': 'Q138299296'}},
                                },
                            }
                        ]
                    }
                }
            }
        }

        result = services.ensure_wikidata_collection_membership(
            'Q1757',
            collection_qid='Q138299296',
            source_url='https://example.org/article',
            source_title='Example article',
            source_title_language='fi',
            source_author='Example Author',
            source_publication_date='2026-01-21',
            source_publisher_p123='Q12321',
            source_published_in_p1433='Q12345',
            source_language_of_work_p407='Q1860',
        )

        self.assertTrue(result['already_listed'])
        set_claim_reference_mock.assert_called_once_with(
            session,
            'csrf-token',
            'Q1757$P5008-claim',
            'https://example.org/article',
            source_title='Example article',
            source_title_language='fi',
            source_author='Example Author',
            source_publication_date='2026-01-21',
            source_publisher_p123='Q12321',
            source_published_in_p1433='Q12345',
            source_language_of_work_p407='Q1860',
        )

    @patch('locations.services._set_claim_reference')
    @patch('locations.services._wikidata_api_get')
    @patch('locations.services._wikidata_oauth_session')
    def test_ensure_collection_membership_skips_reference_when_same_source_url_exists(
        self,
        wikidata_oauth_session_mock,
        wikidata_api_get_mock,
        set_claim_reference_mock,
    ):
        session = Mock()
        wikidata_oauth_session_mock.return_value = (session, 'csrf-token')
        wikidata_api_get_mock.return_value = {
            'entities': {
                'Q1757': {
                    'claims': {
                        'P5008': [
                            {
                                'id': 'Q1757$P5008-claim',
                                'mainsnak': {
                                    'datavalue': {'value': {'id': 'Q138299296'}},
                                },
                                'references': [
                                    {
                                        'snaks': {
                                            'P854': [
                                                {
                                                    'datavalue': {
                                                        'value': 'https://example.org/article',
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                ],
                            }
                        ]
                    }
                }
            }
        }

        result = services.ensure_wikidata_collection_membership(
            'Q1757',
            collection_qid='Q138299296',
            source_url='https://example.org/article',
        )

        self.assertTrue(result['already_listed'])
        set_claim_reference_mock.assert_not_called()

    @patch('locations.services._set_claim_reference')
    @patch('locations.services._wikidata_api_get')
    @patch('locations.services._wikidata_oauth_session')
    def test_ensure_collection_membership_adds_reference_when_existing_url_lacks_new_entity_source_fields(
        self,
        wikidata_oauth_session_mock,
        wikidata_api_get_mock,
        set_claim_reference_mock,
    ):
        session = Mock()
        wikidata_oauth_session_mock.return_value = (session, 'csrf-token')
        wikidata_api_get_mock.return_value = {
            'entities': {
                'Q1757': {
                    'claims': {
                        'P5008': [
                            {
                                'id': 'Q1757$P5008-claim',
                                'mainsnak': {
                                    'datavalue': {'value': {'id': 'Q138299296'}},
                                },
                                'references': [
                                    {
                                        'snaks': {
                                            'P854': [
                                                {
                                                    'datavalue': {
                                                        'value': 'https://example.org/article',
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                ],
                            }
                        ]
                    }
                }
            }
        }

        result = services.ensure_wikidata_collection_membership(
            'Q1757',
            collection_qid='Q138299296',
            source_url='https://example.org/article',
            source_publisher_p123='Q12321',
            source_published_in_p1433='Q12345',
            source_language_of_work_p407='Q1860',
        )

        self.assertTrue(result['already_listed'])
        set_claim_reference_mock.assert_called_once_with(
            session,
            'csrf-token',
            'Q1757$P5008-claim',
            'https://example.org/article',
            source_title='',
            source_title_language='',
            source_author='',
            source_publication_date='',
            source_publisher_p123='Q12321',
            source_published_in_p1433='Q12345',
            source_language_of_work_p407='Q1860',
        )


    @patch('locations.services._commons_api_get')
    @patch('locations.services._commons_api_post')
    @patch('locations.services._commons_oauth_session')
    def test_upload_image_to_commons_uploads_file_and_returns_urls(
        self,
        commons_oauth_session_mock,
        commons_api_post_mock,
        commons_api_get_mock,
    ):
        session = Mock()
        commons_oauth_session_mock.return_value = (session, 'csrf-token')
        commons_api_post_mock.side_effect = [
            {
                'upload': {
                    'result': 'Success',
                    'filename': 'Example uploaded.jpg',
                }
            },
            {'claim': {'id': 'M12345$point-of-view'}},
        ]
        commons_api_get_mock.return_value = {
            'query': {
                'pages': [
                    {
                        'pageid': 12345,
                        'title': 'File:Example uploaded.jpg',
                        'pageprops': {'wikibase_item': 'M12345'},
                    }
                ]
            }
        }
        image_file = SimpleUploadedFile('Example uploaded.jpg', b'image-bytes', content_type='image/jpeg')

        result = services.upload_image_to_commons(
            image_file=image_file,
            caption='Test caption',
            caption_language='fi',
            target_filename='Custom_name.jpg',
            author='Example Photographer',
            source_url='https://example.org/source-photo',
            date_created='2026-02-20',
            license_template='Cc-by-4.0',
            categories=['Helsinki', 'Category:Finland'],
            wikidata_item='Q1757',
            coordinate_source='map',
            latitude=60.1699,
            longitude=24.9384,
            oauth_token='token',
            oauth_token_secret='secret',
        )

        self.assertEqual(result['filename'], 'Example uploaded.jpg')
        self.assertEqual(
            result['file_page_url'],
            'https://commons.wikimedia.org/wiki/File:Example_uploaded.jpg',
        )
        self.assertEqual(
            result['file_url'],
            'https://commons.wikimedia.org/wiki/Special:FilePath/Example_uploaded.jpg',
        )
        self.assertEqual(result['categories'], ['Helsinki', 'Finland'])
        self.assertEqual(result['point_of_view']['latitude'], 60.1699)
        self.assertEqual(result['point_of_view']['longitude'], 24.9384)
        self.assertEqual(result['wikidata_item'], 'Q1757')
        commons_oauth_session_mock.assert_called_once_with(
            oauth_token='token',
            oauth_token_secret='secret',
        )
        commons_api_get_mock.assert_called_once_with(
            session,
            {
                'action': 'query',
                'titles': 'File:Example uploaded.jpg',
                'prop': 'pageprops',
                'ppprop': 'wikibase_item',
                'format': 'json',
                'formatversion': '2',
            },
        )
        self.assertEqual(commons_api_post_mock.call_count, 2)
        upload_call = commons_api_post_mock.call_args_list[0]
        point_of_view_call = commons_api_post_mock.call_args_list[1]
        self.assertEqual(upload_call.kwargs['data']['action'], 'upload')
        self.assertEqual(upload_call.kwargs['data']['filename'], 'Custom_name.jpg')
        self.assertEqual(upload_call.kwargs['data']['token'], 'csrf-token')
        self.assertIn('[[Category:Helsinki]]', upload_call.kwargs['data']['text'])
        self.assertIn('{{On Wikidata|Q1757}}', upload_call.kwargs['data']['text'])
        self.assertIn('{{Location|60.169900|24.938400}}', upload_call.kwargs['data']['text'])
        self.assertIn('|source=https://example.org/source-photo', upload_call.kwargs['data']['text'])
        self.assertIn('|author=Example Photographer', upload_call.kwargs['data']['text'])
        self.assertIn('|date=2026-02-20', upload_call.kwargs['data']['text'])
        self.assertIn('== {{int:license-header}} ==', upload_call.kwargs['data']['text'])
        self.assertIn('{{Cc-by-4.0}}', upload_call.kwargs['data']['text'])
        self.assertIn('file', upload_call.kwargs['files'])
        self.assertEqual(point_of_view_call.kwargs['data']['action'], 'wbcreateclaim')
        self.assertEqual(point_of_view_call.kwargs['data']['entity'], 'M12345')
        self.assertEqual(point_of_view_call.kwargs['data']['property'], 'P1259')
        point_of_view_value = json.loads(point_of_view_call.kwargs['data']['value'])
        self.assertEqual(point_of_view_value['latitude'], 60.1699)
        self.assertEqual(point_of_view_value['longitude'], 24.9384)

    @patch('locations.services._commons_api_get')
    @patch('locations.services._commons_api_post')
    @patch('locations.services._commons_oauth_session')
    def test_upload_image_to_commons_adds_depicts_p180_claims(
        self,
        commons_oauth_session_mock,
        commons_api_post_mock,
        commons_api_get_mock,
    ):
        session = Mock()
        commons_oauth_session_mock.return_value = (session, 'csrf-token')
        commons_api_post_mock.side_effect = [
            {
                'upload': {
                    'result': 'Success',
                    'filename': 'Example uploaded.jpg',
                }
            },
            {'claim': {'id': 'M12345$point-of-view'}},
            {'claim': {'id': 'M12345$depict-1'}},
            {'claim': {'id': 'M12345$depict-2'}},
        ]
        commons_api_get_mock.return_value = {
            'query': {
                'pages': [
                    {
                        'pageid': 12345,
                        'title': 'File:Example uploaded.jpg',
                        'pageprops': {'wikibase_item': 'M12345'},
                    }
                ]
            }
        }
        image_file = SimpleUploadedFile('Example uploaded.jpg', b'image-bytes', content_type='image/jpeg')

        result = services.upload_image_to_commons(
            image_file=image_file,
            coordinate_source='map',
            latitude=60.1699,
            longitude=24.9384,
            depicts=['Q811979', 'Q16970', 'q811979'],
            oauth_token='token',
            oauth_token_secret='secret',
        )

        self.assertEqual(result['depicts'], ['Q811979', 'Q16970'])
        self.assertEqual(result['point_of_view']['latitude'], 60.1699)
        self.assertEqual(result['point_of_view']['longitude'], 24.9384)
        commons_api_get_mock.assert_called_once_with(
            session,
            {
                'action': 'query',
                'titles': 'File:Example uploaded.jpg',
                'prop': 'pageprops',
                'ppprop': 'wikibase_item',
                'format': 'json',
                'formatversion': '2',
            },
        )
        self.assertEqual(commons_api_post_mock.call_count, 4)
        upload_call = commons_api_post_mock.call_args_list[0]
        point_of_view_call = commons_api_post_mock.call_args_list[1]
        first_depict_call = commons_api_post_mock.call_args_list[2]
        second_depict_call = commons_api_post_mock.call_args_list[3]

        self.assertEqual(upload_call.kwargs['data']['action'], 'upload')
        self.assertEqual(point_of_view_call.kwargs['data']['action'], 'wbcreateclaim')
        self.assertEqual(point_of_view_call.kwargs['data']['entity'], 'M12345')
        self.assertEqual(point_of_view_call.kwargs['data']['property'], 'P1259')
        self.assertEqual(first_depict_call.kwargs['data']['action'], 'wbcreateclaim')
        self.assertEqual(first_depict_call.kwargs['data']['entity'], 'M12345')
        self.assertEqual(first_depict_call.kwargs['data']['property'], 'P180')
        self.assertEqual(second_depict_call.kwargs['data']['action'], 'wbcreateclaim')
        self.assertEqual(second_depict_call.kwargs['data']['entity'], 'M12345')
        self.assertEqual(second_depict_call.kwargs['data']['property'], 'P180')

        first_depict_value = json.loads(first_depict_call.kwargs['data']['value'])
        second_depict_value = json.loads(second_depict_call.kwargs['data']['value'])
        self.assertEqual(first_depict_value['entity-type'], 'item')
        self.assertEqual(first_depict_value['numeric-id'], 811979)
        self.assertEqual(second_depict_value['entity-type'], 'item')
        self.assertEqual(second_depict_value['numeric-id'], 16970)

    @patch('locations.services._commons_api_get')
    @patch('locations.services._commons_api_post')
    @patch('locations.services._commons_oauth_session')
    def test_upload_image_to_commons_adds_heading_and_elevation_qualifiers_to_point_of_view(
        self,
        commons_oauth_session_mock,
        commons_api_post_mock,
        commons_api_get_mock,
    ):
        session = Mock()
        commons_oauth_session_mock.return_value = (session, 'csrf-token')
        commons_api_post_mock.side_effect = [
            {
                'upload': {
                    'result': 'Success',
                    'filename': 'Example uploaded.jpg',
                }
            },
            {'claim': {'id': 'M12345$point-of-view'}},
            {'success': 1},
            {'success': 1},
        ]
        commons_api_get_mock.return_value = {
            'query': {
                'pages': [
                    {
                        'pageid': 12345,
                        'title': 'File:Example uploaded.jpg',
                        'pageprops': {'wikibase_item': 'M12345'},
                    }
                ]
            }
        }
        image_file = SimpleUploadedFile('Example uploaded.jpg', b'image-bytes', content_type='image/jpeg')

        result = services.upload_image_to_commons(
            image_file=image_file,
            coordinate_source='map',
            latitude=60.1699,
            longitude=24.9384,
            heading=173.4,
            elevation_meters=14.2,
            oauth_token='token',
            oauth_token_secret='secret',
        )

        self.assertEqual(result['point_of_view']['heading'], 173.4)
        self.assertEqual(result['point_of_view']['elevation_meters'], 14.2)
        self.assertEqual(commons_api_post_mock.call_count, 4)

        point_of_view_call = commons_api_post_mock.call_args_list[1]
        heading_qualifier_call = commons_api_post_mock.call_args_list[2]
        elevation_qualifier_call = commons_api_post_mock.call_args_list[3]

        self.assertEqual(point_of_view_call.kwargs['data']['action'], 'wbcreateclaim')
        self.assertEqual(point_of_view_call.kwargs['data']['property'], 'P1259')

        self.assertEqual(heading_qualifier_call.kwargs['data']['action'], 'wbsetqualifier')
        self.assertEqual(heading_qualifier_call.kwargs['data']['claim'], 'M12345$point-of-view')
        self.assertEqual(heading_qualifier_call.kwargs['data']['property'], 'P7787')
        heading_value = json.loads(heading_qualifier_call.kwargs['data']['value'])
        self.assertEqual(heading_value['unit'], 'http://www.wikidata.org/entity/Q28390')

        self.assertEqual(elevation_qualifier_call.kwargs['data']['action'], 'wbsetqualifier')
        self.assertEqual(elevation_qualifier_call.kwargs['data']['claim'], 'M12345$point-of-view')
        self.assertEqual(elevation_qualifier_call.kwargs['data']['property'], 'P2044')
        elevation_value = json.loads(elevation_qualifier_call.kwargs['data']['value'])
        self.assertEqual(elevation_value['unit'], 'http://www.wikidata.org/entity/Q11573')

    def test_upload_image_to_commons_requires_coordinates_in_map_mode(self):
        image_file = SimpleUploadedFile('Example.jpg', b'image-bytes', content_type='image/jpeg')

        with self.assertRaises(WikidataWriteError):
            services.upload_image_to_commons(
                image_file=image_file,
                coordinate_source='map',
                latitude=None,
                longitude=None,
            )


class LocationServiceTests(SimpleTestCase):
    @patch('locations.services.requests.get')
    def test_fetch_citoid_metadata_parses_response(self, requests_get_mock):
        response = Mock()
        response.raise_for_status.return_value = None
        response.url = 'https://en.wikipedia.org/api/rest_v1/data/citation/mediawiki/https%3A%2F%2Fexample.org'
        response.json.return_value = [
            {
                'title': 'Example article',
                'author': [{'literal': 'Example Author'}],
                'date': '2026-01-21',
                'language': 'fi',
            }
        ]
        requests_get_mock.return_value = response

        result = services.fetch_citoid_metadata('https://example.org/article', lang='en')

        self.assertEqual(result['source_url'], 'https://example.org/article')
        self.assertEqual(result['source_title'], 'Example article')
        self.assertEqual(result['source_title_language'], 'fi')
        self.assertEqual(result['source_author'], 'Example Author')
        self.assertEqual(result['source_publication_date'], '2026-01-21')
        self.assertEqual(result['source_publisher_p123'], '')
        self.assertEqual(result['source_published_in_p1433'], '')
        self.assertEqual(result['source_language_of_work_p407'], 'Q1412')

    @patch('locations.services._resolve_wikidata_qid')
    @patch('locations.services.requests.get')
    def test_fetch_citoid_metadata_autofills_p123_p1433_and_p407(
        self,
        requests_get_mock,
        resolve_wikidata_qid_mock,
    ):
        response = Mock()
        response.raise_for_status.return_value = None
        response.url = 'https://en.wikipedia.org/api/rest_v1/data/citation/mediawiki/https%3A%2F%2Fexample.org'
        response.json.return_value = [
            {
                'title': 'Example article',
                'publisher': 'Example Publishing House',
                'publicationTitle': 'Example Newspaper',
                'language': 'en',
            }
        ]
        requests_get_mock.return_value = response
        resolve_wikidata_qid_mock.side_effect = lambda value, **kwargs: {
            'Example Publishing House': 'Q12321',
            'Example Newspaper': 'Q12345',
        }.get(value, '')

        result = services.fetch_citoid_metadata('https://example.org/article', lang='fi')

        self.assertEqual(result['source_publisher_p123'], 'Q12321')
        self.assertEqual(result['source_published_in_p1433'], 'Q12345')
        self.assertEqual(result['source_language_of_work_p407'], 'Q1860')

    def test_fetch_citoid_metadata_requires_http_url(self):
        with self.assertRaises(ExternalServiceError):
            services.fetch_citoid_metadata('example.org/article')

    @patch('locations.services.requests.post')
    def test_query_sparql_raises_for_non_json_response(self, requests_post_mock):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.side_effect = ValueError('invalid json')
        response.text = '<html>Too many requests</html>'
        response.headers = {'Content-Type': 'text/html'}
        requests_post_mock.return_value = response

        with self.assertRaises(SPARQLServiceError):
            _query_sparql('SELECT * WHERE { ?s ?p ?o } LIMIT 1')

    @patch('locations.services.requests.post')
    def test_query_sparql_accepts_xml_response(self, requests_post_mock):
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
        requests_post_mock.return_value = response

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
        self.assertIn('PREFIX pr: <http://www.wikidata.org/prop/reference/>', first_query)
        self.assertIn('PREFIX schema: <http://schema.org/>', first_query)
        self.assertIn('PREFIX prov: <http://www.w3.org/ns/prov#>', first_query)
        self.assertIn('?locationP276WikipediaUrl schema:about ?locationP276', first_query)
        self.assertIn('?architectP84WikipediaUrl schema:about ?architectP84', first_query)
        self.assertIn('?stateOfUseP5817WikipediaUrl schema:about ?stateOfUseP5817', first_query)
        self.assertIn('?municipalityP131WikipediaUrl schema:about ?municipalityP131', first_query)
        self.assertIn('?locatedOnStreetP669WikipediaUrl schema:about ?locatedOnStreetP669', first_query)
        self.assertIn('?heritageDesignationP1435WikipediaUrl schema:about ?heritageDesignationP1435', first_query)
        self.assertIn('?instanceOfP31WikipediaUrl schema:about ?instanceOfP31', first_query)
        self.assertIn('?architecturalStyleP149WikipediaUrl schema:about ?architecturalStyleP149', first_query)
        self.assertIn('?item p:P5008 ?collectionMembershipStatementP5008', first_query)
        self.assertIn('?collectionMembershipStatementP5008 ps:P5008 wd:Q138299296', first_query)
        self.assertIn('?collectionMembershipStatementP5008 prov:wasDerivedFrom ?collectionMembershipReferenceP5008', first_query)
        self.assertIn('?collectionMembershipReferenceP5008 pr:P1476 ?collectionMembershipSourceTitle', first_query)
        self.assertIn('BIND(LANG(?collectionMembershipSourceTitle) AS ?collectionMembershipSourceTitleLang)', first_query)
        self.assertIn('?collectionMembershipReferenceP5008 pr:P2093 ?collectionMembershipSourceAuthor', first_query)
        self.assertIn('?collectionMembershipReferenceP5008 pr:P577 ?collectionMembershipSourcePublicationDate', first_query)
        self.assertIn('?collectionMembershipReferenceP5008 pr:P813 ?collectionMembershipSourceRetrievedDate', first_query)
        self.assertIn('?collectionMembershipReferenceP5008 pr:P123 ?collectionMembershipSourcePublisherP123', first_query)
        self.assertIn('?collectionMembershipReferenceP5008 pr:P1433 ?collectionMembershipSourcePublishedInP1433', first_query)
        self.assertIn(
            '?collectionMembershipReferenceP5008 pr:P407 ?collectionMembershipSourceLanguageOfWorkP407',
            first_query,
        )
        self.assertIn('?collectionMembershipReferenceP5008 pr:P854 ?collectionMembershipSourceUrl', first_query)
        self.assertIn('schema:dateModified ?dateModified', first_query)
        self.assertIn(
            f'schema:isPartOf <https://{expected_lang}.wikipedia.org/>',
            first_query,
        )
        self.assertIn('en,mul', first_query)
        self.assertIn('LIMIT 20', first_query)

    @patch('locations.services._query_sparql')
    def test_fetch_locations_includes_cache_bust_comment_in_query(self, query_mock):
        query_mock.return_value = []

        fetch_locations(
            lang='fi',
            limit=20,
            query_comment='# cache-bust: 2026-02-18 16:45',
        )

        first_query = query_mock.call_args_list[0].args[0]
        self.assertTrue(first_query.lstrip().startswith('# cache-bust: 2026-02-18 16:45'))
        self.assertIn('PREFIX wd: <http://www.wikidata.org/entity/>', first_query)

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
                    'dateModified': {'value': '2026-01-21T12:34:56Z'},
                    'commonsCategory': {'value': 'Category:Helsinki'},
                    'imageName': {'value': 'Helsinki city center.jpg'},
                    'inceptionP571': {'value': '1550-01-01T00:00:00Z'},
                    'locationP276': {'value': 'https://www.wikidata.org/entity/Q33'},
                    'locationP276Label': {'value': 'Finland'},
                    'locationP276WikipediaUrl': {'value': 'https://fi.wikipedia.org/wiki/Suomi'},
                    'architectP84': {'value': 'https://www.wikidata.org/entity/Q6313'},
                    'architectP84Label': {'value': 'Carl Ludwig Engel'},
                    'architectP84WikipediaUrl': {'value': 'https://fi.wikipedia.org/wiki/Carl_Ludwig_Engel'},
                    'collectionMembershipSourceUrl': {'value': 'https://example.org/source-1'},
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
        self.assertEqual(results[0]['date_modified'], '2026-01-21T12:34:56Z')
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
        self.assertEqual(results[0]['collection_membership_source_url'], 'https://example.org/source-1')
        self.assertEqual(results[0]['collection_membership_source_urls'], ['https://example.org/source-1'])
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
    def test_fetch_locations_prefers_ui_language_for_address_text_p6375(self, query_mock):
        query_mock.return_value = [
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'addressTextP6375': {'value': 'Suomenkatu 1', 'xml:lang': 'fi'},
            },
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'addressTextP6375': {'value': 'Svenska gatan 1', 'xml:lang': 'sv'},
            },
        ]

        results = fetch_locations(lang='sv', limit=1)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['address_text'], 'Svenska gatan 1')
        self.assertEqual(
            results[0]['address_text_values'],
            [
                {'text': 'Suomenkatu 1', 'language': 'fi'},
                {'text': 'Svenska gatan 1', 'language': 'sv'},
            ],
        )

    @patch('locations.services._query_sparql')
    def test_fetch_locations_falls_back_to_other_language_for_address_text_p6375(self, query_mock):
        query_mock.return_value = [
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'addressTextP6375': {'value': 'Suomenkatu 1', 'xml:lang': 'fi'},
            },
        ]

        results = fetch_locations(lang='sv', limit=1)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['address_text'], 'Suomenkatu 1')
        self.assertEqual(
            results[0]['address_text_values'],
            [
                {'text': 'Suomenkatu 1', 'language': 'fi'},
            ],
        )

    @patch('locations.services._query_sparql')
    def test_fetch_locations_aggregates_multiple_located_on_street_addresses(self, query_mock):
        query_mock.return_value = [
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'locatedOnStreetP669': {'value': 'https://www.wikidata.org/entity/Q111'},
                'locatedOnStreetP669Label': {'value': 'Street A'},
                'houseNumberP670': {'value': '1'},
            },
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'locatedOnStreetP669': {'value': 'https://www.wikidata.org/entity/Q222'},
                'locatedOnStreetP669Label': {'value': 'Street B'},
                'houseNumberP670': {'value': '2'},
            },
        ]

        results = fetch_locations(lang='fi', limit=1)

        self.assertEqual(len(results), 1)
        self.assertEqual(
            results[0]['located_on_street_p669_values'],
            [
                {
                    'value': 'https://www.wikidata.org/entity/Q111',
                    'label': 'Street A',
                    'wikipedia_url': '',
                    'house_number': '1',
                },
                {
                    'value': 'https://www.wikidata.org/entity/Q222',
                    'label': 'Street B',
                    'wikipedia_url': '',
                    'house_number': '2',
                },
            ],
        )
        self.assertEqual(results[0]['located_on_street_p669'], 'https://www.wikidata.org/entity/Q111')
        self.assertEqual(results[0]['located_on_street_p669_label'], 'Street A')
        self.assertEqual(results[0]['house_number_p670'], '1')

    @patch('locations.services._query_sparql')
    def test_fetch_locations_aggregates_multiple_collection_membership_source_urls(self, query_mock):
        query_mock.return_value = [
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'collectionMembershipReferenceP5008': {'value': 'http://www.wikidata.org/reference/ref-1'},
                'collectionMembershipSourceUrl': {'value': 'https://example.org/source-1'},
                'collectionMembershipSourceTitle': {'value': 'Example article', 'xml:lang': 'fi'},
                'collectionMembershipSourceAuthor': {'value': 'Author One'},
                'collectionMembershipSourcePublicationDate': {'value': '+2026-01-02T00:00:00Z'},
                'collectionMembershipSourcePublisherP123': {'value': 'http://www.wikidata.org/entity/Q12321'},
                'collectionMembershipSourcePublisherP123Label': {'value': 'Example Publisher'},
            },
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'collectionMembershipReferenceP5008': {'value': 'http://www.wikidata.org/reference/ref-2'},
                'collectionMembershipSourceUrl': {'value': 'https://example.org/source-2'},
                'collectionMembershipSourcePublishedInP1433': {'value': 'http://www.wikidata.org/entity/Q12345'},
                'collectionMembershipSourcePublishedInP1433Label': {'value': 'Example Newspaper'},
                'collectionMembershipSourceLanguageOfWorkP407': {'value': 'http://www.wikidata.org/entity/Q1860'},
                'collectionMembershipSourceLanguageOfWorkP407Label': {'value': 'English'},
            },
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'collectionMembershipReferenceP5008': {'value': 'http://www.wikidata.org/reference/ref-1'},
                'collectionMembershipSourceAuthor': {'value': 'Author Two'},
            },
        ]

        results = fetch_locations(lang='fi', limit=1)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['collection_membership_source_url'], 'https://example.org/source-1')
        self.assertEqual(
            results[0]['collection_membership_source_urls'],
            [
                'https://example.org/source-1',
                'https://example.org/source-2',
            ],
        )
        self.assertEqual(
            results[0]['collection_membership_sources'],
            [
                {
                    'url': 'https://example.org/source-1',
                    'title': 'Example article',
                    'title_language': 'fi',
                    'publication_date': '+2026-01-02T00:00:00Z',
                    'retrieved_date': '',
                    'publisher': {
                        'value': 'http://www.wikidata.org/entity/Q12321',
                        'label': 'Example Publisher',
                        'wikipedia_url': '',
                    },
                    'published_in': {'value': '', 'label': '', 'wikipedia_url': ''},
                    'language_of_work': {'value': '', 'label': '', 'wikipedia_url': ''},
                    'author': 'Author One, Author Two',
                },
                {
                    'url': 'https://example.org/source-2',
                    'title': '',
                    'title_language': '',
                    'publication_date': '',
                    'retrieved_date': '',
                    'publisher': {'value': '', 'label': '', 'wikipedia_url': ''},
                    'published_in': {
                        'value': 'http://www.wikidata.org/entity/Q12345',
                        'label': 'Example Newspaper',
                        'wikipedia_url': '',
                    },
                    'language_of_work': {
                        'value': 'http://www.wikidata.org/entity/Q1860',
                        'label': 'English',
                        'wikipedia_url': '',
                    },
                    'author': '',
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
        self.assertIn('PREFIX pr: <http://www.wikidata.org/prop/reference/>', detail_query)
        self.assertIn('PREFIX prov: <http://www.w3.org/ns/prov#>', detail_query)
        self.assertIn('?locationP276WikipediaUrl schema:about ?locationP276', detail_query)
        self.assertIn('?municipalityP131WikipediaUrl schema:about ?municipalityP131', detail_query)
        self.assertIn('?locatedOnStreetP669WikipediaUrl schema:about ?locatedOnStreetP669', detail_query)
        self.assertIn('?heritageDesignationP1435WikipediaUrl schema:about ?heritageDesignationP1435', detail_query)
        self.assertIn('?instanceOfP31WikipediaUrl schema:about ?instanceOfP31', detail_query)
        self.assertIn('?architecturalStyleP149WikipediaUrl schema:about ?architecturalStyleP149', detail_query)
        self.assertIn('?item p:P5008 ?collectionMembershipStatementP5008', detail_query)
        self.assertIn('?collectionMembershipStatementP5008 ps:P5008 wd:Q138299296', detail_query)
        self.assertIn('?collectionMembershipStatementP5008 prov:wasDerivedFrom ?collectionMembershipReferenceP5008', detail_query)
        self.assertIn('?collectionMembershipReferenceP5008 pr:P1476 ?collectionMembershipSourceTitle', detail_query)
        self.assertIn('BIND(LANG(?collectionMembershipSourceTitle) AS ?collectionMembershipSourceTitleLang)', detail_query)
        self.assertIn('?collectionMembershipReferenceP5008 pr:P2093 ?collectionMembershipSourceAuthor', detail_query)
        self.assertIn('?collectionMembershipReferenceP5008 pr:P577 ?collectionMembershipSourcePublicationDate', detail_query)
        self.assertIn('?collectionMembershipReferenceP5008 pr:P813 ?collectionMembershipSourceRetrievedDate', detail_query)
        self.assertIn('?collectionMembershipReferenceP5008 pr:P123 ?collectionMembershipSourcePublisherP123', detail_query)
        self.assertIn('?collectionMembershipReferenceP5008 pr:P1433 ?collectionMembershipSourcePublishedInP1433', detail_query)
        self.assertIn(
            '?collectionMembershipReferenceP5008 pr:P407 ?collectionMembershipSourceLanguageOfWorkP407',
            detail_query,
        )
        self.assertIn('?collectionMembershipReferenceP5008 pr:P854 ?collectionMembershipSourceUrl', detail_query)
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
    def test_fetch_location_detail_aggregates_multiple_collection_membership_source_urls(self, query_mock):
        query_mock.return_value = [
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'collectionMembershipReferenceP5008': {'value': 'http://www.wikidata.org/reference/ref-1'},
                'collectionMembershipSourceUrl': {'value': 'https://example.org/source-1'},
                'collectionMembershipSourceTitle': {'value': 'Example article', 'xml:lang': 'fi'},
                'collectionMembershipSourceAuthor': {'value': 'Author One'},
                'collectionMembershipSourceRetrievedDate': {'value': '+2026-01-03T00:00:00Z'},
            },
            {
                'item': {'value': 'https://www.wikidata.org/entity/Q1757'},
                'itemLabel': {'value': 'Helsinki'},
                'coord': {'value': 'Point(24.9384 60.1699)'},
                'collectionMembershipReferenceP5008': {'value': 'http://www.wikidata.org/reference/ref-2'},
                'collectionMembershipSourceUrl': {'value': 'https://example.org/source-2'},
                'collectionMembershipSourceLanguageOfWorkP407': {'value': 'http://www.wikidata.org/entity/Q1860'},
                'collectionMembershipSourceLanguageOfWorkP407Label': {'value': 'English'},
            },
        ]

        result = fetch_location_detail('https://www.wikidata.org/entity/Q1757', lang='fi')

        self.assertIsNotNone(result)
        self.assertEqual(result['collection_membership_source_url'], 'https://example.org/source-1')
        self.assertEqual(
            result['collection_membership_source_urls'],
            [
                'https://example.org/source-1',
                'https://example.org/source-2',
            ],
        )
        self.assertEqual(
            result['collection_membership_sources'],
            [
                {
                    'url': 'https://example.org/source-1',
                    'title': 'Example article',
                    'title_language': 'fi',
                    'publication_date': '',
                    'retrieved_date': '+2026-01-03T00:00:00Z',
                    'publisher': {'value': '', 'label': '', 'wikipedia_url': ''},
                    'published_in': {'value': '', 'label': '', 'wikipedia_url': ''},
                    'language_of_work': {'value': '', 'label': '', 'wikipedia_url': ''},
                    'author': 'Author One',
                },
                {
                    'url': 'https://example.org/source-2',
                    'title': '',
                    'title_language': '',
                    'publication_date': '',
                    'retrieved_date': '',
                    'publisher': {'value': '', 'label': '', 'wikipedia_url': ''},
                    'published_in': {'value': '', 'label': '', 'wikipedia_url': ''},
                    'language_of_work': {
                        'value': 'http://www.wikidata.org/entity/Q1860',
                        'label': 'English',
                        'wikipedia_url': '',
                    },
                    'author': '',
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


class ReverseGeocodeAdministrativeResolutionTests(SimpleTestCase):
    def test_municipality_labels_prioritize_city_over_regional_grouping(self):
        labels = services._municipality_labels_from_address({
            'municipality': 'Helsingin seutukunta',
            'city': 'Espoo',
            'county': 'Uusimaa',
        })

        self.assertGreaterEqual(len(labels), 2)
        self.assertEqual(labels[0], 'Espoo')
        self.assertIn('Helsingin seutukunta', labels)

    @patch('locations.services._resolve_wikidata_qid')
    @patch('locations.services._external_json_get')
    def test_reverse_geocode_places_prefers_city_for_municipality(self, external_json_get_mock, resolve_wikidata_qid_mock):
        external_json_get_mock.return_value = {
            'address': {
                'country': 'Suomi',
                'municipality': 'Helsingin seutukunta',
                'city': 'Espoo',
                'county': 'Uusimaa',
            }
        }

        def resolve_side_effect(label, lang=None, allow_fuzzy=True):
            if label == 'Suomi':
                return 'Q33'
            if label == 'Espoo':
                return 'Q1793'
            return ''

        resolve_wikidata_qid_mock.side_effect = resolve_side_effect

        result = services.reverse_geocode_places(latitude=60.2055, longitude=24.6559, lang='fi')

        self.assertEqual(result['country'], {'id': 'Q33', 'label': 'Suomi'})
        self.assertEqual(result['municipality'], {'id': 'Q1793', 'label': 'Espoo'})

        args = external_json_get_mock.call_args.args
        self.assertEqual(args[0], services._NOMINATIM_REVERSE_URL)
        self.assertEqual(args[1]['zoom'], 16)

        resolve_calls = [call.args[0] for call in resolve_wikidata_qid_mock.call_args_list]
        self.assertIn('Suomi', resolve_calls)
        self.assertIn('Espoo', resolve_calls)
        self.assertNotIn('Helsingin seutukunta', resolve_calls)

    @patch('locations.services._resolve_wikidata_qid')
    @patch('locations.services._external_json_get')
    def test_reverse_geocode_places_resolves_detailed_location_from_suburb(
        self,
        external_json_get_mock,
        resolve_wikidata_qid_mock,
    ):
        external_json_get_mock.return_value = {
            'address': {
                'country': 'Suomi',
                'city': 'Espoo',
                'suburb': 'Pohjois-Tapiola',
            }
        }

        def resolve_side_effect(label, lang=None, allow_fuzzy=True):
            if label == 'Suomi':
                return 'Q33'
            if label == 'Espoo':
                return 'Q1793'
            if label == 'Pohjois-Tapiola':
                return 'Q11889564'
            return ''

        resolve_wikidata_qid_mock.side_effect = resolve_side_effect

        result = services.reverse_geocode_places(latitude=60.1797, longitude=24.8013, lang='fi')

        self.assertEqual(result['country'], {'id': 'Q33', 'label': 'Suomi'})
        self.assertEqual(result['municipality'], {'id': 'Q1793', 'label': 'Espoo'})
        self.assertEqual(result['detailed_location'], {'id': 'Q11889564', 'label': 'Pohjois-Tapiola'})

    @patch('locations.services._query_sparql')
    @patch('locations.services._resolve_wikidata_qid')
    @patch('locations.services._external_json_get')
    def test_reverse_geocode_places_resolves_country_by_iso_code_fallback(
        self,
        external_json_get_mock,
        resolve_wikidata_qid_mock,
        query_sparql_mock,
    ):
        external_json_get_mock.return_value = {
            'address': {
                'country': 'Suomi / Finland',
                'country_code': 'fi',
                'city': 'Espoo',
            }
        }
        query_sparql_mock.return_value = [
            {'item': {'value': 'http://www.wikidata.org/entity/Q33'}},
        ]

        def resolve_side_effect(label, lang=None, allow_fuzzy=True):
            if label == 'Espoo':
                return 'Q1793'
            return ''

        resolve_wikidata_qid_mock.side_effect = resolve_side_effect

        result = services.reverse_geocode_places(latitude=60.2055, longitude=24.6559, lang='fi')

        self.assertEqual(result['country'], {'id': 'Q33', 'label': 'Suomi'})
        self.assertEqual(result['municipality'], {'id': 'Q1793', 'label': 'Espoo'})
        self.assertEqual(query_sparql_mock.call_count, 1)
        self.assertIn('wdt:P297 "FI"', query_sparql_mock.call_args.args[0])
