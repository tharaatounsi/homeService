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
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return f"Demande #{self.pk} - {self.category} ({self.status})"

    @property
    def latitude(self):
        return self.location.y if self.location else None

    @property
    def longitude(self):
        return self.location.x if self.location else None


class RequestPhoto(models.Model):
    request = models.ForeignKey(ServiceRequest, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="requests/%Y/%m/")
    uploaded_at = models.DateTimeField(auto_now_add=True)


class RequestStatusEvent(models.Model):
    """Historique des changements de statut (frise de suivi, litiges, audit)."""

    request = models.ForeignKey(ServiceRequest, on_delete=models.CASCADE, related_name="events")
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, choices=ServiceRequest.Status.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+",
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"#{self.request_id}: {self.from_status or '∅'} → {self.to_status}"


class MissionMessage(models.Model):
    """Messagerie directe entre le client et le technicien (avec ou sans mission associée)."""

    request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="messages",
        null=True,
        blank=True,
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_mission_messages",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_mission_messages",
        null=True,
        blank=True,
    )
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Message de {self.sender_id} vers {self.recipient_id} (mission #{self.request_id})"
