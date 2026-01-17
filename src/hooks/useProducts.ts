import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product, ProductCategory, StockStatus, StockAdjustment } from '@/types';
import { toast } from 'sonner';

const calculateStockStatus = (quantity: number, minStock: number): StockStatus => {
  if (quantity <= 0) return 'critical';
  if (quantity <= minStock) return 'low';
  return 'normal';
};

// Transform database row to Product type
const toProduct = (row: any): Product => ({
  id: row.id,
  name: row.name,
  category: row.category as ProductCategory,
  purchasePrice: Number(row.purchase_price),
  salePrice: Number(row.sale_price),
  quantity: row.quantity,
  minStock: row.min_stock,
  status: row.status as StockStatus,
  unitBase: row.unit_base || 'unidad',
  costPerUnit: row.cost_per_unit ? Number(row.cost_per_unit) : null,
  unitsPerPackage: row.units_per_package ? Number(row.units_per_package) : 1,
  packageCount: row.package_count ? Number(row.package_count) : 0,
  isCompound: row.is_compound || false,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      return data.map(toProduct);
    },
    refetchInterval: 10000, // Refetch every 10 seconds for stock alerts
  });
}

export function useAddProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'isCompound'>) => {
      const status = calculateStockStatus(product.quantity, product.minStock);
      
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: product.name,
          category: product.category,
          purchase_price: product.purchasePrice,
          sale_price: product.salePrice,
          quantity: product.quantity,
          min_stock: product.minStock,
          status: status,
          unit_base: product.unitBase || 'unidad',
          cost_per_unit: product.costPerUnit || null,
          units_per_package: product.unitsPerPackage || 1,
          package_count: product.packageCount || 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Si tiene precio de compra, registrar como gasto (saldo negativo)
      // Solo para productos que no son semielaborados
      if (product.purchasePrice > 0 && product.category !== 'semi_elaborated') {
        const { error: expenseError } = await supabase
          .from('expenses')
          .insert({
            amount: product.purchasePrice,
            category: product.category === 'drinks' ? 'drinks' : 'suppliers',
            description: `Compra: ${product.name}`,
            payment_method: 'cash',
          });

        if (expenseError) {
          console.error('Error registering purchase expense:', expenseError);
          // No lanzamos error aquí para no bloquear la creación del producto
        }
      }

      return toProduct(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Producto agregado');
    },
    onError: (error) => {
      console.error('Error adding product:', error);
      toast.error('Error al agregar producto');
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Product, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'isCompound'>> }) => {
      // Get current product to calculate new status
      const { data: current } = await supabase
        .from('products')
        .select('quantity, min_stock')
        .eq('id', id)
        .single();

      const newQuantity = updates.quantity ?? current?.quantity ?? 0;
      const newMinStock = updates.minStock ?? current?.min_stock ?? 0;
      const status = calculateStockStatus(newQuantity, newMinStock);

      const updateData: any = { status };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.purchasePrice !== undefined) updateData.purchase_price = updates.purchasePrice;
      if (updates.salePrice !== undefined) updateData.sale_price = updates.salePrice;
      if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
      if (updates.minStock !== undefined) updateData.min_stock = updates.minStock;
      if (updates.unitBase !== undefined) updateData.unit_base = updates.unitBase;
      if (updates.costPerUnit !== undefined) updateData.cost_per_unit = updates.costPerUnit;
      if (updates.unitsPerPackage !== undefined) updateData.units_per_package = updates.unitsPerPackage;
      if (updates.packageCount !== undefined) updateData.package_count = updates.packageCount;

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return toProduct(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Producto actualizado');
    },
    onError: (error) => {
      console.error('Error updating product:', error);
      toast.error('Error al actualizar producto');
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Producto eliminado');
    },
    onError: (error) => {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar producto');
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      productId, 
      newQuantity, 
      reason, 
      notes 
    }: { 
      productId: string; 
      newQuantity: number; 
      reason: StockAdjustment['reason']; 
      notes: string;
    }) => {
      // Get current product
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      // Create adjustment record
      const { error: adjustError } = await supabase
        .from('stock_adjustments')
        .insert({
          product_id: productId,
          product_name: product.name,
          previous_quantity: product.quantity,
          new_quantity: newQuantity,
          reason: reason,
          notes: notes,
        });

      if (adjustError) throw adjustError;

      // Update product quantity and status
      const status = calculateStockStatus(newQuantity, product.min_stock);
      const { error: updateError } = await supabase
        .from('products')
        .update({ quantity: newQuantity, status })
        .eq('id', productId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Stock ajustado');
    },
    onError: (error) => {
      console.error('Error adjusting stock:', error);
      toast.error('Error al ajustar stock');
    },
  });
}
