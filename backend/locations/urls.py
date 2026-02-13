from django.urls import path

from .views import ApiLocationDetailView, ApiLocationsView, FrontendView

urlpatterns = [
    path("", FrontendView.as_view(), name="frontend"),
    path("api/locations/", ApiLocationsView.as_view(), name="locations-list"),
    path("api/locations/<str:location_id>/", ApiLocationDetailView.as_view(), name="locations-detail"),
]
