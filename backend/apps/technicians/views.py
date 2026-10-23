from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole, IsTechnician

from .models import TechnicianProfile
from .serializers import (
    AvailabilitySlotSerializer,
    EmptySerializer,
    ProfileUpdateSerializer,
    ScheduleSerializer,
    StatusSerializer,
    TechnicianAdminCreateSerializer,
    TechnicianProfileSerializer,
)
from .services import (
    approve_technician,
    reject_technician,
    update_profile,
    update_schedule,
    update_status,
)


class TechnicianMeView(generics.GenericAPIView):
    """Lecture et mise à jour du profil du technicien connecté."""

    permission_classes = [IsTechnician]
    serializer_class = ProfileUpdateSerializer

    def get_object(self):
        return get_object_or_404(TechnicianProfile, user=self.request.user)

    def get(self, request, *args, **kwargs):
        profile = self.get_object()
        serializer = TechnicianProfileSerializer(profile)
        return Response(serializer.data)

    def patch(self, request, *args, **kwargs):
        profile = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_profile = update_profile(profile, serializer.validated_data)
        return Response(TechnicianProfileSerializer(updated_profile).data)


class TechnicianStatusView(generics.GenericAPIView):
    """Bascule du statut en ligne/hors ligne du technicien."""

    permission_classes = [IsTechnician]
    serializer_class = StatusSerializer

    def get_object(self):
        return get_object_or_404(TechnicianProfile, user=self.request.user)

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = self.get_object()
        updated_profile = update_status(profile, serializer.validated_data["is_available"])
        return Response(TechnicianProfileSerializer(updated_profile).data)


class TechnicianScheduleView(generics.GenericAPIView):
    """Lecture et modification du calendrier de disponibilité du technicien."""

    permission_classes = [IsTechnician]
    serializer_class = ScheduleSerializer

    def get_object(self):
        return get_object_or_404(TechnicianProfile, user=self.request.user)

    def get(self, request, *args, **kwargs):
        profile = self.get_object()
        slots = profile.slots.all()
        return Response({"slots": AvailabilitySlotSerializer(slots, many=True).data})

    def put(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = self.get_object()
        new_slots = update_schedule(profile, serializer.validated_data["slots"])
        return Response({"slots": AvailabilitySlotSerializer(new_slots, many=True).data})


class TechnicianListView(generics.ListCreateAPIView):
    """Liste et ajout de techniciens (Admin uniquement), avec filtre ?approved=true|false."""

    permission_classes = [IsAdminRole]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TechnicianAdminCreateSerializer
        return TechnicianProfileSerializer

    def get_queryset(self):
        qs = TechnicianProfile.objects.all().select_related("user").prefetch_related("categories")
        approved_param = self.request.query_params.get("approved")
        if approved_param is not None:
            val = approved_param.lower() in ("true", "1")
            qs = qs.filter(is_approved=val)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(TechnicianProfileSerializer(profile).data, status=status.HTTP_201_CREATED)


class TechnicianDetailView(generics.RetrieveDestroyAPIView):
    """Lecture et suppression d'un technicien par un administrateur."""

    permission_classes = [IsAdminRole]
    serializer_class = TechnicianProfileSerializer
    queryset = TechnicianProfile.objects.all()

    def perform_destroy(self, instance):
        user = instance.user
        instance.delete()
        user.delete()


class TechnicianApproveView(generics.GenericAPIView):
    """Validation d'un technicien par un administrateur."""

    permission_classes = [IsAdminRole]
    serializer_class = EmptySerializer

    def post(self, request, pk=None, *args, **kwargs):
        profile = get_object_or_404(TechnicianProfile, pk=pk)
        updated_profile = approve_technician(profile)
        return Response(TechnicianProfileSerializer(updated_profile).data)


class TechnicianRejectView(generics.GenericAPIView):
    """Refus d'un technicien par un administrateur."""

    permission_classes = [IsAdminRole]
    serializer_class = EmptySerializer

    def post(self, request, pk=None, *args, **kwargs):
        profile = get_object_or_404(TechnicianProfile, pk=pk)
        updated_profile = reject_technician(profile)
        return Response(TechnicianProfileSerializer(updated_profile).data)