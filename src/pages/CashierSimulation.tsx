import { useState, useMemo, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  FlaskConical, Plus, Minus, Trash2, ShoppingCart, DollarSign, CreditCard, Smartphone,
  CheckCircle, Clock, RotateCcw, Ticket, Search, Receipt, X, ChevronDown, ChevronUp,
  Pencil, History, Eye, Moon, Sun, BarChart3, TrendingUp, Package
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────

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
  surcharge: number; // 15% surcharge for digital
  finalTotal: number; // total + surcharge
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

interface NightSession {
  id: string;
  openedAt: Date;
  closedAt: Date | null;
  sales: SimSale[];
  ticketSales: SimTicketSale[];
}

const SURCHARGE_RATE = 0.15;

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

// ── Helpers ──────────────────────────────────────────────

const calcSurcharge = (method: string, baseTotal: number, cashAmt?: number): number => {
  if (method === 'qr' || method === 'transfer') return Math.round(baseTotal * SURCHARGE_RATE * 100) / 100;
  if (method === 'mixed') {
    const digitalPortion = baseTotal - (cashAmt || 0);
    return digitalPortion > 0 ? Math.round(digitalPortion * SURCHARGE_RATE * 100) / 100 : 0;
  }
  return 0;
};

const getSessionStats = (session: NightSession) => {
  const s = session.sales;
  const collected = s.filter(x => x.paymentStatus === 'cobrado');
  const pending = s.filter(x => x.paymentStatus === 'no_cobrado');
  const totalCash = collected.reduce((sum, x) => sum + (x.cashAmount || 0), 0);
  const totalQr = collected.reduce((sum, x) => sum + (x.qrAmount || 0), 0);
  const totalTransfer = collected.reduce((sum, x) => sum + (x.transferAmount || 0), 0);
  const totalSurcharge = s.reduce((sum, x) => sum + x.surcharge, 0);
  const totalCollected = collected.reduce((sum, x) => sum + x.finalTotal, 0);
  const totalPending = pending.reduce((sum, x) => sum + x.finalTotal, 0);
  const totalTickets = session.ticketSales.reduce((sum, x) => sum + x.total, 0);

  // Product ranking
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  s.forEach(sale => sale.items.forEach(item => {
    if (!productMap[item.productId]) productMap[item.productId] = { name: item.name, qty: 0, revenue: 0 };
    productMap[item.productId].qty += item.quantity;
    productMap[item.productId].revenue += item.price * item.quantity;
  }));
  const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty);

  return { totalCash, totalQr, totalTransfer, totalSurcharge, totalCollected, totalPending, totalTickets, topProducts, salesCount: s.length, pendingCount: pending.length };
};

// ── Component ──────────────────────────────────────────────

