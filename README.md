# ServiceHome (Sprints 0 et 1)

Plateforme de services à domicile : Django (DRF, Channels, Celery) + PostGIS + Redis, frontend Angular.

## Démarrage

```bash
cp .env.example .env
docker compose build
docker compose run --rm backend python manage.py makemigrations accounts catalog technicians missions
docker compose up
```

- API santé : http://localhost:8000/api/health/
- Admin Django : http://localhost:8000/admin/

Créer un superutilisateur :

```bash
docker compose run --rm backend python manage.py createsuperuser
```

Lancer les tests :

```bash
docker compose run --rm backend python manage.py test
```

## Frontend (Angular)

```bash
npm install -g @angular/cli
ng new frontend --routing --style=scss
cd frontend && ng serve   # http://localhost:4200
```

## Sprint 1 : authentification et rôles

API (préfixe `/api/auth/`) : `register/`, `login/` (par email), `refresh/`, `me/`.

Le dossier `frontend_sprint1/src/app` contient le code Angular à copier dans ton projet :

```bash
cp -r frontend_sprint1/src/app/* frontend/src/app/
```

Puis dans `frontend/src/app/app.config.ts`, ajouter dans `providers` :

```ts
provideHttpClient(withInterceptors([authInterceptor]))
```

(avec `import { provideHttpClient, withInterceptors } from '@angular/common/http';` et `import { authInterceptor } from './core/auth.interceptor';`), et remplacer le contenu du template du composant racine par `<router-outlet />`.

## Prochain sprint

Sprint 2 : profils techniciens.
