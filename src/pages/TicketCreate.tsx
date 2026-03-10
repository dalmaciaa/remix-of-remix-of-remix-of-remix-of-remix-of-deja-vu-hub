import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTicketEvents, useTickets, useCreateTicketEvent, useCreateTickets, type TicketEvent } from '@/hooks/useTickets';
import { Plus, Ticket, Calendar, QrCode, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TicketCreate() {
  const { data: events = [] } = useTicketEvents();
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const { data: tickets = [] } = useTickets(selectedEventId || undefined);
  const createEvent = useCreateTicketEvent();
  const createTickets = useCreateTickets();

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);

  // Event form
  const [eventForm, setEventForm] = useState({
    name: '', description: '', event_date: '', valid_from: '', valid_until: '',
    venue: '', default_price: 0, max_capacity: 0, is_active: true
  });

  // Ticket form
  const [ticketForm, setTicketForm] = useState({
    holder_name: '', holder_dni: '', holder_email: '', holder_phone: '',
    price: 0, notes: '', quantity: 1
  });

  const handleCreateEvent = async () => {
    if (!eventForm.name || !eventForm.event_date || !eventForm.valid_from || !eventForm.valid_until) return;
    await createEvent.mutateAsync({
      ...eventForm,
      max_capacity: eventForm.max_capacity || null,
      description: eventForm.description || null,
      venue: eventForm.venue || null,
    });
    setEventDialogOpen(false);
    setEventForm({ name: '', description: '', event_date: '', valid_from: '', valid_until: '', venue: '', default_price: 0, max_capacity: 0, is_active: true });
  };

  const handleCreateTickets = async () => {
    if (!selectedEventId || !ticketForm.holder_name) return;
    const ticketsToCreate = [];
    for (let i = 0; i < ticketForm.quantity; i++) {
      ticketsToCreate.push({
        ticket_event_id: selectedEventId,
        holder_name: ticketForm.holder_name,
        holder_dni: ticketForm.holder_dni || undefined,
        holder_email: ticketForm.holder_email || undefined,
        holder_phone: ticketForm.holder_phone || undefined,
        price: ticketForm.price,
        notes: ticketForm.notes || undefined,
      });
    }
    await createTickets.mutateAsync(ticketsToCreate);
    setTicketDialogOpen(false);
    setTicketForm({ holder_name: '', holder_dni: '', holder_email: '', holder_phone: '', price: 0, notes: '', quantity: 1 });
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  // Set default price when selecting event
  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    const event = events.find(e => e.id === eventId);
    if (event) {
      setTicketForm(prev => ({ ...prev, price: event.default_price }));
    }
  };

  const generateQRDataUrl = (code: string) => {
    // Simple QR placeholder - in production use a QR library
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(code)}`;
  };

  return (
    <Layout>
      <PageHeader title="Crear Entradas" description="Genera entradas digitales con QR para tus eventos" />

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="tickets">Entradas</TabsTrigger>
        </TabsList>

        {/* EVENTS TAB */}
        <TabsContent value="events" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Nuevo Evento</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Crear Evento de Entradas</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nombre del evento *</Label>
                    <Input value={eventForm.name} onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Noche de Rock" />
                  </div>
                  <div>
                    <Label>Descripción</Label>
                    <Textarea value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Fecha del evento *</Label>
                      <Input type="datetime-local" value={eventForm.event_date} onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Lugar</Label>
                      <Input value={eventForm.venue} onChange={e => setEventForm(f => ({ ...f, venue: e.target.value }))} placeholder="Deja-Vu Retro Pub" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Válido desde *</Label>
                      <Input type="datetime-local" value={eventForm.valid_from} onChange={e => setEventForm(f => ({ ...f, valid_from: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Válido hasta *</Label>
                      <Input type="datetime-local" value={eventForm.valid_until} onChange={e => setEventForm(f => ({ ...f, valid_until: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Precio base ($)</Label>
                      <Input type="number" value={eventForm.default_price} onChange={e => setEventForm(f => ({ ...f, default_price: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label>Capacidad máxima</Label>
                      <Input type="number" value={eventForm.max_capacity} onChange={e => setEventForm(f => ({ ...f, max_capacity: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <Button onClick={handleCreateEvent} disabled={createEvent.isPending} className="w-full">
                    {createEvent.isPending ? 'Creando...' : 'Crear Evento'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map(event => (
              <Card key={event.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleSelectEvent(event.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{event.name}</CardTitle>
                    <Badge variant={event.is_active ? 'default' : 'secondary'}>
                      {event.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(event.event_date), "dd MMM yyyy HH:mm", { locale: es })}
                  </div>
                  {event.venue && <p>📍 {event.venue}</p>}
                  <p>💰 Precio: ${event.default_price.toLocaleString()}</p>
                  {event.max_capacity && <p>👥 Capacidad: {event.max_capacity}</p>}
                  <p className="text-xs">Válido: {format(new Date(event.valid_from), "dd/MM HH:mm")} - {format(new Date(event.valid_until), "dd/MM HH:mm")}</p>
                </CardContent>
              </Card>
            ))}
            {events.length === 0 && (
              <Card className="col-span-full p-8 text-center text-muted-foreground">
                <Ticket className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay eventos creados. Crea uno para empezar a generar entradas.</p>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* TICKETS TAB */}
        <TabsContent value="tickets" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="min-w-[200px]">
              <Label>Evento</Label>
              <Select value={selectedEventId} onValueChange={handleSelectEvent}>
                <SelectTrigger><SelectValue placeholder="Seleccionar evento" /></SelectTrigger>
                <SelectContent>
                  {events.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEventId && (
              <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" />Generar Entradas</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generar Entradas - {selectedEvent?.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nombre del titular *</Label>
                      <Input value={ticketForm.holder_name} onChange={e => setTicketForm(f => ({ ...f, holder_name: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>DNI</Label>
                        <Input value={ticketForm.holder_dni} onChange={e => setTicketForm(f => ({ ...f, holder_dni: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Teléfono</Label>
                        <Input value={ticketForm.holder_phone} onChange={e => setTicketForm(f => ({ ...f, holder_phone: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" value={ticketForm.holder_email} onChange={e => setTicketForm(f => ({ ...f, holder_email: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Precio ($)</Label>
                        <Input type="number" value={ticketForm.price} onChange={e => setTicketForm(f => ({ ...f, price: Number(e.target.value) }))} />
                      </div>
                      <div>
                        <Label>Cantidad</Label>
                        <Input type="number" min={1} max={100} value={ticketForm.quantity} onChange={e => setTicketForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Notas</Label>
                      <Textarea value={ticketForm.notes} onChange={e => setTicketForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <Button onClick={handleCreateTickets} disabled={createTickets.isPending} className="w-full">
                      {createTickets.isPending ? 'Generando...' : `Generar ${ticketForm.quantity} entrada(s)`}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {selectedEventId ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Titular</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>QR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map(ticket => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono text-sm">{ticket.ticket_code}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{ticket.holder_name}</p>
                            {ticket.holder_dni && <p className="text-xs text-muted-foreground">DNI: {ticket.holder_dni}</p>}
                          </div>
                        </TableCell>
                        <TableCell>${ticket.price.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={
                            ticket.status === 'valid' ? 'default' :
                            ticket.status === 'used' ? 'secondary' :
                            'destructive'
                          }>
                            {ticket.status === 'valid' ? 'Válida' :
                             ticket.status === 'used' ? 'Usada' :
                             ticket.status === 'expired' ? 'Expirada' : 'Cancelada'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <a href={generateQRDataUrl(ticket.ticket_code)} target="_blank" rel="noopener noreferrer">
                            <QrCode className="w-5 h-5 text-primary hover:text-primary/70" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                    {tickets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay entradas generadas para este evento
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              Selecciona un evento para ver y generar entradas
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
