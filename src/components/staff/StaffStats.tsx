import { useMemo, useState } from 'react';
import { useSales } from '@/hooks/useSales';
import { formatCurrency, isToday, isThisMonth } from '@/lib/utils-format';
import { Trophy, TrendingUp, ShoppingCart, Calendar, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

interface StaffMetrics {
  staffId: string | null;
  staffName: string;
  totalSales: number;
  salesCount: number;
  averageTicket: number;
  paidSales: number;
  pendingSales: number;
}

export function StaffStats() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const { data: sales = [] } = useSales();

  const filteredSales = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return sales.filter(sale => {
      const saleDate = new Date(sale.createdAt);
      switch (timeFilter) {
        case 'today':
          return isToday(saleDate);
        case 'week':
          return saleDate >= startOfWeek;
        case 'month':
          return isThisMonth(saleDate);
        case 'all':
          return true;
        default:
          return true;
      }
    });
  }, [sales, timeFilter]);

  const staffMetrics = useMemo<StaffMetrics[]>(() => {
    const staffMap = new Map<string, StaffMetrics>();

    filteredSales.forEach(sale => {
      const staffKey = sale.staffName || 'Sistema';
      const staffId = sale.staffId || null;

      if (staffMap.has(staffKey)) {
        const existing = staffMap.get(staffKey)!;
        existing.totalSales += sale.totalAmount;
        existing.salesCount += 1;
        existing.averageTicket = existing.totalSales / existing.salesCount;
        if (sale.paymentStatus === 'cobrado') {
          existing.paidSales += sale.totalAmount;
        } else {
          existing.pendingSales += sale.totalAmount;
        }
      } else {
        staffMap.set(staffKey, {
          staffId,
          staffName: staffKey,
          totalSales: sale.totalAmount,
          salesCount: 1,
          averageTicket: sale.totalAmount,
          paidSales: sale.paymentStatus === 'cobrado' ? sale.totalAmount : 0,
          pendingSales: sale.paymentStatus === 'no_cobrado' ? sale.totalAmount : 0,
        });
      }
    });

    return Array.from(staffMap.values())
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredSales]);

  const totalAllSales = staffMetrics.reduce((sum, s) => sum + s.totalSales, 0);
  const topSeller = staffMetrics[0];

  const getTimeLabel = () => {
    switch (timeFilter) {
      case 'today': return 'Hoy';
      case 'week': return 'Esta Semana';
      case 'month': return 'Este Mes';
      case 'all': return 'Todo el Tiempo';
    }
  };

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return <Badge className="bg-yellow-500 text-black"><Trophy className="w-3 h-3 mr-1" />1°</Badge>;
      case 1:
        return <Badge variant="secondary">2°</Badge>;
      case 2:
        return <Badge variant="outline">3°</Badge>;
      default:
        return <Badge variant="outline">{index + 1}°</Badge>;
    }
  };

  if (staffMetrics.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Rendimiento de Mozos
          </h3>
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-center py-8">
          Sin ventas registradas en este período
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Rendimiento de Mozos
        </h3>
        <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
          <SelectTrigger className="w-40">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mes</SelectItem>
            <SelectItem value="all">Todo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-secondary/50">
          <p className="text-sm text-muted-foreground">Total Ventas ({getTimeLabel()})</p>
          <p className="text-2xl font-semibold text-primary">{formatCurrency(totalAllSales)}</p>
          <p className="text-xs text-muted-foreground">{filteredSales.length} operaciones</p>
        </div>
        {topSeller && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-yellow-500/20 to-yellow-500/5 border border-yellow-500/30">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Trophy className="w-3 h-3 text-yellow-500" /> Mejor Vendedor
            </p>
            <p className="text-lg font-semibold">{topSeller.staffName}</p>
            <p className="text-sm text-primary">{formatCurrency(topSeller.totalSales)}</p>
          </div>
        )}
        <div className="p-4 rounded-lg bg-secondary/50">
          <p className="text-sm text-muted-foreground">Ticket Promedio</p>
          <p className="text-2xl font-semibold">
            {formatCurrency(filteredSales.length > 0 ? totalAllSales / filteredSales.length : 0)}
          </p>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Pos.</TableHead>
              <TableHead>Mozo</TableHead>
              <TableHead className="text-center">Ventas</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Promedio</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
              <TableHead className="w-32">% del Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffMetrics.map((staff, index) => {
              const percentage = totalAllSales > 0 ? (staff.totalSales / totalAllSales) * 100 : 0;
              return (
                <TableRow key={staff.staffName}>
                  <TableCell>{getRankBadge(index)}</TableCell>
                  <TableCell className="font-medium">{staff.staffName}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ShoppingCart className="w-3 h-3 text-muted-foreground" />
                      {staff.salesCount}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {formatCurrency(staff.totalSales)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(staff.averageTicket)}
                  </TableCell>
                  <TableCell className="text-right text-green-500">
                    {formatCurrency(staff.paidSales)}
                  </TableCell>
                  <TableCell className="text-right text-amber-500">
                    {staff.pendingSales > 0 ? formatCurrency(staff.pendingSales) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={percentage} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-10">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
