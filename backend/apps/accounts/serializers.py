from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User
from .services import register_user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "role", "phone")
        read_only_fields = ("id", "email", "role")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    role = serializers.ChoiceField(
        choices=[(User.Role.CLIENT, "Client"), (User.Role.TECHNICIAN, "Technicien")],
        default=User.Role.CLIENT,
    )

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "role", "phone")

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