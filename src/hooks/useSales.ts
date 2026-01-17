import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale, SaleItem, PaymentMethod, StockStatus } from '@/types';
import { toast } from 'sonner';

const calculateStockStatus = (quantity: number, minStock: number): StockStatus => {
  if (quantity <= 0) return 'critical';
  if (quantity <= minStock) return 'low';
  return 'normal';
};

export type PaymentStatus = 'cobrado' | 'no_cobrado';

export interface SaleWithStatus extends Sale {
  paymentStatus: PaymentStatus;
  staffId: string | null;
  staffName: string | null;
  tableNumber: string | null;
}

// Transform database rows to Sale type
const toSale = (saleRow: any, itemRows: any[]): SaleWithStatus => ({
  id: saleRow.id,
  items: itemRows.map((item): SaleItem => ({
    productId: item.product_id || '',
    productName: item.product_name,
    quantity: item.quantity,
    unitPrice: Number(item.unit_price),
    total: Number(item.total),
  })),
  totalAmount: Number(saleRow.total_amount),
  paymentMethod: saleRow.payment_method as PaymentMethod,
  paymentStatus: saleRow.payment_status as PaymentStatus,
  concept: saleRow.concept || '',
  createdAt: new Date(saleRow.created_at),
  staffId: saleRow.staff_id || null,
  staffName: saleRow.staff_name || null,
  tableNumber: saleRow.table_number || null,
});

export function useSales() {
  return useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      // Fetch sales
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      // Fetch all sale items
      const { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .select('*');

      if (itemsError) throw itemsError;

      // Group items by sale_id
      const itemsBySale = itemsData.reduce((acc: Record<string, any[]>, item) => {
        if (!acc[item.sale_id]) acc[item.sale_id] = [];
        acc[item.sale_id].push(item);
        return acc;
      }, {});

      return salesData.map((sale) => toSale(sale, itemsBySale[sale.id] || []));
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time feel
  });
}

