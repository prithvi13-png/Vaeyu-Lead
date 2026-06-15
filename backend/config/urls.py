from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

from apps.leads.views import PublicEnquiryView
from apps.users.views import (
    CookieTokenRefreshView,
    EmailTokenObtainPairView,
    LogoutView,
    MeView,
)


def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/auth/token/", EmailTokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("api/auth/token/refresh/", CookieTokenRefreshView.as_view(), name="token-refresh"),
    path("api/auth/logout/", LogoutView.as_view(), name="logout"),
    path("api/auth/me/", MeView.as_view(), name="me"),
    path("api/", include("apps.leads.urls")),
    path("api/", include("apps.users.urls")),
    path("api/public/enquiries/", PublicEnquiryView.as_view(), name="public-enquiry"),
]
