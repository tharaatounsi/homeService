from django.contrib.gis.geos import Point
from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import AvailabilitySlot, TechnicianProfile


def create_profile(user) -> TechnicianProfile:
    """Crée un profil technicien vide pour un utilisateur."""
    return TechnicianProfile.objects.create(user=user)


@transaction.atomic
def update_profile(profile: TechnicianProfile, validated_data: dict) -> TechnicianProfile:
    """Met à jour le profil d'un technicien."""
    if "bio" in validated_data:
        profile.bio = validated_data["bio"] or ""
    if "experience_years" in validated_data:
        profile.experience_years = validated_data["experience_years"] if validated_data["experience_years"] is not None else 0
    if "service_radius_km" in validated_data:
        profile.service_radius_km = validated_data["service_radius_km"] if validated_data["service_radius_km"] is not None else 10

    if "categories" in validated_data:
        cats = validated_data["categories"]
        if cats is not None:
            profile.categories.set(cats)

    if "latitude" in validated_data and "longitude" in validated_data:
        lat = validated_data["latitude"]
        lng = validated_data["longitude"]
        if lat is not None and lng is not None:
            profile.location = Point(x=lng, y=lat, srid=4326)
        else:
            profile.location = None

    # Si le profil n'est plus complet et qu'il est en ligne, le passer hors ligne
    if profile.is_available and not profile.is_complete:
        profile.is_available = False

    profile.save()
    return profile


def update_status(profile: TechnicianProfile, is_available: bool) -> TechnicianProfile:
    """Bascule le statut en ligne/hors ligne d'un technicien."""
    if is_available:
        if not profile.is_approved:
            raise ValidationError(
                {"detail": "Votre profil doit être approuvé par un administrateur pour passer en ligne."}
            )
        if not profile.is_complete:
            raise ValidationError(
                {"detail": "Votre profil doit être complet (position et au moins une catégorie) pour passer en ligne."}
            )
        profile.is_available = True
    else:
        profile.is_available = False

    profile.save()
    return profile


@transaction.atomic
def update_schedule(profile: TechnicianProfile, slots_data: list) -> list:
    """Remplace l'ensemble des créneaux de disponibilité du technicien."""
    # Groupement par weekday pour vérifier le chevauchement
    by_weekday = {}
    for slot in slots_data:
        w = slot["weekday"]
        st = slot["start_time"]
        et = slot["end_time"]

        if st >= et:
            raise ValidationError({"detail": "L'heure de fin doit être strictement supérieure à l'heure de début."})

        if w not in by_weekday:
            by_weekday[w] = []
        by_weekday[w].append((st, et))

    # Vérification des chevauchements par jour
    for w, times in by_weekday.items():
        sorted_times = sorted(times, key=lambda x: x[0])
        for i in range(len(sorted_times) - 1):
            curr_end = sorted_times[i][1]
            next_start = sorted_times[i + 1][0]
            if next_start < curr_end:
                raise ValidationError({"detail": "Deux créneaux du même jour ne doivent pas se chevaucher."})

    # Remplacement atomique
    profile.slots.all().delete()
    created = [
        AvailabilitySlot.objects.create(
            technician=profile,
            weekday=slot["weekday"],
            start_time=slot["start_time"],
            end_time=slot["end_time"],
        )
        for slot in slots_data
    ]
    return created


def approve_technician(profile: TechnicianProfile) -> TechnicianProfile:
    """Approuve le profil d'un technicien par l'administrateur."""
    profile.is_approved = True
    profile.save()
    return profile


def reject_technician(profile: TechnicianProfile) -> TechnicianProfile:
    """Refuse le profil d'un technicien par l'administrateur et le force hors ligne."""
    profile.is_approved = False
    profile.is_available = False
    profile.save()
    return profile