from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        CLIENT = "client", "Client"
        TECHNICIAN = "technician", "Technicien"
        ADMIN = "admin", "Administrateur"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CLIENT)
    phone = models.CharField(max_length=20, blank=True)

    # iconecty bl email chaque utilisateur
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def save(self, *args, **kwargs):
        # ladmin hoia super user
        if self.is_superuser:
            self.role = self.Role.ADMIN
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.role})"