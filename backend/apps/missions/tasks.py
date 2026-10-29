from celery import shared_task
import logging

from .models import RequestStatusEvent, ServiceRequest
from .services import expire_unassigned_requests

logger = logging.getLogger(__name__)


@shared_task(name="missions.expire_unassigned_requests")
def expire_unassigned_requests_task(max_age_hours: int = 24) -> int:
    """Tâche périodique Celery : annule les demandes non assignées après délai."""
    count = expire_unassigned_requests(max_age_hours=max_age_hours)
    logger.info("Celery: %d demandes expirées annulées.", count)
    return count


@shared_task(name="missions.expire_single_request")
def expire_single_request_task(request_id: int) -> bool:
    """Tâche Celery différée : expire une mission précise si toujours sans réponse."""
    try:
        req = ServiceRequest.objects.get(id=request_id, status=ServiceRequest.Status.PENDING)
        old_status = req.status
        req.status = ServiceRequest.Status.CANCELLED
        req.save(update_fields=["status", "updated_at"])
        RequestStatusEvent.objects.create(
            request=req,
            from_status=old_status,
            to_status=ServiceRequest.Status.CANCELLED,
            actor=None,
            note="Expirée automatiquement par le système : aucun technicien n'a accepté l'intervention.",
        )
        logger.info("Mission #%d expirée automatiquement.", request_id)
        return True
    except ServiceRequest.DoesNotExist:
        return False
