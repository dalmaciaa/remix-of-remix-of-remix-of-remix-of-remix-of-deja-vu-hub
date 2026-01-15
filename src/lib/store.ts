import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, Sale, Expense, StockAdjustment, ProductCategory, PaymentMethod, ExpenseCategory, StockStatus } from '@/types';

const generateId = () => Math.random().toString(36).substr(2, 9);

const calculateStockStatus = (quantity: number, minStock: number): StockStatus => {
  if (quantity <= 0) return 'critical';
  if (quantity <= minStock) return 'low';
  return 'normal';
};

interface StoreState {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  adjustments: StockAdjustment[];
  
  // Product actions
  addProduct: (product: Omit<Product, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, updates: Partial<Omit<Product, 'id' | 'status' | 'createdAt' | 'updatedAt'>>) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (productId: string, newQuantity: number, reason: StockAdjustment['reason'], notes: string) => void;
  
  // Sale actions
  addSale: (items: { productId: string; quantity: number }[], paymentMethod: PaymentMethod, concept: string) => boolean;
  updateSale: (id: string, updates: Partial<Omit<Sale, 'id' | 'createdAt'>>) => void;
  deleteSale: (id: string) => void;
  
  // Expense actions
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateExpense: (id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>) => void;
  deleteExpense: (id: string) => void;
}

// Initial sample data
const initialProducts: Product[] = [
  { id: '1', name: 'Cerveza Corona', category: 'drinks', purchasePrice: 15, salePrice: 35, quantity: 48, minStock: 24, status: 'normal', unitBase: 'ml', costPerUnit: null, unitsPerPackage: 1, packageCount: 48, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Whisky Jack Daniels', category: 'drinks', purchasePrice: 350, salePrice: 80, quantity: 750, minStock: 500, status: 'normal', unitBase: 'ml', costPerUnit: 0.47, unitsPerPackage: 750, packageCount: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Vodka Absolut', category: 'drinks', purchasePrice: 280, salePrice: 70, quantity: 500, minStock: 750, status: 'low', unitBase: 'ml', costPerUnit: 0.37, unitsPerPackage: 750, packageCount: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'Limones', category: 'supplies', purchasePrice: 25, salePrice: 0, quantity: 2, minStock: 5, status: 'critical', unitBase: 'kg', costPerUnit: 25, unitsPerPackage: 1, packageCount: 2, createdAt: new Date(), updatedAt: new Date() },
  { id: '5', name: 'Azúcar', category: 'supplies', purchasePrice: 30, salePrice: 0, quantity: 5, minStock: 3, status: 'normal', unitBase: 'kg', costPerUnit: 30, unitsPerPackage: 1, packageCount: 5, createdAt: new Date(), updatedAt: new Date() },
  { id: '6', name: 'Hielo', category: 'supplies', purchasePrice: 35, salePrice: 0, quantity: 8, minStock: 10, status: 'low', unitBase: 'kg', costPerUnit: 35, unitsPerPackage: 1, packageCount: 8, createdAt: new Date(), updatedAt: new Date() },
  { id: '7', name: 'Queso Cheddar', category: 'supplies', purchasePrice: 40, salePrice: 0, quantity: 2000, minStock: 1000, status: 'normal', unitBase: 'g', costPerUnit: 0.02, unitsPerPackage: 1000, packageCount: 2, createdAt: new Date(), updatedAt: new Date() },
  { id: '8', name: 'Pollo', category: 'supplies', purchasePrice: 60, salePrice: 0, quantity: 5, minStock: 3, status: 'normal', unitBase: 'kg', costPerUnit: 60, unitsPerPackage: 1, packageCount: 5, createdAt: new Date(), updatedAt: new Date() },
  { id: '9', name: 'Papas', category: 'supplies', purchasePrice: 25, salePrice: 0, quantity: 3, minStock: 5, status: 'low', unitBase: 'kg', costPerUnit: 25, unitsPerPackage: 1, packageCount: 3, createdAt: new Date(), updatedAt: new Date() },
];

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

