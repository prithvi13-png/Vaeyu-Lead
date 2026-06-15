import django_filters as filters

from .models import Lead


class LeadFilter(filters.FilterSet):
    status = filters.ChoiceFilter(choices=Lead.Status.choices)
    source = filters.ChoiceFilter(choices=Lead.Source.choices)
    owner = filters.UUIDFilter(field_name="owner_id")
    is_archived = filters.BooleanFilter(field_name="is_archived")

    class Meta:
        model = Lead
        fields = ["status", "source", "owner", "is_archived"]
