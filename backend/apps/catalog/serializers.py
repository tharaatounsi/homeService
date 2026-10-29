from rest_framework import serializers

from .models import Category


class CategorySerializer(serializers.ModelSerializer):
    technicians_count = serializers.SerializerMethodField(read_only=True)
    requests_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Category
        fields = ("id", "name", "slug", "description", "icon", "technicians_count", "requests_count")

    def get_technicians_count(self, obj):
        try:
            return obj.technicians.filter(is_approved=True).count()
        except Exception:
            return 0

    def get_requests_count(self, obj):
        try:
            return obj.servicerequest_set.count()
        except Exception:
            return 0
