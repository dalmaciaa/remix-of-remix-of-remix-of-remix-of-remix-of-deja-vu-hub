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
import { formatCurrency, isToday, isThisMonth } from '@/lib/utils-format';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Loader2, Search, Package, ShoppingCart, Receipt, PartyPopper, CalendarIcon, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productCategoryLabels } from '@/lib/utils-format';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: sales = [], isLoading: loadingSales } = useSales();
  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses();
  const { data: events = [], isLoading: loadingEvents } = useEvents();

  const isLoading = loadingProducts || loadingSales || loadingExpenses || loadingEvents;

  // Get date range based on quick filter
  const getFilterDateRange = useMemo(() => {
    const now = new Date();
    switch (quickFilter) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom':
        if (dateRange?.from && dateRange?.to) {
          return { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) };
        }
        // Default to today if custom but no dates selected
        return { start: startOfDay(now), end: endOfDay(now) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  }, [quickFilter, dateRange]);

  const filterRange = getFilterDateRange;

  // Filtered data based on date range
  const filteredSales = useMemo(() => {
    if (!filterRange.start || !filterRange.end) return sales;
    return sales.filter(s => {
      try {
        return isWithinInterval(new Date(s.createdAt), { start: filterRange.start, end: filterRange.end });
      } catch {
        return false;
      }
    });
  }, [sales, filterRange]);

  const filteredExpenses = useMemo(() => {
    if (!filterRange.start || !filterRange.end) return expenses;
    return expenses.filter(e => {
      try {
        return isWithinInterval(new Date(e.createdAt), { start: filterRange.start, end: filterRange.end });
      } catch {
        return false;
      }
    });
  }, [expenses, filterRange]);

  const periodIncome = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const periodExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Calcular costo de productos vendidos en el período (saldo negativo incluye gastos + costos)
  const periodProductCosts = useMemo(() => {
    return filteredSales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum, item) => {
        // Buscar el producto para obtener su costo
        const product = products.find(p => p.id === item.productId);
        if (product && product.costPerUnit) {
          return itemSum + (product.costPerUnit * item.quantity);
        }
        // Si no tiene costPerUnit, usar purchasePrice como aproximación
        if (product) {
          return itemSum + (product.purchasePrice * item.quantity / Math.max(product.quantity, 1));
        }
        return itemSum;
      }, 0);
    }, 0);
  }, [filteredSales, products]);

  const periodNegativeBalance = periodExpenses + periodProductCosts;
  const balance = periodIncome - periodNegativeBalance;

  // Today stats for comparison
  const todayIncome = sales
    .filter((s) => isToday(new Date(s.createdAt)))
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const categoryStats = (['drinks', 'cocktails', 'food', 'supplies'] as const).map((cat) => {
    const catProducts = products.filter((p) => p.category === cat);
    const value = catProducts.reduce((sum, p) => sum + p.quantity * p.purchasePrice, 0);
    const lowStock = catProducts.filter((p) => p.status === 'low' || p.status === 'critical').length;
    return {
      category: cat,
      label: productCategoryLabels[cat],
      count: catProducts.length,
      value,
      lowStock,
    };
  });

  // Search results
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    const results: SearchResult[] = [];

    products.forEach((p) => {
      if (p.name.toLowerCase().includes(term)) {
        results.push({
          type: 'product',
          id: p.id,
          title: p.name,
          subtitle: `${productCategoryLabels[p.category]} - Stock: ${p.quantity}`,
          link: '/inventory',
        });
      }
    });

    sales.forEach((s) => {
      if (s.concept?.toLowerCase().includes(term) || s.items.some(i => i.productName.toLowerCase().includes(term))) {
        results.push({
          type: 'sale',
          id: s.id,
          title: s.concept || 'Venta',
          subtitle: formatCurrency(s.totalAmount),
          link: '/sales',
        });
      }
    });

    expenses.forEach((e) => {
      if (e.description.toLowerCase().includes(term)) {
        results.push({
          type: 'expense',
          id: e.id,
          title: e.description,
          subtitle: formatCurrency(e.amount),
          link: '/expenses',
        });
      }
    });

    events.forEach((e) => {
      if (e.clientName.toLowerCase().includes(term) || e.eventType.toLowerCase().includes(term)) {
        results.push({
          type: 'event',
          id: e.id,
          title: `${e.eventType} - ${e.clientName}`,
          subtitle: formatCurrency(e.totalAmount),
          link: '/events',
        });
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
        if (dateRange?.from && dateRange?.to) {
          return `${format(dateRange.from, 'dd/MM')} - ${format(dateRange.to, 'dd/MM')}`;
        }
        return 'Personalizado';
    }
  };

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
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        {/* Header row */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold">Dashboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">Resumen general de Deja-Vu</p>
          </div>
          
          {/* Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos, ventas, eventos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="pl-10"
            />
            
            {isSearchFocused && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                {searchResults.map((result) => {
                  const Icon = getResultIcon(result.type);
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors text-left"
                    >
                      <div className="p-2 rounded-lg bg-secondary">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
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
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 p-4 text-center text-muted-foreground text-sm">
                No se encontraron resultados
              </div>
            )}
          </div>
        </div>

        {/* Date Filter - scrollable on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Select value={quickFilter} onValueChange={(v) => setQuickFilter(v as QuickFilter)}>
            <SelectTrigger className="w-32 sm:w-40 flex-shrink-0">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          
          {quickFilter === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 flex-shrink-0">
                  <CalendarIcon className="w-4 h-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'dd/MM')} - {format(dateRange.to, 'dd/MM')}
                      </>
                    ) : (
                      format(dateRange.from, 'dd/MM')
                    )
                  ) : (
                    'Fechas'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  locale={es}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}
          
          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
            <span className="font-medium text-foreground">{getFilterLabel()}</span>
          </span>
        </div>
      </div>

      {/* Low Stock Alert */}
      <div className="mb-4 sm:mb-6">
        <LowStockAlert />
      </div>

      {/* Stats Grid - 2 columns on mobile */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6">
        <StatCard
          title="Ingresos Hoy"
          value={formatCurrency(todayIncome)}
          icon={DollarSign}
          variant="default"
          href="/sales"
        />
        <StatCard
          title={`Ingresos ${quickFilter === 'today' ? 'Hoy' : quickFilter === 'week' ? 'Semana' : quickFilter === 'month' ? 'Mes' : 'Período'}`}
          value={formatCurrency(periodIncome)}
          icon={TrendingUp}
          variant="success"
          href="/sales"
        />
        <StatCard
          title={`Saldo Negativo ${quickFilter === 'today' ? 'Hoy' : quickFilter === 'week' ? 'Semana' : quickFilter === 'month' ? 'Mes' : 'Período'}`}
          value={formatCurrency(periodNegativeBalance)}
          icon={TrendingDown}
          variant="danger"
          href="/expenses"
        />
        <StatCard
          title="Balance"
          value={formatCurrency(balance)}
          icon={Wallet}
          variant={balance >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Top Products */}
      <div className="mb-4 sm:mb-6">
        <TopProducts 
          dateFilter={quickFilter === 'custom' ? 'all' : quickFilter}
          startDate={quickFilter === 'custom' ? dateRange?.from : null}
          endDate={quickFilter === 'custom' ? dateRange?.to : null}
        />
      </div>

      {/* Charts - Stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
        <StaffRanking />
        <SalesChart />
        <PaymentMethodChart />
      </div>

      {/* Category Stats */}
      <div className="glass-card p-4 sm:p-6 animate-fade-in">
        <h3 className="font-display text-base sm:text-lg font-semibold mb-3 sm:mb-4">Inventario por Categoría</h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
          {categoryStats.map((stat) => (
            <Link
              key={stat.category}
              to={`/inventory?category=${stat.category}`}
              className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-lg sm:text-xl font-semibold mt-1">{stat.count} productos</p>
              <p className="text-sm text-primary mt-1">{formatCurrency(stat.value)}</p>
              {stat.lowStock > 0 && (
                <p className="text-xs text-warning mt-1">{stat.lowStock} en stock bajo</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}