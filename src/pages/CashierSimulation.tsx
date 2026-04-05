import { useState, useMemo, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  FlaskConical, Plus, Minus, Trash2, ShoppingCart, DollarSign, CreditCard, Smartphone,
  CheckCircle, Clock, RotateCcw, Ticket, Search, Receipt, X, ChevronDown, ChevronUp
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

const CAT_LABELS: Record<string, string> = {
  drinks: 'Bebidas',
  cocktails: 'Tragos',
  food: 'Comida',
  supplies: 'Insumos',
  others: 'Otros',
  semi_elaborated: 'Semi-elab.',
};

const CAT_COLORS: Record<string, string> = {
  drinks: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  cocktails: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30',
  food: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
  supplies: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
  others: 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/30',
  semi_elaborated: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30',
};

export default function CashierSimulation() {
  const { isAdminUser } = useAuth();
  const { data: products = [] } = useProducts();

  const [cart, setCart] = useState<SimCartItem[]>([]);
  const [tableNumber, setTableNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sales, setSales] = useState<SimSale[]>([]);
  const [ticketSales, setTicketSales] = useState<SimTicketSale[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTickets, setShowTickets] = useState(false);

  // Ticket fields
  const [ticketEventName, setTicketEventName] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketQty, setTicketQty] = useState('1');

  // Payment dialog — now supports table-grouped payment
  const [payDialog, setPayDialog] = useState<string | null>(null); // sale id or "table:XXX"
  const [payMethod, setPayMethod] = useState('cash');
  const [payCash, setPayCash] = useState('');
  const [payQr, setPayQr] = useState('');
  const [payTransfer, setPayTransfer] = useState('');

  // Quick-pay dialog (for cobrar directly from cart)
  const [quickPayOpen, setQuickPayOpen] = useState(false);
  const [quickPayMethod, setQuickPayMethod] = useState('cash');
  const [quickCash, setQuickCash] = useState('');
  const [quickQr, setQuickQr] = useState('');
  const [quickTransfer, setQuickTransfer] = useState('');

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

  // Group by category for display
  const groupedProducts = useMemo(() => {
    if (categoryFilter !== 'all') return { [categoryFilter]: filteredProducts };
    const groups: Record<string, typeof filteredProducts> = {};
    filteredProducts.forEach(p => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, [filteredProducts, categoryFilter]);

  const addToCart = useCallback((product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.salePrice, quantity: 1 }];
    });
  }, []);

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? i : { ...i, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(i => i.productId !== productId));

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const createSale = (status: 'cobrado' | 'no_cobrado', method?: string, cash?: number, qr?: number, transfer?: number) => {
    if (cart.length === 0) return;
    const sale: SimSale = {
      id: crypto.randomUUID(),
      items: [...cart],
      total: cartTotal,
      tableNumber: tableNumber || 'S/M',
      paymentStatus: status,
      paymentMethod: method,
      cashAmount: cash,
      qrAmount: qr,
      transferAmount: transfer,
      createdAt: new Date(),
    };
    setSales(prev => [sale, ...prev]);
    setCart([]);
    // Keep tableNumber so it accumulates across sales
    toast.success(status === 'cobrado' ? '✅ Venta cobrada' : '⏳ Venta pendiente');
  };

  const quickPay = () => {
    if (cart.length === 0) return;
    if (quickPayMethod === 'mixed') {
      const c = parseFloat(quickCash) || 0;
      const q = parseFloat(quickQr) || 0;
      const t = parseFloat(quickTransfer) || 0;
      if (Math.abs(c + q + t - cartTotal) > 0.01) {
        toast.error('El total no coincide');
        return;
      }
      createSale('cobrado', 'mixed', c, q, t);
    } else {
      createSale('cobrado', quickPayMethod, quickPayMethod === 'cash' ? cartTotal : 0, quickPayMethod === 'qr' ? cartTotal : 0, quickPayMethod === 'transfer' ? cartTotal : 0);
    }
    setQuickPayOpen(false);
    setQuickPayMethod('cash');
    setQuickCash(''); setQuickQr(''); setQuickTransfer('');
  };

  const collectPayment = () => {
    if (!payDialog) return;
    const targetSales = getPayDialogSales();
    const totalToPay = getPayDialogTotal();
    if (targetSales.length === 0) return;

    const cash = parseFloat(payCash) || 0;
    const qr = parseFloat(payQr) || 0;
    const transfer = parseFloat(payTransfer) || 0;
    if (payMethod === 'mixed' && Math.abs(cash + qr + transfer - totalToPay) > 0.01) {
      toast.error('El total no coincide');
      return;
    }

    const saleIds = new Set(targetSales.map(s => s.id));
    setSales(prev => prev.map(s => {
      if (!saleIds.has(s.id)) return s;
      // Distribute proportionally for mixed, or assign method
      const ratio = s.total / totalToPay;
      return {
        ...s, paymentStatus: 'cobrado' as const, paymentMethod: payMethod,
        cashAmount: payMethod === 'mixed' ? Math.round(cash * ratio * 100) / 100 : payMethod === 'cash' ? s.total : 0,
        qrAmount: payMethod === 'mixed' ? Math.round(qr * ratio * 100) / 100 : payMethod === 'qr' ? s.total : 0,
        transferAmount: payMethod === 'mixed' ? Math.round(transfer * ratio * 100) / 100 : payMethod === 'transfer' ? s.total : 0,
      };
    }));
    setPayDialog(null);
    setPayMethod('cash'); setPayCash(''); setPayQr(''); setPayTransfer('');
    toast.success(`✅ ${targetSales.length > 1 ? `${targetSales.length} ventas cobradas` : 'Cobro registrado'}`);
  };

  const createTicketSale = () => {
    if (!ticketEventName || !ticketPrice) return;
    const qty = parseInt(ticketQty) || 1;
    const price = parseFloat(ticketPrice) || 0;
    setTicketSales(prev => [{ id: crypto.randomUUID(), eventName: ticketEventName, quantity: qty, priceEach: price, total: qty * price, createdAt: new Date() }, ...prev]);
    setTicketQty('1');
    toast.success(`🎫 ${qty} entrada(s) registrada(s)`);
  };

  const totalCollected = sales.filter(s => s.paymentStatus === 'cobrado').reduce((sum, s) => sum + s.total, 0);
  const totalPending = sales.filter(s => s.paymentStatus === 'no_cobrado').reduce((sum, s) => sum + s.total, 0);
  const totalCash = sales.filter(s => s.paymentStatus === 'cobrado').reduce((sum, s) => sum + (s.cashAmount || 0), 0);
  const totalDigital = sales.filter(s => s.paymentStatus === 'cobrado').reduce((sum, s) => sum + (s.qrAmount || 0) + (s.transferAmount || 0), 0);
  const totalTickets = ticketSales.reduce((sum, s) => sum + s.total, 0);
  const pendingSales = sales.filter(s => s.paymentStatus === 'no_cobrado');

  // Group pending by table
  const pendingByTable = useMemo(() => {
    const groups: Record<string, SimSale[]> = {};
    pendingSales.forEach(s => {
      const key = s.tableNumber || 'S/M';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [pendingSales]);

  // Get total for pay dialog (single sale or table group)
  const getPayDialogTotal = (): number => {
    if (!payDialog) return 0;
    if (payDialog.startsWith('table:')) {
      const table = payDialog.replace('table:', '');
      return (pendingByTable[table] || []).reduce((sum, s) => sum + s.total, 0);
    }
    return sales.find(s => s.id === payDialog)?.total || 0;
  };

  const getPayDialogSales = (): SimSale[] => {
    if (!payDialog) return [];
    if (payDialog.startsWith('table:')) {
      const table = payDialog.replace('table:', '');
      return pendingByTable[table] || [];
    }
    const sale = sales.find(s => s.id === payDialog);
    return sale ? [sale] : [];
  };

  const resetAll = () => {
    setSales([]); setTicketSales([]); setCart([]); setTableNumber('');
    toast.success('Simulación reiniciada');
  };

  if (!isAdminUser()) {
    return <Layout><div className="flex items-center justify-center h-[60vh]"><p className="text-muted-foreground">Sin acceso.</p></div></Layout>;
  }

  return (
    <Layout>
      {/* Compact header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <FlaskConical className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Simulación de Caja</h1>
            <p className="text-xs text-muted-foreground">Sin impacto en datos reales</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={resetAll}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        {[
          { label: 'Cobrado', value: totalCollected, color: 'text-green-600' },
          { label: 'Pendiente', value: totalPending, color: 'text-yellow-600' },
          { label: 'Efectivo', value: totalCash, color: 'text-foreground' },
          { label: 'Digital', value: totalDigital, color: 'text-foreground' },
          { label: 'Entradas', value: totalTickets, color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border bg-card p-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={cn('text-sm font-bold', s.color)}>${s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Main POS layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3" style={{ height: 'calc(100vh - 240px)' }}>
        
        {/* LEFT: Product grid */}
        <div className="lg:col-span-7 flex flex-col min-h-0">
          {/* Search + categories */}
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>
          </div>
          {/* Category pills */}
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter('all')}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                categoryFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border hover:bg-muted'
              )}
            >Todo</button>
            {Object.entries(CAT_LABELS).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setCategoryFilter(k)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                  categoryFilter === k ? CAT_COLORS[k] : 'bg-muted/50 border-border hover:bg-muted'
                )}
              >{v}</button>
            ))}
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-3 pr-2">
              {Object.entries(groupedProducts).map(([cat, prods]) => (
                <div key={cat}>
                  {categoryFilter === 'all' && (
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{CAT_LABELS[cat] || cat}</p>
                  )}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {prods.map(p => (
                      <button
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className={cn(
                          'p-2.5 rounded-lg border transition-all text-left hover:scale-[1.02] active:scale-95',
                          'hover:border-primary/50 hover:shadow-sm',
                          cart.find(c => c.productId === p.id) && 'border-primary/60 bg-primary/5'
                        )}
                      >
                        <p className="text-xs font-medium leading-tight truncate">{p.name}</p>
                        <p className="text-sm font-bold text-primary mt-0.5">${p.salePrice.toLocaleString()}</p>
                        {cart.find(c => c.productId === p.id) && (
                          <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1.5">
                            ×{cart.find(c => c.productId === p.id)!.quantity}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT: Cart + actions */}
        <div className="lg:col-span-5 flex flex-col min-h-0 gap-2">
          {/* Cart */}
          <Card className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Carrito</span>
                {cartCount > 0 && <Badge variant="secondary" className="text-xs">{cartCount}</Badge>}
              </div>
              <Input placeholder="Mesa" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-20 h-7 text-xs text-center" />
            </div>
            <ScrollArea className="flex-1 px-3 min-h-0">
              {cart.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10">Tocá un producto para agregar</p>
              ) : (
                <div className="space-y-1 py-1">
                  {cart.map(item => (
                    <div key={item.productId} className="flex items-center gap-1.5 py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground">${item.price} × {item.quantity}</p>
                      </div>
                      <span className="text-xs font-bold w-14 text-right">${(item.price * item.quantity).toLocaleString()}</span>
                      <div className="flex items-center">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCartQty(item.productId, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-xs w-4 text-center font-medium">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCartQty(item.productId, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(item.productId)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="border-t px-3 py-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">${cartTotal.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="outline" size="sm" disabled={cart.length === 0} onClick={() => createSale('no_cobrado')} className="text-xs">
                  <Clock className="w-3.5 h-3.5 mr-1" /> Pendiente
                </Button>
                <Button size="sm" disabled={cart.length === 0} onClick={() => setQuickPayOpen(true)} className="text-xs">
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Cobrar
                </Button>
              </div>
            </div>
          </Card>

          {/* Pending sales quick view */}
          {pendingSales.length > 0 && (
            <Card className="shrink-0">
              <div className="px-3 py-2 flex items-center justify-between cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-yellow-600" />
                  <span className="text-xs font-semibold">Pendientes ({pendingSales.length})</span>
                </div>
                {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
              {showHistory && (
                <div className="px-3 pb-2 space-y-2 max-h-52 overflow-y-auto">
                  {Object.entries(pendingByTable).map(([table, tableSales]) => {
                    const tableTotal = tableSales.reduce((sum, s) => sum + s.total, 0);
                    return (
                      <div key={table} className="rounded-lg border bg-muted/20 p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{table}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-primary">${tableTotal.toLocaleString()}</span>
                            <Button size="sm" variant="default" className="h-6 text-[10px] px-2" onClick={() => { setPayDialog(`table:${table}`); setPayMethod('cash'); }}>
                              Cobrar todo
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          {tableSales.map(s => (
                            <div key={s.id} className="flex justify-between text-[11px] text-muted-foreground">
                              <span>{s.createdAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · {s.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</span>
                              <span className="font-medium text-foreground">${s.total.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Tickets toggle */}
          <Card className="shrink-0">
            <div className="px-3 py-2 flex items-center justify-between cursor-pointer" onClick={() => setShowTickets(!showTickets)}>
              <div className="flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-xs font-semibold">Entradas</span>
                {ticketSales.length > 0 && <Badge variant="secondary" className="text-[10px] h-4">{ticketSales.length}</Badge>}
              </div>
              {showTickets ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
            {showTickets && (
              <div className="px-3 pb-2 space-y-2">
                <div className="flex gap-1.5">
                  <Input placeholder="Evento" value={ticketEventName} onChange={e => setTicketEventName(e.target.value)} className="h-7 text-xs" />
                  <Input type="number" placeholder="$" value={ticketPrice} onChange={e => setTicketPrice(e.target.value)} className="h-7 text-xs w-16" />
                  <Input type="number" value={ticketQty} onChange={e => setTicketQty(e.target.value)} min="1" className="h-7 text-xs w-12" />
                  <Button size="sm" className="h-7 px-2 text-xs shrink-0" disabled={!ticketEventName || !ticketPrice} onClick={createTicketSale}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                {ticketSales.length > 0 && (
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {ticketSales.map(t => (
                      <div key={t.id} className="flex justify-between text-xs p-1 rounded bg-muted/30">
                        <span>{t.eventName} ({t.quantity}×${t.priceEach})</span>
                        <span className="font-bold">${t.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Full history button */}
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setShowHistory(!showHistory)}>
            <Receipt className="w-3.5 h-3.5 mr-1" /> {sales.length} ventas totales
          </Button>
        </div>
      </div>

      {/* Quick Pay Dialog */}
      <Dialog open={quickPayOpen} onOpenChange={setQuickPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cobrar ${cartTotal.toLocaleString()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { v: 'cash', icon: DollarSign, label: 'Efect.', color: 'text-green-600' },
                { v: 'qr', icon: Smartphone, label: 'QR', color: 'text-blue-600' },
                { v: 'transfer', icon: CreditCard, label: 'Transf.', color: 'text-purple-600' },
                { v: 'mixed', icon: Receipt, label: 'Combi.', color: 'text-foreground' },
              ].map(m => (
                <button
                  key={m.v}
                  onClick={() => setQuickPayMethod(m.v)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-3 rounded-lg border transition-all',
                    quickPayMethod === m.v ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                  )}
                >
                  <m.icon className={cn('w-5 h-5', m.color)} />
                  <span className="text-[10px] font-medium">{m.label}</span>
                </button>
              ))}
            </div>
            {quickPayMethod === 'mixed' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600 shrink-0" />
                  <Input type="number" placeholder="Efectivo" value={quickCash} onChange={e => setQuickCash(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                  <Input type="number" placeholder="QR" value={quickQr} onChange={e => setQuickQr(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
                  <Input type="number" placeholder="Transferencia" value={quickTransfer} onChange={e => setQuickTransfer(e.target.value)} className="h-8 text-sm" />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Suma: ${((parseFloat(quickCash) || 0) + (parseFloat(quickQr) || 0) + (parseFloat(quickTransfer) || 0)).toLocaleString()} / ${cartTotal.toLocaleString()}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickPayOpen(false)}>Cancelar</Button>
            <Button onClick={quickPay}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collect pending payment dialog */}
      <Dialog open={!!payDialog} onOpenChange={open => !open && setPayDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cobrar Venta Pendiente</DialogTitle>
          </DialogHeader>
          {payDialog && (() => {
            const sale = sales.find(s => s.id === payDialog);
            if (!sale) return null;
            return (
              <div className="space-y-3">
                <p className="text-center text-2xl font-bold">${sale.total.toLocaleString()}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { v: 'cash', icon: DollarSign, label: 'Efect.' },
                    { v: 'qr', icon: Smartphone, label: 'QR' },
                    { v: 'transfer', icon: CreditCard, label: 'Transf.' },
                    { v: 'mixed', icon: Receipt, label: 'Combi.' },
                  ].map(m => (
                    <button
                      key={m.v}
                      onClick={() => setPayMethod(m.v)}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all text-xs',
                        payMethod === m.v ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                      )}
                    >
                      <m.icon className="w-4 h-4" />
                      <span className="text-[10px]">{m.label}</span>
                    </button>
                  ))}
                </div>
                {payMethod === 'mixed' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-600 shrink-0" />
                      <Input type="number" placeholder="Efectivo" value={payCash} onChange={e => setPayCash(e.target.value)} className="h-8" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                      <Input type="number" placeholder="QR" value={payQr} onChange={e => setPayQr(e.target.value)} className="h-8" />
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
                      <Input type="number" placeholder="Transferencia" value={payTransfer} onChange={e => setPayTransfer(e.target.value)} className="h-8" />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Suma: ${((parseFloat(payCash) || 0) + (parseFloat(payQr) || 0) + (parseFloat(payTransfer) || 0)).toLocaleString()} / ${sale.total.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancelar</Button>
            <Button onClick={collectPayment}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
