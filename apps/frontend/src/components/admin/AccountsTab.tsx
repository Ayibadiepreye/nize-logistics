'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck, UserCog } from 'lucide-react';
import api, { apiError } from '@/lib/api';
import { dateTime, relativeTime } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  CopyButton,
  ErrorState,
  Field,
  InlineAlert,
  Input,
  Modal,
  SkeletonTable,
  useToast,
} from '@/components/ui';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Administrator',
  rider: 'Rider',
};

/**
 * Account & credential management.
 *
 * Passwords are hashed with bcrypt server-side and are never readable — not by
 * an admin, not through the API. The only operations available are "issue a new
 * password" and "change my own", which is why a reset shows the new value
 * exactly once and then forgets it.
 */
export function AccountsTab({ currentUserId }: { currentUserId?: string }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [resetTarget, setResetTarget] = useState<any>(null);
  const [statusTarget, setStatusTarget] = useState<any>(null);
  const [selfOpen, setSelfOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/accounts');
      setAccounts(data.accounts);
    } catch (err) {
      setError(apiError(err, 'Could not load accounts.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleStatus = async () => {
    if (!statusTarget) return;
    setSaving(true);
    const next = statusTarget.status === 'active' ? 'suspended' : 'active';
    try {
      await api.put(`/admin/accounts/${statusTarget.id}/status`, { status: next });
      toast(next === 'suspended' ? 'Account disabled' : 'Account enabled', 'success');
      setStatusTarget(null);
      load();
    } catch (err) {
      toast(apiError(err, 'Could not update this account.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={17} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-text)' }} />
            <div>
              <p className="text-[13.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                Passwords are stored as bcrypt hashes and cannot be read back
              </p>
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                To change someone's access, issue a new password — they will be asked to choose their own at the
                next sign-in.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setSelfOpen(true)} icon={<KeyRound size={14} />}>
            Change my password
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Accounts" subtitle="Every account that can sign in to the platform" />

        {loading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : error ? (
          <ErrorState description={error} onRetry={load} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>State</th>
                  <th>Last sign-in</th>
                  <th className="text-right">Credentials</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acct) => (
                  <tr key={acct.id}>
                    <td>
                      <p className="text-[14px] font-semibold">
                        {acct.fullName || acct.username}
                        {acct.id === currentUserId && (
                          <span className="ml-2 text-[12px] font-normal" style={{ color: 'var(--text-muted)' }}>
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        {acct.email} · @{acct.username}
                      </p>
                    </td>
                    <td>
                      <Badge tone={acct.role === 'rider' ? 'neutral' : 'brand'}>
                        {ROLE_LABEL[acct.role] ?? acct.role}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {acct.status === 'active' ? (
                          <Badge tone="success" dot>
                            Active
                          </Badge>
                        ) : (
                          <Badge tone="danger" dot>
                            Disabled
                          </Badge>
                        )}
                        {acct.mustChangePassword && <Badge tone="warning">Reset pending</Badge>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[13px]" style={{ color: 'var(--text-muted)' }}>
                      {acct.lastLoginAt ? relativeTime(acct.lastLoginAt) : 'never'}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {acct.manageable ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setResetTarget(acct)}
                              icon={<RefreshCw size={13} />}
                            >
                              Reset password
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setStatusTarget(acct)}>
                              {acct.status === 'active' ? 'Disable' : 'Enable'}
                            </Button>
                          </>
                        ) : (
                          <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                            {acct.isSelf ? 'Use "Change my password"' : 'Super admin only'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ResetPasswordModal account={resetTarget} onClose={() => setResetTarget(null)} onDone={load} />
      <ChangeOwnPasswordModal open={selfOpen} onClose={() => setSelfOpen(false)} />

      <ConfirmDialog
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={toggleStatus}
        loading={saving}
        tone={statusTarget?.status === 'active' ? 'danger' : 'primary'}
        title={statusTarget?.status === 'active' ? 'Disable this account' : 'Enable this account'}
        confirmLabel={statusTarget?.status === 'active' ? 'Disable' : 'Enable'}
        message={
          statusTarget?.status === 'active'
            ? `${statusTarget?.username} will be signed out and blocked from signing in again.`
            : `${statusTarget?.username} will be able to sign in again.`
        }
      />
    </div>
  );
}

/** Generates a readable but strong one-time password. */
function suggestPassword(): string {
  const words = ['Dispatch', 'Harcourt', 'Package', 'Transit', 'Pickup', 'Waybill', 'Rider', 'Convoy'];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${word}#${digits}`;
}

function ResetPasswordModal({
  account,
  onClose,
  onDone,
}: {
  account: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setPassword(suggestPassword());
      setIssued(null);
    }
  }, [account]);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/admin/accounts/${account.id}/reset-password`, {
        newPassword: password,
        mustChangePassword: true,
      });
      setIssued(password);
      onDone();
    } catch (err) {
      toast(apiError(err, 'Could not reset this password.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!account}
      onClose={onClose}
      title={issued ? 'Password issued' : 'Reset password'}
      description={account ? `${account.fullName || account.username} · ${account.email}` : undefined}
      footer={
        issued ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={saving} disabled={password.length < 8}>
              Issue new password
            </Button>
          </>
        )
      }
    >
      {issued ? (
        <div className="space-y-3">
          <InlineAlert tone="warning">
            Copy this now — it is hashed on save and cannot be shown again. Share it with {account?.username}{' '}
            through a private channel.
          </InlineAlert>
          <div className="surface-inset flex items-center gap-2 p-3">
            <code className="flex-1 font-mono text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {issued}
            </code>
            <CopyButton value={issued} />
          </div>
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            They will be prompted to set their own password the next time they sign in.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <Field
            label="New password"
            hint="At least 8 characters, including a letter and a number."
            required
          >
            {(id) => (
              <div className="flex gap-2">
                <Input id={id} value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button variant="secondary" onClick={() => setPassword(suggestPassword())} type="button">
                  Suggest
                </Button>
              </div>
            )}
          </Field>
          <InlineAlert tone="info">
            The existing password is not revealed by this action — it is replaced.
          </InlineAlert>
        </div>
      )}
    </Modal>
  );
}

function ChangeOwnPasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    }
  }, [open]);

  const mismatch = confirm.length > 0 && confirm !== newPassword;

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast('Your password has been updated', 'success');
      onClose();
    } catch (err) {
      toast(apiError(err, 'Could not change your password.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change my password"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={saving}
            disabled={!currentPassword || newPassword.length < 8 || mismatch || !confirm}
          >
            Update password
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Current password" required>
          {(id) => (
            <Input
              id={id}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          )}
        </Field>
        <Field label="New password" hint="At least 8 characters, including a letter and a number." required>
          {(id) => (
            <Input
              id={id}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          )}
        </Field>
        <Field label="Confirm new password" error={mismatch ? 'Passwords do not match' : undefined} required>
          {(id) => (
            <Input
              id={id}
              type="password"
              value={confirm}
              invalid={mismatch}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
