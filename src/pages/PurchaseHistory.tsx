import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useInventoryPurchases } from '@/hooks/useInventoryPurchases';
import { formatCurrency, paymentMethodLabels } from '@/lib/utils-format';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Package, ShoppingCart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Search } from 'lucide-react';

export default function PurchaseHistory() {
  const { data: purchases = [], isLoading } = useInventoryPurchases();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPurchases = purchases.filter(p =>
    p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalSpent = filteredPurchases.reduce((sum, p) => sum + p.total_cost, 0);

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
      <PageHeader 
        title="Historial de Compras" 
        description="Registro de todos los reabastecimientos de inventario"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">Total Compras</p>
          <p className="text-2xl font-semibold">{filteredPurchases.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">Total Gastado</p>
          <p className="text-2xl font-semibold text-destructive">{formatCurrency(totalSpent)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por producto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Precio Compra</TableHead>
              <TableHead className="text-center hidden sm:table-cell">Método Pago</TableHead>
              <TableHead className="hidden md:table-cell">Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPurchases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  No hay compras registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredPurchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(purchase.created_at), "dd MMM yyyy", { locale: es })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(purchase.created_at), "HH:mm")}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      {purchase.product_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {purchase.quantity} <span className="text-xs text-muted-foreground">{purchase.unit}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    {formatCurrency(purchase.total_cost)}
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    <span className="text-xs px-2 py-1 rounded-full bg-secondary">
                      {paymentMethodLabels[purchase.payment_method as keyof typeof paymentMethodLabels]}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {purchase.notes || '-'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
}
