'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import Map from '@/components/Map';
import api from '@/lib/api';
import { initSocket } from '@/lib/socket';
import {
  Package, MapPin, Clock, User, Phone, CheckCircle, Navigation,
  MessageSquare, ShieldCheck, ArrowLeft, RefreshCw, AlertCircle,
  Copy, Check, Share2, Truck, ExternalLink, Activity, Info
} from 'lucide-react';

export default function TrackOrder() {
  const { ticketId } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [rider, setRider] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadOrder();

    // Subscribe to real-time order and rider location updates via socket
    const socket = initSocket('');
    if (ticketId) {
      socket.emit('order:subscribe', ticketId);

      socket.on('order:status-update', (data: any) => {
        if (data.ticketId === ticketId || data.orderId === order?.id) {
          loadOrder();
        }
      });

      socket.on('rider:location-update', (data: any) => {
        if (data.riderId === rider?.id) {
          setRider((prev: any) => ({
            ...prev,
            currentLat: data.lat,
            currentLng: data.lng,
          }));
        }
      });
    }

    return () => {
      if (socket && ticketId) {
        socket.emit('order:unsubscribe', ticketId);
      }
    };
  }, [ticketId]);

  const loadOrder = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get(`/tracking/${ticketId}`);
      setOrder(data.order);
      setRider(data.rider);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Order not found. Please check your ticket ID.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const copyTicketId = () => {
    if (ticketId) {
      navigator.clipboard.writeText(String(ticketId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-between" style={{ background: 'var(--bg-primary)' }}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-4">
            <div className="spinner mx-auto" style={{ width: '44px', height: '44px' }}></div>
            <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Locating Package #{ticketId}...</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Connecting to Port Harcourt satellite dispatch stream</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col justify-between" style={{ background: 'var(--bg-primary)' }}>
        <Navbar />
        <main className="flex-1 py-12 md:py-20 px-4 flex items-center justify-center">
          <div
            className="max-w-md w-full rounded-3xl p-8 md:p-10 border text-center space-y-6 shadow-2xl"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Order Not Found</h1>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                We couldn't locate any package associated with ticket <strong className="text-red-400 font-mono">#{ticketId}</strong>.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Link href="/track" className="btn btn-primary btn-lg w-full">
                <Navigation className="w-4 h-4 mr-1" /> Search Another Ticket
              </Link>
              <Link href="/" className="btn btn-outline btn-sm w-full">
                Return Home
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const statusSteps = [
    { key: 'pending', label: 'Order Booked', desc: 'Awaiting dispatch assignment' },
    { key: 'assigned', label: 'Rider Assigned', desc: 'Rider en route to pickup' },
    { key: 'picked_up', label: 'In Transit', desc: 'Package with rider' },
    { key: 'delivered', label: 'Delivered', desc: 'Completed safely' },
  ];

  const currentStepIndex = (() => {
    switch (order.status) {
      case 'delivered':
        return 3;
      case 'picked_up':
      case 'in_transit':
        return 2;
      case 'accepted':
      case 'assigned':
        return 1;
      case 'pending':
      default:
        return 0;
    }
  })();

  const markers: Array<{
    position: [number, number];
    popup: string;
    icon?: 'pickup' | 'dropoff';
  }> = [
    {
      position: [parseFloat(order.pickupLat), parseFloat(order.pickupLng)],
      popup: `<b>📍 Pickup:</b> ${order.pickupAddress}`,
      icon: 'pickup',
    },
    {
      position: [parseFloat(order.dropoffLat), parseFloat(order.dropoffLng)],
      popup: `<b>🎯 Dropoff:</b> ${order.dropoffAddress}`,
      icon: 'dropoff',
    },
  ];

  if (rider?.currentLat && rider?.currentLng) {
    markers.push({
      position: [parseFloat(rider.currentLat), parseFloat(rider.currentLng)],
      popup: `<b>🛵 Rider:</b> ${rider.fullName} (Live)`,
      icon: 'pickup',
    });
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <span className="badge badge-delivered text-xs py-1 px-3"><CheckCircle className="w-3.5 h-3.5 inline mr-1" /> Delivered</span>;
      case 'cancelled':
        return <span className="badge badge-cancelled text-xs py-1 px-3"><AlertCircle className="w-3.5 h-3.5 inline mr-1" /> Cancelled</span>;
      case 'picked_up':
      case 'in_transit':
        return <span className="badge badge-picked_up text-xs py-1 px-3"><Activity className="w-3.5 h-3.5 inline mr-1" /> In Transit</span>;
      case 'accepted':
      case 'assigned':
        return <span className="badge badge-assigned text-xs py-1 px-3"><Clock className="w-3.5 h-3.5 inline mr-1" /> Rider Assigned</span>;
      case 'pending':
      default:
        return <span className="badge badge-pending text-xs py-1 px-3"><Clock className="w-3.5 h-3.5 inline mr-1" /> Processing</span>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between" style={{ background: 'var(--bg-primary)' }}>
      <Navbar />

      <main className="flex-1 py-8 md:py-12 px-4 md:px-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center justify-between">
            <Link
              href="/track"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Tracker
            </Link>

            <button
              onClick={loadOrder}
              disabled={refreshing}
              className="btn btn-outline btn-sm flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Status</span>
            </button>
          </div>

          {/* Hero Tracking Banner */}
          <div
            className="rounded-3xl p-6 md:p-8 border shadow-xl relative overflow-hidden space-y-6"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-blue-400">
                      Tracking Ticket
                    </span>
                    <button
                      onClick={copyTicketId}
                      className="p-1 rounded-md hover:bg-slate-500/20 text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 text-[11px] font-mono"
                      title="Copy Ticket ID"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--text-primary)' }}>#{order.ticketId}</span>
                    </button>
                  </div>
                </div>

                <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {order.status === 'delivered' && 'Package Successfully Delivered!'}
                  {(order.status === 'picked_up' || order.status === 'in_transit') && 'Package is on the way to Destination'}
                  {(order.status === 'assigned' || order.status === 'accepted') && 'Rider is on the way to Pickup'}
                  {order.status === 'pending' && 'Order Received & Dispatched'}
                </h1>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Estimated Distance: <strong className="text-blue-400">{order.distanceKm || '5.2'} km</strong> • Booked on {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {getStatusBadge(order.status)}
              </div>
            </div>

            {/* Visual 4-Step Journey Progress Stepper */}
            <div className="pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {statusSteps.map((step, index) => {
                  const isDone = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;

                  return (
                    <div
                      key={step.key}
                      className={`p-3.5 rounded-2xl border transition-all duration-300 ${
                        isCurrent
                          ? 'border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                          : isDone
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-slate-700/30 bg-slate-800/10 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isDone ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5" /> : index + 1}
                        </div>
                        <span className="text-xs font-bold" style={{ color: isDone ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {step.label}
                        </span>
                      </div>
                      <p className="text-[11px] pl-8" style={{ color: 'var(--text-secondary)' }}>
                        {step.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Grid: Map & Details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Live Map (7 Cols) */}
            <div
              className="lg:col-span-7 rounded-3xl p-6 border shadow-xl flex flex-col space-y-4"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                  <h2 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Live GPS Telemetry</h2>
                </div>
                <span className="text-xs text-blue-400 font-bold">Port Harcourt Region</span>
              </div>

              <div className="flex-1 min-h-[380px] rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
                <Map
                  center={[parseFloat(order.pickupLat) || 4.8156, parseFloat(order.pickupLng) || 7.0498]}
                  markers={markers}
                  className="w-full h-full min-h-[380px]"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Pickup Point</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-pink-500 inline-block"></span> Dropoff Destination</span>
                {rider && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block animate-pulse"></span> Rider GPS</span>}
              </div>
            </div>

            {/* Right Column: Route, Rider & Details (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Assigned Rider Card (If dispatched) */}
              {rider ? (
                <div
                  className="rounded-3xl p-6 border shadow-lg space-y-4"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-green-400">
                      🛵 Assigned Dispatch Rider
                    </span>
                    <span className="badge badge-delivered text-[10px]">Verified Escort</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-md"
                      style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                    >
                      {rider.fullName?.charAt(0).toUpperCase() || 'R'}
                    </div>
                    <div>
                      <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{rider.fullName}</h3>
                      <p className="text-xs font-semibold capitalize" style={{ color: 'var(--text-secondary)' }}>
                        {rider.vehicleType || 'Motorcycle'} • <span className="font-mono text-blue-400">{rider.plateNumber || 'Verified Bike'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Rider Contact Buttons */}
                  <div className="pt-2 flex gap-2">
                    {rider.phone && (
                      <a
                        href={`tel:${rider.phone}`}
                        className="flex-1 btn btn-outline btn-sm"
                      >
                        <Phone className="w-3.5 h-3.5 text-blue-400" />
                        Call Rider
                      </a>
                    )}
                    {rider.whatsapp && (
                      <a
                        href={`https://wa.me/${rider.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        className="flex-1 btn btn-success btn-sm"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-3xl p-6 border space-y-3"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Assigning Nearest Rider</h3>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Our automated dispatch network is pairing your order.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Route Summary Card */}
              <div
                className="rounded-3xl p-6 border shadow-lg space-y-5"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span>Route Waypoints</span>
                </h3>

                <div className="space-y-4">
                  {/* Pickup */}
                  <div className="p-3.5 rounded-2xl border text-xs space-y-1" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                    <span className="text-[11px] font-bold text-green-400 uppercase">📍 Pickup Location</span>
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{order.pickupAddress}</p>
                    {order.senderPhone && <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Contact: {order.senderPhone}</p>}
                  </div>

                  {/* Dropoff */}
                  <div className="p-3.5 rounded-2xl border text-xs space-y-1" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                    <span className="text-[11px] font-bold text-pink-400 uppercase">🎯 Dropoff Destination</span>
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{order.dropoffAddress}</p>
                    {order.recipientPhone && <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Recipient: {order.recipientName || 'Customer'} ({order.recipientPhone})</p>}
                  </div>
                </div>

                {/* Package Info */}
                {order.description && (
                  <div className="p-3.5 rounded-2xl border bg-amber-500/5 border-amber-500/20 text-xs">
                    <span className="font-bold text-amber-400 block mb-0.5">📦 Parcel Details</span>
                    <p style={{ color: 'var(--text-primary)' }}>{order.description}</p>
                  </div>
                )}
              </div>

              {/* Live Support Action */}
              <div
                className="rounded-3xl p-5 border flex items-center justify-between gap-4"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div>
                  <h4 className="font-bold text-xs" style={{ color: 'var(--text-primary)' }}>Need help with this delivery?</h4>
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Our 24/7 Port Harcourt support desk is online.</p>
                </div>
                <a
                  href="https://wa.me/2349000000000"
                  target="_blank"
                  className="btn btn-outline btn-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-green-400" />
                  Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <FloatingWhatsApp />
    </div>
  );
}
