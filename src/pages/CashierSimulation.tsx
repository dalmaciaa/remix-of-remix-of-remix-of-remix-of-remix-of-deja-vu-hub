import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  FlaskConical, Plus, Minus, Trash2, ShoppingCart, DollarSign, CreditCard, Smartphone,
  Receipt, CheckCircle, Clock, RotateCcw, Ticket, Search
} from 'lucide-react';

interface SimCartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface SimSale {
  id: string;
  items: SimCartItem[];
  total: number;
  tableNumber: string;
  paymentStatus: 'cobrado' | 'no_cobrado';
  paymentMethod?: string;
  cashAmount?: number;
  qrAmount?: number;
  transferAmount?: number;
  createdAt: Date;
}

interface SimTicketSale {
  id: string;
  eventName: string;
  quantity: number;
  priceEach: number;
  total: number;
  createdAt: Date;
}

const CATEGORIES: Record<string, string> = {
  drinks: 'Bebidas',
  cocktails: 'Tragos',
  food: 'Comida',
  supplies: 'Insumos',
  others: 'Otros',
  semi_elaborated: 'Semi-elaborados',
};

export default function CashierSimulation() {
  const { isAdminUser } = useAuth();
  const { data: products = [] } = useProducts();

  // Cart state
  const [cart, setCart] = useState<SimCartItem[]>([]);
  const [tableNumber, setTableNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Sales log
  const [sales, setSales] = useState<SimSale[]>([]);

  // Ticket simulation
  const [ticketSales, setTicketSales] = useState<SimTicketSale[]>([]);
  const [ticketEventName, setTicketEventName] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketQty, setTicketQty] = useState('1');

  // Payment dialog
  const [payDialog, setPayDialog] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [payCash, setPayCash] = useState('');
  const [payQr, setPayQr] = useState('');
  const [payTransfer, setPayTransfer] = useState('');

  // Only for-sale products
  const saleProducts = useMemo(() => {
    return products.filter(p => (p as any).is_for_sale !== false);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return saleProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [saleProducts, searchTerm, categoryFilter]);

  // Cart helpers
  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.salePrice, quantity: 1 }];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? i : { ...i, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Create simulated sale
  const createSimSale = (status: 'cobrado' | 'no_cobrado') => {
    if (cart.length === 0) return;
    const sale: SimSale = {
      id: crypto.randomUUID(),
      items: [...cart],
      total: cartTotal,
      tableNumber: tableNumber || 'Sin mesa',
      paymentStatus: status,
      createdAt: new Date(),
    };
    setSales(prev => [sale, ...prev]);
    setCart([]);
    setTableNumber('');
    toast.success(`Venta simulada creada (${status === 'cobrado' ? 'Cobrada' : 'Pendiente'})`);
  };

  // Collect payment on pending sale
  const collectPayment = () => {
    if (!payDialog) return;
    const sale = sales.find(s => s.id === payDialog);
    if (!sale) return;

    const cash = parseFloat(payCash) || 0;
    const qr = parseFloat(payQr) || 0;
    const transfer = parseFloat(payTransfer) || 0;
    const totalPaid = payMethod === 'mixed' ? cash + qr + transfer : sale.total;

    if (payMethod === 'mixed' && Math.abs(totalPaid - sale.total) > 0.01) {
      toast.error(`El total pagado ($${totalPaid.toFixed(2)}) no coincide con el total de la venta ($${sale.total.toFixed(2)})`);
      return;
    }

    setSales(prev => prev.map(s => s.id === payDialog ? {
      ...s,
      paymentStatus: 'cobrado',
      paymentMethod: payMethod,
      cashAmount: payMethod === 'mixed' ? cash : payMethod === 'cash' ? sale.total : 0,
      qrAmount: payMethod === 'mixed' ? qr : payMethod === 'qr' ? sale.total : 0,
      transferAmount: payMethod === 'mixed' ? transfer : payMethod === 'transfer' ? sale.total : 0,
    } : s));

    setPayDialog(null);
    setPayMethod('cash');
    setPayCash('');
    setPayQr('');
    setPayTransfer('');
    toast.success('Pago simulado registrado');
  };

  // Ticket sale
  const createTicketSale = () => {
    if (!ticketEventName || !ticketPrice) return;
    const qty = parseInt(ticketQty) || 1;
    const price = parseFloat(ticketPrice) || 0;
    const sale: SimTicketSale = {
      id: crypto.randomUUID(),
      eventName: ticketEventName,
      quantity: qty,
      priceEach: price,
      total: qty * price,
      createdAt: new Date(),
    };
    setTicketSales(prev => [sale, ...prev]);
    setTicketQty('1');
    toast.success(`${qty} entrada(s) simulada(s) vendida(s)`);
  };

  // Totals
  const totalCollected = sales.filter(s => s.paymentStatus === 'cobrado').reduce((sum, s) => sum + s.total, 0);
  const totalPending = sales.filter(s => s.paymentStatus === 'no_cobrado').reduce((sum, s) => sum + s.total, 0);
  const totalCash = sales.filter(s => s.paymentStatus === 'cobrado').reduce((sum, s) => sum + (s.cashAmount || (s.paymentMethod === 'cash' ? s.total : 0)), 0);
  const totalQr = sales.filter(s => s.paymentStatus === 'cobrado').reduce((sum, s) => sum + (s.qrAmount || (s.paymentMethod === 'qr' ? s.total : 0)), 0);
  const totalTransfer = sales.filter(s => s.paymentStatus === 'cobrado').reduce((sum, s) => sum + (s.transferAmount || (s.paymentMethod === 'transfer' ? s.total : 0)), 0);
  const totalTickets = ticketSales.reduce((sum, s) => sum + s.total, 0);

  // Reset
  const resetAll = () => {
    setSales([]);
    setTicketSales([]);
    setCart([]);
    setTableNumber('');
    toast.success('Simulación reiniciada');
  };

  if (!isAdminUser()) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">No tienes acceso a esta sección.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Simulación de Caja"
        description="Practica operaciones de venta sin afectar datos reales — nada se guarda en la base de datos"
      />

      {/* Banner */}
      <div className="mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
        <FlaskConical className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          <strong>Modo simulación activo.</strong> Las ventas, cobros y entradas aquí son ficticios. No se descuenta stock ni se registra en el sistema.
        </p>
        <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={resetAll}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reiniciar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Cobrado</p>
            <p className="text-xl font-bold text-green-600">${totalCollected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Pendiente</p>
            <p className="text-xl font-bold text-yellow-600">${totalPending.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Efectivo</p>
            <p className="text-lg font-bold">${totalCash.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">QR / Transfer.</p>
            <p className="text-lg font-bold">${(totalQr + totalTransfer).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Entradas</p>
            <p className="text-xl font-bold text-purple-600">${totalTickets.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales"><ShoppingCart className="w-4 h-4 mr-1.5" /> Ventas</TabsTrigger>
          <TabsTrigger value="tickets"><Ticket className="w-4 h-4 mr-1.5" /> Entradas</TabsTrigger>
          <TabsTrigger value="history"><Receipt className="w-4 h-4 mr-1.5" /> Historial</TabsTrigger>
        </TabsList>

        {/* === SALES TAB === */}
        <TabsContent value="sales">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Product catalog */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Catálogo</CardTitle>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Buscar producto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredProducts.map(p => (
                      <button
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                      >
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{CATEGORIES[p.category] || p.category}</p>
                        <p className="text-sm font-bold text-primary mt-1">${p.salePrice.toLocaleString()}</p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Cart */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Carrito
                </CardTitle>
                <Input placeholder="N° Mesa" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="mt-2" />
              </CardHeader>
              <CardContent className="flex flex-col h-[400px]">
                <ScrollArea className="flex-1">
                  {cart.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Agregá productos al carrito</p>
                  ) : (
                    <div className="space-y-2">
                      {cart.map(item => (
                        <div key={item.productId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">${item.price} x {item.quantity} = ${(item.price * item.quantity).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQty(item.productId, -1)}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="text-sm w-6 text-center">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQty(item.productId, 1)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.productId)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <Separator className="my-3" />
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold text-primary">${cartTotal.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={cart.length === 0} onClick={() => createSimSale('no_cobrado')}>
                    <Clock className="w-4 h-4 mr-1" /> Pendiente
                  </Button>
                  <Button disabled={cart.length === 0} onClick={() => createSimSale('cobrado')}>
                    <CheckCircle className="w-4 h-4 mr-1" /> Cobrada
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === TICKETS TAB === */}
        <TabsContent value="tickets">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Simular Venta de Entradas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nombre del evento</Label>
                  <Input value={ticketEventName} onChange={e => setTicketEventName(e.target.value)} placeholder="Ej: Noche Retro" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Precio por entrada</Label>
                    <Input type="number" value={ticketPrice} onChange={e => setTicketPrice(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label>Cantidad</Label>
                    <Input type="number" value={ticketQty} onChange={e => setTicketQty(e.target.value)} min="1" />
                  </div>
                </div>
                <Button className="w-full" disabled={!ticketEventName || !ticketPrice} onClick={createTicketSale}>
                  <Ticket className="w-4 h-4 mr-2" /> Registrar Entrada(s)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Entradas Vendidas</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {ticketSales.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Sin entradas simuladas aún</p>
                  ) : (
                    <div className="space-y-2">
                      {ticketSales.map(t => (
                        <div key={t.id} className="p-3 rounded-lg border bg-muted/20">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{t.eventName}</p>
                              <p className="text-xs text-muted-foreground">{t.quantity} entrada(s) × ${t.priceEach.toLocaleString()}</p>
                            </div>
                            <span className="font-bold text-sm">${t.total.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === HISTORY TAB === */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de Ventas Simuladas ({sales.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {sales.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No hay ventas simuladas</p>
                ) : (
                  <div className="space-y-3">
                    {sales.map(sale => (
                      <div key={sale.id} className="p-4 rounded-xl border bg-card">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-sm">Mesa: {sale.tableNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {sale.createdAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              {' · '}{sale.items.length} producto(s)
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">${sale.total.toLocaleString()}</p>
                            <Badge variant={sale.paymentStatus === 'cobrado' ? 'default' : 'secondary'} className={cn(
                              'text-xs',
                              sale.paymentStatus === 'cobrado' ? 'bg-green-600' : 'bg-yellow-600'
                            )}>
                              {sale.paymentStatus === 'cobrado' ? 'Cobrada' : 'Pendiente'}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {sale.items.map((item, idx) => (
                            <p key={idx}>{item.quantity}x {item.name} — ${(item.price * item.quantity).toLocaleString()}</p>
                          ))}
                        </div>
                        {sale.paymentStatus === 'no_cobrado' && (
                          <Button size="sm" className="mt-2" onClick={() => setPayDialog(sale.id)}>
                            <DollarSign className="w-3.5 h-3.5 mr-1" /> Cobrar
                          </Button>
                        )}
                        {sale.paymentStatus === 'cobrado' && sale.paymentMethod && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Método: {sale.paymentMethod === 'mixed' ? 'Combinado' : sale.paymentMethod}
                            {sale.paymentMethod === 'mixed' && (
                              <span> (Ef: ${sale.cashAmount?.toLocaleString()} / QR: ${sale.qrAmount?.toLocaleString()} / Tr: ${sale.transferAmount?.toLocaleString()})</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={!!payDialog} onOpenChange={open => !open && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cobrar Venta Simulada</DialogTitle>
          </DialogHeader>
          {payDialog && (() => {
            const sale = sales.find(s => s.id === payDialog);
            if (!sale) return null;
            return (
              <div className="space-y-4">
                <p className="text-center text-2xl font-bold">${sale.total.toLocaleString()}</p>
                <div>
                  <Label>Método de pago</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="qr">QR</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                      <SelectItem value="mixed">Combinado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {payMethod === 'mixed' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <Input type="number" placeholder="Efectivo" value={payCash} onChange={e => setPayCash(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      <Input type="number" placeholder="QR" value={payQr} onChange={e => setPayQr(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-purple-600" />
                      <Input type="number" placeholder="Transferencia" value={payTransfer} onChange={e => setPayTransfer(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Total: ${((parseFloat(payCash) || 0) + (parseFloat(payQr) || 0) + (parseFloat(payTransfer) || 0)).toLocaleString()} / ${sale.total.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancelar</Button>
            <Button onClick={collectPayment}>Confirmar Cobro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
