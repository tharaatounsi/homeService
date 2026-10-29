from datetime import timedelta
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db import models, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import RequestStatusEvent, ServiceRequest
from .realtime import notify_request_closed, notify_status  


VALID_STATUS_TRANSITIONS = {
    ServiceRequest.Status.ACCEPTED: [ServiceRequest.Status.EN_ROUTE],
    ServiceRequest.Status.EN_ROUTE: [ServiceRequest.Status.IN_PROGRESS],
    ServiceRequest.Status.IN_PROGRESS: [ServiceRequest.Status.COMPLETED],
    ServiceRequest.Status.COMPLETED: [ServiceRequest.Status.PAID],
}


def find_matching_technicians(service_request: ServiceRequest):
    """
    Retourne les techniciens qui :
    - Sont approuvés et disponibles
    - Ont la catégorie demandée
    - Ont une position géographique renseignée
    - Sont situés à une distance <= leur rayon d'action (service_radius_km)
    """
    from apps.technicians.models import TechnicianProfile

    if not service_request.location:
        return TechnicianProfile.objects.none()

    return (
        TechnicianProfile.objects.filter(
            is_approved=True,
            is_available=True,
            categories=service_request.category,
            location__isnull=False,
        )
        .annotate(distance=Distance("location", service_request.location))
        .filter(distance__lte=F("service_radius_km") * 1000)
        .order_by("distance")
        .select_related("user")
        .prefetch_related("categories")
    )


def get_available_missions_for_technician(technician_user, all_zones: bool = False):
    """
    Retourne les demandes en attente (status=pending) éligibles pour le technicien :
    - Catégories de métier correspondant
    - Situées dans le rayon d'action du technicien (ou toutes zones si all_zones=True)
    - Annotées avec la distance précise
    """
    profile = getattr(technician_user, "technician_profile", None)
    qs = ServiceRequest.objects.filter(status=ServiceRequest.Status.PENDING)

    if not profile or not profile.is_approved:
        return ServiceRequest.objects.none()

    if profile.categories.exists():
        qs = qs.filter(category__in=profile.categories.all())
    else:
        return ServiceRequest.objects.none()

    if profile.location:
        qs = qs.annotate(distance=Distance("location", profile.location))
        if not all_zones:
            radius = D(km=profile.service_radius_km)
            qs = qs.filter(location__dwithin=(profile.location, radius))
        qs = qs.order_by("distance", "-created_at")
    else:
        qs = qs.order_by("-created_at")

    return qs.select_related("category", "client").prefetch_related("photos", "events")


@transaction.atomic
def expire_unassigned_requests(max_age_hours: int = 24) -> int:
    """
    Passe en 'cancelled' les demandes toujours en attente après max_age_hours.
    Crée un RequestStatusEvent d'audit pour chaque mission expirée.
    """
    threshold = timezone.now() - timedelta(hours=max_age_hours)
    pending_expired = ServiceRequest.objects.filter(
        status=ServiceRequest.Status.PENDING,
        created_at__lte=threshold,
    ).select_for_update()

    count = 0
    for req in pending_expired:
        old_status = req.status
        req.status = ServiceRequest.Status.CANCELLED
        req.save(update_fields=["status", "updated_at"])
        RequestStatusEvent.objects.create(
            request=req,
            from_status=old_status,
            to_status=ServiceRequest.Status.CANCELLED,
            actor=None,
            note="Expirée : aucun prestataire n'a accepté dans le délai imparti.",
        )
        notify_status(req)  # NOUVEAU
        notify_request_closed(req)  # NOUVEAU
        count += 1
    return count


@transaction.atomic
def accept_request(service_request: ServiceRequest, technician_user) -> ServiceRequest:
    """Un technicien approuvé accepte une mission en attente."""
    # NOUVEAU : verrou pour éviter que deux techniciens acceptent en même temps
    service_request = ServiceRequest.objects.select_for_update().get(pk=service_request.pk)

    if service_request.status != ServiceRequest.Status.PENDING:
        raise ValidationError({"detail": "Cette demande n'est plus en attente d'attribution."})

    profile = getattr(technician_user, "technician_profile", None)
    if not profile or not profile.is_approved:
        raise PermissionDenied("Votre profil technicien doit être approuvé pour accepter des missions.")

    old_status = service_request.status
    service_request.technician = technician_user
    service_request.status = ServiceRequest.Status.ACCEPTED
    service_request.save(update_fields=["technician", "status", "updated_at"])

    RequestStatusEvent.objects.create(
        request=service_request,
        from_status=old_status,
        to_status=ServiceRequest.Status.ACCEPTED,
        actor=technician_user,
        note="Mission acceptée par le technicien",
    )
    notify_status(service_request)  
    notify_request_closed(service_request, exclude_user_id=technician_user.id)  
    return service_request


@transaction.atomic
def cancel_request(service_request: ServiceRequest, user) -> ServiceRequest:
    """Le client propriétaire ou un admin annule la demande."""
    is_client = service_request.client == user
    is_admin = getattr(user, "role", "") == "admin" or user.is_staff or user.is_superuser

    if not (is_client or is_admin):
        raise PermissionDenied("Vous n'êtes pas autorisé à annuler cette mission.")

    if service_request.status in [
        ServiceRequest.Status.IN_PROGRESS,
        ServiceRequest.Status.COMPLETED,
        ServiceRequest.Status.PAID,
        ServiceRequest.Status.CANCELLED,
    ]:
        raise ValidationError(
            {"detail": f"Impossible d'annuler une mission au statut '{service_request.get_status_display()}'."}
        )

    old_status = service_request.status
    service_request.status = ServiceRequest.Status.CANCELLED
    service_request.save(update_fields=["status", "updated_at"])

    RequestStatusEvent.objects.create(
        request=service_request,
        from_status=old_status,
        to_status=ServiceRequest.Status.CANCELLED,
        actor=user,
        note="Mission annulée",
    )
    notify_status(service_request)  # NOUVEAU
    if old_status == ServiceRequest.Status.PENDING:  # NOUVEAU
        notify_request_closed(service_request)  # NOUVEAU
    return service_request


@transaction.atomic
def update_status(service_request: ServiceRequest, technician_user, new_status: str) -> ServiceRequest:
    """Le technicien assigné fait avancer le statut de sa mission."""
    if service_request.technician != technician_user:
        raise PermissionDenied("Seul le technicien assigné à cette mission peut modifier son statut.")

    allowed = VALID_STATUS_TRANSITIONS.get(service_request.status, [])
    if new_status not in allowed:
        raise ValidationError({
            "detail": f"Transition invalide : impossible de passer de '{service_request.status}' à '{new_status}'."
        })

    old_status = service_request.status
    service_request.status = new_status
    service_request.save(update_fields=["status", "updated_at"])

    RequestStatusEvent.objects.create(
        request=service_request,
        from_status=old_status,
        to_status=new_status,
        actor=technician_user,
    )
    notify_status(service_request) 
    return service_request