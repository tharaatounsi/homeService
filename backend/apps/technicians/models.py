from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models


class TechnicianProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="technician_profile"
    )
    categories = models.ManyToManyField("catalog.Category", related_name="technicians", blank=True)
    bio = models.TextField(blank=True)
    experience_years = models.PositiveSmallIntegerField(default=0)
    # Position actuelle ou point de référence du technicien (SRID 4326, géographie).
    location = gis_models.PointField(geography=True, srid=4326, null=True, blank=True)
    service_radius_km = models.PositiveSmallIntegerField(default=10)
    is_available = models.BooleanField(default=False)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    rating_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Technicien {self.user.username}"
