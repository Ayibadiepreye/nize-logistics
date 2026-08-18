'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { initSocket } from '@/lib/socket';
import {
  Package, DollarSign, CheckCircle, MapPin, Phone, Navigation, Zap,
  TrendingUp, Mail, MessageSquare, Activity, Power, Clock, ChevronRight,
  Menu, X, ExternalLink, LogOut, RefreshCw, AlertCircle, Search, Truck,
  Compass, ShieldCheck, Check, Calendar, ArrowRight
} from 'lucide-react';

type TabType = 'active' | 'performance' | 'history';

export default function RiderDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [stats, setStats] = useState<any>({
    isOnline: false,
    isBusy: false,
    todayDeliveries: 0,
    todayEarnings: '0.00',
    totalDeliveries: 0,
    totalAmount: '0.00',
  });
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const currentJobRef = useRef<any>(null);
  const statsRef = useRef<any>(null);

  useEffect(() => {
    currentJobRef.current = currentJob;
  }, [currentJob]);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/login');
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (user?.role !== 'rider') {
        router.push('/login');
        return;
      }
      setCurrentUser(user);
    } catch {
      router.push('/login');
      return;
    }

    loadDashboard();

    const token = localStorage.getItem('token');
    let socket: any = null;
    let locationInterval: any = null;

    if (token) {
      socket = initSocket(token);

      const handleNewJob = () => {
        loadDashboard();
      };

      const handleStatusUpdate = () => {
        loadDashboard();
      };

      socket.on('rider:new-job', handleNewJob);
      socket.on('order:status-update', handleStatusUpdate);

      // Broadcast GPS location periodically when online
      locationInterval = setInterval(() => {
        if (statsRef.current?.isOnline && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              socket.emit('rider:location', {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                orderId: currentJobRef.current?.id,
              });
            },
            (error) => console.error('Location error:', error)
          );
        }
      }, 10000);

      return () => {
        if (socket) {
          socket.off('rider:new-job', handleNewJob);
          socket.off('order:status-update', handleStatusUpdate);
        }
        if (locationInterval) {
          clearInterval(locationInterval);
        }
      };
    }
  }, []);

  const loadDashboard = async () => {
    setRefreshing(true);
    try {
      const [dashRes, historyRes] = await Promise.all([
        api.get('/rider/dashboard').catch(() => ({ data: null })),
        api.get('/rider/history?limit=50').catch(() => ({ data: { orders: [] } })),
      ]);

      if (dashRes?.data) {
        setStats({
          isOnline: dashRes.data.isOnline ?? false,
          isBusy: dashRes.data.isBusy ?? false,
          todayDeliveries: dashRes.data.todayDeliveries ?? 0,
          todayEarnings: dashRes.data.todayEarnings ?? '0.00',
          totalDeliveries: dashRes.data.totalDeliveries ?? 0,
          totalAmount: dashRes.data.totalAmount ?? '0.00',
        });
        setCurrentJob(dashRes.data.currentJob || null);
      }

      setHistory(historyRes?.data?.orders || []);
      setErrorMessage('');
    } catch (error: any) {
      console.error('Failed to load rider dashboard', error);
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

  const toggleOnline = async () => {
    setToggling(true);
    try {
      const { data } = await api.post('/rider/toggle-online');
      setStats((prev: any) => ({ ...prev, isOnline: data.isOnline }));
      setSuccessMessage(data.isOnline ? 'You are now ONLINE and ready for jobs!' : 'You are now OFFLINE.');
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (error: any) {
      console.error('Failed to toggle status', error);
      alert(error.response?.data?.error || 'Failed to toggle online status');
    } finally {
      setToggling(false);
    }
  };

  const acceptJob = async (orderId: string) => {
    try {
      await api.post(`/rider/accept/${orderId}`);
      setSuccessMessage('Delivery accepted! Proceed to pickup location.');
      setTimeout(() => setSuccessMessage(''), 4000);
      loadDashboard();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to accept job');
    }
  };

  const markPickedUp = async (orderId: string) => {
    const estimatedTime = prompt('Estimated delivery duration in minutes (e.g. 25):', '25');
    if (estimatedTime === null) return;

    try {
      const minutes = parseInt(estimatedTime) || 30;
      const estimatedDeliveryTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      await api.post(`/rider/pickup/${orderId}`, { estimatedDeliveryTime });
      setSuccessMessage('Package picked up! Safe transit to recipient.');
      setTimeout(() => setSuccessMessage(''), 4000);
      loadDashboard();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to mark as picked up');
    }
  };

  const markDelivered = async (orderId: string) => {
    const notes = prompt('Delivery confirmation notes or recipient name (optional):');
    if (notes === null) return;

    try {
      await api.post(`/rider/deliver/${orderId}`, { notes });
      alert('🎉 Awesome job! Order successfully delivered.');
      loadDashboard();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to mark as delivered');
    }
  };

  const openNavigation = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  };

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const search = historySearch.toLowerCase();
      return (
        !historySearch ||
        item.ticketId?.toLowerCase().includes(search) ||
        item.pickupAddress?.toLowerCase().includes(search) ||
        item.dropoffAddress?.toLowerCase().includes(search) ||
        item.recipientName?.toLowerCase().includes(search)
      );
    });
  }, [history, historySearch]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center space-y-4">
          <div className="spinner mx-auto" style={{ width: '48px', height: '48px' }}></div>
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Loading Nize Rider Portal...</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Connecting to dispatch network</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black/60 backdrop-blur-sm transition-opacity"
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
        <div>
          {/* Header & Branding */}
          <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3 group">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <Navigation className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xl tracking-tight" style={{ color: 'var(--primary)' }}>Nize</span>
                    <span className="font-bold text-xl tracking-tight" style={{ color: '#10b981' }}>Rider</span>
                  </div>
                  <span className="text-xs font-semibold tracking-wider uppercase opacity-80" style={{ color: 'var(--text-secondary)' }}>
                    Dispatch Portal
                  </span>
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rider Profile Card & Live Toggle */}
            <div
              className="mt-5 p-3.5 rounded-xl border space-y-3"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white"
                  style={{
                    background: stats.isOnline
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                  }}
                >
                  {currentUser?.fullName?.charAt(0).toUpperCase() || 'R'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                    {currentUser?.fullName || 'Dispatch Rider'}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-400 capitalize">
                    {currentUser?.vehicleType || 'Motorcycle'} • {currentUser?.plateNumber || 'Rider'}
                  </p>
                </div>
              </div>

              {/* Status Switcher Button */}
              <button
                onClick={toggleOnline}
                disabled={toggling}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all shadow-md"
                style={{
                  background: stats.isOnline
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'rgba(100, 116, 139, 0.2)',
                  color: stats.isOnline ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                <Power className="w-3.5 h-3.5" />
                {toggling ? 'Updating...' : stats.isOnline ? 'ONLINE (Accepting Jobs)' : 'OFFLINE (Tap to Go Online)'}
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => { setActiveTab('active'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                activeTab === 'active'
                  ? 'text-white shadow-lg'
                  : 'hover:bg-slate-500/10 text-slate-400 hover:text-slate-200'
              }`}
              style={{
                background: activeTab === 'active' ? '#10b981' : undefined,
                color: activeTab === 'active' ? '#ffffff' : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5" />
                <span>Active Delivery</span>
              </div>
              {currentJob && (
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('performance'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                activeTab === 'performance'
                  ? 'text-white shadow-lg'
                  : 'hover:bg-slate-500/10 text-slate-400 hover:text-slate-200'
              }`}
              style={{
                background: activeTab === 'performance' ? '#10b981' : undefined,
                color: activeTab === 'performance' ? '#ffffff' : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5" />
                <span>Performance & Pay</span>
              </div>
              <span className="text-xs font-bold">₦{parseFloat(stats.todayEarnings || 0).toLocaleString()}</span>
            </button>

            <button
              onClick={() => { setActiveTab('history'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                activeTab === 'history'
                  ? 'text-white shadow-lg'
                  : 'hover:bg-slate-500/10 text-slate-400 hover:text-slate-200'
              }`}
              style={{
                background: activeTab === 'history' ? '#10b981' : undefined,
                color: activeTab === 'history' ? '#ffffff' : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5" />
                <span>Delivery History</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 font-bold">
                {stats.totalDeliveries || history.length}
              </span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t space-y-2" style={{ borderColor: 'var(--border-color)' }}>
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-500/10 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Public Site</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all"
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
              className="lg:hidden p-2 rounded-xl border text-slate-300 hover:bg-slate-500/10"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black capitalize tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {activeTab === 'active' && 'Active Delivery Job'}
                {activeTab === 'performance' && 'Earnings & Performance'}
                {activeTab === 'history' && 'Completed Deliveries'}
              </h1>
              <p className="text-xs hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                Nize Dispatch Network • Port Harcourt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* GPS Broadcast Status */}
            <div
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                stats.isOnline
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${stats.isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
              <span>{stats.isOnline ? 'GPS Live' : 'GPS Offline'}</span>
            </div>

            {/* Refresh */}
            <button
              onClick={loadDashboard}
              disabled={refreshing}
              className="p-2.5 rounded-xl border hover:bg-slate-500/10 transition-all disabled:opacity-50"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              title="Refresh Rider Dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Quick Status Toggle */}
            <button
              onClick={toggleOnline}
              disabled={toggling}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white shadow-lg hover:shadow-xl transition-all"
              style={{
                background: stats.isOnline
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
              }}
            >
              <Power className="w-4 h-4" />
              <span>{stats.isOnline ? 'Go Offline' : 'Go Online'}</span>
            </button>
          </div>
        </header>

        {/* Notifications */}
        <div className="p-4 md:p-8 space-y-6">
          {errorMessage && (
            <div className="p-4 rounded-xl flex items-center gap-3 border bg-red-500/10 border-red-500/30 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-xl flex items-center gap-3 border bg-green-500/10 border-green-500/30 text-green-400">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{successMessage}</p>
            </div>
          )}

          {/* ================= TAB 1: ACTIVE DELIVERY ================= */}
          {activeTab === 'active' && (
            <div className="space-y-6">
              {currentJob ? (
                <div className="space-y-6 max-w-4xl">
                  {/* Hero Delivery Banner */}
                  <div
                    className="rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-2xl"
                    style={{
                      background: 'linear-gradient(135deg, #0066ff 0%, #00d9ff 100%)',
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
                            Active Dispatch Order
                          </span>
                          <span className="text-xs font-mono font-bold bg-black/20 px-3 py-1 rounded-full">
                            Ticket #{currentJob.ticketId}
                          </span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black mt-2">
                          {currentJob.status === 'assigned' && 'New Job Assigned to You'}
                          {currentJob.status === 'accepted' && 'En Route to Pickup'}
                          {currentJob.status === 'picked_up' && 'Package In Transit to Recipient'}
                        </h2>
                      </div>

                      <div className="text-right sm:border-l sm:pl-6 border-white/20">
                        <span className="text-xs font-bold text-blue-100 uppercase block">Payout Earned</span>
                        <span className="text-3xl md:text-4xl font-black">
                          ₦{parseFloat(currentJob.totalPrice || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Stepper */}
                  <div
                    className="rounded-2xl p-6 border"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                  >
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className={`p-3 rounded-xl border ${currentJob.status ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-bold' : 'text-slate-500'}`}>
                        <span className="block text-base mb-1">1</span>
                        <span>Job Assigned</span>
                      </div>
                      <div className={`p-3 rounded-xl border ${['accepted', 'picked_up', 'delivered'].includes(currentJob.status) ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-bold' : 'text-slate-500'}`}>
                        <span className="block text-base mb-1">2</span>
                        <span>Picked Up</span>
                      </div>
                      <div className={`p-3 rounded-xl border ${currentJob.status === 'delivered' ? 'bg-green-500/10 border-green-500/30 text-green-400 font-bold' : 'text-slate-500'}`}>
                        <span className="block text-base mb-1">3</span>
                        <span>Delivered</span>
                      </div>
                    </div>
                  </div>

                  {/* Route & Contact Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Route Details Card */}
                    <div
                      className="rounded-2xl p-6 border space-y-5"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    >
                      <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-400" />
                        <span>Route Directions</span>
                      </h3>

                      <div className="space-y-4">
                        {/* Pickup Point */}
                        <div className="p-4 rounded-xl border bg-slate-500/5 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase text-green-400">📍 Pickup Location</span>
                            <button
                              onClick={() => openNavigation(currentJob.pickupAddress)}
                              className="text-[11px] font-bold text-blue-400 hover:underline flex items-center gap-1"
                            >
                              Maps Navigation <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-xs font-semibold text-slate-200">{currentJob.pickupAddress}</p>
                        </div>

                        {/* Dropoff Point */}
                        <div className="p-4 rounded-xl border bg-slate-500/5 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase text-pink-400">🎯 Destination Dropoff</span>
                            <button
                              onClick={() => openNavigation(currentJob.dropoffAddress)}
                              className="text-[11px] font-bold text-blue-400 hover:underline flex items-center gap-1"
                            >
                              Maps Navigation <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-xs font-semibold text-slate-200">{currentJob.dropoffAddress}</p>
                        </div>
                      </div>

                      {/* Package Description / Instructions */}
                      {currentJob.description && (
                        <div className="p-4 rounded-xl border bg-amber-500/5 border-amber-500/20 text-xs">
                          <span className="font-bold text-amber-400 block mb-1">📦 Package Content / Notes</span>
                          <p className="text-slate-300">{currentJob.description}</p>
                          {currentJob.notes && <p className="text-slate-400 mt-1">Special note: {currentJob.notes}</p>}
                        </div>
                      )}
                    </div>

                    {/* Contacts & Direct Action Calls */}
                    <div
                      className="rounded-2xl p-6 border space-y-5 flex flex-col justify-between"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    >
                      <div className="space-y-4">
                        <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-green-400" />
                          <span>Direct Client Contacts</span>
                        </h3>

                        {/* Sender Contact Card */}
                        <div className="p-4 rounded-xl border bg-slate-500/5 space-y-3" style={{ borderColor: 'var(--border-color)' }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[11px] font-bold uppercase text-slate-400">Sender / Merchant</span>
                              <p className="text-xs font-bold text-slate-200">{currentJob.senderName || 'Sender'}</p>
                            </div>
                            <span className="text-xs font-mono text-slate-300">{currentJob.senderPhone}</span>
                          </div>

                          <div className="flex gap-2">
                            {currentJob.senderPhone && (
                              <a
                                href={`tel:${currentJob.senderPhone}`}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                              >
                                <Phone className="w-3.5 h-3.5" /> Call Sender
                              </a>
                            )}
                            {currentJob.senderWhatsapp && (
                              <a
                                href={`https://wa.me/${currentJob.senderWhatsapp.replace(/\D/g, '')}`}
                                target="_blank"
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-green-500/20 text-green-400 hover:bg-green-500/30"
                              >
                                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Recipient Contact Card */}
                        <div className="p-4 rounded-xl border bg-slate-500/5 space-y-3" style={{ borderColor: 'var(--border-color)' }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[11px] font-bold uppercase text-slate-400">Recipient Customer</span>
                              <p className="text-xs font-bold text-slate-200">{currentJob.recipientName || 'Recipient'}</p>
                            </div>
                            <span className="text-xs font-mono text-slate-300">{currentJob.recipientPhone}</span>
                          </div>

                          <div className="flex gap-2">
                            {currentJob.recipientPhone && (
                              <a
                                href={`tel:${currentJob.recipientPhone}`}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                              >
                                <Phone className="w-3.5 h-3.5" /> Call Recipient
                              </a>
                            )}
                            {currentJob.recipientWhatsapp && (
                              <a
                                href={`https://wa.me/${currentJob.recipientWhatsapp.replace(/\D/g, '')}`}
                                target="_blank"
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-green-500/20 text-green-400 hover:bg-green-500/30"
                              >
                                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Primary Execution Buttons */}
                      <div className="space-y-2 pt-4">
                        {currentJob.status === 'assigned' && (
                          <button
                            onClick={() => acceptJob(currentJob.id)}
                            className="w-full btn btn-primary py-4 text-base font-bold shadow-lg shadow-blue-500/20"
                          >
                            Accept Delivery Assignment
                          </button>
                        )}

                        {currentJob.status === 'accepted' && (
                          <button
                            onClick={() => markPickedUp(currentJob.id)}
                            className="w-full py-4 text-base font-bold text-white rounded-xl shadow-lg transition-all"
                            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                          >
                            Mark Package as Picked Up
                          </button>
                        )}

                        {currentJob.status === 'picked_up' && (
                          <button
                            onClick={() => markDelivered(currentJob.id)}
                            className="w-full py-4 text-base font-bold text-white rounded-xl shadow-lg transition-all"
                            style={{ background: 'linear-gradient(135deg, #ff3366 0%, #ff1a4d 100%)' }}
                          >
                            Complete & Confirm Delivery
                          </button>
                        )}

                        <a
                          href={`/track/${currentJob.ticketId}`}
                          target="_blank"
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold border text-slate-300 hover:text-white"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          <Navigation className="w-4 h-4" /> Live Tracking Link
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Idle Radar Screen */
                <div
                  className="rounded-3xl p-12 text-center border space-y-6 max-w-2xl mx-auto"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                    <div
                      className={`absolute inset-0 rounded-full ${
                        stats.isOnline ? 'bg-green-500/20 animate-ping' : 'bg-slate-500/10'
                      }`}
                    ></div>
                    <div
                      className="w-24 h-24 rounded-full flex items-center justify-center shadow-inner relative z-10"
                      style={{
                        background: stats.isOnline
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                      }}
                    >
                      <Truck className="w-10 h-10 text-white" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                      {stats.isOnline ? 'Stand By for Orders' : 'You are Offline'}
                    </h2>
                    <p className="text-xs md:text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                      {stats.isOnline
                        ? 'Your GPS coordinates are live. New delivery tickets across Port Harcourt will appear automatically.'
                        : 'Switch to Online status whenever you are available on your bike to start receiving delivery requests.'}
                    </p>
                  </div>

                  {!stats.isOnline && (
                    <button
                      onClick={toggleOnline}
                      disabled={toggling}
                      className="btn btn-primary px-8 py-3.5 text-sm font-bold shadow-lg"
                    >
                      <Power className="w-4 h-4 mr-2" />
                      Go Online Now
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: PERFORMANCE & EARNINGS ================= */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              {/* 4 Performance Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  className="rounded-2xl p-6 border space-y-2"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <span className="text-xs font-bold uppercase text-slate-400">Today's Earnings</span>
                  <p className="text-3xl font-black text-green-400">
                    ₦{parseFloat(stats.todayEarnings || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">{stats.todayDeliveries || 0} trips today</p>
                </div>

                <div
                  className="rounded-2xl p-6 border space-y-2"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <span className="text-xs font-bold uppercase text-slate-400">Today's Deliveries</span>
                  <p className="text-3xl font-black text-blue-400">
                    {stats.todayDeliveries || 0}
                  </p>
                  <p className="text-xs text-slate-400">Completed jobs</p>
                </div>

                <div
                  className="rounded-2xl p-6 border space-y-2"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <span className="text-xs font-bold uppercase text-slate-400">Total Career Deliveries</span>
                  <p className="text-3xl font-black text-purple-400">
                    {stats.totalDeliveries || 0}
                  </p>
                  <p className="text-xs text-slate-400">Lifetime total</p>
                </div>

                <div
                  className="rounded-2xl p-6 border space-y-2"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <span className="text-xs font-bold uppercase text-slate-400">All-Time Revenue</span>
                  <p className="text-3xl font-black text-pink-400">
                    ₦{parseFloat(stats.totalAmount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">Total dispatched</p>
                </div>
              </div>

              {/* Rider Perks & Tips */}
              <div
                className="rounded-2xl p-6 border space-y-3"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                  <span>Rider Best Practices & Bonus Milestones</span>
                </h3>
                <ul className="text-xs space-y-2 text-slate-400 list-disc list-inside">
                  <li>Keep GPS location enabled when Online to prioritize nearby pickup dispatches.</li>
                  <li>Confirm package contents and recipient phone number before starting transit.</li>
                  <li>Contact recipient via WhatsApp or Call 5 minutes prior to dropoff.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ================= TAB 3: HISTORY ================= */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div
                className="rounded-2xl p-5 border flex items-center justify-between gap-4"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div className="relative w-full max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search past trips by ticket, route, client..."
                    className="input pl-10 text-xs w-full"
                  />
                </div>
                <span className="text-xs font-bold text-slate-400">{filteredHistory.length} trips</span>
              </div>

              <div
                className="rounded-2xl p-6 border space-y-4"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b text-xs font-bold uppercase text-slate-400" style={{ borderColor: 'var(--border-color)' }}>
                        <th className="pb-3">Ticket</th>
                        <th className="pb-3">Pickup Address</th>
                        <th className="pb-3">Dropoff Address</th>
                        <th className="pb-3">Recipient</th>
                        <th className="pb-3">Payout</th>
                        <th className="pb-3">Date</th>
                        <th className="pb-3 text-right">Track</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs" style={{ borderColor: 'var(--border-color)' }}>
                      {filteredHistory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="font-semibold text-xs">No delivery history recorded yet</p>
                          </td>
                        </tr>
                      ) : (
                        filteredHistory.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-500/5 transition-colors">
                            <td className="py-4 font-mono font-bold text-blue-400">{item.ticketId}</td>
                            <td className="py-4 max-w-[180px] font-semibold text-slate-200 truncate">{item.pickupAddress}</td>
                            <td className="py-4 max-w-[180px] font-semibold text-slate-200 truncate">{item.dropoffAddress}</td>
                            <td className="py-4 text-slate-300">{item.recipientName || 'Recipient'}</td>
                            <td className="py-4 font-bold text-green-400">₦{parseFloat(item.totalPrice || 0).toLocaleString()}</td>
                            <td className="py-4 text-slate-400">
                              {item.deliveredAt
                                ? new Date(item.deliveredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : item.createdAt
                                ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : 'Recent'}
                            </td>
                            <td className="py-4 text-right">
                              <a
                                href={`/track/${item.ticketId}`}
                                target="_blank"
                                className="px-3 py-1 rounded-lg border text-[11px] font-bold text-slate-300 hover:text-white"
                                style={{ borderColor: 'var(--border-color)' }}
                              >
                                View
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
        </div>
      </div>
    </div>
  );
}
