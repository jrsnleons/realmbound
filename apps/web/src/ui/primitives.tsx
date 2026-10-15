'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic, sfx } from '@/lib/feedback';
import { Icon } from './icons';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

/* ─── Screen with an iOS large title that collapses into the nav bar ─── */

export function Screen({
  title,
  subtitle,
  leading,
  trailing,
  children,
  className,
  bleed,
}: {
  title: string;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Content under the nav bar without side padding. */
  bleed?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const on = () => setCollapsed(el.scrollTop > 38);
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);
  return (
    <div ref={scroller} className="absolute inset-0 overflow-y-auto overscroll-contain no-scrollbar" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>
      <div className={cx('sticky top-0 z-30 transition-colors duration-200', collapsed ? 'material hairline-b' : 'bg-transparent')} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="relative flex h-11 items-center justify-between px-4">
          <div className="flex min-w-16 items-center">{leading}</div>
          <div className={cx('pointer-events-none absolute inset-x-20 truncate text-center text-headline transition-opacity duration-200', collapsed ? 'opacity-100' : 'opacity-0')}>{title}</div>
          <div className="flex min-w-16 items-center justify-end gap-1">{trailing}</div>
        </div>
      </div>
      <header className="px-4 pb-2 pt-0.5">
        <h1 className="text-large-title">{title}</h1>
        {subtitle && <div className="text-subhead text-label2">{subtitle}</div>}
      </header>
      <main className={cx(bleed ? '' : 'px-4', 'mx-auto max-w-2xl', className)}>{children}</main>
    </div>
  );
}

export function NavButton({ onClick, children, label, bold }: { onClick: () => void; children: React.ReactNode; label: string; bold?: boolean }) {
  return (
    <button aria-label={label} onClick={onClick} className={cx('pressable flex h-11 min-w-11 items-center justify-center rounded-full text-tint text-body', bold && 'font-semibold')}>
      {children}
    </button>
  );
}

/* ─── Inset grouped lists ─── */

export function Section({ header, footer, children, className }: { header?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('mb-7', className)}>
      {header && <h2 className="mb-1.5 px-4 text-footnote uppercase text-label2">{header}</h2>}
      <div className="overflow-hidden rounded-card bg-card" style={{ boxShadow: 'var(--shadow)' }}>
        {children}
      </div>
      {footer && <p className="mt-1.5 px-4 text-footnote text-label2">{footer}</p>}
    </section>
  );
}

export function Row({
  icon,
  iconBg,
  title,
  subtitle,
  detail,
  accessory,
  onClick,
  chevron,
  destructive,
  className,
  children,
}: {
  icon?: React.ReactNode;
  iconBg?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  detail?: React.ReactNode;
  accessory?: React.ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cx(
        'group relative flex w-full min-h-11 items-center gap-3 pl-4 text-left',
        onClick && 'transition-colors active:bg-fill2',
        className,
      )}
    >
      {icon && (
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] text-white" style={{ background: iconBg ?? 'var(--gray)' }}>
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-4 [.group:not(:last-child)>&]:hairline-b">
        <span className="min-w-0 flex-1">
          {title && <span className={cx('block truncate text-body', destructive && 'text-ired')}>{title}</span>}
          {subtitle && <span className="block text-footnote text-label2">{subtitle}</span>}
          {children}
        </span>
        {detail && <span className="shrink-0 text-body text-label2">{detail}</span>}
        {accessory}
        {chevron && <Icon.ChevronRight size={16} strokeWidth={2.5} className="shrink-0 text-label3" />}
      </span>
    </Tag>
  );
}

/* ─── Controls ─── */

