from django.contrib.gis.geos import Point
from rest_framework import serializers

from apps.catalog.models import Category
from apps.catalog.serializers import CategorySerializer

from .models import RequestPhoto, ServiceRequest


class RequestPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequestPhoto
        fields = ("id", "image", "uploaded_at")


class ServiceRequestSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all())
    photos = RequestPhotoSerializer(many=True, read_only=True)
    latitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    longitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    lat = serializers.SerializerMethodField(read_only=True)
    lng = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ServiceRequest
        fields = (
            "id",
            "client",
            "technician",
            "category",
            "category_name",
            "description",
            "address",
            "latitude",
            "longitude",
            "lat",
            "lng",
            "status",
            "urgency",
            "estimated_price",
            "photos",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "client", "technician", "status", "estimated_price", "created_at", "updated_at")

    def get_lat(self, obj):
        return obj.location.y if obj.location else None

    def get_lng(self, obj):
        return obj.location.x if obj.location else None

    def create(self, validated_data):
        lat = validated_data.pop("latitude", None)
        lng = validated_data.pop("longitude", None)
        
        # Default fallback location (Tunis) if not provided
        if lat is not None and lng is not None:
            location = Point(x=float(lng), y=float(lat), srid=4326)
        else:
            location = Point(x=10.1815, y=36.8065, srid=4326)

        validated_data["location"] = location
        validated_data["client"] = self.context["request"].user
        
        request_obj = ServiceRequest.objects.create(**validated_data)

        # Handle uploaded images if passed in request.FILES
        request_files = self.context["request"].FILES.getlist("photos")
        for f in request_files:
            RequestPhoto.objects.create(request=request_obj, image=f)

        return request_obj
