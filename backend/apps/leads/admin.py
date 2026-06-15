from django.contrib import admin

from .models import ActivityLog, Lead, Note


class NoteInline(admin.TabularInline):
    model = Note
    extra = 0
    readonly_fields = ["created_at"]


class ActivityLogInline(admin.TabularInline):
    model = ActivityLog
    extra = 0
    readonly_fields = ["actor", "action", "detail", "created_at"]
    can_delete = False


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = [
        "full_name",
        "email",
        "phone",
        "source",
        "status",
        "owner",
        "is_archived",
        "created_at",
    ]
    list_filter = ["status", "source", "is_archived", "is_spam"]
    search_fields = ["full_name", "email", "phone", "company_name"]
    inlines = [NoteInline, ActivityLogInline]


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ["lead", "author", "created_at"]


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["lead", "actor", "action", "created_at"]
    list_filter = ["action"]
