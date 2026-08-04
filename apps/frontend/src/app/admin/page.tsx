'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { Package, Users, DollarSign, TrendingUp, UserPlus, Mail, Activity, Clock, CheckCircle, XCircle, AlertCircle, ArrowRight, BarChart3, Eye } from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('rider');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/login');
      return;
    }

    const userData = JSON.parse(user);
    if (userData.role !== 'admin' && userData.role !== 'super_admin') {
      router.push('/');
      return;
    }

    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [dashData, ordersData, ridersData] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/orders?limit=10'),
        api.get('/admin/riders'),
      ]);

      setStats(dashData.data);
      setOrders(ordersData.data.orders);
      setRiders(ridersData.data.riders);
    } catch (error) {
      console.error('Failed to load dashboard', error);
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail) {
      alert('Please enter an email');
      return;
    }

    try {
      const { data } = await api.post('/admin/invite', {
        email: inviteEmail,
        role: inviteRole,
      });

      alert(`✅ Invite sent! Signup link: ${data.signupLink}`);
      setInviteEmail('');
      setShowInviteModal(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to send invite');
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
      alert(error.response?.data?.error || 'Failed to update status');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      case 'in_transit':
      case 'picked_up':
        return <Activity className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
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
          {/* Header with Gradient Background */}
          <div 
            className="rounded-2xl p-6 md:p-8"
            style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
              boxShadow: '0 10px 40px rgba(0, 102, 255, 0.2)'
            }}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
                <p className="text-blue-100">Real-time platform overview and management</p>
              </div>
              <button 
                onClick={() => setShowInviteModal(true)} 
                className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                style={{ color: 'var(--primary)' }}
              >
                <UserPlus className="w-5 h-5" />
                Invite User
              </button>
            </div>
          </div>

          {/* Invite Modal */}
          {showInviteModal && (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0, 0, 0, 0.7)' }}
              onClick={() => setShowInviteModal(false)}
            >
              <div 
                className="w-full max-w-md rounded-2xl p-6"
                style={{ background: 'var(--bg-card)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--primary)', opacity: 0.1 }}
                  >
                    <Mail className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Send Invite</h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Invite a new admin or rider</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="input"
                      placeholder="user@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="input"
                    >
                      <option value="rider">Rider</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setShowInviteModal(false)}
                      className="flex-1 btn btn-outline"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={sendInvite}
                      className="flex-1 btn btn-primary"
                    >
                      Send Invite
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid with Modern Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Total Orders Card */}
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
                  <BarChart3 className="w-5 h-5" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total Orders</p>
                <p className="text-3xl font-bold mb-2" style={{ color: 'var(--primary)' }}>
                  {stats.orders?.totalOrders || 0}
                </p>
                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span>Pending: {stats.orders?.pendingOrders || 0}</span>
                  <span>•</span>
                  <span>Active: {stats.orders?.activeOrders || 0}</span>
                </div>
              </div>
              <div 
                className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full opacity-5 group-hover:scale-110 transition-transform duration-500"
                style={{ background: 'var(--primary)' }}
              ></div>
            </div>

            {/* Delivered Card */}
            <div 
              className="rounded-2xl p-6 relative overflow-hidden group hover:shadow-2xl transition-all duration-300"
              style={{ background: 'var(--bg-card)' }}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(16, 185, 129, 0.1)' }}
                  >
                    <CheckCircle className="w-6 h-6 text-teal" />
                  </div>
                  <TrendingUp className="w-5 h-5" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Delivered</p>
                <p className="text-3xl font-bold text-teal">
                  {stats.orders?.deliveredOrders || 0}
                </p>
              </div>
              <div 
                className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full opacity-5 group-hover:scale-110 transition-transform duration-500"
                style={{ background: '#10b981' }}
              ></div>
            </div>

            {/* Revenue Card */}
            <div 
              className="rounded-2xl p-6 relative overflow-hidden group hover:shadow-2xl transition-all duration-300"
              style={{ background: 'linear-gradient(135deg, #ff3366 0%, #ff6699 100%)' }}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white bg-opacity-20">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <Activity className="w-5 h-5 text-white opacity-50" />
                </div>
                <p className="text-sm font-medium mb-1 text-pink-100">Total Revenue</p>
                <p className="text-3xl font-bold text-white">
                  ₦{parseFloat(stats.orders?.totalRevenue || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Riders Card */}
            <div 
              className="rounded-2xl p-6 relative overflow-hidden group hover:shadow-2xl transition-all duration-300"
              style={{ background: 'var(--bg-card)' }}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(139, 92, 246, 0.1)' }}
                  >
                    <Users className="w-6 h-6" style={{ color: '#8b5cf6' }} />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Active Riders</p>
                <p className="text-3xl font-bold" style={{ color: '#8b5cf6' }}>
                  {stats.riders?.totalRiders || 0}
                </p>
                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Online: {stats.riders?.onlineRiders || 0}
                  </span>
                </div>
              </div>
              <div 
                className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full opacity-5 group-hover:scale-110 transition-transform duration-500"
                style={{ background: '#8b5cf6' }}
              ></div>
            </div>
          </div>

          {/* Recent Orders with Modern Table */}
          <div 
            className="rounded-2xl p-6 md:p-8"
            style={{ background: 'var(--bg-card)' }}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Recent Orders</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Latest delivery requests</p>
              </div>
              <button className="flex items-center gap-2 text-sm font-semibold hover:gap-3 transition-all" style={{ color: 'var(--primary)' }}>
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto -mx-6 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Ticket
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Route
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Date
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, index) => (
                      <tr 
                        key={order.id} 
                        className="border-b hover:bg-opacity-50 transition-colors"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <td className="px-4 py-4">
                          <span className="font-mono font-bold text-sm" style={{ color: 'var(--primary)' }}>
                            {order.ticketId}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="max-w-xs">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                              {order.pickupAddress?.split(',')[0]}
                            </p>
                            <p className="text-xs truncate flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                              <ArrowRight className="w-3 h-3" />
                              {order.dropoffAddress?.split(',')[0]}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`badge badge-${order.status} flex items-center gap-1 w-fit`}>
                            {getStatusIcon(order.status)}
                            {order.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                            ₦{parseFloat(order.totalPrice).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {new Date(order.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <a
                            href={`/track/${order.ticketId}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all"
                            style={{ color: 'var(--primary)' }}
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Riders Grid with Modern Cards */}
          <div 
            className="rounded-2xl p-6 md:p-8"
            style={{ background: 'var(--bg-card)' }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Rider Fleet</h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Manage your delivery riders</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {riders.map((rider) => (
                <div 
                  key={rider.id}
                  className="rounded-xl p-5 border hover:border-opacity-100 hover:shadow-lg transition-all duration-300"
                  style={{ 
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    borderWidth: '1px'
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                        style={{ 
                          background: rider.isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                          color: rider.isOnline ? '#10b981' : '#9ca3af'
                        }}
                      >
                        {rider.fullName?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{rider.fullName}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{rider.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {rider.isOnline && (
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      )}
                      <span className={`badge text-xs ${rider.isOnline ? 'badge-picked_up' : 'badge-pending'}`}>
                        {rider.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: 'var(--bg-primary)' }}
                    >
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Vehicle</span>
                      <span className="text-sm font-bold capitalize" style={{ color: 'var(--text-primary)' }}>
                        {rider.vehicleType}
                      </span>
                    </div>
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: 'var(--bg-primary)' }}
                    >
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Plate Number</span>
                      <span className="text-sm font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                        {rider.plateNumber}
                      </span>
                    </div>
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: 'var(--bg-primary)' }}
                    >
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Total Deliveries</span>
                      <span className="text-sm font-bold text-teal">
                        {rider.totalDeliveries}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleRiderStatus(rider.id, rider.status)}
                    className={`btn w-full ${
                      rider.status === 'active' ? 'btn-outline' : 'btn-primary'
                    }`}
                  >
                    {rider.status === 'active' ? 'Suspend Rider' : 'Activate Rider'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
