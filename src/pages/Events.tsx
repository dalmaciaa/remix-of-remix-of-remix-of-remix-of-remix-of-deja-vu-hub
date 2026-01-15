import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEvents, useAddEvent, useUpdateEventStatus, useDeleteEvent } from '@/hooks/useEvents';
import { formatCurrency, formatDateTime } from '@/lib/utils-format';
import { Plus, Trash2, Calendar, User, Phone, Loader2, X, List, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EventStatus } from '@/types';
import { EventsCalendar } from '@/components/events/EventsCalendar';

const statusLabels: Record<EventStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const statusColors: Record<EventStatus, string> = {
  pending: 'bg-warning/20 text-warning',
  confirmed: 'bg-primary/20 text-primary',
  completed: 'bg-success/20 text-success',
  cancelled: 'bg-destructive/20 text-destructive',
};

interface ComplementInput {
  name: string;
  price: string;
  quantity: string;
}

export default function Events() {
  const { data: events = [], isLoading } = useEvents();
  const addEvent = useAddEvent();
  const updateStatus = useUpdateEventStatus();
  const deleteEvent = useDeleteEvent();

  const [activeTab, setActiveTab] = useState('calendar');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [notes, setNotes] = useState('');
  const [complements, setComplements] = useState<ComplementInput[]>([]);

  const resetForm = () => {
    setEventType('');
    setEventDate('');
    setClientName('');
    setClientPhone('');
    setBasePrice('');
    setNotes('');
    setComplements([]);
  };

  const addComplement = () => {
    setComplements([...complements, { name: '', price: '', quantity: '1' }]);
  };

  const updateComplement = (index: number, field: keyof ComplementInput, value: string) => {
    const updated = [...complements];
    updated[index][field] = value;
    setComplements(updated);
  };

  const removeComplement = (index: number) => {
    setComplements(complements.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    addEvent.mutate(
      {
        eventType,
        eventDate: new Date(eventDate),
        clientName,
        clientPhone,
        basePrice: parseFloat(basePrice) || 0,
        notes,
        complements: complements
          .filter((c) => c.name && c.price)
          .map((c) => ({
            name: c.name,
            price: parseFloat(c.price) || 0,
            quantity: parseInt(c.quantity) || 1,
          })),
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          resetForm();
        },
      }
    );
  };

  const complementsTotal = complements.reduce(
    (sum, c) => sum + (parseFloat(c.price) || 0) * (parseInt(c.quantity) || 1),
    0
  );
  const total = (parseFloat(basePrice) || 0) + complementsTotal;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader title="Eventos" description="Gestiona los eventos y alquileres">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Evento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="eventType">Tipo de Evento</Label>
                  <Input
                    id="eventType"
                    placeholder="Ej: Cumpleaños, Boda, Corporativo..."
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventDate">Fecha y Hora</Label>
                  <Input
                    id="eventDate"
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">Nombre del Cliente</Label>
                  <Input
                    id="clientName"
                    placeholder="Nombre completo"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Teléfono (opcional)</Label>
                  <Input
                    id="clientPhone"
                    placeholder="Número de contacto"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="basePrice">Precio Base del Alquiler</Label>
                  <Input
                    id="basePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Detalles adicionales del evento..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Complements Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Complementos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addComplement}>
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>

                {complements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sin complementos. Agrega decoración, mesa dulce, etc.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {complements.map((complement, index) => (
                      <div key={index} className="flex items-end gap-2 p-3 rounded-lg bg-secondary/50">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Nombre</Label>
                          <Input
                            placeholder="Ej: Decoración, Mesa dulce..."
                            value={complement.name}
                            onChange={(e) => updateComplement(index, 'name', e.target.value)}
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Precio</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            value={complement.price}
                            onChange={(e) => updateComplement(index, 'price', e.target.value)}
                          />
                        </div>
                        <div className="w-16 space-y-1">
                          <Label className="text-xs">Cant.</Label>
                          <Input
                            type="number"
                            min="1"
                            value={complement.quantity}
                            onChange={(e) => updateComplement(index, 'quantity', e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeComplement(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex justify-between text-sm">
                  <span>Precio base:</span>
                  <span>{formatCurrency(parseFloat(basePrice) || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Complementos:</span>
                  <span>{formatCurrency(complementsTotal)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg mt-2 pt-2 border-t border-primary/20">
                  <span>Total:</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={addEvent.isPending}>
                  {addEvent.isPending ? 'Guardando...' : 'Crear Evento'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Tabs for Calendar/List view */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="w-4 h-4" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <List className="w-4 h-4" />
            Lista
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <EventsCalendar />
        </TabsContent>

        <TabsContent value="list">
          {/* Events List */}
          {events.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay eventos registrados</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {events.map((event) => (
                <div key={event.id} className="glass-card p-6 animate-fade-in">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-display text-lg font-semibold">{event.eventType}</h3>
                        <span className={cn('status-badge', statusColors[event.status])}>
                          {statusLabels[event.status]}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {formatDateTime(event.eventDate)}
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {event.clientName}
                        </div>
                        {event.clientPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {event.clientPhone}
                          </div>
                        )}
                      </div>

                      {event.complements.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-1">Complementos:</p>
                          <div className="flex flex-wrap gap-2">
                            {event.complements.map((c) => (
                              <span key={c.id} className="text-xs px-2 py-1 rounded bg-secondary">
                                {c.name} ({c.quantity}x) - {formatCurrency(c.total)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {event.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">"{event.notes}"</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <p className="text-2xl font-semibold text-primary">
                        {formatCurrency(event.totalAmount)}
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <Select
                          value={event.status}
                          onValueChange={(value) =>
                            updateStatus.mutate({ id: event.id, status: value as EventStatus })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendiente</SelectItem>
                            <SelectItem value="confirmed">Confirmado</SelectItem>
                            <SelectItem value="completed">Completado</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteEvent.mutate(event.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Layout>
  );
}