export function useAddSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      items, 
      paymentMethod, 
      concept,
      isPaid,
      tableNumber,
      staffName,
      staffId,
    }: { 
      items: { productId: string; quantity: number; notes?: string }[]; 
      paymentMethod: PaymentMethod; 
      concept: string;
      isPaid: boolean;
      tableNumber?: string;
      staffName?: string;
      staffId?: string;
    }) => {
      // Get products to check stock and get prices
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('*')
        .in('id', items.map(i => i.productId));

      if (prodError) throw prodError;

      // Check stock availability for drinks directly
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
          throw new Error(`Producto no encontrado`);
        }
        // Solo validar stock para bebidas directas (no compuestas)
        if (product.category === 'drinks' && !product.is_compound && product.quantity < item.quantity) {
          throw new Error(`Stock insuficiente para ${product.name}`);
        }
      }

      // Check ingredient stock for compound products (food, cocktails, compound drinks)
      const ingredientShortages: string[] = [];
      
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product || !product.is_compound) continue;

        // Get recipe for this product
        const { data: recipeItems, error: recipeError } = await supabase
          .from('recipes')
          .select('ingredient_id, quantity')
          .eq('product_id', item.productId);

        if (recipeError) {
          console.error('Error fetching recipe:', recipeError);
          continue;
        }

        if (!recipeItems || recipeItems.length === 0) {
          // No recipe configured, skip validation
          continue;
        }

        // Get current ingredient quantities
        const ingredientIds = recipeItems.map(r => r.ingredient_id);
        const { data: ingredients, error: ingError } = await supabase
          .from('products')
          .select('id, name, quantity')
          .in('id', ingredientIds);

        if (ingError) {
          console.error('Error fetching ingredients:', ingError);
          continue;
        }

        // Check if we have enough of each ingredient
        for (const recipeItem of recipeItems) {
          const ingredient = ingredients?.find(i => i.id === recipeItem.ingredient_id);
          if (!ingredient) continue;

          const requiredQuantity = Number(recipeItem.quantity) * item.quantity;
          const availableQuantity = Number(ingredient.quantity);

          if (availableQuantity < requiredQuantity) {
            ingredientShortages.push(
              `${ingredient.name} (necesario: ${requiredQuantity}, disponible: ${availableQuantity})`
            );
          }
        }
      }

      // If there are ingredient shortages, throw error with details
      if (ingredientShortages.length > 0) {
        throw new Error(`Stock insuficiente de ingredientes:\n${ingredientShortages.join('\n')}`);
      }

      // Calculate sale items and total
      const saleItems = items.map((item) => {
        const product = products.find(p => p.id === item.productId)!;
        return {
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: Number(product.sale_price),
          total: Number(product.sale_price) * item.quantity,
          notes: item.notes,
          requiresKitchen: product.requires_kitchen || false,
        };
      });

      const totalAmount = saleItems.reduce((sum, item) => sum + item.total, 0);

      // Create sale with payment status
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          total_amount: totalAmount,
          payment_method: paymentMethod,
          concept: concept || 'Venta general',
          payment_status: isPaid ? 'cobrado' : 'no_cobrado',
          table_number: tableNumber || null,
          staff_name: staffName || null,
          staff_id: staffId || null,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems.map(item => ({
          sale_id: sale.id,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.total,
        })));

      if (itemsError) throw itemsError;

      // Check if any items require kitchen order (food)
      const kitchenItems = saleItems.filter(item => item.requiresKitchen);
      // Check if any items are cocktails (bartender orders)
      const bartenderItems = saleItems.filter(item => {
        const product = products.find(p => p.id === item.productId);
        return product?.category === 'cocktails';
      });
      
      if (kitchenItems.length > 0) {
        // Create kitchen order
        const { data: kitchenOrder, error: koError } = await supabase
          .from('kitchen_orders')
          .insert({
            sale_id: sale.id,
            staff_name: staffName || 'Sistema',
            staff_id: staffId || null,
            table_number: tableNumber || null,
            notes: concept || null,
            status: 'pendiente',
          })
          .select()
          .single();

        if (koError) throw koError;

        // Create kitchen order items
        const { error: koiError } = await supabase
          .from('kitchen_order_items')
          .insert(kitchenItems.map(item => ({
            kitchen_order_id: kitchenOrder.id,
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            notes: item.notes || null,
          })));

        if (koiError) throw koiError;

        // Create notification for kitchen staff
        await supabase
          .from('staff_notifications')
          .insert({
            role_target: 'cocina',
            title: 'Nuevo Pedido',
            message: `Mesa ${tableNumber || 'S/N'}: ${kitchenItems.map(i => `${i.quantity}x ${i.productName}`).join(', ')}`,
            type: 'kitchen_order',
            related_id: kitchenOrder.id,
          });
      }

      // Create bartender order for cocktails
      if (bartenderItems.length > 0) {
        const { data: bartenderOrder, error: boError } = await supabase
          .from('bartender_orders')
          .insert({
            sale_id: sale.id,
            staff_name: staffName || 'Sistema',
            staff_id: staffId || null,
            table_number: tableNumber || null,
            notes: concept || null,
            status: 'pendiente',
          })
          .select()
          .single();

        if (boError) throw boError;

        // Create bartender order items
        const { error: boiError } = await supabase
          .from('bartender_order_items')
          .insert(bartenderItems.map(item => ({
            bartender_order_id: bartenderOrder.id,
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            notes: item.notes || null,
          })));

        if (boiError) throw boiError;

        // Create notification for bartender staff
        await supabase
          .from('staff_notifications')
          .insert({
            role_target: 'bartender',
            title: 'Nuevo Pedido de Tragos',
            message: `Mesa ${tableNumber || 'S/N'}: ${bartenderItems.map(i => `${i.quantity}x ${i.productName}`).join(', ')}`,
            type: 'bartender_order',
            related_id: bartenderOrder.id,
          });
      }

      // Update product quantities - collect all updates first, then execute in parallel
      const stockUpdates: Promise<void>[] = [];
      
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;
        
        // Para bebidas directas (no compuestas), descontar stock del producto
        if (product.category === 'drinks' && !product.is_compound) {
          const newQuantity = Number(product.quantity) - item.quantity;
          const status = calculateStockStatus(newQuantity, product.min_stock);

          stockUpdates.push(
            (async () => {
              const { error } = await supabase
                .from('products')
                .update({ quantity: newQuantity, status })
                .eq('id', item.productId);
              if (error) console.error('Error updating drink stock:', error);
            })()
          );
        }
        
        // Para productos compuestos (cocktails, food) O bebidas compuestas, descontar ingredientes de la receta
        if (product.is_compound) {
          stockUpdates.push(
            (async () => {
              try {
                // Obtener la receta del producto
                const { data: recipeItems, error: recipeError } = await supabase
                  .from('recipes')
                  .select('ingredient_id, quantity, unit')
                  .eq('product_id', item.productId);

                if (recipeError) {
                  console.error('Error fetching recipe:', recipeError);
                  return;
                }

                if (!recipeItems || recipeItems.length === 0) {
                  console.warn(`Producto compuesto ${product.name} sin receta configurada`);
                  return;
                }

                // Obtener los ingredientes actuales
                const ingredientIds = recipeItems.map(r => r.ingredient_id);
                const { data: ingredients, error: ingError } = await supabase
                  .from('products')
                  .select('id, quantity, min_stock, unit_base')
                  .in('id', ingredientIds);

                if (ingError) {
                  console.error('Error fetching ingredients:', ingError);
                  return;
                }

                // Descontar cada ingrediente según la receta
                for (const recipeItem of recipeItems) {
                  const ingredient = ingredients?.find(i => i.id === recipeItem.ingredient_id);
                  if (!ingredient) {
                    console.warn(`Ingrediente no encontrado: ${recipeItem.ingredient_id}`);
                    continue;
                  }

                  // Calcular cantidad a descontar (cantidad de receta * cantidad vendida)
                  const quantityToDeduct = Number(recipeItem.quantity) * item.quantity;
                  const currentQuantity = Number(ingredient.quantity);
                  const newIngredientQuantity = Math.max(0, currentQuantity - quantityToDeduct);
                  const newStatus = calculateStockStatus(newIngredientQuantity, ingredient.min_stock);

                  const { error: updateIngError } = await supabase
                    .from('products')
                    .update({ 
                      quantity: newIngredientQuantity, 
                      status: newStatus 
                    })
                    .eq('id', recipeItem.ingredient_id);

                  if (updateIngError) {
                    console.error('Error updating ingredient stock:', updateIngError);
                  }
                }
              } catch (err) {
                console.error('Error processing compound product stock:', err);
              }
            })()
          );
        }
      }

      // Execute all stock updates in parallel (with error handling)
      if (stockUpdates.length > 0) {
        await Promise.all(stockUpdates);
      }

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      toast.success('Venta registrada');
    },
    onError: (error) => {
      console.error('Error adding sale:', error);
      toast.error(error.message || 'Error al registrar venta');
    },
  });
}

export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      saleId, 
      paymentStatus, 
      paymentMethod 
    }: { 
      saleId: string; 
      paymentStatus: PaymentStatus;
      paymentMethod?: PaymentMethod;
    }) => {
      const updateData: any = { payment_status: paymentStatus };
      if (paymentMethod) {
        updateData.payment_method = paymentMethod;
      }

      const { error } = await supabase
        .from('sales')
        .update(updateData)
        .eq('id', saleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Estado de pago actualizado');
    },
    onError: (error) => {
      console.error('Error updating payment status:', error);
      toast.error('Error al actualizar estado de pago');
    },
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Venta eliminada');
    },
    onError: (error) => {
      console.error('Error deleting sale:', error);
      toast.error('Error al eliminar venta');
    },
  });
}
