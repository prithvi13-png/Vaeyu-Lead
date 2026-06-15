from rest_framework.permissions import BasePermission

from .models import User


class IsAdmin(BasePermission):
    """Allows access only to users with the admin/manager role."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.role == User.Role.ADMIN or user.is_superuser)
        )
