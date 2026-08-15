'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bike, Mail, UserPlus } from 'lucide-react';
import api, { apiError } from '@/lib/api';
import { naira, duration, relativeTime } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Input,
  Modal,
  Select,
  SkeletonTable,
  useToast,
} from '@/components/ui';

export function RidersTab({ canInviteAdmins }: { canInviteAdmins: boolean }) {
  const toast = useToast();
  const [riders, setRiders] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ridersRes, perfRes] = await Promise.all([
        api.get('/admin/riders'),
        api.get('/admin/analytics/riders'),
      ]);
      setRiders(ridersRes.data.riders);
      setPerformance(perfRes.data.riders);
    } catch (err) {
      setError(apiError(err, 'Could not load riders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const perfFor = (id: string) => performance.find((p) => p.id === id);

  const changeStatus = async () => {
    if (!statusTarget) return;
    setSaving(true);
    const nextStatus = statusTarget.status === 'active' ? 'suspended' : 'active';
    try {
      await api.put(`/admin/rider/${statusTarget.id}/status`, { status: nextStatus });
      toast(nextStatus === 'suspended' ? 'Rider suspended' : 'Rider reactivated', 'success');
      setStatusTarget(null);
      load();
    } catch (err) {
      toast(apiError(err, 'Could not update this rider.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Rider fleet"
          subtitle={`${riders.length} rider${riders.length === 1 ? '' : 's'} · ${riders.filter((r) => r.isOnline).length} online now`}
          action={
            <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)} icon={<UserPlus size={14} />}>
              Invite
            </Button>
          }
        />

        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : error ? (
          <ErrorState description={error} onRetry={load} />
        ) : riders.length === 0 ? (
          <EmptyState
            icon={<Bike size={20} />}
            title="No riders yet"
            description="Invite your first dispatch rider — they'll receive a signup link by email."
            action={
              <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                Invite a rider
              </Button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Rider</th>
                  <th>Availability</th>
                  <th>Vehicle</th>
                  <th className="text-right">Delivered</th>
                  <th className="text-right">Earned</th>
                  <th className="text-right">Avg time</th>
                  <th>Last seen</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {riders.map((rider) => {
                  const perf = perfFor(rider.id);
                  return (
                    <tr key={rider.id}>
                      <td>
                        <p className="text-[14px] font-semibold">{rider.fullName || rider.username}</p>
                        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                          {rider.phone || rider.email}
                        </p>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {rider.status === 'suspended' ? (
                            <Badge tone="danger">Suspended</Badge>
                          ) : rider.isOnline ? (
                            <Badge tone="success" dot>
                              Online
                            </Badge>
                          ) : (
                            <Badge tone="neutral" dot>
                              Offline
                            </Badge>
                          )}
                          {rider.isBusy && <Badge tone="warning">On a job</Badge>}
                        </div>
                      </td>
                      <td className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                        <span className="capitalize">{rider.vehicleType || '—'}</span>
                        {rider.plateNumber && (
                          <p className="font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>
                            {rider.plateNumber}
                          </p>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{perf?.delivered ?? rider.totalDeliveries ?? 0}</td>
                      <td className="text-right tabular-nums">{naira(perf?.revenue ?? rider.totalAmount)}</td>
                      <td className="text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {duration(perf?.avgMinutes)}
                      </td>
                      <td className="whitespace-nowrap text-[13px]" style={{ color: 'var(--text-muted)' }}>
                        {rider.lastSeen ? relativeTime(rider.lastSeen) : 'never'}
                      </td>
                      <td className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setStatusTarget(rider)}>
                          {rider.status === 'active' ? 'Suspend' : 'Reactivate'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <InviteModal
        open={inviteOpen}
        canInviteAdmins={canInviteAdmins}
        onClose={() => setInviteOpen(false)}
        onDone={load}
      />

      <ConfirmDialog
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={changeStatus}
        loading={saving}
        tone={statusTarget?.status === 'active' ? 'danger' : 'primary'}
        title={statusTarget?.status === 'active' ? 'Suspend this rider' : 'Reactivate this rider'}
        confirmLabel={statusTarget?.status === 'active' ? 'Suspend' : 'Reactivate'}
        message={
          statusTarget?.status === 'active'
            ? `${statusTarget?.fullName || statusTarget?.username} will be taken offline and blocked from signing in. Any active delivery must be reassigned first.`
            : `${statusTarget?.fullName || statusTarget?.username} will be able to sign in and take deliveries again.`
        }
      />
    </div>
  );
}

function InviteModal({
  open,
  canInviteAdmins,
  onClose,
  onDone,
}: {
  open: boolean;
  canInviteAdmins: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('rider');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ link: string; emailed: boolean } | null>(null);

  useEffect(() => {
    if (open) {
      setEmail('');
      setRole('rider');
      setResult(null);
    }
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      const { data } = await api.post('/admin/invite', { email, role });
      setResult({ link: data.signupLink, emailed: data.emailed });
      onDone();
    } catch (err) {
      toast(apiError(err, 'Could not send the invite.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={result ? 'Invite created' : 'Invite a team member'}
      description={result ? undefined : 'They receive a signup link that expires in 7 days.'}
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={saving} disabled={!email} icon={<Mail size={14} />}>
              Send invite
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <InlineAlert tone={result.emailed ? 'success' : 'warning'}>
            {result.emailed
              ? 'The invite email is on its way.'
              : 'The invite was created but the email could not be sent. Share the link below directly.'}
          </InlineAlert>
          <div className="surface-inset flex items-center gap-2 p-3">
            <code className="min-w-0 flex-1 break-all text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
              {result.link}
            </code>
            <CopyButton value={result.link} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Email address" required>
            {(id) => (
              <Input
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rider@example.com"
              />
            )}
          </Field>
          <Field
            label="Role"
            hint={canInviteAdmins ? undefined : 'Only a super admin can invite administrators.'}
          >
            {(id) => (
              <Select id={id} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="rider">Rider</option>
                {canInviteAdmins && <option value="admin">Administrator</option>}
              </Select>
            )}
          </Field>
        </div>
      )}
    </Modal>
  );
}
