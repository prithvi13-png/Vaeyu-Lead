import logging

from celery import shared_task
from celery.exceptions import MaxRetriesExceededError
from django.db import transaction

from .models import ActivityLog, Lead
from .notifications import notify_new_lead, send_enquiry_fallback_alert

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=5, default_retry_delay=60)
def send_new_lead_notification_task(self, lead_id):
    try:
        lead = Lead.objects.select_related("owner").get(id=lead_id)
    except Lead.DoesNotExist:
        logger.warning("Lead %s no longer exists, skipping notification", lead_id)
        return

    try:
        notify_new_lead(lead)
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=5)
def create_lead_from_enquiry_task(self, lead_fields, activity_detail, payload):
    """Retries saving a website enquiry that failed on the initial request.

    Ensures FR-1.5 (no lead is lost): if every retry fails, falls back to
    emailing LEAD_FALLBACK_ALERT_EMAIL with the original payload.
    """
    try:
        with transaction.atomic():
            lead = Lead.objects.create(**lead_fields)
            ActivityLog.objects.create(
                lead=lead,
                actor=None,
                action=ActivityLog.Action.CREATED,
                detail=activity_detail,
            )
    except Exception as exc:
        logger.exception("Retry %s failed to save website enquiry", self.request.retries)
        try:
            raise self.retry(exc=exc, countdown=min(60 * 2**self.request.retries, 3600))
        except MaxRetriesExceededError:
            send_enquiry_fallback_alert_task.delay(payload, repr(exc))
        return

    if not lead.is_spam:
        send_new_lead_notification_task.delay(str(lead.id))


@shared_task
def send_enquiry_fallback_alert_task(payload, error):
    send_enquiry_fallback_alert(payload, error)
