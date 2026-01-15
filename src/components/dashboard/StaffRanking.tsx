import { useMemo } from 'react';
import { useSales } from '@/hooks/useSales';
import { isToday, formatCurrency } from '@/lib/utils-format';
import { Trophy, Medal, Award, User, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StaffSales {
  staffId: string | null;
  staffName: string;
  totalSales: number;
  salesCount: number;
  itemsSold: number;
}

export function StaffRanking() {
  const { data: sales = [] } = useSales();

  const todayRanking = useMemo<StaffSales[]>(() => {
    // Filter today's sales
    const todaySales = sales.filter(s => isToday(new Date(s.createdAt)));

    // Group by staff
    const staffMap = new Map<string, StaffSales>();

    todaySales.forEach(sale => {
      const staffKey = sale.staffName || 'Sistema';
      const staffId = sale.staffId || null;
      const itemsSold = sale.items.reduce((sum, item) => sum + item.quantity, 0);

      if (staffMap.has(staffKey)) {
        const existing = staffMap.get(staffKey)!;
        existing.totalSales += sale.totalAmount;
        existing.salesCount += 1;
        existing.itemsSold += itemsSold;
      } else {
        staffMap.set(staffKey, {
          staffId,
          staffName: staffKey,
          totalSales: sale.totalAmount,
          salesCount: 1,
          itemsSold,
        });
      }
    });

    // Sort by total sales descending
    return Array.from(staffMap.values())
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [sales]);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 2:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <User className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getRankStyles = (index: number) => {
    switch (index) {
      case 0:
        return {
          bg: 'bg-gradient-to-r from-yellow-500/30 via-yellow-500/20 to-transparent',
          border: 'border-l-4 border-l-yellow-500',
          nameSize: 'text-lg',
        };
      case 1:
        return {
          bg: 'bg-gradient-to-r from-gray-400/25 via-gray-400/15 to-transparent',
          border: 'border-l-4 border-l-gray-400',
          nameSize: 'text-base',
        };
      case 2:
        return {
          bg: 'bg-gradient-to-r from-amber-600/25 via-amber-600/15 to-transparent',
          border: 'border-l-4 border-l-amber-600',
          nameSize: 'text-base',
        };
      default:
        return {
          bg: 'bg-secondary/50',
          border: '',
          nameSize: 'text-sm',
        };
    }
  };

  if (todayRanking.length === 0) {
    return (
      <div className="glass-card p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/20">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-display text-lg font-semibold">Ranking del Día</h3>
        </div>
        <div className="text-center py-6">
          <Trophy className="w-12 h-12 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-muted-foreground text-sm">Sin ventas registradas hoy</p>
        </div>
      </div>
    );
  }

  const totalDaySales = todayRanking.reduce((sum, s) => sum + s.totalSales, 0);

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Ranking del Día</h3>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(totalDaySales)}
            </p>
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        {todayRanking.map((staff, index) => {
          const styles = getRankStyles(index);
          const percentage = totalDaySales > 0 
            ? Math.round((staff.totalSales / totalDaySales) * 100) 
            : 0;
          
          return (
            <div
              key={staff.staffName}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all",
                styles.bg,
                styles.border
              )}
            >
              <div className="flex items-center justify-center w-10">
                {getRankIcon(index)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("font-semibold truncate", styles.nameSize)}>
                  {staff.staffName}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3" />
                    {staff.salesCount} venta{staff.salesCount !== 1 ? 's' : ''}
                  </span>
                  <span>{staff.itemsSold} items</span>
                  <span className="text-primary font-medium">{percentage}%</span>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "font-bold text-primary",
                  index === 0 ? "text-xl" : "text-lg"
                )}>
                  {formatCurrency(staff.totalSales)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}