from unittest.mock import patch
from urllib.parse import quote, unquote

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import HttpResponseRedirect
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from locations.services import ExternalServiceError, SPARQLServiceError, WikidataWriteError


class LocationApiTests(APITestCase):
    def setUp(self):
        super().setUp()
        self._enrich_counts_patcher = patch(
            'locations.views.enrich_locations_with_image_counts',
            side_effect=lambda locations: locations,
        )
        self.enrich_locations_with_image_counts_mock = self._enrich_counts_patcher.start()
        self._fetch_children_patcher = patch(
            'locations.views.fetch_location_children',
            return_value=[],
        )
        self.fetch_location_children_mock = self._fetch_children_patcher.start()

    def _authenticate(self, username='api-writer'):
        user = get_user_model().objects.create_user(username=username)
        self.client.force_authenticate(user=user)
        return user

    def tearDown(self):
        self._enrich_counts_patcher.stop()
        self._fetch_children_patcher.stop()
        super().tearDown()

    @override_settings(DEBUG=True, ROOT_URLCONF='locations.tests.test_urlconf')
    def test_static_app_js_served_with_script_mime_type(self):
        response = self.client.get('/static/ui/app.js')

        self.assertEqual(response.status_code, 200)
        self.assertIn('javascript', str(response.get('Content-Type', '')))
        first_chunk = next(iter(response.streaming_content), b'')
        self.assertIn(b'(function ()', first_chunk)

    def test_frontend_app_served(self):
        response = self.client.get(reverse('frontend-app'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="app"')
        self.assertContains(response, 'window.APP_CONFIG')
        self.assertContains(response, 'apiBaseUrl')

    @patch('locations.views.fetch_locations')
    def test_location_list(self, fetch_locations_mock):
        fetch_locations_mock.return_value = [
            {
                'id': quote('https://www.wikidata.org/entity/Q1757', safe=''),
                'uri': 'https://www.wikidata.org/entity/Q1757',
                'name': 'Helsinki',
                'description': 'Capital of Finland',
                'latitude': 60.1699,
                'longitude': 24.9384,
            }
        ]

        response = self.client.get(reverse('location-list'), {'lang': 'en'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        query_url = response.headers.get('X-Wikidata-Query-Url', '')
        self.assertTrue(query_url.startswith('https://query.wikidata.org/#'))
        self.assertIn('wdt:P5008 wd:Q138299296', unquote(query_url.split('#', 1)[1]))
        fetch_locations_mock.assert_called_once_with(lang='en')

    @patch('locations.views.fetch_locations')
    def test_location_list_passes_cache_bust_comment_to_fetch(self, fetch_locations_mock):
        fetch_locations_mock.return_value = []

        response = self.client.get(
            reverse('location-list'),
            {'lang': 'en', 'cache_bust': '2026-02-18 16:45'},
        )

        self.assertEqual(response.status_code, 200)
        fetch_locations_mock.assert_called_once_with(
            lang='en',
            query_comment='# cache-bust: 2026-02-18 16:45',
        )

    @patch('locations.views.fetch_locations')
    def test_location_list_returns_502_on_sparql_error(self, fetch_locations_mock):
        fetch_locations_mock.side_effect = SPARQLServiceError('endpoint returned non-json')

        response = self.client.get(reverse('location-list'), {'lang': 'fi'})

        self.assertEqual(response.status_code, 502)
        self.assertIn('detail', response.data)

    @patch('locations.views.fetch_location_detail')
    def test_location_detail(self, fetch_location_detail_mock):
        encoded = quote('https://www.wikidata.org/entity/Q1757', safe='')
        fetch_location_detail_mock.return_value = {
            'id': encoded,
            'uri': 'https://www.wikidata.org/entity/Q1757',
            'name': 'Helsinki',
            'description': 'Capital of Finland',
            'latitude': 60.1699,
            'longitude': 24.9384,
        }

        response = self.client.get(reverse('location-detail', kwargs={'location_id': encoded}), {'lang': 'sv'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Helsinki')
        fetch_location_detail_mock.assert_called_once_with(
            uri='https://www.wikidata.org/entity/Q1757',
            lang='sv',
        )

    @patch('locations.views.fetch_location_detail')
    def test_location_detail_returns_wikipedia_links_from_sparql_payload(
        self,
        fetch_location_detail_mock,
    ):
        encoded = quote('https://www.wikidata.org/entity/Q1757', safe='')
        fetch_location_detail_mock.return_value = {
            'id': encoded,
            'uri': 'https://www.wikidata.org/entity/Q1757',
            'name': 'Helsinki',
            'description': 'Capital of Finland',
            'latitude': 60.1699,
            'longitude': 24.9384,
            'location_p276': 'https://www.wikidata.org/entity/Q33',
            'location_p276_label': 'Finland',
            'location_p276_wikipedia_url': 'https://en.wikipedia.org/wiki/Finland',
            'collection_membership_source_url': 'https://example.org/source-1',
            'collection_membership_source_urls': [
                'https://example.org/source-1',
                'https://example.org/source-2',
            ],
            'collection_membership_sources': [
                {
                    'url': 'https://example.org/source-1',
                    'title': 'Example article',
                    'title_language': 'en',
                    'author': 'Example Author',
                    'publication_date': '+2026-01-02T00:00:00Z',
                    'retrieved_date': '',
                    'publisher': {'value': 'http://www.wikidata.org/entity/Q12321', 'label': 'Example Publisher'},
                    'published_in': {'value': 'http://www.wikidata.org/entity/Q12345', 'label': 'Example Newspaper'},
                    'language_of_work': {'value': 'http://www.wikidata.org/entity/Q1860', 'label': 'English'},
                }
            ],
        }

        response = self.client.get(reverse('location-detail', kwargs={'location_id': encoded}), {'lang': 'en'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['location_p276_wikipedia_url'], 'https://en.wikipedia.org/wiki/Finland')
        self.assertEqual(response.data['collection_membership_source_url'], 'https://example.org/source-1')
        self.assertEqual(
            response.data['collection_membership_source_urls'],
            ['https://example.org/source-1', 'https://example.org/source-2'],
        )
        self.assertEqual(len(response.data['collection_membership_sources']), 1)
        self.assertEqual(response.data['collection_membership_sources'][0]['title'], 'Example article')

    @patch('locations.views.fetch_location_detail')
    def test_location_detail_404(self, fetch_location_detail_mock):
        fetch_location_detail_mock.return_value = None
        encoded = quote('https://www.wikidata.org/entity/Q999999999', safe='')

        response = self.client.get(reverse('location-detail', kwargs={'location_id': encoded}))

        self.assertEqual(response.status_code, 404)

    @patch('locations.views.fetch_location_detail')
    def test_location_detail_returns_404_for_removed_draft_uri(self, fetch_location_detail_mock):
        encoded = quote('https://draft.local/location/123', safe='')

        response = self.client.get(reverse('location-detail', kwargs={'location_id': encoded}))

        self.assertEqual(response.status_code, 404)
        fetch_location_detail_mock.assert_not_called()

    @patch('locations.views.fetch_location_detail')
    def test_location_detail_returns_404_for_invalid_location_id(self, fetch_location_detail_mock):
        response = self.client.get(reverse('location-detail', kwargs={'location_id': 'not-a-qid'}))

        self.assertEqual(response.status_code, 404)
        fetch_location_detail_mock.assert_not_called()

    @patch('locations.views.search_wikidata_entities')
    def test_wikidata_search_endpoint(self, search_wikidata_entities_mock):
        search_wikidata_entities_mock.return_value = [
            {
                'id': 'Q1757',
                'label': 'Helsinki',
                'description': 'capital of Finland',
                'uri': 'https://www.wikidata.org/entity/Q1757',
            }
        ]

        response = self.client.get(reverse('wikidata-search'), {'q': 'hels', 'lang': 'fi', 'limit': 5})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        search_wikidata_entities_mock.assert_called_once_with(query='hels', lang='fi', limit=5)

    @patch('locations.views.search_wikidata_entities')
    def test_wikidata_search_returns_502_for_external_error(self, search_wikidata_entities_mock):
        search_wikidata_entities_mock.side_effect = ExternalServiceError('upstream down')

        response = self.client.get(reverse('wikidata-search'), {'q': 'hels'})

        self.assertEqual(response.status_code, 502)
        self.assertIn('detail', response.data)

    @patch('locations.views.fetch_wikidata_entity')
    def test_wikidata_entity_endpoint(self, fetch_wikidata_entity_mock):
        fetch_wikidata_entity_mock.return_value = {
            'id': 'Q1757',
            'uri': 'https://www.wikidata.org/entity/Q1757',
            'label': 'Helsinki',
            'description': 'capital of Finland',
            'latitude': 60.1699,
            'longitude': 24.9384,
            'instance_of': {'id': 'Q515', 'label': 'city'},
            'municipality': {'id': 'Q1757', 'label': 'Helsinki'},
            'commons_category': 'Helsinki',
            'image_name': 'Helsinki city center.jpg',
            'image_url': 'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg',
            'image_thumb_url': 'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg?width=320',
        }

        response = self.client.get(reverse('wikidata-entity', kwargs={'entity_id': 'Q1757'}), {'lang': 'fi'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], 'Q1757')
        self.assertEqual(
            response.data['image_thumb_url'],
            'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg?width=320',
        )
        fetch_wikidata_entity_mock.assert_called_once_with('Q1757', lang='fi')

    @patch('locations.views.fetch_latest_osm_feature_metadata')
    def test_osm_feature_latest_endpoint(self, fetch_latest_osm_feature_metadata_mock):
        fetch_latest_osm_feature_metadata_mock.return_value = {
            'type': 'way',
            'id': 12345,
            'name': 'Example Street',
            'wikidata': '',
            'lat': None,
            'lon': None,
            'tags': {
                'name': 'Example Street',
                'highway': 'residential',
            },
        }

        response = self.client.get(
            reverse('osm-feature-latest', kwargs={'feature_type': 'way', 'feature_id': 12345}),
            {'lang': 'fi'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], 12345)
        self.assertEqual(response.data['name'], 'Example Street')
        fetch_latest_osm_feature_metadata_mock.assert_called_once_with(
            'way',
            12345,
            lang='fi',
            hint_latitude=None,
            hint_longitude=None,
            hint_name=None,
        )

    @patch('locations.views.fetch_latest_osm_feature_metadata')
    def test_osm_feature_latest_endpoint_passes_coordinate_hints(self, fetch_latest_osm_feature_metadata_mock):
        fetch_latest_osm_feature_metadata_mock.return_value = {
            'type': 'way',
            'id': 12345,
            'name': '',
            'wikidata': '',
            'lat': None,
            'lon': None,
            'tags': {},
        }

        response = self.client.get(
            reverse('osm-feature-latest', kwargs={'feature_type': 'way', 'feature_id': 12345}),
            {'lat': '60.187813', 'lon': '24.983468', 'name': 'Tukkutorinkuja'},
        )

        self.assertEqual(response.status_code, 200)
        fetch_latest_osm_feature_metadata_mock.assert_called_once_with(
            'way',
            12345,
            lang='en',
            hint_latitude=60.187813,
            hint_longitude=24.983468,
            hint_name='Tukkutorinkuja',
        )

    def test_osm_feature_latest_endpoint_rejects_invalid_type(self):
        response = self.client.get(
            reverse('osm-feature-latest', kwargs={'feature_type': 'invalid', 'feature_id': 123}),
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('detail', response.data)

    def test_osm_feature_latest_endpoint_rejects_invalid_latitude(self):
        response = self.client.get(
            reverse('osm-feature-latest', kwargs={'feature_type': 'way', 'feature_id': 123}),
            {'lat': 'not-a-number'},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('detail', response.data)

    @patch('locations.views.fetch_latest_osm_feature_metadata')
    def test_osm_feature_latest_endpoint_returns_404_when_not_found(self, fetch_latest_osm_feature_metadata_mock):
        fetch_latest_osm_feature_metadata_mock.return_value = None

        response = self.client.get(
            reverse('osm-feature-latest', kwargs={'feature_type': 'relation', 'feature_id': 999999999}),
        )

        self.assertEqual(response.status_code, 404)
        self.assertIn('detail', response.data)

    @patch('locations.views.fetch_latest_osm_feature_metadata')
    def test_osm_feature_latest_endpoint_returns_502_for_external_error(
        self,
        fetch_latest_osm_feature_metadata_mock,
    ):
        fetch_latest_osm_feature_metadata_mock.side_effect = ExternalServiceError('upstream failure')

        response = self.client.get(
            reverse('osm-feature-latest', kwargs={'feature_type': 'way', 'feature_id': 12345}),
        )

        self.assertEqual(response.status_code, 502)
        self.assertIn('detail', response.data)

    @patch('locations.views.fetch_citoid_metadata')
    def test_citoid_metadata_endpoint(self, fetch_citoid_metadata_mock):
        fetch_citoid_metadata_mock.return_value = {
            'source_url': 'https://example.org/article',
            'source_title': 'Example article',
            'source_title_language': 'en',
            'source_author': 'Example Author',
            'source_publication_date': '2026-01-21',
            'source_publisher_p123': '',
            'source_published_in_p1433': '',
            'source_language_of_work_p407': '',
        }

        response = self.client.get(
            reverse('citoid-metadata'),
            {'url': 'https://example.org/article', 'lang': 'fi'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source_title'], 'Example article')
        fetch_citoid_metadata_mock.assert_called_once_with('https://example.org/article', lang='fi')

    @patch('locations.views.fetch_citoid_metadata')
    def test_citoid_metadata_endpoint_returns_502_for_external_error(self, fetch_citoid_metadata_mock):
        fetch_citoid_metadata_mock.side_effect = ExternalServiceError('upstream failure')

        response = self.client.get(
            reverse('citoid-metadata'),
            {'url': 'https://example.org/article'},
        )

        self.assertEqual(response.status_code, 502)
        self.assertIn('detail', response.data)

    @patch('locations.views.search_commons_categories')
    def test_commons_category_search_endpoint(self, search_commons_categories_mock):
        search_commons_categories_mock.return_value = [
            {
                'name': 'Helsinki',
                'title': 'Category:Helsinki',
                'uri': 'https://commons.wikimedia.org/wiki/Category:Helsinki',
            }
        ]

        response = self.client.get(reverse('commons-category-search'), {'q': 'Hel', 'limit': 8})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        search_commons_categories_mock.assert_called_once_with(query='Hel', limit=8)

    @patch('locations.views.upload_image_to_commons')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_commons_upload_endpoint(
        self,
        oauth_credentials_mock,
        upload_image_to_commons_mock,
    ):
        self._authenticate()
        upload_image_to_commons_mock.return_value = {
            'filename': 'Example.jpg',
            'file_page_url': 'https://commons.wikimedia.org/wiki/File:Example.jpg',
            'file_url': 'https://commons.wikimedia.org/wiki/Special:FilePath/Example.jpg',
            'thumb_url': 'https://commons.wikimedia.org/wiki/Special:FilePath/Example.jpg?width=320',
            'categories': ['Helsinki', 'Finland'],
            'depicts': ['Q811979', 'Q16970'],
            'wikidata_item': 'Q1757',
        }
        image_file = SimpleUploadedFile('Example.jpg', b'test-image-bytes', content_type='image/jpeg')

        response = self.client.post(
            reverse('commons-upload'),
            {
                'file': image_file,
                'caption': 'Test caption',
                'caption_language': 'fi',
                'description': 'Test description',
                'description_language': 'en',
                'target_filename': 'Example_renamed.jpg',
                'author': 'Example Photographer',
                'source_url': 'https://example.org/source-photo',
                'date_created': '2026-02-20',
                'license_template': 'Cc-by-sa-4.0',
                'categories_json': '["Helsinki","Finland"]',
                'depicts_json': '["Q811979","Q16970"]',
                'coordinate_source': 'map',
                'latitude': '60.1699',
                'longitude': '24.9384',
                'heading': '173.4',
                'elevation_meters': '14.2',
                'wikidata_item': 'Q1757',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['filename'], 'Example.jpg')
        oauth_credentials_mock.assert_called_once()
        upload_image_to_commons_mock.assert_called_once()
        call_args = upload_image_to_commons_mock.call_args
        self.assertEqual(call_args.kwargs['caption'], 'Test caption')
        self.assertEqual(call_args.kwargs['caption_language'], 'fi')
        self.assertEqual(call_args.kwargs['description'], 'Test description')
        self.assertEqual(call_args.kwargs['description_language'], 'en')
        self.assertEqual(call_args.kwargs['target_filename'], 'Example_renamed.jpg')
        self.assertEqual(call_args.kwargs['author'], 'Example Photographer')
        self.assertEqual(call_args.kwargs['source_url'], 'https://example.org/source-photo')
        self.assertEqual(call_args.kwargs['date_created'], '2026-02-20')
        self.assertEqual(call_args.kwargs['license_template'], 'Cc-by-sa-4.0')
        self.assertEqual(call_args.kwargs['categories'], ['Helsinki', 'Finland'])
        self.assertEqual(call_args.kwargs['depicts'], ['Q811979', 'Q16970'])
        self.assertEqual(call_args.kwargs['coordinate_source'], 'map')
        self.assertEqual(call_args.kwargs['latitude'], 60.1699)
        self.assertEqual(call_args.kwargs['longitude'], 24.9384)
        self.assertEqual(call_args.kwargs['heading'], 173.4)
        self.assertEqual(call_args.kwargs['elevation_meters'], 14.2)
        self.assertEqual(call_args.kwargs['wikidata_item'], 'Q1757')
        self.assertEqual(call_args.kwargs['oauth_token'], 'token')
        self.assertEqual(call_args.kwargs['oauth_token_secret'], 'secret')

    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_commons_upload_endpoint_requires_file(
        self,
        oauth_credentials_mock,
    ):
        self._authenticate()

        response = self.client.post(
            reverse('commons-upload'),
            {
                'caption': 'No file',
                'coordinate_source': 'exif',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('file', response.data)
        oauth_credentials_mock.assert_called_once()

    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_commons_upload_endpoint_rejects_unsupported_mime_type(
        self,
        oauth_credentials_mock,
    ):
        self._authenticate()
        text_file = SimpleUploadedFile('Example.txt', b'test-text-bytes', content_type='text/plain')

        response = self.client.post(
            reverse('commons-upload'),
            {
                'file': text_file,
                'coordinate_source': 'exif',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('file', response.data)
        self.assertIn('Allowed types', str(response.data['file'][0]))
        oauth_credentials_mock.assert_called_once()

    @override_settings(COMMONS_UPLOAD_MAX_SIZE_BYTES=10)
    @patch('locations.views.upload_image_to_commons')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_commons_upload_endpoint_rejects_too_large_file(
        self,
        oauth_credentials_mock,
        upload_image_to_commons_mock,
    ):
        self._authenticate()
        image_file = SimpleUploadedFile('Example.jpg', b'01234567890', content_type='image/jpeg')

        response = self.client.post(
            reverse('commons-upload'),
            {
                'file': image_file,
                'coordinate_source': 'exif',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('file', response.data)
        self.assertIn('Maximum upload size is', str(response.data['file'][0]))
        oauth_credentials_mock.assert_called_once()
        upload_image_to_commons_mock.assert_not_called()

    @patch('locations.views.upload_image_to_commons')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_commons_upload_endpoint_accepts_svg_mime_type(
        self,
        oauth_credentials_mock,
        upload_image_to_commons_mock,
    ):
        self._authenticate()
        upload_image_to_commons_mock.return_value = {
            'filename': 'Example.svg',
            'file_page_url': 'https://commons.wikimedia.org/wiki/File:Example.svg',
            'file_url': 'https://commons.wikimedia.org/wiki/Special:FilePath/Example.svg',
            'thumb_url': 'https://commons.wikimedia.org/wiki/Special:FilePath/Example.svg?width=320',
            'categories': [],
            'depicts': [],
            'wikidata_item': '',
        }
        svg_file = SimpleUploadedFile('Example.svg', b'<svg></svg>', content_type='image/svg+xml')

        response = self.client.post(
            reverse('commons-upload'),
            {
                'file': svg_file,
                'coordinate_source': 'exif',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201)
        oauth_credentials_mock.assert_called_once()
        upload_image_to_commons_mock.assert_called_once()

    @patch('locations.views.upload_image_to_commons')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_commons_upload_endpoint_returns_502_for_upload_error(
        self,
        oauth_credentials_mock,
        upload_image_to_commons_mock,
    ):
        self._authenticate()
        upload_image_to_commons_mock.side_effect = WikidataWriteError('duplicate filename')
        image_file = SimpleUploadedFile('Example.jpg', b'test-image-bytes', content_type='image/jpeg')

        response = self.client.post(
            reverse('commons-upload'),
            {
                'file': image_file,
                'coordinate_source': 'exif',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 502)
        self.assertIn('detail', response.data)
        oauth_credentials_mock.assert_called_once()
        upload_image_to_commons_mock.assert_called_once()

    @patch('locations.views.search_geocode_places')
    def test_geocode_search_endpoint(self, search_geocode_places_mock):
        search_geocode_places_mock.return_value = [
            {'name': 'Helsinki, Finland', 'latitude': 60.1699, 'longitude': 24.9384}
        ]

        response = self.client.get(reverse('geocode-search'), {'q': 'Helsinki'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        search_geocode_places_mock.assert_called_once_with(query='Helsinki', limit=8)

    @patch('locations.views.reverse_geocode_places')
    def test_geocode_reverse_endpoint(self, reverse_geocode_places_mock):
        reverse_geocode_places_mock.return_value = {
            'country': {'id': 'Q33', 'label': 'Suomi'},
            'municipality': {'id': 'Q1793', 'label': 'Espoo'},
            'detailed_location': {'id': 'Q11889564', 'label': 'Pohjois-Tapiola'},
        }

        response = self.client.get(
            reverse('geocode-reverse'),
            {'lat': '60.2055', 'lon': '24.6559', 'lang': 'fi'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['country'], {'id': 'Q33', 'label': 'Suomi'})
        self.assertEqual(response.data['municipality'], {'id': 'Q1793', 'label': 'Espoo'})
        self.assertEqual(response.data['detailed_location'], {'id': 'Q11889564', 'label': 'Pohjois-Tapiola'})
        reverse_geocode_places_mock.assert_called_once_with(
            latitude=60.2055,
            longitude=24.6559,
            lang='fi',
        )

    @override_settings(SOCIAL_AUTH_MEDIAWIKI_KEY='', SOCIAL_AUTH_MEDIAWIKI_SECRET='')
    def test_auth_status_endpoint_reports_disabled_when_social_auth_not_configured(self):
        response = self.client.get(reverse('auth-status'))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['enabled'])
        self.assertFalse(response.data['authenticated'])
        self.assertEqual(response.data['provider'], 'mediawiki')

    @override_settings(SOCIAL_AUTH_MEDIAWIKI_KEY='key', SOCIAL_AUTH_MEDIAWIKI_SECRET='secret')
    def test_auth_status_endpoint_reports_authenticated_user(self):
        user = get_user_model().objects.create_user(username='wikimedia-user')
        self.client.force_authenticate(user=user)

        response = self.client.get(reverse('auth-status'))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['enabled'])
        self.assertTrue(response.data['authenticated'])
        self.assertEqual(response.data['username'], 'wikimedia-user')
        self.assertEqual(response.data['auth_mode'], 'oauth')

    @override_settings(
        SOCIAL_AUTH_MEDIAWIKI_KEY='',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='',
        DEBUG=True,
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='local-access-token',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='local-access-secret',
    )
    def test_auth_status_endpoint_reports_local_access_token_mode_without_session_login(self):
        response = self.client.get(reverse('auth-status'))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['enabled'])
        self.assertFalse(response.data['authenticated'])
        self.assertEqual(response.data['auth_mode'], 'access_token')
        self.assertEqual(response.data['username'], '')
        self.assertEqual(response.data['login_url'], '/auth/login/local/?next=/')
        self.assertEqual(response.data['logout_url'], '/auth/logout/?next=/')

    @override_settings(
        SOCIAL_AUTH_MEDIAWIKI_KEY='',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='',
        DEBUG=True,
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='local-access-token',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='local-access-secret',
    )
    def test_auth_status_endpoint_hides_local_access_token_mode_for_non_local_ip(self):
        response = self.client.get(reverse('auth-status'), REMOTE_ADDR='10.0.0.55')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['enabled'])
        self.assertEqual(response.data['auth_mode'], 'oauth')
        self.assertEqual(response.data['login_url'], '/auth/login/mediawiki/?next=/')

    @override_settings(
        SOCIAL_AUTH_MEDIAWIKI_KEY='',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='',
        DEBUG=True,
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='local-access-token',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='local-access-secret',
    )
    @patch(
        'locations.views.fetch_wikidata_authenticated_username',
        return_value='Zache',
    )
    def test_local_access_login_creates_user_and_sets_authenticated_session(
        self,
        fetch_wikidata_authenticated_username_mock,
    ):
        login_response = self.client.get('/auth/login/local/?next=/')
        auth_response = self.client.get(reverse('auth-status'))

        self.assertEqual(login_response.status_code, 302)
        self.assertEqual(login_response.headers.get('Location'), '/')
        self.assertEqual(auth_response.status_code, 200)
        self.assertTrue(auth_response.data['authenticated'])
        self.assertEqual(auth_response.data['username'], 'local_Zache')
        self.assertEqual(auth_response.data['auth_mode'], 'access_token')
        self.assertTrue(get_user_model().objects.filter(username='local_Zache').exists())
        self.assertFalse(get_user_model().objects.filter(username='Zache').exists())
        fetch_wikidata_authenticated_username_mock.assert_called_once_with(
            oauth_token='local-access-token',
            oauth_token_secret='local-access-secret',
        )

    @override_settings(
        SOCIAL_AUTH_MEDIAWIKI_KEY='',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='',
        DEBUG=True,
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='local-access-token',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='local-access-secret',
    )
    @patch(
        'locations.views.fetch_wikidata_authenticated_username',
        side_effect=WikidataWriteError('userinfo request failed'),
    )
    def test_local_access_login_returns_502_when_username_lookup_fails(
        self,
        fetch_wikidata_authenticated_username_mock,
    ):
        response = self.client.get('/auth/login/local/?next=/')

        self.assertEqual(response.status_code, 502)
        self.assertIn('detail', response.data)
        fetch_wikidata_authenticated_username_mock.assert_called_once_with(
            oauth_token='local-access-token',
            oauth_token_secret='local-access-secret',
        )

    @override_settings(
        SOCIAL_AUTH_MEDIAWIKI_KEY='',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='',
        DEBUG=True,
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='local-access-token',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='local-access-secret',
    )
    def test_local_access_login_rejects_non_local_ip(self):
        response = self.client.get('/auth/login/local/?next=/', REMOTE_ADDR='10.0.0.55')

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data.get('detail'),
            'Local development access token mode is only allowed from localhost.',
        )

    @override_settings(
        SOCIAL_AUTH_MEDIAWIKI_KEY='oauth-key',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='oauth-secret',
        DEBUG=True,
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='local-access-token',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='local-access-secret',
    )
    def test_mediawiki_login_route_redirects_to_local_login_when_local_tokens_enabled(self):
        response = self.client.get('/auth/login/mediawiki/?next=/dashboard/')

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers.get('Location'), '/auth/login/local/?next=%2Fdashboard%2F')

    @override_settings(
        SOCIAL_AUTH_MEDIAWIKI_KEY='oauth-key',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='oauth-secret',
        DEBUG=True,
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='local-access-token',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='local-access-secret',
    )
    @patch('social_django.views.auth')
    def test_mediawiki_login_route_uses_oauth_for_non_local_ip_even_when_local_tokens_enabled(
        self,
        social_auth_mock,
    ):
        social_auth_mock.return_value = HttpResponseRedirect('/auth/complete/mediawiki/')

        response = self.client.get('/auth/login/mediawiki/?next=/', REMOTE_ADDR='10.0.0.55')

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers.get('Location'), '/auth/complete/mediawiki/')
        social_auth_mock.assert_called_once()

    @override_settings(
        SOCIAL_AUTH_MEDIAWIKI_KEY='',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='',
        DEBUG=False,
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='',
    )
    def test_mediawiki_login_route_returns_503_when_oauth_not_configured(self):
        response = self.client.get('/auth/login/mediawiki/?next=/')

        self.assertEqual(response.status_code, 503)
        self.assertIn('detail', response.data)

    @override_settings(
        SOCIAL_AUTH_MEDIAWIKI_KEY='oauth-key',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='oauth-secret',
        DEBUG=False,
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='',
    )
    @patch('social_django.views.auth')
    def test_mediawiki_login_route_delegates_to_social_auth_view(
        self,
        social_auth_mock,
    ):
        social_auth_mock.return_value = HttpResponseRedirect('/auth/complete/mediawiki/')

        response = self.client.get('/auth/login/mediawiki/?next=/')

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers.get('Location'), '/auth/complete/mediawiki/')
        social_auth_mock.assert_called_once()

    def test_auth_logout_route_redirects_and_clears_session(self):
        user = get_user_model().objects.create_user(username='logout-user')
        self.client.force_login(user)

        before_logout = self.client.get(reverse('auth-status'))
        self.assertEqual(before_logout.status_code, 200)
        self.assertTrue(before_logout.data['authenticated'])

        response = self.client.get('/auth/logout/?next=/')

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers.get('Location'), '/')

        after_logout = self.client.get(reverse('auth-status'))
        self.assertEqual(after_logout.status_code, 200)
        self.assertFalse(after_logout.data['authenticated'])

    @patch('locations.views.ensure_wikidata_collection_membership')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_wikidata_add_existing_endpoint(
        self,
        oauth_credentials_mock,
        ensure_wikidata_collection_membership_mock,
    ):
        self._authenticate()
        ensure_wikidata_collection_membership_mock.return_value = {
            'qid': 'Q1757',
            'uri': 'https://www.wikidata.org/entity/Q1757',
            'already_listed': False,
        }

        response = self.client.post(
            reverse('wikidata-add-existing'),
            {
                'wikidata_item': 'Q1757',
                'source_url': 'https://example.org/article',
                'source_title': 'Example article',
                'source_title_language': 'en',
                'source_author': 'Example Author',
                'source_publication_date': '2026-01-21',
                'source_publisher_p123': 'Q12321',
                'source_published_in_p1433': 'Q12345',
                'source_language_of_work_p407': 'Q1860',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['qid'], 'Q1757')
        oauth_credentials_mock.assert_called_once()
        ensure_wikidata_collection_membership_mock.assert_called_once_with(
            'Q1757',
            oauth_token='token',
            oauth_token_secret='secret',
            source_url='https://example.org/article',
            source_title='Example article',
            source_title_language='en',
            source_author='Example Author',
            source_publication_date='2026-01-21',
            source_publisher_p123='Q12321',
            source_published_in_p1433='Q12345',
            source_language_of_work_p407='Q1860',
        )

    @patch('locations.views.ensure_wikidata_collection_membership')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_wikidata_add_existing_endpoint_normalizes_finnish_publication_date(
        self,
        oauth_credentials_mock,
        ensure_wikidata_collection_membership_mock,
    ):
        self._authenticate()
        ensure_wikidata_collection_membership_mock.return_value = {
            'qid': 'Q1757',
            'uri': 'https://www.wikidata.org/entity/Q1757',
            'already_listed': False,
        }

        response = self.client.post(
            reverse('wikidata-add-existing'),
            {
                'wikidata_item': 'Q1757',
                'source_url': 'https://example.org/article',
                'source_publication_date': '1.11.2026',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        oauth_credentials_mock.assert_called_once()
        ensure_wikidata_collection_membership_mock.assert_called_once()
        call_args = ensure_wikidata_collection_membership_mock.call_args
        self.assertEqual(call_args.kwargs['source_publication_date'], '2026-11-01')

    @patch('locations.views.ensure_wikidata_collection_membership')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_wikidata_add_existing_endpoint_returns_502_for_write_error(
        self,
        oauth_credentials_mock,
        ensure_wikidata_collection_membership_mock,
    ):
        self._authenticate()
        ensure_wikidata_collection_membership_mock.side_effect = WikidataWriteError('login failed')

        response = self.client.post(
            reverse('wikidata-add-existing'),
            {'wikidata_item': 'Q1757', 'source_url': 'https://example.org/article'},
            format='json',
        )

        self.assertEqual(response.status_code, 502)
        self.assertIn('detail', response.data)
        oauth_credentials_mock.assert_called_once()

    @override_settings(
        SOCIAL_AUTH_MEDIAWIKI_KEY='',
        SOCIAL_AUTH_MEDIAWIKI_SECRET='',
        DEBUG=True,
        LOCAL_DEV_MEDIAWIKI_ACCESS_TOKEN='local-access-token',
        LOCAL_DEV_MEDIAWIKI_ACCESS_SECRET='local-access-secret',
    )
    @patch('locations.views.ensure_wikidata_collection_membership')
    def test_wikidata_add_existing_endpoint_uses_local_access_token_fallback(
        self,
        ensure_wikidata_collection_membership_mock,
    ):
        with patch('locations.views.fetch_wikidata_authenticated_username', return_value='Zache') as username_mock:
            login_response = self.client.get('/auth/login/local/?next=/')

        self.assertEqual(login_response.status_code, 302)
        self.assertEqual(login_response.headers.get('Location'), '/')
        username_mock.assert_called_once_with(
            oauth_token='local-access-token',
            oauth_token_secret='local-access-secret',
        )

        ensure_wikidata_collection_membership_mock.return_value = {
            'qid': 'Q1757',
            'uri': 'https://www.wikidata.org/entity/Q1757',
            'already_listed': False,
        }

        response = self.client.post(
            reverse('wikidata-add-existing'),
            {
                'wikidata_item': 'Q1757',
                'source_url': 'https://example.org/article',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        ensure_wikidata_collection_membership_mock.assert_called_once_with(
            'Q1757',
            oauth_token='local-access-token',
            oauth_token_secret='local-access-secret',
            source_url='https://example.org/article',
            source_title='',
            source_title_language='',
            source_author='',
            source_publication_date='',
            source_publisher_p123='',
            source_published_in_p1433='',
            source_language_of_work_p407='',
        )

    @patch('locations.views.ensure_wikidata_collection_membership')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_wikidata_add_existing_endpoint_requires_source_url(
        self,
        oauth_credentials_mock,
        ensure_wikidata_collection_membership_mock,
    ):
        self._authenticate()
        response = self.client.post(
            reverse('wikidata-add-existing'),
            {'wikidata_item': 'Q1757'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('source_url', response.data)
        ensure_wikidata_collection_membership_mock.assert_not_called()
        oauth_credentials_mock.assert_called_once()

    @patch('locations.views.create_wikidata_building_item')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_wikidata_create_item_endpoint(
        self,
        oauth_credentials_mock,
        create_wikidata_building_item_mock,
    ):
        self._authenticate()
        create_wikidata_building_item_mock.return_value = {
            'qid': 'Q123456',
            'uri': 'https://www.wikidata.org/entity/Q123456',
            'added_to_collection_qid': 'Q138299296',
        }
        payload = {
            'label': 'Example Building',
            'description': 'Historic building in test city',
            'instance_of_p31': 'Q41176',
            'instance_of_p31_values': ['Q41176', 'Q811979'],
            'country_p17': 'Q33',
            'municipality_p131': 'Q1757',
            'part_of_p361': 'Q42',
            'part_of_p361_values': ['Q42', 'Q42'],
            'custom_properties': [
                {'property_id': 'P18', 'value': 'Example.jpg', 'datatype': 'commonsMedia'},
                {'property_id': 'p18', 'value': 'Example.jpg', 'datatype': 'commonsmedia'},
                {'property_id': 'P2048', 'value': '12.5 Q11573'},
            ],
            'latitude': 60.1699,
            'longitude': 24.9384,
            'source_url': 'https://example.org/article',
        }

        response = self.client.post(
            reverse('wikidata-create-item'),
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['qid'], 'Q123456')
        create_wikidata_building_item_mock.assert_called_once()
        oauth_credentials_mock.assert_called_once()
        call_args = create_wikidata_building_item_mock.call_args
        self.assertEqual(call_args.kwargs['lang'], 'en')
        self.assertEqual(call_args.kwargs['oauth_token'], 'token')
        self.assertEqual(call_args.kwargs['oauth_token_secret'], 'secret')
        self.assertEqual(call_args.args[0]['instance_of_p31'], 'Q41176')
        self.assertEqual(call_args.args[0]['instance_of_p31_values'], ['Q41176', 'Q811979'])
        self.assertEqual(call_args.args[0]['part_of_p361'], 'Q42')
        self.assertEqual(call_args.args[0]['part_of_p361_values'], ['Q42'])
        self.assertEqual(
            call_args.args[0]['custom_properties'],
            [
                {'property_id': 'P18', 'value': 'Example.jpg', 'datatype': 'commonsmedia'},
                {'property_id': 'P2048', 'value': '12.5 Q11573', 'datatype': ''},
            ],
        )

    @patch('locations.views.create_wikidata_building_item')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_wikidata_create_item_endpoint_normalizes_finnish_date_formats(
        self,
        oauth_credentials_mock,
        create_wikidata_building_item_mock,
    ):
        self._authenticate()
        create_wikidata_building_item_mock.return_value = {
            'qid': 'Q123456',
            'uri': 'https://www.wikidata.org/entity/Q123456',
            'added_to_collection_qid': 'Q138299296',
        }
        payload = {
            'label': 'Example Building',
            'description': 'Historic building in test city',
            'instance_of_p31': 'Q41176',
            'country_p17': 'Q33',
            'municipality_p131': 'Q1757',
            'latitude': 60.1699,
            'longitude': 24.9384,
            'inception_p571': '1.2.2026',
            'inception_source_url': 'https://example.org/article',
            'official_closure_date_p3999': '9.10.2027',
            'official_closure_date_source_url': 'https://example.org/article',
            'source_url': 'https://example.org/article',
            'source_publication_date': '1.11.2026',
        }

        response = self.client.post(
            reverse('wikidata-create-item'),
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['qid'], 'Q123456')
        create_wikidata_building_item_mock.assert_called_once()
        oauth_credentials_mock.assert_called_once()
        call_args = create_wikidata_building_item_mock.call_args
        self.assertEqual(call_args.args[0]['inception_p571'], '2026-02-01')
        self.assertEqual(call_args.args[0]['official_closure_date_p3999'], '2027-10-09')
        self.assertEqual(call_args.args[0]['source_publication_date'], '2026-11-01')

    @patch('locations.views.create_wikidata_building_item')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_wikidata_create_item_endpoint_rejects_invalid_part_of_qid(
        self,
        oauth_credentials_mock,
        create_wikidata_building_item_mock,
    ):
        self._authenticate()
        payload = {
            'label': 'Example Building',
            'description': 'Historic building in test city',
            'instance_of_p31': 'Q41176',
            'country_p17': 'Q33',
            'municipality_p131': 'Q1757',
            'part_of_p361': 'not-a-qid',
            'latitude': 60.1699,
            'longitude': 24.9384,
            'source_url': 'https://example.org/article',
        }

        response = self.client.post(
            reverse('wikidata-create-item'),
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('part_of_p361', response.data)
        create_wikidata_building_item_mock.assert_not_called()
        oauth_credentials_mock.assert_called_once()

    @patch('locations.views.create_wikidata_building_item')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_wikidata_create_item_endpoint_rejects_invalid_custom_property_id(
        self,
        oauth_credentials_mock,
        create_wikidata_building_item_mock,
    ):
        self._authenticate()
        payload = {
            'label': 'Example Building',
            'description': 'Historic building in test city',
            'instance_of_p31': 'Q41176',
            'country_p17': 'Q33',
            'municipality_p131': 'Q1757',
            'latitude': 60.1699,
            'longitude': 24.9384,
            'custom_properties': [
                {'property_id': 'invalid', 'value': 'foo'},
            ],
            'source_url': 'https://example.org/article',
        }

        response = self.client.post(
            reverse('wikidata-create-item'),
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('custom_properties', response.data)
        create_wikidata_building_item_mock.assert_not_called()
        oauth_credentials_mock.assert_called_once()

    @patch('locations.views.create_wikidata_building_item')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_wikidata_create_item_endpoint_enforces_source_for_architect(
        self,
        oauth_credentials_mock,
        create_wikidata_building_item_mock,
    ):
        self._authenticate()
        payload = {
            'label': 'Example Building',
            'description': 'Historic building in test city',
            'instance_of_p31': 'Q41176',
            'country_p17': 'Q33',
            'municipality_p131': 'Q1757',
            'latitude': 60.1699,
            'longitude': 24.9384,
            'architect_p84': 'Q6313',
            'source_url': 'https://example.org/article',
        }

        response = self.client.post(
            reverse('wikidata-create-item'),
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('architect_source_url', response.data)
        create_wikidata_building_item_mock.assert_not_called()
        oauth_credentials_mock.assert_called_once()

    @patch('locations.views.create_wikidata_building_item')
    @patch(
        'locations.views._mediawiki_oauth_credentials_for_request',
        return_value=({'oauth_token': 'token', 'oauth_token_secret': 'secret'}, '', 200),
    )
    def test_wikidata_create_item_endpoint_enforces_source_for_official_closure_date(
        self,
        oauth_credentials_mock,
        create_wikidata_building_item_mock,
    ):
        self._authenticate()
        payload = {
            'label': 'Example Building',
            'description': 'Historic building in test city',
            'instance_of_p31': 'Q41176',
            'country_p17': 'Q33',
            'municipality_p131': 'Q1757',
            'latitude': 60.1699,
            'longitude': 24.9384,
            'official_closure_date_p3999': '1999-12-31',
            'source_url': 'https://example.org/article',
        }

        response = self.client.post(
            reverse('wikidata-create-item'),
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('official_closure_date_source_url', response.data)
        create_wikidata_building_item_mock.assert_not_called()
        oauth_credentials_mock.assert_called_once()

    def test_wikidata_write_endpoints_require_authentication(self):
        image_file = SimpleUploadedFile('Example.jpg', b'test-image-bytes', content_type='image/jpeg')
        add_existing_response = self.client.post(
            reverse('wikidata-add-existing'),
            {'wikidata_item': 'Q1757', 'source_url': 'https://example.org/article'},
            format='json',
        )
        create_item_response = self.client.post(
            reverse('wikidata-create-item'),
            {
                'label': 'Example Building',
                'description': 'Historic building in test city',
                'instance_of_p31': 'Q41176',
                'country_p17': 'Q33',
                'municipality_p131': 'Q1757',
                'latitude': 60.1699,
                'longitude': 24.9384,
                'source_url': 'https://example.org/article',
            },
            format='json',
        )
        commons_upload_response = self.client.post(
            reverse('commons-upload'),
            {
                'file': image_file,
                'coordinate_source': 'exif',
            },
            format='multipart',
        )

        self.assertEqual(add_existing_response.status_code, 401)
        self.assertEqual(create_item_response.status_code, 401)
        self.assertEqual(commons_upload_response.status_code, 401)

    @patch('locations.views.fetch_wikidata_entity')
    @patch('locations.views.fetch_location_detail')
    def test_location_detail_omits_children_for_sparql_parent(
        self,
        fetch_location_detail_mock,
        fetch_wikidata_entity_mock,
    ):
        parent_uri = 'https://www.wikidata.org/entity/Q1757'
        encoded = quote(parent_uri, safe='')
        fetch_location_detail_mock.return_value = {
            'id': encoded,
            'uri': parent_uri,
            'name': 'Helsinki',
            'description': 'From SPARQL',
            'latitude': 60.1699,
            'longitude': 24.9384,
        }
        fetch_wikidata_entity_mock.return_value = {
            'id': 'Q1757',
            'image_name': 'Helsinki city center.jpg',
            'image_url': 'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg',
        }

        response = self.client.get(reverse('location-detail', kwargs={'location_id': encoded}), {'lang': 'fi'})

        self.assertEqual(response.status_code, 200)
        self.assertNotIn('children', response.data)
        self.assertEqual(
            response.data['image_url'],
            'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg',
        )
        fetch_wikidata_entity_mock.assert_called_once_with('Q1757', lang='fi')
        self.fetch_location_children_mock.assert_not_called()

    def test_location_children_endpoint_includes_p361_and_p527_children(self):
        parent_uri = 'https://www.wikidata.org/entity/Q1757'
        encoded = quote(parent_uri, safe='')
        self.fetch_location_children_mock.return_value = [
            {
                'id': quote('https://www.wikidata.org/entity/Q100', safe=''),
                'uri': 'https://www.wikidata.org/entity/Q100',
                'name': 'P361 child',
                'source': 'sparql',
                'commons_category': 'Helsinki districts',
            },
            {
                'id': quote('https://www.wikidata.org/entity/Q200', safe=''),
                'uri': 'https://www.wikidata.org/entity/Q200',
                'name': 'P527 child',
                'source': 'sparql',
                'commons_category': 'Helsinki buildings',
            },
        ]

        response = self.client.get(reverse('location-children'), {'lang': 'fi', 'location_id': encoded})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        child_names = [item['name'] for item in response.data]
        self.assertIn('P361 child', child_names)
        self.assertIn('P527 child', child_names)
        self.fetch_location_children_mock.assert_called_with(
            uri='http://www.wikidata.org/entity/Q1757',
            lang='fi',
        )

    def test_location_children_endpoint_uses_http_wikidata_uri_when_given_http_id(self):
        parent_uri = 'http://www.wikidata.org/entity/Q18660756'
        encoded = quote(parent_uri, safe='')
        self.fetch_location_children_mock.return_value = []

        response = self.client.get(reverse('location-children'), {'lang': 'fi', 'location_id': encoded})

        self.assertEqual(response.status_code, 200)
        self.fetch_location_children_mock.assert_called_with(uri=parent_uri, lang='fi')

    def test_location_children_endpoint_returns_404_for_removed_draft_uri(self):
        encoded = quote('https://draft.local/location/123', safe='')

        response = self.client.get(reverse('location-children'), {'lang': 'fi', 'location_id': encoded})

        self.assertEqual(response.status_code, 404)
        self.fetch_location_children_mock.assert_not_called()

    def test_location_children_endpoint_returns_404_for_invalid_location_id(self):
        response = self.client.get(reverse('location-children'), {'lang': 'fi', 'location_id': 'not-a-qid'})

        self.assertEqual(response.status_code, 404)
        self.fetch_location_children_mock.assert_not_called()
