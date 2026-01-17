import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, BookOpen, Search, ChefHat, Wine, UtensilsCrossed, GlassWater } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatCurrency, catalogCategoryLabels, inventoryCategoryLabels } from '@/lib/utils-format';
import { CatalogCategory, InventoryCategory } from '@/types';

interface Recipe {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  ingredient_name?: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  category: CatalogCategory;
  sale_price: number;
  is_for_sale: boolean;
  is_compound: boolean;
  requires_kitchen: boolean;
  recipes: Recipe[];
}

interface ProductForm {
  name: string;
  category: CatalogCategory;
  sale_price: string;
  is_for_sale: boolean;
  is_compound: boolean;
  requires_kitchen: boolean;
}

const emptyForm: ProductForm = {
  name: '',
  category: 'food',
  sale_price: '',
  is_for_sale: true,
  is_compound: false,
  requires_kitchen: false
};

const categories: { value: CatalogCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'food', label: 'Comida', icon: UtensilsCrossed },
  { value: 'cocktails', label: 'Cócteles', icon: GlassWater },
  { value: 'drinks', label: 'Bebidas', icon: Wine },
];

const units = ['g', 'kg', 'ml', 'L', 'unidad', 'medida', 'oz'];

// Categorías de inventario para ingredientes (incluye semielaborados)
const INVENTORY_CATEGORIES: InventoryCategory[] = ['supplies', 'drinks', 'others', 'semi_elaborated'];

