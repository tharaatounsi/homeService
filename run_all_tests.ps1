# ==============================================================================
# 🛡️ SERVICEHOME — SCRIPT D'EXÉCUTION AUTOMATISÉE DES COUCHES DE TESTS (QA)
# Module : Qualité Logicielle et Automatisation des Tests (Validation 27/10/2026)
# ==============================================================================

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "🚀 SERVICEHOME — DÉMARRAGE DE LA PYRAMIDE DE TESTS AUTOMATISÉS" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

# 1. COUCHE STATIQUE & COMPILATION PYTHON
Write-Host "`n[COUCHE 0] Analyse Statique & Vérification Syntaxique Python..." -ForegroundColor Yellow
python -m py_compile backend/apps/accounts/tests.py backend/apps/catalog/tests.py backend/apps/technicians/tests.py backend/apps/missions/tests.py backend/apps/missions/ai_service.py
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Syntaxe Python : 100% Valide (0 erreur)" -ForegroundColor Green
}

# 2. COUCHE 1 : TESTS UNITAIRES RAPIDES (IA NLP, ML COLAB, LOGIQUE MÉTIER & FINANCES)
Write-Host "`n[COUCHE 1] Exécution des Tests Unitaires (Moteurs IA NLP & ML Colab + Logique Métier)..." -ForegroundColor Yellow
python backend/run_unit_qa_suite.py

# 3. COUCHE 2 & 4 : TESTS D'INTÉGRATION REST, POSTGIS, WEBSOCKETS, CELERY & E2E (DOCKER)
Write-Host "`n[COUCHE 2 & 4] Exécution des Tests d'Intégration Backend & Parcours E2E (Docker PostGIS)..." -ForegroundColor Yellow
docker compose ps --status running 2>$null | Select-String "backend" >$null
if ($LASTEXITCODE -eq 0) {
    docker compose exec backend python manage.py test apps.accounts apps.catalog apps.technicians apps.missions -v 2
} else {
    Write-Host "ℹ️ Conteneur Docker 'backend' non démarré. Pour lancer les 48 tests PostGIS/REST/WebSockets en direct :" -ForegroundColor Cyan
    Write-Host "   docker compose exec backend python manage.py test -v 2" -ForegroundColor White
}

# 4. COUCHE 3 : TESTS FRONTEND ANGULAR (JASMINE / KARMA)
Write-Host "`n[COUCHE 3] Pour lancer les 14 Tests Unitaires & HTTP Frontend Angular (Jasmine/Karma) :" -ForegroundColor Yellow
Write-Host "   cd frontend ; npx ng test --watch=false" -ForegroundColor White

Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host "🏆 SUITE QUALITÉ LOGICIELLE PRÊTE POUR LA DÉMONSTRATION !" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Cyan
