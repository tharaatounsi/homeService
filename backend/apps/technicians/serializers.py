from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.services import register_user
from apps.catalog.models import Category
from apps.catalog.serializers import CategorySerializer


from .models import AvailabilitySlot, TechnicianProfile


class TechnicianProfileSerializer(serializers.ModelSerializer):
    """Lecture complète du profil technicien."""

    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    latitude = serializers.FloatField(read_only=True)
    longitude = serializers.FloatField(read_only=True)
    is_complete = serializers.BooleanField(read_only=True)

    class Meta:
        model = TechnicianProfile
        fields = (
            "id",
            "username",
            "email",
            "phone",
            "bio",
            "experience_years",
            "categories",
            "latitude",
            "longitude",
            "service_radius_km",
            "is_available",
            "is_approved",
            "is_complete",
            "rating_avg",
            "rating_count",
        )
        read_only_fields = fields


class PublicTechnicianProfileSerializer(serializers.ModelSerializer):
    """Lecture publique du profil technicien pour l'accueil (sans email ni tel privé)."""

    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    category_list = CategorySerializer(source="categories", many=True, read_only=True)
    latitude = serializers.FloatField(read_only=True)
    longitude = serializers.FloatField(read_only=True)

    class Meta:
        model = TechnicianProfile
        fields = (
            "id",
            "user_id",
            "username",
            "bio",
            "experience_years",
            "category_list",
            "latitude",
            "longitude",
            "service_radius_km",
            "is_available",
            "rating_avg",
            "rating_count",
        )
        read_only_fields = fields


class TechnicianAdminCreateSerializer(serializers.Serializer):

    """Création directe d'un technicien par l'administrateur."""

    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    phone = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet email.")
        return value

    def create(self, validated_data):
        validated_data["role"] = User.Role.TECHNICIAN
        user = register_user(validated_data)
        return user.technician_profile


class ProfileUpdateSerializer(serializers.Serializer):
    """Champs modifiables par le technicien via PATCH /technicians/me/."""

    bio = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=2000)
    experience_years = serializers.IntegerField(
        required=False, allow_null=True, min_value=0, max_value=60
    )
    categories = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Category.objects.all(), required=False, allow_null=True
    )
    latitude = serializers.FloatField(
        required=False, allow_null=True, min_value=-90, max_value=90
    )
    longitude = serializers.FloatField(
        required=False, allow_null=True, min_value=-180, max_value=180
    )
    service_radius_km = serializers.IntegerField(
        required=False, allow_null=True, min_value=1, max_value=100
    )

    def validate(self, attrs):
        has_lat = "latitude" in attrs
        has_lng = "longitude" in attrs

        if has_lat != has_lng:
            raise serializers.ValidationError(
                {"detail": "La latitude et la longitude doivent être envoyées ensemble."}
            )

        if has_lat and (attrs["latitude"] is None) != (attrs["longitude"] is None):
            raise serializers.ValidationError(
                {"detail": "La latitude et la longitude doivent être toutes les deux renseignées ou toutes les deux null."}
            )

        return attrs


class StatusSerializer(serializers.Serializer):
    is_available = serializers.BooleanField()


class AvailabilitySlotSerializer(serializers.ModelSerializer):
    weekday = serializers.IntegerField(min_value=0, max_value=6)

    class Meta:
        model = AvailabilitySlot
        fields = ("weekday", "start_time", "end_time")

    def validate(self, attrs):
        if attrs["start_time"] >= attrs["end_time"]:
            raise serializers.ValidationError(
                {"detail": "L'heure de fin doit être strictly supérieure à l'heure de début."}
            )
        return attrs


class ScheduleSerializer(serializers.Serializer):
    slots = AvailabilitySlotSerializer(many=True)


class EmptySerializer(serializers.Serializer):
    pass