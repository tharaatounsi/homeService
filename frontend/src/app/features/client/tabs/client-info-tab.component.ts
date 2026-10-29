import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { User } from '../../../core/models';
import { UserService } from '../../../core/user.service';

@Component({
  selector: 'app-client-info-tab',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="tab-pane">
      <div class="pane-header">
        <h2><i class="fa-solid fa-user-pen"></i> Informations personnelles</h2>
        <p>Mettez à jour vos coordonnées personnelles et informations de contact.</p>
      </div>

      @if (feedbackMessage()) {
        <div class="feedback-banner" [class.error]="isError()">
          <i class="fa-solid" [class.fa-circle-check]="!isError()" [class.fa-triangle-exclamation]="isError()"></i>
          <span>{{ feedbackMessage() }}</span>
        </div>
      }

      <form (ngSubmit)="saveProfile()" class="profile-form" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label for="first_name">Prénom</label>
            <input
              type="text"
              id="first_name"
              [(ngModel)]="formData.first_name"
              name="first_name"
              placeholder="Ex: Ahmed"
            />
          </div>
          <div class="form-group">
            <label for="last_name">Nom</label>
            <input
              type="text"
              id="last_name"
              [(ngModel)]="formData.last_name"
              name="last_name"
              placeholder="Ex: Ben Ali"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="email">Adresse email (identifiant)</label>
            <input
              type="email"
              id="email"
              [value]="user?.email || ''"
              name="email"
              disabled
              class="input-disabled"
              title="L'adresse email ne peut pas être modifiée"
            />
          </div>
          <div class="form-group">
            <label for="phone">Numéro de téléphone</label>
            <input
              type="tel"
              id="phone"
              [(ngModel)]="formData.phone"
              name="phone"
              placeholder="Ex: +216 98 123 456"
            />
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-save" [disabled]="isSubmitting()">
            @if (isSubmitting()) {
              <i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...
            } @else {
              <i class="fa-solid fa-floppy-disk"></i> Enregistrer les modifications
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .tab-pane {
        padding: 24px;
      }

      .pane-header {
        margin-bottom: 24px;
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
        margin-bottom: 20px;
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

      .profile-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
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
        padding: 11px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        font-size: 14px;
        transition: all 0.2s;
      }

      .form-group input:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
      }

      .input-disabled {
        background-color: #f1f5f9;
        color: #64748b;
        cursor: not-allowed;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 10px;
      }

      .btn-save {
        padding: 12px 24px;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
      }

      .btn-save:hover:not(:disabled) {
        background: #1d4ed8;
      }

      .btn-save:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      @media (max-width: 640px) {
        .form-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ClientInfoTabComponent implements OnInit, OnChanges {
  @Input() user: User | null = null;
  @Output() profileUpdated = new EventEmitter<User>();

  private userService = inject(UserService);

  formData = {
    first_name: '',
    last_name: '',
    phone: '',
  };

  isSubmitting = signal(false);
  feedbackMessage = signal<string | null>(null);
  isError = signal(false);

  ngOnInit(): void {
    this.syncForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user']) {
      this.syncForm();
    }
  }

  private syncForm(): void {
    if (this.user) {
      this.formData = {
        first_name: this.user.first_name || '',
        last_name: this.user.last_name || '',
        phone: this.user.phone || '',
      };
    }
  }

  saveProfile(): void {
    this.isSubmitting.set(true);
    this.feedbackMessage.set(null);

    const payload = {
      first_name: (this.formData.first_name || '').trim(),
      last_name: (this.formData.last_name || '').trim(),
      phone: (this.formData.phone || '').trim(),
    };

    this.userService
      .updateProfile(payload)
      .subscribe({
        next: (updatedUser) => {
          this.isSubmitting.set(false);
          this.isError.set(false);
          this.feedbackMessage.set('Votre profil a été mis à jour avec succès.');
          this.profileUpdated.emit(updatedUser);
          setTimeout(() => this.feedbackMessage.set(null), 4000);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.isError.set(true);
          let msg = 'Erreur lors de la mise à jour du profil.';
          if (err?.error) {
            if (typeof err.error === 'string') {
              msg = err.error;
            } else if (err.error.detail) {
              msg = err.error.detail;
            } else {
              const details = Object.entries(err.error)
                .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`)
                .join(' | ');
              if (details) {
                msg = `Erreur : ${details}`;
              }
            }
          }
          this.feedbackMessage.set(msg);
        },
      });
  }
}
