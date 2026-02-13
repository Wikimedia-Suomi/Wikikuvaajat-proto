from unittest.mock import Mock, patch

from django.test import TestCase
from django.urls import reverse

from .services import Location, fetch_locations, parse_point


class SparqlServiceTests(TestCase):
    def test_parse_point(self):
        latitude, longitude = parse_point("Point(24.9384 60.1699)")
        self.assertEqual(latitude, 60.1699)
        self.assertEqual(longitude, 24.9384)

    @patch("locations.services.requests.get")
    def test_fetch_locations(self, mock_get):
        mock_response = Mock()
        mock_response.json.return_value = {
            "results": {
                "bindings": [
                    {
                        "item": {"value": "http://www.wikidata.org/entity/Q1757"},
                        "p625": {"value": "Point(24.9384 60.1699)"},
                    }
                ]
            }
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        results = fetch_locations()

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].identifier, "Q1757")
        self.assertEqual(results[0].label, "Q1757")


class ApiViewTests(TestCase):
    @patch("locations.views.fetch_locations")
    def test_locations_list_view(self, mock_fetch_locations):
        mock_fetch_locations.return_value = [
            Location(identifier="Q1757", label="Helsinki", latitude=60.1699, longitude=24.9384)
        ]

        response = self.client.get(reverse("locations-list"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["results"][0]["id"], "Q1757")

    @patch("locations.views.fetch_locations")
    def test_location_detail_view(self, mock_fetch_locations):
        mock_fetch_locations.return_value = [
            Location(identifier="Q1757", label="Helsinki", latitude=60.1699, longitude=24.9384)
        ]

        response = self.client.get(reverse("locations-detail", kwargs={"location_id": "Q1757"}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["label"], "Helsinki")

    @patch("locations.views.fetch_locations")
    def test_location_detail_view_404(self, mock_fetch_locations):
        mock_fetch_locations.return_value = []

        response = self.client.get(reverse("locations-detail", kwargs={"location_id": "Q404"}))

        self.assertEqual(response.status_code, 404)
