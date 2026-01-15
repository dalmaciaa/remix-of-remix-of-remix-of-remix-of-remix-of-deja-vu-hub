import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useProducts, useAdjustStock } from '@/hooks/useProducts';
import { formatCurrency, formatDateTime, inventoryCategoryLabels, catalogCategoryLabels } from '@/lib/utils-format';
import { Plus, Search, Minus, Coffee, Package, Home, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type ConsumptionType = 'personal' | 'takeaway' | 'waste';

const consumptionTypeLabels: Record<ConsumptionType, string> = {
  personal: 'Consumo Personal',
  takeaway: 'Para Llevar (Cocina)',
  waste: 'Descarte/Pérdida',
};

const consumptionTypeIcons: Record<ConsumptionType, React.ReactNode> = {
  personal: <Coffee className="w-4 h-4" />,
  takeaway: <Home className="w-4 h-4" />,
  waste: <Package className="w-4 h-4" />,
};

interface InternalConsumption {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  type: ConsumptionType;
  notes: string | null;
  staff_name: string;
  created_at: string;
}

export default function InternalConsumption() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [consumptionType, setConsumptionType] = useState<ConsumptionType>('personal');
  const [notes, setNotes] = useState('');

  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { currentStaff } = useAuth();
  const adjustStock = useAdjustStock();
  const queryClient = useQueryClient();

  // Filter products that have stock
  const availableProducts = useMemo(() => {
    return products.filter(p => p.quantity > 0);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return availableProducts.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableProducts, searchTerm]);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Fetch consumption history
  const { data: consumptionHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['internal-consumption'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_adjustments')
        .select('*')
        .in('reason', ['internal_consumption', 'loss'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async () => {
    if (!selectedProduct || quantity <= 0) {
      toast.error('Selecciona un producto y cantidad válida');
      return;
    }

    if (quantity > selectedProduct.quantity) {
      toast.error('Stock insuficiente');
      return;
    }

    // Map consumption type to adjustment reason
    const reasonMap: Record<ConsumptionType, 'internal_consumption' | 'loss'> = {
      personal: 'internal_consumption',
      takeaway: 'internal_consumption',
      waste: 'loss',
    };

    adjustStock.mutate({
      productId: selectedProduct.id,
      newQuantity: selectedProduct.quantity - quantity,
      reason: reasonMap[consumptionType],
      notes: `${consumptionTypeLabels[consumptionType]}${notes ? ': ' + notes : ''} - ${currentStaff?.full_name || 'Admin'}`,
    }, {
      onSuccess: () => {
        toast.success('Consumo registrado correctamente');
        setIsDialogOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ['internal-consumption'] });
      },
    });
  };

  const resetForm = () => {
    setSelectedProductId('');
    setQuantity(1);
    setConsumptionType('personal');
    setNotes('');
    setSearchTerm('');
  };

  const getTypeBadge = (reason: string, notes: string | null) => {
    if (reason === 'loss') {
      return <Badge variant="destructive">Descarte</Badge>;
    }
    if (notes?.includes('Para Llevar')) {
      return <Badge className="bg-blue-500">Para Llevar</Badge>;
    }
    return <Badge className="bg-purple-500">Consumo Personal</Badge>;
  };

  if (loadingProducts) {
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
        title="Consumo Interno" 
        description="Registra consumo personal, productos para llevar o descartes"
      >
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Registrar Consumo
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Coffee className="w-4 h-4" /> Consumo Personal
          </p>
          <p className="text-xl font-semibold text-purple-500">
            {consumptionHistory.filter(c => c.reason === 'internal_consumption' && !c.notes?.includes('Para Llevar')).length} registros
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Home className="w-4 h-4" /> Para Llevar
          </p>
          <p className="text-xl font-semibold text-blue-500">
            {consumptionHistory.filter(c => c.notes?.includes('Para Llevar')).length} registros
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Package className="w-4 h-4" /> Descartes
          </p>
          <p className="text-xl font-semibold text-destructive">
            {consumptionHistory.filter(c => c.reason === 'loss').length} registros
          </p>
        </div>
      </div>

      {/* History Table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingHistory ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : consumptionHistory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hay registros de consumo interno
                </TableCell>
              </TableRow>
            ) : (
              consumptionHistory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDateTime(new Date(item.created_at))}</TableCell>
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell>
                    <span className="text-destructive font-medium">
                      -{item.previous_quantity - item.new_quantity}
                    </span>
                  </TableCell>
                  <TableCell>{getTypeBadge(item.reason, item.notes)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                    {item.notes}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* New Consumption Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Consumo Interno</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Consumption Type */}
            <div>
              <Label>Tipo de Consumo</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(Object.keys(consumptionTypeLabels) as ConsumptionType[]).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={consumptionType === type ? 'default' : 'outline'}
                    className="flex flex-col h-auto py-3"
                    onClick={() => setConsumptionType(type)}
                  >
                    {consumptionTypeIcons[type]}
                    <span className="text-xs mt-1">{consumptionTypeLabels[type]}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Product Search */}
            <div>
              <Label>Producto</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchTerm && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {filteredProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">No hay productos</p>
                  ) : (
                    filteredProducts.slice(0, 10).map(product => (
                      <button
                        key={product.id}
                        onClick={() => {
                          setSelectedProductId(product.id);
                          setSearchTerm('');
                        }}
                        className="w-full text-left p-2 hover:bg-secondary rounded-lg transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{product.name}</span>
                          <span className="text-sm text-muted-foreground">Stock: {product.quantity}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected Product */}
            {selectedProduct && (
              <div className="p-3 bg-secondary/30 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{selectedProduct.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {catalogCategoryLabels[selectedProduct.category as keyof typeof catalogCategoryLabels] || 
                       inventoryCategoryLabels[selectedProduct.category as keyof typeof inventoryCategoryLabels] || 
                       selectedProduct.category}
                    </p>
                  </div>
                  <Badge variant="outline">Stock: {selectedProduct.quantity}</Badge>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <Label>Cantidad</Label>
              <div className="flex items-center gap-3 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center"
                  min={1}
                  max={selectedProduct?.quantity || 999}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={selectedProduct && quantity >= selectedProduct.quantity}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo o detalles adicionales..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!selectedProduct || quantity <= 0 || adjustStock.isPending}
            >
              {adjustStock.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Registrar Consumo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
