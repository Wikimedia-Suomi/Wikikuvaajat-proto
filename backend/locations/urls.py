from django.urls import path

from .views import (
    AuthStatusAPIView,
    CitoidMetadataAPIView,
    CommonsCategorySearchAPIView,
    CommonsImageUploadAPIView,
    DraftLocationDetailAPIView,
    DraftLocationListCreateAPIView,
    GeocodeSearchAPIView,
    GeocodeReverseAPIView,
    LocationChildrenAPIView,
    LocationDetailAPIView,
    LocationListAPIView,
    OSMFeatureLatestAPIView,
    WikidataAddExistingAPIView,
    WikidataCreateItemAPIView,
    WikidataEntityAPIView,
    WikidataSearchAPIView,
)

urlpatterns = [
    path('auth/status/', AuthStatusAPIView.as_view(), name='auth-status'),
    path('drafts/', DraftLocationListCreateAPIView.as_view(), name='draft-location-list-create'),
    path('drafts/<int:draft_id>/', DraftLocationDetailAPIView.as_view(), name='draft-location-detail'),
    path('wikidata/search/', WikidataSearchAPIView.as_view(), name='wikidata-search'),
    path('wikidata/entities/<str:entity_id>/', WikidataEntityAPIView.as_view(), name='wikidata-entity'),
    path('wikidata/add-existing/', WikidataAddExistingAPIView.as_view(), name='wikidata-add-existing'),
    path('wikidata/create/', WikidataCreateItemAPIView.as_view(), name='wikidata-create-item'),
    path('citoid/metadata/', CitoidMetadataAPIView.as_view(), name='citoid-metadata'),
    path('commons/categories/', CommonsCategorySearchAPIView.as_view(), name='commons-category-search'),
    path('commons/upload/', CommonsImageUploadAPIView.as_view(), name='commons-upload'),
    path('geocode/search/', GeocodeSearchAPIView.as_view(), name='geocode-search'),
    path('geocode/reverse/', GeocodeReverseAPIView.as_view(), name='geocode-reverse'),
    path(
        'osm/features/<str:feature_type>/<int:feature_id>/latest/',
        OSMFeatureLatestAPIView.as_view(),
        name='osm-feature-latest',
    ),
    path('locations/', LocationListAPIView.as_view(), name='location-list'),
    path('locations/children/', LocationChildrenAPIView.as_view(), name='location-children'),
    path('locations/<path:location_id>/children/', LocationChildrenAPIView.as_view(), name='location-children-by-id'),
    path('locations/<path:location_id>/', LocationDetailAPIView.as_view(), name='location-detail'),
]