export default function Catalog() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [formData, setFormData] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  
  // Recipe editing
  const [recipeIngredients, setRecipeIngredients] = useState<{ ingredient_id: string; quantity: string; unit: string }[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<{ id: string; name: string; category: string; unit_base: string }[]>([]);
  
  const { toast } = useToast();

  const fetchProducts = async () => {
    try {
      // Obtener productos del catálogo (food, cocktails, drinks que son is_for_sale)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .in('category', ['food', 'cocktails', 'drinks'])
        .eq('is_for_sale', true)
        .order('name');

      if (productsError) throw productsError;

      // Fetch recipes for each product
      const productsWithRecipes = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: recipesData } = await supabase
            .from('recipes')
            .select('*')
            .eq('product_id', product.id);
          
          // Get ingredient names
          const recipesWithNames = await Promise.all(
            (recipesData || []).map(async (recipe) => {
              const { data: ingredientData } = await supabase
                .from('products')
                .select('name')
                .eq('id', recipe.ingredient_id)
                .maybeSingle();
              
              return {
                ...recipe,
                ingredient_name: ingredientData?.name || 'Desconocido'
              };
            })
          );
          
          return {
            ...product,
            recipes: recipesWithNames
          } as CatalogProduct;
        })
      );

      setProducts(productsWithRecipes);
      
      // Obtener ingredientes disponibles (productos del inventario)
      const { data: ingredientsData } = await supabase
        .from('products')
        .select('id, name, category, unit_base')
        .in('category', INVENTORY_CATEGORIES)
        .order('name');
      
      setAvailableIngredients(ingredientsData || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los productos'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'all' || product.category === activeTab;
    return matchesSearch && matchesTab;
  });

  // Determinar si el producto necesita receta basado en su categoría
  const needsRecipe = (category: CatalogCategory) => category === 'food' || category === 'cocktails';

  const handleAddProduct = async () => {
    if (!formData.name || !formData.sale_price) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Complete todos los campos obligatorios'
      });
      return;
    }

    try {
      setSaving(true);

      // Comida siempre requiere cocina, otros no
      const requiresKitchen = formData.category === 'food';
      // Comida y cócteles son compuestos (tienen receta)
      const isCompound = needsRecipe(formData.category);

      const { error } = await supabase
        .from('products')
        .insert({
          name: formData.name,
          category: formData.category,
          sale_price: parseFloat(formData.sale_price),
          is_for_sale: true,
          is_compound: isCompound,
          requires_kitchen: requiresKitchen
        });

      if (error) throw error;

      toast({
        title: 'Producto creado',
        description: `${formData.name} ha sido agregado al catálogo`
      });

      setIsAddDialogOpen(false);
      setFormData(emptyForm);
      fetchProducts();
    } catch (error: any) {
      console.error('Error adding product:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo crear el producto'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditProduct = async () => {
    if (!selectedProduct || !formData.name) {
      return;
    }

    try {
      setSaving(true);

      const requiresKitchen = formData.category === 'food';
      const isCompound = needsRecipe(formData.category);

      const { error } = await supabase
        .from('products')
        .update({
          name: formData.name,
          category: formData.category,
          sale_price: parseFloat(formData.sale_price),
          is_for_sale: true,
          is_compound: isCompound,
          requires_kitchen: requiresKitchen
        })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      toast({
        title: 'Producto actualizado',
        description: `${formData.name} ha sido actualizado correctamente`
      });

      setIsEditDialogOpen(false);
      setSelectedProduct(null);
      setFormData(emptyForm);
      fetchProducts();
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo actualizar el producto'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!selectedProduct) return;

    try {
      setSaving(true);

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

      toast({
        title: 'Receta guardada',
        description: 'Los ingredientes han sido actualizados'
      });

      setIsRecipeDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      console.error('Error saving recipe:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo guardar la receta'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      setSaving(true);

      // First delete associated recipes
      await supabase
        .from('recipes')
        .delete()
        .eq('product_id', selectedProduct.id);

      // Then delete the product
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', selectedProduct.id);

      if (error) throw error;

      toast({
        title: 'Producto eliminado',
        description: `${selectedProduct.name} ha sido eliminado`
      });

      setIsDeleteDialogOpen(false);
      setSelectedProduct(null);
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo eliminar el producto. Puede estar siendo usado en ventas.'
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (product: CatalogProduct) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      sale_price: product.sale_price.toString(),
      is_for_sale: product.is_for_sale,
      is_compound: product.is_compound,
      requires_kitchen: product.requires_kitchen
    });
    setIsEditDialogOpen(true);
  };

  const openRecipeDialog = (product: CatalogProduct) => {
    setSelectedProduct(product);
    setRecipeIngredients(
      product.recipes.map(r => ({
        ingredient_id: r.ingredient_id,
        quantity: r.quantity.toString(),
        unit: r.unit
      }))
    );
    if (product.recipes.length === 0) {
      setRecipeIngredients([{ ingredient_id: '', quantity: '', unit: 'unidad' }]);
    }
    setIsRecipeDialogOpen(true);
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
        updated[index].unit = selectedIngredient.unit_base || 'unidad';
      }
    }
    
    setRecipeIngredients(updated);
  };

  const getCategoryIcon = (category: CatalogCategory) => {
    const cat = categories.find(c => c.value === category);
    return cat?.icon || UtensilsCrossed;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader 
        title="Catálogo de Venta" 
        description="Productos disponibles para la venta con sus recetas"
      >
        <Button onClick={() => { setFormData(emptyForm); setIsAddDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Producto
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Buscar productos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">Todos ({products.length})</TabsTrigger>
          <TabsTrigger value="food">Comida</TabsTrigger>
          <TabsTrigger value="cocktails">Cócteles</TabsTrigger>
          <TabsTrigger value="drinks">Bebidas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Receta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay productos en el catálogo
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map(product => {
                  const IconComponent = getCategoryIcon(product.category);
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-4 h-4 text-muted-foreground" />
                          {product.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {catalogCategoryLabels[product.category]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(product.sale_price)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {product.requires_kitchen && (
                            <Badge className="bg-amber-500">
                              <ChefHat className="w-3 h-3 mr-1" /> Cocina
                            </Badge>
                          )}
                          {product.is_compound && !product.requires_kitchen && (
                            <Badge variant="secondary">Con receta</Badge>
                          )}
                          {!product.is_compound && (
                            <Badge variant="outline">Directo</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.is_compound ? (
                          <Button variant="ghost" size="sm" onClick={() => openRecipeDialog(product)}>
                            <BookOpen className="w-4 h-4 mr-1" />
                            {product.recipes.length} ingredientes
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(product)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedProduct(product); setIsDeleteDialogOpen(true); }}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Product Dialog */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setIsEditDialogOpen(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditDialogOpen ? 'Editar Producto' : 'Nuevo Producto del Catálogo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre del producto"
              />
            </div>
            <div>
              <Label>Categoría</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as CatalogCategory }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.category === 'food' && 'Requiere cocina y receta con ingredientes'}
                {formData.category === 'cocktails' && 'Requiere receta con ingredientes'}
                {formData.category === 'drinks' && 'Se vende directo del inventario'}
              </p>
            </div>
            <div>
              <Label>Precio de Venta *</Label>
              <Input
                type="number"
                value={formData.sale_price}
                onChange={(e) => setFormData(prev => ({ ...prev, sale_price: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setIsEditDialogOpen(false); }}>
              Cancelar
            </Button>
            <Button onClick={isEditDialogOpen ? handleEditProduct : handleAddProduct} disabled={saving}>
              {saving ? 'Guardando...' : (isEditDialogOpen ? 'Guardar' : 'Crear')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipe Dialog */}
      <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receta: {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Agrega los ingredientes del inventario que se usan para preparar este producto.
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
                    {availableIngredients.map(ing => (
                      <SelectItem key={ing.id} value={ing.id}>
                        {ing.name} ({inventoryCategoryLabels[ing.category as InventoryCategory] || ing.category}) - {ing.unit_base || 'unidad'}
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
            <Button onClick={handleSaveRecipe} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Receta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará {selectedProduct?.name} del catálogo de venta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
