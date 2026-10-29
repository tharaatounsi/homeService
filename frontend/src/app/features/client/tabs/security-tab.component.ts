import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { UserService } from '../../../core/user.service';

@Component({
  selector: 'app-security-tab',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="tab-pane">
      <div class="pane-header">
        <h2><i class="fa-solid fa-shield-halved"></i> Sécurité & Mot de passe</h2>
        <p>Mettez à jour vos identifiants de sécurité pour protéger votre compte ServiceHome.</p>
      </div>

      @if (feedbackMessage()) {
        <div class="feedback-banner" [class.error]="isError()">
          <i class="fa-solid" [class.fa-circle-check]="!isError()" [class.fa-triangle-exclamation]="isError()"></i>
          <span>{{ feedbackMessage() }}</span>
        </div>
      }

      <div class="security-card">
        <h3><i class="fa-solid fa-key"></i> Modifier le mot de passe</h3>
        
        <form (ngSubmit)="changePassword()" class="password-form">
          <div class="form-group">
            <label for="old_pwd">Mot de passe actuel</label>
            <input
              type="password"
              id="old_pwd"
              [(ngModel)]="pwdData.old_password"
              name="old_password"
              placeholder="Votre mot de passe actuel"
              required
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="new_pwd">Nouveau mot de passe</label>
              <input
                type="password"
                id="new_pwd"
                [(ngModel)]="pwdData.new_password"
                name="new_password"
                placeholder="Au moins 8 caractères"
                required
              />
            </div>
            <div class="form-group">
              <label for="confirm_pwd">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                id="confirm_pwd"
                [(ngModel)]="pwdData.new_password_confirm"
                name="new_password_confirm"
                placeholder="Répétez le mot de passe"
                required
              />
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-save" [disabled]="isSubmitting()">
              @if (isSubmitting()) {
                <i class="fa-solid fa-spinner fa-spin"></i> Modification en cours...
              } @else {
                <i class="fa-solid fa-lock"></i> Mettre à jour le mot de passe
              }
            </button>
          </div>
        </form>
      </div>

      <!-- Notifications & Preferences -->
      <div class="security-card preferences-card">
        <h3><i class="fa-solid fa-bell"></i> Notifications & Communication</h3>
        <div class="toggle-list">
          <label class="toggle-item">
            <div>
              <strong>Notifications de mission</strong>
              <p>Recevoir un SMS ou push lorsqu'un technicien accepte votre demande.</p>
            </div>
            <input type="checkbox" checked />
          </label>
          <label class="toggle-item">
            <div>
              <strong>Récapitulatifs d'intervention</strong>
              <p>Recevoir la facture et le rapport d'intervention par email.</p>
            </div>
            <input type="checkbox" checked />
          </label>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .tab-pane {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .pane-header {
        padding-bottom: 16px;
        border-bottom: 1px solid #f1f5f9;
      }

      .pane-header h2 {
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
      }

      .pane-header p {
        font-size: 14px;
        color: #64748b;
      }

      .feedback-banner {
        padding: 12px 16px;
        border-radius: 10px;
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 600;
      }

      .feedback-banner.error {
        background: #fef2f2;
        color: #b91c1c;
        border-color: #fecaca;
      }

      .security-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 22px;
      }

      .security-card h3 {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 18px;
      }

      .password-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-group label {
        font-size: 13px;
        font-weight: 700;
        color: #334155;
      }

      .form-group input {
        padding: 10px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        font-size: 14px;
      }

      .form-group input:focus {
        outline: none;
        border-color: #2563eb;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
      }

      .btn-save {
        padding: 11px 22px;
        background: #0f172a;
        color: #ffffff;
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
      }

      .btn-save:hover:not(:disabled) {
        background: #2563eb;
      }

      .btn-save:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .toggle-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .toggle-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 12px;
        background: #f8fafc;
        border-radius: 10px;
        cursor: pointer;
      }

      .toggle-item strong {
        font-size: 14px;
        color: #1e293b;
        display: block;
      }

      .toggle-item p {
        font-size: 12px;
        color: #64748b;
      }

      .toggle-item input[type='checkbox'] {
        width: 18px;
        height: 18px;
        accent-color: #2563eb;
        cursor: pointer;
      }

      @media (max-width: 640px) {
        .form-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class SecurityTabComponent {
  private userService = inject(UserService);

  pwdData = {
    old_password: '',
    new_password: '',
    new_password_confirm: '',
  };

  isSubmitting = signal(false);
  feedbackMessage = signal<string | null>(null);
  isError = signal(false);

  changePassword(): void {
    if (!this.pwdData.old_password || !this.pwdData.new_password || !this.pwdData.new_password_confirm) {
      this.isError.set(true);
      this.feedbackMessage.set('Veuillez remplir tous les champs du mot de passe.');
      return;
    }

    if (this.pwdData.new_password !== this.pwdData.new_password_confirm) {
      this.isError.set(true);
      this.feedbackMessage.set('Le nouveau mot de passe et sa confirmation ne correspondent pas.');
      return;
    }

    if (this.pwdData.new_password.length < 8) {
      this.isError.set(true);
      this.feedbackMessage.set('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    this.isSubmitting.set(true);
    this.feedbackMessage.set(null);

    this.userService
      .changePassword({
        old_password: this.pwdData.old_password,
        new_password: this.pwdData.new_password,
        new_password_confirm: this.pwdData.new_password_confirm,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isError.set(false);
          this.feedbackMessage.set('Votre mot de passe a été modifié avec succès.');
          this.pwdData = { old_password: '', new_password: '', new_password_confirm: '' };
          setTimeout(() => this.feedbackMessage.set(null), 5000);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.isError.set(true);
          const oldPwdErr = err?.error?.old_password?.[0];
          const newPwdErr = err?.error?.new_password?.[0];
          const detail = err?.error?.detail;
          this.feedbackMessage.set(
            oldPwdErr || newPwdErr || detail || 'Impossible de modifier le mot de passe.'
          );
        },
      });
  }
}
