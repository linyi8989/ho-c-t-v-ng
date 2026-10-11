import type { ReactNode } from 'react';

export default function MaintenanceScrollRegion({ label, children, size = 'list', className = '' }: {
  label: string;
  children: ReactNode;
  size?: 'compact' | 'analysis' | 'list';
  className?: string;
}) {
  return <div className={`maintenance-scroll-region maintenance-scroll-${size} ${className}`}
    role="region" aria-label={label} tabIndex={0}>
    {children}
  </div>;
}
