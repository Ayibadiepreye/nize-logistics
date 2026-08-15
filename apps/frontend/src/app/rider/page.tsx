'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bike,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  Phone,
  Power,
  Wallet,
} from 'lucide-react';
import { DashboardShell, RequireRole } from '@/components/AppShell';
import api, { apiError } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { naira, relativeTime, timeOnly } from '@/lib/format';
import { ORDER_STATUS, statusLabel } from '@/lib/orderStatus';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Input,
  Modal,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from '@/components/ui';

export default function RiderPage() {
  return (
    <RequireRole roles={['rider']}>
      <RiderDashboard />
    </RequireRole>
  );
}

interface DashboardData {
  currentJob: any | null;
  today: { deliveries: number; earnings: string };
  week: { deliveries: number; earnings: string };
  lifetime: { deliveries: number; earnings: string };
  isOnline: boolean;
  isBusy: boolean;
}

function RiderDashboard() {
  const toast = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [pickupOpen, setPickupOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);

  // Kept in a ref so the geolocation timer always sees the live values without
  // being torn down and rebuilt on every state change.
  const stateRef = useRef({ isOnline: false, orderId: null as string | null });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/rider/dashboard');
      setData(data);
      stateRef.current = { isOnline: data.isOnline, orderId: data.currentJob?.id ?? null };
      setError('');
    } catch (err) {
      setError(apiError(err, 'Could not load your dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Live updates + location reporting.
   *
   * Mounted once. The old implementation re-ran on every stats change, which
   * re-registered socket handlers each time and captured a stale `currentJob`
   * in the interval closure, so positions were reported against the wrong job.
   */
  useEffect(() => {
    const socket = getSocket();

    const refresh = () => load();
    socket.on('rider:new-job', refresh);
    socket.on('rider:job-cancelled', refresh);
    socket.on('rider:job-reassigned', refresh);
    socket.on('order:status-update', refresh);

    const timer = setInterval(() => {
      const { isOnline, orderId } = stateRef.current;
      if (!isOnline || !navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          socket.emit('rider:location', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            orderId,
          });
        },
        // A denied permission fires on every tick; log once at debug level only.
        () => {},
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
      );
    }, 15000);

    return () => {
      socket.off('rider:new-job', refresh);
      socket.off('rider:job-cancelled', refresh);
      socket.off('rider:job-reassigned', refresh);
      socket.off('order:status-update', refresh);
      clearInterval(timer);
    };
  }, [load]);

  const toggleOnline = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const { data: res } = await api.post('/rider/toggle-online', { isOnline: !data.isOnline });
      setData((prev) => (prev ? { ...prev, isOnline: res.isOnline } : prev));
      stateRef.current.isOnline = res.isOnline;
      toast(res.isOnline ? "You're online — jobs can reach you" : "You're offline", 'info');
    } catch (err) {
      toast(apiError(err, 'Could not change your status.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const act = async (path: string, body?: any, successMessage?: string) => {
    setBusy(true);
    try {
      await api.post(path, body);
      if (successMessage) toast(successMessage, 'success');
      await load();
      return true;
    } catch (err) {
      toast(apiError(err), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell title="My deliveries">
        <div className="space-y-4">
          <Skeleton style={{ height: 96, borderRadius: 14 }} />
          <Skeleton style={{ height: 220, borderRadius: 14 }} />
        </div>
      </DashboardShell>
    );
  }

  if (error || !data) {
    return (
      <DashboardShell title="My deliveries">
        <Card>
          <ErrorState description={error} onRetry={load} />
        </Card>
      </DashboardShell>
    );
  }

  const job = data.currentJob;

  return (
    <DashboardShell
      title="My deliveries"
      subtitle={data.isOnline ? (data.isBusy ? 'On a delivery' : 'Online and available') : 'Offline'}
      actions={
        <Button
          variant={data.isOnline ? 'secondary' : 'primary'}
          onClick={toggleOnline}
          loading={busy}
          icon={<Power size={15} />}
        >
          {data.isOnline ? 'Go offline' : 'Go online'}
        </Button>
      }
    >
      <div className="space-y-5">
        {!data.isOnline && (
          <InlineAlert tone="warning">
            You are offline, so new deliveries will not be sent to you. Go online when you are ready to ride.
          </InlineAlert>
        )}

        {/* Earnings stay a compact strip even on a phone — the live job below is
            the reason a rider opens this screen, and must not be pushed off it. */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <EarningsTile
            label="Today"
            amount={data.today.earnings}
            count={data.today.deliveries}
            icon={<Wallet size={14} />}
            highlight
          />
          <EarningsTile
            label="This week"
            amount={data.week.earnings}
            count={data.week.deliveries}
            icon={<Clock size={14} />}
          />
          <EarningsTile
            label="All time"
            amount={data.lifetime.earnings}
            count={data.lifetime.deliveries}
            icon={<CheckCircle2 size={14} />}
          />
        </div>

        {job ? (
          <ActiveJob
            job={job}
            busy={busy}
            onAccept={() => act(`/rider/accept/${job.id}`, undefined, 'Delivery accepted')}
            onDecline={() => setDeclineOpen(true)}
            onPickup={() => setPickupOpen(true)}
            onInTransit={() => act(`/rider/in-transit/${job.id}`, undefined, 'Marked as in transit')}
            onDeliver={() => setDeliverOpen(true)}
          />
        ) : (
          <Card>
            <EmptyState
              icon={<Package size={20} />}
              title="No delivery assigned"
              description={
                data.isOnline
                  ? 'You are online and available. The next job assigned to you will appear here straight away.'
                  : 'Go online to start receiving delivery requests.'
              }
              action={
                !data.isOnline ? (
                  <Button variant="primary" onClick={toggleOnline} loading={busy} icon={<Power size={15} />}>
                    Go online
                  </Button>
                ) : undefined
              }
            />
          </Card>
        )}

        <HistoryCard />
      </div>

      <PickupModal
        open={pickupOpen}
        busy={busy}
        onClose={() => setPickupOpen(false)}
        onSubmit={async (minutes) => {
          const eta = minutes
            ? new Date(Date.now() + minutes * 60 * 1000).toISOString()
            : undefined;
          const ok = await act(
            `/rider/pickup/${job.id}`,
            { estimatedDeliveryTime: eta },
            'Package collected'
          );
          if (ok) setPickupOpen(false);
        }}
      />

      <DeliverModal
        open={deliverOpen}
        busy={busy}
        isCod={job?.paymentMethod === 'cod'}
        onClose={() => setDeliverOpen(false)}
        onSubmit={async ({ notes, proofUrl, cashCollected }) => {
          const ok = await act(
            `/rider/deliver/${job.id}`,
            { notes, deliveryProofUrl: proofUrl, cashCollected },
            'Delivery completed — nice work'
          );
          if (ok) setDeliverOpen(false);
        }}
      />

      <ConfirmDialog
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        loading={busy}
        onConfirm={async () => {
          const ok = await act(`/rider/decline/${job.id}`, undefined, 'Delivery declined');
          if (ok) setDeclineOpen(false);
        }}
        title="Decline this delivery"
        confirmLabel="Decline"
        message="The job goes back to dispatch for another rider. Repeated declines are visible to admins."
      />
    </DashboardShell>
  );
}

/* ------------------------------------------------------------- fragments */

function EarningsTile({
  label,
  amount,
  count,
  icon,
  highlight,
}: {
  label: string;
  amount: string;
  count: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className="kpi gap-1 p-3 sm:gap-2 sm:p-[18px]"
      style={highlight ? { borderColor: 'var(--brand-border)' } : undefined}
    >
      <div className="kpi-label text-[12px] sm:text-[13px]">
        {icon}
        {label}
      </div>
      <div
        className="kpi-value text-[17px] sm:text-[26px]"
        style={{ color: highlight ? 'var(--brand-text)' : undefined }}
      >
        {naira(amount)}
      </div>
      <div className="kpi-meta text-[11px] sm:text-[12px]">
        {count} deliver{count === 1 ? 'y' : 'ies'}
      </div>
    </div>
  );
}

/** The live job card — one obvious next action, everything else secondary. */
function ActiveJob({
  job,
  busy,
  onAccept,
  onDecline,
  onPickup,
  onInTransit,
  onDeliver,
}: {
  job: any;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onPickup: () => void;
  onInTransit: () => void;
  onDeliver: () => void;
}) {
  // Where the rider is headed right now decides which address and contact matter.
  const headingToPickup = [ORDER_STATUS.ASSIGNED, ORDER_STATUS.ACCEPTED].includes(job.status);
  const target = headingToPickup
    ? { label: 'Pick up from', address: job.pickupAddress, lat: job.pickupLat, lng: job.pickupLng }
    : { label: 'Deliver to', address: job.dropoffAddress, lat: job.dropoffLat, lng: job.dropoffLng };

  const contact = headingToPickup
    ? { name: job.senderName, phone: job.senderPhone, whatsapp: job.senderWhatsapp, role: 'Sender' }
    : { name: job.recipientName, phone: job.recipientPhone, whatsapp: job.recipientWhatsapp, role: 'Recipient' };

  const primary = {
    [ORDER_STATUS.ASSIGNED]: { label: 'Accept delivery', onClick: onAccept },
    [ORDER_STATUS.ACCEPTED]: { label: 'I have collected the package', onClick: onPickup },
    [ORDER_STATUS.PICKED_UP]: { label: 'Start the journey', onClick: onInTransit },
    [ORDER_STATUS.IN_TRANSIT]: { label: 'Complete delivery', onClick: onDeliver },
  }[job.status as string];

  return (
    <Card>
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[15px] font-bold" style={{ color: 'var(--brand-text)' }}>
              {job.ticketId}
            </span>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            {job.distanceKm} km · {job.paymentMethod === 'cod' ? 'Collect cash on delivery' : 'Paid online'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11.5px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            You earn
          </p>
          <p className="text-[20px] font-bold tabular-nums" style={{ color: 'var(--success-text)' }}>
            {naira(job.totalPrice)}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* The address that matters right now, big and actionable. */}
        <div className="surface-inset p-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {target.label}
          </p>
          <p className="mt-1 text-[16px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
            {target.address}
          </p>
          <a
            className="btn btn-outline btn-sm mt-3"
            href={`https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation size={14} />
            Open in Maps
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {contact.role}
            </p>
            <p className="truncate text-[14px] font-semibold">{contact.name}</p>
          </div>
          <a className="btn btn-secondary btn-sm" href={`tel:${contact.phone}`}>
            <Phone size={14} />
            Call
          </a>
          {contact.whatsapp && (
            <a
              className="btn btn-secondary btn-sm"
              href={`https://wa.me/${String(contact.whatsapp).replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageSquare size={14} />
              WhatsApp
            </a>
          )}
        </div>

        {job.description && (
          <div>
            <p className="text-[11.5px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Package
            </p>
            <p className="text-[13.5px]">{job.description}</p>
          </div>
        )}

        {job.notes && <InlineAlert tone="warning">{job.notes}</InlineAlert>}

        {/* The full route, secondary to the immediate destination. */}
        <div className="flex items-start gap-2.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          <MapPin size={14} className="mt-0.5 shrink-0" />
          <p>
            {job.pickupAddress} <ChevronRight size={12} className="inline" /> {job.dropoffAddress}
          </p>
        </div>

        {job.estimatedDeliveryTime && (
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            You promised delivery by <strong>{timeOnly(job.estimatedDeliveryTime)}</strong>
          </p>
        )}
      </div>

      {primary && (
        <div
          className="flex flex-col gap-2 p-5 sm:flex-row-reverse"
          style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}
        >
          <Button variant="primary" size="lg" block onClick={primary.onClick} loading={busy}>
            {primary.label}
          </Button>
          {job.status === ORDER_STATUS.ASSIGNED && (
            <Button variant="ghost" size="lg" onClick={onDecline} disabled={busy}>
              Decline
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function PickupModal({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (minutes: number | null) => void;
}) {
  const [minutes, setMinutes] = useState('30');

  useEffect(() => {
    if (open) setMinutes('30');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Package collected"
      description="Give the customer an estimate so they know when to expect you."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSubmit(Number(minutes) || null)} loading={busy}>
            Confirm pickup
          </Button>
        </>
      }
    >
      <Field label="Estimated time to deliver" hint="Roughly how long the drop-off will take.">
        {(id) => (
          <div className="flex flex-wrap gap-2">
            {['15', '30', '45', '60'].map((m) => (
              <button
                key={m}
                type="button"
                className={`btn ${minutes === m ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setMinutes(m)}
              >
                {m} min
              </button>
            ))}
            <Input
              id={id}
              type="number"
              min="1"
              max="480"
              className="w-24"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              aria-label="Custom minutes"
            />
          </div>
        )}
      </Field>
    </Modal>
  );
}

function DeliverModal({
  open,
  busy,
  isCod,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  isCod: boolean;
  onClose: () => void;
  onSubmit: (v: { notes: string; proofUrl?: string; cashCollected: boolean }) => void;
}) {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [proofUrl, setProofUrl] = useState<string | undefined>();
  const [cashCollected, setCashCollected] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setNotes('');
      setProofUrl(undefined);
      setCashCollected(false);
    }
  }, [open]);

  const uploadProof = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/upload/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProofUrl(data.url);
      toast('Proof of delivery attached', 'success');
    } catch (err) {
      toast(apiError(err, 'Could not upload that photo.'), 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Complete this delivery"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={() => onSubmit({ notes, proofUrl, cashCollected })}
            loading={busy}
            disabled={isCod && !cashCollected}
          >
            Mark as delivered
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {isCod && (
          <label
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
            style={{
              borderColor: cashCollected ? 'var(--success)' : 'var(--border-default)',
              background: cashCollected ? 'var(--success-subtle)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={cashCollected}
              onChange={(e) => setCashCollected(e.target.checked)}
            />
            <span>
              <span className="block text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                I collected the cash payment
              </span>
              <span className="block text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                Required before a cash-on-delivery order can be closed.
              </span>
            </span>
          </label>
        )}

        <Field label="Proof of delivery" hint="A photo of the package or the signature, if you have one.">
          {(id) => (
            <div className="flex items-center gap-3">
              <label className="btn btn-outline" htmlFor={id}>
                <Camera size={14} />
                {proofUrl ? 'Replace photo' : 'Add photo'}
              </label>
              <input
                id={id}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadProof(file);
                }}
              />
              {uploading && <span className="spinner" />}
              {proofUrl && !uploading && (
                <Badge tone="success" dot>
                  Attached
                </Badge>
              )}
            </div>
          )}
        </Field>

        <Field label="Delivery notes" hint="Anything worth recording — who received it, any issue.">
          {(id) => (
            <Textarea
              id={id}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Handed to the receptionist"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}

function HistoryCard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api
      .get('/rider/history', { params: { limit: 20 } })
      .then(({ data }) => {
        setOrders(data.orders);
        setSummary(data.summary);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = expanded ? orders : orders.slice(0, 5);

  return (
    <Card>
      <CardHeader
        title="Delivery history"
        subtitle={
          summary
            ? `${summary.delivered} completed · ${naira(summary.earnings)} earned`
            : 'Your completed and cancelled jobs'
        }
      />
      {loading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Bike size={20} />}
          title="No deliveries yet"
          description="Once you complete your first delivery it will show up here with what you earned."
        />
      ) : (
        <>
          <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {visible.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {o.ticketId}
                  </p>
                  <p className="truncate text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                    {o.dropoffAddress}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={o.status} />
                  <span className="w-20 text-right text-[13.5px] font-semibold tabular-nums">
                    {naira(o.totalPrice)}
                  </span>
                  <span className="hidden w-24 text-right text-[12.5px] sm:block" style={{ color: 'var(--text-muted)' }}>
                    {relativeTime(o.deliveredAt || o.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {orders.length > 5 && (
            <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Show less' : `Show all ${orders.length}`}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
