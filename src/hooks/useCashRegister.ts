import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CashRegisterSession {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: string | null;
  closed_by: string | null;
  initial_cash: number;
  is_event: boolean;
  ticket_price: number;
  ticket_quantity: number;
  tickets_sold: number;
  final_cash: number | null;
  expected_cash: number | null;
  expected_transfer: number | null;
  expected_qr: number | null;
  notes: string | null;
  status: 'open' | 'closed';
}

export interface CashExpense {
  id: string;
  session_id: string | null;
  amount: number;
  description: string;
  created_at: string;
  created_by: string | null;
}

// Get current open session
export function useCurrentSession() {
  return useQuery({
    queryKey: ['cash-session-current'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_register_sessions')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as CashRegisterSession | null;
    },
    refetchInterval: 5000,
  });
}

// Get all sessions
export function useCashSessions() {
  return useQuery({
    queryKey: ['cash-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_register_sessions')
        .select('*')
        .order('opened_at', { ascending: false });

      if (error) throw error;
      return data as CashRegisterSession[];
    },
  });
}

// Get expenses for a session
export function useCashExpenses(sessionId: string | null) {
  return useQuery({
    queryKey: ['cash-expenses', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      
      const { data, error } = await supabase
        .from('cash_expenses')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CashExpense[];
    },
    enabled: !!sessionId,
    refetchInterval: 5000,
  });
}

// Open a new session
export function useOpenSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      initialCash,
      isEvent,
      ticketPrice,
      ticketQuantity,
      openedBy,
    }: {
      initialCash: number;
      isEvent: boolean;
      ticketPrice?: number;
      ticketQuantity?: number;
      openedBy?: string;
    }) => {
      const { data, error } = await supabase
        .from('cash_register_sessions')
        .insert({
          initial_cash: initialCash,
          is_event: isEvent,
          ticket_price: ticketPrice || 0,
          ticket_quantity: ticketQuantity || 0,
          tickets_sold: 0,
          opened_by: openedBy || null,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-session-current'] });
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
      toast.success('Caja abierta exitosamente');
    },
    onError: (error) => {
      console.error('Error opening session:', error);
      toast.error('Error al abrir caja');
    },
  });
}

// Update tickets sold
export function useUpdateTicketsSold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      ticketsSold,
    }: {
      sessionId: string;
      ticketsSold: number;
    }) => {
      const { error } = await supabase
        .from('cash_register_sessions')
        .update({ tickets_sold: ticketsSold })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-session-current'] });
    },
  });
}

// Add cash expense
export function useAddCashExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      amount,
      description,
      createdBy,
    }: {
      sessionId: string;
      amount: number;
      description: string;
      createdBy?: string;
    }) => {
      const { data, error } = await supabase
        .from('cash_expenses')
        .insert({
          session_id: sessionId,
          amount,
          description,
          created_by: createdBy || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-expenses'] });
      toast.success('Gasto registrado');
    },
    onError: (error) => {
      console.error('Error adding expense:', error);
      toast.error('Error al registrar gasto');
    },
  });
}

// Close session
export function useCloseSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      finalCash,
      expectedCash,
      expectedTransfer,
      expectedQr,
      closedBy,
      notes,
    }: {
      sessionId: string;
      finalCash: number;
      expectedCash: number;
      expectedTransfer: number;
      expectedQr: number;
      closedBy?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('cash_register_sessions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          final_cash: finalCash,
          expected_cash: expectedCash,
          expected_transfer: expectedTransfer,
          expected_qr: expectedQr,
          closed_by: closedBy || null,
          notes: notes || null,
        })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-session-current'] });
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
      toast.success('Caja cerrada exitosamente');
    },
    onError: (error) => {
      console.error('Error closing session:', error);
      toast.error('Error al cerrar caja');
    },
  });
}
