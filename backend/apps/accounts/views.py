from rest_framework import generics, permissions, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Address, User
from .permissions import IsAdminRole
from .serializers import (
    AddressSerializer,
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    authentication_classes = []


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class AddressListCreateView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)


class ChangePasswordView(generics.GenericAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response(
                {"old_password": ["Le mot de passe actuel est incorrect."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"detail": "Mot de passe modifié avec succès."})


class AdminUserListView(generics.ListAPIView):
    """Liste tous les utilisateurs enregistrés (filtrable par ?role=client|technician|admin)."""
    serializer_class = UserSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        role = self.request.query_params.get("role")
        qs = User.objects.all().order_by("-date_joined")
        if role:
            qs = qs.filter(role=role)
        return qs


class AdminStatsView(generics.GenericAPIView):
    """KPIs et statistiques globales de la plateforme pour le tableau de bord Admin."""
    permission_classes = [IsAdminRole]

    def get(self, request):
        from apps.catalog.models import Category
        from apps.missions.models import ServiceRequest
        from apps.technicians.models import TechnicianProfile

        total_clients = User.objects.filter(role=User.Role.CLIENT).count()
        total_technicians = User.objects.filter(role=User.Role.TECHNICIAN).count()
        approved_technicians = TechnicianProfile.objects.filter(is_approved=True).count()
        pending_technicians = TechnicianProfile.objects.filter(is_approved=False).count()

        total_missions = ServiceRequest.objects.count()
        pending_missions = ServiceRequest.objects.filter(status=ServiceRequest.Status.PENDING).count()
        in_progress_missions = ServiceRequest.objects.filter(
            status__in=[
                ServiceRequest.Status.ACCEPTED,
                ServiceRequest.Status.EN_ROUTE,
                ServiceRequest.Status.IN_PROGRESS,
            ]
        ).count()
        completed_missions = ServiceRequest.objects.filter(
            status__in=[ServiceRequest.Status.COMPLETED, ServiceRequest.Status.PAID]
        ).count()
        cancelled_missions = ServiceRequest.objects.filter(
            status=ServiceRequest.Status.CANCELLED
        ).count()

        total_categories = Category.objects.count()

        return Response({
            "total_clients": total_clients,
            "total_technicians": total_technicians,
            "approved_technicians": approved_technicians,
            "pending_technicians": pending_technicians,
            "total_missions": total_missions,
            "pending_missions": pending_missions,
            "in_progress_missions": in_progress_missions,
            "completed_missions": completed_missions,
            "cancelled_missions": cancelled_missions,
            "total_categories": total_categories,
        })


