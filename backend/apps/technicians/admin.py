from django.contrib import admin

from .models import AvailabilitySlot, TechnicianProfile


class AvailabilitySlotInline(admin.TabularInline):
    model = AvailabilitySlot
    extra = 1


@admin.register(TechnicianProfile)
class TechnicianProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "is_approved", "is_available", "experience_years", "rating_avg")
    list_filter = ("is_approved", "is_available")
    inlines = [AvailabilitySlotInline]
    actions = ["approve_technicians"]

    @admin.action(description="Valider les techniciens sélectionnés")
    def approve_technicians(self, request, queryset):
        updated_count = queryset.update(is_approved=True)
        self.message_user(request, f"{updated_count} technicien(s) validé(s) avec succès.")


@admin.register(AvailabilitySlot)
class AvailabilitySlotAdmin(admin.ModelAdmin):
    list_display = ("technician", "weekday", "start_time", "end_time")
    list_filter = ("weekday",)