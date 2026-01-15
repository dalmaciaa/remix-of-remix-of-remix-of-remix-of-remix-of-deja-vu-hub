import { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useEvents } from '@/hooks/useEvents';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils-format';
import { cn } from '@/lib/utils';
import { CalendarDays, Clock, User, Phone } from 'lucide-react';
import { EventStatus } from '@/types';

const statusColors: Record<EventStatus, string> = {
  pending: 'bg-warning text-warning-foreground',
  confirmed: 'bg-primary text-primary-foreground',
  completed: 'bg-success text-success-foreground',
  cancelled: 'bg-destructive text-destructive-foreground',
};

const statusLabels: Record<EventStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export function EventsCalendar() {
  const { data: events = [] } = useEvents();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Get dates with events
  const eventDates = useMemo(() => {
    return events.map(e => new Date(e.eventDate));
  }, [events]);

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(e => isSameDay(new Date(e.eventDate), selectedDate));
  }, [events, selectedDate]);

  // Custom day render to show event indicators
  const modifiers = useMemo(() => {
    const hasEvent = eventDates.reduce((acc, date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      acc[dateStr] = true;
      return acc;
    }, {} as Record<string, boolean>);
    
    return {
      hasEvent: (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return hasEvent[dateStr] || false;
      },
    };
  }, [eventDates]);

  return (
    <div className="glass-card p-6 animate-fade-in">
      <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        Calendario de Eventos
      </h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={es}
            modifiers={modifiers}
            modifiersClassNames={{
              hasEvent: 'bg-primary/20 font-bold',
            }}
            className="rounded-lg border shadow-sm"
          />
        </div>

        {/* Selected date events */}
        <div>
          <h4 className="font-medium mb-3">
            {selectedDate ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: es }) : 'Selecciona una fecha'}
          </h4>
          
          {selectedDateEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin eventos para esta fecha</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {selectedDateEvents.map(event => (
                <div 
                  key={event.id} 
                  className="p-4 rounded-lg bg-secondary/50 border border-border/50"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h5 className="font-semibold">{event.eventType}</h5>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      statusColors[event.status]
                    )}>
                      {statusLabels[event.status]}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      {format(new Date(event.eventDate), 'HH:mm')}
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5" />
                      {event.clientName}
                    </div>
                    {event.clientPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" />
                        {event.clientPhone}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-3 pt-2 border-t border-border/50 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(event.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}