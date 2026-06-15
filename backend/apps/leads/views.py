import logging

from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsAdmin

from .filters import LeadFilter
from .models import ActivityLog, Lead, Note
from .permissions import HasEnquiryToken
from .tasks import create_lead_from_enquiry_task, send_new_lead_notification_task
from .serializers import (
    AssignLeadSerializer,
    EnquirySerializer,
    LeadCreateSerializer,
    LeadDetailSerializer,
    LeadListSerializer,
    LeadUpdateSerializer,
    NoteCreateSerializer,
    NoteSerializer,
)

logger = logging.getLogger(__name__)

TRACKED_EDIT_FIELDS = [
    "full_name",
    "email",
    "phone",
    "company_name",
    "message",
    "lost_reason",
]


class LeadViewSet(viewsets.ModelViewSet):
    filterset_class = LeadFilter
    search_fields = ["full_name", "email", "phone"]
    ordering_fields = ["created_at", "updated_at", "full_name", "status"]

    def get_queryset(self):
        qs = Lead.objects.select_related("owner").prefetch_related(
            "notes__author", "activity_log__actor"
        )
        if self.action == "list" and "is_archived" not in self.request.query_params:
            qs = qs.filter(is_archived=False)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return LeadCreateSerializer
        if self.action in ("update", "partial_update"):
            return LeadUpdateSerializer
        if self.action == "retrieve":
            return LeadDetailSerializer
        if self.action == "assign":
            return AssignLeadSerializer
        return LeadListSerializer

    def get_permissions(self):
        if self.action in ("assign", "archive", "unarchive"):
            return [IsAdmin()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        detail = LeadDetailSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        return Response(detail.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        detail = LeadDetailSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        return Response(detail.data)

    def perform_create(self, serializer):
        lead = serializer.save()
        ActivityLog.objects.create(
            lead=lead,
            actor=self.request.user,
            action=ActivityLog.Action.CREATED,
            detail={"source": lead.source, "status": lead.status},
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        old_status = instance.status
        old_values = {field: getattr(instance, field) for field in TRACKED_EDIT_FIELDS}

        lead = serializer.save()

        if lead.status != old_status:
            ActivityLog.objects.create(
                lead=lead,
                actor=self.request.user,
                action=ActivityLog.Action.STATUS_CHANGED,
                detail={"from": old_status, "to": lead.status},
            )

        changes = {
            field: {"from": old_values[field], "to": getattr(lead, field)}
            for field in TRACKED_EDIT_FIELDS
            if old_values[field] != getattr(lead, field)
        }
        if changes:
            ActivityLog.objects.create(
                lead=lead,
                actor=self.request.user,
                action=ActivityLog.Action.EDITED,
                detail=changes,
            )

    @action(detail=True, methods=["get", "post"])
    def notes(self, request, pk=None):
        lead = self.get_object()

        if request.method == "POST":
            serializer = NoteCreateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            note = Note.objects.create(
                lead=lead, author=request.user, body=serializer.validated_data["body"]
            )
            ActivityLog.objects.create(
                lead=lead,
                actor=request.user,
                action=ActivityLog.Action.NOTE_ADDED,
                detail={"note_id": str(note.id)},
            )
            return Response(NoteSerializer(note).data, status=status.HTTP_201_CREATED)

        notes = lead.notes.select_related("author").all()
        return Response(NoteSerializer(notes, many=True).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        lead = self.get_object()
        serializer = AssignLeadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_owner = lead.owner
        new_owner = serializer.validated_data.get("owner")
        lead.owner = new_owner
        lead.save(update_fields=["owner", "updated_at"])

        ActivityLog.objects.create(
            lead=lead,
            actor=request.user,
            action=ActivityLog.Action.ASSIGNED,
            detail={
                "from": old_owner.email if old_owner else None,
                "to": new_owner.email if new_owner else None,
            },
        )
        return Response(
            LeadDetailSerializer(lead, context=self.get_serializer_context()).data
        )

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        return self._set_archived(request, True)

    @action(detail=True, methods=["post"])
    def unarchive(self, request, pk=None):
        return self._set_archived(request, False)

    def _set_archived(self, request, archived):
        lead = self.get_object()
        if lead.is_archived == archived:
            return Response(
                LeadDetailSerializer(lead, context=self.get_serializer_context()).data
            )

        lead.is_archived = archived
        lead.save(update_fields=["is_archived", "updated_at"])
        ActivityLog.objects.create(
            lead=lead,
            actor=request.user,
            action=ActivityLog.Action.EDITED,
            detail={"is_archived": {"from": not archived, "to": archived}},
        )
        return Response(
            LeadDetailSerializer(lead, context=self.get_serializer_context()).data
        )

    @action(detail=False, methods=["get"], url_path="check-duplicate")
    def check_duplicate(self, request):
        email = request.query_params.get("email", "").strip()
        phone = request.query_params.get("phone", "").strip()

        if not email and not phone:
            return Response([])

        query = Q()
        if email:
            query |= Q(email__iexact=email)
        if phone:
            query |= Q(phone=phone)

        matches = Lead.objects.filter(query, is_archived=False)[:5]
        return Response(LeadListSerializer(matches, many=True).data)


class PublicEnquiryView(APIView):
    """Token-secured endpoint the website enquiry form posts to (FR-1.x)."""

    authentication_classes = []
    permission_classes = [HasEnquiryToken]

    def post(self, request):
        serializer = EnquirySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        lead_fields = {
            "full_name": data["full_name"],
            "email": data.get("email", ""),
            "phone": data.get("phone", ""),
            "company_name": data.get("company_name", ""),
            "message": data.get("message", ""),
            "source": Lead.Source.WEBSITE_FORM,
            "source_meta": serializer.build_source_meta(),
            "is_spam": bool(data.get("honeypot")),
        }
        activity_detail = {"source": "website_form", "is_spam": lead_fields["is_spam"]}

        try:
            with transaction.atomic():
                lead = Lead.objects.create(**lead_fields)
                ActivityLog.objects.create(
                    lead=lead,
                    actor=None,
                    action=ActivityLog.Action.CREATED,
                    detail=activity_detail,
                )
        except Exception:
            logger.exception("Failed to save website enquiry, queuing retry")
            create_lead_from_enquiry_task.delay(
                lead_fields, activity_detail, dict(data)
            )
            return Response(
                {"detail": "Enquiry received and queued for follow-up."},
                status=status.HTTP_202_ACCEPTED,
            )

        if not lead.is_spam:
            send_new_lead_notification_task.delay(str(lead.id))

        return Response({"id": lead.id}, status=status.HTTP_201_CREATED)
