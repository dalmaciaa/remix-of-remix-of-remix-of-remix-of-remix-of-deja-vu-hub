import { useState, useMemo, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useSales, SaleWithStatus, useUpdatePaymentStatus } from '@/hooks/useSales';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime, paymentMethodLabels, isToday, isThisMonth } from '@/lib/utils-format';
import { DollarSign, User, CheckCircle, Clock, Users, Receipt, Split } from 'lucide-react';
import { PaymentMethod } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface StaffMember {
  id: string;
  full_name: string;
  username: string;
}

type ViewFilter = 'today' | 'month' | 'all';

export default function CashierCollect() {
  const { toast } = useToast();
  const { data: allSales = [] } = useSales();
  const updatePaymentMutation = useUpdatePaymentStatus();
  
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedStaffForPayment, setSelectedStaffForPayment] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash');
  const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('today');
  
  // Split payment state
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [cashAmount, setCashAmount] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [qrAmount, setQrAmount] = useState<string>('');

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, full_name, username')
        .eq('is_active', true)
        .order('full_name');
      
      if (data) setStaffList(data);
    };
    fetchStaff();
  }, []);

  // Ventas no cobradas
  const unpaidSales = useMemo(() => {
    let sales = allSales.filter(s => s.paymentStatus === 'no_cobrado');
    if (selectedStaff !== 'all') {
      sales = sales.filter(s => s.staffId === selectedStaff);
    }
    return sales;
  }, [allSales, selectedStaff]);

  // Ventas cobradas filtradas por tiempo
  const paidSales = useMemo(() => {
    let sales = allSales.filter(s => s.paymentStatus === 'cobrado');
    
    if (viewFilter === 'today') {
      sales = sales.filter(s => isToday(new Date(s.createdAt)));
    } else if (viewFilter === 'month') {
      sales = sales.filter(s => isThisMonth(new Date(s.createdAt)));
    }
    
    if (selectedStaff !== 'all') {
      sales = sales.filter(s => s.staffId === selectedStaff);
    }
    return sales;
  }, [allSales, selectedStaff, viewFilter]);

  // Agrupar por mozo y luego por mesa
  const groupedByStaffAndTable = useMemo(() => {
    const grouped: Record<string, Record<string, SaleWithStatus[]>> = {};
    
    unpaidSales.forEach(sale => {
      const staffId = sale.staffId || 'sin_mozo';
      const table = sale.tableNumber || 'sin_mesa';
      
      if (!grouped[staffId]) {
        grouped[staffId] = {};
      }
      if (!grouped[staffId][table]) {
        grouped[staffId][table] = [];
      }
      grouped[staffId][table].push(sale);
    });
    
    return grouped;
  }, [unpaidSales]);

  // Get staff info by ID
  const getStaffInfo = (staffId: string) => {
    if (staffId === 'sin_mozo') return { name: 'Sin Mozo', username: '-' };
    const staff = staffList.find(s => s.id === staffId);
    if (staff) return { name: staff.full_name, username: staff.username };
    const sale = unpaidSales.find(s => s.staffId === staffId);
    return { name: sale?.staffName || 'Desconocido', username: '-' };
  };

  // Calculate total for a table
  const getTableTotal = (sales: SaleWithStatus[]) => {
    return sales.reduce((sum, s) => sum + s.totalAmount, 0);
  };

  // Open payment dialog
  const openPaymentDialog = (staffId: string, table: string) => {
    setSelectedStaffForPayment(staffId);
    setSelectedTable(table);
    setSelectedPaymentMethod('cash');
    setIsSplitPayment(false);
    setCashAmount('');
    setTransferAmount('');
    setQrAmount('');
    setIsPaymentDialogOpen(true);
  };

  // Calculate split payment total
  const getSplitTotal = () => {
    return (parseFloat(cashAmount) || 0) + 
           (parseFloat(transferAmount) || 0) + 
           (parseFloat(qrAmount) || 0);
  };

  // Get current table total
  const getCurrentTableTotal = () => {
    if (!selectedTable || !selectedStaffForPayment) return 0;
    return getTableTotal(groupedByStaffAndTable[selectedStaffForPayment]?.[selectedTable] || []);
  };

  // Handle payment
  const handlePayTable = async () => {
    if (!selectedTable || !selectedStaffForPayment) return;
    
    const tableSales = groupedByStaffAndTable[selectedStaffForPayment]?.[selectedTable] || [];
    const tableTotal = getTableTotal(tableSales);
    
    // Validate split payment
    if (isSplitPayment) {
      const splitTotal = getSplitTotal();
      if (Math.abs(splitTotal - tableTotal) > 0.01) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `El total dividido (${formatCurrency(splitTotal)}) no coincide con el total a cobrar (${formatCurrency(tableTotal)})`
        });
        return;
      }
    }
    
    try {
      // For split payments, we need to distribute amounts proportionally across sales
      // or apply split to the combined payment (simpler approach - apply to last sale)
      for (let i = 0; i < tableSales.length; i++) {
        const sale = tableSales[i];
        const isLastSale = i === tableSales.length - 1;
        
        if (isSplitPayment && isLastSale) {
          // Apply split payment info to the last sale (for simplicity)
          await updatePaymentMutation.mutateAsync({
            saleId: sale.id,
            paymentStatus: 'cobrado',
            splitAmounts: {
              cashAmount: parseFloat(cashAmount) || 0,
              transferAmount: parseFloat(transferAmount) || 0,
              qrAmount: parseFloat(qrAmount) || 0,
            }
          });
        } else if (isSplitPayment) {
          // Mark other sales as paid without split info
          await updatePaymentMutation.mutateAsync({
            saleId: sale.id,
            paymentStatus: 'cobrado',
            paymentMethod: 'cash', // Default for grouped sales
          });
        } else {
          await updatePaymentMutation.mutateAsync({
            saleId: sale.id,
            paymentStatus: 'cobrado',
            paymentMethod: selectedPaymentMethod,
          });
        }
      }
      
      const paymentDesc = isSplitPayment 
        ? `Efectivo: ${formatCurrency(parseFloat(cashAmount) || 0)}, Transfer: ${formatCurrency(parseFloat(transferAmount) || 0)}, QR: ${formatCurrency(parseFloat(qrAmount) || 0)}`
        : paymentMethodLabels[selectedPaymentMethod];
      
      toast({
        title: 'Mesa cobrada',
        description: `Se cobraron ${tableSales.length} pedidos por ${formatCurrency(tableTotal)} (${paymentDesc})`
      });
      
      setIsPaymentDialogOpen(false);
      setSelectedTable(null);
      setSelectedStaffForPayment(null);
    } catch (error) {
      console.error('Error paying table:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo procesar el cobro'
      });
    }
  };

  // Stats
  const stats = useMemo(() => {
    const totalPending = unpaidSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPaid = paidSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const tablesCount = new Set(unpaidSales.map(s => s.tableNumber || 'sin_mesa')).size;
    const staffCount = new Set(unpaidSales.map(s => s.staffId || 'sin_mozo')).size;
    
    return { totalPending, totalPaid, tablesCount, staffCount, salesCount: unpaidSales.length, paidCount: paidSales.length };
  }, [unpaidSales, paidSales]);

  return (
    <Layout>
      <PageHeader 
        title="Cobrar Pedidos" 
        description="Gestiona los cobros de pedidos pendientes y visualiza las ventas cobradas"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pendiente</p>
                <p className="text-2xl font-bold text-amber-500">{formatCurrency(stats.totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Cobrado ({viewFilter === 'today' ? 'Hoy' : viewFilter === 'month' ? 'Mes' : 'Total'})</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(stats.totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Mozos con pendientes</p>
                <p className="text-2xl font-bold">{stats.staffCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Pedidos pendientes</p>
                <p className="text-2xl font-bold">{stats.salesCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter by staff */}
      <div className="flex gap-4 mb-6">
        <Select value={selectedStaff} onValueChange={setSelectedStaff}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filtrar por mozo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los mozos</SelectItem>
            {staffList.map(staff => (
              <SelectItem key={staff.id} value={staff.id}>
                {staff.full_name} (@{staff.username})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'paid')}>
        <TabsList className="mb-6">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-4 h-4" />
            Pendientes ({stats.salesCount})
          </TabsTrigger>
          <TabsTrigger value="paid" className="gap-2">
            <CheckCircle className="w-4 h-4" />
            Cobradas ({stats.paidCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {/* Orders grouped by staff and table */}
          {Object.keys(groupedByStaffAndTable).length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Todo cobrado</h3>
                <p className="text-muted-foreground">No hay pedidos pendientes de cobro</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByStaffAndTable).map(([staffId, tables]) => {
                const staffInfo = getStaffInfo(staffId);
                return (
                  <Card key={staffId}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-primary" />
                        <div>
                          <CardTitle>{staffInfo.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">Usuario: @{staffInfo.username}</p>
                        </div>
                        <Badge variant="secondary">
                          {Object.values(tables).flat().length} pedidos
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(tables).map(([table, sales]) => (
                          <Card key={table} className="border-amber-500/50 border">
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold text-lg">
                                  {table === 'sin_mesa' ? 'Sin Mesa' : `Mesa ${table}`}
                                </h4>
                                <Badge className="bg-amber-500">
                                  {sales.length}
                                </Badge>
                              </div>
                              
                              <div className="space-y-2 max-h-32 overflow-y-auto mb-4">
                                {sales.map(sale => (
                                  <div key={sale.id} className="text-sm p-2 bg-secondary/30 rounded">
                                    <div className="flex justify-between">
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(sale.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <span className="font-medium">{formatCurrency(sale.totalAmount)}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              
                              <div className="flex justify-between items-center pt-3 border-t">
                                <span className="font-bold text-lg text-primary">
                                  {formatCurrency(getTableTotal(sales))}
                                </span>
                                <Button size="sm" onClick={() => openPaymentDialog(staffId, table)}>
                                  <DollarSign className="w-4 h-4 mr-1" />
                                  Cobrar
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="paid">
          {/* Filter by time */}
          <div className="flex gap-2 mb-4">
            <Button 
              variant={viewFilter === 'today' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setViewFilter('today')}
            >
              Hoy
            </Button>
            <Button 
              variant={viewFilter === 'month' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setViewFilter('month')}
            >
              Este Mes
            </Button>
            <Button 
              variant={viewFilter === 'all' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setViewFilter('all')}
            >
              Todo
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Mozo</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Mesa</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        No hay ventas cobradas en este período
                      </TableCell>
                    </TableRow>
                  ) : (
                    paidSales.map((sale) => {
                      const staff = staffList.find(s => s.id === sale.staffId);
                      return (
                        <TableRow key={sale.id}>
                          <TableCell>{formatDateTime(new Date(sale.createdAt))}</TableCell>
                          <TableCell className="font-medium">{sale.staffName || 'Sin mozo'}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {staff?.username ? `@${staff.username}` : '-'}
                          </TableCell>
                          <TableCell>
                            {sale.tableNumber ? `Mesa ${sale.tableNumber}` : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm max-w-[200px]">
                              {sale.items.map((item, idx) => (
                                <span key={idx} className="text-muted-foreground">
                                  {item.productName} x{item.quantity}
                                  {idx < sale.items.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                              {paymentMethodLabels[sale.paymentMethod]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {formatCurrency(sale.totalAmount)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Cobrar {selectedTable === 'sin_mesa' ? 'Pedidos sin Mesa' : `Mesa ${selectedTable}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 bg-secondary/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Mozo</p>
              <p className="font-semibold">{selectedStaffForPayment && getStaffInfo(selectedStaffForPayment).name}</p>
              <p className="text-xs text-muted-foreground">@{selectedStaffForPayment && getStaffInfo(selectedStaffForPayment).username}</p>
            </div>
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Total a cobrar</p>
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(getCurrentTableTotal())}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedTable && selectedStaffForPayment && 
                  `${groupedByStaffAndTable[selectedStaffForPayment]?.[selectedTable]?.length || 0} pedidos`}
              </p>
            </div>
            
            {/* Split Payment Toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Split className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="split-payment">Dividir pago</Label>
              </div>
              <Switch 
                id="split-payment" 
                checked={isSplitPayment} 
                onCheckedChange={setIsSplitPayment}
              />
            </div>
            
            {!isSplitPayment ? (
              <div>
                <Label>Método de Pago</Label>
                <Select value={selectedPaymentMethod} onValueChange={(v) => setSelectedPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="qr">QR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Ingresa el monto para cada método:</p>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Efectivo</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Transfer</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">QR</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={qrAmount}
                      onChange={(e) => setQrAmount(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                
                <div className={`text-center p-2 rounded ${
                  Math.abs(getSplitTotal() - getCurrentTableTotal()) < 0.01 
                    ? 'bg-green-500/10 text-green-500' 
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  <p className="text-sm">
                    Suma: {formatCurrency(getSplitTotal())} / {formatCurrency(getCurrentTableTotal())}
                  </p>
                  {Math.abs(getSplitTotal() - getCurrentTableTotal()) >= 0.01 && (
                    <p className="text-xs">
                      {getSplitTotal() < getCurrentTableTotal() 
                        ? `Falta: ${formatCurrency(getCurrentTableTotal() - getSplitTotal())}` 
                        : `Excede: ${formatCurrency(getSplitTotal() - getCurrentTableTotal())}`}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handlePayTable} 
              disabled={updatePaymentMutation.isPending || (isSplitPayment && Math.abs(getSplitTotal() - getCurrentTableTotal()) >= 0.01)}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Confirmar Cobro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}