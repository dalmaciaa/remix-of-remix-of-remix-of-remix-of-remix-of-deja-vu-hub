import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  href?: string;
}

const variantConfig = {
  default: {
    iconBg: 'bg-primary/15',
    iconColor: 'text-primary',
    valueColor: 'text-primary',
    glowColor: 'shadow-primary/10',
    borderAccent: 'border-l-primary/60',
  },
  success: {
    iconBg: 'bg-success/15',
    iconColor: 'text-success',
    valueColor: 'text-success',
    glowColor: 'shadow-success/10',
    borderAccent: 'border-l-success/60',
  },
  warning: {
    iconBg: 'bg-warning/15',
    iconColor: 'text-warning',
    valueColor: 'text-warning',
    glowColor: 'shadow-warning/10',
    borderAccent: 'border-l-warning/60',
  },
  danger: {
    iconBg: 'bg-destructive/15',
    iconColor: 'text-destructive',
    valueColor: 'text-destructive',
    glowColor: 'shadow-destructive/10',
    borderAccent: 'border-l-destructive/60',
  },
};

export function StatCard({ title, value, icon: Icon, trend, variant = 'default', href }: StatCardProps) {
  const config = variantConfig[variant];

  const content = (
    <div className={cn(
      "relative overflow-hidden rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm p-5",
      "border-l-[3px]",
      config.borderAccent,
      "transition-all duration-300",
      href && "hover:scale-[1.03] hover:shadow-xl cursor-pointer",
      "group"
    )}>
      {/* Subtle background glow */}
      <div className={cn(
        "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 transition-opacity duration-500",
        variant === 'default' && "bg-primary",
        variant === 'success' && "bg-success",
        variant === 'warning' && "bg-warning",
        variant === 'danger' && "bg-destructive",
        "group-hover:opacity-30",
      )} />

      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className={cn("text-2xl lg:text-3xl font-bold tracking-tight", config.valueColor)}>
            {value}
          </p>
          {trend && (
            <p className={cn(
              "text-xs font-medium flex items-center gap-1",
              trend.value >= 0 ? "text-success" : "text-destructive"
            )}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", config.iconBg)}>
          <Icon className={cn("w-5 h-5", config.iconColor)} />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block animate-fade-in">
        {content}
      </Link>
    );
  }

  return (
    <div className="animate-fade-in">
      {content}
    </div>
  );
}
