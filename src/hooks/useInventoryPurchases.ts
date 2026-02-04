import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PaymentMethod } from '@/types';

export function useDeleteInventoryPurchase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (purchaseId: string) => {
      const { error } = await supabase
        .from('inventory_purchases')
        .delete()
        .eq('id', purchaseId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-purchases'] });
      toast({
        title: 'Compra eliminada',
        description: 'El registro fue eliminado del historial',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: error.message || 'No se pudo eliminar el registro',
      });
    },
  });
}

interface InventoryPurchase {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit: string;
  purchase_price: number;
  total_cost: number;
  payment_method: PaymentMethod;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

interface RestockData {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  staffId?: string;
}

export function useInventoryPurchases() {
  return useQuery({
    queryKey: ['inventory-purchases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_purchases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as InventoryPurchase[];
    },
  });
}

export function useRestockProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: RestockData) => {
      const totalCost = data.purchasePrice * data.quantity;

      // 1. Register the purchase in inventory_purchases
      const { error: purchaseError } = await supabase
        .from('inventory_purchases')
        .insert({
          product_id: data.productId,
          product_name: data.productName,
          quantity: data.quantity,
          unit: data.unit,
          purchase_price: data.purchasePrice,
          total_cost: totalCost,
          payment_method: data.paymentMethod,
          notes: data.notes || null,
          created_by: data.staffId || null,
        });

      if (purchaseError) throw purchaseError;

      // 2. Get current product data
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('quantity, min_stock, units_per_package')
        .eq('id', data.productId)
        .single();

      if (productError) throw productError;

      // 3. Update product quantity and purchase price
      const newQuantity = Number(productData.quantity) + data.quantity;
      const newStatus = newQuantity <= 0 ? 'critical' : newQuantity <= productData.min_stock ? 'low' : 'normal';
      
      // Calculate cost per unit based on new purchase
      const costPerUnit = data.purchasePrice;

      const { error: updateError } = await supabase
        .from('products')
        .update({
          quantity: newQuantity,
          status: newStatus,
          purchase_price: data.purchasePrice, // Update to new purchase price
          cost_per_unit: costPerUnit,
        })
        .eq('id', data.productId);

      if (updateError) throw updateError;

      // 4. Register as expense (negative balance)
      const { error: expenseError } = await supabase
        .from('expenses')
        .insert({
          amount: totalCost,
          category: 'drinks', // Using drinks as general purchase category
          description: `Reabastecimiento: ${data.productName} (${data.quantity} ${data.unit})`,
          payment_method: data.paymentMethod,
        });

      if (expenseError) throw expenseError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({
        title: 'Reabastecimiento registrado',
        description: 'El stock se actualizó y el gasto se registró correctamente',
      });
    },
    onError: (error: any) => {
      console.error('Restock error:', error);
      toast({
        variant: 'destructive',
        title: 'Error al reabastecer',
        description: error.message || 'No se pudo registrar el reabastecimiento',
      });
    },
  });
}
