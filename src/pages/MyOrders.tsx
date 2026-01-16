import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList, Clock, CheckCircle, AlertCircle, DollarSign, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime } from '@/lib/utils-format';
import { useSales, SaleWithStatus, useUpdatePaymentStatus } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PaymentMethod } from '@/types';
import { cn } from '@/lib/utils';

type TabType = 'pending' | 'history' | 'stock';

export default function MyOrders() {
  const { toast } = useToast();
  const { currentStaff, roles } = useAuth();
  const { data: allSales = [] } = useSales();
  const { data: products = [] } = useProducts();
  const updatePaymentMutation = useUpdatePaymentStatus();
  
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash');

  const isAdminRole = roles.includes('admin');
  const isMozoRole = roles.includes('mozo') || isAdminRole;

  // Ventas del mozo actual
  const mySales = useMemo(() => {
    if (!currentStaff) return [];
    if (isAdminRole) return allSales;
    return allSales.filter(s => s.staffId === currentStaff.id);
  }, [allSales, currentStaff, isAdminRole]);

  // Ventas no cobradas agrupadas por mesa
  const unpaidByTable = useMemo(() => {
    const unpaid = mySales.filter(s => s.paymentStatus === 'no_cobrado');
    const grouped: Record<string, SaleWithStatus[]> = {};
    
    unpaid.forEach(sale => {
      const table = sale.tableNumber || 'sin_mesa';
      if (!grouped[table]) grouped[table] = [];
      grouped[table].push(sale);
    });
    
    return grouped;
  }, [mySales]);

  // Total por mesa
  const tableTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(unpaidByTable).forEach(([table, sales]) => {
      totals[table] = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    });
    return totals;
  }, [unpaidByTable]);

  // Productos con stock bajo
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.status === 'low' || p.status === 'critical');
  }, [products]);

  const openPaymentDialog = (table: string) => {
    setSelectedTable(table);
    setSelectedPaymentMethod('cash');
    setIsPaymentDialogOpen(true);
  };

  const handlePayTable = async () => {
    if (!selectedTable) return;
    
    const tableSales = unpaidByTable[selectedTable] || [];
    
    try {
      // Marcar todas las ventas de la mesa como cobradas
      for (const sale of tableSales) {
        await updatePaymentMutation.mutateAsync({
          saleId: sale.id,
          paymentStatus: 'cobrado',
          paymentMethod: selectedPaymentMethod,
        });
      }
      
      toast({
        title: 'Mesa cobrada',
        description: `Se cobraron ${tableSales.length} pedidos por ${formatCurrency(tableTotals[selectedTable])}`
      });
      
      setIsPaymentDialogOpen(false);
      setSelectedTable(null);
    } catch (error) {
      console.error('Error paying table:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo procesar el cobro'
      });
    }
  };

  // Historial de hoy
  const todayHistory = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return mySales.filter(s => {
      const saleDate = new Date(s.createdAt);
      return saleDate >= today;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [mySales]);

  return (
    <Layout>
      <PageHeader 
        title="Mis Pedidos" 
        description={`Bienvenido, ${currentStaff?.full_name || 'Mozo'}`}
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="mb-6">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-4 h-4" />
            Pendientes
            {Object.keys(unpaidByTable).length > 0 && (
              <Badge variant="destructive" className="ml-1">{Object.keys(unpaidByTable).length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Historial de Hoy
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-2">
            <Package className="w-4 h-4" />
            Stock Bajo
            {lowStockProducts.length > 0 && (
              <Badge variant="destructive" className="ml-1">{lowStockProducts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Orders by Table */}
        <TabsContent value="pending">
          {Object.keys(unpaidByTable).length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Todo al día</h3>
                <p className="text-muted-foreground">No tienes pedidos pendientes de cobro</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(unpaidByTable).map(([table, sales]) => (
                <Card key={table} className="border-amber-500/50 border-2">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-2xl">
                        {table === 'sin_mesa' ? 'Sin Mesa' : `Mesa ${table}`}
                      </CardTitle>
                      <Badge className="bg-amber-500 text-lg px-3 py-1">
                        {sales.length} pedidos
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                      {sales.map(sale => (
                        <div key={sale.id} className="p-2 bg-secondary/30 rounded text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {formatDateTime(new Date(sale.createdAt))}
                            </span>
                            <span className="font-semibold text-primary">
                              {formatCurrency(sale.totalAmount)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="border-t pt-4 mt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-semibold">Total Mesa</span>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(tableTotals[table])}
                        </span>
                      </div>
                      <Button 
                        className="w-full h-12 text-lg"
                        onClick={() => openPaymentDialog(table)}
                      >
                        <DollarSign className="w-5 h-5 mr-2" />
                        Cobrar Todo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Order History */}
        <TabsContent value="history">
          {todayHistory.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <ClipboardList className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Sin actividad hoy</h3>
                <p className="text-muted-foreground">Aún no has registrado pedidos hoy</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {todayHistory.map(sale => (
                <Card key={sale.id} className={cn(
                  sale.paymentStatus === 'no_cobrado' && "border-amber-500/50"
                )}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Badge variant={sale.paymentStatus === 'cobrado' ? 'secondary' : 'default'}
                            className={cn(
                              sale.paymentStatus === 'cobrado' ? 'bg-green-500/20 text-green-500' : 'bg-amber-500'
                            )}
                          >
                            {sale.paymentStatus === 'cobrado' ? 'Cobrada' : 'Pendiente'}
                          </Badge>
                          <span className="font-medium">
                            {sale.tableNumber ? `Mesa ${sale.tableNumber}` : sale.concept}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            {formatDateTime(new Date(sale.createdAt))}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-primary">{formatCurrency(sale.totalAmount)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Stock Alerts */}
        <TabsContent value="stock">
          {lowStockProducts.length === 0 ? (
            <Card className="text-center py-12 bg-green-500/5 border-green-500/20">
              <CardContent>
                <Package className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Stock OK</h3>
                <p className="text-muted-foreground">Todos los productos tienen stock suficiente</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {lowStockProducts.map(product => (
                <Card key={product.id} className={cn(
                  "border-2",
                  product.status === 'critical' ? "border-destructive/50 bg-destructive/5" : "border-amber-500/50 bg-amber-500/5"
                )}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={product.status === 'critical' ? 'destructive' : 'default'}
                          className={product.status === 'low' ? 'bg-amber-500' : ''}
                        >
                          {product.status === 'critical' ? 'CRÍTICO' : 'BAJO'}
                        </Badge>
                        <span className="font-medium">{product.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{product.quantity} {product.unitBase || 'unidades'}</p>
                        <p className="text-xs text-muted-foreground">Mín: {product.minStock}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
              <p className="text-sm text-muted-foreground">Total a cobrar</p>
              <p className="text-3xl font-bold text-primary">
                {selectedTable && formatCurrency(tableTotals[selectedTable] || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedTable && `${unpaidByTable[selectedTable]?.length || 0} pedidos`}
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
