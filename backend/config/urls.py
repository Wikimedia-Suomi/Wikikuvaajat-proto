from django.conf import settings
from django.contrib import admin
from django.contrib.auth.views import LogoutView
from django.contrib.staticfiles.views import serve as staticfiles_serve
from django.urls import include, path, re_path
from django.views.generic import RedirectView

from locations.views import LocalDevAccessTokenLoginAPIView, MediaWikiLoginAPIView
from ui.views import FrontendAppView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('auth/login/mediawiki/', MediaWikiLoginAPIView.as_view(), name='mediawiki-login'),
    path('auth/login/local/', LocalDevAccessTokenLoginAPIView.as_view(), name='local-access-login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/', include('social_django.urls', namespace='social')),
    re_path(
        r'^oauth/(?P<path>.*)$',
        RedirectView.as_view(url='/auth/%(path)s', query_string=True, permanent=False),
    ),
    path('api/', include('locations.urls')),
    path('', FrontendAppView.as_view(), name='frontend-app'),
]

if settings.DEBUG:
    urlpatterns.insert(1, re_path(r'^static/(?P<path>.*)$', staticfiles_serve, {'insecure': True}))
