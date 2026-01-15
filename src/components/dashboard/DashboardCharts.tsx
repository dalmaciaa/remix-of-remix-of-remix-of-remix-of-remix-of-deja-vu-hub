import { useSales } from '@/hooks/useSales';
import { isThisMonth, formatCurrency } from '@/lib/utils-format';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(38, 92%, 50%)', 'hsl(320, 70%, 45%)', 'hsl(142, 70%, 45%)'];

export function SalesChart() {
  const { data: sales = [] } = useSales();
  
  // Get last 7 days data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const chartData = last7Days.map((date) => {
    const dayStr = date.toLocaleDateString('es-MX', { weekday: 'short' });
    const daySales = sales.filter((s) => {
      const saleDate = new Date(s.createdAt);
      return saleDate.toDateString() === date.toDateString();
    });
    const total = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
    return { name: dayStr, value: total };
  });

  return (
    <div className="glass-card p-6 animate-fade-in">
      <h3 className="font-display text-lg font-semibold mb-4">Ventas (Últimos 7 días)</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 12 }}
              tickFormatter={(value) => `$${value / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(220, 18%, 11%)',
                border: '1px solid hsl(220, 15%, 20%)',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [formatCurrency(value), 'Ventas']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(38, 92%, 50%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PaymentMethodChart() {
  const { data: sales = [] } = useSales();
  const monthSales = sales.filter((s) => isThisMonth(new Date(s.createdAt)));

  const data = [
    { name: 'Efectivo', value: monthSales.filter((s) => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalAmount, 0) },
    { name: 'Transferencia', value: monthSales.filter((s) => s.paymentMethod === 'transfer').reduce((sum, s) => sum + s.totalAmount, 0) },
    { name: 'QR', value: monthSales.filter((s) => s.paymentMethod === 'qr').reduce((sum, s) => sum + s.totalAmount, 0) },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="glass-card p-6 animate-fade-in">
        <h3 className="font-display text-lg font-semibold mb-4">Métodos de Pago</h3>
        <p className="text-muted-foreground text-sm">Sin ventas este mes</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 animate-fade-in">
      <h3 className="font-display text-lg font-semibold mb-4">Métodos de Pago</h3>
      <div className="h-48 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
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
      <div className="flex justify-center gap-4 mt-4">
        {data.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
            <span className="text-xs text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
