import { environment } from '../../environments/environment';

export const API_URL = environment.apiUrl;
export const WS_URL = environment.wsUrl || 'ws://localhost:8000/ws';
