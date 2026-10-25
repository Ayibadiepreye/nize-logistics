'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Bike, KeyRound, Package, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { DashboardShell, RequireRole } from '@/components/AppShell';
import { Tabs } from '@/components/ui';
import { OverviewTab } from '@/components/admin/OverviewTab';
import { OrdersTab } from '@/components/admin/OrdersTab';
import { RidersTab } from '@/components/admin/RidersTab';
import { AccountsTab } from '@/components/admin/AccountsTab';
import { ReportsTab, SettingsTab } from '@/components/admin/OperationsTab';
import { getUser, type AuthUser } from '@/lib/auth';

type TabId = 'overview' | 'orders' | 'riders' | 'reports' | 'accounts' | 'settings';

export default function AdminPage() {
  return (
    <RequireRole roles={['admin', 'super_admin']}>
      <AdminDashboard />
    </RequireRole>
  );
}

function AdminDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  // Lets the overview hand a pre-applied filter to the orders tab.
  const [ordersStatus, setOrdersStatus] = useState<string | undefined>();

  useEffect(() => {
    setUser(getUser());
  }, []);

  const isSuperAdmin = user?.role === 'super_admin';

  const goToOrders = (status?: string) => {
    setOrdersStatus(status);
    setTab('orders');
  };

  return (
    <DashboardShell
      title="Control centre"
      subtitle={
        user?.fullName
          ? `Signed in as ${user.fullName}${isSuperAdmin ? ' · Super admin' : ''}`
          : 'Platform overview and management'
      }
      tabs={
        <Tabs<TabId>
          onBanner
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
            { id: 'orders', label: 'Orders', icon: <Package size={14} /> },
            { id: 'riders', label: 'Riders', icon: <Bike size={14} /> },
            { id: 'reports', label: 'Issues', icon: <ShieldAlert size={14} /> },
            { id: 'accounts', label: 'Accounts', icon: <KeyRound size={14} /> },
            { id: 'settings', label: 'Settings', icon: <SlidersHorizontal size={14} /> },
          ]}
        />
      }
    >
      {tab === 'overview' && <OverviewTab onGoToOrders={goToOrders} />}
      {/* Remount when the incoming filter changes so the table picks it up. */}
      {tab === 'orders' && <OrdersTab key={ordersStatus ?? 'all'} initialStatus={ordersStatus} />}
      {tab === 'riders' && <RidersTab canInviteAdmins={isSuperAdmin} />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'accounts' && <AccountsTab currentUserId={user?.id} />}
      {tab === 'settings' && <SettingsTab isSuperAdmin={isSuperAdmin} />}
    </DashboardShell>
  );
}
