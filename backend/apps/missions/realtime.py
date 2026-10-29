import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

logger = logging.getLogger(__name__)


def _group_send(group, event_type, data):
    try:
        async_to_sync(get_channel_layer().group_send)(
            group, {"type": event_type, "data": data}
        )
    except Exception:  # Redis indisponible : ne jamais casser la requête HTTP
        logger.exception("Échec de l'envoi WebSocket vers %s", group)


def _payload(req):
    return {
        "id": req.pk,
        "status": req.status,
        "status_display": req.get_status_display(),
        "category": req.category_id,
        "urgency": req.urgency,
        "updated_at": req.updated_at.isoformat(),
    }


def notify_status(req):
    """Prévient le client (et le technicien assigné) d'un changement de statut."""
    data = _payload(req)

    def _send():
        _group_send(f"user_{req.client_id}", "request.status", data)
        if req.technician_id:
            _group_send(f"user_{req.technician_id}", "request.status", data)

    transaction.on_commit(_send)


def notify_new_request(req):
    """Alerte chaque technicien éligible (approuvé, disponible, dans son rayon)."""
    base = {
        **_payload(req),
        "description": req.description[:140],
        "address": req.address,
        "latitude": req.latitude,
        "longitude": req.longitude,
    }

    def _send():
        from .services import find_matching_technicians

        for profile in find_matching_technicians(req):
            dist = getattr(profile, "distance", None)
            data = {**base, "distance_km": round(dist.km, 1) if dist else None}
            _group_send(f"user_{profile.user_id}", "request.new", data)

    transaction.on_commit(_send)


def notify_request_closed(req, exclude_user_id=None):
    """Retire la demande des tableaux de bord des techniciens éligibles."""
    data = {"id": req.pk}

    def _send():
        from .services import find_matching_technicians

        for profile in find_matching_technicians(req):
            if profile.user_id != exclude_user_id:
                _group_send(f"user_{profile.user_id}", "request.closed", data)

    transaction.on_commit(_send)