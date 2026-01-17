import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSales } from '@/hooks/useSales';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime } from '@/lib/utils-format';
import { History, Calendar, DollarSign, ShoppingCart, TrendingUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MyHistory() {
  const { currentStaff, roles } = useAuth();
  const { data: allSales = [] } = useSales();
  
  const [dateFilter, setDateFilter] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = roles.includes('admin');

  // Filter sales by current staff
  const mySales = useMemo(() => {
    if (!currentStaff) return [];
    if (isAdmin) return allSales; // Admin can see all, but they use Staff page for that
    return allSales.filter(s => s.staffId === currentStaff.id);
  }, [allSales, currentStaff, isAdmin]);

  // Apply date filter
  const filteredSales = useMemo(() => {
    let filtered = [...mySales];
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    switch (dateFilter) {
      case 'today':
        filtered = filtered.filter(s => new Date(s.createdAt) >= today);
        break;
      case 'yesterday':
        filtered = filtered.filter(s => {
          const d = new Date(s.createdAt);
          return d >= yesterday && d < today;
        });
        break;
      case 'week':
        filtered = filtered.filter(s => new Date(s.createdAt) >= weekAgo);
        break;
      case 'month':
        filtered = filtered.filter(s => new Date(s.createdAt) >= monthAgo);
        break;
      case 'custom':
        if (customDate) {
          const selectedDate = new Date(customDate);
          const nextDay = new Date(selectedDate);
          nextDay.setDate(nextDay.getDate() + 1);
          filtered = filtered.filter(s => {
            const d = new Date(s.createdAt);
            return d >= selectedDate && d < nextDay;
          });
        }
        break;
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.items.some(i => i.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        s.concept?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.tableNumber?.includes(searchTerm)
      );
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [mySales, dateFilter, customDate, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const paid = filteredSales.filter(s => s.paymentStatus === 'cobrado');
    const unpaid = filteredSales.filter(s => s.paymentStatus === 'no_cobrado');
    
    return {
      totalSales: filteredSales.length,
      totalAmount: filteredSales.reduce((sum, s) => sum + s.totalAmount, 0),
      paidAmount: paid.reduce((sum, s) => sum + s.totalAmount, 0),
      unpaidAmount: unpaid.reduce((sum, s) => sum + s.totalAmount, 0),
      paidCount: paid.length,
      unpaidCount: unpaid.length,
    };
  }, [filteredSales]);

  return (
    <Layout>
      <PageHeader 
        title="Mi Historial" 
        description={`Historial de ventas de ${currentStaff?.full_name || 'Mozo'}`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Ventas</p>
                <p className="text-2xl font-bold">{stats.totalSales}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Cobrado ({stats.paidCount})</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(stats.paidAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pendiente ({stats.unpaidCount})</p>
                <p className="text-2xl font-bold text-amber-500">{formatCurrency(stats.unpaidAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por producto, concepto o mesa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="yesterday">Ayer</SelectItem>
            <SelectItem value="week">Última semana</SelectItem>
            <SelectItem value="month">Último mes</SelectItem>
            <SelectItem value="custom">Fecha específica</SelectItem>
          </SelectContent>
        </Select>
        {dateFilter === 'custom' && (
          <Input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="w-44"
          />
        )}
      </div>

      {/* Sales Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha/Hora</TableHead>
                <TableHead>Mesa</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    No hay ventas para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map(sale => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(new Date(sale.createdAt))}
                    </TableCell>
                    <TableCell>
                      {sale.tableNumber ? (
                        <Badge variant="outline">Mesa {sale.tableNumber}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {sale.paymentMethod === 'cash' ? 'Efectivo' : 
                         sale.paymentMethod === 'transfer' ? 'Transferencia' : 'QR'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        sale.paymentStatus === 'cobrado' 
                          ? 'bg-green-500/20 text-green-500' 
                          : 'bg-amber-500'
                      )}>
                        {sale.paymentStatus === 'cobrado' ? 'Cobrada' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(sale.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Layout>
  );
}
