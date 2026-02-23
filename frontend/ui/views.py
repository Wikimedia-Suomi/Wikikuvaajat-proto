from django.conf import settings
from django.views.generic import TemplateView


class FrontendAppView(TemplateView):
    template_name = 'index.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['api_base_url'] = settings.API_BASE_URL
        context['sparql_default_endpoint'] = getattr(settings, 'SPARQL_ENDPOINT', '')
        context['sparql_predefined_endpoints'] = getattr(settings, 'SPARQL_PREDEFINED_ENDPOINTS', [])
        context['sparql_osm_endpoint'] = getattr(settings, 'SPARQL_OSM_ENDPOINT', '')
        return context
