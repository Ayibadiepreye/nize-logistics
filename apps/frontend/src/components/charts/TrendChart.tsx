'use client';

import { useId, useState } from 'react';
import { naira, shortDate } from '@/lib/format';

export interface TrendPoint {
  day: string;
  orders: number;
  delivered: number;
  revenue: number;
}

/**
 * Seven-day order volume with a revenue overlay.
 *
 * Hand-rolled SVG rather than a charting dependency: it is one chart, it must
 * inherit theme tokens in both light and dark mode, and pulling in a library
 * for this would cost more bundle than the whole dashboard.
 */
export function TrendChart({ data, height = 180 }: { data: TrendPoint[]; height?: number }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-[13px]"
        style={{ height, color: 'var(--text-muted)' }}
      >
        No orders in the last 7 days
      </div>
    );
  }

  const width = 720;
  const padTop = 16;
  const padBottom = 28;
  const padX = 8;
  const plotHeight = height - padTop - padBottom;
  const maxOrders = Math.max(1, ...data.map((d) => d.orders));

  const barSlot = (width - padX * 2) / data.length;
  const barWidth = Math.min(46, barSlot * 0.55);

  const pointFor = (d: TrendPoint, i: number) => ({
    x: padX + barSlot * i + barSlot / 2,
    y: padTop + plotHeight - (d.orders / maxOrders) * plotHeight,
  });

  const linePath = data
    .map((d, i) => {
      const { x, y } = pointFor(d, i);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const active = hover === null ? null : data[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Orders per day over the last ${data.length} days`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Baseline + two guide lines, kept faint so the data stays dominant. */}
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={width - padX}
            y1={padTop + plotHeight * t}
            y2={padTop + plotHeight * t}
            stroke="var(--border-subtle)"
            strokeWidth="1"
          />
        ))}

        {/* Area under the order line. */}
        <path
          d={`${linePath} L ${padX + barSlot * (data.length - 1) + barSlot / 2} ${padTop + plotHeight} L ${padX + barSlot / 2} ${padTop + plotHeight} Z`}
          fill={`url(#${gradientId})`}
        />

        {data.map((d, i) => {
          const { x, y } = pointFor(d, i);
          const deliveredHeight = (d.delivered / maxOrders) * plotHeight;
          return (
            <g key={d.day}>
              {/* Delivered portion as a solid bar. */}
              <rect
                x={x - barWidth / 2}
                y={padTop + plotHeight - deliveredHeight}
                width={barWidth}
                height={Math.max(0, deliveredHeight)}
                rx="3"
                fill="var(--brand)"
                opacity={hover === null || hover === i ? 0.85 : 0.35}
              />
              {/* Invisible hit area so thin bars are still hoverable. */}
              <rect
                x={padX + barSlot * i}
                y={0}
                width={barSlot}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              <circle cx={x} cy={y} r={hover === i ? 4 : 2.5} fill="var(--accent)" />
              <text
                x={x}
                y={height - 9}
                textAnchor="middle"
                fontSize="10.5"
                fill="var(--text-muted)"
              >
                {new Date(d.day).toLocaleDateString('en-NG', { weekday: 'short' })}
              </text>
            </g>
          );
        })}

        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" />
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg px-3 py-2 text-[12px] shadow-lg"
          style={{ background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {shortDate(active.day)}
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>
            {active.orders} order{active.orders === 1 ? '' : 's'} · {active.delivered} delivered
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>{naira(active.revenue)} collected</p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--brand)' }} />
          Delivered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent)' }} />
          Total orders
        </span>
      </div>
    </div>
  );
}
