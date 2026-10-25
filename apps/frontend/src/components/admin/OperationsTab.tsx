'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileWarning, History, Save } from 'lucide-react';
import api, { apiError } from '@/lib/api';
import { dateTime, naira, relativeTime } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Input,
  Modal,
  SkeletonTable,
  StatusBadge,
  Textarea,
  useToast,
} from '@/components/ui';

/** Issue queue raised by recipients from their tracking link. */
export function ReportsTab() {
  const toast = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/reports');
      setReports(data.reports);
    } catch (err) {
      setError(apiError(err, 'Could not load reports.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async () => {
    setSaving(true);
    try {
      await api.post(`/admin/reports/${target.id}/resolve`, { notes });
      toast('Report resolved', 'success');
      setTarget(null);
      setNotes('');
      load();
    } catch (err) {
      toast(apiError(err, 'Could not resolve this report.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const open = reports.filter((r) => r.status === 'open');

  return (
    <>
      <Card>
        <CardHeader
          title="Reported issues"
          subtitle={
            open.length
              ? `${open.length} open issue${open.length === 1 ? '' : 's'} needing a response`
              : 'Problems raised by recipients about their deliveries'
          }
        />

        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : error ? (
          <ErrorState description={error} onRetry={load} />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={20} />}
            title="Nothing reported"
            description="When a recipient reports a damaged, missing or late package, it lands here."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Issue</th>
                  <th>Details</th>
                  <th>Raised</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="font-mono text-[13px] font-semibold" style={{ color: 'var(--brand-text)' }}>
                        {r.ticketId ?? '—'}
                      </span>
                      {r.orderStatus && (
                        <div className="mt-1">
                          <StatusBadge status={r.orderStatus} />
                        </div>
                      )}
                    </td>
                    <td>
                      <Badge tone={r.status === 'open' ? 'danger' : 'success'}>
                        {r.type?.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td>
                      <p className="max-w-[320px] text-[13.5px]">{r.description}</p>
                      {r.resolutionNotes && (
                        <p className="mt-1 text-[12.5px]" style={{ color: 'var(--success-text)' }}>
                          Resolved: {r.resolutionNotes}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-[13px]" style={{ color: 'var(--text-muted)' }}>
                      {relativeTime(r.createdAt)}
                    </td>
                    <td className="text-right">
                      {r.status === 'open' ? (
                        <Button size="sm" variant="outline" onClick={() => setTarget(r)}>
                          Resolve
                        </Button>
                      ) : (
                        <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                          {dateTime(r.resolvedAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title="Resolve this report"
        description={target?.ticketId}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={resolve} loading={saving}>
              Mark resolved
            </Button>
          </>
        }
      >
        <Field label="What was done?" hint="Recorded against the order for future reference.">
          {(id) => (
            <Textarea
              id={id}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Contacted the customer and arranged a redelivery"
            />
          )}
        </Field>
      </Modal>
    </>
  );
}

/** Fare configuration + the audit trail. */
export function SettingsTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const toast = useToast();
  const [pricing, setPricing] = useState({ baseFare: '', perKmRate: '', minimumFare: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pricingRes, auditRes] = await Promise.all([
        api.get('/admin/pricing'),
        api.get('/admin/audit', { params: { limit: 25 } }),
      ]);
      const p = pricingRes.data.pricing;
      setPricing({
        baseFare: String(parseFloat(p.baseFare ?? 500)),
        perKmRate: String(parseFloat(p.perKmRate ?? 120)),
        minimumFare: String(parseFloat(p.minimumFare ?? 1000)),
      });
      setLogs(auditRes.data.logs);
    } catch (err) {
      setError(apiError(err, 'Could not load settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePricing = async () => {
    setSaving(true);
    try {
      await api.put('/admin/pricing', {
        baseFare: Number(pricing.baseFare),
        perKmRate: Number(pricing.perKmRate),
        minimumFare: Number(pricing.minimumFare),
      });
      toast('Fares updated', 'success');
      load();
    } catch (err) {
      toast(apiError(err, 'Could not save the fares.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const sample = (() => {
    const base = Number(pricing.baseFare) || 0;
    const perKm = Number(pricing.perKmRate) || 0;
    const min = Number(pricing.minimumFare) || 0;
    return Math.round(Math.max(min, base + 5 * perKm));
  })();

  if (error) {
    return (
      <Card>
        <ErrorState description={error} onRetry={load} />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Delivery pricing" subtitle="Applied to every new booking immediately" />
        {loading ? (
          <SkeletonTable rows={2} cols={3} />
        ) : (
          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Base fare (₦)" required>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min="0"
                    value={pricing.baseFare}
                    onChange={(e) => setPricing({ ...pricing, baseFare: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Rate per km (₦)" required>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min="0"
                    value={pricing.perKmRate}
                    onChange={(e) => setPricing({ ...pricing, perKmRate: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Minimum fare (₦)" required>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min="0"
                    value={pricing.minimumFare}
                    onChange={(e) => setPricing({ ...pricing, minimumFare: e.target.value })}
                  />
                )}
              </Field>
            </div>

            <InlineAlert tone="info">
              A 5&nbsp;km delivery currently costs <strong>{naira(sample)}</strong>.
            </InlineAlert>

            <div className="flex justify-end">
              <Button variant="primary" onClick={savePricing} loading={saving} icon={<Save size={14} />}>
                Save pricing
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Activity log"
          subtitle="Every privileged action, newest first"
          action={<History size={16} style={{ color: 'var(--text-muted)' }} />}
        />
        {loading ? (
          <SkeletonTable rows={5} cols={3} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<FileWarning size={20} />}
            title="No activity recorded yet"
            description="Assignments, cancellations, credential changes and settings edits will appear here."
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-[13.5px]" style={{ color: 'var(--text-primary)' }}>
                    {log.summary || log.action}
                  </p>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    {log.actorLabel ?? 'system'} · {log.action}
                  </p>
                </div>
                <span
                  className="whitespace-nowrap text-[12.5px]"
                  style={{ color: 'var(--text-muted)' }}
                  title={dateTime(log.createdAt)}
                >
                  {relativeTime(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!isSuperAdmin && (
        <InlineAlert tone="info">
          Platform-wide settings such as maintenance mode and data retention are managed by a super admin.
        </InlineAlert>
      )}
    </div>
  );
}
