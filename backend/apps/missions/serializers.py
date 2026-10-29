from django.contrib.gis.geos import Point
from rest_framework import serializers

from apps.accounts.models import User
from apps.catalog.models import Category
from apps.catalog.serializers import CategorySerializer

from .models import MissionMessage, RequestPhoto, RequestStatusEvent, ServiceRequest


class MissionMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.username", read_only=True)
    sender_email = serializers.EmailField(source="sender.email", read_only=True)
    sender_role = serializers.CharField(source="sender.role", read_only=True)
    recipient_name = serializers.CharField(source="recipient.username", read_only=True)
    recipient_email = serializers.EmailField(source="recipient.email", read_only=True)

    class Meta:
        model = MissionMessage
        fields = (
            "id",
            "request",
            "sender",
            "sender_name",
            "sender_email",
            "sender_role",
            "recipient",
            "recipient_name",
            "recipient_email",
            "content",
            "is_read",
            "created_at",
        )
        read_only_fields = (
            "id",
            "sender",
            "sender_name",
            "sender_email",
            "sender_role",
            "recipient_name",
            "recipient_email",
            "is_read",
            "created_at",
        )



class RequestPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequestPhoto
        fields = ("id", "image", "uploaded_at")


class RequestStatusEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.username", read_only=True)

    class Meta:
        model = RequestStatusEvent
        fields = ("id", "from_status", "to_status", "actor_name", "note", "created_at")


class ServiceRequestSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all())
    client_name = serializers.CharField(source="client.username", read_only=True)
    client_email = serializers.EmailField(source="client.email", read_only=True)
    client_phone = serializers.CharField(source="client.phone", read_only=True)
    technician_name = serializers.CharField(source="technician.username", read_only=True)
    technician_email = serializers.EmailField(source="technician.email", read_only=True)
    technician_phone = serializers.SerializerMethodField(read_only=True)
    technician_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    photos = RequestPhotoSerializer(many=True, read_only=True)
    events = RequestStatusEventSerializer(many=True, read_only=True)
    latitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    longitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    lat = serializers.SerializerMethodField(read_only=True)
    lng = serializers.SerializerMethodField(read_only=True)
    distance_km = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ServiceRequest
        fields = (
            "id",
            "client",
            "client_name",
            "client_email",
            "client_phone",
            "technician",
            "technician_id",
            "technician_name",
            "technician_email",
            "technician_phone",
            "category",
            "category_name",
            "description",
            "address",
            "latitude",
            "longitude",
            "lat",
            "lng",
            "distance_km",
            "status",
            "urgency",
            "estimated_price",
            "photos",
            "events",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "client", "technician", "status", "estimated_price", "created_at", "updated_at")

    def get_lat(self, obj):
        return obj.location.y if obj.location else None

    def get_lng(self, obj):
        return obj.location.x if obj.location else None

    def get_distance_km(self, obj):
        if hasattr(obj, "distance") and obj.distance is not None:
            return round(obj.distance.km, 1)
        return None

    def get_technician_phone(self, obj):
        if obj.technician:
            return obj.technician.phone or ""
        return None

    def create(self, validated_data):
        lat = validated_data.pop("latitude", None)
        lng = validated_data.pop("longitude", None)
        tech_id = validated_data.pop("technician_id", None)

        # Default fallback location if not provided
        if lat is not None and lng is not None:
            location = Point(x=float(lng), y=float(lat), srid=4326)
        else:
            location = Point(x=10.1815, y=36.8065, srid=4326)

        validated_data["location"] = location
        validated_data["client"] = self.context["request"].user

        target_tech = None
        if tech_id:
            target_tech = User.objects.filter(pk=tech_id, role=User.Role.TECHNICIAN).first()
            if not target_tech:
                from apps.technicians.models import TechnicianProfile
                prof = TechnicianProfile.objects.filter(pk=tech_id).select_related("user").first()
                if prof:
                    target_tech = prof.user

        if target_tech:
            validated_data["technician"] = target_tech
            validated_data["status"] = ServiceRequest.Status.ACCEPTED

        request_obj = ServiceRequest.objects.create(**validated_data)

        if target_tech:
            RequestStatusEvent.objects.create(
                request=request_obj,
                from_status=ServiceRequest.Status.PENDING,
                to_status=ServiceRequest.Status.ACCEPTED,
                actor=self.context["request"].user,
                note=f"Demande assignée directement au technicien {target_tech.username}",
            )

        # Handle uploaded images if passed in request.FILES
        request_files = self.context["request"].FILES.getlist("photos")
        for f in request_files:
            RequestPhoto.objects.create(request=request_obj, image=f)

        return request_obj


class MatchedTechnicianSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="user.id", read_only=True)
    profile_id = serializers.IntegerField(source="id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    bio = serializers.CharField(read_only=True)
    experience_years = serializers.IntegerField(read_only=True)
    rating_avg = serializers.DecimalField(max_digits=3, decimal_places=2, read_only=True)
    rating_count = serializers.IntegerField(read_only=True)
    service_radius_km = serializers.IntegerField(read_only=True)
    distance_km = serializers.SerializerMethodField(read_only=True)

    def get_distance_km(self, obj):
        if hasattr(obj, "distance") and obj.distance is not None:
            return round(obj.distance.km, 1)
        return None


class StatusTransitionSerializer(serializers.Serializer):
    """Pour valider le nouveau statut envoyé par le technicien."""
    status = serializers.ChoiceField(choices=ServiceRequest.Status.choices)

