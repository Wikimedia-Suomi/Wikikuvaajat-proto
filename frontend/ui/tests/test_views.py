from django.test import TestCase
from django.urls import reverse


class FrontendViewsTests(TestCase):
    def test_frontend_app_served(self):
        response = self.client.get(reverse('frontend-app'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="app"')
        self.assertContains(response, 'window.APP_CONFIG')
        self.assertContains(response, 'apiBaseUrl')
