import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTicketEvents, useTickets, useCancelTicket, useUpdateTicketEvent, type Ticket } from '@/hooks/useTickets';
import { Ticket as TicketIcon, Users, CheckCircle2, XCircle, Clock, Ban, ToggleLeft, ToggleRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TicketAdmin() {
  const { data: events = [] } = useTicketEvents();
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const { data: tickets = [] } = useTickets(selectedEventId || undefined);
  const cancelTicket = useCancelTicket();
  const updateEvent = useUpdateTicketEvent();

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const stats = {
    total: tickets.length,
    valid: tickets.filter(t => t.status === 'valid').length,
    used: tickets.filter(t => t.status === 'used').length,
    expired: tickets.filter(t => t.status === 'expired').length,
    cancelled: tickets.filter(t => t.status === 'cancelled').length,
    revenue: tickets.reduce((sum, t) => sum + t.price, 0),
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'valid': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'used': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'expired': return <XCircle className="w-4 h-4 text-orange-500" />;
      case 'cancelled': return <Ban className="w-4 h-4 text-destructive" />;
      default: return null;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'valid': return 'Válida';
      case 'used': return 'Usada';
      case 'expired': return 'Expirada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'valid': return 'default';
      case 'used': return 'secondary';
      case 'expired': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const toggleEventActive = () => {
    if (!selectedEvent) return;
    updateEvent.mutate({ id: selectedEvent.id, is_active: !selectedEvent.is_active });
  };

  return (
    <Layout>
      <PageHeader title="Administrar Entradas" description="Gestiona eventos y controla el estado de las entradas" />

      <div className="space-y-4">
        {/* Event selector */}
        <div className="max-w-sm">
          <Label>Seleccionar evento</Label>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger><SelectValue placeholder="Elegir evento" /></SelectTrigger>
            <SelectContent>
              {events.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name} — {format(new Date(e.event_date), "dd/MM/yyyy")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedEventId && selectedEvent && (
          <>
            {/* Event info + toggle */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-semibold">{selectedEvent.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedEvent.event_date), "EEEE dd 'de' MMMM, HH:mm", { locale: es })}
                  {selectedEvent.venue && ` — ${selectedEvent.venue}`}
                </p>
              </div>
              <Button variant="outline" onClick={toggleEventActive}>
                {selectedEvent.is_active ? <ToggleRight className="w-4 h-4 mr-2 text-green-500" /> : <ToggleLeft className="w-4 h-4 mr-2" />}
                {selectedEvent.is_active ? 'Activo' : 'Inactivo'}
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <TicketIcon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-500" />
                  <p className="text-2xl font-bold">{stats.valid}</p>
                  <p className="text-xs text-muted-foreground">Válidas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                  <p className="text-2xl font-bold">{stats.used}</p>
                  <p className="text-xs text-muted-foreground">Usadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <XCircle className="w-5 h-5 mx-auto mb-1 text-orange-500" />
                  <p className="text-2xl font-bold">{stats.expired}</p>
                  <p className="text-xs text-muted-foreground">Expiradas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Ban className="w-5 h-5 mx-auto mb-1 text-destructive" />
                  <p className="text-2xl font-bold">{stats.cancelled}</p>
                  <p className="text-xs text-muted-foreground">Canceladas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">💰</p>
                  <p className="text-2xl font-bold">${stats.revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Recaudación</p>
                </CardContent>
              </Card>
            </div>

            {/* Tickets table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Titular</TableHead>
                      <TableHead>DNI</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Usado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map(ticket => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono text-sm">{ticket.ticket_code}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{ticket.holder_name}</p>
                            {ticket.holder_phone && <p className="text-xs text-muted-foreground">{ticket.holder_phone}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{ticket.holder_dni || '—'}</TableCell>
                        <TableCell>${ticket.price.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {statusIcon(ticket.status)}
                            <Badge variant={statusVariant(ticket.status)}>{statusLabel(ticket.status)}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {ticket.used_at ? format(new Date(ticket.used_at), "dd/MM HH:mm") : '—'}
                        </TableCell>
                        <TableCell>
                          {ticket.status === 'valid' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive">
                                  Cancelar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Cancelar entrada?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    La entrada de {ticket.holder_name} ({ticket.ticket_code}) será cancelada y no podrá usarse.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>No</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => cancelTicket.mutate(ticket.id)}>
                                    Sí, cancelar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {tickets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No hay entradas para este evento
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {!selectedEventId && (
          <Card className="p-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Selecciona un evento para ver y administrar sus entradas</p>
          </Card>
        )}
      </div>
    </Layout>
  );
}
