import { useState, useMemo, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  FlaskConical, Plus, Minus, Trash2, ShoppingCart, DollarSign, CreditCard, Smartphone,
  CheckCircle, Clock, RotateCcw, Ticket, Search, Receipt, X, ChevronDown, ChevronUp,
  Pencil, History, Eye
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
  drinks: 'Bebidas', cocktails: 'Tragos', food: 'Comida',
  supplies: 'Insumos', others: 'Otros', semi_elaborated: 'Semi-elab.',
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
  const [showTickets, setShowTickets] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Ticket fields
  const [ticketEventName, setTicketEventName] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketQty, setTicketQty] = useState('1');

  // Payment dialog (for pending sales)
  const [payDialog, setPayDialog] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [payCash, setPayCash] = useState('');
  const [payQr, setPayQr] = useState('');
  const [payTransfer, setPayTransfer] = useState('');

  // Quick-pay dialog
  const [quickPayOpen, setQuickPayOpen] = useState(false);
  const [quickPayMethod, setQuickPayMethod] = useState('cash');
  const [quickCash, setQuickCash] = useState('');
  const [quickQr, setQuickQr] = useState('');
  const [quickTransfer, setQuickTransfer] = useState('');

  // Edit sale dialog
  const [editingSale, setEditingSale] = useState<SimSale | null>(null);
  const [editItems, setEditItems] = useState<SimCartItem[]>([]);
  const [editTable, setEditTable] = useState('');
  const [editStatus, setEditStatus] = useState<'cobrado' | 'no_cobrado'>('no_cobrado');
  const [editMethod, setEditMethod] = useState('cash');
  const [editCash, setEditCash] = useState('');
  const [editQr, setEditQr] = useState('');
  const [editTransfer, setEditTransfer] = useState('');

  // View sale detail
  const [viewSale, setViewSale] = useState<SimSale | null>(null);

  const saleProducts = useMemo(() => products.filter(p => (p as any).is_for_sale !== false), [products]);

  const filteredProducts = useMemo(() => {
    return saleProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [saleProducts, searchTerm, categoryFilter]);

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
      if (existing) return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
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
      cashAmount: cash, qrAmount: qr, transferAmount: transfer,
      createdAt: new Date(),
    };
    setSales(prev => [sale, ...prev]);
    setCart([]);
    // Only keep tableNumber if it was explicitly set (not empty)
    if (!tableNumber.trim()) {
      setTableNumber('');
    }
    toast.success(status === 'cobrado' ? '✅ Venta cobrada' : '⏳ Venta pendiente');
  };

  const quickPay = () => {
    if (cart.length === 0) return;
    if (quickPayMethod === 'mixed') {
      const c = parseFloat(quickCash) || 0, q = parseFloat(quickQr) || 0, t = parseFloat(quickTransfer) || 0;
      if (Math.abs(c + q + t - cartTotal) > 0.01) { toast.error('El total no coincide'); return; }
      createSale('cobrado', 'mixed', c, q, t);
    } else {
      createSale('cobrado', quickPayMethod, quickPayMethod === 'cash' ? cartTotal : 0, quickPayMethod === 'qr' ? cartTotal : 0, quickPayMethod === 'transfer' ? cartTotal : 0);
    }
    setQuickPayOpen(false);
    setQuickPayMethod('cash'); setQuickCash(''); setQuickQr(''); setQuickTransfer('');
  };

  const collectPayment = () => {
    if (!payDialog) return;
    const sale = sales.find(s => s.id === payDialog);
    if (!sale) return;
    const cash = parseFloat(payCash) || 0, qr = parseFloat(payQr) || 0, transfer = parseFloat(payTransfer) || 0;
    if (payMethod === 'mixed' && Math.abs(cash + qr + transfer - sale.total) > 0.01) { toast.error('El total no coincide'); return; }
    setSales(prev => prev.map(s => s.id === payDialog ? {
      ...s, paymentStatus: 'cobrado', paymentMethod: payMethod,
      cashAmount: payMethod === 'mixed' ? cash : payMethod === 'cash' ? sale.total : 0,
      qrAmount: payMethod === 'mixed' ? qr : payMethod === 'qr' ? sale.total : 0,
      transferAmount: payMethod === 'mixed' ? transfer : payMethod === 'transfer' ? sale.total : 0,
    } : s));
    setPayDialog(null);
    setPayMethod('cash'); setPayCash(''); setPayQr(''); setPayTransfer('');
    toast.success('✅ Cobro registrado');
  };

  // Edit sale
  const openEditSale = (sale: SimSale) => {
    setEditingSale(sale);
    setEditItems([...sale.items]);
    setEditTable(sale.tableNumber === 'S/M' ? '' : sale.tableNumber);
    setEditStatus(sale.paymentStatus);
    setEditMethod(sale.paymentMethod || 'cash');
    setEditCash(String(sale.cashAmount || ''));
    setEditQr(String(sale.qrAmount || ''));
    setEditTransfer(String(sale.transferAmount || ''));
  };

  const updateEditItemQty = (productId: string, delta: number) => {
    setEditItems(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? i : { ...i, quantity: newQty };
    }));
  };

  const removeEditItem = (productId: string) => setEditItems(prev => prev.filter(i => i.productId !== productId));

  const addProductToEdit = (product: any) => {
    setEditItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: product.id, name: product.name, price: product.salePrice, quantity: 1 }];
    });
  };

  const saveEditSale = () => {
    if (!editingSale || editItems.length === 0) return;
    const newTotal = editItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    setSales(prev => prev.map(s => s.id === editingSale.id ? {
      ...s,
      items: [...editItems],
      total: newTotal,
      tableNumber: editTable.trim() || 'S/M',
      paymentStatus: editStatus,
      paymentMethod: editStatus === 'cobrado' ? editMethod : undefined,
      cashAmount: editStatus === 'cobrado' ? (editMethod === 'mixed' ? parseFloat(editCash) || 0 : editMethod === 'cash' ? newTotal : 0) : undefined,
      qrAmount: editStatus === 'cobrado' ? (editMethod === 'mixed' ? parseFloat(editQr) || 0 : editMethod === 'qr' ? newTotal : 0) : undefined,
      transferAmount: editStatus === 'cobrado' ? (editMethod === 'mixed' ? parseFloat(editTransfer) || 0 : editMethod === 'transfer' ? newTotal : 0) : undefined,
    } : s));
    setEditingSale(null);
    toast.success('✏️ Venta editada');
  };

  const deleteSale = (id: string) => {
    setSales(prev => prev.filter(s => s.id !== id));
    toast.success('🗑️ Venta eliminada');
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

  const resetAll = () => { setSales([]); setTicketSales([]); setCart([]); setTableNumber(''); toast.success('Simulación reiniciada'); };

  const editTotal = editItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Search for adding products inside edit dialog
  const [editSearchTerm, setEditSearchTerm] = useState('');
  const editFilteredProducts = useMemo(() => {
    if (!editSearchTerm.trim()) return [];
    return saleProducts.filter(p => p.name.toLowerCase().includes(editSearchTerm.toLowerCase())).slice(0, 6);
  }, [saleProducts, editSearchTerm]);

  if (!isAdminUser()) {
    return <Layout><div className="flex items-center justify-center h-[60vh]"><p className="text-muted-foreground">Sin acceso.</p></div></Layout>;
  }

  const PayMethodSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="grid grid-cols-4 gap-1.5">
      {[
        { v: 'cash', icon: DollarSign, label: 'Efect.', color: 'text-green-600' },
        { v: 'qr', icon: Smartphone, label: 'QR', color: 'text-blue-600' },
        { v: 'transfer', icon: CreditCard, label: 'Transf.', color: 'text-purple-600' },
        { v: 'mixed', icon: Receipt, label: 'Combi.', color: 'text-foreground' },
      ].map(m => (
        <button key={m.v} onClick={() => onChange(m.v)} className={cn(
          'flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all',
          value === m.v ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
        )}>
          <m.icon className={cn('w-4 h-4', m.color)} />
          <span className="text-[10px] font-medium">{m.label}</span>
        </button>
      ))}
    </div>
  );

  const MixedInputs = ({ cash, qr, transfer, onCash, onQr, onTransfer, total }: any) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-green-600 shrink-0" />
        <Input type="number" placeholder="Efectivo" value={cash} onChange={e => onCash(e.target.value)} className="h-8 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
        <Input type="number" placeholder="QR" value={qr} onChange={e => onQr(e.target.value)} className="h-8 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
        <Input type="number" placeholder="Transferencia" value={transfer} onChange={e => onTransfer(e.target.value)} className="h-8 text-sm" />
      </div>
      <p className="text-xs text-center text-muted-foreground">
        Suma: ${((parseFloat(cash) || 0) + (parseFloat(qr) || 0) + (parseFloat(transfer) || 0)).toLocaleString()} / ${total.toLocaleString()}
      </p>
    </div>
  );

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/10"><FlaskConical className="w-5 h-5 text-amber-500" /></div>
          <div>
            <h1 className="text-lg font-bold">Simulación de Caja</h1>
            <p className="text-xs text-muted-foreground">Sin impacto en datos reales</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFullHistory(true)}>
            <History className="w-3.5 h-3.5 mr-1" /> Historial ({sales.length})
          </Button>
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* Stats */}
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

      {/* POS layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3" style={{ height: 'calc(100vh - 240px)' }}>
        {/* LEFT: Products */}
        <div className="lg:col-span-7 flex flex-col min-h-0">
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>
          </div>
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <button onClick={() => setCategoryFilter('all')} className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-all',
              categoryFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border hover:bg-muted'
            )}>Todo</button>
            {Object.entries(CAT_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => setCategoryFilter(k)} className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                categoryFilter === k ? CAT_COLORS[k] : 'bg-muted/50 border-border hover:bg-muted'
              )}>{v}</button>
            ))}
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-3 pr-2">
              {Object.entries(groupedProducts).map(([cat, prods]) => (
                <div key={cat}>
                  {categoryFilter === 'all' && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{CAT_LABELS[cat] || cat}</p>}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {prods.map(p => (
                      <button key={p.id} onClick={() => addToCart(p)} className={cn(
                        'p-2.5 rounded-lg border transition-all text-left hover:scale-[1.02] active:scale-95 hover:border-primary/50 hover:shadow-sm',
                        cart.find(c => c.productId === p.id) && 'border-primary/60 bg-primary/5'
                      )}>
                        <p className="text-xs font-medium leading-tight truncate">{p.name}</p>
                        <p className="text-sm font-bold text-primary mt-0.5">${p.salePrice.toLocaleString()}</p>
                        {cart.find(c => c.productId === p.id) && (
                          <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1.5">×{cart.find(c => c.productId === p.id)!.quantity}</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT: Cart + panels */}
        <div className="lg:col-span-5 flex flex-col min-h-0 gap-2">
          <Card className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Carrito</span>
                {cartCount > 0 && <Badge variant="secondary" className="text-xs">{cartCount}</Badge>}
              </div>
              <Input placeholder="Mesa / Desc." value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-28 h-7 text-xs text-center" />
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
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCartQty(item.productId, -1)}><Minus className="w-3 h-3" /></Button>
                        <span className="text-xs w-4 text-center font-medium">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCartQty(item.productId, 1)}><Plus className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(item.productId)}><X className="w-3 h-3" /></Button>
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

          {/* Pending sales */}
          {pendingSales.length > 0 && (
            <Card className="shrink-0">
              <div className="px-3 py-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-yellow-600" />
                  <span className="text-xs font-semibold">Pendientes ({pendingSales.length})</span>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {pendingSales.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-1.5 rounded bg-muted/30 text-xs">
                      <div>
                        <span className="font-medium">{s.tableNumber}</span>
                        <span className="text-muted-foreground ml-1">{s.createdAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold">${s.total.toLocaleString()}</span>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEditSale(s)}><Pencil className="w-3 h-3" /></Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => { setPayDialog(s.id); setPayMethod('cash'); }}>Cobrar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Tickets */}
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
        </div>
      </div>

      {/* Quick Pay Dialog */}
      <Dialog open={quickPayOpen} onOpenChange={setQuickPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cobrar ${cartTotal.toLocaleString()}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <PayMethodSelector value={quickPayMethod} onChange={setQuickPayMethod} />
            {quickPayMethod === 'mixed' && (
              <MixedInputs cash={quickCash} qr={quickQr} transfer={quickTransfer} onCash={setQuickCash} onQr={setQuickQr} onTransfer={setQuickTransfer} total={cartTotal} />
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
          <DialogHeader><DialogTitle>Cobrar Venta Pendiente</DialogTitle></DialogHeader>
          {payDialog && (() => {
            const sale = sales.find(s => s.id === payDialog);
            if (!sale) return null;
            return (
              <div className="space-y-3">
                <p className="text-center text-2xl font-bold">${sale.total.toLocaleString()}</p>
                <PayMethodSelector value={payMethod} onChange={setPayMethod} />
                {payMethod === 'mixed' && (
                  <MixedInputs cash={payCash} qr={payQr} transfer={payTransfer} onCash={setPayCash} onQr={setPayQr} onTransfer={setPayTransfer} total={sale.total} />
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

      {/* Full History Dialog */}
      <Dialog open={showFullHistory} onOpenChange={setShowFullHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Historial Completo ({sales.length} ventas)</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {sales.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">No hay ventas registradas</p>
            ) : (
              <div className="space-y-2 pr-2">
                {sales.map(s => (
                  <div key={s.id} className={cn(
                    'rounded-lg border p-3 transition-all',
                    s.paymentStatus === 'cobrado' ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={s.paymentStatus === 'cobrado' ? 'default' : 'secondary'} className="text-[10px]">
                          {s.paymentStatus === 'cobrado' ? '✅ Cobrado' : '⏳ Pendiente'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{s.tableNumber}</span>
                        <span className="text-xs text-muted-foreground">{s.createdAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-sm">${s.total.toLocaleString()}</span>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setViewSale(s)}><Eye className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setShowFullHistory(false); openEditSale(s); }}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteSale(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {s.items.map((item, idx) => (
                        <span key={idx} className="text-[11px] bg-muted/50 rounded px-1.5 py-0.5">{item.name} ×{item.quantity}</span>
                      ))}
                    </div>
                    {s.paymentMethod && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {s.paymentMethod === 'cash' ? 'Efectivo' : s.paymentMethod === 'qr' ? 'QR' : s.paymentMethod === 'transfer' ? 'Transferencia' : `Efectivo $${s.cashAmount || 0} | QR $${s.qrAmount || 0} | Transf. $${s.transferAmount || 0}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* View Sale Detail */}
      <Dialog open={!!viewSale} onOpenChange={open => !open && setViewSale(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Detalle de Venta</DialogTitle></DialogHeader>
          {viewSale && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Mesa / Desc.</span>
                <span className="font-medium">{viewSale.tableNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hora</span>
                <span>{viewSale.createdAt.toLocaleTimeString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant={viewSale.paymentStatus === 'cobrado' ? 'default' : 'secondary'}>
                  {viewSale.paymentStatus === 'cobrado' ? 'Cobrado' : 'Pendiente'}
                </Badge>
              </div>
              <div className="border rounded-lg p-2 space-y-1">
                {viewSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span>{item.name} ×{item.quantity}</span>
                    <span className="font-medium">${(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t pt-1 flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span>${viewSale.total.toLocaleString()}</span>
                </div>
              </div>
              {viewSale.paymentMethod && (
                <div className="text-xs text-muted-foreground">
                  Método: {viewSale.paymentMethod === 'mixed'
                    ? `Efectivo $${viewSale.cashAmount || 0} | QR $${viewSale.qrAmount || 0} | Transf. $${viewSale.transferAmount || 0}`
                    : viewSale.paymentMethod === 'cash' ? 'Efectivo' : viewSale.paymentMethod === 'qr' ? 'QR' : 'Transferencia'}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Sale Dialog */}
      <Dialog open={!!editingSale} onOpenChange={open => !open && setEditingSale(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" /> Editar Venta</DialogTitle></DialogHeader>
          {editingSale && (
            <div className="space-y-4">
              {/* Table */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Mesa / Descripción</label>
                <Input value={editTable} onChange={e => setEditTable(e.target.value)} className="h-8 text-sm mt-1" placeholder="Sin mesa" />
              </div>

              {/* Items */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Productos</label>
                <div className="space-y-1 border rounded-lg p-2">
                  {editItems.map(item => (
                    <div key={item.productId} className="flex items-center gap-1.5 py-1 border-b border-border/30 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">${item.price} c/u</p>
                      </div>
                      <span className="text-xs font-bold w-12 text-right">${(item.price * item.quantity).toLocaleString()}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateEditItemQty(item.productId, -1)}><Minus className="w-3 h-3" /></Button>
                      <span className="text-xs w-4 text-center">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateEditItemQty(item.productId, 1)}><Plus className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeEditItem(item.productId)}><X className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
                {/* Add product search */}
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Agregar producto..." value={editSearchTerm} onChange={e => setEditSearchTerm(e.target.value)} className="pl-7 h-7 text-xs" />
                </div>
                {editFilteredProducts.length > 0 && (
                  <div className="border rounded-lg mt-1 max-h-28 overflow-y-auto">
                    {editFilteredProducts.map(p => (
                      <button key={p.id} onClick={() => { addProductToEdit(p); setEditSearchTerm(''); }}
                        className="w-full flex justify-between items-center px-2 py-1.5 text-xs hover:bg-muted/50 border-b last:border-0">
                        <span>{p.name}</span>
                        <span className="font-medium text-primary">${p.salePrice}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex justify-between mt-2 text-sm font-bold">
                  <span>Total</span>
                  <span className="text-primary">${editTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Estado</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setEditStatus('no_cobrado')} className={cn(
                    'p-2 rounded-lg border text-xs font-medium transition-all',
                    editStatus === 'no_cobrado' ? 'border-yellow-500 bg-yellow-500/10' : 'border-border hover:bg-muted'
                  )}>⏳ Pendiente</button>
                  <button onClick={() => setEditStatus('cobrado')} className={cn(
                    'p-2 rounded-lg border text-xs font-medium transition-all',
                    editStatus === 'cobrado' ? 'border-green-500 bg-green-500/10' : 'border-border hover:bg-muted'
                  )}>✅ Cobrado</button>
                </div>
              </div>

              {/* Payment method if cobrado */}
              {editStatus === 'cobrado' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Método de pago</label>
                  <PayMethodSelector value={editMethod} onChange={setEditMethod} />
                  {editMethod === 'mixed' && (
                    <div className="mt-2">
                      <MixedInputs cash={editCash} qr={editQr} transfer={editTransfer} onCash={setEditCash} onQr={setEditQr} onTransfer={setEditTransfer} total={editTotal} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="destructive" size="sm" onClick={() => { if (editingSale) { deleteSale(editingSale.id); setEditingSale(null); } }}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setEditingSale(null)}>Cancelar</Button>
            <Button onClick={saveEditSale} disabled={editItems.length === 0}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
