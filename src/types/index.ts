export type ProductCategory = 'drinks' | 'cocktails' | 'food' | 'supplies' | 'others' | 'semi_elaborated';
export type InventoryCategory = 'supplies' | 'drinks' | 'others' | 'semi_elaborated';
export type CatalogCategory = 'food' | 'cocktails' | 'drinks';
export type PaymentMethod = 'cash' | 'transfer' | 'qr';
export type ExpenseCategory = 'drinks' | 'suppliers' | 'staff' | 'events' | 'maintenance' | 'others';
export type StockStatus = 'normal' | 'low' | 'critical';

export type UnitType = 'unidad' | 'kg' | 'g' | 'L' | 'ml' | 'medida' | 'oz';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
  minStock: number;
  status: StockStatus;
  unitBase: UnitType;
  costPerUnit: number | null;
  unitsPerPackage: number;
  packageCount: number;
  isCompound?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  concept: string;
  createdAt: Date;
}

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  paymentMethod: PaymentMethod;
  createdAt: Date;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  previousQuantity: number;
  newQuantity: number;
  reason: 'loss' | 'internal_consumption' | 'breakage' | 'correction';
  notes: string;
  createdAt: Date;
}

export type EventStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface EventComplement {
  id: string;
  eventId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  createdAt: Date;
}

export interface Event {
  id: string;
  eventType: string;
  eventDate: Date;
  clientName: string;
  clientPhone: string;
  basePrice: number;
  totalAmount: number;
  notes: string;
  status: EventStatus;
  complements: EventComplement[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  todayIncome: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  balance: number;
  lowStockProducts: Product[];
}