export function Button({
  children,
  onClick,
  variant = 'filled',
  size = 'large',
  disabled,
  loading,
  className,
  type = 'button',
  color,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'filled' | 'tinted' | 'plain' | 'gray';
  size?: 'large' | 'medium' | 'small';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  color?: string;
}) {
  const c = color ?? 'var(--tint)';
  const style: React.CSSProperties =
    variant === 'filled'
      ? { background: c, color: '#fff' }
      : variant === 'tinted'
        ? { background: `color-mix(in srgb, ${c} 15%, transparent)`, color: c }
        : variant === 'gray'
          ? { background: 'var(--fill2)', color: c }
          : { color: c };
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={() => {
        sfx.tap();
        onClick?.();
      }}
      style={style}
      className={cx(
        'pressable inline-flex items-center justify-center gap-2 font-semibold disabled:opacity-40',
        size === 'large' && 'h-[50px] rounded-[14px] px-5 text-body',
        size === 'medium' && 'h-[38px] rounded-full px-4 text-subhead',
        size === 'small' && 'h-[30px] rounded-full px-3 text-footnote',
        className,
      )}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.9s linear infinite' }} aria-label="Loading">
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x="11" y="2" width="2" height="6" rx="1" fill="currentColor" opacity={0.25 + (i / 8) * 0.75} transform={`rotate(${i * 45} 12 12)`} />
      ))}
    </svg>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic();
        onChange(!checked);
      }}
      className="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200"
      style={{ background: checked ? 'var(--green)' : 'var(--fill)' }}
    >
      <span className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-[left] duration-200" style={{ left: checked ? 22 : 2, transitionTimingFunction: 'var(--ease-spring)' }} />
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={cx('relative flex h-8 rounded-[9px] bg-fill2 p-[2px]', className)} role="tablist">
      <span
        className="absolute bottom-[2px] top-[2px] rounded-[7px] bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] transition-transform duration-300 dark:bg-[#636366]"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${idx * 100}%)`, transitionTimingFunction: 'var(--ease-spring)' }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => {
            haptic();
            onChange(o.value);
          }}
          className={cx('relative z-10 flex-1 truncate px-1 text-footnote', o.value === value ? 'font-semibold' : 'text-label')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min, max, step = 1, format }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="tabular min-w-14 text-right text-body text-label2">{format ? format(value) : value}</span>
      <div className="flex h-8 overflow-hidden rounded-[8px] bg-fill2">
        <button aria-label="Decrease" disabled={value <= min} onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} className="flex w-12 items-center justify-center disabled:opacity-30 active:bg-fill">
          <Icon.Minus size={18} />
        </button>
        <span className="my-1.5 w-px bg-sep" />
        <button aria-label="Increase" disabled={value >= max} onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))} className="flex w-12 items-center justify-center disabled:opacity-30 active:bg-fill">
          <Icon.Plus size={18} />
        </button>
      </div>
    </div>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  autoFocus,
  maxLength,
  type = 'text',
  autoComplete,
  onSubmit,
  className,
  inputMode,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
  type?: string;
  autoComplete?: string;
  onSubmit?: () => void;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  label?: string;
}) {
  return (
    <input
      aria-label={label ?? placeholder}
      className={cx('h-11 w-full bg-transparent px-4 text-body outline-none placeholder:text-label3', className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      maxLength={maxLength}
      type={type}
      autoComplete={autoComplete}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      inputMode={inputMode}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit?.();
      }}
    />
  );
}

export function ProgressBar({ value, color = 'var(--tint)', height = 6, className, track = 'var(--fill)' }: { value: number; color?: string; height?: number; className?: string; track?: string }) {
  return (
    <div className={cx('w-full overflow-hidden rounded-full', className)} style={{ height, background: track }}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color, transitionTimingFunction: 'var(--ease-spring)' }} />
    </div>
  );
}

export function Ring({ value, size = 44, stroke = 5, color = 'var(--tint)', children, track = 'var(--fill)' }: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          className="transition-[stroke-dashoffset] duration-700"
          style={{ transitionTimingFunction: 'var(--ease-spring)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function Chip({ children, color = 'var(--gray)', className }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold', className)} style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
      {children}
    </span>
  );
}

export function Empty({ icon, title, message, action }: { icon?: React.ReactNode; title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-10 text-center">
      {icon && <div className="mb-3 text-label3">{icon}</div>}
      <div className="text-title3">{title}</div>
      {message && <p className="mt-1 text-subhead text-label2">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─── Sheets (bottom modal with grabber, drag to dismiss) ─── */

export function Sheet({
  open,
  onClose,
  title,
  children,
  leading,
  trailing,
  tall,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Large detent (near full height) instead of fitting content. */
  tall?: boolean;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const t = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(t);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || typeof document === 'undefined') return null;

  const onDown = (e: React.PointerEvent) => {
    start.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (start.current === null) return;
    setDrag(Math.max(0, e.clientY - start.current));
  };
  const onUp = () => {
    if (drag > 110) onClose();
    start.current = null;
    setDrag(0);
  };

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className={cx('absolute inset-0 bg-black/40 transition-opacity duration-300', shown ? 'opacity-100' : 'opacity-0')} onClick={onClose} />
      <div
        className={cx('absolute inset-x-0 bottom-0 mx-auto flex max-w-2xl flex-col rounded-t-[14px] bg-bg', tall ? 'h-[92dvh]' : 'max-h-[92dvh]')}
        style={{
          transform: shown ? `translateY(${drag}px)` : 'translateY(100%)',
          transition: start.current !== null ? 'none' : 'transform 420ms var(--ease-spring)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
      >
        <div className="touch-none select-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="mx-auto mt-[5px] h-[5px] w-9 rounded-full bg-label3" />
          {(title || leading || trailing) && (
            <div className="relative flex h-12 items-center justify-between px-2">
              <div className="min-w-16">{leading}</div>
              <div className="absolute inset-x-20 truncate text-center text-headline">{title}</div>
              <div className="flex min-w-16 justify-end">
                {trailing ?? (
                  <button aria-label="Close" onClick={onClose} className="pressable mr-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-fill2 text-label2">
                    <Icon.Close size={14} strokeWidth={3} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 no-scrollbar">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** iOS-style action confirmation (centered alert). */
export function Alert({
  open,
  title,
  message,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  actions: { label: string; onClick: () => void; style?: 'default' | 'cancel' | 'destructive' }[];
  onClose: () => void;
}) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-10" onClick={onClose}>
      <div className="animate-pop w-[270px] overflow-hidden rounded-[14px] material text-center" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 pb-4 pt-5">
          <div className="text-headline">{title}</div>
          {message && <div className="mt-1 text-footnote">{message}</div>}
        </div>
        <div className={cx('hairline-t', actions.length === 2 ? 'grid grid-cols-2' : 'flex flex-col')}>
          {actions.map((a, i) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className={cx(
                'h-11 text-body active:bg-fill2',
                a.style === 'destructive' ? 'text-ired' : 'text-tint',
                a.style === 'cancel' && 'font-semibold',
                actions.length === 2 ? i === 0 && 'shadow-[inset_-0.5px_0_0_var(--sep)]' : i > 0 && 'hairline-t',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
