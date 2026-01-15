import { useProducts } from '@/hooks/useProducts';
import { AlertTriangle, AlertCircle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export function LowStockAlert() {
  const { data: products = [] } = useProducts();
  const lowStockProducts = products.filter((p) => p.status === 'low' || p.status === 'critical');

  if (lowStockProducts.length === 0) {
    return (
      <div className="glass-card p-6 animate-fade-in bg-success/5 border-success/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-success/20">
            <Package className="w-5 h-5 text-success" />
          </div>
          <h3 className="font-display text-lg font-semibold">Stock OK</h3>
        </div>
        <p className="text-muted-foreground text-sm">No hay productos con stock bajo</p>
      </div>
    );
  }

  const criticalCount = lowStockProducts.filter(p => p.status === 'critical').length;
  const lowCount = lowStockProducts.filter(p => p.status === 'low').length;

  return (
    <div className={cn(
      "glass-card p-6 animate-fade-in border-2",
      criticalCount > 0 ? "bg-destructive/5 border-destructive/30" : "bg-warning/5 border-warning/30"
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            criticalCount > 0 ? "bg-destructive/20" : "bg-warning/20"
          )}>
            {criticalCount > 0 ? (
              <AlertCircle className="w-5 h-5 text-destructive" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-warning" />
            )}
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Alertas de Stock</h3>
            <p className="text-xs text-muted-foreground">
              {criticalCount > 0 && <span className="text-destructive font-medium">{criticalCount} crítico{criticalCount !== 1 ? 's' : ''}</span>}
              {criticalCount > 0 && lowCount > 0 && ' • '}
              {lowCount > 0 && <span className="text-warning font-medium">{lowCount} bajo{lowCount !== 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>
        <Link 
          to="/inventory" 
          className="text-xs text-primary hover:underline font-medium"
        >
          Ver todo
        </Link>
      </div>
      
      <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
        {lowStockProducts.slice(0, 5).map((product) => (
          <div
            key={product.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border",
              product.status === 'critical' 
                ? 'bg-destructive/10 border-destructive/20' 
                : 'bg-warning/10 border-warning/20'
            )}
          >
            <div className="flex items-center gap-3">
              {product.status === 'critical' ? (
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className={cn(
                  "font-medium text-sm truncate",
                  product.status === 'critical' ? 'text-destructive' : 'text-warning'
                )}>
                  {product.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Stock: <span className="font-medium">{product.quantity}</span> / Mín: {product.minStock}
                </p>
              </div>
            </div>
            <span className={cn(
              "text-xs font-bold px-2 py-1 rounded-full flex-shrink-0",
              product.status === 'critical' 
                ? 'bg-destructive text-destructive-foreground' 
                : 'bg-warning text-warning-foreground'
            )}>
              {product.status === 'critical' ? 'CRÍTICO' : 'BAJO'}
            </span>
          </div>
        ))}
      </div>
      
      {lowStockProducts.length > 5 && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          +{lowStockProducts.length - 5} productos más
        </p>
      )}
    </div>
  );
}