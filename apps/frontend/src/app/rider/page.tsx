'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { initSocket } from '@/lib/socket';
import { Power, DollarSign, Package, CheckCircle, MapPin, Phone, Navigation, Zap, TrendingUp, Mail, MessageSquare, Activity, AlertCircle } from 'lucide-react';

export default function RiderDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>({
    isOnline: false,
    isBusy: false,
    todayDeliveries: 0,
    todayEarnings: '0.00',
    totalDeliveries: 0,
    totalAmount: '0.00',
  });
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
    try {
      const { data } = await api.get('/rider/dashboard');
      if (data) {
        setStats({
          isOnline: data.isOnline ?? false,
          isBusy: data.isBusy ?? false,
          todayDeliveries: data.todayDeliveries ?? 0,
          todayEarnings: data.todayEarnings ?? '0.00',
          totalDeliveries: data.totalDeliveries ?? 0,
          totalAmount: data.totalAmount ?? '0.00',
        });
        setCurrentJob(data.currentJob || null);
        setErrorMessage('');
      }
    } catch (error: any) {
      console.error('Failed to load dashboard', error);
      setErrorMessage(error?.response?.data?.error || 'Failed to load dashboard data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const toggleOnline = async () => {
    setToggling(true);
    try {
      const { data } = await api.post('/rider/toggle-online');
      setStats((prev: any) => ({ ...prev, isOnline: data.isOnline }));
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
      loadDashboard();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to accept job');
    }
  };

  const markPickedUp = async (orderId: string) => {
    const estimatedTime = prompt('Estimated delivery time (minutes)');
    if (!estimatedTime) return;

    try {
      const estimatedDeliveryTime = new Date(Date.now() + parseInt(estimatedTime) * 60 * 1000).toISOString();
      await api.post(`/rider/pickup/${orderId}`, { estimatedDeliveryTime });
      loadDashboard();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to mark as picked up');
    }
  };

  const markDelivered = async (orderId: string) => {
    const notes = prompt('Delivery notes (optional)');
    
    try {
      await api.post(`/rider/deliver/${orderId}`, { notes });
      loadDashboard();
      alert('✅ Order marked as delivered!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to mark as delivered');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <Navbar />

      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header with Status */}
          <div 
            className="rounded-2xl p-6 md:p-8"
            style={{
              background: stats.isOnline 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
              boxShadow: stats.isOnline 
                ? '0 10px 40px rgba(16, 185, 129, 0.3)'
                : '0 10px 40px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-bold text-white">Rider Dashboard</h1>
                  {stats.isOnline && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-white bg-opacity-20 rounded-full">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="text-sm font-semibold text-white">Live</span>
                    </div>
                  )}
                </div>
                <p className="text-white text-opacity-90">
                  {stats.isOnline 
                    ? (stats.isBusy ? '🚚 Currently on delivery' : '✨ Ready for deliveries') 
                    : '💤 You are offline'}
                </p>
              </div>
              <button
                onClick={toggleOnline}
                disabled={toggling}
                className="flex items-center gap-3 px-6 py-3 bg-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                style={{ color: stats.isOnline ? '#10b981' : '#6b7280' }}
              >
                <Power className="w-5 h-5" />
                {toggling ? 'Updating...' : stats.isOnline ? 'Go Offline' : 'Go Online'}
              </button>
            </div>

            {stats.isOnline && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-sm text-white text-opacity-70 mb-1">Status</p>
                  <p className="text-xl font-bold text-white">
                    {stats.isBusy ? 'Busy' : 'Available'}
                  </p>
                </div>
                <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-sm text-white text-opacity-70 mb-1">Today</p>
                  <p className="text-xl font-bold text-white">
                    {stats.todayDeliveries} orders
                  </p>
                </div>
                <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-sm text-white text-opacity-70 mb-1">Earnings</p>
                  <p className="text-xl font-bold text-white">
                    ₦{parseFloat(stats.todayEarnings).toLocaleString()}
                  </p>
                </div>
                <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-sm text-white text-opacity-70 mb-1">Total</p>
                  <p className="text-xl font-bold text-white">
                    {stats.totalDeliveries} deliveries
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <div 
              className="rounded-2xl p-6 relative overflow-hidden group hover:shadow-2xl transition-all duration-300"
              style={{ background: 'var(--bg-card)' }}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(0, 102, 255, 0.1)' }}
                  >
                    <Package className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                  </div>
                  <Activity className="w-5 h-5" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Today's Deliveries</p>
                <p className="text-4xl font-bold" style={{ color: 'var(--primary)' }}>
                  {stats.todayDeliveries}
                </p>
              </div>
              <div 
                className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full opacity-5 group-hover:scale-110 transition-transform duration-500"
                style={{ background: 'var(--primary)' }}
              ></div>
            </div>

            <div 
              className="rounded-2xl p-6 relative overflow-hidden group hover:shadow-2xl transition-all duration-300"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white bg-opacity-20">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-white opacity-50" />
                </div>
                <p className="text-sm font-medium mb-1 text-green-100">Today's Earnings</p>
                <p className="text-4xl font-bold text-white">
                  ₦{parseFloat(stats.todayEarnings).toLocaleString()}
                </p>
              </div>
            </div>

            <div 
              className="rounded-2xl p-6 relative overflow-hidden group hover:shadow-2xl transition-all duration-300"
              style={{ background: 'var(--bg-card)' }}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(255, 51, 102, 0.1)' }}
                  >
                    <CheckCircle className="w-6 h-6" style={{ color: 'var(--accent)' }} />
                  </div>
                  <Zap className="w-5 h-5" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total Deliveries</p>
                <p className="text-4xl font-bold" style={{ color: 'var(--accent)' }}>
                  {stats.totalDeliveries}
                </p>
              </div>
              <div 
                className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full opacity-5 group-hover:scale-110 transition-transform duration-500"
                style={{ background: 'var(--accent)' }}
              ></div>
            </div>
          </div>

          {/* Current Job */}
          {currentJob ? (
            <div 
              className="rounded-2xl p-6 md:p-8"
              style={{ background: 'var(--bg-card)' }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Active Delivery
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Complete this order to earn</p>
                </div>
                <span className={`badge badge-${currentJob.status} text-base px-4 py-2`}>
                  {currentJob.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div 
                    className="p-5 rounded-xl"
                    style={{ background: 'var(--bg-secondary)' }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--primary)', opacity: 0.1 }}
                      >
                        <Package className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                      </div>
                      <div>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Ticket ID</p>
                        <p className="font-mono text-lg font-bold" style={{ color: 'var(--primary)' }}>
                          {currentJob.ticketId}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div 
                    className="p-5 rounded-xl"
                    style={{ background: 'var(--bg-secondary)' }}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center mt-1"
                        style={{ background: 'rgba(0, 102, 255, 0.1)' }}
                      >
                        <MapPin className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>PICKUP</p>
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {currentJob.pickupAddress}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pl-11">
                      <div className="w-px h-6 bg-gradient-to-b from-blue-500 to-pink-500"></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center mt-1"
                        style={{ background: 'rgba(255, 51, 102, 0.1)' }}
                      >
                        <MapPin className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>DROPOFF</p>
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {currentJob.dropoffAddress}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div 
                      className="p-4 rounded-xl"
                      style={{ background: 'var(--bg-secondary)' }}
                    >
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Distance</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                          {currentJob.distanceKm}
                        </p>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>km</span>
                      </div>
                    </div>
                    <div 
                      className="p-4 rounded-xl"
                      style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                    >
                      <p className="text-xs font-medium mb-2 text-green-100">Earnings</p>
                      <p className="text-2xl font-bold text-white">
                        ₦{parseFloat(currentJob.totalPrice).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {currentJob.description && (
                    <div 
                      className="p-5 rounded-xl"
                      style={{ background: 'var(--bg-secondary)' }}
                    >
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>PACKAGE</p>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{currentJob.description}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div 
                    className="p-5 rounded-xl border"
                    style={{ 
                      background: 'var(--bg-secondary)',
                      borderColor: 'var(--border-color)',
                      borderWidth: '1px'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                        style={{ background: 'rgba(0, 102, 255, 0.1)', color: 'var(--primary)' }}
                      >
                        {currentJob.senderName?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>SENDER</p>
                        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{currentJob.senderName}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <a 
                        href={`tel:${currentJob.senderPhone}`}
                        className="flex items-center gap-2 p-3 rounded-lg hover:shadow-md transition-all"
                        style={{ background: 'var(--bg-primary)', color: 'var(--primary)' }}
                      >
                        <Phone className="w-4 h-4" />
                        <span className="font-semibold text-sm">{currentJob.senderPhone}</span>
                      </a>
                      {currentJob.senderWhatsapp && (
                        <a 
                          href={`https://wa.me/${currentJob.senderWhatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          className="flex items-center gap-2 p-3 rounded-lg hover:shadow-md transition-all"
                          style={{ background: 'var(--bg-primary)', color: '#25D366' }}
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span className="font-semibold text-sm">WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div 
                    className="p-5 rounded-xl border"
                    style={{ 
                      background: 'var(--bg-secondary)',
                      borderColor: 'var(--border-color)',
                      borderWidth: '1px'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                        style={{ background: 'rgba(255, 51, 102, 0.1)', color: 'var(--accent)' }}
                      >
                        {currentJob.recipientName?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>RECIPIENT</p>
                        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{currentJob.recipientName}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <a 
                        href={`tel:${currentJob.recipientPhone}`}
                        className="flex items-center gap-2 p-3 rounded-lg hover:shadow-md transition-all"
                        style={{ background: 'var(--bg-primary)', color: 'var(--primary)' }}
                      >
                        <Phone className="w-4 h-4" />
                        <span className="font-semibold text-sm">{currentJob.recipientPhone}</span>
                      </a>
                      {currentJob.recipientWhatsapp && (
                        <a 
                          href={`https://wa.me/${currentJob.recipientWhatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          className="flex items-center gap-2 p-3 rounded-lg hover:shadow-md transition-all"
                          style={{ background: 'var(--bg-primary)', color: '#25D366' }}
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span className="font-semibold text-sm">WhatsApp</span>
                        </a>
                      )}
                      {currentJob.recipientEmail && (
                        <a 
                          href={`mailto:${currentJob.recipientEmail}`}
                          className="flex items-center gap-2 p-3 rounded-lg hover:shadow-md transition-all"
                          style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
                        >
                          <Mail className="w-4 h-4" />
                          <span className="font-semibold text-sm text-xs truncate">{currentJob.recipientEmail}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {currentJob.notes && (
                    <div 
                      className="p-5 rounded-xl"
                      style={{ background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.3)' }}
                    >
                      <p className="text-xs font-semibold mb-2" style={{ color: '#f59e0b' }}>⚠️ NOTES</p>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{currentJob.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {currentJob.status === 'assigned' && (
                  <button 
                    onClick={() => acceptJob(currentJob.id)} 
                    className="flex-1 btn btn-primary py-4 text-lg font-bold"
                  >
                    Accept Delivery
                  </button>
                )}
                {currentJob.status === 'accepted' && (
                  <button 
                    onClick={() => markPickedUp(currentJob.id)} 
                    className="flex-1 py-4 text-lg font-bold rounded-xl text-white transition-all hover:shadow-xl"
                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                  >
                    Mark as Picked Up
                  </button>
                )}
                {currentJob.status === 'picked_up' && (
                  <button 
                    onClick={() => markDelivered(currentJob.id)} 
                    className="flex-1 btn btn-accent py-4 text-lg font-bold"
                  >
                    Complete Delivery
                  </button>
                )}
                <a 
                  href={`/track/${currentJob.ticketId}`} 
                  target="_blank" 
                  className="btn btn-outline py-4 flex items-center justify-center gap-2"
                >
                  <Navigation className="w-5 h-5" />
                  Track
                </a>
              </div>
            </div>
          ) : (
            <div 
              className="rounded-2xl p-12 text-center"
              style={{ background: 'var(--bg-card)' }}
            >
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <Package className="w-12 h-12" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
              </div>
              <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                No Active Orders
              </h3>
              <p className="text-lg mb-6" style={{ color: 'var(--text-secondary)' }}>
                {stats.isOnline 
                  ? '🔄 Waiting for new delivery requests...' 
                  : '💤 Go online to start receiving orders'}
              </p>
              {!stats.isOnline && (
                <button
                  onClick={toggleOnline}
                  disabled={toggling}
                  className="btn btn-primary btn-lg"
                >
                  <Power className="w-5 h-5 mr-2" />
                  Go Online Now
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
