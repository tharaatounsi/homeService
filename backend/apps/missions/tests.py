from django.contrib.gis.geos import Point
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category
from apps.missions.models import ServiceRequest
from apps.technicians.models import TechnicianProfile

PASSWORD = "Password123!"


class ServiceRequestLifecycleTests(APITestCase):
    def setUp(self):
        # 1. Catégorie
        self.category = Category.objects.create(name="Plomberie", slug="plomberie")

        # 2. Client
        self.client_user = User.objects.create_user(
            username="client1",
            email="client1@example.com",
            password=PASSWORD,
            role=User.Role.CLIENT,
        )

        # 3. Autre client
        self.other_client = User.objects.create_user(
            username="client2",
            email="client2@example.com",
            password=PASSWORD,
            role=User.Role.CLIENT,
        )

        # 4. Technicien approuvé
        self.tech_user = User.objects.create_user(
            username="tech_approved",
            email="tech_app@example.com",
            password=PASSWORD,
            role=User.Role.TECHNICIAN,
        )
        self.tech_profile = TechnicianProfile.objects.create(
            user=self.tech_user,
            is_approved=True,
            location=Point(x=10.18, y=36.80, srid=4326),
        )

        # 5. Technicien NON approuvé
        self.unapproved_tech = User.objects.create_user(
            username="tech_unapproved",
            email="tech_unapp@example.com",
            password=PASSWORD,
            role=User.Role.TECHNICIAN,
        )
        self.unapproved_profile = TechnicianProfile.objects.create(
            user=self.unapproved_tech,
            is_approved=False,
        )

        # 6. Demande initiale
        self.request_obj = ServiceRequest.objects.create(
            client=self.client_user,
            category=self.category,
            description="Fuite lavabo",
            address="12 Rue Habib Bourguiba, Tunis",
            location=Point(x=10.18, y=36.80, srid=4326),
            status=ServiceRequest.Status.PENDING,
        )

    def test_client_create_request(self):
        self.client.force_authenticate(user=self.client_user)
        payload = {
            "category": self.category.id,
            "description": "Panne chauffe-eau",
            "address": "Ariana",
            "latitude": 36.86,
            "longitude": 10.19,
            "urgency": "high",
        }
        res = self.client.post("/api/missions/requests/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["status"], "pending")
        self.assertEqual(res.data["category_name"], "Plomberie")

    def test_unapproved_tech_cannot_accept(self):
        self.client.force_authenticate(user=self.unapproved_tech)
        res = self.client.post(f"/api/missions/requests/{self.request_obj.id}/accept/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_approved_tech_accept_success(self):
        self.client.force_authenticate(user=self.tech_user)
        res = self.client.post(f"/api/missions/requests/{self.request_obj.id}/accept/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "accepted")
        self.assertEqual(res.data["technician"], self.tech_user.id)

    def test_lifecycle_transitions_success(self):
        # 1. Accept
        self.client.force_authenticate(user=self.tech_user)
        res1 = self.client.post(f"/api/missions/requests/{self.request_obj.id}/accept/")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # 2. En route
        res2 = self.client.post(
            f"/api/missions/requests/{self.request_obj.id}/status/",
            {"status": "en_route"},
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["status"], "en_route")

        # 3. In progress
        res3 = self.client.post(
            f"/api/missions/requests/{self.request_obj.id}/status/",
            {"status": "in_progress"},
            format="json",
        )
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        self.assertEqual(res3.data["status"], "in_progress")

        # 4. Completed
        res4 = self.client.post(
            f"/api/missions/requests/{self.request_obj.id}/status/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(res4.status_code, status.HTTP_200_OK)
        self.assertEqual(res4.data["status"], "completed")

    def test_invalid_transition_rejected(self):
        self.client.force_authenticate(user=self.tech_user)
        self.client.post(f"/api/missions/requests/{self.request_obj.id}/accept/")

        # Sauter directement à completed sans passer par en_route / in_progress
        res = self.client.post(
            f"/api/missions/requests/{self.request_obj.id}/status/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_client_cancel_request_success(self):
        self.client.force_authenticate(user=self.client_user)
        res = self.client.post(f"/api/missions/requests/{self.request_obj.id}/cancel/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "cancelled")

    def test_stranger_cannot_cancel_request(self):
        self.client.force_authenticate(user=self.other_client)
        res = self.client.post(f"/api/missions/requests/{self.request_obj.id}/cancel/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_cancel_in_progress_request(self):
        self.request_obj.status = ServiceRequest.Status.IN_PROGRESS
        self.request_obj.technician = self.tech_user
        self.request_obj.save()

        self.client.force_authenticate(user=self.client_user)
        res = self.client.post(f"/api/missions/requests/{self.request_obj.id}/cancel/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_technician_available_missions_list(self):
        self.tech_profile.categories.add(self.category)
        self.client.force_authenticate(user=self.tech_user)

        res = self.client.get("/api/missions/requests/?scope=available")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["id"], self.request_obj.id)

    def test_events_tracking_in_detail(self):
        self.client.force_authenticate(user=self.tech_user)
        self.client.post(f"/api/missions/requests/{self.request_obj.id}/accept/")

        # Consultation du détail
        res = self.client.get(f"/api/missions/requests/{self.request_obj.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["client_name"], "client1")
        self.assertEqual(res.data["technician_name"], "tech_approved")
        self.assertTrue(len(res.data["events"]) >= 1)
        self.assertEqual(res.data["events"][0]["to_status"], "accepted")


class PostGISSpatialMatchingTests(APITestCase):
    def setUp(self):
        self.plumbing = Category.objects.create(name="Plomberie", slug="plomberie")
        self.electricity = Category.objects.create(name="Électricité", slug="electricite")

        # Client à Tunis Centre (36.8065, 10.1815)
        self.client_user = User.objects.create_user(
            username="client_tunis",
            email="client_tunis@example.com",
            password=PASSWORD,
            role=User.Role.CLIENT,
        )

        # Mission Plomberie à Tunis Centre (36.8065, 10.1815)
        self.mission = ServiceRequest.objects.create(
            client=self.client_user,
            category=self.plumbing,
            description="Robinet qui fuit",
            address="Avenue Habib Bourguiba, Tunis",
            location=Point(x=10.1815, y=36.8065, srid=4326),
            status=ServiceRequest.Status.PENDING,
        )

        # 1. Tech Proche (Ariana: 36.8665, 10.1947, ~7 km de Tunis), Rayon 15 km -> DOIT MATCHER
        self.near_tech = User.objects.create_user(
            username="tech_near",
            email="near@example.com",
            password=PASSWORD,
            role=User.Role.TECHNICIAN,
        )
        self.near_profile = TechnicianProfile.objects.create(
            user=self.near_tech,
            is_approved=True,
            is_available=True,
            service_radius_km=15,
            location=Point(x=10.1947, y=36.8665, srid=4326),
        )
        self.near_profile.categories.add(self.plumbing)

        # 2. Tech Loin (Sousse: 35.8256, 10.6369, ~120 km de Tunis), Rayon 10 km -> NE DOIT PAS MATCHER
        self.far_tech = User.objects.create_user(
            username="tech_far",
            email="far@example.com",
            password=PASSWORD,
            role=User.Role.TECHNICIAN,
        )
        self.far_profile = TechnicianProfile.objects.create(
            user=self.far_tech,
            is_approved=True,
            is_available=True,
            service_radius_km=10,
            location=Point(x=10.6369, y=35.8256, srid=4326),
        )
        self.far_profile.categories.add(self.plumbing)

        # 3. Tech Proche mais Indisponible -> NE DOIT PAS MATCHER
        self.busy_tech = User.objects.create_user(
            username="tech_busy",
            email="busy@example.com",
            password=PASSWORD,
            role=User.Role.TECHNICIAN,
        )
        self.busy_profile = TechnicianProfile.objects.create(
            user=self.busy_tech,
            is_approved=True,
            is_available=False,
            service_radius_km=20,
            location=Point(x=10.1815, y=36.8065, srid=4326),
        )
        self.busy_profile.categories.add(self.plumbing)

        # 4. Tech Proche mais Mauvaise Catégorie (Électricité) -> NE DOIT PAS MATCHER
        self.elec_tech = User.objects.create_user(
            username="tech_elec",
            email="elec@example.com",
            password=PASSWORD,
            role=User.Role.TECHNICIAN,
        )
        self.elec_profile = TechnicianProfile.objects.create(
            user=self.elec_tech,
            is_approved=True,
            is_available=True,
            service_radius_km=20,
            location=Point(x=10.1815, y=36.8065, srid=4326),
        )
        self.elec_profile.categories.add(self.electricity)

    def test_find_matching_technicians_spatial_filter(self):
        from apps.missions.services import find_matching_technicians

        matched = list(find_matching_technicians(self.mission))
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].user.username, "tech_near")
        # Vérifie que la distance annotée est bien calculée (~6-8 km)
        self.assertTrue(5.0 <= matched[0].distance.km <= 10.0)

    def test_matching_technicians_api_endpoint(self):
        self.client.force_authenticate(user=self.client_user)
        res = self.client.get(f"/api/missions/requests/{self.mission.id}/matching-technicians/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["username"], "tech_near")
        self.assertIsNotNone(res.data[0]["distance_km"])
        self.assertTrue(5.0 <= res.data[0]["distance_km"] <= 10.0)

    def test_technician_available_missions_distance_annotation(self):
        # Le technicien proche consulte ses missions disponibles
        self.client.force_authenticate(user=self.near_tech)
        res = self.client.get("/api/missions/requests/?scope=available")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["id"], self.mission.id)
        self.assertIsNotNone(res.data[0]["distance_km"])

        # Le technicien de Sousse ne doit PAS voir la mission de Tunis
        self.client.force_authenticate(user=self.far_tech)
        res_far = self.client.get("/api/missions/requests/?scope=available")
        self.assertEqual(res_far.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_far.data), 0)


class CeleryExpirationTests(APITestCase):
    def setUp(self):
        self.cat = Category.objects.create(name="Plomberie", slug="plomberie")
        self.client_user = User.objects.create_user(
            username="client_exp",
            email="client_exp@example.com",
            password=PASSWORD,
            role=User.Role.CLIENT,
        )

    def test_expire_unassigned_requests_task(self):
        from datetime import timedelta
        from django.utils import timezone
        from apps.missions.tasks import expire_unassigned_requests_task

        # Demande 1 : créée il y a 30 heures (doit expirer)
        old_req = ServiceRequest.objects.create(
            client=self.client_user,
            category=self.cat,
            description="Ancienne demande",
            address="Tunis",
            location=Point(x=10.18, y=36.80, srid=4326),
            status=ServiceRequest.Status.PENDING,
        )
        ServiceRequest.objects.filter(id=old_req.id).update(
            created_at=timezone.now() - timedelta(hours=30)
        )

        # Demande 2 : créée récemment (ne doit pas expirer)
        recent_req = ServiceRequest.objects.create(
            client=self.client_user,
            category=self.cat,
            description="Demande récente",
            address="Tunis",
            location=Point(x=10.18, y=36.80, srid=4326),
            status=ServiceRequest.Status.PENDING,
        )

        # Exécution de la tâche
        expired_count = expire_unassigned_requests_task(max_age_hours=24)
        self.assertEqual(expired_count, 1)

        old_req.refresh_from_db()
        recent_req.refresh_from_db()

        self.assertEqual(old_req.status, ServiceRequest.Status.CANCELLED)
        self.assertEqual(recent_req.status, ServiceRequest.Status.PENDING)
        self.assertTrue(old_req.events.filter(note__icontains="Expirée").exists())


from django.test import TransactionTestCase


class WebSocketMissionConsumerTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="ws_test_user",
            email="ws_test@example.com",
            password=PASSWORD,
            role=User.Role.CLIENT,
        )

    async def _test_auth_flow(self):
        from channels.testing import WebsocketCommunicator
        from config.asgi import application
        from rest_framework_simplejwt.tokens import RefreshToken

        token = str(RefreshToken.for_user(self.user).access_token)
        comm = WebsocketCommunicator(application, f"/ws/missions/?token={token}")
        connected, _ = await comm.connect()
        self.assertTrue(connected)
        await comm.disconnect()

    async def _test_anon_flow(self):
        from channels.testing import WebsocketCommunicator
        from config.asgi import application

        comm = WebsocketCommunicator(application, "/ws/missions/")
        connected, code = await comm.connect()
        self.assertFalse(connected)
        self.assertEqual(code, 4401)
        await comm.disconnect()

    def test_websocket_anonymous_rejected(self):
        import asyncio

        asyncio.run(self._test_anon_flow())

    def test_websocket_authenticated_accepted(self):
        import asyncio

        asyncio.run(self._test_auth_flow())


class ClientTechnicianMessagingTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Plomberie", slug="plomberie")
        self.client_user = User.objects.create_user(
            username="molka",
            email="molka12@gmail.com",
            password="123456789++",
            role=User.Role.CLIENT,
            phone="+21622111222",
        )
        self.tech_user = User.objects.create_user(
            username="ahmed",
            email="ahmed12@gmail.com",
            password="123456789++",
            role=User.Role.TECHNICIAN,
            phone="+21655333444",
        )
        self.tech_profile = TechnicianProfile.objects.create(
            user=self.tech_user,
            is_approved=True,
            is_available=True,
            location=Point(x=10.1815, y=36.8065, srid=4326),
        )
        self.tech_profile.categories.add(self.category)

    def test_direct_conversation_and_messages_http_rest(self):
        # 1. Client lists conversations -> sees technician ahmed
        self.client.force_authenticate(user=self.client_user)
        conv_res = self.client.get("/api/missions/conversations/")
        self.assertEqual(conv_res.status_code, status.HTTP_200_OK)
        partner_emails = [c["partner_email"] for c in conv_res.data]
        self.assertIn("ahmed12@gmail.com", partner_emails)

        # 2. Client sends message to technician
        send_res = self.client.post(
            f"/api/missions/conversations/{self.tech_user.id}/messages/",
            {"content": "Bonjour Ahmed, pouvez-vous intervenir aujourd'hui ?"},
            format="json",
        )
        self.assertEqual(send_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(send_res.data["sender_email"], "molka12@gmail.com")

        # 3. Technician reads messages and replies
        self.client.force_authenticate(user=self.tech_user)
        read_res = self.client.get(f"/api/missions/conversations/{self.client_user.id}/messages/")
        self.assertEqual(read_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(read_res.data["messages"]), 1)
        self.assertEqual(read_res.data["partner"]["email"], "molka12@gmail.com")

        reply_res = self.client.post(
            f"/api/missions/conversations/{self.client_user.id}/messages/",
            {"content": "Oui bonjour Molka, je suis en route !"},
            format="json",
        )
        self.assertEqual(reply_res.status_code, status.HTTP_201_CREATED)

    def test_full_lifecycle_molka_and_ahmed_journey(self):
        """
        Test de bout en bout du parcours complet Molka (Cliente) et Ahmed (Plombier) :
        1. Molka crée la demande (Fuite d'eau)
        2. Ahmed consulte les missions disponibles dans son rayon et sa catégorie
        3. Ahmed accepte la mission
        4. Molka et Ahmed échangent par messagerie directe
        5. Ahmed passe en route (en_route)
        6. Ahmed passe en cours (in_progress)
        7. Ahmed termine l'intervention (completed)
        8. Clôture / Paiement (paid)
        9. Vérification de l'historique d'audit complet (RequestStatusEvent)
        """
        # 1. Molka crée la demande de plomberie
        self.client.force_authenticate(user=self.client_user)
        create_res = self.client.post(
            "/api/missions/requests/",
            {
                "category": self.category.id,
                "description": "Fuite d'eau urgente sous l'évier de la cuisine.",
                "address": "Avenue Habib Bourguiba, Tunis",
                "latitude": 36.8065,
                "longitude": 10.1815,
                "urgency": "high",
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        req_id = create_res.data["id"]
        self.assertEqual(create_res.data["status"], "pending")

        # 2. Ahmed voit la mission disponible
        self.client.force_authenticate(user=self.tech_user)
        avail_res = self.client.get("/api/missions/requests/?scope=available")
        self.assertEqual(avail_res.status_code, status.HTTP_200_OK)
        avail_ids = [m["id"] for m in avail_res.data]
        self.assertIn(req_id, avail_ids)

        # 3. Ahmed accepte la mission
        accept_res = self.client.post(f"/api/missions/requests/{req_id}/accept/")
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)
        self.assertEqual(accept_res.data["status"], "accepted")
        self.assertEqual(accept_res.data["technician"], self.tech_user.id)

        # 4. Échange par messagerie
        self.client.force_authenticate(user=self.client_user)
        msg_res = self.client.post(
            f"/api/missions/conversations/{self.tech_user.id}/messages/",
            {"content": "Code interphone : B12, 3ème étage.", "request_id": req_id},
            format="json",
        )
        self.assertEqual(msg_res.status_code, status.HTTP_201_CREATED)

        # 5. Ahmed passe 'en_route'
        self.client.force_authenticate(user=self.tech_user)
        res_en_route = self.client.post(
            f"/api/missions/requests/{req_id}/status/",
            {"status": "en_route"},
            format="json",
        )
        self.assertEqual(res_en_route.status_code, status.HTTP_200_OK)
        self.assertEqual(res_en_route.data["status"], "en_route")

        # 6. Ahmed passe 'in_progress'
        res_in_progress = self.client.post(
            f"/api/missions/requests/{req_id}/status/",
            {"status": "in_progress"},
            format="json",
        )
        self.assertEqual(res_in_progress.status_code, status.HTTP_200_OK)
        self.assertEqual(res_in_progress.data["status"], "in_progress")

        # 7. Ahmed passe 'completed'
        res_completed = self.client.post(
            f"/api/missions/requests/{req_id}/status/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(res_completed.status_code, status.HTTP_200_OK)
        self.assertEqual(res_completed.data["status"], "completed")

        # 8. Clôture avec paiement 'paid'
        res_paid = self.client.post(
            f"/api/missions/requests/{req_id}/status/",
            {"status": "paid"},
            format="json",
        )
        self.assertEqual(res_paid.status_code, status.HTTP_200_OK)
        self.assertEqual(res_paid.data["status"], "paid")

        # 9. Vérification de la frise d'audit chronologique
        detail_res = self.client.get(f"/api/missions/requests/{req_id}/")
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        events = detail_res.data["events"]
        status_transitions = [e["to_status"] for e in events]
        self.assertEqual(status_transitions, ["accepted", "en_route", "in_progress", "completed", "paid"])

    def test_gps_location_emission_and_tracking(self):
        # 1. Molka crée la demande
        self.client.force_authenticate(user=self.client_user)
        res_create = self.client.post(
            "/api/missions/requests/",
            {
                "category": self.category.id,
                "description": "Panne plomberie",
                "address": "Tunis Centre",
                "latitude": 36.8000,
                "longitude": 10.1800,
            },
            format="json",
        )
        req_id = res_create.data["id"]

        # 2. Ahmed accepte
        self.client.force_authenticate(user=self.tech_user)
        self.client.post(f"/api/missions/requests/{req_id}/accept/")

        # 3. Tenter d'émettre GPS avant 'en_route' -> rejet 400
        res_gps_early = self.client.post(
            f"/api/missions/requests/{req_id}/location/",
            {"latitude": 36.8100, "longitude": 10.1850},
            format="json",
        )
        self.assertEqual(res_gps_early.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Ahmed passe 'en_route'
        self.client.post(f"/api/missions/requests/{req_id}/status/", {"status": "en_route"}, format="json")

        # 5. Ahmed émet sa position GPS en route
        res_gps = self.client.post(
            f"/api/missions/requests/{req_id}/location/",
            {"latitude": 36.8200, "longitude": 10.1900},
            format="json",
        )
        self.assertEqual(res_gps.status_code, status.HTTP_200_OK)
        self.assertIn("distance_km", res_gps.data)
        self.assertIn("eta_minutes", res_gps.data)
        self.assertGreater(res_gps.data["distance_km"], 0)

        # 6. Molka (cliente) consulte le tracking en direct
        self.client.force_authenticate(user=self.client_user)
        res_track = self.client.get(f"/api/missions/requests/{req_id}/tracking/")
        self.assertEqual(res_track.status_code, status.HTTP_200_OK)
        self.assertTrue(res_track.data["is_en_route"])
        self.assertEqual(res_track.data["technician_name"], "ahmed")
        self.assertEqual(res_track.data["technician_lat"], 36.8200)
        self.assertEqual(res_track.data["technician_lng"], 10.1900)

    def test_sprint7_quote_hybrid_payment_and_invoice(self):
        """
        Sprint 7 : Devis sur place, Acceptation client, Règlement hybride (En ligne / Espèces)
        avec commission plateforme 10%, et génération de facture officielle.
        """
        # 1. Création et acceptation de la mission
        self.client.force_authenticate(user=self.client_user)
        res_create = self.client.post(
            "/api/missions/requests/",
            {
                "category": self.category.id,
                "description": "Changement robinet mitigeur cuisine",
                "address": "La Marsa, Tunis",
                "latitude": 36.8780,
                "longitude": 10.3247,
            },
            format="json",
        )
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        req_id = res_create.data["id"]

        self.client.force_authenticate(user=self.tech_user)
        self.client.post(f"/api/missions/requests/{req_id}/accept/")
        self.client.post(f"/api/missions/requests/{req_id}/status/", {"status": "en_route"}, format="json")
        self.client.post(f"/api/missions/requests/{req_id}/status/", {"status": "in_progress"}, format="json")

        # 2. Ahmed établit un devis sur place (MO: 45 TND, Pièces: 35 TND -> Total 80 TND)
        res_quote = self.client.post(
            f"/api/missions/requests/{req_id}/quote/",
            {
                "labor_price": "45.00",
                "parts_price": "35.00",
                "description": "Remplacement cartouche mitigeur et flexible inox",
            },
            format="json",
        )
        self.assertEqual(res_quote.status_code, status.HTTP_201_CREATED)
        self.assertEqual(float(res_quote.data["total_price"]), 80.00)
        self.assertEqual(res_quote.data["status"], "pending")

        # 3. Molka consulte et accepte le devis
        self.client.force_authenticate(user=self.client_user)
        res_respond = self.client.post(
            f"/api/missions/requests/{req_id}/quote/respond/",
            {"action": "accept"},
            format="json",
        )
        self.assertEqual(res_respond.status_code, status.HTTP_200_OK)
        self.assertEqual(res_respond.data["status"], "accepted")

        # 4. Ahmed termine l'intervention
        self.client.force_authenticate(user=self.tech_user)
        self.client.post(f"/api/missions/requests/{req_id}/status/", {"status": "completed"}, format="json")

        # 5. Molka procède au règlement en ligne (Mock CB / Konnect)
        self.client.force_authenticate(user=self.client_user)
        res_pay = self.client.post(
            f"/api/missions/requests/{req_id}/pay/",
            {
                "method": "online",
                "amount": "80.00",
                "card_last4": "4242",
            },
            format="json",
        )
        self.assertEqual(res_pay.status_code, status.HTTP_200_OK)
        self.assertTrue(res_pay.data["success"])
        payment = res_pay.data["payment"]
        self.assertEqual(payment["method"], "online")
        self.assertEqual(float(payment["amount"]), 80.00)
        # 10% commission = 8.00 TND, 90% technicien = 72.00 TND
        self.assertEqual(float(payment["platform_fee"]), 8.00)
        self.assertEqual(float(payment["technician_amount"]), 72.00)
        self.assertTrue(payment["transaction_id"].startswith("TXN-SH-"))
        self.assertEqual(res_pay.data["request"]["status"], "paid")

        # 6. Consultation de la facture officielle
        res_inv = self.client.get(f"/api/missions/requests/{req_id}/invoice/")
        self.assertEqual(res_inv.status_code, status.HTTP_200_OK)
        self.assertEqual(res_inv.data["invoice_number"], f"FAC-{req_id:05d}")
        self.assertEqual(res_inv.data["total_amount"], 80.00)
        self.assertEqual(res_inv.data["platform_fee"], 8.00)
        self.assertEqual(res_inv.data["technician_net"], 72.00)
        self.assertTrue(res_inv.data["is_paid"])
        self.assertEqual(len(res_inv.data["items"]), 2)






