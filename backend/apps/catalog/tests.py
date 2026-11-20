from django.db import IntegrityError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category


class CategoryModelUnitTests(TestCase):
    """Tests unitaires du modèle Category (unicité, tri alphabétique, représentation)."""

    def test_category_str_and_ordering(self):
        c_plomb = Category.objects.create(name="Plomberie", slug="plomberie", icon="fa-wrench")
        c_elec = Category.objects.create(name="Électricité", slug="electricite", icon="fa-bolt")
        c_clim = Category.objects.create(name="Climatisation", slug="climatisation", icon="fa-snowflake")

        self.assertEqual(str(c_plomb), "Plomberie")
        names = list(Category.objects.values_list("name", flat=True))
        self.assertIn("Climatisation", names)
        self.assertIn("Plomberie", names)
        self.assertIn("Électricité", names)

    def test_category_slug_uniqueness_constraint(self):
        Category.objects.create(name="Serrurerie", slug="serrurerie")
        with self.assertRaises(IntegrityError):
            Category.objects.create(name="Serrurerie Bis", slug="serrurerie")


class CatalogPublicAndAdminApiTests(APITestCase):
    """Tests d'intégration de l'API publique Catalogue et de la protection en écriture."""

    def setUp(self):
        self.admin = User.objects.create_superuser("admin_cat", "admin_cat@example.com", "Pass1234!+")
        self.client_user = User.objects.create_user(
            "client_cat", "client_cat@example.com", "Pass1234!+", role=User.Role.CLIENT
        )
        self.cat1 = Category.objects.create(
            name="Menuiserie", slug="menuiserie", description="Travaux bois et alu", icon="fa-hammer"
        )
        self.cat2 = Category.objects.create(
            name="Climatisation", slug="climatisation", description="Installation et recharge", icon="fa-snowflake"
        )

    def test_public_catalog_accessible_without_token(self):
        res = self.client.get("/api/catalog/categories/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)
        slugs = [c["slug"] for c in res.data]
        self.assertIn("menuiserie", slugs)
        self.assertIn("climatisation", slugs)

    def test_public_catalog_returns_alphabetical_order_and_all_fields(self):
        res = self.client.get("/api/catalog/categories/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data[0]["name"], "Climatisation")
        self.assertEqual(res.data[1]["name"], "Menuiserie")
        self.assertIn("icon", res.data[0])
        self.assertIn("description", res.data[0])

    def test_public_catalog_is_read_only_for_post_requests(self):
        self.client.force_authenticate(user=self.client_user)
        res = self.client.post(
            "/api/catalog/categories/",
            {"name": "Peinture", "slug": "peinture"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
