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
    const todaySales = sales.filter(s => isToday(new Date(s.createdAt)));
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
        staffMap.set(staffKey, { staffId, staffName: staffKey, totalSales: sale.totalAmount, salesCount: 1, itemsSold });
      }
    });

    return Array.from(staffMap.values()).sort((a, b) => b.totalSales - a.totalSales);
  }, [sales]);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="w-6 h-6 text-warning" />;
      case 1: return <Medal className="w-5 h-5 text-muted-foreground" />;
      case 2: return <Award className="w-5 h-5 text-accent" />;
      default: return <User className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (todayRanking.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-warning/15">
            <Trophy className="w-5 h-5 text-warning" />
          </div>
          <h3 className="font-display text-lg font-semibold">Ranking del Día</h3>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-3">
            <Trophy className="w-8 h-8 text-muted-foreground/30" />
          </div>
          <p className="text-muted-foreground text-sm">Sin ventas registradas hoy</p>
        </div>
      </div>
    );
  }

  const totalDaySales = todayRanking.reduce((sum, s) => sum + s.totalSales, 0);

  return (
    <div className="rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-warning/15">
            <Trophy className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Ranking del Día</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total: {formatCurrency(totalDaySales)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {todayRanking.map((staff, index) => {
          const percentage = totalDaySales > 0 ? Math.round((staff.totalSales / totalDaySales) * 100) : 0;

          return (
            <div
              key={staff.staffName}
              className={cn(
                "relative flex items-center gap-3 p-3 rounded-xl transition-all overflow-hidden",
                index === 0
                  ? "bg-warning/10 border border-warning/20"
                  : index === 1
                  ? "bg-muted/60 border border-border/30"
                  : index === 2
                  ? "bg-accent/10 border border-accent/20"
                  : "bg-secondary/30"
              )}
            >
              {/* Progress bar background */}
              <div
                className={cn(
                  "absolute inset-y-0 left-0 opacity-10 rounded-xl",
                  index === 0 ? "bg-warning" : index === 1 ? "bg-muted-foreground" : "bg-accent"
                )}
                style={{ width: `${percentage}%` }}
              />

              <div className="relative flex items-center justify-center w-10">
                {getRankIcon(index)}
              </div>
              <div className="relative flex-1 min-w-0">
                <p className={cn("font-semibold truncate", index === 0 ? "text-base" : "text-sm")}>
                  {staff.staffName}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3" />
                    {staff.salesCount} venta{staff.salesCount !== 1 ? 's' : ''}
                  </span>
                  <span>{staff.itemsSold} items</span>
                  <span className="text-primary font-medium">{percentage}%</span>
                </div>
              </div>
              <div className="relative text-right">
                <p className={cn("font-bold text-primary", index === 0 ? "text-xl" : "text-base")}>
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
