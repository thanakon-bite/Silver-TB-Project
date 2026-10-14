import React from 'react';
import { AlertCircle } from 'lucide-react';

/** A quiet status line on the sunken panel (role=status). Errors use ErrorBox instead (design.md). */
export const Notice: React.FC<{ icon?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ icon, children, className = '' }) => (
  <div role="status" className={`flex items-start gap-2 rounded-xl border border-line bg-sunken p-3 text-sm text-ink ${className}`}>
    {icon}
    <div className="min-w-0">{children}</div>
  </div>
);

/** An error in a danger box: what went wrong, then the next step. */
export const ErrorBox: React.FC<{ title?: string; children?: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div role="alert" className={`flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm text-danger ${className}`}>
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
    <div className="min-w-0">
      {title && <strong className="font-semibold">{title}</strong>}
      {title && children ? ' · ' : null}
      {children}
    </div>
  </div>
);

/** The page's title block: one display heading, an optional line under it, an optional action at the end. */
export const PageHeader: React.FC<{ title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  description,
  action,
}) => (
  <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line pb-6">
    <div className="min-w-0">
      <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
      {description && <p className="mt-2 max-w-prose text-muted">{description}</p>}
    </div>
    {action}
  </header>
);

/** Empty states: what is missing and the one way forward. */
export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }> = ({ icon, title, text, action }) => (
  <div className="flex flex-col items-center px-4 py-20 text-center">
    {icon && <div className="mb-4 text-muted">{icon}</div>}
    <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
    {text && <p className="mt-2 max-w-sm text-sm text-muted">{text}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);
