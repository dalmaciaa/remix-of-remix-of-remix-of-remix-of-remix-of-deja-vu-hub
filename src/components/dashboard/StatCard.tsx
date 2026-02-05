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

const variantStyles = {
  default: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
};

export function StatCard({ title, value, icon: Icon, trend, variant = 'default', href }: StatCardProps) {
  const content = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm text-muted-foreground truncate">{title}</p>
        <p className={cn("text-lg sm:text-2xl lg:text-3xl font-semibold mt-1 sm:mt-2 truncate", variantStyles[variant])}>
          {value}
        </p>
        {trend && (
          <p className={cn(
            "text-xs mt-1 sm:mt-2",
            trend.value >= 0 ? "text-success" : "text-destructive"
          )}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </p>
        )}
      </div>
      <div className={cn("p-2 sm:p-3 rounded-lg bg-secondary flex-shrink-0", variantStyles[variant])}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="stat-card animate-fade-in hover:scale-[1.02] transition-transform cursor-pointer">
        {content}
      </Link>
    );
  }

  return (
    <div className="stat-card animate-fade-in">
      {content}
    </div>
  );
}
