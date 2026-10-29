from django.db import transaction

from apps.catalog.models import Category
from apps.technicians.services import create_profile

from .models import User



@transaction.atomic
def register_user(validated_data: dict) -> User:
    """Crée un utilisateur et son profil technicien si le rôle est technicien."""
    category_slug = validated_data.pop("category_slug", None)
    password = validated_data.pop("password")
    user = User.objects.create_user(password=password, **validated_data)
    if user.role == User.Role.TECHNICIAN:
        profile = create_profile(user)
        if category_slug:
            cat = Category.objects.filter(slug=category_slug).first()
            if cat:
                profile.categories.add(cat)
    return user