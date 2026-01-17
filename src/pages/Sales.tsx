import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProducts } from '@/hooks/useProducts';
import { useSales, useAddSale, useDeleteSale, useUpdatePaymentStatus, SaleWithStatus, PaymentStatus } from '@/hooks/useSales';
import { PaymentMethod, CatalogCategory } from '@/types';
import { formatCurrency, formatDateTime, paymentMethodLabels, catalogCategoryLabels, isToday, isThisMonth } from '@/lib/utils-format';
import { Plus, Trash2, ShoppingCart, Search, Minus, X, Receipt, Loader2, Check, Clock, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

type ViewFilter = 'today' | 'month' | 'all';
type CategoryFilter = CatalogCategory | 'all';

const COLORS = ['hsl(38, 92%, 50%)', 'hsl(320, 70%, 45%)', 'hsl(142, 70%, 45%)'];

// Categorías del catálogo de venta
const CATALOG_CATEGORIES: CatalogCategory[] = ['food', 'cocktails', 'drinks'];

export default function Sales() {
  const [viewFilter, setViewFilter] = useState<ViewFilter>('today');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithStatus | null>(null);

  const { data: allProducts = [], isLoading: loadingProducts } = useProducts();
  const { data: sales = [], isLoading: loadingSales } = useSales();
  const addSaleMutation = useAddSale();
  const deleteSaleMutation = useDeleteSale();
  const updatePaymentMutation = useUpdatePaymentStatus();
  const { currentStaff } = useAuth();

  // Filtrar solo productos del catálogo de venta
  // Para comida y cócteles no se valida stock (se elaboran bajo pedido)
  // Para bebidas sí se valida stock
  const catalogProducts = useMemo(() => {
    return allProducts.filter(p => {
      if (!CATALOG_CATEGORIES.includes(p.category as CatalogCategory)) return false;
      // Bebidas requieren stock, comida y cócteles no
      if (p.category === 'drinks') return p.quantity > 0;
      return true; // food y cocktails siempre disponibles
    });
  }, [allProducts]);

  // Cart state for new sale
  const [cart, setCart] = useState<{ productId: string; quantity: number; notes?: string }[]>([]);
  const [concept, setConcept] = useState('');
  
  const [tableNumber, setTableNumber] = useState('');

  // Payment dialog state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash');

  const isLoading = loadingProducts || loadingSales;

  const filteredSalesProducts = useMemo(() => {
    return catalogProducts.filter((p) => {
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [catalogProducts, categoryFilter, searchTerm]);

  // Separar ventas no cobradas (para mostrar arriba)
  const { unpaidSales, paidSales } = useMemo(() => {
    const filtered = sales.filter((s) => {
      if (viewFilter === 'today') return isToday(new Date(s.createdAt));
      if (viewFilter === 'month') return isThisMonth(new Date(s.createdAt));
      return true;
    });

    return {
      unpaidSales: filtered.filter(s => s.paymentStatus === 'no_cobrado'),
      paidSales: filtered.filter(s => s.paymentStatus === 'cobrado'),
    };
  }, [sales, viewFilter]);

  const allFilteredSales = [...unpaidSales, ...paidSales];

  const totalFiltered = allFilteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalUnpaid = unpaidSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalPaid = paidSales.reduce((sum, s) => sum + s.totalAmount, 0);

  const paymentBreakdown = useMemo(() => {
    return {
      cash: paidSales.filter((s) => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalAmount, 0),
      transfer: paidSales.filter((s) => s.paymentMethod === 'transfer').reduce((sum, s) => sum + s.totalAmount, 0),
      qr: paidSales.filter((s) => s.paymentMethod === 'qr').reduce((sum, s) => sum + s.totalAmount, 0),
    };
  }, [paidSales]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const product = allProducts.find((p) => p.id === item.productId);
      return sum + (product ? product.salePrice * item.quantity : 0);
    }, 0);
  }, [cart, allProducts]);

  const addToCart = (productId: string) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;

    const existing = cart.find((c) => c.productId === productId);
    // Para bebidas validar stock, para comida/cócteles no hay límite
    const needsStockCheck = product.category === 'drinks';
    
    if (existing) {
      if (!needsStockCheck || existing.quantity < product.quantity) {
        setCart(cart.map((c) => c.productId === productId ? { ...c, quantity: c.quantity + 1 } : c));
      } else {
        toast.error('Stock insuficiente');
      }
    } else {
      setCart([...cart, { productId, quantity: 1 }]);
    }
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;

    // Para bebidas validar stock, para comida/cócteles no hay límite
    const needsStockCheck = product.category === 'drinks';

    setCart((prev) => {
      return prev.map((c) => {
        if (c.productId !== productId) return c;
        const newQty = c.quantity + delta;
        if (newQty <= 0) return c;
        if (needsStockCheck && newQty > product.quantity) {
          toast.error('Stock insuficiente');
          return c;
        }
        return { ...c, quantity: newQty };
      }).filter((c) => c.quantity > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((c) => c.productId !== productId));
  };

  const handleSubmitSale = () => {
    if (cart.length === 0) {
      toast.error('Agrega productos al carrito');
      return;
    }

    // Todas las ventas son pendientes de cobro por defecto
    addSaleMutation.mutate({
      items: cart,
      paymentMethod: 'cash', // Default, se define cuando el cajero cobra
      concept: concept || (tableNumber ? `Mesa ${tableNumber}` : 'Venta general'),
      isPaid: false, // Siempre pendiente de cobro
      tableNumber: tableNumber || undefined,
      staffName: currentStaff?.full_name || undefined,
      staffId: currentStaff?.id || undefined,
    }, {
      onSuccess: () => {
        setCart([]);
        setConcept('');
        setTableNumber('');
        setIsAddDialogOpen(false);
      }
    });
  };

  const handleDeleteSale = (sale: SaleWithStatus) => {
    if (confirm('¿Eliminar esta venta? (No restaurará el stock)')) {
      deleteSaleMutation.mutate(sale.id);
    }
  };

  const openPaymentDialog = (sale: SaleWithStatus) => {
    setSelectedSale(sale);
    setSelectedPaymentMethod('cash');
    setIsPaymentDialogOpen(true);
  };

  const handleMarkAsPaid = () => {
    if (!selectedSale) return;
    
    updatePaymentMutation.mutate({
      saleId: selectedSale.id,
      paymentStatus: 'cobrado',
      paymentMethod: selectedPaymentMethod,
    }, {
      onSuccess: () => {
        setIsPaymentDialogOpen(false);
        setSelectedSale(null);
      }
    });
  };

  // Chart data
  const pieData = [
    { name: 'Efectivo', value: paymentBreakdown.cash },
    { name: 'Transferencia', value: paymentBreakdown.transfer },
    { name: 'QR', value: paymentBreakdown.qr },
  ].filter((d) => d.value > 0);

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
      <PageHeader title="Ventas" description="Registro y seguimiento de ventas">
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Venta
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">Total {viewFilter === 'today' ? 'Hoy' : viewFilter === 'month' ? 'Este Mes' : 'General'}</p>
          <p className="text-2xl font-semibold text-primary">{formatCurrency(totalFiltered)}</p>
        </div>
        <div className="glass-card p-4 border-l-4 border-l-amber-500">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pendiente de Cobro
          </p>
          <p className="text-xl font-semibold text-amber-500">{formatCurrency(totalUnpaid)}</p>
          <p className="text-xs text-muted-foreground">{unpaidSales.length} ventas</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">Efectivo</p>
          <p className="text-xl font-semibold">{formatCurrency(paymentBreakdown.cash)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">Transferencia</p>
          <p className="text-xl font-semibold">{formatCurrency(paymentBreakdown.transfer)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">QR</p>
          <p className="text-xl font-semibold">{formatCurrency(paymentBreakdown.qr)}</p>
        </div>
      </div>

      {/* Chart */}
      {pieData.length > 0 && (
        <div className="glass-card p-6 mb-6">
          <h3 className="font-display text-lg font-semibold mb-4">Distribución por Método de Pago (Cobradas)</h3>
          <div className="h-48 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(220, 18%, 11%)',
                    border: '1px solid hsl(220, 15%, 20%)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                <span className="text-xs text-muted-foreground">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={viewFilter} onValueChange={(v) => setViewFilter(v as ViewFilter)}>
        <TabsList className="mb-6">
          <TabsTrigger value="today">Hoy</TabsTrigger>
          <TabsTrigger value="month">Este Mes</TabsTrigger>
          <TabsTrigger value="all">Todo</TabsTrigger>
        </TabsList>

        <TabsContent value={viewFilter}>
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allFilteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      No hay ventas registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  allFilteredSales.map((sale) => {
                    const isUnpaid = sale.paymentStatus === 'no_cobrado';
                    return (
                      <TableRow 
                        key={sale.id} 
                        className={cn(isUnpaid && "bg-amber-500/10 hover:bg-amber-500/15")}
                      >
                        <TableCell>
                          {isUnpaid ? (
                            <Badge className="bg-amber-500 hover:bg-amber-600">
                              <Clock className="w-3 h-3 mr-1" />
                              Pendiente
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                              <Check className="w-3 h-3 mr-1" />
                              Cobrada
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDateTime(new Date(sale.createdAt))}</TableCell>
                        <TableCell className="font-medium">{sale.concept}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {sale.items.map((item, idx) => (
                              <div key={idx} className="text-muted-foreground">
                                {item.productName} x{item.quantity}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isUnpaid ? (
                            <span className="text-muted-foreground text-sm">-</span>
                          ) : (
                            <span className="status-badge bg-secondary text-secondary-foreground">
                              {paymentMethodLabels[sale.paymentMethod]}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-primary font-semibold">
                          {formatCurrency(sale.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {isUnpaid && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => openPaymentDialog(sale)}
                                className="text-amber-500 border-amber-500 hover:bg-amber-500/10"
                              >
                                <DollarSign className="w-4 h-4 mr-1" />
                                Cobrar
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteSale(sale)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Sale Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Venta</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product Selection */}
            <div>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="food">Comida</SelectItem>
                    <SelectItem value="cocktails">Cócteles</SelectItem>
                    <SelectItem value="drinks">Bebidas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto scrollbar-thin">
                {filteredSalesProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product.id)}
                    className="p-3 rounded-lg bg-secondary/50 hover:bg-secondary text-left transition-colors"
                  >
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {catalogCategoryLabels[product.category as CatalogCategory] || product.category}
                    </p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-primary font-semibold">{formatCurrency(product.salePrice)}</p>
                      <p className="text-xs text-muted-foreground">Stock: {product.quantity}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cart */}
            <div className="glass-card p-4">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Carrito
              </h4>

              {cart.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  Selecciona productos
                </p>
              ) : (
                <div className="space-y-3 mb-4 max-h-48 overflow-y-auto scrollbar-thin">
                  {cart.map((item) => {
                    const product = allProducts.find((p) => p.id === item.productId);
                    if (!product) return null;
                    return (
                      <div key={item.productId} className="flex items-center justify-between bg-secondary/30 p-2 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(product.salePrice)} c/u
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateCartQuantity(item.productId, -1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateCartQuantity(item.productId, 1)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromCart(item.productId)}>
                            <X className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="tableNumber">Mesa</Label>
                    <Input
                      id="tableNumber"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="Ej: 5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="concept">Concepto</Label>
                    <Input
                      id="concept"
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      placeholder="Barra, etc."
                    />
                  </div>
                </div>

                {/* Info de que es pendiente */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium text-amber-500">Pendiente de cobro</p>
                    <p className="text-xs text-muted-foreground">
                      El cajero marcará como cobrado cuando reciba el pago
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center py-3 border-t border-border">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(cartTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitSale} disabled={cart.length === 0 || addSaleMutation.isPending}>
              {addSaleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Registrar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cobrar Venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 bg-secondary/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Total a cobrar</p>
              <p className="text-3xl font-bold text-primary">
                {selectedSale && formatCurrency(selectedSale.totalAmount)}
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
            <Button onClick={handleMarkAsPaid} disabled={updatePaymentMutation.isPending}>
              {updatePaymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              <Check className="w-4 h-4 mr-1" />
              Marcar como Cobrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
