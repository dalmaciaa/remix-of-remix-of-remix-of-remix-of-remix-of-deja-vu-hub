import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Event, EventComplement, EventStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';

const toEventComplement = (row: any): EventComplement => ({
  id: row.id,
  eventId: row.event_id,
  name: row.name,
  price: Number(row.price),
  quantity: row.quantity,
  total: Number(row.total),
  createdAt: new Date(row.created_at),
});

const toEvent = (eventRow: any, complementRows: any[]): Event => ({
  id: eventRow.id,
  eventType: eventRow.event_type,
  eventDate: new Date(eventRow.event_date),
  clientName: eventRow.client_name,
  clientPhone: eventRow.client_phone || '',
  basePrice: Number(eventRow.base_price),
  totalAmount: Number(eventRow.total_amount),
  notes: eventRow.notes || '',
  status: eventRow.status as EventStatus,
  complements: complementRows.map(toEventComplement),
  createdAt: new Date(eventRow.created_at),
  updatedAt: new Date(eventRow.updated_at),
});

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

      if (eventsError) throw eventsError;

      const { data: complements, error: complementsError } = await supabase
        .from('event_complements')
        .select('*');

      if (complementsError) throw complementsError;

      return events.map((event) => {
        const eventComplements = complements.filter((c) => c.event_id === event.id);
        return toEvent(event, eventComplements);
      });
    },
  });
}

interface AddEventData {
  eventType: string;
  eventDate: Date;
  clientName: string;
  clientPhone?: string;
  basePrice: number;
  notes?: string;
  complements: { name: string; price: number; quantity: number }[];
}

export function useAddEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: AddEventData) => {
      const complementsTotal = data.complements.reduce(
        (sum, c) => sum + c.price * c.quantity,
        0
      );
      const totalAmount = data.basePrice + complementsTotal;

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          event_type: data.eventType,
          event_date: data.eventDate.toISOString(),
          client_name: data.clientName,
          client_phone: data.clientPhone || null,
          base_price: data.basePrice,
          total_amount: totalAmount,
          notes: data.notes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (eventError) throw eventError;

      if (data.complements.length > 0) {
        const complementsToInsert = data.complements.map((c) => ({
          event_id: event.id,
          name: c.name,
          price: c.price,
          quantity: c.quantity,
          total: c.price * c.quantity,
        }));

        const { error: complementsError } = await supabase
          .from('event_complements')
          .insert(complementsToInsert);

        if (complementsError) throw complementsError;
      }

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Evento creado exitosamente' });
    },
    onError: (error) => {
      toast({
        title: 'Error al crear evento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateEventStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: EventStatus }) => {
      const { error } = await supabase
        .from('events')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Estado actualizado' });
    },
    onError: (error) => {
      toast({
        title: 'Error al actualizar estado',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Evento eliminado' });
    },
    onError: (error) => {
      toast({
        title: 'Error al eliminar evento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
