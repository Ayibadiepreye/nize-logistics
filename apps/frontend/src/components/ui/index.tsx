'use client';

/**
 * Nize design-system primitives.
 *
 * Every dashboard and form in the app composes these, so a button, badge or
 * empty state looks and behaves identically wherever it appears. Styling lives
 * in globals.css (@layer components) and is driven entirely by theme tokens —
 * these components never hardcode a colour.
 */

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import { statusLabel, statusTone } from '@/lib/orderStatus';

/* ------------------------------------------------------------------ utils */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ----------------------------------------------------------------- Button */

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'accent'
  | 'success'
  | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  block?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, block, icon, children, className, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={cx(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        block && 'btn-block',
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------- Card */

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div>
        <h2 className="section-title-sm">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ Field */

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (id: string) => React.ReactNode;
}

/** Wraps a control with a label, hint and error, wiring up ids for a11y. */
export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  return (
    <div>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
          {required && <span style={{ color: 'var(--danger-text)' }}> *</span>}
        </label>
      )}
      {children(id)}
      {error ? (
        <p className="field-error">{error}</p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} className={cx('input', invalid && 'input-error', className)} {...rest} />;
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} className={cx('textarea', invalid && 'input-error', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cx('select', className)} {...rest}>
        {children}
      </select>
    );
  }
);

/* ------------------------------------------------------------------ Badge */

type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

export function Badge({
  tone = 'neutral',
  dot,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cx('badge', `badge-${tone}`, className)}>
      {dot && <span className="status-dot" />}
      {children}
    </span>
  );
}

/** Order status badge — label and tone both come from the shared status model. */
export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  return (
    <Badge tone={statusTone(status)} dot className={className}>
      {statusLabel(status)}
    </Badge>
  );
}

/* -------------------------------------------------------------- Skeletons */

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cx('skeleton', className)} style={style} aria-hidden />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-5 space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- Empty / error UI */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon ?? <Inbox size={20} />}</div>
      <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13.5px]" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon" style={{ background: 'var(--danger-subtle)', color: 'var(--danger-text)' }}>
        <AlertCircle size={20} />
      </div>
      <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13.5px]" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      )}
      {onRetry && (
        <Button className="mt-4" variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineAlert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
}) {
  const bg = {
    info: 'var(--info-subtle)',
    success: 'var(--success-subtle)',
    warning: 'var(--warning-subtle)',
    danger: 'var(--danger-subtle)',
  }[tone];
  const fg = {
    info: 'var(--info-text)',
    success: 'var(--success-text)',
    warning: 'var(--warning-text)',
    danger: 'var(--danger-text)',
  }[tone];
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle;

  return (
    <div
      className="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-[13.5px]"
      style={{ background: bg, color: fg }}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      <Icon size={16} className="mt-px shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Escape to dismiss, and lock the background from scrolling behind the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const maxWidth = { sm: 380, md: 500, lg: 720 }[size];

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="modal"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-4 px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                {description}
              </p>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog" type="button">
            <X size={16} />
          </button>
        </div>

        {children && <div className="px-5 py-4">{children}</div>}

        {footer && (
          <div
            className="flex justify-end gap-2 px-5 py-3.5"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Replaces window.confirm() for destructive actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Toast */

interface ToastItem {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'warning' | 'info';
}

const ToastContext = createContext<{
  toast: (message: string, tone?: ToastItem['tone']) => void;
}>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastItem['tone'] = 'info') => {
      const id = nextId.current++;
      setItems((cur) => [...cur, { id, message, tone }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {items.length > 0 && (
        <div className="toast-viewport" role="status" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={cx('toast', t.tone !== 'info' && `toast-${t.tone}`)}>
              <span className="mt-px shrink-0">
                {t.tone === 'success' ? (
                  <CheckCircle2 size={16} style={{ color: 'var(--success-text)' }} />
                ) : t.tone === 'error' ? (
                  <AlertCircle size={16} style={{ color: 'var(--danger-text)' }} />
                ) : t.tone === 'warning' ? (
                  <AlertCircle size={16} style={{ color: 'var(--warning-text)' }} />
                ) : (
                  <Info size={16} style={{ color: 'var(--brand-text)' }} />
                )}
              </span>
              <p className="flex-1 text-[13.5px]" style={{ color: 'var(--text-primary)' }}>
                {t.message}
              </p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                type="button"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext).toast;
}

/* ------------------------------------------------------------------- Tabs */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  onBanner,
}: {
  tabs: Array<{ id: T; label: string; icon?: React.ReactNode; count?: number }>;
  value: T;
  onChange: (id: T) => void;
  /** Restyles the bar for the blue dashboard banner. */
  onBanner?: boolean;
}) {
  return (
    <div className={cx('tabs', onBanner && 'tabs-banner')} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          className="tab"
          onClick={() => onChange(t.id)}
        >
          {t.icon}
          {t.label}
          {typeof t.count === 'number' && (
            <span
              className="rounded-full px-1.5 text-[11px] font-semibold"
              style={{ background: 'var(--bg-inset)', color: 'var(--text-secondary)' }}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- Pagination */

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
    >
      <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
        {total === 0 ? 'No results' : `${from}–${to} of ${total.toLocaleString()}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          icon={<ChevronLeft size={14} />}
        >
          Prev
        </Button>
        <span className="text-[13px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {page} / {pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
        >
          Next
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- KPI */

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'var(--text-primary)',
  brand: 'var(--brand-text)',
  info: 'var(--info-text)',
  success: 'var(--success-text)',
  warning: 'var(--warning-text)',
  danger: 'var(--danger-text)',
  accent: 'var(--accent-text)',
};

const TONE_SUBTLE: Record<Tone, string> = {
  neutral: 'var(--bg-inset)',
  brand: 'var(--brand-subtle)',
  info: 'var(--info-subtle)',
  success: 'var(--success-subtle)',
  warning: 'var(--warning-subtle)',
  danger: 'var(--danger-subtle)',
  accent: 'var(--accent-subtle)',
};

/**
 * Headline metric tile. Colour lives in the icon chip and (optionally) the
 * value; everything else stays neutral so a row of tiles reads as data rather
 * than as a row of coloured boxes.
 */
export function Kpi({
  label,
  value,
  icon,
  meta,
  tone = 'brand',
  colorValue,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  tone?: Tone;
  /** Tint the number too — reserve it for the one metric that matters most. */
  colorValue?: boolean;
}) {
  return (
    <div className="kpi">
      {icon && (
        <div
          className="kpi-icon"
          style={{ background: TONE_SUBTLE[tone], color: TONE_TEXT[tone] }}
          aria-hidden
        >
          {icon}
        </div>
      )}
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={colorValue ? { color: TONE_TEXT[tone] } : undefined}>
        {value}
      </div>
      {meta && <div className="kpi-meta">{meta}</div>}
    </div>
  );
}

/* --------------------------------------------------------------- Copyable */

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={copied ? <Check size={13} /> : undefined}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard blocked — the value is still selectable on screen */
        }
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}
