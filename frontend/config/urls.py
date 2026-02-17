from django.contrib import admin
from django.urls import path

from ui.views import FrontendAppView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', FrontendAppView.as_view(), name='frontend-app'),
]
