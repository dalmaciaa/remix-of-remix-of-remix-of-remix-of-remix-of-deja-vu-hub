import { ProductCategory, ExpenseCategory, PaymentMethod, StockStatus, InventoryCategory, CatalogCategory, UnitType } from '@/types';

export const productCategoryLabels: Record<ProductCategory, string> = {
  drinks: 'Bebidas',
  cocktails: 'Cócteles',
  food: 'Comida',
  supplies: 'Insumos',
  others: 'Otros',
  semi_elaborated: 'Semielaborados',
};

export const inventoryCategoryLabels: Record<InventoryCategory, string> = {
  supplies: 'Insumos',
  drinks: 'Bebidas',
  others: 'Otros',
  semi_elaborated: 'Semielaborados',
};

export const catalogCategoryLabels: Record<CatalogCategory, string> = {
  food: 'Comida',
  cocktails: 'Cócteles',
  drinks: 'Bebidas',
};

export const unitLabels: Record<UnitType, string> = {
  unidad: 'Unidad',
  kg: 'Kilogramos (kg)',
  g: 'Gramos (g)',
  L: 'Litros (L)',
  ml: 'Mililitros (ml)',
  medida: 'Medida (trago)',
  oz: 'Onzas (oz)',
};

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  drinks: 'Bebidas',
  suppliers: 'Proveedores',
  staff: 'Personal',
  events: 'Eventos',
  maintenance: 'Mantenimiento',
  others: 'Otros',
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  qr: 'QR',
};

export const stockStatusLabels: Record<StockStatus, string> = {
  normal: 'Normal',
  low: 'Bajo',
  critical: 'Crítico',
};

export const adjustmentReasonLabels: Record<string, string> = {
  loss: 'Pérdida',
  internal_consumption: 'Consumo interno',
  breakage: 'Rotura',
  correction: 'Corrección',
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
};

export const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

export const isToday = (date: Date): boolean => {
  const today = new Date();
  const d = new Date(date);
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
};

export const isThisMonth = (date: Date): boolean => {
  const today = new Date();
  const d = new Date(date);
  return d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
};
