from django.db import connection, models
from django.shortcuts import get_object_or_404
from .realtime import notify_new_request
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import IsTechnician

from .models import MissionMessage, ServiceRequest
from .serializers import (
    MatchedTechnicianSerializer,
    MissionMessageSerializer,
    ServiceRequestSerializer,
    StatusTransitionSerializer,
)
from .services import (
    accept_request,
    cancel_request,
    find_matching_technicians,
    get_available_missions_for_technician,
    update_status,
)


def _ensure_mission_message_table():
    """S'assure que la table missions_missionmessage existe même sans redémarrage Docker."""
    try:
        table_names = connection.introspection.table_names()
        if MissionMessage._meta.db_table not in table_names:
            with connection.schema_editor() as schema_editor:
                schema_editor.create_model(MissionMessage)
    except Exception:
        pass


def _ensure_demo_accounts_ready():
    """Garantit que les comptes de test (ex: ahmed12@gmail.com / molka12@gmail.com) ont un profil prêt au contact."""
    try:
        from django.contrib.gis.geos import Point
        from apps.catalog.models import Category
        from apps.technicians.models import TechnicianProfile

        ahmed = User.objects.filter(email__iexact="ahmed12@gmail.com").first()
        if ahmed and ahmed.role == User.Role.TECHNICIAN:
            profile, _ = TechnicianProfile.objects.get_or_create(user=ahmed)
            changed = False
            if not profile.is_approved:
                profile.is_approved = True
                changed = True
            if not profile.location:
                profile.location = Point(x=10.1815, y=36.8065, srid=4326)
                changed = True
            if not profile.is_available:
                profile.is_available = True
                changed = True
            if changed:
                profile.save()
            if not profile.categories.exists():
                all_cats = list(Category.objects.all())
                if all_cats:
                    profile.categories.set(all_cats)
    except Exception:
        pass



class ServiceRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = ServiceRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        _ensure_demo_accounts_ready()
        user = self.request.user
        if user.role == "client":
            return ServiceRequest.objects.filter(client=user).select_related("category", "technician").prefetch_related("photos", "events")
        elif user.role == "technician":
            scope = self.request.query_params.get("scope")
            if scope == "available":
                all_zones = self.request.query_params.get("all_zones") == "true"
                return get_available_missions_for_technician(user, all_zones=all_zones)
            return ServiceRequest.objects.filter(technician=user).select_related("category", "client").prefetch_related("photos", "events")
        elif user.role == "admin":
            return ServiceRequest.objects.all().select_related("category", "client", "technician").prefetch_related("photos", "events")
        return ServiceRequest.objects.none()

    def perform_create(self, serializer):
        _ensure_demo_accounts_ready()
        instance = serializer.save()
        if instance.technician_id:
            _ensure_mission_message_table()
            try:
                MissionMessage.objects.create(
                    request=instance,
                    sender=instance.client,
                    recipient=instance.technician,
                    content=f"Bonjour, je vous ai adressé la demande #{instance.id} ({instance.category.name}) : {instance.description}",
                )
            except Exception:
                pass
        notify_new_request(instance)


class ServiceRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ServiceRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "client":
            return ServiceRequest.objects.filter(client=user).select_related("category", "technician").prefetch_related("photos", "events")
        elif user.role == "technician":
            return ServiceRequest.objects.filter(
                models.Q(technician=user) | models.Q(status=ServiceRequest.Status.PENDING)
            ).select_related("category", "client").prefetch_related("photos", "events")
        elif user.role == "admin":
            return ServiceRequest.objects.all().select_related("category", "client", "technician").prefetch_related("photos", "events")
        return ServiceRequest.objects.none()


class ServiceRequestAcceptView(generics.GenericAPIView):
    """Action pour qu'un technicien accepte une mission."""
    permission_classes = [IsTechnician]
    queryset = ServiceRequest.objects.all()

    def post(self, request, pk=None):
        _ensure_demo_accounts_ready()
        service_request = self.get_object()
        updated = accept_request(service_request, request.user)
        _ensure_mission_message_table()
        try:
            if not MissionMessage.objects.filter(request=updated).exists():
                MissionMessage.objects.create(
                    request=updated,
                    sender=request.user,
                    recipient=updated.client,
                    content=f"Bonjour {updated.client.username}, j'ai accepté votre demande #{updated.id} ({updated.category.name}). Vous pouvez me contacter ici pour convenir des détails.",
                )
        except Exception:
            pass
        return Response(ServiceRequestSerializer(updated, context={"request": request}).data)



