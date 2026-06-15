from unittest.mock import patch

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import ActivityLog, Lead, Note


class LeadViewSetTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@vaeyu.local", password="password123", role=User.Role.ADMIN
        )
        self.rep = User.objects.create_user(
            email="rep@vaeyu.local", password="password123", role=User.Role.SALES_REP
        )
        self.other_rep = User.objects.create_user(
            email="other@vaeyu.local", password="password123", role=User.Role.SALES_REP
        )

    def test_list_requires_auth(self):
        response = self.client.get(reverse("lead-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_lead_writes_activity_log(self):
        self.client.force_authenticate(self.rep)
        response = self.client.post(
            reverse("lead-list"),
            {
                "full_name": "Jane Doe",
                "email": "jane@example.com",
                "phone": "",
                "company_name": "Acme",
                "message": "Interested",
                "source": Lead.Source.PHONE,
                "status": Lead.Status.NEW,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        lead = Lead.objects.get(id=response.data["id"])
        self.assertEqual(lead.full_name, "Jane Doe")
        self.assertEqual(
            lead.activity_log.filter(action=ActivityLog.Action.CREATED).count(), 1
        )

    def test_create_lead_requires_email_or_phone(self):
        self.client.force_authenticate(self.rep)
        response = self.client.post(
            reverse("lead-list"),
            {
                "full_name": "No Contact",
                "source": Lead.Source.PHONE,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_lead_cannot_use_website_form_source(self):
        self.client.force_authenticate(self.rep)
        response = self.client.post(
            reverse("lead-list"),
            {
                "full_name": "Jane Doe",
                "email": "jane@example.com",
                "source": Lead.Source.WEBSITE_FORM,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_status_change_writes_activity_log(self):
        lead = Lead.objects.create(
            full_name="Jane Doe", email="jane@example.com", source=Lead.Source.PHONE
        )
        self.client.force_authenticate(self.rep)
        response = self.client.patch(
            reverse("lead-detail", args=[lead.id]), {"status": Lead.Status.CONTACTED}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        lead.refresh_from_db()
        self.assertEqual(lead.status, Lead.Status.CONTACTED)
        log = lead.activity_log.get(action=ActivityLog.Action.STATUS_CHANGED)
        self.assertEqual(log.detail, {"from": Lead.Status.NEW, "to": Lead.Status.CONTACTED})

    def test_status_change_to_lost_requires_reason(self):
        lead = Lead.objects.create(
            full_name="Jane Doe", email="jane@example.com", source=Lead.Source.PHONE
        )
        self.client.force_authenticate(self.rep)
        response = self.client.patch(
            reverse("lead-detail", args=[lead.id]), {"status": Lead.Status.LOST}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_edit_writes_activity_log(self):
        lead = Lead.objects.create(
            full_name="Jane Doe", email="jane@example.com", source=Lead.Source.PHONE
        )
        self.client.force_authenticate(self.rep)
        response = self.client.patch(
            reverse("lead-detail", args=[lead.id]), {"company_name": "Acme Corp"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        log = lead.activity_log.get(action=ActivityLog.Action.EDITED)
        self.assertEqual(
            log.detail["company_name"], {"from": "", "to": "Acme Corp"}
        )

    def test_filter_by_status_and_source(self):
        Lead.objects.create(
            full_name="New Lead",
            email="new@example.com",
            source=Lead.Source.PHONE,
            status=Lead.Status.NEW,
        )
        Lead.objects.create(
            full_name="Contacted Lead",
            email="contacted@example.com",
            source=Lead.Source.REFERRAL,
            status=Lead.Status.CONTACTED,
        )
        self.client.force_authenticate(self.rep)

        response = self.client.get(reverse("lead-list"), {"status": Lead.Status.NEW})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item["full_name"] for item in response.data["results"]]
        self.assertEqual(names, ["New Lead"])

        response = self.client.get(reverse("lead-list"), {"source": Lead.Source.REFERRAL})
        names = [item["full_name"] for item in response.data["results"]]
        self.assertEqual(names, ["Contacted Lead"])

    def test_search_by_name_email_phone(self):
        Lead.objects.create(
            full_name="Alice Example",
            email="alice@example.com",
            phone="+15550001",
            source=Lead.Source.PHONE,
        )
        Lead.objects.create(
            full_name="Bob Sample",
            email="bob@example.com",
            phone="+15550002",
            source=Lead.Source.PHONE,
        )
        self.client.force_authenticate(self.rep)

        response = self.client.get(reverse("lead-list"), {"search": "Alice"})
        names = [item["full_name"] for item in response.data["results"]]
        self.assertEqual(names, ["Alice Example"])

        response = self.client.get(reverse("lead-list"), {"search": "+15550002"})
        names = [item["full_name"] for item in response.data["results"]]
        self.assertEqual(names, ["Bob Sample"])

    def test_archived_leads_hidden_by_default(self):
        Lead.objects.create(
            full_name="Archived Lead",
            email="archived@example.com",
            source=Lead.Source.PHONE,
            is_archived=True,
        )
        self.client.force_authenticate(self.rep)
        response = self.client.get(reverse("lead-list"))
        self.assertEqual(response.data["results"], [])

        response = self.client.get(reverse("lead-list"), {"is_archived": "true"})
        self.assertEqual(len(response.data["results"]), 1)

    def test_sales_rep_cannot_assign_lead(self):
        lead = Lead.objects.create(
            full_name="Jane Doe", email="jane@example.com", source=Lead.Source.PHONE
        )
        self.client.force_authenticate(self.rep)
        response = self.client.post(
            reverse("lead-assign", args=[lead.id]), {"owner_id": str(self.rep.id)}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_assign_lead(self):
        lead = Lead.objects.create(
            full_name="Jane Doe", email="jane@example.com", source=Lead.Source.PHONE
        )
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("lead-assign", args=[lead.id]), {"owner_id": str(self.rep.id)}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        lead.refresh_from_db()
        self.assertEqual(lead.owner, self.rep)
        log = lead.activity_log.get(action=ActivityLog.Action.ASSIGNED)
        self.assertEqual(log.detail, {"from": None, "to": self.rep.email})

    def test_admin_can_reassign_lead_to_unassigned(self):
        lead = Lead.objects.create(
            full_name="Jane Doe",
            email="jane@example.com",
            source=Lead.Source.PHONE,
            owner=self.rep,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("lead-assign", args=[lead.id]), {"owner_id": None}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        lead.refresh_from_db()
        self.assertIsNone(lead.owner)

    def test_sales_rep_cannot_archive_lead(self):
        lead = Lead.objects.create(
            full_name="Jane Doe", email="jane@example.com", source=Lead.Source.PHONE
        )
        self.client.force_authenticate(self.rep)
        response = self.client.post(reverse("lead-archive", args=[lead.id]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_archive_and_unarchive_lead(self):
        lead = Lead.objects.create(
            full_name="Jane Doe", email="jane@example.com", source=Lead.Source.PHONE
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(reverse("lead-archive", args=[lead.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead.refresh_from_db()
        self.assertTrue(lead.is_archived)

        response = self.client.post(reverse("lead-unarchive", args=[lead.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead.refresh_from_db()
        self.assertFalse(lead.is_archived)

    def test_add_note_writes_activity_log(self):
        lead = Lead.objects.create(
            full_name="Jane Doe", email="jane@example.com", source=Lead.Source.PHONE
        )
        self.client.force_authenticate(self.rep)
        response = self.client.post(
            reverse("lead-notes", args=[lead.id]), {"body": "Called, left voicemail"}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Note.objects.filter(lead=lead).count(), 1)
        self.assertEqual(
            lead.activity_log.filter(action=ActivityLog.Action.NOTE_ADDED).count(), 1
        )

    def test_list_notes(self):
        lead = Lead.objects.create(
            full_name="Jane Doe", email="jane@example.com", source=Lead.Source.PHONE
        )
        Note.objects.create(lead=lead, author=self.rep, body="First note")
        self.client.force_authenticate(self.rep)
        response = self.client.get(reverse("lead-notes", args=[lead.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["body"], "First note")

    def test_check_duplicate(self):
        Lead.objects.create(
            full_name="Existing Lead",
            email="dupe@example.com",
            phone="+15551234",
            source=Lead.Source.PHONE,
        )
        self.client.force_authenticate(self.rep)

        response = self.client.get(reverse("lead-check-duplicate"), {"email": "dupe@example.com"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        response = self.client.get(reverse("lead-check-duplicate"))
        self.assertEqual(response.data, [])


@override_settings(
    WEBSITE_ENQUIRY_API_TOKEN="test-enquiry-token",
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
)
class PublicEnquiryViewTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@vaeyu.local", password="password123", role=User.Role.ADMIN
        )
        self.url = reverse("public-enquiry")
        self.headers = {"HTTP_X_ENQUIRY_TOKEN": "test-enquiry-token"}

    def test_missing_token_rejected(self):
        response = self.client.post(
            self.url, {"full_name": "Jane Doe", "email": "jane@example.com"}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_wrong_token_rejected(self):
        response = self.client.post(
            self.url,
            {"full_name": "Jane Doe", "email": "jane@example.com"},
            HTTP_X_ENQUIRY_TOKEN="wrong-token",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_valid_enquiry_creates_lead(self):
        response = self.client.post(
            self.url,
            {
                "full_name": "Jane Doe",
                "email": "jane@example.com",
                "message": "Tell me more",
                "page_url": "https://vaeyu.example/contact",
                "utm_source": "google",
            },
            **self.headers,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        lead = Lead.objects.get(id=response.data["id"])
        self.assertEqual(lead.source, Lead.Source.WEBSITE_FORM)
        self.assertFalse(lead.is_spam)
        self.assertEqual(lead.source_meta["utm_source"], "google")
        self.assertEqual(
            lead.source_meta["page_url"], "https://vaeyu.example/contact"
        )
        self.assertEqual(
            lead.activity_log.filter(action=ActivityLog.Action.CREATED).count(), 1
        )

    def test_valid_enquiry_sends_notification_email(self):
        response = self.client.post(
            self.url,
            {"full_name": "Jane Doe", "email": "jane@example.com"},
            **self.headers,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Jane Doe", mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, [self.admin.email])

    def test_enquiry_requires_email_or_phone(self):
        response = self.client.post(
            self.url, {"full_name": "Jane Doe"}, **self.headers
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_honeypot_flags_spam_but_saves_lead(self):
        response = self.client.post(
            self.url,
            {
                "full_name": "Spammer",
                "email": "spam@example.com",
                "honeypot": "filled-in-by-bot",
            },
            **self.headers,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        lead = Lead.objects.get(id=response.data["id"])
        self.assertTrue(lead.is_spam)
        self.assertEqual(len(mail.outbox), 0)

    @patch("apps.leads.views.create_lead_from_enquiry_task.delay")
    @patch("apps.leads.views.Lead.objects.create", side_effect=Exception("db down"))
    def test_save_failure_queues_retry_and_returns_202(self, mock_create, mock_delay):
        response = self.client.post(
            self.url,
            {"full_name": "Jane Doe", "email": "jane@example.com"},
            **self.headers,
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_delay.assert_called_once()
        lead_fields, activity_detail, payload = mock_delay.call_args[0]
        self.assertEqual(lead_fields["full_name"], "Jane Doe")
        self.assertEqual(activity_detail["source"], "website_form")
        self.assertEqual(payload["full_name"], "Jane Doe")

    def test_retry_task_falls_back_once_retries_are_exhausted(self):
        from celery.exceptions import MaxRetriesExceededError

        from .tasks import create_lead_from_enquiry_task

        lead_fields = {
            "full_name": "Jane Doe",
            "email": "jane@example.com",
            "phone": "",
            "company_name": "",
            "message": "",
            "source": Lead.Source.WEBSITE_FORM,
            "source_meta": {},
            "is_spam": False,
        }
        activity_detail = {"source": "website_form", "is_spam": False}
        payload = {"full_name": "Jane Doe", "email": "jane@example.com"}

        with patch(
            "apps.leads.tasks.Lead.objects.create", side_effect=Exception("db down")
        ), patch.object(
            create_lead_from_enquiry_task, "retry", side_effect=MaxRetriesExceededError()
        ), patch(
            "apps.leads.tasks.send_enquiry_fallback_alert_task.delay"
        ) as mock_fallback:
            create_lead_from_enquiry_task.apply(
                args=(lead_fields, activity_detail, payload)
            )

        mock_fallback.assert_called_once()
        called_payload, called_error = mock_fallback.call_args[0]
        self.assertEqual(called_payload, payload)
