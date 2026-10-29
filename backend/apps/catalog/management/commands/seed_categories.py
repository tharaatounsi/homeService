from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.catalog.models import Category

CATEGORIES = [
    "Plomberie",
    "Électricité",
    "Ménage",
    "Climatisation",
    "Peinture",
    "Serrurerie",
    "Jardinage",
    "Menuiserie",
]


class Command(BaseCommand):
    help = "Initialise les catégories par défaut du catalogue sans doublons."

    def handle(self, *args, **options):
        count = 0
        for name in CATEGORIES:
            slug = slugify(name)
            obj, created = Category.objects.get_or_create(
                slug=slug,
                defaults={"name": name},
            )
            if created:
                count += 1
                self.stdout.write(self.style.SUCCESS(f"Catégorie créée : {name}"))
            else:
                self.stdout.write(f"Catégorie existante : {name}")

        self.stdout.write(self.style.SUCCESS(f"Seed terminé : {count} nouvelle(s) catégorie(s) créée(s)."))
