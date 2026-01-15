import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useExpenses, useAddExpense, useUpdateExpense, useDeleteExpense } from '@/hooks/useExpenses';
import { useSales } from '@/hooks/useSales';
import { Expense, ExpenseCategory, PaymentMethod } from '@/types';
import { formatCurrency, formatDateTime, expenseCategoryLabels, paymentMethodLabels, isToday, isThisMonth } from '@/lib/utils-format';
import { Plus, Pencil, Trash2, Receipt, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type ViewFilter = 'today' | 'month' | 'all';

const COLORS = ['hsl(38, 92%, 50%)', 'hsl(320, 70%, 45%)', 'hsl(142, 70%, 45%)', 'hsl(200, 70%, 50%)', 'hsl(270, 60%, 50%)', 'hsl(0, 72%, 51%)'];

export default function Expenses() {
  const [viewFilter, setViewFilter] = useState<ViewFilter>('month');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses();
  const { data: sales = [], isLoading: loadingSales } = useSales();
  const addExpenseMutation = useAddExpense();
  const updateExpenseMutation = useUpdateExpense();
  const deleteExpenseMutation = useDeleteExpense();

  const isLoading = loadingExpenses || loadingSales;

  const [formData, setFormData] = useState({
    amount: '',
    category: 'others' as ExpenseCategory,
    description: '',
    paymentMethod: 'cash' as PaymentMethod,
  });

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (viewFilter === 'today') return isToday(new Date(e.createdAt));
      if (viewFilter === 'month') return isThisMonth(new Date(e.createdAt));
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [expenses, viewFilter]);

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const monthlyIncome = useMemo(() => {
    return sales
      .filter((s) => isThisMonth(new Date(s.createdAt)))
      .reduce((sum, s) => sum + s.totalAmount, 0);
  }, [sales]);

  const monthlyExpenses = useMemo(() => {
    return expenses
      .filter((e) => isThisMonth(new Date(e.createdAt)))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const balance = monthlyIncome - monthlyExpenses;

  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<ExpenseCategory, number> = {
      drinks: 0,
      suppliers: 0,
      staff: 0,
      events: 0,
      maintenance: 0,
      others: 0,
    };
    filteredExpenses.forEach((e) => {
      breakdown[e.category] += e.amount;
    });
    return breakdown;
  }, [filteredExpenses]);

  const highestCategory = useMemo(() => {
    let max = 0;
    let cat: ExpenseCategory = 'others';
    (Object.keys(categoryBreakdown) as ExpenseCategory[]).forEach((key) => {
      if (categoryBreakdown[key] > max) {
        max = categoryBreakdown[key];
        cat = key;
      }
    });
    return { category: cat, amount: max };
  }, [categoryBreakdown]);

  const resetForm = () => {
    setFormData({
      amount: '',
      category: 'others',
      description: '',
      paymentMethod: 'cash',
    });
  };

  const handleAdd = () => {
    addExpenseMutation.mutate({
      amount: Number(formData.amount),
      category: formData.category,
      description: formData.description,
      paymentMethod: formData.paymentMethod,
    }, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        resetForm();
      }
    });
  };

  const handleEdit = () => {
    if (!selectedExpense) return;
    updateExpenseMutation.mutate({
      id: selectedExpense.id,
      updates: {
        amount: Number(formData.amount),
        category: formData.category,
        description: formData.description,
        paymentMethod: formData.paymentMethod,
      }
    }, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
        setSelectedExpense(null);
        resetForm();
      }
    });
  };

  const handleDelete = (expense: Expense) => {
    if (confirm('¿Eliminar este gasto?')) {
      deleteExpenseMutation.mutate(expense.id);
    }
  };

  const openEditDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setFormData({
      amount: expense.amount.toString(),
      category: expense.category,
      description: expense.description,
      paymentMethod: expense.paymentMethod,
    });
    setIsEditDialogOpen(true);
  };

  // Chart data
  const pieData = (Object.keys(categoryBreakdown) as ExpenseCategory[])
    .map((cat) => ({ name: expenseCategoryLabels[cat], value: categoryBreakdown[cat] }))
    .filter((d) => d.value > 0);

  const comparisonData = [
    { name: 'Ingresos', value: monthlyIncome, fill: 'hsl(142, 70%, 45%)' },
    { name: 'Gastos', value: monthlyExpenses, fill: 'hsl(0, 72%, 51%)' },
  ];

  const expenseFormContent = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="amount">Monto</Label>
        <Input
          id="amount"
          type="number"
          value={formData.amount}
          onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
          placeholder="0"
        />
      </div>
      <div>
        <Label htmlFor="category">Categoría</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value as ExpenseCategory }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="drinks">Bebidas</SelectItem>
            <SelectItem value="suppliers">Proveedores</SelectItem>
            <SelectItem value="staff">Personal</SelectItem>
            <SelectItem value="events">Eventos</SelectItem>
            <SelectItem value="maintenance">Mantenimiento</SelectItem>
            <SelectItem value="others">Otros</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Descripción del gasto"
        />
      </div>
      <div>
        <Label htmlFor="paymentMethod">Método de Pago</Label>
        <Select
          value={formData.paymentMethod}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentMethod: value as PaymentMethod }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Efectivo</SelectItem>
            <SelectItem value="transfer">Transferencia</SelectItem>
            <SelectItem value="qr">QR</SelectItem>
          </SelectContent>
        </Select>
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
      <PageHeader title="Gastos" description="Control de gastos y egresos">
        <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Gasto
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">Total {viewFilter === 'today' ? 'Hoy' : viewFilter === 'month' ? 'Este Mes' : 'General'}</p>
          <p className="text-2xl font-semibold text-destructive">{formatCurrency(totalFiltered)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">Ingresos del Mes</p>
          <p className="text-xl font-semibold text-success">{formatCurrency(monthlyIncome)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">Balance Mensual</p>
          <p className={cn("text-xl font-semibold", balance >= 0 ? "text-success" : "text-destructive")}>
            {formatCurrency(balance)}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground">Mayor Gasto</p>
          <p className="text-xl font-semibold">{expenseCategoryLabels[highestCategory.category]}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(highestCategory.amount)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Category Breakdown */}
        {pieData.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="font-display text-lg font-semibold mb-4">Gastos por Categoría</h3>
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(220, 18%, 11%)',
                      border: '1px solid hsl(220, 15%, 20%)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs text-muted-foreground">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Income vs Expenses */}
        <div className="glass-card p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Ingresos vs Gastos (Mes)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} layout="vertical">
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 12 }} tickFormatter={(value) => `$${value / 1000}k`} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 12 }} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(220, 18%, 11%)',
                    border: '1px solid hsl(220, 15%, 20%)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={viewFilter} onValueChange={(v) => setViewFilter(v as ViewFilter)}>
        <TabsList className="mb-6">
          <TabsTrigger value="today">Hoy</TabsTrigger>
          <TabsTrigger value="month">Este Mes</TabsTrigger>
          <TabsTrigger value="all">Todo</TabsTrigger>
        </TabsList>

        <TabsContent value={viewFilter}>
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      No hay gastos registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{formatDateTime(new Date(expense.createdAt))}</TableCell>
                      <TableCell className="font-medium">{expense.description}</TableCell>
                      <TableCell>
                        <span className="status-badge bg-secondary text-secondary-foreground">
                          {expenseCategoryLabels[expense.category]}
                        </span>
                      </TableCell>
                      <TableCell>{paymentMethodLabels[expense.paymentMethod]}</TableCell>
                      <TableCell className="text-right text-destructive font-semibold">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(expense)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(expense)}>
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
            <DialogTitle>Nuevo Gasto</DialogTitle>
          </DialogHeader>
          {expenseFormContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={addExpenseMutation.isPending}>
              {addExpenseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Gasto</DialogTitle>
          </DialogHeader>
          {expenseFormContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateExpenseMutation.isPending}>
              {updateExpenseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
