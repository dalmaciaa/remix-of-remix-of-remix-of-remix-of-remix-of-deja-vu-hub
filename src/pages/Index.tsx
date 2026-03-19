import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { StatCard } from '@/components/dashboard/StatCard';
import { LowStockAlert } from '@/components/dashboard/LowStockAlert';
import { SalesChart, PaymentMethodChart } from '@/components/dashboard/DashboardCharts';
import { StaffRanking } from '@/components/dashboard/StaffRanking';
import { TopProducts } from '@/components/dashboard/TopProducts';
import { useProducts } from '@/hooks/useProducts';
import { useSales } from '@/hooks/useSales';
import { useExpenses } from '@/hooks/useExpenses';
import { useEvents } from '@/hooks/useEvents';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, isToday, isThisMonth } from '@/lib/utils-format';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Loader2, Search, Package, ShoppingCart, Receipt, PartyPopper, CalendarIcon, Filter, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productCategoryLabels } from '@/lib/utils-format';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, isWithinInterval, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface SearchResult {
  type: 'product' | 'sale' | 'expense' | 'event';
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

type QuickFilter = 'today' | 'week' | 'month' | 'custom';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentStaff } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: sales = [], isLoading: loadingSales } = useSales();
  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses();
  const { data: events = [], isLoading: loadingEvents } = useEvents();

  const isLoading = loadingProducts || loadingSales || loadingExpenses || loadingEvents;

  const getFilterDateRange = useMemo(() => {
    const now = new Date();
    switch (quickFilter) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom':
        if (dateRange?.from && dateRange?.to) return { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) };
        return { start: startOfDay(now), end: endOfDay(now) };
      default: return { start: startOfDay(now), end: endOfDay(now) };
    }
  }, [quickFilter, dateRange]);

  const filterRange = getFilterDateRange;

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      try { return isWithinInterval(new Date(s.createdAt), { start: filterRange.start, end: filterRange.end }); }
      catch { return false; }
    });
  }, [sales, filterRange]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      try { return isWithinInterval(new Date(e.createdAt), { start: filterRange.start, end: filterRange.end }); }
      catch { return false; }
    });
  }, [expenses, filterRange]);

  const periodIncome = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const periodExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const periodProductCosts = useMemo(() => {
    return filteredSales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum, item) => {
        const product = products.find(p => p.id === item.productId);
        if (product && product.costPerUnit) return itemSum + (product.costPerUnit * item.quantity);
        if (product) return itemSum + (product.purchasePrice * item.quantity / Math.max(product.quantity, 1));
        return itemSum;
      }, 0);
    }, 0);
  }, [filteredSales, products]);

  const periodNegativeBalance = periodExpenses + periodProductCosts;
  const balance = periodIncome - periodNegativeBalance;

  const todayIncome = sales
    .filter((s) => isToday(new Date(s.createdAt)))
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const categoryStats = (['drinks', 'cocktails', 'food', 'supplies'] as const).map((cat) => {
    const catProducts = products.filter((p) => p.category === cat);
    const value = catProducts.reduce((sum, p) => sum + p.quantity * p.purchasePrice, 0);
    const lowStock = catProducts.filter((p) => p.status === 'low' || p.status === 'critical').length;
    return { category: cat, label: productCategoryLabels[cat], count: catProducts.length, value, lowStock };
  });

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    const results: SearchResult[] = [];
    products.forEach((p) => {
      if (p.name.toLowerCase().includes(term)) {
        results.push({ type: 'product', id: p.id, title: p.name, subtitle: `${productCategoryLabels[p.category]} - Stock: ${p.quantity}`, link: '/inventory' });
      }
    });
    sales.forEach((s) => {
      if (s.concept?.toLowerCase().includes(term) || s.items.some(i => i.productName.toLowerCase().includes(term))) {
        results.push({ type: 'sale', id: s.id, title: s.concept || 'Venta', subtitle: formatCurrency(s.totalAmount), link: '/sales' });
      }
    });
    expenses.forEach((e) => {
      if (e.description.toLowerCase().includes(term)) {
        results.push({ type: 'expense', id: e.id, title: e.description, subtitle: formatCurrency(e.amount), link: '/expenses' });
      }
    });
    events.forEach((e) => {
      if (e.clientName.toLowerCase().includes(term) || e.eventType.toLowerCase().includes(term)) {
        results.push({ type: 'event', id: e.id, title: `${e.eventType} - ${e.clientName}`, subtitle: formatCurrency(e.totalAmount), link: '/events' });
      }
    });
    return results.slice(0, 8);
  }, [searchTerm, products, sales, expenses, events]);

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'product': return Package;
      case 'sale': return ShoppingCart;
      case 'expense': return Receipt;
      case 'event': return PartyPopper;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setSearchTerm('');
    setIsSearchFocused(false);
    navigate(result.link);
  };

  const getFilterLabel = () => {
    switch (quickFilter) {
      case 'today': return 'Hoy';
      case 'week': return 'Esta Semana';
      case 'month': return 'Este Mes';
      case 'custom':
        if (dateRange?.from && dateRange?.to) return `${format(dateRange.from, 'dd/MM')} - ${format(dateRange.to, 'dd/MM')}`;
        return 'Personalizado';
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando dashboard...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Hero Welcome */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 via-card/90 to-accent/10 p-6 sm:p-8">
          {/* Decorative orbs */}
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-accent/10 blur-3xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium uppercase tracking-widest text-primary">{greeting}</span>
              </div>
              <h1 className="font-display text-2xl lg:text-3xl font-bold">
                {currentStaff?.full_name || 'Dashboard'}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">Resumen general de Deja-Vu Retro Pub</p>
            </div>

            {/* Search Bar */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos, ventas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                className="pl-10 bg-background/60 backdrop-blur-sm border-border/50"
              />
              {isSearchFocused && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  {searchResults.map((result) => {
                    const Icon = getResultIcon(result.type);
                    return (
                      <button key={`${result.type}-${result.id}`} onClick={() => handleResultClick(result)} className="w-full flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors text-left">
                        <div className="p-2 rounded-lg bg-secondary"><Icon className="w-4 h-4 text-primary" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {isSearchFocused && searchTerm && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 p-4 text-center text-muted-foreground text-sm">
                  No se encontraron resultados
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap px-1">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
            {([
              { value: 'today', label: 'Hoy' },
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mes' },
              { value: 'custom', label: 'Custom' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setQuickFilter(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  quickFilter === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {quickFilter === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {dateRange?.from ? (
                    dateRange.to ? `${format(dateRange.from, 'dd/MM/yy')} - ${format(dateRange.to, 'dd/MM/yy')}` : format(dateRange.from, 'dd/MM/yy')
                  ) : 'Seleccionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={es} />
              </PopoverContent>
            </Popover>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            Mostrando: <span className="font-semibold text-foreground">{getFilterLabel()}</span>
          </span>
        </div>

        {/* Low Stock Alert */}
        <LowStockAlert />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Ingresos Hoy" value={formatCurrency(todayIncome)} icon={DollarSign} variant="default" href="/sales" />
          <StatCard
            title={`Ingresos ${quickFilter === 'today' ? 'Hoy' : quickFilter === 'week' ? 'Semana' : quickFilter === 'month' ? 'Mes' : 'Período'}`}
            value={formatCurrency(periodIncome)} icon={TrendingUp} variant="success" href="/sales"
          />
          <StatCard
            title={`Saldo Negativo`}
            value={formatCurrency(periodNegativeBalance)} icon={TrendingDown} variant="danger" href="/expenses"
          />
          <StatCard title="Balance" value={formatCurrency(balance)} icon={Wallet} variant={balance >= 0 ? 'success' : 'danger'} />
        </div>

        {/* Top Products */}
        <TopProducts
          dateFilter={quickFilter === 'custom' ? 'all' : quickFilter}
          startDate={quickFilter === 'custom' ? dateRange?.from : null}
          endDate={quickFilter === 'custom' ? dateRange?.to : null}
        />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          <div className="md:col-span-2 xl:col-span-1">
            <StaffRanking />
          </div>
          <SalesChart />
          <PaymentMethodChart />
        </div>

        {/* Category Stats */}
        <div className="rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-success/15">
              <Package className="w-5 h-5 text-success" />
            </div>
            <h3 className="font-display text-lg font-semibold">Inventario por Categoría</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {categoryStats.map((stat) => (
              <Link
                key={stat.category}
                to={`/inventory?category=${stat.category}`}
                className="group p-4 rounded-xl bg-secondary/30 border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold mt-2">{stat.count}</p>
                <p className="text-xs text-muted-foreground">productos</p>
                <p className="text-sm font-semibold text-primary mt-2">{formatCurrency(stat.value)}</p>
                {stat.lowStock > 0 && (
                  <p className="text-xs text-destructive font-medium mt-1">⚠ {stat.lowStock} stock bajo</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
