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
    is_approved = models.BooleanField(default=False)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    rating_count = models.PositiveIntegerField(default=0)

    @property
    def latitude(self):
        return self.location.y if self.location else None

    @property
    def longitude(self):
        return self.location.x if self.location else None

    @property
    def is_complete(self):
        return bool(self.location is not None and self.categories.exists())

    def __str__(self):
        return f"Technicien {self.user.username}"


class AvailabilitySlot(models.Model):
    WEEKDAYS = [
        (0, "Lundi"),
        (1, "Mardi"),
        (2, "Mercredi"),
        (3, "Jeudi"),
        (4, "Vendredi"),
        (5, "Samedi"),
        (6, "Dimanche"),
    ]

    technician = models.ForeignKey(
        TechnicianProfile, on_delete=models.CASCADE, related_name="slots"
    )
    weekday = models.PositiveSmallIntegerField(choices=WEEKDAYS)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        ordering = ["weekday", "start_time"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_time__gt=models.F("start_time")),
                name="end_time_after_start_time",
            )
        ]

    def __str__(self):
        return f"{self.technician.user.username} - {self.get_weekday_display()}: {self.start_time} - {self.end_time}"
