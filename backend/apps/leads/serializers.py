from rest_framework import serializers

from apps.users.models import User
from apps.users.serializers import UserBriefSerializer

from .models import ActivityLog, Lead, Note

MANUAL_ENTRY_SOURCES = [
    choice
    for choice in Lead.Source.choices
    if choice[0] != Lead.Source.WEBSITE_FORM
]


class NoteSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)

    class Meta:
        model = Note
        fields = ["id", "lead", "author", "body", "created_at"]
        read_only_fields = ["id", "lead", "author", "created_at"]


class NoteCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ["body"]


class ActivityLogSerializer(serializers.ModelSerializer):
    actor = UserBriefSerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = ["id", "actor", "action", "detail", "created_at"]
        read_only_fields = fields


class LeadListSerializer(serializers.ModelSerializer):
    owner = UserBriefSerializer(read_only=True)

    class Meta:
        model = Lead
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "company_name",
            "source",
            "status",
            "owner",
            "is_spam",
            "is_archived",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class LeadDetailSerializer(serializers.ModelSerializer):
    owner = UserBriefSerializer(read_only=True)
    notes = NoteSerializer(many=True, read_only=True)
    activity_log = ActivityLogSerializer(many=True, read_only=True)

    class Meta:
        model = Lead
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "company_name",
            "message",
            "source",
            "source_meta",
            "status",
            "lost_reason",
            "owner",
            "is_spam",
            "is_archived",
            "created_at",
            "updated_at",
            "notes",
            "activity_log",
        ]
        read_only_fields = [
            "id",
            "source",
            "source_meta",
            "owner",
            "is_spam",
            "is_archived",
            "created_at",
            "updated_at",
            "notes",
            "activity_log",
        ]


class LeadCreateSerializer(serializers.ModelSerializer):
    source = serializers.ChoiceField(choices=MANUAL_ENTRY_SOURCES)

    class Meta:
        model = Lead
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "company_name",
            "message",
            "source",
            "status",
            "lost_reason",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError(
                "Provide at least one of email or phone."
            )
        return attrs


class LeadUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = [
            "full_name",
            "email",
            "phone",
            "company_name",
            "message",
            "status",
            "lost_reason",
        ]

    def validate(self, attrs):
        email = attrs.get("email", getattr(self.instance, "email", ""))
        phone = attrs.get("phone", getattr(self.instance, "phone", ""))
        if not email and not phone:
            raise serializers.ValidationError(
                "Provide at least one of email or phone."
            )
        status_value = attrs.get("status", getattr(self.instance, "status", None))
        lost_reason = attrs.get("lost_reason", getattr(self.instance, "lost_reason", ""))
        if status_value == Lead.Status.LOST and not lost_reason:
            raise serializers.ValidationError(
                {"lost_reason": "Required when status is Lost."}
            )
        return attrs


class AssignLeadSerializer(serializers.Serializer):
    owner_id = serializers.PrimaryKeyRelatedField(
        source="owner",
        queryset=User.objects.filter(is_active=True),
        allow_null=True,
    )


UTM_FIELDS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
]


class EnquirySerializer(serializers.Serializer):
    """Validates inbound payloads from the public website enquiry endpoint."""

    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(
        max_length=32, required=False, allow_blank=True, default=""
    )
    company_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )
    message = serializers.CharField(required=False, allow_blank=True, default="")
    page_url = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default=""
    )
    honeypot = serializers.CharField(required=False, allow_blank=True, default="")
    utm_source = serializers.CharField(required=False, allow_blank=True, default="")
    utm_medium = serializers.CharField(required=False, allow_blank=True, default="")
    utm_campaign = serializers.CharField(required=False, allow_blank=True, default="")
    utm_term = serializers.CharField(required=False, allow_blank=True, default="")
    utm_content = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError(
                "Provide at least one of email or phone."
            )
        return attrs

    def build_source_meta(self):
        meta = {}
        for field in UTM_FIELDS:
            value = self.validated_data.get(field)
            if value:
                meta[field] = value
        page_url = self.validated_data.get("page_url")
        if page_url:
            meta["page_url"] = page_url
        return meta
