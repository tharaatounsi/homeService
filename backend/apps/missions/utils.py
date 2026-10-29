import math


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calcule la distance géodésique (en km) entre deux points de coordonnées (lat, lon)
    selon la formule de Haversine.
    """
    R = 6371.0  

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return round(R * c, 2)


def calculate_eta_minutes(distance_km: float, average_speed_kmh: float = 30.0) -> int:
    """
    Calcule le temps estimé d'arrivée (ETA en minutes) pour une distance donnée
    avec une vitesse urbaine moyenne par défaut de 30 km/h.
    Retourne au minimum 1 minute si la distance est > 0.
    """
    if distance_km <= 0.05:
        return 0
    hours = distance_km / average_speed_kmh
    minutes = max(1, round(hours * 60))
    return minutes
