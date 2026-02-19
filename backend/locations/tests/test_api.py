from unittest.mock import patch
from urllib.parse import quote, unquote

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from locations.models import DraftLocation
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

    def tearDown(self):
        self._enrich_counts_patcher.stop()
        self._fetch_children_patcher.stop()
        super().tearDown()

    def test_frontend_app_served(self):
        response = self.client.get(reverse('frontend-app'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="app"')
        self.assertContains(response, 'window.APP_CONFIG')

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

    @patch('locations.views.search_geocode_places')
    def test_geocode_search_endpoint(self, search_geocode_places_mock):
        search_geocode_places_mock.return_value = [
            {'name': 'Helsinki, Finland', 'latitude': 60.1699, 'longitude': 24.9384}
        ]

        response = self.client.get(reverse('geocode-search'), {'q': 'Helsinki'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        search_geocode_places_mock.assert_called_once_with(query='Helsinki', limit=8)

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
    @patch(
        'locations.views.fetch_wikidata_authenticated_username',
        return_value='Zache',
    )
    def test_auth_status_endpoint_reports_local_access_token_mode(
        self,
        fetch_wikidata_authenticated_username_mock,
    ):
        response = self.client.get(reverse('auth-status'))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['enabled'])
        self.assertTrue(response.data['authenticated'])
        self.assertEqual(response.data['auth_mode'], 'access_token')
        self.assertEqual(response.data['username'], 'Zache')
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
    @patch('builtins.print')
    @patch(
        'locations.views.fetch_wikidata_authenticated_username',
        side_effect=WikidataWriteError('userinfo request failed'),
    )
    def test_auth_status_endpoint_logs_debug_when_local_access_username_lookup_fails(
        self,
        fetch_wikidata_authenticated_username_mock,
        print_mock,
    ):
        response = self.client.get(reverse('auth-status'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['username'], 'local-access-token')
        fetch_wikidata_authenticated_username_mock.assert_called_once_with(
            oauth_token='local-access-token',
            oauth_token_secret='local-access-secret',
        )
        print_mock.assert_called_once()
        self.assertIn('username lookup failed', str(print_mock.call_args))

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
    def test_wikidata_add_existing_endpoint_returns_502_for_write_error(
        self,
        oauth_credentials_mock,
        ensure_wikidata_collection_membership_mock,
    ):
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
        payload = {
            'label': 'Example Building',
            'description': 'Historic building in test city',
            'instance_of_p31': 'Q41176',
            'country_p17': 'Q33',
            'municipality_p131': 'Q1757',
            'latitude': 60.1699,
            'longitude': 24.9384,
            'architect_p84': 'Q6313',
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
        payload = {
            'label': 'Example Building',
            'description': 'Historic building in test city',
            'instance_of_p31': 'Q41176',
            'country_p17': 'Q33',
            'municipality_p131': 'Q1757',
            'latitude': 60.1699,
            'longitude': 24.9384,
            'official_closure_date_p3999': '1999-12-31',
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
        response = self.client.post(
            reverse('wikidata-add-existing'),
            {'wikidata_item': 'Q1757', 'source_url': 'https://example.org/article'},
            format='json',
        )

        self.assertIn(response.status_code, (401, 503))

    def test_create_draft_location(self):
        payload = {
            'name': 'Test Draft',
            'description': 'Draft description',
            'location_type': 'building',
            'wikidata_item': 'Q1757',
            'latitude': 60.1699,
            'longitude': 24.9384,
            'address_text': 'Mannerheimintie 1',
            'postal_code': '00100',
            'municipality_p131': 'Q1757',
            'commons_category': 'Helsinki',
            'parent_uri': 'https://www.wikidata.org/entity/Q1757',
        }

        response = self.client.post(reverse('draft-location-list-create'), payload, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(DraftLocation.objects.count(), 1)
        self.assertEqual(response.data['name'], payload['name'])
        self.assertEqual(response.data['parent_uri'], payload['parent_uri'])

    def test_draft_location_list_returns_all_drafts(self):
        DraftLocation.objects.create(
            name='Draft A',
            description='',
            location_type='poi',
            wikidata_item='',
            latitude=60.1,
            longitude=24.1,
        )
        DraftLocation.objects.create(
            name='Draft B',
            description='',
            location_type='poi',
            wikidata_item='',
            latitude=61.1,
            longitude=25.1,
        )

        response = self.client.get(reverse('draft-location-list-create'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_update_draft_location(self):
        draft = DraftLocation.objects.create(
            name='Old name',
            description='Old description',
            location_type='poi',
            wikidata_item='',
            latitude=60.0,
            longitude=24.0,
        )

        response = self.client.patch(
            reverse('draft-location-detail', kwargs={'draft_id': draft.id}),
            {
                'name': 'Updated name',
                'description': 'Updated description',
                'parent_uri': 'https://www.wikidata.org/entity/Q1757',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        draft.refresh_from_db()
        self.assertEqual(draft.name, 'Updated name')
        self.assertEqual(draft.description, 'Updated description')
        self.assertEqual(draft.parent_uri, 'https://www.wikidata.org/entity/Q1757')

    def test_get_draft_location_detail(self):
        draft = DraftLocation.objects.create(
            name='Draft detail',
            description='Detail payload',
            location_type='poi',
            wikidata_item='Q1757',
            latitude=60.123,
            longitude=24.456,
            parent_uri='https://www.wikidata.org/entity/Q1757',
        )

        response = self.client.get(reverse('draft-location-detail', kwargs={'draft_id': draft.id}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], draft.id)
        self.assertEqual(response.data['name'], 'Draft detail')
        self.assertEqual(response.data['wikidata_item'], 'Q1757')
        self.assertEqual(response.data['parent_uri'], 'https://www.wikidata.org/entity/Q1757')

    @patch('locations.views.fetch_locations')
    def test_location_list_includes_draft_locations(self, fetch_locations_mock):
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
        DraftLocation.objects.create(
            name='My Draft',
            description='Custom draft item',
            location_type='poi',
            wikidata_item='',
            latitude=61.0,
            longitude=25.0,
        )

        response = self.client.get(reverse('location-list'), {'lang': 'fi'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        draft_items = [item for item in response.data if item.get('source') == 'draft']
        self.assertEqual(len(draft_items), 1)
        self.assertEqual(draft_items[0]['name'], 'My Draft')

    @patch('locations.views.fetch_location_detail')
    @patch('locations.views.fetch_wikidata_entity')
    @patch('locations.views.fetch_locations')
    def test_location_list_dedupes_draft_with_same_wikidata_uri(
        self,
        fetch_locations_mock,
        fetch_wikidata_entity_mock,
        fetch_location_detail_mock,
    ):
        fetch_locations_mock.return_value = [
            {
                'id': quote('https://www.wikidata.org/entity/Q1757', safe=''),
                'uri': 'https://www.wikidata.org/entity/Q1757',
                'name': 'Helsinki',
                'description': '',
                'latitude': 60.1699,
                'longitude': 24.9384,
            }
        ]
        DraftLocation.objects.create(
            name='Duplicate Helsinki draft',
            description='',
            location_type='poi',
            wikidata_item='Q1757',
            latitude=60.1699,
            longitude=24.9384,
        )

        response = self.client.get(reverse('location-list'), {'lang': 'fi'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Helsinki')
        fetch_location_detail_mock.assert_not_called()
        fetch_wikidata_entity_mock.assert_not_called()

    @patch('locations.views.fetch_location_detail')
    @patch('locations.views.fetch_locations')
    def test_location_list_uses_wikidata_detail_for_draft_with_wikidata_item(
        self,
        fetch_locations_mock,
        fetch_location_detail_mock,
    ):
        fetch_locations_mock.return_value = []
        DraftLocation.objects.create(
            name='Draft Ympyratalo',
            description='',
            location_type='Q1021645',
            wikidata_item='Q3572332',
            latitude=60.1701,
            longitude=24.9422,
            parent_uri='https://www.wikidata.org/entity/Q18660756',
        )
        fetch_location_detail_mock.return_value = {
            'id': quote('https://www.wikidata.org/entity/Q3572332', safe=''),
            'uri': 'https://www.wikidata.org/entity/Q3572332',
            'name': 'Ympyratalo (SPARQL)',
            'description': 'From SPARQL',
            'latitude': 60.1699,
            'longitude': 24.9384,
            'image_name': 'Ympyratalo.jpg',
            'image_url': 'https://commons.wikimedia.org/wiki/Special:FilePath/Ympyratalo.jpg',
            'image_thumb_url': 'https://commons.wikimedia.org/wiki/Special:FilePath/Ympyratalo.jpg?width=320',
        }

        response = self.client.get(reverse('location-list'), {'lang': 'fi'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['source'], 'draft')
        self.assertEqual(response.data[0]['uri'], 'https://www.wikidata.org/entity/Q3572332')
        self.assertEqual(
            response.data[0]['image_url'],
            'https://commons.wikimedia.org/wiki/Special:FilePath/Ympyratalo.jpg',
        )
        self.assertEqual(
            response.data[0]['image_thumb_url'],
            'https://commons.wikimedia.org/wiki/Special:FilePath/Ympyratalo.jpg?width=320',
        )
        fetch_location_detail_mock.assert_called_once_with(
            uri='https://www.wikidata.org/entity/Q3572332',
            lang='fi',
        )
        fetch_locations_mock.assert_called_once_with(
            lang='fi',
            additional_wikidata_qids=['Q3572332'],
        )

    @patch('locations.views.fetch_location_detail')
    def test_location_detail_returns_draft_item(self, fetch_location_detail_mock):
        draft = DraftLocation.objects.create(
            name='Draft Detail',
            description='Draft details',
            location_type='poi',
            wikidata_item='',
            latitude=60.5,
            longitude=24.5,
            municipality_p131='Q1757',
        )
        encoded = quote(f'https://draft.local/location/{draft.id}', safe='')

        response = self.client.get(reverse('location-detail', kwargs={'location_id': encoded}), {'lang': 'fi'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Draft Detail')
        self.assertEqual(response.data['source'], 'draft')
        self.assertNotIn('children', response.data)
        fetch_location_detail_mock.assert_not_called()

    @patch('locations.views.fetch_location_detail')
    def test_location_detail_for_draft_with_wikidata_item_uses_sparql_detail(
        self,
        fetch_location_detail_mock,
    ):
        draft = DraftLocation.objects.create(
            name='Draft Ympyratalo',
            description='Draft description',
            location_type='Q1021645',
            wikidata_item='Q3572332',
            latitude=60.1701,
            longitude=24.9422,
            parent_uri='https://www.wikidata.org/entity/Q18660756',
        )
        encoded = quote(f'https://draft.local/location/{draft.id}', safe='')
        fetch_location_detail_mock.return_value = {
            'id': quote('https://www.wikidata.org/entity/Q3572332', safe=''),
            'uri': 'https://www.wikidata.org/entity/Q3572332',
            'name': 'Ympyratalo (SPARQL)',
            'description': 'From SPARQL',
            'latitude': 60.1699,
            'longitude': 24.9384,
            'location_p276': 'https://www.wikidata.org/entity/Q1757',
            'location_p276_label': 'Helsinki',
        }

        response = self.client.get(reverse('location-detail', kwargs={'location_id': encoded}), {'lang': 'fi'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source'], 'draft')
        self.assertEqual(response.data['draft_id'], draft.id)
        self.assertEqual(response.data['uri'], 'https://www.wikidata.org/entity/Q3572332')
        self.assertEqual(response.data['wikidata_item'], 'Q3572332')
        # SPARQL detail is primary display base.
        self.assertEqual(response.data['name'], 'Ympyratalo (SPARQL)')
        self.assertEqual(response.data['latitude'], 60.1699)
        self.assertEqual(response.data['longitude'], 24.9384)
        self.assertEqual(response.data['parent_uri'], 'https://www.wikidata.org/entity/Q18660756')
        # SPARQL metadata is still present.
        self.assertEqual(response.data['location_p276'], 'https://www.wikidata.org/entity/Q1757')
        self.assertEqual(response.data['location_p276_label'], 'Helsinki')
        fetch_location_detail_mock.assert_called_once_with(
            uri='https://www.wikidata.org/entity/Q3572332',
            lang='fi',
        )

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
        child = DraftLocation.objects.create(
            name='Local child',
            description='Child item',
            location_type='poi',
            wikidata_item='',
            latitude=60.2,
            longitude=24.9,
            parent_uri=parent_uri,
        )

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

    def test_location_children_endpoint_includes_children_for_draft_parent(self):
        parent = DraftLocation.objects.create(
            name='Draft parent',
            description='Parent item',
            location_type='poi',
            wikidata_item='',
            latitude=60.5,
            longitude=24.5,
        )
        child = DraftLocation.objects.create(
            name='Draft child',
            description='Child item',
            location_type='poi',
            wikidata_item='',
            latitude=60.51,
            longitude=24.51,
            parent_uri=parent.canonical_uri(),
        )
        encoded_parent = quote(parent.canonical_uri(), safe='')

        response = self.client.get(reverse('location-children'), {'lang': 'fi', 'location_id': encoded_parent})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], child.name)

    def test_location_children_endpoint_uses_wikidata_item_for_draft_parent(self):
        parent = DraftLocation.objects.create(
            name='Draft parent',
            description='Parent item',
            location_type='poi',
            wikidata_item='Q1757',
            latitude=60.5,
            longitude=24.5,
        )
        encoded_parent = quote(parent.canonical_uri(), safe='')
        self.fetch_location_children_mock.return_value = []

        response = self.client.get(reverse('location-children'), {'lang': 'fi', 'location_id': encoded_parent})

        self.assertEqual(response.status_code, 200)
        self.fetch_location_children_mock.assert_called_with(
            uri='http://www.wikidata.org/entity/Q1757',
            lang='fi',
        )

    @patch('locations.views.fetch_wikidata_entity')
    @patch('locations.views.fetch_location_detail')
    def test_location_detail_prefers_sparql_over_duplicate_draft(
        self,
        fetch_location_detail_mock,
        fetch_wikidata_entity_mock,
    ):
        DraftLocation.objects.create(
            name='Draft Helsinki',
            description='',
            location_type='poi',
            wikidata_item='Q1757',
            latitude=60.0,
            longitude=24.0,
        )
        encoded = quote('https://www.wikidata.org/entity/Q1757', safe='')
        fetch_location_detail_mock.return_value = {
            'id': encoded,
            'uri': 'https://www.wikidata.org/entity/Q1757',
            'name': 'Helsinki (SPARQL)',
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
        self.assertEqual(response.data['name'], 'Helsinki (SPARQL)')
        self.assertNotEqual(response.data.get('source'), 'draft')
        self.assertEqual(
            response.data['image_url'],
            'https://commons.wikimedia.org/wiki/Special:FilePath/Helsinki_city_center.jpg',
        )
        fetch_wikidata_entity_mock.assert_called_once_with('Q1757', lang='fi')
