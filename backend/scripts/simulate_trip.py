"""
Script de simulation de trajet GPS pour le Technicien (Sprint 6).
Fonctionne avec la bibliothèque standard Python (AUCUN pip install nécessaire).

Utilisation dans le terminal :
    python scripts/simulate_trip.py
"""

import json
import math
import sys
import time
import urllib.error
import urllib.request

API_URL = "http://localhost:8000/api"

# Identifiants de test du technicien (Ahmed)
TECH_EMAIL = "ahmed12@gmail.com"
TECH_PASSWORD = "123456789++"

TOTAL_STEPS = 25  # Nombre d'étapes le long du trajet
DELAY_BETWEEN_STEPS = 2.0  # Délai en secondes entre chaque point


def _http_request(url: str, method: str = "GET", data: dict = None, headers: dict = None):
    """Effectue un appel HTTP avec urllib standard."""
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)

    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8")
        try:
            return exc.code, json.loads(err_body)
        except Exception:
            return exc.code, {"error": err_body}
    except Exception as exc:
        return 500, {"error": str(exc)}


def login_technician(email: str, password: str) -> str:
    """Authentifie le technicien et retourne le token JWT d'accès."""
    url = f"{API_URL}/auth/login/"
    print(f"🔑 Connexion en tant que {email}...")
    status, res = _http_request(url, method="POST", data={"email": email, "password": password})
    if status == 200 and "access" in res:
        print("✅ Authentification réussie.")
        return res["access"]
    else:
        print(f"❌ Erreur d'authentification ({status}) : {res}")
        sys.exit(1)


def find_active_mission(token: str):
    """Recherche une mission acceptée ou en route pour Ahmed."""
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{API_URL}/missions/requests/"
    status, missions = _http_request(url, method="GET", headers=headers)
    if status == 200 and isinstance(missions, list):
        for m in missions:
            if m.get("status") in ("en_route", "accepted", "in_progress"):
                return m
        if missions:
            return missions[0]
    return None


def ensure_en_route(token: str, request_id: int, current_status: str):
    """Bascule la mission au statut 'en_route' si elle est 'accepted'."""
    if current_status == "accepted":
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{API_URL}/missions/requests/{request_id}/status/"
        print(f"🚗 Activation du statut 'En route' pour la mission #{request_id}...")
        status, res = _http_request(url, method="POST", data={"status": "en_route"}, headers=headers)
        if status == 200:
            print("✅ Statut 'En route' activé !")


def generate_interpolated_route(start: tuple, end: tuple, steps: int):
    """Génère une liste de coordonnées intermédiaires avec légère variation réaliste."""
    route = []
    lat1, lon1 = start
    lat2, lon2 = end

    for i in range(steps + 1):
        ratio = i / steps
        lat = lat1 + (lat2 - lat1) * ratio
        lon = lon1 + (lon2 - lon1) * ratio
        curve = math.sin(ratio * math.pi) * 0.0012
        route.append((round(lat + curve, 6), round(lon, 6)))

    return route


def emit_gps_location(token: str, request_id: int, lat: float, lon: float):
    """Émet la position GPS vers le backend pour la mission et le profil."""
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Mise à jour de la mission en direct
    if request_id:
        url_req = f"{API_URL}/missions/requests/{request_id}/location/"
        status, data = _http_request(url_req, method="POST", data={"latitude": lat, "longitude": lon}, headers=headers)
        if status == 200:
            return data.get("distance_km"), data.get("eta_minutes")

    # 2. Mise à jour du profil technicien
    url_prof = f"{API_URL}/technicians/me/"
    _http_request(url_prof, method="PATCH", data={"latitude": lat, "longitude": lon}, headers=headers)

    return None, None


def run_simulation():
    print("=" * 65)
    print("🚗 ServiceHome - Simulateur de Trajet GPS en Direct (Sprint 6)")
    print("=" * 65)

    token = login_technician(TECH_EMAIL, TECH_PASSWORD)
    mission = find_active_mission(token)

    start_point = (36.8005, 10.1800)  # Tunis Centre
    end_point = (36.8625, 10.1955)    # Ariana / Domicile client
    req_id = None

    if mission:
        req_id = mission["id"]
        status = mission.get("status")
        print(f"\n📋 Mission détectée : #{req_id} - {mission.get('category_name')} (Statut: {status})")
        print(f"🏠 Adresse client : {mission.get('address') or 'Tunis'}")

        # Basculer au statut en_route si nécessaire
        ensure_en_route(token, req_id, status)

        if mission.get("lat") and mission.get("lng"):
            end_point = (float(mission["lat"]), float(mission["lng"]))
    else:
        print("\nℹ️ Aucune mission en attente détectée. Simulation autonome prête.")

    points = generate_interpolated_route(start_point, end_point, TOTAL_STEPS)

    print(f"\n📍 Départ : {start_point} ➔ Arrivée : {end_point}")
    print(f"🚀 Début du suivi en direct : {len(points)} points GPS à émettre (1 point toutes les {DELAY_BETWEEN_STEPS}s)...")
    print("👉 Observez l'écran client : la voiture va se déplacer en direct sur la carte !\n")

    for index, (lat, lon) in enumerate(points, 1):
        progress = int((index / len(points)) * 100)
        dist_km, eta_min = emit_gps_location(token, req_id, lat, lon)

        info = ""
        if dist_km is not None:
            info = f"| 📏 Distance: {dist_km} km | ⏱️ ETA: ~{eta_min} min"

        print(f"[{progress:3d}%] 🚗 Étape {index:2d}/{len(points)} : Lat {lat:.5f}, Lon {lon:.5f} {info}")
        time.sleep(DELAY_BETWEEN_STEPS)

    print("\n🏁 Trajet terminé ! Le technicien Ahmed est arrivé au domicile du client.")
    print("=" * 65)


if __name__ == "__main__":
    run_simulation()
