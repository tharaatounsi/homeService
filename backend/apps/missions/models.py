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


class MissionQuote(models.Model):
    """Devis établi sur place par le technicien pour approbation par le client."""

    class Status(models.TextChoices):
        PENDING = "pending", "En attente d'approbation"
        ACCEPTED = "accepted", "Accepté par le client"
        REJECTED = "rejected", "Refusé par le client"

    request = models.OneToOneField(
        ServiceRequest, on_delete=models.CASCADE, related_name="quote"
    )
    labor_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    parts_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=8, decimal_places=2)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.total_price = (self.labor_price or 0) + (self.parts_price or 0)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Devis mission #{self.request_id} : {self.total_price} TND ({self.status})"


class MissionPayment(models.Model):
    """Enregistrement du règlement (en ligne ou en espèces) avec traçabilité et commission."""

    class Method(models.TextChoices):
        CASH = "cash", "Espèces (sur place)"
        ONLINE = "online", "En ligne (Carte bancaire / Konnect)"

    class Status(models.TextChoices):
        COMPLETED = "completed", "Payé"
        PENDING = "pending", "En attente"
        FAILED = "failed", "Échoué"

    request = models.OneToOneField(
        ServiceRequest, on_delete=models.CASCADE, related_name="payment"
    )
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.CASH)
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    platform_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    technician_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    transaction_id = models.CharField(max_length=64, unique=True)
    card_last4 = models.CharField(max_length=4, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.COMPLETED)
    paid_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.platform_fee:
            self.platform_fee = round(float(self.amount) * 0.10, 2)
        if not self.technician_amount:
            self.technician_amount = round(float(self.amount) - float(self.platform_fee), 2)
        if not self.transaction_id:
            import uuid
            self.transaction_id = f"TXN-SH-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Paiement #{self.transaction_id} : {self.amount} TND ({self.method})"


class MissionReview(models.Model):
    """Évaluation client (1 à 5 étoiles, tags, commentaire) et réponse du technicien (Sprint 8)."""

    request = models.OneToOneField(
        ServiceRequest, on_delete=models.CASCADE, related_name="review"
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews_given"
    )
    technician = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews_received"
    )
    rating = models.PositiveSmallIntegerField(default=5)
    comment = models.TextField(blank=True)
    tags = models.CharField(max_length=255, blank=True)
    technician_reply = models.TextField(blank=True)
    replied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Avis #{self.id} ({self.rating}/5) pour {self.technician}"


def recalculate_technician_rating(technician_user):
    """Recalcule rating_avg et rating_count sur TechnicianProfile."""
    if not technician_user:
        return
    from django.db.models import Avg, Count
    from apps.technicians.models import TechnicianProfile

    agg = MissionReview.objects.filter(technician=technician_user).aggregate(
        avg_r=Avg("rating"), cnt=Count("id")
    )
    avg_val = round(float(agg["avg_r"] or 0.0), 2)
    cnt_val = int(agg["cnt"] or 0)
    TechnicianProfile.objects.filter(user=technician_user).update(
        rating_avg=avg_val, rating_count=cnt_val
    )


class MissionDispute(models.Model):
    """Réclamation SAV / Litige ouvert sur une mission et arbitré par l'Admin (Sprint 8)."""

    class Reason(models.TextChoices):
        QUALITY = "quality", "Qualité de l'intervention / Panne non résolue"
        PRICING = "pricing", "Écart de prix / Contestation du devis"
        DELAY = "delay", "Retard important / Absence du prestataire"
        BEHAVIOR = "behavior", "Comportement inapproprié"
        OTHER = "other", "Autre motif"

    class Status(models.TextChoices):
        OPEN = "open", "Ouvert (En attente d'examen)"
        IN_REVIEW = "in_review", "En médiation Admin"
        RESOLVED = "resolved", "Résolu"
        REJECTED = "rejected", "Clôturé sans suite"

    request = models.OneToOneField(
        ServiceRequest, on_delete=models.CASCADE, related_name="dispute"
    )
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="disputes_opened"
    )
    reason = models.CharField(max_length=30, choices=Reason.choices, default=Reason.QUALITY)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    admin_resolution_note = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="disputes_resolved",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Litige #{self.id} (Mission #{self.request_id}) - {self.status}"


