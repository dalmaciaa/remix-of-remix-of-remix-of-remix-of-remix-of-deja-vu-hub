import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  useCurrentSession, 
  useCashExpenses, 
  useOpenSession, 
  useCloseSession,
  useAddCashExpense,
  useUpdateTicketsSold 
} from '@/hooks/useCashRegister';
import { useSales } from '@/hooks/useSales';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime } from '@/lib/utils-format';
import { 
  DollarSign, 
  Plus, 
  Minus, 
  Lock, 
  Unlock,
  Ticket,
  CreditCard,
  Smartphone,
  Banknote,
  TrendingUp,
  TrendingDown,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CashRegister() {
  const { currentStaff } = useAuth();
  const { data: currentSession, isLoading: sessionLoading } = useCurrentSession();
  const { data: cashExpenses = [] } = useCashExpenses(currentSession?.id || null);
  const { data: allSales = [] } = useSales();
  
  const openSessionMutation = useOpenSession();
  const closeSessionMutation = useCloseSession();
  const addExpenseMutation = useAddCashExpense();
  const updateTicketsMutation = useUpdateTicketsSold();

  // Dialogs
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);

  // Open session form
  const [initialCash, setInitialCash] = useState('');
  const [isEvent, setIsEvent] = useState(false);
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketQuantity, setTicketQuantity] = useState('');

  // Expense form
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');

  // Ticket sale
  const [ticketsToSell, setTicketsToSell] = useState('1');

  // Close session form
  const [finalCash, setFinalCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  // Sales during session
  const sessionSales = useMemo(() => {
    if (!currentSession) return [];
    const sessionStart = new Date(currentSession.opened_at);
    return allSales.filter(sale => {
      const saleDate = new Date(sale.createdAt);
      return saleDate >= sessionStart && sale.paymentStatus === 'cobrado';
    });
  }, [allSales, currentSession]);

  // Calculate totals by payment method
  const salesByMethod = useMemo(() => {
    const totals = { cash: 0, transfer: 0, qr: 0 };
    sessionSales.forEach(sale => {
      if (sale.paymentMethod in totals) {
        totals[sale.paymentMethod as keyof typeof totals] += sale.totalAmount;
      }
    });
    return totals;
  }, [sessionSales]);

  // Total cash expenses
  const totalExpenses = useMemo(() => {
    return cashExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  }, [cashExpenses]);

  // Ticket income
  const ticketIncome = useMemo(() => {
    if (!currentSession?.is_event) return 0;
    return currentSession.tickets_sold * currentSession.ticket_price;
  }, [currentSession]);

  // Expected cash = initial + sales cash + ticket income - expenses
  const expectedCash = useMemo(() => {
    if (!currentSession) return 0;
    return Number(currentSession.initial_cash) + salesByMethod.cash + ticketIncome - totalExpenses;
  }, [currentSession, salesByMethod.cash, ticketIncome, totalExpenses]);

  const handleOpenSession = () => {
    openSessionMutation.mutate({
      initialCash: Number(initialCash) || 0,
      isEvent,
      ticketPrice: isEvent ? Number(ticketPrice) || 0 : 0,
      ticketQuantity: isEvent ? Number(ticketQuantity) || 0 : 0,
      openedBy: currentStaff?.id,
    }, {
      onSuccess: () => {
        setIsOpenDialogOpen(false);
        setInitialCash('');
        setIsEvent(false);
        setTicketPrice('');
        setTicketQuantity('');
      }
    });
  };

  const handleCloseSession = () => {
    if (!currentSession) return;
    
    closeSessionMutation.mutate({
      sessionId: currentSession.id,
      finalCash: Number(finalCash) || 0,
      expectedCash,
      expectedTransfer: salesByMethod.transfer,
      expectedQr: salesByMethod.qr,
      closedBy: currentStaff?.id,
      notes: closeNotes,
    }, {
      onSuccess: () => {
        setIsCloseDialogOpen(false);
        setFinalCash('');
        setCloseNotes('');
      }
    });
  };

  const handleAddExpense = () => {
    if (!currentSession || !expenseAmount || !expenseDescription) return;
    
    addExpenseMutation.mutate({
      sessionId: currentSession.id,
      amount: Number(expenseAmount),
      description: expenseDescription,
      createdBy: currentStaff?.id,
    }, {
      onSuccess: () => {
        setIsExpenseDialogOpen(false);
        setExpenseAmount('');
        setExpenseDescription('');
      }
    });
  };

  const handleSellTickets = () => {
    if (!currentSession) return;
    const newTotal = currentSession.tickets_sold + Number(ticketsToSell);
    if (newTotal > currentSession.ticket_quantity) {
      return;
    }
    
    updateTicketsMutation.mutate({
      sessionId: currentSession.id,
      ticketsSold: newTotal,
    }, {
      onSuccess: () => {
        setIsTicketDialogOpen(false);
        setTicketsToSell('1');
      }
    });
  };

  if (sessionLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  // No session open
  if (!currentSession) {
    return (
      <Layout>
        <PageHeader 
          title="Caja" 
          description="Control de caja y movimientos"
        />

        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="pt-6 text-center">
            <Lock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Caja Cerrada</h3>
            <p className="text-muted-foreground mb-6">
              Abre la caja para comenzar a registrar movimientos
            </p>
            <Button size="lg" onClick={() => setIsOpenDialogOpen(true)}>
              <Unlock className="w-5 h-5 mr-2" />
              Abrir Caja
            </Button>
          </CardContent>
        </Card>

        {/* Open Session Dialog */}
        <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abrir Caja</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Efectivo Inicial</Label>
                <Input
                  type="number"
                  value={initialCash}
                  onChange={(e) => setInitialCash(e.target.value)}
                  placeholder="0"
                />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div>
                  <p className="font-medium">¿Es un evento con entrada?</p>
                  <p className="text-sm text-muted-foreground">
                    Habilita venta de entradas
                  </p>
                </div>
                <Switch checked={isEvent} onCheckedChange={setIsEvent} />
              </div>

              {isEvent && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-primary/10 rounded-lg">
                  <div>
                    <Label>Precio Entrada</Label>
                    <Input
                      type="number"
                      value={ticketPrice}
                      onChange={(e) => setTicketPrice(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Cantidad Total</Label>
                    <Input
                      type="number"
                      value={ticketQuantity}
                      onChange={(e) => setTicketQuantity(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpenDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleOpenSession} disabled={openSessionMutation.isPending}>
                Abrir Caja
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Layout>
    );
  }

  // Session open - show dashboard
  const cashDifference = Number(finalCash) - expectedCash;

  return (
    <Layout>
      <PageHeader 
        title="Caja" 
        description={`Sesión abierta desde ${formatDateTime(new Date(currentSession.opened_at))}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsExpenseDialogOpen(true)}>
            <Minus className="w-4 h-4 mr-2" />
            Gasto
          </Button>
          <Button variant="destructive" onClick={() => setIsCloseDialogOpen(true)}>
            <Lock className="w-4 h-4 mr-2" />
            Cerrar Caja
          </Button>
        </div>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Efectivo Inicial</p>
                <p className="text-2xl font-bold">{formatCurrency(currentSession.initial_cash)}</p>
              </div>
              <Banknote className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ventas Efectivo</p>
                <p className="text-2xl font-bold text-green-500">+{formatCurrency(salesByMethod.cash)}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gastos</p>
                <p className="text-2xl font-bold text-red-500">-{formatCurrency(totalExpenses)}</p>
              </div>
              <TrendingDown className="w-10 h-10 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/10 border-primary/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Efectivo Esperado</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(expectedCash)}</p>
              </div>
              <DollarSign className="w-10 h-10 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Tickets */}
      {currentSession.is_event && (
        <Card className="mb-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              Entradas del Evento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Precio</p>
                <p className="text-xl font-bold">{formatCurrency(currentSession.ticket_price)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vendidas / Total</p>
                <p className="text-xl font-bold">
                  {currentSession.tickets_sold} / {currentSession.ticket_quantity}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disponibles</p>
                <p className="text-xl font-bold">
                  {currentSession.ticket_quantity - currentSession.tickets_sold}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ingresos</p>
                <p className="text-xl font-bold text-green-500">
                  {formatCurrency(ticketIncome)}
                </p>
              </div>
            </div>
            <Button className="mt-4" onClick={() => setIsTicketDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Vender Entradas
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Other Payment Methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4" />
              Transferencias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(salesByMethod.transfer)}</p>
            <p className="text-sm text-muted-foreground">
              {sessionSales.filter(s => s.paymentMethod === 'transfer').length} ventas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="w-4 h-4" />
              Pagos QR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(salesByMethod.qr)}</p>
            <p className="text-sm text-muted-foreground">
              {sessionSales.filter(s => s.paymentMethod === 'qr').length} ventas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses List */}
      {cashExpenses.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Gastos de la Jornada</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashExpenses.map(expense => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(expense.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-right text-red-500 font-medium">
                      -{formatCurrency(expense.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Expense Dialog */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Gasto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Monto</Label>
              <Input
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                placeholder="Ej: Compra de hielo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddExpense} disabled={addExpenseMutation.isPending || !expenseAmount || !expenseDescription}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sell Tickets Dialog */}
      <Dialog open={isTicketDialogOpen} onOpenChange={setIsTicketDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vender Entradas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-secondary/30 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Precio por entrada</p>
              <p className="text-2xl font-bold">{formatCurrency(currentSession.ticket_price)}</p>
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="1"
                max={currentSession.ticket_quantity - currentSession.tickets_sold}
                value={ticketsToSell}
                onChange={(e) => setTicketsToSell(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Disponibles: {currentSession.ticket_quantity - currentSession.tickets_sold}
              </p>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Total a cobrar</p>
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(Number(ticketsToSell) * currentSession.ticket_price)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTicketDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSellTickets} disabled={updateTicketsMutation.isPending}>
              Confirmar Venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Session Dialog */}
      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cerrar Caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-secondary/30 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Efectivo Esperado:</span>
                <span className="font-bold">{formatCurrency(expectedCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transferencias:</span>
                <span className="font-bold">{formatCurrency(salesByMethod.transfer)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">QR:</span>
                <span className="font-bold">{formatCurrency(salesByMethod.qr)}</span>
              </div>
            </div>

            <div>
              <Label>Efectivo Final en Caja</Label>
              <Input
                type="number"
                value={finalCash}
                onChange={(e) => setFinalCash(e.target.value)}
                placeholder="0"
              />
            </div>

            {finalCash && (
              <div className={cn(
                "p-4 rounded-lg flex items-center gap-3",
                cashDifference === 0 
                  ? "bg-green-500/10 text-green-500" 
                  : cashDifference > 0 
                    ? "bg-blue-500/10 text-blue-500"
                    : "bg-red-500/10 text-red-500"
              )}>
                <AlertCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium">
                    {cashDifference === 0 
                      ? 'Cuadra perfectamente' 
                      : cashDifference > 0 
                        ? `Sobrante de ${formatCurrency(cashDifference)}`
                        : `Faltante de ${formatCurrency(Math.abs(cashDifference))}`
                    }
                  </p>
                </div>
              </div>
            )}

            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Observaciones del cierre..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleCloseSession} disabled={closeSessionMutation.isPending || !finalCash}>
              Cerrar Caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
