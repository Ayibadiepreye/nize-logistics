/** Shared formatting helpers so figures read identically across the app. */

export function naira(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '₦0';
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

export function number(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString('en-NG') : '0';
}

export function shortDate(value?: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function timeOnly(value?: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}

/** "3 min ago", "2 days ago" — for activity feeds. */
export function relativeTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';

  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [604800, 'week'],
    [2629800, 'month'],
    [31557600, 'year'],
  ];

  let divisor = 60;
  let unit: Intl.RelativeTimeFormatUnit = 'minute';
  for (let i = 0; i < units.length; i++) {
    const [threshold, u] = units[i];
    const next = units[i + 1];
    if (!next || seconds < next[0]) {
      divisor = threshold;
      unit = u;
      break;
    }
  }

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return rtf.format(-Math.round(seconds / divisor), unit);
}

/** Minutes as "1h 25m" for delivery durations. */
export function duration(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Trims a long address to its most identifying part. */
export function shortAddress(address?: string | null): string {
  if (!address) return '—';
  return address.split(',')[0].trim();
}
