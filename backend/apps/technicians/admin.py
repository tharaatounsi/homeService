from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin

from .models import TechnicianProfile


@admin.register(TechnicianProfile)
class TechnicianProfileAdmin(GISModelAdmin):
    list_display = ("user", "experience_years", "is_available", "rating_avg")
    list_filter = ("is_available", "categories")