const initialSales: Sale[] = [
  { id: '1', items: [{ productId: '1', productName: 'Cerveza Corona', quantity: 6, unitPrice: 35, total: 210 }], totalAmount: 210, paymentMethod: 'cash', concept: 'Mesa 5', createdAt: today },
  { id: '2', items: [{ productId: '5', productName: 'Margarita', quantity: 2, unitPrice: 90, total: 180 }, { productId: '7', productName: 'Nachos con Queso', quantity: 1, unitPrice: 120, total: 120 }], totalAmount: 300, paymentMethod: 'transfer', concept: 'Mesa 3', createdAt: today },
  { id: '3', items: [{ productId: '2', productName: 'Whisky Jack Daniels', quantity: 1, unitPrice: 80, total: 80 }], totalAmount: 80, paymentMethod: 'qr', concept: 'Barra', createdAt: yesterday },
];

const initialExpenses: Expense[] = [
  { id: '1', amount: 5000, category: 'drinks', description: 'Reposición de cervezas', paymentMethod: 'transfer', createdAt: today },
  { id: '2', amount: 15000, category: 'staff', description: 'Salario DJ viernes', paymentMethod: 'cash', createdAt: today },
  { id: '3', amount: 2500, category: 'maintenance', description: 'Reparación aire acondicionado', paymentMethod: 'transfer', createdAt: yesterday },
];

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      products: initialProducts,
      sales: initialSales,
      expenses: initialExpenses,
      adjustments: [],

      addProduct: (product) => {
        const newProduct: Product = {
          ...product,
          id: generateId(),
          status: calculateStockStatus(product.quantity, product.minStock),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ products: [...state.products, newProduct] }));
      },

      updateProduct: (id, updates) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== id) return p;
            const updated = { ...p, ...updates, updatedAt: new Date() };
            updated.status = calculateStockStatus(updated.quantity, updated.minStock);
            return updated;
          }),
        }));
      },

      deleteProduct: (id) => {
        set((state) => ({ products: state.products.filter((p) => p.id !== id) }));
      },

      adjustStock: (productId, newQuantity, reason, notes) => {
        const product = get().products.find((p) => p.id === productId);
        if (!product) return;

        const adjustment: StockAdjustment = {
          id: generateId(),
          productId,
          productName: product.name,
          previousQuantity: product.quantity,
          newQuantity,
          reason,
          notes,
          createdAt: new Date(),
        };

        set((state) => ({
          adjustments: [...state.adjustments, adjustment],
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            return {
              ...p,
              quantity: newQuantity,
              status: calculateStockStatus(newQuantity, p.minStock),
              updatedAt: new Date(),
            };
          }),
        }));
      },

      addSale: (items, paymentMethod, concept) => {
        const products = get().products;
        
        // Check stock availability
        for (const item of items) {
          const product = products.find((p) => p.id === item.productId);
          if (!product || product.quantity < item.quantity) {
            return false;
          }
        }

        const saleItems = items.map((item) => {
          const product = products.find((p) => p.id === item.productId)!;
          return {
            productId: item.productId,
            productName: product.name,
            quantity: item.quantity,
            unitPrice: product.salePrice,
            total: product.salePrice * item.quantity,
          };
        });

        const sale: Sale = {
          id: generateId(),
          items: saleItems,
          totalAmount: saleItems.reduce((sum, item) => sum + item.total, 0),
          paymentMethod,
          concept,
          createdAt: new Date(),
        };

        set((state) => ({
          sales: [...state.sales, sale],
          products: state.products.map((p) => {
            const saleItem = items.find((i) => i.productId === p.id);
            if (!saleItem) return p;
            const newQuantity = p.quantity - saleItem.quantity;
            return {
              ...p,
              quantity: newQuantity,
              status: calculateStockStatus(newQuantity, p.minStock),
              updatedAt: new Date(),
            };
          }),
        }));

        return true;
      },

      updateSale: (id, updates) => {
        set((state) => ({
          sales: state.sales.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        }));
      },

      deleteSale: (id) => {
        set((state) => ({ sales: state.sales.filter((s) => s.id !== id) }));
      },

      addExpense: (expense) => {
        const newExpense: Expense = {
          ...expense,
          id: generateId(),
          createdAt: new Date(),
        };
        set((state) => ({ expenses: [...state.expenses, newExpense] }));
      },

      updateExpense: (id, updates) => {
        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        }));
      },

      deleteExpense: (id) => {
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
      },
    }),
    {
      name: 'dejavu-store',
    }
  )
);
