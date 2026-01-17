import { useState, useEffect } from 'react';
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
import { Plus, Pencil, Trash2, AlertTriangle, AlertCircle, Package, Search, Settings2, Loader2, BookOpen, Factory } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type CategoryFilter = InventoryCategory | 'all';

// Categorías de inventario (incluyendo semielaborados)
const INVENTORY_CATEGORIES: InventoryCategory[] = ['supplies', 'drinks', 'others', 'semi_elaborated'];

// Categorías que pueden ser ingredientes (no semielaborados, ya que esos no van como ingredientes base)
const INGREDIENT_CATEGORIES: InventoryCategory[] = ['supplies', 'drinks', 'others'];

interface Recipe {
  id?: string;
  ingredient_id: string;
  quantity: string;
  unit: string;
  ingredient_name?: string;
}

const units = ['g', 'kg', 'ml', 'L', 'unidad', 'medida', 'oz'];

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = (searchParams.get('category') as CategoryFilter) || 'all';
  
  const [activeTab, setActiveTab] = useState<CategoryFilter>(initialCategory);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [savingRecipe, setSavingRecipe] = useState(false);

  const { toast } = useToast();
  const { data: allProducts = [], isLoading, refetch } = useProducts();
  const addProductMutation = useAddProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const adjustStockMutation = useAdjustStock();

  // Filtrar solo productos de inventario (no del catálogo de venta)
  const products = allProducts.filter(p => INVENTORY_CATEGORIES.includes(p.category as InventoryCategory));
  
  // Ingredientes disponibles (insumos, bebidas, otros - y semielaborados)
  const availableIngredients = allProducts.filter(p => 
    INGREDIENT_CATEGORIES.includes(p.category as InventoryCategory) || p.category === 'semi_elaborated'
  );

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'supplies' as InventoryCategory,
    purchasePrice: '',
    salePrice: '',
    quantity: '',
    minStock: '',
    unitBase: 'unidad' as UnitType,
    unitsPerPackage: '1',
    packageCount: '0',
  });

  const [adjustData, setAdjustData] = useState({
    newQuantity: '',
    reason: 'correction' as StockAdjustment['reason'],
    notes: '',
  });

  // Recipe state for semi_elaborated products
  const [recipeIngredients, setRecipeIngredients] = useState<Recipe[]>([]);

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
      unitsPerPackage: '1',
      packageCount: '0',
    });
  };

  // Calcular cantidad total basado en paquetes y unidades por paquete
  const calculateTotalQuantity = () => {
    const unitsPerPkg = Number(formData.unitsPerPackage) || 1;
    const pkgCount = Number(formData.packageCount) || 0;
    return unitsPerPkg * pkgCount;
  };

  const handleAdd = () => {
    const totalQuantity = formData.category === 'semi_elaborated' 
      ? Number(formData.quantity) || 0 
      : calculateTotalQuantity();
    // Si es insumo o semielaborado, el precio de venta es 0
    // Si es semielaborado, el precio de compra también es 0
    const salePrice = (formData.category === 'supplies' || formData.category === 'semi_elaborated') ? 0 : Number(formData.salePrice);
    const purchasePrice = formData.category === 'semi_elaborated' ? 0 : Number(formData.purchasePrice);
    const unitsPerPackage = Number(formData.unitsPerPackage) || 1;
    const packageCount = Number(formData.packageCount) || 0;
    
    // Calcular costo por unidad (0 para semielaborados)
    const costPerUnit = formData.category === 'semi_elaborated' ? 0 : (totalQuantity > 0 ? purchasePrice / totalQuantity : null);
    
    addProductMutation.mutate({
      name: formData.name,
      category: formData.category,
      purchasePrice: purchasePrice,
      salePrice: salePrice,
      quantity: totalQuantity,
      minStock: Number(formData.minStock),
      unitBase: formData.unitBase,
      costPerUnit: costPerUnit,
      unitsPerPackage: unitsPerPackage,
      packageCount: packageCount,
    }, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        resetForm();
      }
    });
  };

  const handleEdit = () => {
    if (!selectedProduct) return;
    const totalQuantity = formData.category === 'semi_elaborated' 
      ? Number(formData.quantity) || 0 
      : calculateTotalQuantity();
    // Si es insumo o semielaborado, el precio de venta es 0
    // Si es semielaborado, el precio de compra también es 0
    const salePrice = (formData.category === 'supplies' || formData.category === 'semi_elaborated') ? 0 : Number(formData.salePrice);
    const purchasePrice = formData.category === 'semi_elaborated' ? 0 : Number(formData.purchasePrice);
    const unitsPerPackage = Number(formData.unitsPerPackage) || 1;
    const packageCount = Number(formData.packageCount) || 0;
    
    // Calcular costo por unidad (0 para semielaborados)
    const costPerUnit = formData.category === 'semi_elaborated' ? 0 : (totalQuantity > 0 ? purchasePrice / totalQuantity : null);
    
    updateProductMutation.mutate({
      id: selectedProduct.id,
      updates: {
        name: formData.name,
        category: formData.category,
        purchasePrice: purchasePrice,
        salePrice: salePrice,
        quantity: totalQuantity,
        minStock: Number(formData.minStock),
        unitBase: formData.unitBase,
        costPerUnit: costPerUnit,
        unitsPerPackage: unitsPerPackage,
        packageCount: packageCount,
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
      unitsPerPackage: (product.unitsPerPackage || 1).toString(),
      packageCount: (product.packageCount || 0).toString(),
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

  const openRecipeDialog = async (product: Product) => {
    setSelectedProduct(product);
    
    // Fetch existing recipes for this product
    const { data: recipes } = await supabase
      .from('recipes')
      .select('*')
      .eq('product_id', product.id);
    
    if (recipes && recipes.length > 0) {
      const recipesWithNames = await Promise.all(
        recipes.map(async (recipe) => {
          const { data: ingredientData } = await supabase
            .from('products')
            .select('name')
            .eq('id', recipe.ingredient_id)
            .maybeSingle();
          
          return {
            id: recipe.id,
            ingredient_id: recipe.ingredient_id,
            quantity: recipe.quantity.toString(),
            unit: recipe.unit,
            ingredient_name: ingredientData?.name || 'Desconocido'
          };
        })
      );
      setRecipeIngredients(recipesWithNames);
    } else {
      setRecipeIngredients([{ ingredient_id: '', quantity: '', unit: 'unidad' }]);
    }
    
    setIsRecipeDialogOpen(true);
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

  const handleSaveRecipe = async () => {
    if (!selectedProduct) return;

    try {
      setSavingRecipe(true);

      // Delete existing recipes
      await supabase
        .from('recipes')
        .delete()
        .eq('product_id', selectedProduct.id);

      // Insert new recipes
      if (recipeIngredients.length > 0) {
        const recipesToInsert = recipeIngredients
          .filter(r => r.ingredient_id && r.quantity)
          .map(r => ({
            product_id: selectedProduct.id,
            ingredient_id: r.ingredient_id,
            quantity: parseFloat(r.quantity),
            unit: r.unit
          }));

        if (recipesToInsert.length > 0) {
          const { error } = await supabase
            .from('recipes')
            .insert(recipesToInsert);

          if (error) throw error;
        }
      }

      // Mark product as compound
      await supabase
        .from('products')
        .update({ is_compound: true })
        .eq('id', selectedProduct.id);

      toast({
        title: 'Receta guardada',
        description: 'Los ingredientes han sido actualizados'
      });

      setIsRecipeDialogOpen(false);
      refetch();
    } catch (error: any) {
      console.error('Error saving recipe:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo guardar la receta'
      });
    } finally {
      setSavingRecipe(false);
    }
  };

  // State for producing semi-elaborated products
  const [isProduceDialogOpen, setIsProduceDialogOpen] = useState(false);
  const [produceQuantity, setProduceQuantity] = useState('1');
  const [producing, setProducing] = useState(false);

  const openProduceDialog = (product: Product) => {
    setSelectedProduct(product);
    setProduceQuantity('1');
    setIsProduceDialogOpen(true);
  };

  const handleProduce = async () => {
    if (!selectedProduct) return;

    try {
      setProducing(true);
      const quantityToProduce = Number(produceQuantity);

      if (quantityToProduce <= 0) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'La cantidad debe ser mayor a 0'
        });
        return;
      }

      // Fetch recipe for this product
      const { data: recipeItems, error: recipeError } = await supabase
        .from('recipes')
        .select('ingredient_id, quantity')
        .eq('product_id', selectedProduct.id);

      if (recipeError) throw recipeError;

      if (!recipeItems || recipeItems.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Sin receta',
          description: 'Este producto no tiene receta configurada'
        });
        return;
      }

      // Get current ingredient quantities
      const ingredientIds = recipeItems.map(r => r.ingredient_id);
      const { data: ingredients, error: ingError } = await supabase
        .from('products')
        .select('id, name, quantity, min_stock')
        .in('id', ingredientIds);

      if (ingError) throw ingError;

      // Check if we have enough of each ingredient
      const shortages: string[] = [];
      for (const recipeItem of recipeItems) {
        const ingredient = ingredients?.find(i => i.id === recipeItem.ingredient_id);
        if (!ingredient) continue;

        const requiredQuantity = Number(recipeItem.quantity) * quantityToProduce;
        const availableQuantity = Number(ingredient.quantity);

        if (availableQuantity < requiredQuantity) {
          shortages.push(`${ingredient.name}: necesario ${requiredQuantity}, disponible ${availableQuantity}`);
        }
      }

      if (shortages.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Stock insuficiente',
          description: shortages.join('; ')
        });
        return;
      }

      // Deduct ingredients
      for (const recipeItem of recipeItems) {
        const ingredient = ingredients?.find(i => i.id === recipeItem.ingredient_id);
        if (!ingredient) continue;

        const quantityToDeduct = Number(recipeItem.quantity) * quantityToProduce;
        const newQuantity = Number(ingredient.quantity) - quantityToDeduct;
        const newStatus = newQuantity <= 0 ? 'critical' : newQuantity <= ingredient.min_stock ? 'low' : 'normal';

        await supabase
          .from('products')
          .update({ quantity: newQuantity, status: newStatus })
          .eq('id', recipeItem.ingredient_id);
      }

      // Increase semi-elaborated product quantity
      const newProductQuantity = Number(selectedProduct.quantity) + quantityToProduce;
      const newProductStatus = newProductQuantity <= 0 ? 'critical' : newProductQuantity <= selectedProduct.minStock ? 'low' : 'normal';

      await supabase
        .from('products')
        .update({ quantity: newProductQuantity, status: newProductStatus })
        .eq('id', selectedProduct.id);

      toast({
        title: 'Producción completada',
        description: `Se fabricaron ${quantityToProduce} unidades de ${selectedProduct.name}`
      });

      setIsProduceDialogOpen(false);
      refetch();
    } catch (error: any) {
      console.error('Error producing:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo fabricar el producto'
      });
    } finally {
      setProducing(false);
    }
  };

  const addRecipeRow = () => {
    setRecipeIngredients([...recipeIngredients, { ingredient_id: '', quantity: '', unit: 'unidad' }]);
  };

  const removeRecipeRow = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const updateRecipeRow = (index: number, field: string, value: string) => {
    const updated = [...recipeIngredients];
    updated[index] = { ...updated[index], [field]: value };
    
    // Si se selecciona un ingrediente, auto-llenar la unidad
    if (field === 'ingredient_id') {
      const selectedIngredient = availableIngredients.find(ing => ing.id === value);
      if (selectedIngredient) {
        updated[index].unit = selectedIngredient.unitBase || 'unidad';
      }
    }
    
    setRecipeIngredients(updated);
  };

  // Mostrar precio de venta solo si no es insumo ni semielaborado
  const showSalePrice = formData.category !== 'supplies' && formData.category !== 'semi_elaborated';
  
  // Mostrar precio de compra solo si no es semielaborado
  const showPurchasePrice = formData.category !== 'semi_elaborated';
  
  // Mostrar separación de paquetes para insumos y bebidas (no para semielaborados)
  // Mostrar separación de paquetes para insumos, bebidas y otros (no para semielaborados)
  const showPackageSeparation = formData.category === 'supplies' || formData.category === 'drinks' || formData.category === 'others';
  
  // Los semielaborados se manejan en unidades simples
  const isSemiElaborated = formData.category === 'semi_elaborated';

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
              <SelectItem value="semi_elaborated">Semielaborado</SelectItem>
              <SelectItem value="others">Otros</SelectItem>
            </SelectContent>
          </Select>
          {formData.category === 'semi_elaborated' && (
            <p className="text-xs text-muted-foreground mt-1">
              Los semielaborados se hacen con insumos y pueden usarse como ingredientes
            </p>
          )}
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
      
      {showPackageSeparation && (
        <div className="p-3 bg-secondary/30 rounded-lg space-y-3">
          <p className="text-sm font-medium">Gestión de paquetes</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unitsPerPackage">{formData.unitBase === 'unidad' ? 'Unidades por paquete' : `${unitLabels[formData.unitBase] || formData.unitBase} por paquete`}</Label>
              <Input
                id="unitsPerPackage"
                type="number"
                step="0.01"
                value={formData.unitsPerPackage}
                onChange={(e) => setFormData((prev) => ({ ...prev, unitsPerPackage: e.target.value }))}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.unitBase === 'unidad' 
                  ? 'Ej: un paquete de 12 unidades = 12' 
                  : formData.unitBase === 'ml' 
                    ? 'Ej: una botella de 750ml = 750' 
                    : formData.unitBase === 'g'
                      ? 'Ej: un paquete de 1000g = 1000'
                      : `Cantidad en ${formData.unitBase} por paquete`}
              </p>
            </div>
            <div>
              <Label htmlFor="packageCount">Cantidad de paquetes</Label>
              <Input
                id="packageCount"
                type="number"
                step="0.01"
                value={formData.packageCount}
                onChange={(e) => setFormData((prev) => ({ ...prev, packageCount: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <p className="text-sm text-primary font-medium">
            Stock Total: {calculateTotalQuantity()} {unitLabels[formData.unitBase] || formData.unitBase}
          </p>
        </div>
      )}
      
      {!showPackageSeparation && (
        <div>
          <Label htmlFor="quantity">Cantidad ({formData.unitBase})</Label>
          <Input
            id="quantity"
            type="number"
            step="0.01"
            value={formData.quantity}
            onChange={(e) => {
              setFormData((prev) => ({ 
                ...prev, 
                quantity: e.target.value,
                packageCount: e.target.value,
                unitsPerPackage: '1'
              }));
            }}
            placeholder="0"
          />
        </div>
      )}

      {/* Precios - Solo mostrar si no es semielaborado */}
      {showPurchasePrice && (
        <div className={cn("grid gap-4", showSalePrice ? "grid-cols-2" : "grid-cols-1")}>
          <div>
            <Label htmlFor="purchasePrice">Precio Compra (total)</Label>
            <Input
              id="purchasePrice"
              type="number"
              value={formData.purchasePrice}
              onChange={(e) => setFormData((prev) => ({ ...prev, purchasePrice: e.target.value }))}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se registrará como gasto (saldo negativo)
            </p>
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
      )}
      
      {/* Mensaje para semielaborados */}
      {isSemiElaborated && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-500 font-medium">💡 Producto Semielaborado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Los semielaborados no tienen precio de compra ni venta. Después de crear el producto, define su receta y usa el botón <strong>Fabricar</strong> para producir unidades descontando los ingredientes automáticamente.
          </p>
        </div>
      )}
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
      <PageHeader title="Inventario" description="Gestión de stock, insumos y semielaborados">
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
          <TabsTrigger value="semi_elaborated">Semielaborados</TabsTrigger>
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
                  <TableHead className="text-right hidden md:table-cell">P. Venta</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">Paquetes</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                          {product.category === 'semi_elaborated' && (
                            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Semi</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {inventoryCategoryLabels[product.category as InventoryCategory] || product.category}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(product.purchasePrice)}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {product.category === 'supplies' ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          formatCurrency(product.salePrice)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.quantity} <span className="text-xs text-muted-foreground">{product.unitBase}</span>
                      </TableCell>
                      <TableCell className="text-center hidden lg:table-cell">
                        {product.packageCount > 0 ? (
                          <span className="text-xs">
                            {product.packageCount} × {product.unitsPerPackage}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
                          {product.category === 'semi_elaborated' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openProduceDialog(product)} title="Fabricar">
                                <Factory className="w-4 h-4 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openRecipeDialog(product)} title="Receta">
                                <BookOpen className="w-4 h-4" />
                              </Button>
                            </>
                          )}
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
        <DialogContent className="max-w-lg">
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
        <DialogContent className="max-w-lg">
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
              <p className="text-lg font-semibold">{selectedProduct?.quantity} {selectedProduct?.unitBase}</p>
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

      {/* Recipe Dialog for semi_elaborated */}
      <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receta: {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Agrega los ingredientes (insumos u otros semielaborados) que se usan para preparar este producto.
            </p>
            {recipeIngredients.map((ingredient, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <Select
                  value={ingredient.ingredient_id}
                  onValueChange={(value) => updateRecipeRow(index, 'ingredient_id', value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar ingrediente" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableIngredients
                      .filter(ing => ing.id !== selectedProduct?.id)
                      .map(ing => (
                        <SelectItem key={ing.id} value={ing.id}>
                          {ing.name} ({inventoryCategoryLabels[ing.category as InventoryCategory] || ing.category}) - {ing.unitBase || 'unidad'}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  value={ingredient.quantity}
                  onChange={(e) => updateRecipeRow(index, 'quantity', e.target.value)}
                  placeholder="Cant."
                  className="w-24"
                />
                <Select
                  value={ingredient.unit}
                  onValueChange={(value) => updateRecipeRow(index, 'unit', value)}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => removeRecipeRow(index)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addRecipeRow} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Ingrediente
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecipeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveRecipe} disabled={savingRecipe}>
              {savingRecipe ? 'Guardando...' : 'Guardar Receta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Produce Semi-Elaborated Dialog */}
      <Dialog open={isProduceDialogOpen} onOpenChange={setIsProduceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fabricar: {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-secondary/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Stock actual</p>
              <p className="text-lg font-semibold">{selectedProduct?.quantity} {selectedProduct?.unitBase}</p>
            </div>
            <div>
              <Label htmlFor="produceQuantity">Cantidad a fabricar</Label>
              <Input
                id="produceQuantity"
                type="number"
                min="1"
                step="1"
                value={produceQuantity}
                onChange={(e) => setProduceQuantity(e.target.value)}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se descontarán los ingredientes de la receta automáticamente
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProduceDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleProduce} disabled={producing}>
              {producing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Factory className="w-4 h-4 mr-2" />}
              Fabricar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
