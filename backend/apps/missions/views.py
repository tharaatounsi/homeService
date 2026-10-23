from rest_framework import generics, permissions
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser

from .models import ServiceRequest
from .serializers import ServiceRequestSerializer


class ServiceRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = ServiceRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        if user.role == "client":
            return ServiceRequest.objects.filter(client=user).select_related("category").prefetch_related("photos")
        elif user.role == "technician":
            return ServiceRequest.objects.filter(technician=user).select_related("category").prefetch_related("photos")
        elif user.role == "admin":
            return ServiceRequest.objects.all().select_related("category", "client", "technician").prefetch_related("photos")
        return ServiceRequest.objects.none()


class ServiceRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ServiceRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "client":
            return ServiceRequest.objects.filter(client=user)
        elif user.role == "technician":
            return ServiceRequest.objects.filter(technician=user)
        elif user.role == "admin":
            return ServiceRequest.objects.all()
        return ServiceRequest.objects.none()
