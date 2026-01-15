import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProducts, useAddProduct, useUpdateProduct, useDeleteProduct, useAdjustStock } from '@/hooks/useProducts';
import { Product, InventoryCategory, StockAdjustment, UnitType } from '@/types';
import { formatCurrency, inventoryCategoryLabels, stockStatusLabels, adjustmentReasonLabels, unitLabels } from '@/lib/utils-format';
import { Plus, Pencil, Trash2, AlertTriangle, AlertCircle, Package, Search, Settings2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';

type CategoryFilter = InventoryCategory | 'all';

// Solo productos de inventario (insumos, bebidas, otros)
const INVENTORY_CATEGORIES: InventoryCategory[] = ['supplies', 'drinks', 'others'];

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = (searchParams.get('category') as CategoryFilter) || 'all';
  
  const [activeTab, setActiveTab] = useState<CategoryFilter>(initialCategory);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: allProducts = [], isLoading } = useProducts();
  const addProductMutation = useAddProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const adjustStockMutation = useAdjustStock();

  // Filtrar solo productos de inventario (no del catálogo de venta)
  const products = allProducts.filter(p => INVENTORY_CATEGORIES.includes(p.category as InventoryCategory));

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'supplies' as InventoryCategory,
    purchasePrice: '',
    salePrice: '',
    quantity: '',
    minStock: '',
    unitBase: 'unidad' as UnitType,
  });

  const [adjustData, setAdjustData] = useState({
    newQuantity: '',
    reason: 'correction' as StockAdjustment['reason'],
    notes: '',
  });

  const filteredProducts = products.filter((p) => {
    const matchesCategory = activeTab === 'all' || p.category === activeTab;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalValue = filteredProducts.reduce((sum, p) => sum + p.quantity * p.purchasePrice, 0);
  const lowStockCount = filteredProducts.filter((p) => p.status === 'low' || p.status === 'critical').length;

  const handleTabChange = (value: string) => {
    setActiveTab(value as CategoryFilter);
    if (value === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ category: value });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'supplies',
      purchasePrice: '',
      salePrice: '',
      quantity: '',
      minStock: '',
      unitBase: 'unidad',
    });
  };

  const handleAdd = () => {
    // Si es insumo, el precio de venta es 0
    const salePrice = formData.category === 'supplies' ? 0 : Number(formData.salePrice);
    const quantity = Number(formData.quantity);
    const purchasePrice = Number(formData.purchasePrice);
    
    // Calcular costo por unidad
    const costPerUnit = quantity > 0 ? purchasePrice / quantity : null;
    
    addProductMutation.mutate({
      name: formData.name,
      category: formData.category,
      purchasePrice: purchasePrice,
      salePrice: salePrice,
      quantity: quantity,
      minStock: Number(formData.minStock),
      unitBase: formData.unitBase,
      costPerUnit: costPerUnit,
    }, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        resetForm();
      }
    });
  };

  const handleEdit = () => {
    if (!selectedProduct) return;
    // Si es insumo, el precio de venta es 0
    const salePrice = formData.category === 'supplies' ? 0 : Number(formData.salePrice);
    const quantity = Number(formData.quantity);
    const purchasePrice = Number(formData.purchasePrice);
    
    // Calcular costo por unidad
    const costPerUnit = quantity > 0 ? purchasePrice / quantity : null;
    
    updateProductMutation.mutate({
      id: selectedProduct.id,
      updates: {
        name: formData.name,
        category: formData.category,
        purchasePrice: purchasePrice,
        salePrice: salePrice,
        quantity: quantity,
        minStock: Number(formData.minStock),
        unitBase: formData.unitBase,
        costPerUnit: costPerUnit,
      }
    }, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
        setSelectedProduct(null);
        resetForm();
      }
    });
  };

  const handleDelete = (product: Product) => {
    if (confirm(`¿Eliminar ${product.name}?`)) {
      deleteProductMutation.mutate(product.id);
    }
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      category: product.category as InventoryCategory,
      purchasePrice: product.purchasePrice.toString(),
      salePrice: product.salePrice.toString(),
      quantity: product.quantity.toString(),
      minStock: product.minStock.toString(),
      unitBase: (product.unitBase as UnitType) || 'unidad',
    });
    setIsEditDialogOpen(true);
  };

  const openAdjustDialog = (product: Product) => {
    setSelectedProduct(product);
    setAdjustData({
      newQuantity: product.quantity.toString(),
      reason: 'correction',
      notes: '',
    });
    setIsAdjustDialogOpen(true);
  };

  const handleAdjust = () => {
    if (!selectedProduct) return;
    adjustStockMutation.mutate({
      productId: selectedProduct.id,
      newQuantity: Number(adjustData.newQuantity),
      reason: adjustData.reason,
      notes: adjustData.notes,
    }, {
      onSuccess: () => {
        setIsAdjustDialogOpen(false);
        setSelectedProduct(null);
      }
    });
  };

  // Mostrar precio de venta solo si no es insumo
  const showSalePrice = formData.category !== 'supplies';

  const productFormContent = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Nombre del producto"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Categoría</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value as InventoryCategory }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="supplies">Insumos</SelectItem>
              <SelectItem value="drinks">Bebidas</SelectItem>
              <SelectItem value="others">Otros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="unitBase">Unidad de medida</Label>
          <Select
            value={formData.unitBase}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, unitBase: value as UnitType }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unidad">Unidad</SelectItem>
              <SelectItem value="kg">Kilogramos (kg)</SelectItem>
              <SelectItem value="g">Gramos (g)</SelectItem>
              <SelectItem value="L">Litros (L)</SelectItem>
              <SelectItem value="ml">Mililitros (ml)</SelectItem>
              <SelectItem value="medida">Medida (trago)</SelectItem>
              <SelectItem value="oz">Onzas (oz)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className={cn("grid gap-4", showSalePrice ? "grid-cols-2" : "grid-cols-1")}>
        <div>
          <Label htmlFor="purchasePrice">Precio Compra</Label>
          <Input
            id="purchasePrice"
            type="number"
            value={formData.purchasePrice}
            onChange={(e) => setFormData((prev) => ({ ...prev, purchasePrice: e.target.value }))}
            placeholder="0"
          />
        </div>
        {showSalePrice && (
          <div>
            <Label htmlFor="salePrice">Precio Venta</Label>
            <Input
              id="salePrice"
              type="number"
              value={formData.salePrice}
              onChange={(e) => setFormData((prev) => ({ ...prev, salePrice: e.target.value }))}
              placeholder="0"
            />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="quantity">Cantidad ({formData.unitBase})</Label>
          <Input
            id="quantity"
            type="number"
            step="0.01"
            value={formData.quantity}
            onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="minStock">Stock Mínimo ({formData.unitBase})</Label>
          <Input
            id="minStock"
            type="number"
            step="0.01"
            value={formData.minStock}
            onChange={(e) => setFormData((prev) => ({ ...prev, minStock: e.target.value }))}
            placeholder="0"
          />
        </div>
      </div>
    </div>
  );

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
      <PageHeader title="Inventario" description="Gestión de stock e insumos">
        <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar al Inventario
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">Productos</p>
          <p className="text-2xl font-semibold">{filteredProducts.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">Valor Total</p>
          <p className="text-2xl font-semibold text-primary">{formatCurrency(totalValue)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">Stock Bajo</p>
          <p className={cn("text-2xl font-semibold", lowStockCount > 0 ? "text-warning" : "text-success")}>
            {lowStockCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="supplies">Insumos</TabsTrigger>
          <TabsTrigger value="drinks">Bebidas</TabsTrigger>
          <TabsTrigger value="others">Otros</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                  <TableHead className="text-right">P. Compra</TableHead>
                  <TableHead className="text-right">P. Venta</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-center">Unidad</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      No hay productos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {product.status === 'critical' && <AlertCircle className="w-4 h-4 text-destructive" />}
                          {product.status === 'low' && <AlertTriangle className="w-4 h-4 text-warning" />}
                          {product.name}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {inventoryCategoryLabels[product.category as InventoryCategory] || product.category}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(product.purchasePrice)}</TableCell>
                      <TableCell className="text-right">
                        {product.category === 'supplies' ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          formatCurrency(product.salePrice)
                        )}
                      </TableCell>
                      <TableCell className="text-right">{product.quantity}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-muted-foreground uppercase">{product.unitBase || 'unidad'}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "status-badge",
                          product.status === 'normal' && "status-badge-success",
                          product.status === 'low' && "status-badge-warning",
                          product.status === 'critical' && "status-badge-danger"
                        )}>
                          {stockStatusLabels[product.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openAdjustDialog(product)}>
                            <Settings2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(product)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar al Inventario</DialogTitle>
          </DialogHeader>
          {productFormContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={addProductMutation.isPending}>
              {addProductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          {productFormContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateProductMutation.isPending}>
              {updateProductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Stock - {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cantidad Actual</Label>
              <p className="text-lg font-semibold">{selectedProduct?.quantity}</p>
            </div>
            <div>
              <Label htmlFor="newQuantity">Nueva Cantidad</Label>
              <Input
                id="newQuantity"
                type="number"
                value={adjustData.newQuantity}
                onChange={(e) => setAdjustData({ ...adjustData, newQuantity: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="reason">Razón</Label>
              <Select
                value={adjustData.reason}
                onValueChange={(value) => setAdjustData({ ...adjustData, reason: value as StockAdjustment['reason'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loss">Pérdida</SelectItem>
                  <SelectItem value="internal_consumption">Consumo interno</SelectItem>
                  <SelectItem value="breakage">Rotura</SelectItem>
                  <SelectItem value="correction">Corrección</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notas</Label>
              <Input
                id="notes"
                value={adjustData.notes}
                onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdjust} disabled={adjustStockMutation.isPending}>
              {adjustStockMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Ajustar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
