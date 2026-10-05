from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models


class ServiceRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        ACCEPTED = "accepted", "Acceptée"
        EN_ROUTE = "en_route", "Technicien en route"
        IN_PROGRESS = "in_progress", "En cours"
        COMPLETED = "completed", "Terminée"
        PAID = "paid", "Payée"
        CANCELLED = "cancelled", "Annulée"

    class Urgency(models.TextChoices):
        LOW = "low", "Faible"
        MEDIUM = "medium", "Moyenne"
        HIGH = "high", "Élevée"
        CRITICAL = "critical", "Critique"

    client = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="requests_made"
    )
    technician = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="requests_received",
    )
    category = models.ForeignKey("catalog.Category", on_delete=models.PROTECT)
    description = models.TextField()
    address = models.CharField(max_length=255, blank=True)
    location = gis_models.PointField(geography=True, srid=4326)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    # Renseignés plus tard par l'IA (Sprints 9 et 10) ou par les règles de secours.
    urgency = models.CharField(max_length=20, choices=Urgency.choices, default=Urgency.MEDIUM)
    estimated_price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Demande #{self.pk} - {self.category} ({self.status})"


class RequestPhoto(models.Model):
    request = models.ForeignKey(ServiceRequest, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="requests/%Y/%m/")
    uploaded_at = models.DateTimeField(auto_now_add=True)
