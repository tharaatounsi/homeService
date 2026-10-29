from django.contrib.gis.geos import Point
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category
from apps.technicians.models import TechnicianProfile


class TechnicianTests(APITestCase):
    def setUp(self):
        # Création de catégories
        self.cat1 = Category.objects.create(name="Plomberie", slug="plomberie")
        self.cat2 = Category.objects.create(name="Électricité", slug="electricite")

        # Utilisateur Technicien 1
        self.tech_user = User.objects.create_user(
            email="tech@example.com",
            username="tech1",
            password="Password123!",
            role=User.Role.TECHNICIAN,
        )
        self.profile = TechnicianProfile.objects.create(user=self.tech_user)

        # Utilisateur Technicien 2
        self.tech_user2 = User.objects.create_user(
            email="tech2@example.com",
            username="tech2",
            password="Password123!",
            role=User.Role.TECHNICIAN,
        )
        self.profile2 = TechnicianProfile.objects.create(user=self.tech_user2)

        # Utilisateur Client
        self.client_user = User.objects.create_user(
            email="client@example.com",
            username="client1",
            password="Password123!",
            role=User.Role.CLIENT,
        )

        # Utilisateur Admin
        self.admin_user = User.objects.create_user(
            email="admin@example.com",
            username="admin1",
            password="Password123!",
            role=User.Role.ADMIN,
        )

    # --- 1. PROFIL ---

    def test_get_profile_unauthenticated(self):
        response = self.client.get("/api/technicians/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_profile_client_forbidden(self):
        self.client.force_authenticate(user=self.client_user)
        response = self.client.get("/api/technicians/me/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_profile_technician_success(self):
        self.client.force_authenticate(user=self.tech_user)
        response = self.client.get("/api/technicians/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "tech1")

    def test_update_profile_success(self):
        self.client.force_authenticate(user=self.tech_user)
        data = {
            "bio": "Expert plombier avec 5 ans d'expérience.",
            "experience_years": 5,
            "service_radius_km": 25,
            "categories": [self.cat1.id, self.cat2.id],
            "latitude": 36.8065,
            "longitude": 10.1815,
        }
        response = self.client.patch("/api/technicians/me/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["experience_years"], 5)
        self.assertEqual(response.data["latitude"], 36.8065)
        self.assertEqual(response.data["longitude"], 10.1815)
        self.assertTrue(response.data["is_complete"])

    def test_update_profile_latitude_without_longitude(self):
        self.client.force_authenticate(user=self.tech_user)
        data = {"latitude": 36.8065}
        response = self.client.patch("/api/technicians/me/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_profile_invalid_coordinates(self):
        self.client.force_authenticate(user=self.tech_user)
        data = {"latitude": 150.0, "longitude": 10.1815}
        response = self.client.patch("/api/technicians/me/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_profile_unmodifiable_fields(self):
        self.client.force_authenticate(user=self.tech_user)
        data = {"is_approved": True, "is_available": True, "rating_avg": 5.0}
        response = self.client.patch("/api/technicians/me/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_approved"])
        self.assertFalse(response.data["is_available"])

    def test_remove_categories_forces_offline(self):
        # Préparer le profil valide et approuvé
        self.profile.is_approved = True
        self.profile.location = Point(x=10.1815, y=36.8065, srid=4326)
        self.profile.categories.set([self.cat1])
        self.profile.is_available = True
        self.profile.save()

        self.client.force_authenticate(user=self.tech_user)
        data = {"categories": []}
        response = self.client.patch("/api/technicians/me/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_available"])

    # --- 2. STATUT EN LIGNE / HORS LIGNE ---

    def test_status_online_unapproved_rejected(self):
        self.profile.location = Point(x=10.1815, y=36.8065, srid=4326)
        self.profile.categories.set([self.cat1])
        self.profile.save()

        self.client.force_authenticate(user=self.tech_user)
        response = self.client.post("/api/technicians/me/status/", {"is_available": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_status_online_incomplete_rejected(self):
        self.profile.is_approved = True
        self.profile.save()

        self.client.force_authenticate(user=self.tech_user)
        response = self.client.post("/api/technicians/me/status/", {"is_available": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_status_online_offline_success(self):
        self.profile.is_approved = True
        self.profile.location = Point(x=10.1815, y=36.8065, srid=4326)
        self.profile.categories.set([self.cat1])
        self.profile.save()

        self.client.force_authenticate(user=self.tech_user)

        # Passer en ligne
        res_online = self.client.post("/api/technicians/me/status/", {"is_available": True}, format="json")
        self.assertEqual(res_online.status_code, status.HTTP_200_OK)
        self.assertTrue(res_online.data["is_available"])

        # Passer hors ligne
        res_offline = self.client.post("/api/technicians/me/status/", {"is_available": False}, format="json")
        self.assertEqual(res_offline.status_code, status.HTTP_200_OK)
        self.assertFalse(res_offline.data["is_available"])

    # --- 3. DISPONIBILITÉS (SCHEDULE) ---

    def test_schedule_create_and_replace(self):
        self.client.force_authenticate(user=self.tech_user)
        data = {
            "slots": [
                {"weekday": 0, "start_time": "08:00:00", "end_time": "12:00:00"},
                {"weekday": 0, "start_time": "14:00:00", "end_time": "18:00:00"},
            ]
        }
        res_put = self.client.put("/api/technicians/me/schedule/", data, format="json")
        self.assertEqual(res_put.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_put.data["slots"]), 2)

        res_get = self.client.get("/api/technicians/me/schedule/")
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_get.data["slots"]), 2)

    def test_schedule_overlapping_slots_rejected(self):
        self.client.force_authenticate(user=self.tech_user)
        data = {
            "slots": [
                {"weekday": 0, "start_time": "08:00:00", "end_time": "12:00:00"},
                {"weekday": 0, "start_time": "11:00:00", "end_time": "15:00:00"},
            ]
        }
        response = self.client.put("/api/technicians/me/schedule/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_schedule_end_before_start_rejected(self):
        self.client.force_authenticate(user=self.tech_user)
        data = {
            "slots": [
                {"weekday": 0, "start_time": "14:00:00", "end_time": "10:00:00"},
            ]
        }
        response = self.client.put("/api/technicians/me/schedule/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_schedule_same_times_different_weekdays_accepted(self):
        self.client.force_authenticate(user=self.tech_user)
        data = {
            "slots": [
                {"weekday": 0, "start_time": "08:00:00", "end_time": "12:00:00"},
                {"weekday": 1, "start_time": "08:00:00", "end_time": "12:00:00"},
            ]
        }
        response = self.client.put("/api/technicians/me/schedule/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["slots"]), 2)

    # --- 4. ADMIN ---

    def test_admin_list_forbidden_for_technician(self):
        self.client.force_authenticate(user=self.tech_user)
        response = self.client.get("/api/technicians/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_list_and_filter_approved(self):
        self.profile.is_approved = True
        self.profile.save()

        self.client.force_authenticate(user=self.admin_user)
        res_all = self.client.get("/api/technicians/")
        self.assertEqual(res_all.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_all.data), 2)

        res_approved = self.client.get("/api/technicians/?approved=true")
        self.assertEqual(res_approved.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_approved.data), 1)

        res_unapproved = self.client.get("/api/technicians/?approved=false")
        self.assertEqual(res_unapproved.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_unapproved.data), 1)

    def test_admin_approve_and_reject_technician(self):
        self.client.force_authenticate(user=self.admin_user)

        # Approve
        res_app = self.client.post(f"/api/technicians/{self.profile.id}/approve/")
        self.assertEqual(res_app.status_code, status.HTTP_200_OK)
        self.assertTrue(res_app.data["is_approved"])

        # Reject
        res_rej = self.client.post(f"/api/technicians/{self.profile.id}/reject/")
        self.assertEqual(res_rej.status_code, status.HTTP_200_OK)
        self.assertFalse(res_rej.data["is_approved"])
        self.assertFalse(res_rej.data["is_available"])

    def test_admin_approve_unknown_id_404(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post("/api/technicians/9999/approve/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_create_and_delete_technician(self):
        self.client.force_authenticate(user=self.admin_user)

        # Créer un technicien par l'admin
        create_data = {
            "username": "new_tech_by_admin",
            "email": "new_tech_admin@example.com",
            "password": "Password123!",
            "phone": "+21620000000",
        }
        res_create = self.client.post("/api/technicians/", create_data, format="json")
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        tech_id = res_create.data["id"]

        # Supprimer le technicien créé par l'admin
        res_delete = self.client.delete(f"/api/technicians/{tech_id}/")
        self.assertEqual(res_delete.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(email="new_tech_admin@example.com").exists())

    # --- 5. CATÉGORIES PUBLIQUES ---

    def test_public_categories_list_unauthenticated(self):
        response = self.client.get("/api/catalog/categories/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_public_technicians_list_unauthenticated(self):
        self.profile.is_approved = True
        self.profile.save()

        response = self.client.get("/api/technicians/public/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertNotIn("email", response.data[0])
        self.assertNotIn("phone", response.data[0])
        self.assertEqual(response.data[0]["username"], "tech1")