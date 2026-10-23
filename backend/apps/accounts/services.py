from django.db import transaction

from apps.technicians.services import create_profile

from .models import User


@transaction.atomic
def register_user(validated_data: dict) -> User:
    """Crée un utilisateur et son profil technicien si le rôle est technicien."""
    password = validated_data.pop("password")
    user = User.objects.create_user(password=password, **validated_data)
    if user.role == User.Role.TECHNICIAN:
        create_profile(user)
    return user