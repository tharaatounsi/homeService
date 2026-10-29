import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import {
  ConversationDetailResponse,
  ConversationSummary,
  MissionMessageItem,
  UserService,
} from '../../core/user.service';

@Component({
  selector: 'app-messaging-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="messaging-container">
      <!-- Header -->
      <div class="messaging-top-bar">
        <div>
          <h2>
            <i class="fa-solid fa-comments"></i>
            Messagerie Directe Client ↔ Technicien
          </h2>
          <p>
            Échangez directement avec votre interlocuteur et consultez ses coordonnées de contact (Synchronisation HTTP directe).
          </p>
        </div>
        <button type="button" class="btn-sync" (click)="refreshAll()" title="Actualiser les messages">
          <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="isLoading()"></i>
          <span>Actualiser</span>
        </button>
      </div>

      <div class="messaging-grid">
        <!-- Colonne gauche : Liste des contacts / conversations -->
        <aside class="contacts-sidebar">
          <div class="search-contact-box">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Rechercher un contact (nom, email)..."
              [(ngModel)]="searchTerm"
            />
          </div>

          <div class="contacts-list">
            @for (conv of filteredConversations(); track conv.partner_id) {
              <div
                class="contact-item"
                [class.active]="selectedPartnerId() === conv.partner_id"
                (click)="selectConversation(conv)"
              >
                <div class="contact-avatar">
                  <img
                    [src]="conv.partner_role === 'technician' ? '/assets/images/technician.jpg' : '/assets/images/client.jpg'"
                    [alt]="conv.partner_name"
                  />
                  <span class="online-dot"></span>
                </div>

                <div class="contact-meta">
                  <div class="contact-row-top">
                    <strong>{{ conv.partner_name }}</strong>
                    @if (conv.unread_count > 0) {
                      <span class="unread-badge">{{ conv.unread_count }}</span>
                    }
                  </div>

                  <span class="contact-email">{{ conv.partner_email }}</span>

                  @if (conv.request_id) {
                    <span class="mission-mini-tag">
                      <i class="fa-solid fa-wrench"></i>
                      Demande #{{ conv.request_id }} ({{ conv.request_category || 'Service' }})
                    </span>
                  } @else {
                    <span class="role-mini-tag">
                      {{ conv.partner_role === 'technician' ? 'Technicien' : 'Client' }}
                    </span>
                  }

                  @if (conv.last_message) {
                    <p class="last-msg-preview">{{ conv.last_message }}</p>
                  } @else {
                    <p class="last-msg-preview empty">Cliquez pour démarrer la discussion</p>
                  }
                </div>
              </div>
            } @empty {
              <div class="no-contacts">
                <i class="fa-regular fa-address-book"></i>
                <p>Aucun contact disponible pour le moment.</p>
              </div>
            }
          </div>
        </aside>

        <!-- Colonne droite : Fenêtre de discussion & Coordonnées de contact -->
        <section class="chat-panel">
          @if (activeConversation() || selectedPartnerId()) {
            <!-- En-tête du contact sélectionné -->
            <div class="chat-header">
              <div class="partner-identity">
                <img
                  class="partner-avatar"
                  [src]="partnerRole() === 'technician' ? '/assets/images/technician.jpg' : '/assets/images/client.jpg'"
                  [alt]="partnerName()"
                />
                <div>
                  <div class="partner-title-row">
                    <h3>{{ partnerName() }}</h3>
                    <span class="role-pill" [class]="partnerRole()">
                      {{ partnerRole() === 'technician' ? 'Technicien' : 'Client' }}
                    </span>
                  </div>
                  <div class="partner-contacts-row">
                    @if (partnerEmail()) {
                      <a [href]="'mailto:' + partnerEmail()" class="contact-chip email">
                        <i class="fa-regular fa-envelope"></i>
                        <span>{{ partnerEmail() }}</span>
                      </a>
                    }
                    @if (partnerPhone()) {
                      <a [href]="'tel:' + partnerPhone()" class="contact-chip phone">
                        <i class="fa-solid fa-phone"></i>
                        <span>{{ partnerPhone() }}</span>
                      </a>
                    } @else {
                      <span class="contact-chip muted">
                        <i class="fa-solid fa-phone-slash"></i>
                        <span>Téléphone non renseigné</span>
                      </span>
                    }
                  </div>
                </div>
              </div>

              @if (linkedRequestInfo()) {
                <div class="linked-mission-box">
                  <span class="mission-num">Demande #{{ linkedRequestInfo()!.id }}</span>
                  <span class="mission-cat">{{ linkedRequestInfo()!.category_name }}</span>
                  <span class="mission-status" [class]="linkedRequestInfo()!.status">
                    {{ getStatusLabel(linkedRequestInfo()!.status) }}
                  </span>
                </div>
              }
            </div>

            <!-- Liste des messages -->
            <div class="messages-viewport">
              @for (msg of messages(); track msg.id) {
                <div
                  class="message-row"
                  [class.mine]="msg.sender === currentUserId()"
                  [class.theirs]="msg.sender !== currentUserId()"
                >
                  <div class="message-bubble">
                    <div class="bubble-header">
                      <strong>
                        {{ msg.sender === currentUserId() ? 'Vous' : msg.sender_name }}
                      </strong>
                      <span class="msg-time">{{ msg.created_at | date: 'dd/MM HH:mm' }}</span>
                    </div>
                    <p class="msg-text">{{ msg.content }}</p>
                  </div>
                </div>
              } @empty {
                <div class="empty-chat-placeholder">
                  <i class="fa-regular fa-comments"></i>
                  <h4>Démarrez la conversation avec {{ partnerName() }}</h4>
                  <p>
                    Envoyez un message ci-dessous ou utilisez une réponse rapide pour organiser l'intervention.
                  </p>
                </div>
              }
            </div>

            <!-- Suggestions rapides -->
            <div class="quick-replies-bar">
              @for (qr of quickReplies(); track qr) {
                <button type="button" class="quick-reply-chip" (click)="useQuickReply(qr)">
                  {{ qr }}
                </button>
              }
            </div>

            <!-- Zone de saisie -->
            <form class="chat-input-bar" (ngSubmit)="sendMessage()">
              <input
                type="text"
                name="messageContent"
                [(ngModel)]="newMessage"
                placeholder="Écrivez votre message ici..."
                autocomplete="off"
                [disabled]="isSending()"
              />
              <button type="submit" class="btn-send" [disabled]="isSending() || !newMessage.trim()">
                <i class="fa-solid fa-paper-plane"></i>
                <span>Envoyer</span>
              </button>
            </form>
          } @else {
            <div class="no-selection-state">
              <i class="fa-solid fa-comments"></i>
              <h3>Sélectionnez un interlocuteur à gauche</h3>
              <p>Choisissez un technicien ou un client dans la liste pour ouvrir la messagerie et afficher ses coordonnées.</p>
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .messaging-container {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .messaging-top-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid #e2e8f0;
      }

      .messaging-top-bar h2 {
        margin: 0 0 4px 0;
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .messaging-top-bar h2 i {
        color: #2563eb;
      }

      .messaging-top-bar p {
        margin: 0;
        font-size: 13px;
        color: #64748b;
      }

      .btn-sync {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        color: #334155;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-sync:hover {
        background: #e2e8f0;
      }

      .messaging-grid {
        display: grid;
        grid-template-columns: 310px 1fr;
        gap: 20px;
        min-height: 540px;
      }

      /* Sidebar Contacts */
      .contacts-sidebar {
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .search-contact-box {
        padding: 12px 14px;
        background: #ffffff;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .search-contact-box i {
        color: #94a3b8;
        font-size: 14px;
      }

      .search-contact-box input {
        border: none;
        outline: none;
        width: 100%;
        font-size: 13px;
        color: #0f172a;
        background: transparent;
      }

      .contacts-list {
        flex: 1;
        overflow-y: auto;
        max-height: 500px;
        display: flex;
        flex-direction: column;
      }

      .contact-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px;
        border-bottom: 1px solid #e2e8f0;
        cursor: pointer;
        background: #ffffff;
        transition: all 0.15s;
      }

      .contact-item:hover {
        background: #f1f5f9;
      }

      .contact-item.active {
        background: #eff6ff;
        border-left: 4px solid #2563eb;
      }

      .contact-avatar {
        position: relative;
        width: 44px;
        height: 44px;
        flex-shrink: 0;
      }

      .contact-avatar img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #e2e8f0;
      }

      .online-dot {
        position: absolute;
        bottom: 1px;
        right: 1px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #10b981;
        border: 2px solid #ffffff;
      }

      .contact-meta {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .contact-row-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
      }

      .contact-row-top strong {
        font-size: 14px;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .unread-badge {
        background: #ef4444;
        color: #ffffff;
        font-size: 11px;
        font-weight: 800;
        padding: 2px 7px;
        border-radius: 9999px;
      }

      .contact-email {
        font-size: 11px;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .mission-mini-tag,
      .role-mini-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 700;
        color: #1d4ed8;
        background: #dbeafe;
        padding: 2px 8px;
        border-radius: 6px;
        width: fit-content;
        margin-top: 2px;
      }

      .role-mini-tag {
        background: #f1f5f9;
        color: #475569;
      }

      .last-msg-preview {
        margin: 4px 0 0 0;
        font-size: 12px;
        color: #334155;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .last-msg-preview.empty {
        color: #94a3b8;
        font-style: italic;
      }

      .no-contacts {
        padding: 40px 20px;
        text-align: center;
        color: #64748b;
      }

      .no-contacts i {
        font-size: 32px;
        margin-bottom: 8px;
        display: block;
      }

      /* Chat Panel */
      .chat-panel {
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        background: #ffffff;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .chat-header {
        padding: 16px 20px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }

      .partner-identity {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .partner-avatar {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #2563eb;
      }

      .partner-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }

      .partner-title-row h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 800;
        color: #0f172a;
      }

      .role-pill {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 9999px;
        text-transform: uppercase;
        background: #dbeafe;
        color: #1e40af;
      }

      .role-pill.technician {
        background: #fef3c7;
        color: #b45309;
      }

      .partner-contacts-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .contact-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 8px;
        text-decoration: none;
        transition: all 0.2s;
      }

      .contact-chip.email {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
      }

      .contact-chip.email:hover {
        background: #2563eb;
        color: #ffffff;
      }

      .contact-chip.phone {
        background: #ecfdf5;
        color: #047857;
        border: 1px solid #a7f3d0;
      }

      .contact-chip.phone:hover {
        background: #059669;
        color: #ffffff;
      }

      .contact-chip.muted {
        background: #f1f5f9;
        color: #64748b;
      }

      .linked-mission-box {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #ffffff;
        padding: 8px 12px;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        font-size: 12px;
      }

      .mission-num {
        font-weight: 800;
        color: #0f172a;
      }

      .mission-cat {
        color: #475569;
        font-weight: 600;
      }

      .mission-status {
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 999px;
        background: #e2e8f0;
        color: #334155;
      }

      .Messages-viewport,
      .messages-viewport {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        max-height: 350px;
        min-height: 280px;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .message-row {
        display: flex;
        width: 100%;
      }

      .message-row.mine {
        justify-content: flex-end;
      }

      .message-row.theirs {
        justify-content: flex-start;
      }

      .message-bubble {
        max-width: 75%;
        padding: 12px 16px;
        border-radius: 16px;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);
      }

      .message-row.mine .message-bubble {
        background: #2563eb;
        color: #ffffff;
        border-bottom-right-radius: 4px;
      }

      .message-row.theirs .message-bubble {
        background: #ffffff;
        color: #0f172a;
        border: 1px solid #e2e8f0;
        border-bottom-left-radius: 4px;
      }

      .bubble-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 4px;
        font-size: 11px;
        opacity: 0.85;
      }

      .msg-text {
        margin: 0;
        font-size: 14px;
        line-height: 1.45;
        white-space: pre-wrap;
      }

      .empty-chat-placeholder {
        margin: auto;
        text-align: center;
        color: #64748b;
        max-width: 360px;
      }

      .empty-chat-placeholder i {
        font-size: 40px;
        color: #94a3b8;
        margin-bottom: 10px;
        display: block;
      }

      .empty-chat-placeholder h4 {
        margin: 0 0 6px 0;
        color: #1e293b;
        font-size: 16px;
      }

      .empty-chat-placeholder p {
        margin: 0;
        font-size: 13px;
      }

      /* Quick replies */
      .quick-replies-bar {
        padding: 10px 16px;
        background: #ffffff;
        border-top: 1px solid #f1f5f9;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .quick-reply-chip {
        background: #f1f5f9;
        color: #334155;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        padding: 5px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .quick-reply-chip:hover {
        background: #eff6ff;
        color: #2563eb;
        border-color: #93c5fd;
      }

      /* Input Bar */
      .chat-input-bar {
        padding: 14px 16px;
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
        display: flex;
        gap: 10px;
      }

      .chat-input-bar input {
        flex: 1;
        padding: 12px 16px;
        border-radius: 12px;
        border: 1.5px solid #cbd5e1;
        font-size: 14px;
        outline: none;
      }

      .chat-input-bar input:focus {
        border-color: #2563eb;
      }

      .btn-send {
        padding: 0 22px;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 12px;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: background 0.2s;
      }

      .btn-send:hover:not(:disabled) {
        background: #1d4ed8;
      }

      .btn-send:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .no-selection-state {
        margin: auto;
        text-align: center;
        padding: 40px 24px;
        color: #64748b;
      }

      .no-selection-state i {
        font-size: 48px;
        color: #94a3b8;
        margin-bottom: 12px;
        display: block;
      }

      @media (max-width: 900px) {
        .messaging-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class MessagingTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() initialPartnerId?: number | null;
  @Input() initialRequestId?: number | null;
  @Output() unreadTotalChange = new EventEmitter<number>();

  private auth = inject(AuthService);
  private userService = inject(UserService);
  private pollSub?: Subscription;

  conversations = signal<ConversationSummary[]>([]);
  selectedPartnerId = signal<number | null>(null);
  activeConversation = signal<ConversationDetailResponse | null>(null);
  messages = signal<MissionMessageItem[]>([]);

  searchTerm = '';
  newMessage = '';
  isLoading = signal(false);
  isSending = signal(false);

  ngOnInit(): void {
    this.loadConversations(true);
    // Rafraîchissement automatique par HTTP toutes les 3 secondes (sans WebSocket)
    this.pollSub = interval(3000).subscribe(() => {
      this.loadConversations(false);
      const pid = this.selectedPartnerId();
      if (pid) {
        this.loadMessagesForPartner(pid, false);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialPartnerId'] && this.initialPartnerId) {
      this.selectedPartnerId.set(Number(this.initialPartnerId));
      this.loadMessagesForPartner(Number(this.initialPartnerId), true);
    } else if (changes['initialRequestId'] && this.initialRequestId) {
      this.matchRequestToPartner(Number(this.initialRequestId));
    }
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  currentUserId(): number | undefined {
    return this.auth.user()?.id;
  }

  quickReplies(): string[] {
    const role = this.auth.user()?.role;
    if (role === 'technician') {
      return [
        'Bonjour, j\'ai bien reçu votre demande d\'intervention.',
        'Je suis disponible aujourd\'hui, à quelle heure puis-je passer ?',
        'Je suis en route vers votre adresse.',
        'Pouvez-vous m\'envoyer votre numéro ou localisation exacte ?',
      ];
    }
    return [
      'Bonjour, êtes-vous disponible pour cette intervention ?',
      'Pouvez-vous me confirmer votre heure d\'arrivée ?',
      'Voici mon adresse, appelez-moi dès votre arrivée.',
      'Merci beaucoup pour votre réactivité !',
    ];
  }

  filteredConversations(): ConversationSummary[] {
    const term = this.searchTerm.toLowerCase().trim();
    const list = this.conversations();
    if (!term) return list;
    return list.filter(
      (c) =>
        c.partner_name.toLowerCase().includes(term) ||
        c.partner_email.toLowerCase().includes(term) ||
        (c.request_category && c.request_category.toLowerCase().includes(term))
    );
  }

  refreshAll(): void {
    this.loadConversations(false);
    const pid = this.selectedPartnerId();
    if (pid) {
      this.loadMessagesForPartner(pid, true);
    }
  }

  loadConversations(autoSelectFirst: boolean): void {
    this.userService.getConversations().subscribe({
      next: (list) => {
        const data = list || [];
        this.conversations.set(data);
        const totalUnread = data.reduce((acc, item) => acc + (item.unread_count || 0), 0);
        this.unreadTotalChange.emit(totalUnread);

        if (this.initialPartnerId && !this.selectedPartnerId()) {
          this.selectedPartnerId.set(Number(this.initialPartnerId));
          this.loadMessagesForPartner(Number(this.initialPartnerId), true);
          return;
        }

        if (this.initialRequestId && !this.selectedPartnerId()) {
          this.matchRequestToPartner(Number(this.initialRequestId));
        }

        if (autoSelectFirst && !this.selectedPartnerId() && data.length > 0) {
          this.selectConversation(data[0]);
        }
      },
    });
  }

  private matchRequestToPartner(reqId: number): void {
    const match = this.conversations().find((c) => c.request_id === reqId);
    if (match) {
      this.selectConversation(match);
    } else if (this.conversations().length > 0 && !this.selectedPartnerId()) {
      this.selectConversation(this.conversations()[0]);
    }
  }

  selectConversation(conv: ConversationSummary): void {
    this.selectedPartnerId.set(conv.partner_id);
    this.loadMessagesForPartner(conv.partner_id, true);
  }

  loadMessagesForPartner(partnerId: number, showSpinner: boolean): void {
    if (showSpinner) {
      this.isLoading.set(true);
    }
    this.userService.getConversationMessages(partnerId).subscribe({
      next: (res) => {
        this.activeConversation.set(res);
        this.messages.set(res.messages || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  useQuickReply(text: string): void {
    this.newMessage = text;
    this.sendMessage();
  }

  sendMessage(): void {
    const pid = this.selectedPartnerId();
    const content = this.newMessage.trim();
    if (!pid || !content) return;

    const reqId =
      this.activeConversation()?.request?.id ||
      this.conversations().find((c) => c.partner_id === pid)?.request_id ||
      this.initialRequestId ||
      null;

    this.isSending.set(true);
    this.userService.sendDirectMessage(pid, content, reqId).subscribe({
      next: (msg) => {
        this.newMessage = '';
        this.isSending.set(false);
        this.messages.update((prev) => [...prev, msg]);
        this.loadConversations(false);
      },
      error: () => {
        this.isSending.set(false);
      },
    });
  }

  partnerName(): string {
    const active = this.activeConversation()?.partner;
    if (active) return active.username;
    const conv = this.conversations().find((c) => c.partner_id === this.selectedPartnerId());
    return conv?.partner_name || 'Interlocuteur';
  }

  partnerEmail(): string {
    const active = this.activeConversation()?.partner;
    if (active) return active.email;
    const conv = this.conversations().find((c) => c.partner_id === this.selectedPartnerId());
    return conv?.partner_email || '';
  }

  partnerPhone(): string {
    const active = this.activeConversation()?.partner;
    if (active) return active.phone;
    const conv = this.conversations().find((c) => c.partner_id === this.selectedPartnerId());
    return conv?.partner_phone || '';
  }

  partnerRole(): string {
    const active = this.activeConversation()?.partner;
    if (active) return active.role;
    const conv = this.conversations().find((c) => c.partner_id === this.selectedPartnerId());
    return conv?.partner_role || 'technician';
  }

  linkedRequestInfo() {
    return this.activeConversation()?.request || null;
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'En attente',
      accepted: 'Acceptée',
      en_route: 'En route',
      in_progress: 'En cours',
      completed: 'Terminée',
      paid: 'Payée',
      cancelled: 'Annulée',
    };
    return map[status] || status;
  }
}
