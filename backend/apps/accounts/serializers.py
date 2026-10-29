from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from django.contrib.gis.geos import Point
from .models import Address, User

from .services import register_user


class UserSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    last_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    requests_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "phone",
            "date_joined",
            "is_active",
            "requests_count",
        )
        read_only_fields = ("id", "email", "role", "date_joined", "requests_count")

    def get_requests_count(self, obj):
        try:
            if obj.role == User.Role.CLIENT:
                return obj.requests_made.count()
            elif obj.role == User.Role.TECHNICIAN:
                return obj.requests_received.count()
        except Exception:
            pass
        return 0

    def validate_first_name(self, value):
        return value or ""

    def validate_last_name(self, value):
        return value or ""

    def validate_phone(self, value):
        return value or ""


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    role = serializers.ChoiceField(
        choices=[(User.Role.CLIENT, "Client"), (User.Role.TECHNICIAN, "Technicien")],
        default=User.Role.CLIENT,
    )

    category_slug = serializers.CharField(required=False, write_only=True, allow_blank=True, default="")

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "role", "phone", "category_slug")


    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet email.")
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        return register_user(validated_data)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Connexion par email ; ajoute le rôle dans le token et l'utilisateur dans la réponse."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class AddressSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    longitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    lat = serializers.FloatField(source="latitude", read_only=True)
    lng = serializers.FloatField(source="longitude", read_only=True)

    class Meta:
        model = Address
        fields = (
            "id",
            "label",
            "address",
            "city",
            "postal_code",
            "notes",
            "latitude",
            "longitude",
            "lat",
            "lng",
            "is_default",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        lat = validated_data.pop("latitude", None)
        lng = validated_data.pop("longitude", None)
        if lat is not None and lng is not None:
            validated_data["location"] = Point(x=float(lng), y=float(lat), srid=4326)
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        lat = validated_data.pop("latitude", None)
        lng = validated_data.pop("longitude", None)
        if lat is not None and lng is not None:
            instance.location = Point(x=float(lng), y=float(lat), srid=4326)
        elif lat is None and lng is None and ("latitude" in self.initial_data and "longitude" in self.initial_data):
            instance.location = None
        return super().update(instance, validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value