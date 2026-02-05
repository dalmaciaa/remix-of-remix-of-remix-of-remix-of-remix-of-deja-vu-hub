import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Clock, CheckCircle, Package, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime } from '@/lib/utils-format';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { cn } from '@/lib/utils';

type TabType = 'pending' | 'history' | 'stock' | 'stats';

export default function MyOrders() {
  const { currentStaff, roles } = useAuth();
  const { data: allSales = [] } = useSales();
  const { data: products = [] } = useProducts();
  
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  // Ventas del mozo actual solamente
  const mySales = useMemo(() => {
    if (!currentStaff) return [];
    return allSales.filter(s => s.staffId === currentStaff.id);
  }, [allSales, currentStaff]);

  // Ventas no cobradas agrupadas por mesa (solo para ver, NO para cobrar)
  const unpaidByTable = useMemo(() => {
    const unpaid = mySales.filter(s => s.paymentStatus === 'no_cobrado');
    const grouped: Record<string, typeof unpaid> = {};
    
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

  // Historial de hoy
  const todayHistory = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return mySales.filter(s => {
      const saleDate = new Date(s.createdAt);
      return saleDate >= today;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [mySales]);

  // Estadísticas del mozo
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    const todaySales = mySales.filter(s => new Date(s.createdAt) >= today);
    const weekSales = mySales.filter(s => new Date(s.createdAt) >= weekAgo);
    const monthSales = mySales.filter(s => new Date(s.createdAt) >= monthAgo);
    
    const todayTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const weekTotal = weekSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const monthTotal = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);
    
    const todayPaid = todaySales.filter(s => s.paymentStatus === 'cobrado').reduce((sum, s) => sum + s.totalAmount, 0);
    const todayPending = todaySales.filter(s => s.paymentStatus === 'no_cobrado').reduce((sum, s) => sum + s.totalAmount, 0);
    
    // Promedio diario del mes
    const daysInPeriod = Math.max(1, Math.ceil((new Date().getTime() - monthAgo.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyAverage = monthTotal / daysInPeriod;
    
    return {
      today: { count: todaySales.length, total: todayTotal, paid: todayPaid, pending: todayPending },
      week: { count: weekSales.length, total: weekTotal },
      month: { count: monthSales.length, total: monthTotal },
      dailyAverage,
    };
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
            Hoy
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Mi Desempeño
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-2">
            <Package className="w-4 h-4" />
            Stock
            {lowStockProducts.length > 0 && (
              <Badge variant="destructive" className="ml-1">{lowStockProducts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Orders by Table - SOLO VISUALIZACIÓN, NO COBRO */}
        <TabsContent value="pending">
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Los pedidos pendientes serán cobrados por la cajera. Aquí puedes ver el estado de tus mesas.
            </p>
          </div>
          
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
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Total Mesa</span>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(tableTotals[table])}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Pendiente de cobro por cajera
                      </p>
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

        {/* Stats */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-10 h-10 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Ventas Hoy</p>
                    <p className="text-3xl font-bold">{stats.today.count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-10 h-10 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Hoy</p>
                    <p className="text-3xl font-bold">{formatCurrency(stats.today.total)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Clock className="w-10 h-10 text-amber-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pendiente</p>
                    <p className="text-3xl font-bold">{formatCurrency(stats.today.pending)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-10 h-10 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Promedio/Día</p>
                    <p className="text-3xl font-bold">{formatCurrency(stats.dailyAverage)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Última Semana</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-4xl font-bold">{stats.week.count}</p>
                    <p className="text-sm text-muted-foreground">Ventas realizadas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary">{formatCurrency(stats.week.total)}</p>
                    <p className="text-sm text-muted-foreground">Total facturado</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Último Mes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-4xl font-bold">{stats.month.count}</p>
                    <p className="text-sm text-muted-foreground">Ventas realizadas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary">{formatCurrency(stats.month.total)}</p>
                    <p className="text-sm text-muted-foreground">Total facturado</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
    </Layout>
  );
}
