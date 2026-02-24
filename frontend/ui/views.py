from django.conf import settings
from django.views.generic import TemplateView


class FrontendAppView(TemplateView):
    template_name = 'index.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['api_base_url'] = settings.API_BASE_URL
        return context
