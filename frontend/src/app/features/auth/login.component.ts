import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <!-- Left side: Visual Showcase with Hero Image -->
      <div class="auth-hero">
        <div class="hero-overlay"></div>
        <img src="/assets/images/hero.jpg" alt="ServiceHome Client Technicien Femme de ménage" class="hero-bg-img" />
        <div class="hero-content">
          <div class="brand-badge">
            <i class="fa-solid fa-house-chimney-crack brand-icon"></i>
            <span>ServiceHome</span>
          </div>
          <h1>La plateforme d'entraide et de services à domicile</h1>
          <p class="hero-subtext">
            Mise en relation directe et rapide entre <strong>Clients</strong>, <strong>Techniciens qualifiés</strong> et <strong>Femmes de ménage d'expérience</strong>.
          </p>

          <div class="role-features">
            <div class="role-feature-item">
              <div class="icon-circle icon-client">
                <i class="fa-solid fa-user-group"></i>
              </div>
              <div>
                <h4>Espace Client</h4>
                <p>Réservez des interventions certifiées en toute sérénité.</p>
              </div>
            </div>

            <div class="role-feature-item">
              <div class="icon-circle icon-tech">
                <i class="fa-solid fa-wrench"></i>
              </div>
              <div>
                <h4>Techniciens</h4>
                <p>Plomberie, électricité, dépannage et travaux d'urgence.</p>
              </div>
            </div>

            <div class="role-feature-item">
              <div class="icon-circle icon-maid">
                <i class="fa-solid fa-broom"></i>
              </div>
              <div>
                <h4>Femmes de ménage</h4>
                <p>Entretien à domicile, ménage régulier et repassage de qualité.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right side: Login Form Container -->
      <div class="auth-form-container">
        <div class="form-card">
          <div class="mobile-brand">
            <i class="fa-solid fa-house-chimney-crack"></i>
            <span>ServiceHome</span>
          </div>

          <h2>Bienvenue sur ServiceHome</h2>
          <p class="subtitle">Connectez-vous à votre espace personnel</p>

          <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">
            <div class="form-group">
              <label for="email">Adresse Email</label>
              <div class="input-wrapper">
                <i class="fa-regular fa-envelope input-icon"></i>
                <input
                  id="email"
                  type="email"
                  formControlName="email"
                  placeholder="exemple@domaine.com"
                  autocomplete="email"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="password">Mot de passe</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-lock input-icon"></i>
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="••••••••"
                  autocomplete="current-password"
                />
                <button
                  type="button"
                  class="btn-toggle-pw"
                  (click)="showPassword.set(!showPassword())"
                  tabindex="-1"
                >
                  <i class="fa-solid" [class.fa-eye]="!showPassword()" [class.fa-eye-slash]="showPassword()"></i>
                </button>
              </div>
            </div>

            @if (error()) {
              <div class="error-alert">
                <i class="fa-solid fa-circle-exclamation"></i>
                <span>{{ error() }}</span>
              </div>
            }

            <button type="submit" class="btn-submit" [disabled]="form.invalid || loading()">
              @if (loading()) {
                <i class="fa-solid fa-circle-notch fa-spin"></i> Connexion en cours...
              } @else {
                Se connecter <i class="fa-solid fa-arrow-right"></i>
              }
            </button>
          </form>

          <div class="auth-footer">
            <p>Pas encore inscrit ? <a routerLink="/register" class="link-register">Créer un compte gratuitement</a></p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .auth-page {
        display: flex;
        min-height: 100vh;
        background-color: #f8fafc;
        font-family: var(--font-primary, sans-serif);
      }

      /* Hero Section */
      .auth-hero {
        position: relative;
        flex: 1.2;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 48px;
        color: #ffffff;
        overflow: hidden;
        background-color: #0f172a;
      }

      .hero-bg-img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.35;
        filter: brightness(0.8);
      }

      .hero-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 58, 138, 0.75) 100%);
      }

      .hero-content {
        position: relative;
        z-index: 10;
        max-width: 600px;
        margin: auto 0;
      }

      .brand-badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(12px);
        padding: 8px 16px;
        border-radius: 9999px;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.5px;
        margin-bottom: 28px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .brand-icon {
        color: #60a5fa;
      }

      .hero-content h1 {
        font-size: 38px;
        font-weight: 800;
        line-height: 1.2;
        margin-bottom: 16px;
        color: #ffffff;
      }

      .hero-subtext {
        font-size: 17px;
        color: #cbd5e1;
        line-height: 1.6;
        margin-bottom: 40px;
      }

      .role-features {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .role-feature-item {
        display: flex;
        align-items: center;
        gap: 16px;
        background: rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(8px);
        padding: 16px 20px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        transition: transform 0.2s ease;
      }

      .role-feature-item:hover {
        transform: translateX(6px);
        background: rgba(255, 255, 255, 0.14);
      }

      .icon-circle {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
      }

      .icon-client { background: rgba(59, 130, 246, 0.25); color: #60a5fa; }
      .icon-tech { background: rgba(245, 158, 11, 0.25); color: #fbbf24; }
      .icon-maid { background: rgba(16, 185, 129, 0.25); color: #34d399; }

      .role-feature-item h4 {
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 2px;
        color: #ffffff;
      }

      .role-feature-item p {
        font-size: 13px;
        color: #94a3b8;
        margin: 0;
      }

      /* Form Section */
      .auth-form-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px 24px;
        background-color: #ffffff;
      }

      .form-card {
        width: 100%;
        max-width: 440px;
      }

      .mobile-brand {
        display: none;
        align-items: center;
        gap: 10px;
        font-size: 20px;
        font-weight: 800;
        color: #2563eb;
        margin-bottom: 24px;
      }

      .form-card h2 {
        font-size: 28px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 6px;
      }

      .subtitle {
        color: #64748b;
        font-size: 15px;
        margin-bottom: 32px;
      }

      .login-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-group label {
        font-size: 14px;
        font-weight: 600;
        color: #334155;
      }

      .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .input-icon {
        position: absolute;
        left: 14px;
        color: #94a3b8;
        font-size: 16px;
      }

      .input-wrapper input {
        width: 100%;
        padding: 12px 14px 12px 42px;
        font-size: 15px;
        border: 1.5px solid #cbd5e1;
        border-radius: 12px;
        outline: none;
        transition: all 0.2s ease;
        background-color: #f8fafc;
      }

      .input-wrapper input:focus {
        border-color: #2563eb;
        background-color: #ffffff;
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
      }

      .btn-toggle-pw {
        position: absolute;
        right: 12px;
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 6px;
        font-size: 15px;
      }

      .btn-toggle-pw:hover {
        color: #475569;
      }

      .error-alert {
        display: flex;
        align-items: center;
        gap: 10px;
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        color: #dc2626;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 14px;
      }

      .btn-submit {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff;
        border: none;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
        margin-top: 8px;
      }

      .btn-submit:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
      }

      .btn-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .auth-footer {
        text-align: center;
        margin-top: 24px;
        font-size: 14px;
        color: #64748b;
      }

      .link-register {
        color: #2563eb;
        font-weight: 700;
        text-decoration: none;
      }

      .link-register:hover {
        text-decoration: underline;
      }

      @media (max-width: 900px) {
        .auth-hero {
          display: none;
        }
        .mobile-brand {
          display: flex;
        }
        .auth-form-container {
          padding: 24px 16px;
        }
      }
    `,
  ],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  showPassword = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email.trim().toLowerCase(), password).subscribe({
      next: (res) => this.router.navigate([this.auth.homeRoute(res.user.role)]),
      error: () => {
        this.error.set('Email ou mot de passe incorrect.');
        this.loading.set(false);
      },
    });
  }
}
