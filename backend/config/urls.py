from django.contrib import admin
from django.contrib.auth.views import LogoutView
from django.urls import include, path, re_path
from django.views.generic import RedirectView

from ui.views import FrontendAppView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/', include('social_django.urls', namespace='social')),
    re_path(
        r'^oauth/(?P<path>.*)$',
        RedirectView.as_view(url='/auth/%(path)s', query_string=True, permanent=False),
    ),
    path('api/', include('locations.urls')),
    path('', FrontendAppView.as_view(), name='frontend-app'),
]
