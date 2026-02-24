from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles.views import serve as staticfiles_serve
from django.urls import path, re_path

from ui.views import FrontendAppView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', FrontendAppView.as_view(), name='frontend-app'),
]

if settings.DEBUG:
    urlpatterns.insert(1, re_path(r'^static/(?P<path>.*)$', staticfiles_serve, {'insecure': True}))
