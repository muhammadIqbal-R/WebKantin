'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2, X } from 'lucide-react';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
const buttonVariants = cva('button', {
  variants: {
    variant: { primary: 'button-primary', secondary: 'button-secondary', ghost: 'button-ghost', danger: 'button-danger', outline: 'button-outline' },
    size: { md: '', sm: 'button-sm', icon: 'button-icon' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});
type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean };
export function Button({ className, variant, size, asChild = false, loading, children, disabled, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component type={asChild ? undefined : 'button'} className={cn(buttonVariants({ variant, size }), className)}
    disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {asChild ? children : <>{loading ? <Loader2 className="spin" aria-hidden="true" /> : null}{children}</>}
  </Component>;
}
export function Brand({ inverse = false, label }: { inverse?: boolean; label?: string }) {
  return <span className={cn('brand', inverse && 'brand-inverse')}>
    <img className="institution-logo" src="/brand/vokasi-ui-emblem.png" alt="Vokasi Universitas Indonesia" width="564" height="592" />
    <span className="brand-service"><span className="brand-word">Kantin Vokasi</span><span className="brand-university">Universitas Indonesia</span>{label ? <span className="brand-caption">{label}</span> : null}</span>
  </span>;
}
export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand'; children: React.ReactNode; className?: string }) {
  return <span className={cn('badge', 'badge-' + tone, className)}>{children}</span>;
}
export function Modal({ open, onOpenChange, title, description, children }: {
  open: boolean; onOpenChange: (value: boolean) => void; title: string; description: string; children: React.ReactNode;
}) {
  const returnFocus = React.useRef<HTMLElement | null>(null);
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="modal-overlay" />
    <DialogPrimitive.Content className="modal"
      onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
      onCloseAutoFocus={(event) => { event.preventDefault(); if (returnFocus.current?.isConnected) returnFocus.current.focus(); }}>
      <div className="modal-heading"><div><DialogPrimitive.Title className="section-title">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="muted small">{description}</DialogPrimitive.Description></div>
        <DialogPrimitive.Close asChild><Button variant="ghost" size="icon" aria-label="Tutup dialog"><X /></Button></DialogPrimitive.Close>
      </div>{children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal></DialogPrimitive.Root>;
}
export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{description}</p>{action}</div>;
}
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint ? <span className="muted small">{hint}</span> : null}</label>;
}
export function FoodPhoto({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img className={cn('food-photo', className)} src={src} alt={alt} width="900" height="600" loading="lazy"
    onError={(event) => { const target = event.currentTarget; if (!target.src.endsWith('/food/fallback.svg')) target.src = '/food/fallback.svg'; }} />;
}
export function formatMoney(value: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }

