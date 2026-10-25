'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, Bike, Search, UserMinus, X, XCircle } from 'lucide-react';
import api, { apiError } from '@/lib/api';
import { naira, relativeTime, shortAddress, dateTime } from '@/lib/format';
import { ORDER_STATUSES, statusLabel } from '@/lib/orderStatus';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Pagination,
  Select,
  SkeletonTable,
  StatusBadge,
  Textarea,
  useToast,
} from '@/components/ui';

interface Props {
  initialStatus?: string;
}

const PAGE_SIZE = 20;

export function OrdersTab({ initialStatus }: Props) {
  const toast = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState(initialStatus ?? '');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [sort, setSort] = useState<'createdAt' | 'totalPrice' | 'status'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [unassignTarget, setUnassignTarget] = useState<any>(null);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/orders', {
        params: {
          page,
          limit: PAGE_SIZE,
          sort,
          order,
          ...(status ? { status } : {}),
          ...(paymentStatus ? { paymentStatus } : {}),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        },
      });
      setOrders(data.orders);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(apiError(err, 'Could not load orders.'));
    } finally {
      setLoading(false);
    }
  }, [page, sort, order, status, paymentStatus, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSort = (column: typeof sort) => {
    if (sort === column) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(column);
      setOrder('desc');
    }
  };

  const activeFilters = useMemo(
    () => [status, paymentStatus, debouncedSearch].filter(Boolean).length,
    [status, paymentStatus, debouncedSearch]
  );

  const clearFilters = () => {
    setStatus('');
    setPaymentStatus('');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Card className="card-pad">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Field label="Search">
              {(id) => (
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <Input
                    id={id}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ticket, name, phone or address"
                    style={{ paddingLeft: 34 }}
                  />
                </div>
              )}
            </Field>
          </div>

          <div className="w-[160px]">
            <Field label="Status">
              {(id) => (
                <Select
                  id={id}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className="w-[160px]">
            <Field label="Payment">
              {(id) => (
                <Select
                  id={id}
                  value={paymentStatus}
                  onChange={(e) => {
                    setPaymentStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All payments</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </Select>
              )}
            </Field>
          </div>

          {activeFilters > 0 && (
            <Button variant="ghost" onClick={clearFilters} icon={<X size={14} />}>
              Clear
            </Button>
          )}
        </div>
      </Card>

      <Card>
        {loading ? (
          <SkeletonTable rows={8} cols={6} />
        ) : error ? (
          <ErrorState description={error} onRetry={load} />
        ) : orders.length === 0 ? (
          <EmptyState
            title={activeFilters ? 'No orders match these filters' : 'No orders yet'}
            description={
              activeFilters
                ? 'Try widening your search or clearing the filters.'
                : 'Bookings placed on the website will show up here.'
            }
            action={
              activeFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Route</th>
                    <th className="table-sortable" onClick={() => toggleSort('status')}>
                      <span className="inline-flex items-center gap-1">
                        Status <ArrowUpDown size={11} />
                      </span>
                    </th>
                    <th>Rider</th>
                    <th>Payment</th>
                    <th className="table-sortable text-right" onClick={() => toggleSort('totalPrice')}>
                      <span className="inline-flex items-center gap-1">
                        Amount <ArrowUpDown size={11} />
                      </span>
                    </th>
                    <th className="table-sortable" onClick={() => toggleSort('createdAt')}>
                      <span className="inline-flex items-center gap-1">
                        Placed <ArrowUpDown size={11} />
                      </span>
                    </th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link
                          href={`/track/${o.ticketId}`}
                          target="_blank"
                          className="font-mono text-[13px] font-semibold"
                          style={{ color: 'var(--brand-text)' }}
                        >
                          {o.ticketId}
                        </Link>
                        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                          {o.senderName}
                        </p>
                      </td>
                      <td>
                        <div className="max-w-[220px]">
                          <p className="truncate text-[13.5px]">{shortAddress(o.pickupAddress)}</p>
                          <p className="truncate text-[12px]" style={{ color: 'var(--text-muted)' }}>
                            → {shortAddress(o.dropoffAddress)}
                          </p>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                        {o.rider?.fullName ?? <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}
                      </td>
                      <td>
                        <span
                          className="text-[12.5px] font-medium capitalize"
                          style={{
                            color:
                              o.paymentStatus === 'paid'
                                ? 'var(--success-text)'
                                : o.paymentStatus === 'refunded'
                                  ? 'var(--warning-text)'
                                  : 'var(--text-secondary)',
                          }}
                        >
                          {o.paymentStatus}
                        </span>
                        <p className="text-[11.5px] uppercase" style={{ color: 'var(--text-muted)' }}>
                          {o.paymentMethod}
                        </p>
                      </td>
                      <td className="text-right font-semibold tabular-nums">{naira(o.totalPrice)}</td>
                      <td
                        className="whitespace-nowrap text-[13px]"
                        style={{ color: 'var(--text-muted)' }}
                        title={dateTime(o.createdAt)}
                      >
                        {relativeTime(o.createdAt)}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          {['pending', 'assigned'].includes(o.status) && (
                            <Button size="sm" variant="outline" onClick={() => setAssignTarget(o)} icon={<Bike size={13} />}>
                              {o.assignedRiderId ? 'Reassign' : 'Assign'}
                            </Button>
                          )}
                          {['assigned', 'accepted'].includes(o.status) && o.assignedRiderId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setUnassignTarget(o)}
                              title="Return to the queue"
                              aria-label={`Unassign ${o.ticketId}`}
                            >
                              <UserMinus size={13} />
                            </Button>
                          )}
                          {!['delivered', 'cancelled'].includes(o.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setCancelTarget(o)}
                              title="Cancel order"
                              aria-label={`Cancel ${o.ticketId}`}
                            >
                              <XCircle size={13} style={{ color: 'var(--danger-text)' }} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          </>
        )}
      </Card>

      <AssignModal
        order={assignTarget}
        onClose={() => setAssignTarget(null)}
        onDone={() => {
          setAssignTarget(null);
          toast('Rider assigned', 'success');
          load();
        }}
      />

      <CancelModal
        order={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onDone={(refundRequired) => {
          setCancelTarget(null);
          toast(refundRequired ? 'Order cancelled — a refund is due' : 'Order cancelled', 'success');
          load();
        }}
      />

      <UnassignConfirm
        order={unassignTarget}
        onClose={() => setUnassignTarget(null)}
        onDone={() => {
          setUnassignTarget(null);
          toast('Order returned to the queue', 'success');
          load();
        }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- modals */

function AssignModal({
  order,
  onClose,
  onDone,
}: {
  order: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [riders, setRiders] = useState<any[]>([]);
  const [riderId, setRiderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!order) return;
    setRiderId('');
    setLoading(true);
    api
      .get('/admin/riders/available')
      .then(({ data }) => setRiders(data.riders))
      .catch((err) => toast(apiError(err, 'Could not load riders.'), 'error'))
      .finally(() => setLoading(false));
  }, [order, toast]);

  const submit = async () => {
    if (!riderId) return;
    setSaving(true);
    try {
      await api.post(`/admin/order/${order.id}/assign`, { riderId });
      onDone();
    } catch (err) {
      toast(apiError(err, 'Could not assign this order.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title="Assign a rider"
      description={order ? `${order.ticketId} · ${shortAddress(order.pickupAddress)}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!riderId}>
            Assign rider
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="text-[13.5px]" style={{ color: 'var(--text-secondary)' }}>
          Loading available riders…
        </p>
      ) : riders.length === 0 ? (
        <EmptyState
          title="No riders online"
          description="Riders must be signed in and online before an order can be assigned to them."
        />
      ) : (
        <div className="space-y-2">
          {riders.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
              style={{
                borderColor: riderId === r.id ? 'var(--brand)' : 'var(--border-subtle)',
                background: riderId === r.id ? 'var(--brand-subtle)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="rider"
                value={r.id}
                checked={riderId === r.id}
                onChange={() => setRiderId(r.id)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {r.fullName || r.username}
                </p>
                <p className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                  {r.vehicleType || 'Rider'} · {r.plateNumber || 'no plate'} · {r.totalDeliveries ?? 0} deliveries
                </p>
              </div>
              {r.isBusy ? (
                <span className="badge badge-warning">On a job</span>
              ) : (
                <span className="badge badge-success">Free</span>
              )}
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

function CancelModal({
  order,
  onClose,
  onDone,
}: {
  order: any;
  onClose: () => void;
  onDone: (refundRequired: boolean) => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) setReason('');
  }, [order]);

  const submit = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(`/admin/order/${order.id}/cancel`, { reason });
      onDone(!!data.refundRequired);
    } catch (err) {
      toast(apiError(err, 'Could not cancel this order.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title="Cancel this order"
      description={order?.ticketId}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Keep order
          </Button>
          <Button variant="danger" onClick={submit} loading={saving}>
            Cancel order
          </Button>
        </>
      }
    >
      <Field label="Reason" hint="Shown in the audit log and to the customer.">
        {(id) => (
          <Textarea
            id={id}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer called to cancel"
          />
        )}
      </Field>
      {order?.paymentStatus === 'paid' && (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--warning-text)' }}>
          This order has been paid. Cancelling flags it for a refund — issue the refund from the order's payment
          provider once you are ready.
        </p>
      )}
    </Modal>
  );
}

function UnassignConfirm({
  order,
  onClose,
  onDone,
}: {
  order: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/admin/order/${order.id}/unassign`);
      onDone();
    } catch (err) {
      toast(apiError(err, 'Could not unassign this order.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfirmDialog
      open={!!order}
      onClose={onClose}
      onConfirm={submit}
      loading={saving}
      tone="primary"
      title="Return to the queue"
      confirmLabel="Unassign"
      message={`${order?.ticketId ?? 'This order'} will go back to pending and the rider will be freed up.`}
    />
  );
}
