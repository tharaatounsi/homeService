from django.urls import path

from .views import (
    ServiceRequestAcceptView,
    ServiceRequestCancelView,
    ServiceRequestDetailView,
    ServiceRequestListCreateView,
    ServiceRequestStatusView,
)

urlpatterns = [
    path("requests/", ServiceRequestListCreateView.as_view(), name="request-list-create"),
    path("requests/<int:pk>/", ServiceRequestDetailView.as_view(), name="request-detail"),
    path("requests/<int:pk>/accept/", ServiceRequestAcceptView.as_view(), name="request-accept"),
    path("requests/<int:pk>/cancel/", ServiceRequestCancelView.as_view(), name="request-cancel"),
    path("requests/<int:pk>/status/", ServiceRequestStatusView.as_view(), name="request-status"),
]