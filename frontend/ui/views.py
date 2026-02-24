from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from django.views.decorators.csrf import ensure_csrf_cookie


@method_decorator(ensure_csrf_cookie, name='dispatch')
class FrontendAppView(TemplateView):
    template_name = 'index.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['api_base_url'] = settings.API_BASE_URL
        return context
