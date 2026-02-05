import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold truncate">{title}</h1>
        {description && (
          <p className="text-muted-foreground text-sm sm:text-base mt-0.5 sm:mt-1 truncate">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
}
