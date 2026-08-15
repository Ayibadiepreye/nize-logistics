'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bike,
  CheckCircle2,
  Clock,
  Package,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import api, { apiError } from '@/lib/api';
import { naira, number, duration, relativeTime, shortAddress } from '@/lib/format';
import { Card, CardHeader, EmptyState, ErrorState, Kpi, Skeleton, StatusBadge } from '@/components/ui';
import { TrendChart, type TrendPoint } from '@/components/charts/TrendChart';

interface DashboardData {
  orders: {
    totalOrders: number;
    pendingOrders: number;
    activeOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    totalRevenue: string;
    outstanding: string;
    avgDeliveryMinutes: number;
    completionRate: number;
  };
  riders: { totalRiders: number; onlineRiders: number; busyRiders: number; suspendedRiders: number };
  today: { ordersToday: number; revenueToday: string };
  reports: { openReports: number };
  trend: TrendPoint[];
}

export function OverviewTab({ onGoToOrders }: { onGoToOrders: (status?: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [dash, orders] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/orders', { params: { limit: 8, sort: 'createdAt', order: 'desc' } }),
      ]);
      setData(dash.data);
      setRecent(orders.data.orders);
    } catch (err) {
      setError(apiError(err, 'Could not load the dashboard.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 108, borderRadius: 14 }} />
          ))}
        </div>
        <Skeleton style={{ height: 260, borderRadius: 14 }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <ErrorState description={error} onRetry={load} />
      </Card>
    );
  }

  const { orders, riders, today, reports } = data;
  const needsAttention = orders.pendingOrders > 0 || reports.openReports > 0;

  return (
    <div className="space-y-5">
      {/* What needs doing right now, before any vanity metrics. */}
      {needsAttention && (
        <Card className="card-pad">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              <AlertTriangle size={15} style={{ color: 'var(--warning-text)' }} />
              Needs your attention
            </span>
            {orders.pendingOrders > 0 && (
              <button
                onClick={() => onGoToOrders('pending')}
                className="flex items-center gap-1.5 text-[13px] font-medium"
                style={{ color: 'var(--brand-text)' }}
              >
                {orders.pendingOrders} order{orders.pendingOrders === 1 ? '' : 's'} waiting for a rider
                <ArrowRight size={13} />
              </button>
            )}
            {reports.openReports > 0 && (
              <span className="text-[13px]" style={{ color: 'var(--danger-text)' }}>
                {reports.openReports} open issue{reports.openReports === 1 ? '' : 's'} reported
              </span>
            )}
            {riders.onlineRiders === 0 && (
              <span className="text-[13px]" style={{ color: 'var(--danger-text)' }}>
                No riders are online
              </span>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Orders today"
          value={number(today.ordersToday)}
          icon={<Package size={14} />}
          meta={<span>{number(orders.totalOrders)} all time</span>}
        />
        <Kpi
          label="In progress"
          value={number(orders.activeOrders)}
          icon={<Activity size={14} />}
          tone="brand"
          meta={<span>{number(orders.pendingOrders)} awaiting assignment</span>}
        />
        <Kpi
          label="Revenue collected"
          value={naira(orders.totalRevenue)}
          icon={<Wallet size={14} />}
          tone="success"
          meta={<span>{naira(orders.outstanding)} outstanding</span>}
        />
        <Kpi
          label="Riders online"
          value={`${number(riders.onlineRiders)} / ${number(riders.totalRiders)}`}
          icon={<Bike size={14} />}
          meta={<span>{number(riders.busyRiders)} on a delivery</span>}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Last 7 days" subtitle="Orders received and completed" />
          <div className="px-3 pb-4 pt-2">
            <TrendChart data={data.trend} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Performance" />
          <div className="space-y-4 p-5">
            <Metric
              icon={<CheckCircle2 size={15} style={{ color: 'var(--success-text)' }} />}
              label="Completion rate"
              value={`${orders.completionRate}%`}
              hint={`${number(orders.deliveredOrders)} delivered · ${number(orders.cancelledOrders)} cancelled`}
            />
            <Metric
              icon={<Clock size={15} style={{ color: 'var(--brand-text)' }} />}
              label="Average delivery time"
              value={duration(orders.avgDeliveryMinutes)}
              hint="From booking to hand-off"
            />
            <Metric
              icon={<TrendingUp size={15} style={{ color: 'var(--accent-text)' }} />}
              label="Collected today"
              value={naira(today.revenueToday)}
              hint="Paid orders only"
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent orders"
          subtitle="The latest bookings across the platform"
          action={
            <button
              onClick={() => onGoToOrders()}
              className="btn btn-outline btn-sm"
              type="button"
            >
              View all orders
              <ArrowRight size={13} />
            </button>
          }
        />
        {recent.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Bookings from the website will appear here as soon as the first customer places one."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th>Rider</th>
                  <th className="text-right">Amount</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link
                        href={`/track/${order.ticketId}`}
                        className="font-mono text-[13px] font-semibold"
                        style={{ color: 'var(--brand-text)' }}
                      >
                        {order.ticketId}
                      </Link>
                    </td>
                    <td>
                      <div className="max-w-[240px]">
                        <p className="truncate text-[13.5px]">{shortAddress(order.pickupAddress)}</p>
                        <p className="truncate text-[12px]" style={{ color: 'var(--text-muted)' }}>
                          → {shortAddress(order.dropoffAddress)}
                        </p>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                      {order.rider?.fullName ?? '—'}
                    </td>
                    <td className="text-right font-semibold tabular-nums">{naira(order.totalPrice)}</td>
                    <td className="whitespace-nowrap text-[13px]" style={{ color: 'var(--text-muted)' }}>
                      {relativeTime(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </p>
          <p className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {value}
          </p>
        </div>
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </p>
      </div>
    </div>
  );
}
