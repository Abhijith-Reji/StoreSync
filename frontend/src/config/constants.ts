export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const APP_NAME = 'StoreSync';
export const DEFAULT_COUNTER_ID = 'COUNTER-01';

export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  SALESPERSON = 'SALESPERSON',
}

export enum PaymentMethod {
  CASH = 'CASH',
  UPI = 'UPI',
  CARD = 'CARD',
  SPLIT = 'SPLIT',
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  counterId: string;
  sessionId?: string;
  permissions?: string[];
}
