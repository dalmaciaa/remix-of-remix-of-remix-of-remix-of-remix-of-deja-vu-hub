import { useSales } from '@/hooks/useSales';
import { isThisMonth, formatCurrency } from '@/lib/utils-format';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';

const COLORS = ['hsl(38, 92%, 50%)', 'hsl(320, 70%, 45%)', 'hsl(142, 70%, 45%)'];

export function SalesChart() {
  const { data: sales = [] } = useSales();

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const chartData = last7Days.map((date) => {
    const dayStr = date.toLocaleDateString('es-MX', { weekday: 'short' });
    const daySales = sales.filter((s) => new Date(s.createdAt).toDateString() === date.toDateString());
    const total = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
    return { name: dayStr, value: total };
  });

  return (
    <div className="rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 rounded-xl bg-chart-1/15">
          <BarChart3 className="w-5 h-5 text-warning" />
        </div>
        <h3 className="font-display text-lg font-semibold">Ventas (7 días)</h3>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(220, 10%, 55%)', fontSize: 11 }}
              tickFormatter={(value) => `$${value / 1000}k`}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(220, 18%, 11%)',
                border: '1px solid hsl(220, 15%, 20%)',
                borderRadius: '12px',
                padding: '8px 12px',
              }}
              formatter={(value: number) => [formatCurrency(value), 'Ventas']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(38, 92%, 50%)"
              strokeWidth={2.5}
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

  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-accent/15">
            <PieChartIcon className="w-5 h-5 text-accent" />
          </div>
          <h3 className="font-display text-lg font-semibold">Métodos de Pago</h3>
        </div>
        <p className="text-muted-foreground text-sm">Sin ventas este mes</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 rounded-xl bg-accent/15">
          <PieChartIcon className="w-5 h-5 text-accent" />
        </div>
        <h3 className="font-display text-lg font-semibold">Métodos de Pago</h3>
      </div>
      <div className="h-48 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
              cornerRadius={4}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(220, 18%, 11%)',
                border: '1px solid hsl(220, 15%, 20%)',
                borderRadius: '12px',
                padding: '8px 12px',
              }}
              formatter={(value: number) => [formatCurrency(value), '']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-2 mt-3">
        {data.map((entry, index) => {
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <div key={entry.name} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index] }} />
              <span className="text-xs text-muted-foreground flex-1">{entry.name}</span>
              <span className="text-xs font-medium">{pct}%</span>
              <span className="text-xs text-muted-foreground">{formatCurrency(entry.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
