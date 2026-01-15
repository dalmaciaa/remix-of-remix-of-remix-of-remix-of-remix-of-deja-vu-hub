import { useMemo } from 'react';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { formatCurrency } from '@/lib/utils-format';
import { Wine, Coffee, UtensilsCrossed, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

interface TopProductData {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  category: string;
}

type DateFilter = 'today' | 'week' | 'month' | 'all';

interface TopProductsProps {
  dateFilter?: DateFilter;
  startDate?: Date | null;
  endDate?: Date | null;
}

export function TopProducts({ dateFilter = 'today', startDate, endDate }: TopProductsProps) {
  const { data: sales = [] } = useSales();
  const { data: products = [] } = useProducts();

  const getDateRange = (filter: DateFilter) => {
    const now = new Date();
    switch (filter) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'all':
        return null;
    }
  };

  const topProducts = useMemo(() => {
    let filteredSales = sales;

    // Apply date filter
    if (startDate && endDate) {
      filteredSales = sales.filter(s => 
        isWithinInterval(new Date(s.createdAt), { start: startDate, end: endDate })
      );
    } else {
      const range = getDateRange(dateFilter);
      if (range) {
        filteredSales = sales.filter(s => 
          isWithinInterval(new Date(s.createdAt), range)
        );
      }
    }

    // Aggregate by product
    const productMap = new Map<string, TopProductData>();

    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const key = item.productId || item.productName;
        const product = products.find(p => p.id === item.productId);
        
        if (productMap.has(key)) {
          const existing = productMap.get(key)!;
          existing.quantity += item.quantity;
          existing.revenue += item.total;
        } else {
          productMap.set(key, {
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            revenue: item.total,
            category: product?.category || 'others',
          });
        }
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity);
  }, [sales, products, dateFilter, startDate, endDate]);

  // Get top by category
  const topDrink = topProducts.find(p => p.category === 'drinks');
  const topCocktail = topProducts.find(p => p.category === 'cocktails');
  const topFood = topProducts.find(p => p.category === 'food');
  const topOverall = topProducts[0];

  const renderTopItem = (
    title: string, 
    item: TopProductData | undefined, 
    icon: React.ReactNode,
    colorClass: string
  ) => (
    <div className={cn(
      "p-4 rounded-xl border transition-all",
      colorClass
    )}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">{title}</span>
      </div>
      {item ? (
        <div>
          <p className="font-semibold text-sm truncate">{item.productName}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs opacity-70">{item.quantity} vendidos</span>
            <span className="text-xs font-medium">{formatCurrency(item.revenue)}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs opacity-60">Sin datos</p>
      )}
    </div>
  );

  return (
    <div className="glass-card p-6 animate-fade-in">
      <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 text-primary" />
        Más Vendidos
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {renderTopItem(
          'Top General', 
          topOverall, 
          <Star className="w-4 h-4" />,
          'bg-primary/10 border-primary/20 text-foreground'
        )}
        {renderTopItem(
          'Top Bebida', 
          topDrink, 
          <Wine className="w-4 h-4" />,
          'bg-blue-500/10 border-blue-500/20 text-foreground'
        )}
        {renderTopItem(
          'Top Cóctel', 
          topCocktail, 
          <Coffee className="w-4 h-4" />,
          'bg-purple-500/10 border-purple-500/20 text-foreground'
        )}
        {renderTopItem(
          'Top Comida', 
          topFood, 
          <UtensilsCrossed className="w-4 h-4" />,
          'bg-orange-500/10 border-orange-500/20 text-foreground'
        )}
      </div>
    </div>
  );
}