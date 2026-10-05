from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin

from .models import RequestPhoto, ServiceRequest


class RequestPhotoInline(admin.TabularInline):
    model = RequestPhoto
    extra = 0


@admin.register(ServiceRequest)
class ServiceRequestAdmin(GISModelAdmin):
    list_display = ("id", "category", "client", "technician", "status", "urgency", "created_at")
    list_filter = ("status", "urgency", "category")
    inlines = [RequestPhotoInline]
