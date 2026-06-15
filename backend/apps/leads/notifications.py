from django.conf import settings
from django.core.mail import send_mail

from apps.users.models import User


def notify_new_lead(lead):
    """Email the lead's owner, or all active admins if unassigned."""
    if lead.owner_id and lead.owner.email:
        recipients = [lead.owner.email]
    else:
        recipients = list(
            User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list(
                "email", flat=True
            )
        )

    if not recipients:
        return

    send_mail(
        subject=f"New lead: {lead.full_name}",
        message=(
            f"A new lead has been captured.\n\n"
            f"Name: {lead.full_name}\n"
            f"Email: {lead.email}\n"
            f"Phone: {lead.phone}\n"
            f"Source: {lead.get_source_display()}\n"
            f"Message: {lead.message}\n"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=recipients,
    )


def send_enquiry_fallback_alert(payload, error):
    """Best-effort alert when a website enquiry fails to save as a lead."""
    if not settings.LEAD_FALLBACK_ALERT_EMAIL:
        return

    send_mail(
        subject="Website enquiry failed to save — manual follow-up required",
        message=(
            "A website enquiry could not be saved as a lead and needs "
            "manual follow-up.\n\n"
            f"Error: {error}\n\n"
            f"Payload: {payload}\n"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings.LEAD_FALLBACK_ALERT_EMAIL],
    )
