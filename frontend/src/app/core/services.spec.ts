import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { TechnicianService } from './technician.service';
import { AdminService } from './admin.service';
import { API_URL } from './config';
import { LoginResponse, User } from './models';

describe('ServiceHome Frontend Core Test Suite (Jasmine / Karma)', () => {
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        AuthService,
        UserService,
        TechnicianService,
        AdminService,
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
    localStorage.clear();
  });

  // =========================================================================
  // COUCHE 1 : AuthService — Authentification JWT, Session & Rôles RBAC
  // =========================================================================
  describe('1. AuthService (JWT Auth & RBAC)', () => {
    let authService: AuthService;

    beforeEach(() => {
      authService = TestBed.inject(AuthService);
    });

    it('should start unauthenticated when storage is empty', () => {
      expect(authService.isAuthenticated()).toBeFalse();
      expect(authService.isLoggedIn()).toBeFalse();
      expect(authService.user()).toBeNull();
    });

    it('should login user, store JWT tokens and update reactive user signal', () => {
      const mockResponse: LoginResponse = {
        access: 'jwt-access-token-123',
        refresh: 'jwt-refresh-token-456',
        user: {
          id: 1,
          username: 'molka',
          email: 'molka12@gmail.com',
          first_name: 'Molka',
          last_name: 'Cliente',
          phone: '+21622111222',
          role: 'client',
        },
      };

      authService.login('molka12@gmail.com', '123456789++').subscribe((res) => {
        expect(res.access).toBe('jwt-access-token-123');
        expect(res.user.role).toBe('client');
      });

      const req = httpMock.expectOne(`${API_URL}/auth/login/`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'molka12@gmail.com', password: '123456789++' });
      req.flush(mockResponse);

      expect(authService.isAuthenticated()).toBeTrue();
      expect(authService.accessToken).toBe('jwt-access-token-123');
      expect(authService.user()?.username).toBe('molka');
    });

    it('should register a new client account via POST /auth/register/', () => {
      const mockUser: User = {
        id: 2,
        username: 'amine',
        email: 'amine@example.com',
        first_name: 'Amine',
        last_name: 'Tounsi',
        phone: '+21650111222',
        role: 'client',
      };

      authService
        .register({
          username: 'amine',
          email: 'amine@example.com',
          password: 'Password123!',
          phone: '+21650111222',
          role: 'client',
        })
        .subscribe((user) => {
          expect(user.email).toBe('amine@example.com');
          expect(user.role).toBe('client');
        });

      const req = httpMock.expectOne(`${API_URL}/auth/register/`);
      expect(req.request.method).toBe('POST');
      req.flush(mockUser);
    });

    it('should clear session/local storage and redirect to /login on logout()', () => {
      sessionStorage.setItem('sh_access', 'token');
      localStorage.setItem('sh_access', 'token');

      authService.logout();

      expect(authService.isAuthenticated()).toBeFalse();
      expect(authService.accessToken).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should return the right dashboard route for each RBAC role', () => {
      expect(authService.homeRoute('client')).toBe('/client');
      expect(authService.homeRoute('technician')).toBe('/technician');
      expect(authService.homeRoute('admin')).toBe('/admin');
    });
  });

  // =========================================================================
  // COUCHE 2 : UserService — Diagnostic IA, Devis ML, Paiement, Avis & SAV
  // =========================================================================
  describe('2. UserService (Client Journey, AI Diagnostic, Quote ML Audit & SAV)', () => {
    let userService: UserService;

    beforeEach(() => {
      userService = TestBed.inject(UserService);
    });

    it('should call NLP AI diagnostic endpoint POST /missions/ai-diagnose/', () => {
      const mockAIDiagnostic = {
        category_id: 1,
        category_name: 'Plomberie',
        urgency: 'critical' as const,
        urgency_label: 'Critique (Intervention immédiate requise)',
        estimated_price: 81.0,
        min_price: 68.85,
        max_price: 95.58,
        confidence: 0.95,
        confidence_percent: 95,
        matched_keywords: ['inondation', 'fuite', 'chauffe-eau'],
        urgency_triggers: ['inondation'],
        safety_tips: ["Fermez immédiatement la vanne d'arrêt d'eau générale."],
        diagnostic_summary: 'Diagnostic IA (95% de confiance) : Plomberie Critique.',
      };

      userService
        .analyzeWithAI("Inondation et grosse fuite d'eau sous le chauffe-eau", 1)
        .subscribe((res) => {
          expect(res.urgency).toBe('critical');
          expect(res.estimated_price).toBe(81.0);
          expect(res.confidence_percent).toBe(95);
          expect(res.safety_tips.length).toBeGreaterThan(0);
        });

      const req = httpMock.expectOne(`${API_URL}/missions/ai-diagnose/`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.category_id).toBe(1);
      req.flush(mockAIDiagnostic);
    });

    it('should fetch quote with Scikit-Learn / Colab ML Anomaly Audit', () => {
      const mockQuoteWithML = {
        id: 10,
        request: 42,
        labor_price: 55.0,
        parts_price: 15.0,
        total_price: 70.0,
        description: 'Remplacement joint et siphon',
        status: 'pending' as const,
        ml_audit: {
          risk_level: 'low' as const,
          risk_label: 'Tarif Conforme (Certifié ML)',
          anomaly_probability: 0.08,
          anomaly_percent: 8,
          dispute_risk_percent: 7,
          initial_estimated_tnd: 65.0,
          expected_benchmark_tnd: 74.75,
          price_deviation_pct: 7.69,
          parts_to_labor_ratio: 0.273,
          explanation: 'Le montant total (70.00 TND) est cohérent avec le barème IA.',
          model_source: 'Pipeline Scikit-Learn RandomForest (servicehome_quote_ml.pkl)',
        },
      };

      userService.getQuote(42).subscribe((quote) => {
        expect(quote.total_price).toBe(70.0);
        expect(quote.ml_audit).toBeDefined();
        expect(quote.ml_audit?.risk_level).toBe('low');
        expect(quote.ml_audit?.anomaly_percent).toBeLessThan(30);
      });

      const req = httpMock.expectOne(`${API_URL}/missions/requests/42/quote/`);
      expect(req.request.method).toBe('GET');
      req.flush(mockQuoteWithML);
    });

    it('should accept an on-site quote via POST /missions/requests/:id/quote/respond/', () => {
      userService.respondQuote(42, 'accept').subscribe((res) => {
        expect(res.status).toBe('accepted');
      });

      const req = httpMock.expectOne(`${API_URL}/missions/requests/42/quote/respond/`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ action: 'accept' });
      req.flush({
        id: 10,
        request: 42,
        labor_price: 55,
        parts_price: 15,
        total_price: 70,
        description: 'Devis accepté',
        status: 'accepted',
      });
    });

    it('should process online payment with 10% platform commission via POST /missions/requests/:id/pay/', () => {
      userService.payMission(42, { method: 'online', amount: 80.0, card_last4: '4242' }).subscribe((res) => {
        expect(res.success).toBeTrue();
        expect(res.payment.platform_fee).toBe(8.0);
        expect(res.payment.technician_amount).toBe(72.0);
      });

      const req = httpMock.expectOne(`${API_URL}/missions/requests/42/pay/`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.method).toBe('online');
      req.flush({
        success: true,
        payment: {
          id: 5,
          request: 42,
          method: 'online',
          amount: 80.0,
          platform_fee: 8.0,
          technician_amount: 72.0,
          transaction_id: 'TXN-SH-00042',
          status: 'completed',
        },
      });
    });

    it('should submit a 5-star review and SAV dispute for a completed mission', () => {
      userService
        .submitReview(42, {
          rating: 5,
          comment: 'Intervention rapide et propre',
          tags: ['Ponctuel', 'Travail soigné'],
        })
        .subscribe((rev) => {
          expect(rev.rating).toBe(5);
          expect(rev.tags_list).toContain('Ponctuel');
        });

      const revReq = httpMock.expectOne(`${API_URL}/missions/requests/42/review/`);
      expect(revReq.request.method).toBe('POST');
      revReq.flush({
        id: 1,
        request: 42,
        client: 1,
        client_name: 'molka',
        technician: 2,
        technician_name: 'ahmed',
        rating: 5,
        comment: 'Intervention rapide et propre',
        tags: 'Ponctuel,Travail soigné',
        tags_list: ['Ponctuel', 'Travail soigné'],
        created_at: '2026-10-20T10:00:00Z',
      });

      userService
        .submitDispute(42, { reason: 'pricing', description: 'Écart sur pièce de rechange' })
        .subscribe((disp) => {
          expect(disp.status).toBe('open');
          expect(disp.reason).toBe('pricing');
        });

      const dispReq = httpMock.expectOne(`${API_URL}/missions/requests/42/dispute/`);
      expect(dispReq.request.method).toBe('POST');
      dispReq.flush({
        id: 3,
        request: 42,
        opened_by: 1,
        opened_by_name: 'molka',
        opened_by_role: 'client',
        reason: 'pricing',
        reason_display: 'Contestations tarifaires / Devis',
        description: 'Écart sur pièce de rechange',
        status: 'open',
        status_display: 'Ouvert',
        created_at: '2026-10-20T11:00:00Z',
      });
    });
  });

  // =========================================================================
  // COUCHE 3 : TechnicianService — Disponibilité, GPS Temps Réel & Devis
  // =========================================================================
  describe('3. TechnicianService (GPS Tracking, Quotes & Reputation)', () => {
    let techService: TechnicianService;

    beforeEach(() => {
      techService = TestBed.inject(TechnicianService);
    });

    it('should toggle online/offline availability status', () => {
      techService.updateStatus(true).subscribe((profile) => {
        expect(profile.is_available).toBeTrue();
      });

      const req = httpMock.expectOne(`${API_URL}/technicians/me/status/`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ is_available: true });
      req.flush({ id: 2, username: 'ahmed', is_available: true, is_approved: true });
    });

    it('should emit live GPS coordinates while en_route', () => {
      techService.emitMissionLocation(42, 36.8189, 10.1658).subscribe((track) => {
        expect(track.distance_km).toBe(1.4);
        expect(track.eta_minutes).toBe(4);
      });

      const req = httpMock.expectOne(`${API_URL}/missions/requests/42/location/`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ latitude: 36.8189, longitude: 10.1658 });
      req.flush({ distance_km: 1.4, eta_minutes: 4 });
    });

    it('should reply to a client review via POST /missions/requests/:id/review/reply/', () => {
      techService.replyToReview(42, 'Merci pour votre confiance !').subscribe((rev) => {
        expect(rev.technician_reply).toBe('Merci pour votre confiance !');
      });

      const req = httpMock.expectOne(`${API_URL}/missions/requests/42/review/reply/`);
      expect(req.request.method).toBe('POST');
      req.flush({
        id: 1,
        request: 42,
        rating: 5,
        technician_reply: 'Merci pour votre confiance !',
      });
    });
  });

  // =========================================================================
  // COUCHE 4 : AdminService — Supervision KPIs, Validation & Arbitrage SAV
  // =========================================================================
  describe('4. AdminService (KPIs, Technician Approval & Dispute Arbitration)', () => {
    let adminService: AdminService;

    beforeEach(() => {
      adminService = TestBed.inject(AdminService);
    });

    it('should fetch platform statistics via GET /auth/admin/stats/', () => {
      adminService.getStats().subscribe((stats) => {
        expect(stats.total_clients).toBe(25);
        expect(stats.total_technicians).toBe(12);
        expect(stats.total_missions).toBe(48);
      });

      const req = httpMock.expectOne(`${API_URL}/auth/admin/stats/`);
      expect(req.request.method).toBe('GET');
      req.flush({
        total_clients: 25,
        total_technicians: 12,
        approved_technicians: 10,
        pending_technicians: 2,
        total_missions: 48,
        pending_missions: 5,
        in_progress_missions: 8,
        completed_missions: 32,
        cancelled_missions: 3,
        total_categories: 8,
      });
    });

    it('should approve a technician and resolve an SAV dispute', () => {
      adminService.approveTechnician(7).subscribe((tech) => {
        expect(tech.is_approved).toBeTrue();
      });

      const appReq = httpMock.expectOne(`${API_URL}/technicians/7/approve/`);
      expect(appReq.request.method).toBe('POST');
      appReq.flush({ id: 7, username: 'tech7', is_approved: true });

      adminService
        .resolveDispute(3, {
          status: 'resolved',
          admin_resolution_note: 'Remboursement partiel de 15 TND validé.',
        })
        .subscribe((disp) => {
          expect(disp.status).toBe('resolved');
          expect(disp.admin_resolution_note).toContain('15 TND');
        });

      const dispReq = httpMock.expectOne(`${API_URL}/missions/disputes/3/`);
      expect(dispReq.request.method).toBe('PATCH');
      dispReq.flush({
        id: 3,
        request: 42,
        status: 'resolved',
        status_display: 'Résolu',
        admin_resolution_note: 'Remboursement partiel de 15 TND validé.',
      });
    });
  });
});