export default function CashierSimulation() {
  const { isAdminUser } = useAuth();
  const { data: products = [] } = useProducts();

  // Session system
  const [currentSession, setCurrentSession] = useState<NightSession | null>(null);
  const [pastSessions, setPastSessions] = useState<NightSession[]>([]);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [viewingSession, setViewingSession] = useState<NightSession | null>(null);

  const [cart, setCart] = useState<SimCartItem[]>([]);
  const [tableNumber, setTableNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showTickets, setShowTickets] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);

  const [ticketEventName, setTicketEventName] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketQty, setTicketQty] = useState('1');

  // Payment dialogs
  const [payDialog, setPayDialog] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [payCash, setPayCash] = useState('');
  const [payQr, setPayQr] = useState('');
  const [payTransfer, setPayTransfer] = useState('');

  const [quickPayOpen, setQuickPayOpen] = useState(false);
  const [quickPayMethod, setQuickPayMethod] = useState('cash');
  const [quickCash, setQuickCash] = useState('');
  const [quickQr, setQuickQr] = useState('');
  const [quickTransfer, setQuickTransfer] = useState('');

  // Edit sale
  const [editingSale, setEditingSale] = useState<SimSale | null>(null);
  const [editItems, setEditItems] = useState<SimCartItem[]>([]);
  const [editTable, setEditTable] = useState('');
  const [editStatus, setEditStatus] = useState<'cobrado' | 'no_cobrado'>('no_cobrado');
  const [editMethod, setEditMethod] = useState('cash');
  const [editCash, setEditCash] = useState('');
  const [editQr, setEditQr] = useState('');
  const [editTransfer, setEditTransfer] = useState('');
  const [editSearchTerm, setEditSearchTerm] = useState('');

  const [viewSale, setViewSale] = useState<SimSale | null>(null);

  // Derived
  const sales = currentSession?.sales || [];
  const ticketSales = currentSession?.ticketSales || [];

  const setSales = (fn: (prev: SimSale[]) => SimSale[]) => {
    setCurrentSession(prev => prev ? { ...prev, sales: fn(prev.sales) } : prev);
  };
  const setTicketSales = (fn: (prev: SimTicketSale[]) => SimTicketSale[]) => {
    setCurrentSession(prev => prev ? { ...prev, ticketSales: fn(prev.ticketSales) } : prev);
  };

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

  const editFilteredProducts = useMemo(() => {
    if (!editSearchTerm.trim()) return [];
    return saleProducts.filter(p => p.name.toLowerCase().includes(editSearchTerm.toLowerCase())).slice(0, 6);
  }, [saleProducts, editSearchTerm]);

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

  // ── Session management ──

  const openSession = () => {
    const session: NightSession = { id: crypto.randomUUID(), openedAt: new Date(), closedAt: null, sales: [], ticketSales: [] };
    setCurrentSession(session);
    setCart([]); setTableNumber('');
    toast.success('🌙 Noche abierta');
  };

  const closeSession = () => {
    if (!currentSession) return;
    const closed = { ...currentSession, closedAt: new Date() };
    setPastSessions(prev => [closed, ...prev]);
    setCurrentSession(null);
    setCart([]); setTableNumber('');
    toast.success('☀️ Noche cerrada');
  };

  // ── Sale creation with surcharge ──

  const createSale = (status: 'cobrado' | 'no_cobrado', method?: string, cash?: number, qr?: number, transfer?: number) => {
    if (cart.length === 0 || !currentSession) return;
    const surcharge = status === 'cobrado' && method ? calcSurcharge(method, cartTotal, cash) : 0;
    const finalTotal = cartTotal + surcharge;
    const sale: SimSale = {
      id: crypto.randomUUID(),
      items: [...cart],
      total: cartTotal,
      surcharge,
      finalTotal,
      tableNumber: tableNumber || 'S/M',
      paymentStatus: status,
      paymentMethod: method,
      cashAmount: cash, qrAmount: qr, transferAmount: transfer,
      createdAt: new Date(),
    };
    setSales(prev => [sale, ...prev]);
    setCart([]);
    if (!tableNumber.trim()) setTableNumber('');
    toast.success(status === 'cobrado' ? `✅ Cobrado $${finalTotal.toLocaleString()}${surcharge > 0 ? ` (recargo $${surcharge.toLocaleString()})` : ''}` : '⏳ Venta pendiente');
  };

  const quickPay = () => {
    if (cart.length === 0) return;
    const surcharge = calcSurcharge(quickPayMethod, cartTotal, parseFloat(quickCash) || 0);
    const finalTotal = cartTotal + surcharge;
    if (quickPayMethod === 'mixed') {
      const c = parseFloat(quickCash) || 0, q = parseFloat(quickQr) || 0, t = parseFloat(quickTransfer) || 0;
      if (Math.abs(c + q + t - finalTotal) > 0.01) { toast.error(`El total debe ser $${finalTotal.toLocaleString()} (incluye recargo $${surcharge.toLocaleString()})`); return; }
      createSale('cobrado', 'mixed', c, q, t);
    } else {
      createSale('cobrado', quickPayMethod,
        quickPayMethod === 'cash' ? finalTotal : 0,
        quickPayMethod === 'qr' ? finalTotal : 0,
        quickPayMethod === 'transfer' ? finalTotal : 0
      );
    }
    setQuickPayOpen(false);
    setQuickPayMethod('cash'); setQuickCash(''); setQuickQr(''); setQuickTransfer('');
  };

  const collectPayment = () => {
    if (!payDialog) return;
    const sale = sales.find(s => s.id === payDialog);
    if (!sale) return;
    const surcharge = calcSurcharge(payMethod, sale.total, parseFloat(payCash) || 0);
    const finalTotal = sale.total + surcharge;
    const cash = parseFloat(payCash) || 0, qr = parseFloat(payQr) || 0, transfer = parseFloat(payTransfer) || 0;
    if (payMethod === 'mixed' && Math.abs(cash + qr + transfer - finalTotal) > 0.01) {
      toast.error(`El total debe ser $${finalTotal.toLocaleString()} (incluye recargo $${surcharge.toLocaleString()})`);
      return;
    }
    setSales(prev => prev.map(s => s.id === payDialog ? {
      ...s, paymentStatus: 'cobrado', paymentMethod: payMethod, surcharge, finalTotal,
      cashAmount: payMethod === 'mixed' ? cash : payMethod === 'cash' ? finalTotal : 0,
      qrAmount: payMethod === 'mixed' ? qr : payMethod === 'qr' ? finalTotal : 0,
      transferAmount: payMethod === 'mixed' ? transfer : payMethod === 'transfer' ? finalTotal : 0,
    } : s));
    setPayDialog(null);
    setPayMethod('cash'); setPayCash(''); setPayQr(''); setPayTransfer('');
    toast.success(`✅ Cobrado${surcharge > 0 ? ` (recargo $${surcharge.toLocaleString()})` : ''}`);
  };

  // ── Edit sale ──

  const openEditSale = (sale: SimSale) => {
    setEditingSale(sale);
    setEditItems([...sale.items]);
    setEditTable(sale.tableNumber === 'S/M' ? '' : sale.tableNumber);
    setEditStatus(sale.paymentStatus);
    setEditMethod(sale.paymentMethod || 'cash');
    setEditCash(String(sale.cashAmount || ''));
    setEditQr(String(sale.qrAmount || ''));
    setEditTransfer(String(sale.transferAmount || ''));
    setEditSearchTerm('');
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

  const editTotal = editItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const saveEditSale = () => {
    if (!editingSale || editItems.length === 0) return;
    const newTotal = editItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const surcharge = editStatus === 'cobrado' ? calcSurcharge(editMethod, newTotal, parseFloat(editCash) || 0) : 0;
    const finalTotal = newTotal + surcharge;
    setSales(prev => prev.map(s => s.id === editingSale.id ? {
      ...s,
      items: [...editItems],
      total: newTotal,
      surcharge,
      finalTotal,
      tableNumber: editTable.trim() || 'S/M',
      paymentStatus: editStatus,
      paymentMethod: editStatus === 'cobrado' ? editMethod : undefined,
      cashAmount: editStatus === 'cobrado' ? (editMethod === 'mixed' ? parseFloat(editCash) || 0 : editMethod === 'cash' ? finalTotal : 0) : undefined,
      qrAmount: editStatus === 'cobrado' ? (editMethod === 'mixed' ? parseFloat(editQr) || 0 : editMethod === 'qr' ? finalTotal : 0) : undefined,
      transferAmount: editStatus === 'cobrado' ? (editMethod === 'mixed' ? parseFloat(editTransfer) || 0 : editMethod === 'transfer' ? finalTotal : 0) : undefined,
    } : s));
    setEditingSale(null);
    toast.success('✏️ Venta editada');
  };

  const deleteSale = (id: string) => {
    setSales(prev => prev.filter(s => s.id !== id));
    toast.success('🗑️ Venta eliminada');
  };

  const createTicketSale = () => {
    if (!ticketEventName || !ticketPrice || !currentSession) return;
    const qty = parseInt(ticketQty) || 1;
    const price = parseFloat(ticketPrice) || 0;
    setTicketSales(prev => [{ id: crypto.randomUUID(), eventName: ticketEventName, quantity: qty, priceEach: price, total: qty * price, createdAt: new Date() }, ...prev]);
    setTicketQty('1');
    toast.success(`🎫 ${qty} entrada(s)`);
  };

  // Stats for current session
  const currentStats = currentSession ? getSessionStats(currentSession) : null;
  const pendingSales = sales.filter(s => s.paymentStatus === 'no_cobrado');

  // Surcharge preview
  const quickSurcharge = calcSurcharge(quickPayMethod, cartTotal, parseFloat(quickCash) || 0);
  const quickFinalTotal = cartTotal + quickSurcharge;

  if (!isAdminUser()) {
    return <Layout><div className="flex items-center justify-center h-[60vh]"><p className="text-muted-foreground">Sin acceso.</p></div></Layout>;
  }

  // ── No session open → show open/history screen ──

  if (!currentSession) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto py-16 space-y-6 text-center">
          <div className="p-4 rounded-2xl bg-amber-500/10 w-fit mx-auto">
            <Moon className="w-12 h-12 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">Simulación de Caja</h1>
            <p className="text-muted-foreground">Abrí una noche para empezar a registrar ventas de práctica</p>
          </div>
          <Button size="lg" onClick={openSession} className="text-base px-8">
            <Moon className="w-5 h-5 mr-2" /> Abrir Noche
          </Button>

          {pastSessions.length > 0 && (
            <div className="mt-8 text-left">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Noches Anteriores</h2>
              <div className="space-y-2">
                {pastSessions.map(session => {
                  const stats = getSessionStats(session);
                  return (
                    <button key={session.id} onClick={() => setViewingSession(session)}
                      className="w-full rounded-lg border p-3 text-left hover:bg-muted/50 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {session.openedAt.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} — {session.openedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} a {session.closedAt?.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">{stats.salesCount} ventas</Badge>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="text-green-600 font-medium">${stats.totalCollected.toLocaleString()} cobrado</span>
                        {stats.totalPending > 0 && <span className="text-yellow-600">${stats.totalPending.toLocaleString()} pendiente</span>}
                        {stats.totalTickets > 0 && <span className="text-purple-600">${stats.totalTickets.toLocaleString()} entradas</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* View past session */}
        <Dialog open={!!viewingSession} onOpenChange={open => !open && setViewingSession(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {viewingSession && <SessionDetail session={viewingSession} />}
          </DialogContent>
        </Dialog>
      </Layout>
    );
  }

  // ── Reusable sub-components ──

  const PayMethodSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="grid grid-cols-4 gap-1.5">
      {[
        { v: 'cash', icon: DollarSign, label: 'Efect.', color: 'text-green-600', surcharge: false },
        { v: 'qr', icon: Smartphone, label: 'QR +15%', color: 'text-blue-600', surcharge: true },
        { v: 'transfer', icon: CreditCard, label: 'Transf. +15%', color: 'text-purple-600', surcharge: true },
        { v: 'mixed', icon: Receipt, label: 'Combi.', color: 'text-foreground', surcharge: false },
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

  const MixedInputs = ({ cash, qr, transfer, onCash, onQr, onTransfer, total, baseTotal }: any) => {
    const surcharge = calcSurcharge('mixed', baseTotal, parseFloat(cash) || 0);
    const expectedTotal = baseTotal + surcharge;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600 shrink-0" />
          <Input type="number" placeholder="Efectivo (sin recargo)" value={cash} onChange={e => onCash(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
          <Input type="number" placeholder="QR" value={qr} onChange={e => onQr(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
          <Input type="number" placeholder="Transferencia" value={transfer} onChange={e => onTransfer(e.target.value)} className="h-8 text-sm" />
        </div>
        {surcharge > 0 && (
          <p className="text-xs text-amber-600 text-center">Recargo 15% sobre digital: +${surcharge.toLocaleString()}</p>
        )}
        <p className="text-xs text-center text-muted-foreground">
          Suma: ${((parseFloat(cash) || 0) + (parseFloat(qr) || 0) + (parseFloat(transfer) || 0)).toLocaleString()} / Total esperado: ${expectedTotal.toLocaleString()}
        </p>
      </div>
    );
  };

  // ── Main POS View ──

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/10"><Moon className="w-5 h-5 text-amber-500" /></div>
          <div>
            <h1 className="text-lg font-bold">Noche Abierta</h1>
            <p className="text-xs text-muted-foreground">
              Desde {currentSession.openedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} — Sin impacto real
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setShowFullHistory(true)}>
            <History className="w-3.5 h-3.5 mr-1" /> {sales.length}
          </Button>
          <Button variant="destructive" size="sm" onClick={closeSession}>
            <Sun className="w-3.5 h-3.5 mr-1" /> Cerrar Noche
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-1.5 mb-3">
        {[
          { label: 'Cobrado', value: currentStats?.totalCollected || 0, color: 'text-green-600' },
          { label: 'Pendiente', value: currentStats?.totalPending || 0, color: 'text-yellow-600' },
          { label: 'Efectivo', value: currentStats?.totalCash || 0, color: 'text-foreground' },
          { label: 'Digital', value: (currentStats?.totalQr || 0) + (currentStats?.totalTransfer || 0), color: 'text-foreground' },
          { label: 'Recargos', value: currentStats?.totalSurcharge || 0, color: 'text-amber-600' },
          { label: 'Entradas', value: currentStats?.totalTickets || 0, color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border bg-card p-1.5 text-center">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={cn('text-xs font-bold', s.color)}>${s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* POS layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3" style={{ height: 'calc(100vh - 250px)' }}>
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
                <div className="space-y-1 max-h-36 overflow-y-auto">
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
                  <Button size="sm" className="h-7 px-2 text-xs shrink-0" disabled={!ticketEventName || !ticketPrice} onClick={createTicketSale}><Plus className="w-3 h-3" /></Button>
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
          <DialogHeader>
            <DialogTitle>Cobrar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Subtotal: ${cartTotal.toLocaleString()}</p>
              {quickSurcharge > 0 && <p className="text-sm text-amber-600">Recargo 15%: +${quickSurcharge.toLocaleString()}</p>}
              <p className="text-2xl font-bold text-primary">${quickFinalTotal.toLocaleString()}</p>
            </div>
            <PayMethodSelector value={quickPayMethod} onChange={setQuickPayMethod} />
            {quickPayMethod === 'mixed' && (
              <MixedInputs cash={quickCash} qr={quickQr} transfer={quickTransfer} onCash={setQuickCash} onQr={setQuickQr} onTransfer={setQuickTransfer} total={quickFinalTotal} baseTotal={cartTotal} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickPayOpen(false)}>Cancelar</Button>
            <Button onClick={quickPay}>Confirmar ${quickFinalTotal.toLocaleString()}</Button>
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
            const surcharge = calcSurcharge(payMethod, sale.total, parseFloat(payCash) || 0);
            const finalTotal = sale.total + surcharge;
            return (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Subtotal: ${sale.total.toLocaleString()}</p>
                  {surcharge > 0 && <p className="text-sm text-amber-600">Recargo 15%: +${surcharge.toLocaleString()}</p>}
                  <p className="text-2xl font-bold">${finalTotal.toLocaleString()}</p>
                </div>
                <PayMethodSelector value={payMethod} onChange={setPayMethod} />
                {payMethod === 'mixed' && (
                  <MixedInputs cash={payCash} qr={payQr} transfer={payTransfer} onCash={setPayCash} onQr={setPayQr} onTransfer={setPayTransfer} total={finalTotal} baseTotal={sale.total} />
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
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Historial de la Noche ({sales.length} ventas)</DialogTitle></DialogHeader>

          {/* Session stats summary */}
          {currentStats && currentStats.topProducts.length > 0 && (
            <div className="border rounded-lg p-3 mb-2 bg-muted/30">
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold">Productos más vendidos</span>
              </div>
              <div className="space-y-1">
                {currentStats.topProducts.slice(0, 5).map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                      <span>{p.name}</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-muted-foreground">{p.qty} uds</span>
                      <span className="font-medium">${p.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ScrollArea className="max-h-[50vh]">
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
                        <div className="text-right mr-1">
                          <span className="font-bold text-sm">${s.finalTotal.toLocaleString()}</span>
                          {s.surcharge > 0 && <p className="text-[10px] text-amber-600">+${s.surcharge.toLocaleString()} recargo</p>}
                        </div>
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
                        {s.paymentMethod === 'cash' ? 'Efectivo' : s.paymentMethod === 'qr' ? 'QR' : s.paymentMethod === 'transfer' ? 'Transferencia' : `Efect. $${s.cashAmount || 0} | QR $${s.qrAmount || 0} | Transf. $${s.transferAmount || 0}`}
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
                <div className="border-t pt-1 space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span>Subtotal</span>
                    <span>${viewSale.total.toLocaleString()}</span>
                  </div>
                  {viewSale.surcharge > 0 && (
                    <div className="flex justify-between text-xs text-amber-600">
                      <span>Recargo 15%</span>
                      <span>+${viewSale.surcharge.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold">
                    <span>Total</span>
                    <span>${viewSale.finalTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              {viewSale.paymentMethod && (
                <div className="text-xs text-muted-foreground">
                  Método: {viewSale.paymentMethod === 'mixed'
                    ? `Efect. $${viewSale.cashAmount || 0} | QR $${viewSale.qrAmount || 0} | Transf. $${viewSale.transferAmount || 0}`
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
              <div>
                <label className="text-xs font-medium text-muted-foreground">Mesa / Descripción</label>
                <Input value={editTable} onChange={e => setEditTable(e.target.value)} className="h-8 text-sm mt-1" placeholder="Sin mesa" />
              </div>
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
                  <span>Subtotal</span>
                  <span className="text-primary">${editTotal.toLocaleString()}</span>
                </div>
              </div>
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
              {editStatus === 'cobrado' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Método de pago</label>
                  <PayMethodSelector value={editMethod} onChange={setEditMethod} />
                  {(() => {
                    const surcharge = calcSurcharge(editMethod, editTotal, parseFloat(editCash) || 0);
                    return surcharge > 0 ? <p className="text-xs text-amber-600 mt-1.5 text-center">Recargo 15%: +${surcharge.toLocaleString()} → Total: ${(editTotal + surcharge).toLocaleString()}</p> : null;
                  })()}
                  {editMethod === 'mixed' && (
                    <div className="mt-2">
                      <MixedInputs cash={editCash} qr={editQr} transfer={editTransfer} onCash={setEditCash} onQr={setEditQr} onTransfer={setEditTransfer} total={editTotal + calcSurcharge('mixed', editTotal, parseFloat(editCash) || 0)} baseTotal={editTotal} />
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

// ── Session Detail Component ──

function SessionDetail({ session }: { session: NightSession }) {
  const stats = getSessionStats(session);

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Moon className="w-5 h-5" />
          Noche del {session.openedAt.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </DialogTitle>
      </DialogHeader>

      <div className="text-xs text-muted-foreground text-center">
        {session.openedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} — {session.closedAt?.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Ventas', value: stats.salesCount, icon: Receipt },
          { label: 'Cobrado', value: `$${stats.totalCollected.toLocaleString()}`, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Pendiente', value: `$${stats.totalPending.toLocaleString()}`, icon: Clock, color: 'text-yellow-600' },
          { label: 'Efectivo', value: `$${stats.totalCash.toLocaleString()}`, icon: DollarSign },
          { label: 'QR', value: `$${stats.totalQr.toLocaleString()}`, icon: Smartphone },
          { label: 'Transferencia', value: `$${stats.totalTransfer.toLocaleString()}`, icon: CreditCard },
        ].map(s => (
          <div key={s.label} className="border rounded-lg p-2 text-center">
            <s.icon className={cn('w-4 h-4 mx-auto mb-1', (s as any).color || 'text-muted-foreground')} />
            <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
            <p className="text-sm font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {stats.totalSurcharge > 0 && (
        <div className="border rounded-lg p-2 text-center border-amber-500/30 bg-amber-500/5">
          <p className="text-[10px] text-amber-600 uppercase">Total Recargos 15%</p>
          <p className="text-sm font-bold text-amber-600">${stats.totalSurcharge.toLocaleString()}</p>
        </div>
      )}

      {stats.totalTickets > 0 && (
        <div className="border rounded-lg p-2 text-center border-purple-500/30 bg-purple-500/5">
          <p className="text-[10px] text-purple-600 uppercase">Entradas</p>
          <p className="text-sm font-bold text-purple-600">${stats.totalTickets.toLocaleString()}</p>
        </div>
      )}

      {/* Top products */}
      {stats.topProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold">Ranking de Productos</span>
          </div>
          <div className="border rounded-lg divide-y">
            {stats.topProducts.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                    idx === 0 ? 'bg-yellow-500/20 text-yellow-700' : idx === 1 ? 'bg-gray-300/30 text-gray-600' : idx === 2 ? 'bg-amber-700/20 text-amber-800' : 'bg-muted text-muted-foreground'
                  )}>{idx + 1}</span>
                  <span className="font-medium">{p.name}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-muted-foreground">{p.qty} uds</span>
                  <span className="font-bold">${p.revenue.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales list */}
      <div>
        <p className="text-xs font-semibold mb-2">Todas las ventas</p>
        <ScrollArea className="max-h-48">
          <div className="space-y-1.5">
            {session.sales.map(s => (
              <div key={s.id} className={cn(
                'rounded border p-2 text-xs',
                s.paymentStatus === 'cobrado' ? 'border-green-500/20' : 'border-yellow-500/20'
              )}>
                <div className="flex justify-between">
                  <span>{s.tableNumber} — {s.createdAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="font-bold">${s.finalTotal.toLocaleString()}{s.surcharge > 0 ? ` (+$${s.surcharge})` : ''}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.items.map((item, idx) => (
                    <span key={idx} className="bg-muted/50 rounded px-1 py-0.5 text-[10px]">{item.name} ×{item.quantity}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
