import { useState, useMemo, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useSales, SaleWithStatus, useUpdatePaymentStatus } from '@/hooks/useSales';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime } from '@/lib/utils-format';
import { DollarSign, User, CheckCircle, Clock, Users } from 'lucide-react';
import { PaymentMethod } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface StaffMember {
  id: string;
  full_name: string;
}

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

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, full_name')
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

  // Agrupar por mozo y luego por mesa
  const groupedByStaffAndTable = useMemo(() => {
    const grouped: Record<string, Record<string, SaleWithStatus[]>> = {};
    
    unpaidSales.forEach(sale => {
      const staffId = sale.staffId || 'sin_mozo';
      const staffName = sale.staffName || 'Sin Mozo';
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

  // Get staff name by ID
  const getStaffName = (staffId: string) => {
    if (staffId === 'sin_mozo') return 'Sin Mozo';
    return staffList.find(s => s.id === staffId)?.full_name || 
           unpaidSales.find(s => s.staffId === staffId)?.staffName || 
           'Desconocido';
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
    setIsPaymentDialogOpen(true);
  };

  // Handle payment
  const handlePayTable = async () => {
    if (!selectedTable || !selectedStaffForPayment) return;
    
    const tableSales = groupedByStaffAndTable[selectedStaffForPayment]?.[selectedTable] || [];
    
    try {
      for (const sale of tableSales) {
        await updatePaymentMutation.mutateAsync({
          saleId: sale.id,
          paymentStatus: 'cobrado',
          paymentMethod: selectedPaymentMethod,
        });
      }
      
      toast({
        title: 'Mesa cobrada',
        description: `Se cobraron ${tableSales.length} pedidos por ${formatCurrency(getTableTotal(tableSales))}`
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
    const tablesCount = new Set(unpaidSales.map(s => s.tableNumber || 'sin_mesa')).size;
    const staffCount = new Set(unpaidSales.map(s => s.staffId || 'sin_mozo')).size;
    
    return { totalPending, tablesCount, staffCount, salesCount: unpaidSales.length };
  }, [unpaidSales]);

  return (
    <Layout>
      <PageHeader 
        title="Cobrar Pedidos" 
        description="Gestiona los cobros de pedidos pendientes por mozo y mesa"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Pendiente</p>
                <p className="text-2xl font-bold text-amber-500">{formatCurrency(stats.totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Pedidos</p>
                <p className="text-2xl font-bold">{stats.salesCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Mozos</p>
                <p className="text-2xl font-bold">{stats.staffCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Mesas</p>
                <p className="text-2xl font-bold">{stats.tablesCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter by staff */}
      <div className="mb-6">
        <Select value={selectedStaff} onValueChange={setSelectedStaff}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filtrar por mozo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los mozos</SelectItem>
            {staffList.map(staff => (
              <SelectItem key={staff.id} value={staff.id}>
                {staff.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
          {Object.entries(groupedByStaffAndTable).map(([staffId, tables]) => (
            <Card key={staffId}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-primary" />
                  <CardTitle>{getStaffName(staffId)}</CardTitle>
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
          ))}
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Cobrar {selectedTable === 'sin_mesa' ? 'Pedidos sin Mesa' : `Mesa ${selectedTable}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 bg-secondary/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Mozo</p>
              <p className="font-semibold">{selectedStaffForPayment && getStaffName(selectedStaffForPayment)}</p>
            </div>
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Total a cobrar</p>
              <p className="text-3xl font-bold text-primary">
                {selectedTable && selectedStaffForPayment && 
                  formatCurrency(getTableTotal(groupedByStaffAndTable[selectedStaffForPayment]?.[selectedTable] || []))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedTable && selectedStaffForPayment && 
                  `${groupedByStaffAndTable[selectedStaffForPayment]?.[selectedTable]?.length || 0} pedidos`}
              </p>
            </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handlePayTable} disabled={updatePaymentMutation.isPending}>
              <CheckCircle className="w-4 h-4 mr-1" />
              Confirmar Cobro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
