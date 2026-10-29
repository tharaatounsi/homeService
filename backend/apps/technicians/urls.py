from django.urls import path

from .views import (
    PublicTechnicianListView,
    TechnicianApproveView,
    TechnicianDetailView,
    TechnicianListView,
    TechnicianMeView,
    TechnicianRejectView,
    TechnicianScheduleView,
    TechnicianStatusView,
)

urlpatterns = [
    path("public/", PublicTechnicianListView.as_view(), name="technician-public"),
    path("me/", TechnicianMeView.as_view(), name="technician-me"),
    path("me/status/", TechnicianStatusView.as_view(), name="technician-status"),
    path("me/schedule/", TechnicianScheduleView.as_view(), name="technician-schedule"),
    path("", TechnicianListView.as_view(), name="technician-list"),
    path("<int:pk>/", TechnicianDetailView.as_view(), name="technician-detail"),
    path("<int:pk>/approve/", TechnicianApproveView.as_view(), name="technician-approve"),
    path("<int:pk>/reject/", TechnicianRejectView.as_view(), name="technician-reject"),
]