from django.conf import settings
from django.utils.crypto import constant_time_compare
from rest_framework.permissions import BasePermission

ENQUIRY_TOKEN_HEADER = "X-Enquiry-Token"


class HasEnquiryToken(BasePermission):
    """Shared-secret check for the public website enquiry capture endpoint."""

    def has_permission(self, request, view):
        expected = settings.WEBSITE_ENQUIRY_API_TOKEN
        if not expected:
            return False
        provided = request.headers.get(ENQUIRY_TOKEN_HEADER, "")
        return constant_time_compare(provided, expected)
