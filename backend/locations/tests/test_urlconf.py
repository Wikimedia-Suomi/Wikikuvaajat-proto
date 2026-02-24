from django.contrib.staticfiles.views import serve as staticfiles_serve
from django.urls import re_path

from config.urls import urlpatterns as base_urlpatterns

urlpatterns = [
    re_path(r'^static/(?P<path>.*)$', staticfiles_serve, {'insecure': True}),
    *base_urlpatterns,
]
