from django.urls import path

from .views import (
    ConversationListView,
    DirectConversationMessagesView,
    ServiceRequestAcceptView,
    ServiceRequestCancelView,
    ServiceRequestDetailView,
    ServiceRequestInvoiceView,
    ServiceRequestListCreateView,
    ServiceRequestLocationView,
    ServiceRequestMatchingTechniciansView,
    ServiceRequestMessagesView,
    ServiceRequestPayView,
    ServiceRequestQuoteRespondView,
    ServiceRequestQuoteView,
    ServiceRequestStatusView,
    ServiceRequestTrackingView,
)

urlpatterns = [
    path("requests/", ServiceRequestListCreateView.as_view(), name="request-list-create"),
    path("requests/<int:pk>/", ServiceRequestDetailView.as_view(), name="request-detail"),
    path("requests/<int:pk>/accept/", ServiceRequestAcceptView.as_view(), name="request-accept"),
    path("requests/<int:pk>/cancel/", ServiceRequestCancelView.as_view(), name="request-cancel"),
    path("requests/<int:pk>/status/", ServiceRequestStatusView.as_view(), name="request-status"),
    path("requests/<int:pk>/matching-technicians/", ServiceRequestMatchingTechniciansView.as_view(), name="request-matching-technicians"),
    path("requests/<int:pk>/messages/", ServiceRequestMessagesView.as_view(), name="request-messages"),
    path("requests/<int:pk>/location/", ServiceRequestLocationView.as_view(), name="request-location"),
    path("requests/<int:pk>/tracking/", ServiceRequestTrackingView.as_view(), name="request-tracking"),
    path("requests/<int:pk>/quote/", ServiceRequestQuoteView.as_view(), name="request-quote"),
    path("requests/<int:pk>/quote/respond/", ServiceRequestQuoteRespondView.as_view(), name="request-quote-respond"),
    path("requests/<int:pk>/pay/", ServiceRequestPayView.as_view(), name="request-pay"),
    path("requests/<int:pk>/invoice/", ServiceRequestInvoiceView.as_view(), name="request-invoice"),
    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
    path("conversations/<int:partner_id>/messages/", DirectConversationMessagesView.as_view(), name="conversation-messages"),
]
