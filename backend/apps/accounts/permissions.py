from rest_framework.permissions import BasePermission

from .models import User


class HasRole(BasePermission):
    """Autorise barka l utilisateur eli aandhom role"""

    allowed_roles = ()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in self.allowed_roles)


class IsClient(HasRole):
    allowed_roles = (User.Role.CLIENT,)


class IsTechnician(HasRole):
    allowed_roles = (User.Role.TECHNICIAN,)


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.role == User.Role.ADMIN or user.is_staff or user.is_superuser)
        )
