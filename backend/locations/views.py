from __future__ import annotations

from django.http import Http404, JsonResponse
from django.views import View
from django.views.generic import TemplateView

from .services import fetch_locations


class ApiLocationsView(View):
    def get(self, request):
        locations = fetch_locations()
        payload = [
            {
                "id": location.identifier,
                "label": location.label,
                "latitude": location.latitude,
                "longitude": location.longitude,
            }
            for location in locations
        ]
        return JsonResponse({"results": payload})


class ApiLocationDetailView(View):
    def get(self, request, location_id: str):
        locations = fetch_locations()
        for location in locations:
            if location.identifier == location_id:
                return JsonResponse(
                    {
                        "id": location.identifier,
                        "label": location.label,
                        "latitude": location.latitude,
                        "longitude": location.longitude,
                    }
                )
        raise Http404("Location not found")


class FrontendView(TemplateView):
    template_name = "frontend/index.html"
