from django.contrib import admin
from django.db.models import Count, Sum
from django.http import HttpResponse, JsonResponse
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)


def health(request):
    return JsonResponse({"status": "ok"})


def prometheus_metrics(request):
    lines = [
        "# HELP servicehome_up Etat de disponibilite du backend ServiceHome (1 = UP)",
        "# TYPE servicehome_up gauge",
        "servicehome_up 1",
        "# HELP servicehome_ai_models_loaded Nombre de moteurs IA/ML actifs (NLP + Colab ML)",
        "# TYPE servicehome_ai_models_loaded gauge",
        "servicehome_ai_models_loaded 2",
    ]
    try:
        from apps.accounts.models import User
        from apps.missions.models import MissionDispute, MissionPayment, MissionQuote, ServiceRequest
        from apps.technicians.models import TechnicianProfile

        lines.append("# HELP servicehome_users_total Nombre total d'utilisateurs par role RBAC")
        lines.append("# TYPE servicehome_users_total gauge")
        role_counts = dict(User.objects.values_list("role").annotate(c=Count("id")))
        for role in ["client", "technician", "admin"]:
            lines.append(f'servicehome_users_total{{role="{role}"}} {role_counts.get(role, 0)}')

        approved_techs = TechnicianProfile.objects.filter(is_approved=True).count()
        online_techs = TechnicianProfile.objects.filter(is_approved=True, is_available=True).count()
        lines.extend([
            "# HELP servicehome_technicians_approved_total Nombre de techniciens valides par Admin",
            "# TYPE servicehome_technicians_approved_total gauge",
            f"servicehome_technicians_approved_total {approved_techs}",
            "# HELP servicehome_technicians_online_total Nombre de techniciens disponibles en temps reel",
            "# TYPE servicehome_technicians_online_total gauge",
            f"servicehome_technicians_online_total {online_techs}",
        ])

        lines.append("# HELP servicehome_missions_total Nombre de demandes d'intervention par statut")
        lines.append("# TYPE servicehome_missions_total gauge")
        status_counts = dict(ServiceRequest.objects.values_list("status").annotate(c=Count("id")))
        for st in ["pending", "accepted", "en_route", "in_progress", "completed", "paid", "cancelled"]:
            lines.append(f'servicehome_missions_total{{status="{st}"}} {status_counts.get(st, 0)}')

        lines.append("# HELP servicehome_quotes_total Nombre de devis sur place par statut")
        lines.append("# TYPE servicehome_quotes_total gauge")
        quote_counts = dict(MissionQuote.objects.values_list("status").annotate(c=Count("id")))
        for qst in ["pending", "accepted", "rejected"]:
            lines.append(f'servicehome_quotes_total{{status="{qst}"}} {quote_counts.get(qst, 0)}')

        try:
            disputes_open = MissionDispute.objects.filter(status__in=["open", "in_review"]).count()
        except Exception:
            disputes_open = 0

        pay_agg = MissionPayment.objects.filter(status="completed").aggregate(
            rev=Sum("amount"), fee=Sum("platform_fee")
        )
        total_rev = float(pay_agg["rev"] or 0.0)
        total_fee = float(pay_agg["fee"] or 0.0)

        lines.extend([
            "# HELP servicehome_disputes_open_total Nombre de litiges SAV ouverts",
            "# TYPE servicehome_disputes_open_total gauge",
            f"servicehome_disputes_open_total {disputes_open}",
            "# HELP servicehome_revenue_tnd_total Volume d'affaires total encaisse (TND)",
            "# TYPE servicehome_revenue_tnd_total counter",
            f"servicehome_revenue_tnd_total {total_rev:.2f}",
            "# HELP servicehome_commission_tnd_total Commission plateforme 10% (TND)",
            "# TYPE servicehome_commission_tnd_total counter",
            f"servicehome_commission_tnd_total {total_fee:.2f}",
        ])
    except Exception:
        pass

    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain; version=0.0.4; charset=utf-8")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("metrics", prometheus_metrics, name="prometheus-metrics-root"),
    path("metrics/", prometheus_metrics, name="prometheus-metrics-slash"),
    path("api/metrics/", prometheus_metrics, name="prometheus-metrics-api"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/catalog/", include("apps.catalog.urls")),
    path("api/technicians/", include("apps.technicians.urls")),
    path("api/missions/", include("apps.missions.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
