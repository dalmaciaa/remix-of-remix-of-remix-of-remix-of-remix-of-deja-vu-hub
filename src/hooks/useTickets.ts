import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TicketEvent {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  valid_from: string;
  valid_until: string;
  venue: string | null;
  default_price: number;
  max_capacity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  ticket_event_id: string;
  ticket_code: string;
  holder_name: string;
  holder_dni: string | null;
  holder_email: string | null;
  holder_phone: string | null;
  price: number;
  status: 'valid' | 'used' | 'expired' | 'cancelled';
  used_at: string | null;
  used_by: string | null;
  notes: string | null;
  created_at: string;
  ticket_events?: TicketEvent;
}

function generateTicketCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function useTicketEvents() {
  return useQuery({
    queryKey: ['ticket-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_events')
        .select('*')
        .order('event_date', { ascending: false });
      if (error) throw error;
      return data as TicketEvent[];
    }
  });
}

export function useTickets(eventId?: string) {
  return useQuery({
    queryKey: ['tickets', eventId],
    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select('*, ticket_events(*)')
        .order('created_at', { ascending: false });
      if (eventId) {
        query = query.eq('ticket_event_id', eventId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Ticket[];
    }
  });
}

export function useCreateTicketEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (event: Omit<TicketEvent, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('ticket_events')
        .insert(event)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-events'] });
      toast({ title: 'Evento creado correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al crear evento', description: error.message, variant: 'destructive' });
    }
  });
}

export function useCreateTickets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tickets: Array<{
      ticket_event_id: string;
      holder_name: string;
      holder_dni?: string;
      holder_email?: string;
      holder_phone?: string;
      price: number;
      notes?: string;
    }>) => {
      const rows = tickets.map(t => ({
        ...t,
        ticket_code: generateTicketCode(),
        status: 'valid' as const,
      }));
      const { data, error } = await supabase
        .from('tickets')
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: `${data.length} entrada(s) creada(s)` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al crear entradas', description: error.message, variant: 'destructive' });
    }
  });
}

export function useVerifyTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketCode, staffId }: { ticketCode: string; staffId: string }) => {
      // Fetch ticket
      const { data: ticket, error: fetchError } = await supabase
        .from('tickets')
        .select('*, ticket_events(*)')
        .eq('ticket_code', ticketCode)
        .single();

      if (fetchError || !ticket) {
        return { valid: false, reason: 'Entrada no encontrada', ticket: null };
      }

      if (ticket.status === 'used') {
        return { valid: false, reason: `Entrada ya usada el ${new Date(ticket.used_at!).toLocaleString('es-AR')}`, ticket };
      }

      if (ticket.status === 'cancelled') {
        return { valid: false, reason: 'Entrada cancelada', ticket };
      }

      if (ticket.status === 'expired') {
        return { valid: false, reason: 'Entrada expirada', ticket };
      }

      // Check time validity
      const event = ticket.ticket_events as TicketEvent;
      const now = new Date();
      const validFrom = new Date(event.valid_from);
      const validUntil = new Date(event.valid_until);

      if (now < validFrom) {
        return { valid: false, reason: `La entrada es válida desde ${validFrom.toLocaleString('es-AR')}`, ticket };
      }

      if (now > validUntil) {
        // Mark as expired
        await supabase.from('tickets').update({ status: 'expired' }).eq('id', ticket.id);
        return { valid: false, reason: 'Entrada expirada (fuera del horario de validez)', ticket };
      }

      // Mark as used
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: 'used', used_at: new Date().toISOString(), used_by: staffId })
        .eq('id', ticket.id)
        .eq('status', 'valid'); // Optimistic lock

      if (updateError) {
        return { valid: false, reason: 'Error al validar entrada', ticket };
      }

      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      return { valid: true, reason: 'Entrada válida ✓', ticket };
    }
  });
}

export function useUpdateTicketEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TicketEvent> & { id: string }) => {
      const { error } = await supabase
        .from('ticket_events')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-events'] });
      toast({ title: 'Evento actualizado' });
    }
  });
}

export function useCancelTicket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await supabase
        .from('tickets')
        .update({ status: 'cancelled' })
        .eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: 'Entrada cancelada' });
    }
  });
}
