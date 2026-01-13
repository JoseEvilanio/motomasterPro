
export enum UserRole {
  ADMIN = 'ADMIN',
  MECHANIC = 'MECHANIC',
  ATTENDANT = 'ATTENDANT'
}

export enum OSStatus {
  OPEN = 'OPEN',
  QUOTE = 'QUOTE',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_PARTS = 'WAITING_PARTS',
  READY = 'READY',
  FINISHED = 'FINISHED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export enum SaleStatus {
  QUOTE = 'QUOTE',
  ORDER = 'ORDER',
  FINALIZED = 'FINALIZED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PIX = 'PIX',
  INSTALLMENTS = 'INSTALLMENTS'
}

export enum FiscalStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export enum EmploymentType {
  COMMISSION = 'COMMISSION',
  CLT = 'CLT',
  CLT_COMMISSION = 'CLT_COMMISSION'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  ownerId?: string; // Links to the workshop owner (if user is a mechanic)
}

export interface Client {
  id: string;
  ownerId: string; // ID do Proprietário da Oficina
  userId?: string; // ID do usuário autenticado no Firebase Auth
  name: string;
  phone: string;
  email: string;
  avatar?: string;
  taxId?: string;
}

export interface Vehicle {
  id: string;
  ownerId: string;
  clientId: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string;
}

export interface Product {
  id: string;
  ownerId: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  minStock: number;
  ncm?: string;
  imageUrl?: string;
}

export interface Transaction {
  id: string;
  ownerId: string;
  label: string;
  category: 'INCOME' | 'EXPENSE';
  amount: number;
  date: any;
  status: 'PAID' | 'PENDING';
  paymentMethod?: string;
  osId?: string;
}

export interface ServiceOrder {
  id: string;
  ownerId: string;
  clientId: string;
  vehicleId: string;
  mechanicId: string;
  status: OSStatus;
  fiscalStatus: FiscalStatus;
  danfeUrl?: string;
  description: string;
  bodyLines: string[]; // 9 lines of OS body
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    type: 'PRODUCT' | 'SERVICE';
    ncm?: string;
  }>;
  total: number;
  printCount?: number;
  lastPrintedAt?: any;
  statusNotes?: string;
  osNumber?: string; // 6-digit numeric ID (e.g., "123456")
  createdAt: any;
  updatedAt: any;
}

// Added FiscalConfig interface to fix import error in components/SettingsView.tsx
export interface FiscalConfig {
  environment: 'HOMOLOGATION' | 'PRODUCTION';
  taxRegime: 'SIMPLES' | 'NORMAL';
  stateTaxId: string;
  municipalTaxId: string;
  hasCertificate: boolean;
}

export interface WorkshopSettings {
  id?: string;
  ownerId: string;
  businessName: string;
  taxId: string;
  email: string;
  logoUrl?: string;
  fiscal: FiscalConfig;
  automation: {
    whatsapp: boolean;
    aiEngine: boolean;
    smartReports: boolean;
    cloudSync: boolean;
  };
  updatedAt: any;
}

export interface Mechanic {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  userId?: string; // Links to the Auth User ID
  email?: string;
  specialty?: string;
  active: boolean;
  employmentType: EmploymentType;
  baseSalary?: number;
  commissionRate?: number;
  createdAt: any;
  updatedAt: any;
}

export interface Service {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  estimatedTime?: string;
  createdAt: any;
  updatedAt: any;
}

export interface SaleItem {
  id: string; // SKU or internal ID
  name: string;
  price: number;
  quantity: number;
  discount: number; // Item level discount
  type: 'PRODUCT' | 'SERVICE';
}

export interface Sale {
  id: string;
  ownerId: string;
  clientId?: string;
  sellerId: string;
  items: SaleItem[];
  subtotal: number;
  totalDiscount: number; // Global discount
  total: number;
  status: SaleStatus;
  paymentMethod: string;
  isInstallments: boolean;
  installmentsCount?: number;
  printCount?: number;
  lastPrintedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export type View = 'DASHBOARD' | 'CLIENTS' | 'VEHICLES' | 'OS' | 'INVENTORY' | 'SERVICES' | 'SALES' | 'FINANCIAL' | 'REPORTS' | 'SETTINGS';
