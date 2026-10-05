import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { flattenErrors } from '../../core/errors';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="register-page">
      <div class="register-container">
        <!-- Header -->
        <div class="register-header">
          <div class="brand-badge">
            <i class="fa-solid fa-house-chimney-crack brand-icon"></i>
            <span>ServiceHome</span>
          </div>
          <h1>Rejoignez notre réseau de confiance</h1>
          <p class="subtitle">Choisissez votre rôle et créez votre compte en quelques secondes</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="register-form">
          <!-- Role Selection Cards with Photos -->
          <div class="role-selector-section">
            <label class="section-label">Je souhaite m'inscrire en tant que :</label>

            <div class="role-cards-grid">
              <!-- Client Card -->
              <div
                class="role-card"
                [class.selected]="selectedRole() === 'client'"
                (click)="setRole('client')"
              >
                <div class="role-img-wrapper">
                  <img src="/assets/images/client.jpg" alt="Client" />
                  <div class="check-badge"><i class="fa-solid fa-check"></i></div>
                </div>
                <div class="role-info">
                  <div class="role-title"><i class="fa-solid fa-user icon-role"></i> Client</div>
                  <p class="role-desc">Rechercher des prestations pour mon domicile</p>
                </div>
              </div>

              <!-- Technician Card -->
              <div
                class="role-card"
                [class.selected]="selectedRole() === 'technician'"
                (click)="setRole('technician')"
              >
                <div class="role-img-wrapper">
                  <img src="/assets/images/technician.jpg" alt="Technicien" />
                  <div class="check-badge"><i class="fa-solid fa-check"></i></div>
                </div>
                <div class="role-info">
                  <div class="role-title"><i class="fa-solid fa-wrench icon-role"></i> Technicien</div>
                  <p class="role-desc">Plomberie, électricité, réparation & dépannage</p>
                </div>
              </div>

              <!-- Femme de ménage Card -->
              <div
                class="role-card"
                [class.selected]="selectedRole() === 'housekeeper'"
                (click)="setRole('housekeeper')"
              >
                <div class="role-img-wrapper">
                  <img src="/assets/images/housekeeper.jpg" alt="Femme de ménage" />
                  <div class="check-badge"><i class="fa-solid fa-check"></i></div>
                </div>
                <div class="role-info">
                  <div class="role-title"><i class="fa-solid fa-broom icon-role"></i> Femme de ménage</div>
                  <p class="role-desc">Ménage à domicile, repassage & entretien</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Input Fields -->
          <div class="form-fields-grid">
            <div class="form-group">
              <label for="username">Nom d'utilisateur / Nom complet</label>
              <div class="input-wrapper">
                <i class="fa-regular fa-user input-icon"></i>
                <input
                  id="username"
                  type="text"
                  formControlName="username"
                  placeholder="ex. Sophie Martin"
                  autocomplete="username"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="email">Adresse Email</label>
              <div class="input-wrapper">
                <i class="fa-regular fa-envelope input-icon"></i>
                <input
                  id="email"
                  type="email"
                  formControlName="email"
                  placeholder="nom@exemple.com"
                  autocomplete="email"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="phone">Numéro de Téléphone (optionnel)</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-phone input-icon"></i>
                <input
                  id="phone"
                  type="tel"
                  formControlName="phone"
                  placeholder="+216 22 333 444"
                  autocomplete="tel"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="password">Mot de passe (8 caractères min.)</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-lock input-icon"></i>
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="••••••••"
                  autocomplete="new-password"
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
          </div>

          @if (error()) {
            <div class="error-alert">
              <i class="fa-solid fa-circle-exclamation"></i>
              <span>{{ error() }}</span>
            </div>
          }

          <button type="submit" class="btn-submit" [disabled]="form.invalid || loading()">
            @if (loading()) {
              <i class="fa-solid fa-circle-notch fa-spin"></i> Création du compte...
            } @else {
              Créer mon compte <i class="fa-solid fa-arrow-right"></i>
            }
          </button>
        </form>

        <div class="register-footer">
          <p>Vous avez déjà un compte ? <a routerLink="/login">Se connecter</a></p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .register-page {
        min-height: 100vh;
        background: linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%);
        padding: 40px 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: var(--font-primary, sans-serif);
      }

      .register-container {
        width: 100%;
        max-width: 780px;
        background: #ffffff;
        border-radius: 24px;
        box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.08);
        padding: 40px;
        border: 1px solid #e2e8f0;
      }

      .register-header {
        text-align: center;
        margin-bottom: 32px;
      }

      .brand-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #eff6ff;
        color: #2563eb;
        padding: 6px 14px;
        border-radius: 9999px;
        font-weight: 700;
        font-size: 14px;
        margin-bottom: 16px;
      }

      .register-header h1 {
        font-size: 30px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 8px;
      }

      .subtitle {
        color: #64748b;
        font-size: 15px;
      }

      .section-label {
        display: block;
        font-size: 15px;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 16px;
      }

      /* Role Cards Grid */
      .role-cards-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 32px;
      }

      .role-card {
        background: #ffffff;
        border: 2px solid #e2e8f0;
        border-radius: 16px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.25s ease;
        position: relative;
        display: flex;
        flex-direction: column;
      }

      .role-card:hover {
        transform: translateY(-4px);
        border-color: #93c5fd;
        box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.12);
      }

      .role-card.selected {
        border-color: #2563eb;
        background: #f0f6ff;
        box-shadow: 0 8px 24px -4px rgba(37, 99, 235, 0.2);
      }

      .role-img-wrapper {
        position: relative;
        height: 120px;
        width: 100%;
        overflow: hidden;
      }

      .role-img-wrapper img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
      }

      .role-card:hover .role-img-wrapper img {
        transform: scale(1.05);
      }

      .check-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        opacity: 0;
        transform: scale(0.6);
        transition: all 0.2s ease;
      }

      .role-card.selected .check-badge {
        opacity: 1;
        transform: scale(1);
      }

      .role-info {
        padding: 14px;
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .role-title {
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .icon-role {
        color: #2563eb;
        font-size: 14px;
      }

      .role-desc {
        font-size: 12px;
        color: #64748b;
        line-height: 1.4;
      }

      /* Fields Grid */
      .form-fields-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
        margin-bottom: 24px;
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
        margin-bottom: 20px;
      }

      .btn-submit {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 16px;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff;
        border: none;
        border-radius: 14px;
        font-size: 17px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
      }

      .btn-submit:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
      }

      .btn-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .register-footer {
        text-align: center;
        margin-top: 24px;
        font-size: 14px;
        color: #64748b;
      }

      .register-footer a {
        color: #2563eb;
        font-weight: 700;
        text-decoration: none;
      }

      @media (max-width: 640px) {
        .register-container {
          padding: 24px 16px;
        }
        .role-cards-grid {
          grid-template-columns: 1fr;
        }
        .form-fields-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  showPassword = signal(false);
  error = signal<string | null>(null);
  selectedRole = signal<'client' | 'technician' | 'housekeeper'>('client');

  form = this.fb.nonNullable.group({
    role: ['client' as 'client' | 'technician', Validators.required],
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  setRole(role: 'client' | 'technician' | 'housekeeper'): void {
    this.selectedRole.set(role);
    // In backend, housekeeper is registered under technician profile role
    const backendRole = role === 'client' ? 'client' : 'technician';
    this.form.patchValue({ role: backendRole });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    const email = value.email.trim().toLowerCase();

    this.auth.register({ ...value, email }).subscribe({
      next: () =>
        this.auth.login(email, value.password).subscribe({
          next: (res) => this.router.navigate([this.auth.homeRoute(res.user.role)]),
          error: () => this.router.navigate(['/login']),
        }),
      error: (err) => {
        this.error.set(flattenErrors(err));
        this.loading.set(false);
      },
    });
  }
}
