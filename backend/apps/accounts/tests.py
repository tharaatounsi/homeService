from types import SimpleNamespace

from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.technicians.models import TechnicianProfile

from .models import User
from .permissions import IsAdminRole, IsClient, IsTechnician

PASSWORD = "Str0ng-pass!23"


class UserModelTests(TestCase):
    def test_default_role_is_client(self):
        user = User.objects.create_user("amine", "amine@example.com", PASSWORD)
        self.assertEqual(user.role, User.Role.CLIENT)

    def test_superuser_is_admin(self):
        user = User.objects.create_superuser("root", "root@example.com", PASSWORD)
        self.assertEqual(user.role, User.Role.ADMIN)

    def test_health_endpoint(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


class AuthApiTests(APITestCase):
    register_url = "/api/auth/register/"
    login_url = "/api/auth/login/"
    refresh_url = "/api/auth/refresh/"
    me_url = "/api/auth/me/"

    def payload(self, **extra):
        data = {"username": "amine", "email": "amine@example.com", "password": PASSWORD, "role": "client"}
        data.update(extra)
        return data

    def login(self, email="amine@example.com", password=PASSWORD):
        return self.client.post(self.login_url, {"email": email, "password": password}, format="json")

    def test_register_client(self):
        response = self.client.post(self.register_url, self.payload(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("password", response.json())
        self.assertEqual(User.objects.get(email="amine@example.com").role, "client")

    def test_register_technician_creates_profile(self):
        response = self.client.post(
            self.register_url, self.payload(role="technician", email="tech@example.com", username="tech"),
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="tech@example.com")
        self.assertTrue(TechnicianProfile.objects.filter(user=user).exists())

    def test_cannot_register_as_admin(self):
        response = self.client.post(self.register_url, self.payload(role="admin"), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="amine@example.com").exists())

    def test_duplicate_email_rejected(self):
        self.client.post(self.register_url, self.payload(), format="json")
        response = self.client.post(self.register_url, self.payload(username="autre"), format="json")
        self.assertEqual(response.status_code, 400)

    def test_weak_password_rejected(self):
        response = self.client.post(self.register_url, self.payload(password="12345678"), format="json")
        self.assertEqual(response.status_code, 400)

    def test_login_returns_tokens_user_and_role_claim(self):
        self.client.post(self.register_url, self.payload(), format="json")
        response = self.login()
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("access", body)
        self.assertIn("refresh", body)
        self.assertEqual(body["user"]["role"], "client")
        self.assertEqual(AccessToken(body["access"])["role"], "client")

    def test_login_wrong_password(self):
        self.client.post(self.register_url, self.payload(), format="json")
        self.assertEqual(self.login(password="mauvais").status_code, 401)

    def test_me_requires_authentication(self):
        self.assertEqual(self.client.get(self.me_url).status_code, 401)

    def test_me_returns_and_updates_profile(self):
        self.client.post(self.register_url, self.payload(), format="json")
        token = self.login().json()["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get(self.me_url).json()["email"], "amine@example.com")
        response = self.client.patch(self.me_url, {"phone": "+21650000000", "role": "admin"}, format="json")
        self.assertEqual(response.status_code, 200)
        user = User.objects.get(email="amine@example.com")
        self.assertEqual(user.phone, "+21650000000")
        self.assertEqual(user.role, "client")  # le rôle ne peut pas être modifié

    def test_refresh_token(self):
        self.client.post(self.register_url, self.payload(), format="json")
        refresh = self.login().json()["refresh"]
        response = self.client.post(self.refresh_url, {"refresh": refresh}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.json())


class PermissionTests(TestCase):
    def request_for(self, user):
        return SimpleNamespace(user=user)

    def test_role_permissions(self):
        tech = User.objects.create_user("tech", "tech@example.com", PASSWORD, role="technician")
        self.assertTrue(IsTechnician().has_permission(self.request_for(tech), None))
        self.assertFalse(IsClient().has_permission(self.request_for(tech), None))
        self.assertFalse(IsAdminRole().has_permission(self.request_for(tech), None))
