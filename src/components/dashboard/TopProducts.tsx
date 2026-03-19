import { useMemo } from 'react';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { formatCurrency } from '@/lib/utils-format';
import { Wine, Coffee, UtensilsCrossed, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isWithinInterval, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

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
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'all': return null;
    }
  };

  const topProducts = useMemo(() => {
    let filteredSales = sales;
    if (startDate && endDate) {
      filteredSales = sales.filter(s => isWithinInterval(new Date(s.createdAt), { start: startDate, end: endDate }));
    } else {
      const range = getDateRange(dateFilter);
      if (range) {
        filteredSales = sales.filter(s => isWithinInterval(new Date(s.createdAt), range));
      }
    }

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

    return Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity);
  }, [sales, products, dateFilter, startDate, endDate]);

  const topDrink = topProducts.find(p => p.category === 'drinks');
  const topCocktail = topProducts.find(p => p.category === 'cocktails');
  const topFood = topProducts.find(p => p.category === 'food');
  const topOverall = topProducts[0];

  const cards = [
    {
      title: 'Top General',
      item: topOverall,
      icon: <Star className="w-4 h-4" />,
      accentClass: 'border-l-primary bg-primary/5',
      iconBg: 'bg-primary/15 text-primary',
    },
    {
      title: 'Top Bebida',
      item: topDrink,
      icon: <Wine className="w-4 h-4" />,
      accentClass: 'border-l-chart-4 bg-chart-4/5',
      iconBg: 'bg-chart-4/15 text-chart-4',
    },
    {
      title: 'Top Cóctel',
      item: topCocktail,
      icon: <Coffee className="w-4 h-4" />,
      accentClass: 'border-l-accent bg-accent/5',
      iconBg: 'bg-accent/15 text-accent',
    },
    {
      title: 'Top Comida',
      item: topFood,
      icon: <UtensilsCrossed className="w-4 h-4" />,
      accentClass: 'border-l-warning bg-warning/5',
      iconBg: 'bg-warning/15 text-warning',
    },
  ];

  return (
    <div className="rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm p-6">
      <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <div className="p-2 rounded-xl bg-primary/15">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        Más Vendidos
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(({ title, item, icon, accentClass, iconBg }) => (
          <div
            key={title}
            className={cn(
              "p-4 rounded-xl border border-border/30 border-l-[3px] transition-all hover:shadow-md",
              accentClass
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-1.5 rounded-lg", iconBg)}>{icon}</div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
            </div>
            {item ? (
              <div>
                <p className="font-semibold text-sm truncate">{item.productName}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{item.quantity} vendidos</span>
                  <span className="text-xs font-bold text-primary">{formatCurrency(item.revenue)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 mt-2">Sin datos</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
