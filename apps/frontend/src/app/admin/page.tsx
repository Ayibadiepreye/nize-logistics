'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import {
  Package, Users, DollarSign, TrendingUp, UserPlus, Mail, Activity, Clock,
  CheckCircle, XCircle, AlertCircle, ArrowRight, BarChart3, Eye, FileText,
  AlertTriangle, RefreshCw, Search, Filter, ShieldCheck, Settings, LogOut,
  ChevronRight, Menu, X, Phone, MessageSquare, MapPin, Truck, ExternalLink,
  Sliders, ArrowUpRight, Check, Sun, Moon
} from 'lucide-react';

type TabType = 'overview' | 'orders' | 'riders' | 'reports' | 'settings';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Data States
  const [stats, setStats] = useState<any>({
    orders: {
      totalOrders: 0,
      pendingOrders: 0,
      activeOrders: 0,
      deliveredOrders: 0,
      totalRevenue: 0,
    },
    riders: {
      totalRiders: 0,
      onlineRiders: 0,
      busyRiders: 0,
    },
    reports: {
      totalReports: 0,
      openReports: 0,
      resolvedReports: 0,
    },
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [pricing, setPricing] = useState({
    baseFare: '500.00',
    perKmRate: '150.00',
    minimumFare: '1000.00',
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('rider');
  const [inviteLoading, setInviteLoading] = useState(false);

  const [assignModalOrder, setAssignModalOrder] = useState<any>(null);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const [savingPricing, setSavingPricing] = useState(false);

  // Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [riderSearch, setRiderSearch] = useState('');
  const [riderStatusFilter, setRiderStatusFilter] = useState('all');

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/login');
      return;
    }

    try {
      const userData = JSON.parse(userStr);
      if (userData.role !== 'admin' && userData.role !== 'super_admin') {
        router.push('/');
        return;
      }
      setCurrentUser(userData);
    } catch {
      router.push('/login');
      return;
    }

    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setRefreshing(true);
    try {
      const [dashRes, ordersRes, ridersRes, reportsRes, pricingRes] = await Promise.all([
        api.get('/admin/dashboard').catch(() => ({ data: null })),
        api.get('/admin/orders?limit=100').catch(() => ({ data: { orders: [] } })),
        api.get('/admin/riders').catch(() => ({ data: { riders: [] } })),
        api.get('/admin/reports').catch(() => ({ data: { reports: [] } })),
        api.get('/admin/pricing').catch(() => ({ data: { pricing: null } })),
      ]);

      if (dashRes?.data) {
        setStats({
          orders: dashRes.data.orders || {
            totalOrders: 0,
            pendingOrders: 0,
            activeOrders: 0,
            deliveredOrders: 0,
            totalRevenue: 0,
          },
          riders: dashRes.data.riders || {
            totalRiders: 0,
            onlineRiders: 0,
            busyRiders: 0,
          },
          reports: dashRes.data.reports || {
            totalReports: 0,
            openReports: 0,
            resolvedReports: 0,
          },
        });
      }

      setOrders(ordersRes?.data?.orders || []);
      setRiders(ridersRes?.data?.riders || []);
      setReportsList(reportsRes?.data?.reports || []);

      if (pricingRes?.data?.pricing) {
        setPricing({
          baseFare: pricingRes.data.pricing.baseFare || '500.00',
          perKmRate: pricingRes.data.pricing.perKmRate || '150.00',
          minimumFare: pricingRes.data.pricing.minimumFare || '1000.00',
        });
      }

      setErrorMessage('');
    } catch (error: any) {
      console.error('Failed to load dashboard', error);
      setErrorMessage(error?.response?.data?.error || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const sendInvite = async () => {
    if (!inviteEmail) {
      alert('Please enter an email address');
      return;
    }

    setInviteLoading(true);
    try {
      const { data } = await api.post('/admin/invite', {
        email: inviteEmail,
        role: inviteRole,
      });

      alert(`✅ Invite sent successfully!\n\nSignup link: ${data.signupLink}`);
      setInviteEmail('');
      setShowInviteModal(false);
      loadDashboard();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to send invite');
    } finally {
      setInviteLoading(false);
    }
  };

  const toggleRiderStatus = async (riderId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (!confirm(`Are you sure you want to ${newStatus === 'suspended' ? 'suspend' : 'activate'} this rider?`)) {
      return;
    }

    try {
      await api.put(`/admin/rider/${riderId}/status`, { status: newStatus });
      loadDashboard();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update rider status');
    }
  };

  const assignRiderToOrder = async () => {
    if (!assignModalOrder || !selectedRiderId) {
      alert('Please select a rider to assign');
      return;
    }

    setAssignLoading(true);
    try {
      await api.post(`/admin/order/${assignModalOrder.id}/assign`, { riderId: selectedRiderId });
      setSuccessMessage(`Order #${assignModalOrder.ticketId} assigned successfully!`);
      setAssignModalOrder(null);
      setSelectedRiderId('');
      loadDashboard();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign order');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPricing(true);
    try {
      await api.put('/admin/pricing', pricing);
      setSuccessMessage('Pricing updated successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update pricing');
    } finally {
      setSavingPricing(false);
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchStatus = orderStatusFilter === 'all' || order.status === orderStatusFilter;
      const searchLower = orderSearch.toLowerCase();
      const matchSearch =
        !orderSearch ||
        order.ticketId?.toLowerCase().includes(searchLower) ||
        order.pickupAddress?.toLowerCase().includes(searchLower) ||
        order.dropoffAddress?.toLowerCase().includes(searchLower) ||
        order.senderName?.toLowerCase().includes(searchLower) ||
        order.recipientName?.toLowerCase().includes(searchLower);
      return matchStatus && matchSearch;
    });
  }, [orders, orderStatusFilter, orderSearch]);

  // Filtered Riders
  const filteredRiders = useMemo(() => {
    return riders.filter((rider) => {
      const matchStatus =
        riderStatusFilter === 'all' ||
        (riderStatusFilter === 'online' && rider.isOnline) ||
        (riderStatusFilter === 'offline' && !rider.isOnline) ||
        (riderStatusFilter === 'suspended' && rider.status === 'suspended') ||
        (riderStatusFilter === 'active' && rider.status === 'active');
      const searchLower = riderSearch.toLowerCase();
      const matchSearch =
        !riderSearch ||
        rider.fullName?.toLowerCase().includes(searchLower) ||
        rider.phone?.toLowerCase().includes(searchLower) ||
        rider.plateNumber?.toLowerCase().includes(searchLower) ||
        rider.email?.toLowerCase().includes(searchLower);
      return matchStatus && matchSearch;
    });
  }, [riders, riderStatusFilter, riderSearch]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <span className="badge badge-delivered"><CheckCircle className="w-3 h-3 inline" /> Delivered</span>;
      case 'cancelled':
        return <span className="badge badge-cancelled"><XCircle className="w-3 h-3 inline" /> Cancelled</span>;
      case 'picked_up':
      case 'in_transit':
        return <span className="badge badge-picked_up"><Activity className="w-3 h-3 inline" /> In Transit</span>;
      case 'accepted':
      case 'assigned':
        return <span className="badge badge-assigned"><Clock className="w-3 h-3 inline" /> Assigned</span>;
      case 'pending':
      default:
        return <span className="badge badge-pending"><AlertCircle className="w-3 h-3 inline" /> Pending</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center space-y-4">
          <div className="spinner mx-auto"></div>
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Loading Nize Admin Center...</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Synchronizing logistics data & dispatch status</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ================= SIDEBAR NAVIGATION ================= */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
        }}
      >
        {/* Sidebar Header & Brand */}
        <div>
          <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #0066ff 0%, #ff3366 100%)',
                    boxShadow: '0 4px 16px rgba(0, 102, 255, 0.4)',
                  }}
                >
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold text-xl tracking-tight" style={{ color: '#0066ff' }}>Nize</span>
                    <span className="font-bold text-xl tracking-tight" style={{ color: '#ff3366' }}>Logistics</span>
                  </div>
                  <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
                    Admin Center
                  </span>
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white"
                style={{ background: 'transparent', border: 'none' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Admin Profile Card */}
            <div
              className="mt-5 p-3.5 rounded-xl flex items-center gap-3 border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #0066ff 0%, #00d9ff 100%)' }}
              >
                {currentUser?.fullName?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                  {currentUser?.fullName || 'Super Administrator'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[11px] font-semibold capitalize" style={{ color: 'var(--text-secondary)' }}>
                    {currentUser?.role?.replace('_', ' ') || 'Admin'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3, count: null },
              { id: 'orders', label: 'Orders', icon: Package, count: stats?.orders?.totalOrders || 0 },
              { id: 'riders', label: 'Rider Fleet', icon: Users, count: `${stats?.riders?.onlineRiders || 0} online` },
              { id: 'reports', label: 'Issue Reports', icon: AlertTriangle, count: stats?.reports?.openReports || 0 },
              { id: 'settings', label: 'Pricing & Settings', icon: Sliders, count: null },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as TabType); setSidebarOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs transition-all duration-200"
                  style={{
                    background: isActive ? 'linear-gradient(135deg, #0066ff 0%, #0052cc 100%)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 4px 16px rgba(0, 102, 255, 0.3)' : 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== null && (
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                      style={{
                        background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'rgba(148, 163, 184, 0.15)',
                        color: isActive ? '#ffffff' : 'var(--text-primary)',
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Actions */}
        <div className="p-4 border-t space-y-2" style={{ borderColor: 'var(--border-color)' }}>
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{ color: 'var(--text-secondary)', background: 'transparent' }}
          >
            <ExternalLink className="w-4 h-4" />
            <span>Go to Public Website</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{ color: '#ff4d7d', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT AREA ================= */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        {/* Top Control Bar */}
        <header
          className="sticky top-0 z-30 px-4 md:px-8 py-4 backdrop-blur-md border-b flex items-center justify-between gap-4"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'transparent' }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black capitalize tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {activeTab === 'overview' && 'Executive Overview'}
                {activeTab === 'orders' && 'Order Dispatch & Tracking'}
                {activeTab === 'riders' && 'Rider Fleet Command'}
                {activeTab === 'reports' && 'Customer Issue Reports'}
                {activeTab === 'settings' && 'Pricing & Platform Configuration'}
              </h1>
              <p className="text-xs hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                Real-time Port Harcourt Logistics Control Center
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Indicator */}
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold"
              style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}
            >
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span>Live System</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadDashboard}
              disabled={refreshing}
              className="p-2.5 rounded-xl border transition-all"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'transparent', cursor: 'pointer' }}
              title="Refresh Dashboard Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Invite User CTA */}
            <button
              onClick={() => setShowInviteModal(true)}
              className="btn btn-primary btn-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Invite User</span>
            </button>
          </div>
        </header>

        {/* Notification Banners & Tab Content */}
        <div className="p-4 md:p-8 space-y-6">
          {errorMessage && (
            <div className="p-4 rounded-xl flex items-center gap-3 border bg-red-500/10 border-red-500/30 text-red-400 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-xl flex items-center gap-3 border bg-green-500/10 border-green-500/30 text-green-400 text-xs font-semibold">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <p>{successMessage}</p>
            </div>
          )}

          {/* ================= TAB 1: OVERVIEW ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 5 KPI Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Orders */}
                <div
                  className="rounded-2xl p-5 border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Total Orders</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0, 102, 255, 0.15)' }}>
                      <Package className="w-4 h-4" style={{ color: '#0066ff' }} />
                    </div>
                  </div>
                  <p className="text-3xl font-black mb-1" style={{ color: '#0066ff' }}>
                    {stats?.orders?.totalOrders || 0}
                  </p>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-bold text-amber-400">{stats?.orders?.pendingOrders || 0} Pending</span>
                    <span>•</span>
                    <span className="font-bold text-blue-400">{stats?.orders?.activeOrders || 0} Active</span>
                  </div>
                </div>

                {/* Total Revenue */}
                <div
                  className="rounded-2xl p-5 border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Revenue</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255, 51, 102, 0.15)' }}>
                      <DollarSign className="w-4 h-4" style={{ color: '#ff3366' }} />
                    </div>
                  </div>
                  <p className="text-3xl font-black mb-1" style={{ color: '#ff3366' }}>
                    ₦{parseFloat(stats?.orders?.totalRevenue || 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>Settled payments</p>
                </div>

                {/* Delivered Packages */}
                <div
                  className="rounded-2xl p-5 border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Delivered</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                      <CheckCircle className="w-4 h-4" style={{ color: '#10b981' }} />
                    </div>
                  </div>
                  <p className="text-3xl font-black mb-1" style={{ color: '#10b981' }}>
                    {stats?.orders?.deliveredOrders || 0}
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>Completed packages</p>
                </div>

                {/* Active Riders */}
                <div
                  className="rounded-2xl p-5 border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Fleet</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
                      <Users className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                    </div>
                  </div>
                  <p className="text-3xl font-black mb-1" style={{ color: '#8b5cf6' }}>
                    {stats?.riders?.totalRiders || 0}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-green-400 font-bold">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span>{stats?.riders?.onlineRiders || 0} Online Now</span>
                  </div>
                </div>

                {/* Reports */}
                <div
                  className="rounded-2xl p-5 border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Reports</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: '#f59e0b' }} />
                    </div>
                  </div>
                  <p className="text-3xl font-black mb-1" style={{ color: '#f59e0b' }}>
                    {stats?.reports?.openReports || 0}
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {stats?.reports?.totalReports || 0} total tickets
                  </p>
                </div>
              </div>

              {/* Two Column Grid: Recent Orders & Fleet Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Orders List (2 Cols) */}
                <div
                  className="lg:col-span-2 rounded-2xl p-6 border space-y-4"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Recent Dispatch Orders</h2>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Latest booked customer orders</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('orders')}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      View All Orders <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b text-[11px] font-bold uppercase" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                          <th className="pb-3">Ticket</th>
                          <th className="pb-3">Route</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3">Amount</th>
                          <th className="pb-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-xs" style={{ borderColor: 'var(--border-color)' }}>
                        {orders.slice(0, 6).map((order) => (
                          <tr key={order.id} className="hover:bg-slate-500/5 transition-colors">
                            <td className="py-3 font-mono font-bold text-blue-400">{order.ticketId}</td>
                            <td className="py-3 max-w-[200px]">
                              <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{order.pickupAddress?.split(',')[0]}</p>
                              <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>→ {order.dropoffAddress?.split(',')[0]}</p>
                            </td>
                            <td className="py-3">{getStatusBadge(order.status)}</td>
                            <td className="py-3 font-bold" style={{ color: 'var(--text-primary)' }}>₦{parseFloat(order.totalPrice || 0).toLocaleString()}</td>
                            <td className="py-3 text-right">
                              {order.status === 'pending' ? (
                                <button
                                  onClick={() => setAssignModalOrder(order)}
                                  className="btn btn-primary btn-sm"
                                >
                                  Assign
                                </button>
                              ) : (
                                <a
                                  href={`/track/${order.ticketId}`}
                                  target="_blank"
                                  className="btn btn-outline btn-sm"
                                >
                                  Track
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fleet Availability (1 Col) */}
                <div
                  className="rounded-2xl p-6 border space-y-4"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Fleet Availability</h2>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Riders ready for dispatch</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('riders')}
                      className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      Fleet Command <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {riders.slice(0, 5).map((rider) => (
                      <div
                        key={rider.id}
                        className="p-3.5 rounded-xl border flex items-center justify-between transition-all"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white"
                            style={{
                              background: rider.isOnline
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                            }}
                          >
                            {rider.fullName?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{rider.fullName}</p>
                            <p className="text-[11px] capitalize" style={{ color: 'var(--text-secondary)' }}>{rider.vehicleType} • {rider.plateNumber || 'No plate'}</p>
                          </div>
                        </div>

                        <span
                          className={`badge ${rider.isOnline ? 'badge-delivered' : 'badge-pending'}`}
                        >
                          {rider.isOnline ? (rider.isBusy ? 'On Job' : 'Online') : 'Offline'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: ORDERS ================= */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              {/* Order Search & Status Filter */}
              <div
                className="rounded-2xl p-5 border flex flex-col md:flex-row items-center justify-between gap-4"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div className="relative w-full md:w-96">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search ticket ID, address, client..."
                    className="input pl-10 text-xs w-full"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                  {['all', 'pending', 'assigned', 'accepted', 'picked_up', 'delivered', 'cancelled'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setOrderStatusFilter(status)}
                      className={`btn btn-sm capitalize ${orderStatusFilter === status ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {status.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comprehensive Orders Table */}
              <div
                className="rounded-2xl p-6 border space-y-4"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Showing {filteredOrders.length} orders
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b text-[11px] font-bold uppercase" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th className="pb-3">Ticket ID</th>
                        <th className="pb-3">Pickup Address</th>
                        <th className="pb-3">Dropoff Address</th>
                        <th className="pb-3">Client Contact</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Total Amount</th>
                        <th className="pb-3">Date</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs" style={{ borderColor: 'var(--border-color)' }}>
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="font-bold text-sm">No orders matching your criteria</p>
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-500/5 transition-colors">
                            <td className="py-4 font-mono font-bold text-blue-400">
                              {order.ticketId}
                            </td>
                            <td className="py-4 max-w-[180px]">
                              <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{order.pickupAddress}</p>
                              {order.senderPhone && <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{order.senderPhone}</p>}
                            </td>
                            <td className="py-4 max-w-[180px]">
                              <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{order.dropoffAddress}</p>
                              {order.recipientPhone && <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{order.recipientPhone}</p>}
                            </td>
                            <td className="py-4">
                              <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{order.recipientName || order.senderName || 'Client'}</p>
                            </td>
                            <td className="py-4">
                              {getStatusBadge(order.status)}
                            </td>
                            <td className="py-4 font-bold" style={{ color: 'var(--text-primary)' }}>
                              ₦{parseFloat(order.totalPrice || 0).toLocaleString()}
                            </td>
                            <td className="py-4" style={{ color: 'var(--text-secondary)' }}>
                              {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="py-4 text-right space-x-2">
                              {order.status === 'pending' && (
                                <button
                                  onClick={() => setAssignModalOrder(order)}
                                  className="btn btn-primary btn-sm"
                                >
                                  Assign
                                </button>
                              )}
                              <a
                                href={`/track/${order.ticketId}`}
                                target="_blank"
                                className="btn btn-outline btn-sm"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Track
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: RIDERS ================= */}
          {activeTab === 'riders' && (
            <div className="space-y-6">
              {/* Rider Filters */}
              <div
                className="rounded-2xl p-5 border flex flex-col md:flex-row items-center justify-between gap-4"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div className="relative w-full md:w-96">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    value={riderSearch}
                    onChange={(e) => setRiderSearch(e.target.value)}
                    placeholder="Search rider name, phone, plate..."
                    className="input pl-10 text-xs w-full"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {['all', 'online', 'offline', 'suspended'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setRiderStatusFilter(status)}
                      className={`btn btn-sm capitalize ${riderStatusFilter === status ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rider Fleet Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRiders.length === 0 ? (
                  <div className="col-span-full py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-bold text-base">No riders found</p>
                  </div>
                ) : (
                  filteredRiders.map((rider) => (
                    <div
                      key={rider.id}
                      className="rounded-2xl p-6 border space-y-4 hover:shadow-xl transition-all duration-300"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base text-white shadow-md"
                            style={{
                              background: rider.isOnline
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                            }}
                          >
                            {rider.fullName?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{rider.fullName}</h3>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{rider.email}</p>
                          </div>
                        </div>

                        <span className={`badge ${rider.isOnline ? 'badge-delivered' : 'badge-pending'}`}>
                          {rider.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-secondary)' }}>Vehicle</span>
                          <span className="font-bold capitalize" style={{ color: 'var(--text-primary)' }}>{rider.vehicleType || 'Motorcycle'}</span>
                        </div>
                        <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-secondary)' }}>Plate Number</span>
                          <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{rider.plateNumber || 'N/A'}</span>
                        </div>
                        <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-secondary)' }}>Deliveries</span>
                          <span className="font-bold text-teal-400">{rider.totalDeliveries || 0} completed</span>
                        </div>
                        <div className="p-3 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                          <span className="text-[11px] block" style={{ color: 'var(--text-secondary)' }}>Total Earnings</span>
                          <span className="font-bold text-pink-400">₦{parseFloat(rider.totalAmount || 0).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Contact & Status Actions */}
                      <div className="pt-2 flex items-center gap-2">
                        {rider.phone && (
                          <a
                            href={`tel:${rider.phone}`}
                            className="flex-1 btn btn-outline btn-sm"
                          >
                            <Phone className="w-3.5 h-3.5 text-blue-400" />
                            Call
                          </a>
                        )}

                        <button
                          onClick={() => toggleRiderStatus(rider.id, rider.status)}
                          className={`flex-1 btn btn-sm ${
                            rider.status === 'active' ? 'btn-outline' : 'btn-success'
                          }`}
                        >
                          {rider.status === 'active' ? 'Suspend Rider' : 'Activate Rider'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 4: REPORTS ================= */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div
                className="rounded-2xl p-6 border space-y-4"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Customer Issue Reports</h2>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Feedback and tickets submitted by recipients or senders</p>
                  </div>
                </div>

                {reportsList.length === 0 ? (
                  <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400 opacity-60" />
                    <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>No active customer complaints</p>
                    <p className="text-xs">All packages and deliveries are flowing smoothly.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reportsList.map((rep) => (
                      <div
                        key={rep.id}
                        className="rounded-xl p-5 border space-y-3"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-blue-400">
                            Ticket: {rep.ticketId || rep.orderId || 'General'}
                          </span>
                          <span className={`badge ${rep.status === 'resolved' ? 'badge-delivered' : 'badge-pending'}`}>
                            {rep.status || 'Pending'}
                          </span>
                        </div>

                        <div>
                          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{rep.issueType || 'Issue Report'}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{rep.description || rep.message}</p>
                        </div>

                        <div className="pt-2 border-t flex items-center justify-between text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                          <span>{rep.createdAt ? new Date(rep.createdAt).toLocaleString() : 'Recent'}</span>
                          {rep.ticketId && (
                            <a
                              href={`/track/${rep.ticketId}`}
                              target="_blank"
                              className="text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                            >
                              Inspect Order <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 5: SETTINGS & PRICING ================= */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl space-y-6">
              <div
                className="rounded-2xl p-6 md:p-8 border space-y-6"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div>
                  <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Delivery Pricing Formula</h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Configure the platform rate matrix across Port Harcourt and surrounding Rivers State corridors.
                  </p>
                </div>

                <form onSubmit={handleSavePricing} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Base Fare (₦)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={pricing.baseFare}
                        onChange={(e) => setPricing({ ...pricing, baseFare: e.target.value })}
                        className="input font-mono font-bold text-sm w-full"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Per KM Rate (₦)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={pricing.perKmRate}
                        onChange={(e) => setPricing({ ...pricing, perKmRate: e.target.value })}
                        className="input font-mono font-bold text-sm w-full"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Minimum Fare (₦)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={pricing.minimumFare}
                        onChange={(e) => setPricing({ ...pricing, minimumFare: e.target.value })}
                        className="input font-mono font-bold text-sm w-full"
                        required
                      />
                    </div>
                  </div>

                  {/* Pricing Simulation Preview */}
                  <div
                    className="p-5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                  >
                    <div>
                      <span className="text-xs font-bold block" style={{ color: 'var(--text-secondary)' }}>Live Price Estimation Example (10 km Delivery)</span>
                      <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        Base (₦{pricing.baseFare}) + 10km × ₦{pricing.perKmRate} =
                      </p>
                    </div>
                    <span className="text-2xl font-black text-green-400">
                      ₦{Math.max(parseFloat(pricing.minimumFare || '0'), parseFloat(pricing.baseFare || '0') + (10 * parseFloat(pricing.perKmRate || '0'))).toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={savingPricing}
                    className="btn btn-primary w-full py-3.5 font-bold shadow-lg"
                  >
                    {savingPricing ? 'Updating Pricing Matrix...' : 'Save Pricing Configuration'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= ASSIGN RIDER MODAL ================= */}
      {assignModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setAssignModalOrder(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 border space-y-5"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Assign Order Dispatch</h3>
                <p className="text-xs text-blue-400 font-mono font-bold">Ticket #{assignModalOrder.ticketId}</p>
              </div>
              <button onClick={() => setAssignModalOrder(null)} className="p-1 rounded-lg" style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border text-xs space-y-1.5" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>📍 From: {assignModalOrder.pickupAddress}</p>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>🎯 To: {assignModalOrder.dropoffAddress}</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Select Available Dispatch Rider</label>
                <select
                  value={selectedRiderId}
                  onChange={(e) => setSelectedRiderId(e.target.value)}
                  className="input w-full text-xs font-bold"
                >
                  <option value="">-- Choose Rider --</option>
                  {riders
                    .filter((r) => r.status === 'active')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.fullName} ({r.isOnline ? '🟢 Online' : '⚪ Offline'}) - {r.vehicleType || 'Bike'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setAssignModalOrder(null)} className="flex-1 btn btn-outline">
                  Cancel
                </button>
                <button onClick={assignRiderToOrder} disabled={assignLoading || !selectedRiderId} className="flex-1 btn btn-primary">
                  {assignLoading ? 'Dispatching...' : 'Confirm Dispatch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= INVITE USER MODAL ================= */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 border space-y-5"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Invite New User</h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Generate secure onboarding link</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="p-1 rounded-lg" style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="input w-full text-xs"
                  placeholder="name@company.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Role Authority</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="input w-full text-xs font-bold"
                >
                  <option value="rider">Dispatch Rider</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowInviteModal(false)} className="flex-1 btn btn-outline">
                  Cancel
                </button>
                <button onClick={sendInvite} disabled={inviteLoading} className="flex-1 btn btn-primary">
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