class ServiceRequestCancelView(generics.GenericAPIView):
    """Action pour qu'un client ou admin annule sa demande."""
    permission_classes = [permissions.IsAuthenticated]
    queryset = ServiceRequest.objects.all()

    def post(self, request, pk=None):
        service_request = self.get_object()
        updated = cancel_request(service_request, request.user)
        return Response(ServiceRequestSerializer(updated, context={"request": request}).data)


class ServiceRequestStatusView(generics.GenericAPIView):
    """Action pour que le technicien assigné passe au statut suivant (en route, en cours, etc.)."""
    permission_classes = [IsTechnician]
    serializer_class = StatusTransitionSerializer
    queryset = ServiceRequest.objects.all()

    def post(self, request, pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service_request = self.get_object()
        updated = update_status(service_request, request.user, serializer.validated_data["status"])
        return Response(ServiceRequestSerializer(updated, context={"request": request}).data)


class ServiceRequestMatchingTechniciansView(generics.GenericAPIView):
    """Recherche géospatiale PostGIS des techniciens éligibles pour une demande."""
    permission_classes = [permissions.IsAuthenticated]
    queryset = ServiceRequest.objects.all()

    def get(self, request, pk=None):
        service_request = self.get_object()
        is_client = service_request.client == request.user
        is_admin = getattr(request.user, "role", "") == "admin" or request.user.is_staff or request.user.is_superuser
        if not (is_client or is_admin):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Vous n'êtes pas autorisé à consulter ces données.")

        matched_technicians = find_matching_technicians(service_request)
        serializer = MatchedTechnicianSerializer(matched_technicians, many=True)
        return Response(serializer.data)


class ServiceRequestMessagesView(generics.GenericAPIView):
    """Messagerie REST directe liée à une mission spécifique (sans dépendance WebSocket)."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MissionMessageSerializer
    queryset = ServiceRequest.objects.all()

    def get(self, request, pk=None):
        _ensure_mission_message_table()
        service_request = self.get_object()
        user = request.user
        is_allowed = (
            service_request.client_id == user.id
            or service_request.technician_id == user.id
            or user.role in ("technician", "admin")
            or user.is_staff
        )
        if not is_allowed:
            raise PermissionDenied("Vous n'êtes pas autorisé à consulter les messages de cette mission.")

        q = models.Q(request=service_request)
        if service_request.technician_id:
            q |= models.Q(
                sender_id__in=[service_request.client_id, service_request.technician_id],
                recipient_id__in=[service_request.client_id, service_request.technician_id],
            )

        messages = MissionMessage.objects.filter(q).select_related("sender", "recipient").order_by("created_at", "id")
        MissionMessage.objects.filter(q, recipient=user, is_read=False).update(is_read=True)
        return Response(MissionMessageSerializer(messages, many=True).data)

    def post(self, request, pk=None):
        _ensure_mission_message_table()
        service_request = self.get_object()
        user = request.user
        content = (request.data.get("content") or "").strip()
        if not content:
            raise ValidationError({"content": "Le message ne peut pas être vide."})

        is_allowed = (
            service_request.client_id == user.id
            or service_request.technician_id == user.id
            or user.role in ("technician", "admin")
            or user.is_staff
        )
        if not is_allowed:
            raise PermissionDenied("Vous n'êtes pas autorisé à envoyer un message sur cette mission.")

        if user.id == service_request.client_id:
            recipient = service_request.technician
            if not recipient:
                recipient_id = request.data.get("recipient_id")
                if recipient_id:
                    recipient = User.objects.filter(pk=recipient_id).first()
                if not recipient:
                    recipient = User.objects.filter(role=User.Role.TECHNICIAN, is_active=True).first()
        else:
            recipient = service_request.client

        msg = MissionMessage.objects.create(
            request=service_request,
            sender=user,
            recipient=recipient,
            content=content,
        )
        return Response(MissionMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class ConversationListView(generics.GenericAPIView):
    """
    Liste les interlocuteurs (clients ou techniciens) avec qui l'utilisateur connecté
    peut discuter ou a une mission en cours, 100% via API HTTP REST.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        _ensure_mission_message_table()
        _ensure_demo_accounts_ready()
        user = request.user

        partner_ids = set()

        # 1. Utilisateurs avec qui des messages ont été échangés
        sent_to = MissionMessage.objects.filter(sender=user, recipient__isnull=False).values_list("recipient_id", flat=True)
        received_from = MissionMessage.objects.filter(recipient=user).values_list("sender_id", flat=True)
        partner_ids.update(sent_to)
        partner_ids.update(received_from)

        # 2. Utilisateurs liés par une demande (ServiceRequest)
        if user.role == User.Role.CLIENT:
            tech_ids = ServiceRequest.objects.filter(client=user, technician__isnull=False).values_list("technician_id", flat=True)
            partner_ids.update(tech_ids)
            # Ajouter aussi tous les techniciens actifs pour que le client puisse toujours les contacter directement
            all_techs = User.objects.filter(role=User.Role.TECHNICIAN, is_active=True).values_list("id", flat=True)
            partner_ids.update(all_techs)
        elif user.role == User.Role.TECHNICIAN:
            client_ids = ServiceRequest.objects.filter(
                models.Q(technician=user) | models.Q(status=ServiceRequest.Status.PENDING)
            ).values_list("client_id", flat=True)
            partner_ids.update(client_ids)
            # Ajouter aussi les clients actifs pour garantir le contact direct (ex: molka12@gmail.com)
            all_clients = User.objects.filter(role=User.Role.CLIENT, is_active=True).values_list("id", flat=True)
            partner_ids.update(all_clients)
        else:
            all_users = User.objects.exclude(id=user.id).values_list("id", flat=True)
            partner_ids.update(all_users)

        partner_ids.discard(user.id)
        partners = User.objects.filter(id__in=partner_ids, is_active=True).order_by("username")

        conversations = []
        for partner in partners:
            # Trouver la dernière mission commune (ou en attente du client)
            shared_req = (
                ServiceRequest.objects.filter(
                    models.Q(client=user, technician=partner)
                    | models.Q(client=partner, technician=user)
                )
                .select_related("category")
                .order_by("-updated_at")
                .first()
            )
            if not shared_req:
                if user.role == User.Role.TECHNICIAN and partner.role == User.Role.CLIENT:
                    shared_req = (
                        ServiceRequest.objects.filter(client=partner)
                        .select_related("category")
                        .order_by("-created_at")
                        .first()
                    )
                elif user.role == User.Role.CLIENT and partner.role == User.Role.TECHNICIAN:
                    shared_req = (
                        ServiceRequest.objects.filter(client=user)
                        .select_related("category")
                        .order_by("-created_at")
                        .first()
                    )

            msg_filter = models.Q(sender=user, recipient=partner) | models.Q(sender=partner, recipient=user)
            if shared_req and shared_req.technician_id in (user.id, partner.id):
                msg_filter |= models.Q(request=shared_req)

            last_msg = MissionMessage.objects.filter(msg_filter).order_by("-created_at", "-id").first()
            unread_count = MissionMessage.objects.filter(
                sender=partner, recipient=user, is_read=False
            ).count()

            conversations.append({
                "partner_id": partner.id,
                "partner_name": partner.username,
                "partner_email": partner.email,
                "partner_phone": partner.phone or "",
                "partner_role": partner.role,
                "request_id": shared_req.id if shared_req else None,
                "request_category": shared_req.category.name if shared_req and shared_req.category else None,
                "request_status": shared_req.status if shared_req else None,
                "request_address": shared_req.address if shared_req else None,
                "last_message": last_msg.content if last_msg else "",
                "last_message_at": (
                    last_msg.created_at.isoformat()
                    if last_msg
                    else (shared_req.updated_at.isoformat() if shared_req else None)
                ),
                "unread_count": unread_count,
            })

        # Trier les conversations avec messages récents ou missions en premier
        conversations.sort(
            key=lambda c: (
                1 if c["last_message"] else 0,
                1 if c["request_id"] else 0,
                c["last_message_at"] or "",
            ),
            reverse=True,
        )
        return Response(conversations)


class DirectConversationMessagesView(generics.GenericAPIView):
    """
    Lecture et envoi de messages HTTP REST entre l'utilisateur connecté et un interlocuteur (partner_id).
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MissionMessageSerializer

    def get(self, request, partner_id=None):
        _ensure_mission_message_table()
        user = request.user
        partner = get_object_or_404(User, pk=partner_id)

        shared_req = (
            ServiceRequest.objects.filter(
                models.Q(client=user, technician=partner)
                | models.Q(client=partner, technician=user)
            )
            .select_related("category")
            .order_by("-updated_at")
            .first()
        )

        msg_filter = models.Q(sender=user, recipient=partner) | models.Q(sender=partner, recipient=user)
        if shared_req:
            msg_filter |= models.Q(request=shared_req)

        messages = (
            MissionMessage.objects.filter(msg_filter)
            .select_related("sender", "recipient")
            .order_by("created_at", "id")
        )

        # Marquer les messages reçus comme lus
        MissionMessage.objects.filter(sender=partner, recipient=user, is_read=False).update(is_read=True)

        return Response({
            "partner": {
                "id": partner.id,
                "username": partner.username,
                "email": partner.email,
                "phone": partner.phone or "",
                "role": partner.role,
            },
            "request": {
                "id": shared_req.id,
                "category_name": shared_req.category.name if shared_req.category else "Service",
                "status": shared_req.status,
                "description": shared_req.description,
                "address": shared_req.address,
            } if shared_req else None,
            "messages": MissionMessageSerializer(messages, many=True).data,
        })

    def post(self, request, partner_id=None):
        _ensure_mission_message_table()
        user = request.user
        partner = get_object_or_404(User, pk=partner_id)
        content = (request.data.get("content") or "").strip()
        if not content:
            raise ValidationError({"content": "Le message ne peut pas être vide."})

        req_id = request.data.get("request_id")
        shared_req = None
        if req_id:
            shared_req = ServiceRequest.objects.filter(pk=req_id).first()
        if not shared_req:
            shared_req = (
                ServiceRequest.objects.filter(
                    models.Q(client=user, technician=partner)
                    | models.Q(client=partner, technician=user)
                )
                .order_by("-updated_at")
                .first()
            )

        msg = MissionMessage.objects.create(
            request=shared_req,
            sender=user,
            recipient=partner,
            content=content,
        )
        return Response(MissionMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class ServiceRequestLocationView(generics.GenericAPIView):
    """
    Emission de position GPS par le technicien assigné pendant le statut 'en_route'.
    """
    permission_classes = [IsTechnician]

    def post(self, request, pk=None):
        from django.contrib.gis.geos import Point
        from .utils import calculate_eta_minutes, calculate_haversine_distance

        service_request = get_object_or_404(ServiceRequest, pk=pk)
        if service_request.technician_id != request.user.id:
            raise PermissionDenied("Vous n'êtes pas le technicien assigné à cette mission.")

        if service_request.status not in (ServiceRequest.Status.EN_ROUTE, ServiceRequest.Status.IN_PROGRESS):
            raise ValidationError({"detail": "Le suivi GPS est actif uniquement lorsque le statut est 'En route'."})

        lat = request.data.get("latitude")
        lng = request.data.get("longitude")
        if lat is None or lng is None:
            raise ValidationError({"detail": "latitude et longitude sont requis."})

        try:
            lat = float(lat)
            lng = float(lng)
        except (ValueError, TypeError):
            raise ValidationError({"detail": "Coordonnées invalides."})

        # Mettre à jour la position du technicien
        profile = getattr(request.user, "technician_profile", None)
        if profile:
            profile.location = Point(x=lng, y=lat, srid=4326)
            profile.save(update_fields=["location"])

        # Calcul distance & ETA vers l'adresse du client
        client_lat = service_request.latitude or 36.8065
        client_lng = service_request.longitude or 10.1815
        dist_km = calculate_haversine_distance(lat, lng, client_lat, client_lng)
        eta_min = calculate_eta_minutes(dist_km)

        data = {
            "request_id": service_request.id,
            "status": service_request.status,
            "technician_lat": lat,
            "technician_lng": lng,
            "client_lat": client_lat,
            "client_lng": client_lng,
            "distance_km": dist_km,
            "eta_minutes": eta_min,
            "technician_name": request.user.username,
        }
        return Response(data, status=status.HTTP_200_OK)


class ServiceRequestTrackingView(generics.GenericAPIView):
    """
    Consultation de l'état du trajet en direct par le client, le technicien ou l'admin.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk=None):
        from .utils import calculate_eta_minutes, calculate_haversine_distance
        service_request = get_object_or_404(ServiceRequest, pk=pk)

        user = request.user
        if user.role != "admin" and user.id not in (service_request.client_id, service_request.technician_id):
            raise PermissionDenied("Vous n'êtes pas autorisé à suivre cette mission.")

        tech_profile = getattr(service_request.technician, "technician_profile", None) if service_request.technician else None
        tech_lat = tech_profile.latitude if tech_profile else None
        tech_lng = tech_profile.longitude if tech_profile else None
        client_lat = service_request.latitude or 36.8065
        client_lng = service_request.longitude or 10.1815

        dist_km = None
        eta_min = None
        if tech_lat is not None and tech_lng is not None:
            dist_km = calculate_haversine_distance(tech_lat, tech_lng, client_lat, client_lng)
            eta_min = calculate_eta_minutes(dist_km)

        return Response({
            "request_id": service_request.id,
            "status": service_request.status,
            "status_display": service_request.get_status_display(),
            "technician_name": service_request.technician.username if service_request.technician else None,
            "technician_phone": service_request.technician.phone if service_request.technician else "",
            "technician_lat": tech_lat,
            "technician_lng": tech_lng,
            "client_lat": client_lat,
            "client_lng": client_lng,
            "client_address": service_request.address,
            "distance_km": dist_km,
            "eta_minutes": eta_min,
            "is_en_route": service_request.status == ServiceRequest.Status.EN_ROUTE,
        })




