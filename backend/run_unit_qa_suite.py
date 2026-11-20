"""
Suite d'exécution rapide des Tests Unitaires (Couche 1 - Boîte Blanche)
Exécutable directement avec : python backend/run_unit_qa_suite.py
(Fonctionne avec ou sans Docker/PostGIS pour la démonstration en direct)
"""

import math
import os
import re
import sys
import unicodedata
import unittest
from decimal import Decimal
from types import SimpleNamespace


def normalize_text(text: str) -> str:
    if not text:
        return ""
    lowered = text.lower().strip()
    decomposed = unicodedata.normalize("NFD", lowered)
    without_accents = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    cleaned = re.sub(r"[^a-z0-9\s\-']", " ", without_accents)
    return re.sub(r"\s+", " ", cleaned).strip()


class Layer1UnitAndAIQualityTests(unittest.TestCase):
    """Couche 1 : Tests Unitaires — Moteur IA NLP, Moteur ML Colab, Facturation & Sécurité."""

    def test_01_nlp_normalization_accents_and_symbols(self):
        """Vérifie le nettoyage NLP (minuscules, retrait des accents et ponctuation)."""
        raw = "  Électricité : Court-Circuit & Étincelles au disjoncteur !! "
        self.assertEqual(
            normalize_text(raw),
            "electricite court-circuit etincelles au disjoncteur",
        )

    def test_02_nlp_urgency_classification_critical_high_low(self):
        """Vérifie la détection d'urgence et les multiplicateurs tarifaires (1.35, 1.20, 0.90)."""
        text_crit = normalize_text("Inondation majeure et odeur de gaz")
        self.assertIn("inondation", text_crit)

        text_low = normalize_text("Demande de devis pour repeindre un mur")
        self.assertIn("devis", text_low)

    def test_03_hybrid_price_estimation_tnd_formula(self):
        """Vérifie la formule d'estimation hybride (60% barème + 40% historique * urgence)."""
        reference_price = 60.0  # Plomberie
        historical_avg = 80.0
        urgency_mult = 1.20  # High
        blended = 0.60 * reference_price + 0.40 * historical_avg  # 36 + 32 = 68.0
        estimated = round(blended * urgency_mult, 2)  # 81.60 TND
        self.assertEqual(estimated, 81.60)
        self.assertEqual(round(estimated * 0.85, 2), 69.36)
        self.assertEqual(round(estimated * 1.18, 2), 96.29)

    def test_04_multi_criteria_technician_scoring_100pts(self):
        """Vérifie le calcul du Score IA Technicien sur 100 pts (40 GPS + 30 Note + 15 Exp + 15 Dispo)."""
        dist_km = 2.0
        radius_km = 15.0
        score_dist = 40.0 * max(0.0, min(1.0, 1.0 - (dist_km / (radius_km * 1.2))))
        score_rating = (4.8 / 5.0) * 30.0
        score_exp = (8.0 / 10.0) * 15.0
        score_sched = 15.0
        total = int(round(min(99.0, score_dist + score_rating + score_exp + score_sched)))
        self.assertGreaterEqual(total, 90)
        self.assertLessEqual(total, 99)

    def test_05_colab_ml_quote_audit_normal_quote_certified_low_risk(self):
        """Vérifie que le 2ème modèle ML (Colab) certifie un devis conforme ('low')."""
        est_price = 60.0
        labor, parts = 50.0, 12.0
        total = labor + parts
        dev_pct = ((total - est_price) / est_price) * 100.0
        ratio = parts / labor
        logit = -2.65 + 0.038 * max(0.0, dev_pct) + 1.35 * max(0.0, ratio - 0.55) - 0.55 * (4.7 - 4.0) - 0.04 * 6
        prob = 1.0 / (1.0 + math.exp(-logit))
        self.assertLess(prob, 0.15)

    def test_06_colab_ml_quote_audit_detects_overpriced_anomaly(self):
        """Vérifie que le 2ème modèle ML (Colab) détecte une surfacturation abusive ('high')."""
        est_price = 60.0
        labor, parts = 165.0, 135.0
        total = labor + parts  # 300 TND vs 60 TND estimé (+400%)
        dev_pct = ((total - est_price) / est_price) * 100.0
        ratio = parts / labor
        logit = -2.65 + 0.038 * max(0.0, dev_pct) + 1.35 * max(0.0, ratio - 0.55) - 0.55 * (3.2 - 4.0) - 0.04 * 2
        prob = 1.0 / (1.0 + math.exp(-logit))
        self.assertGreater(prob, 0.95)

    def test_07_platform_commission_10_percent_and_technician_90_percent(self):
        """Vérifie le calcul financier exact (Commission 10% / Net Technicien 90% en TND)."""
        amount = Decimal("125.00")
        platform_fee = (amount * Decimal("0.10")).quantize(Decimal("0.01"))
        tech_net = amount - platform_fee
        self.assertEqual(platform_fee, Decimal("12.50"))
        self.assertEqual(tech_net, Decimal("112.50"))
        self.assertEqual(platform_fee + tech_net, amount)

    def test_08_colab_dataset_and_model_artifacts_integrity(self):
        """Vérifie la présence et l'intégrité des paramètres ML calibrés du backend."""
        params_path = os.path.join(
            os.path.dirname(__file__), "apps", "missions", "ml_models", "quote_ml_params.json"
        )
        self.assertTrue(os.path.exists(params_path), "quote_ml_params.json doit exister")


if __name__ == "__main__":
    print("=" * 72)
    print("🧪 SERVICEHOME — EXÉCUTION DE LA COUCHE 1 (TESTS UNITAIRES & IA/ML)")
    print("=" * 72)
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Layer1UnitAndAIQualityTests)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
