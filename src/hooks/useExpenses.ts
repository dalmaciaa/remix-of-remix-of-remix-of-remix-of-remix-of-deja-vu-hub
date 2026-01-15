import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Expense, ExpenseCategory, PaymentMethod } from '@/types';
import { toast } from 'sonner';

// Transform database row to Expense type
const toExpense = (row: any): Expense => ({
  id: row.id,
  amount: Number(row.amount),
  category: row.category as ExpenseCategory,
  description: row.description || '',
  paymentMethod: row.payment_method as PaymentMethod,
  createdAt: new Date(row.created_at),
});

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(toExpense);
    },
  });
}

export function useAddExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expense: Omit<Expense, 'id' | 'createdAt'>) => {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          payment_method: expense.paymentMethod,
        })
        .select()
        .single();

      if (error) throw error;
      return toExpense(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Gasto registrado');
    },
    onError: (error) => {
      console.error('Error adding expense:', error);
      toast.error('Error al agregar gasto');
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Expense, 'id' | 'createdAt'>> }) => {
      const updateData: any = {};
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.paymentMethod !== undefined) updateData.payment_method = updates.paymentMethod;

      const { data, error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return toExpense(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Gasto actualizado');
    },
    onError: (error) => {
      console.error('Error updating expense:', error);
      toast.error('Error al actualizar gasto');
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Gasto eliminado');
    },
    onError: (error) => {
      console.error('Error deleting expense:', error);
      toast.error('Error al eliminar gasto');
    },
  });
}
