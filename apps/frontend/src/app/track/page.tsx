'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import Link from 'next/link';
import { Search, Navigation, Package, ShieldCheck, Clock, ArrowRight, Truck, MapPin, Sparkles } from 'lucide-react';

export default function TrackPage() {
  const router = useRouter();
  const [ticketId, setTicketId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = ticketId.trim().toUpperCase();
    if (!cleanId) {
      setError('Please enter a tracking ticket ID');
      return;
    }
    router.push(`/track/${cleanId}`);
  };

  const handleQuickSelect = (id: string) => {
    setTicketId(id);
    router.push(`/track/${id}`);
  };

  return (
    <>
      <Navbar />
      
      <main className="min-h-screen flex flex-col justify-between" style={{ background: 'var(--bg-primary)' }}>
        <section className="py-12 md:py-20 px-4">
          <div className="max-w-3xl mx-auto space-y-10">
            {/* Hero Header */}
            <div className="text-center space-y-4">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold"
                style={{
                  background: 'rgba(0, 102, 255, 0.1)',
                  borderColor: 'rgba(0, 102, 255, 0.3)',
                  color: '#0066ff',
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Live Satellite & GPS Dispatch Radar</span>
              </div>

              <h1 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Track Your Package in <span style={{ color: '#0066ff' }}>Real Time</span>
              </h1>
              <p className="text-sm md:text-base max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Follow your dispatch rider step-by-step from pickup to doorstep anywhere in Port Harcourt and Rivers State.
              </p>
            </div>

            {/* Tracking Search Card */}
            <div
              className="rounded-3xl p-6 md:p-10 border shadow-2xl space-y-6 backdrop-blur-md"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
              }}
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2 tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Enter Order Tracking Ticket Number
                  </label>
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                    <input
                      type="text"
                      value={ticketId}
                      onChange={(e) => {
                        setTicketId(e.target.value.toUpperCase());
                        setError('');
                      }}
                      placeholder="e.g. NZ-2035"
                      className="input pl-12 pr-4 py-4 text-base md:text-lg font-mono font-bold w-full uppercase"
                      style={{ letterSpacing: '0.05em' }}
                      required
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-red-400 font-semibold mt-2">{error}</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg w-full font-bold shadow-lg"
                >
                  <Navigation className="w-4 h-4 mr-1" /> Track Delivery Now
                </button>
              </form>

              {/* Quick Format & Assistance */}
              <div className="pt-2 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                <span>Format: <strong className="text-blue-400 font-mono">NZ-XXXX</strong> (Check your SMS or receipt)</span>
                <Link href="/order" className="font-bold text-blue-400 hover:underline flex items-center gap-1">
                  Need to book a new pickup? <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div
                className="rounded-2xl p-6 border space-y-3"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>15–30 Mins Express</h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Rapid express dispatch across all major Port Harcourt and Obio/Akpor routes.
                </p>
              </div>

              <div
                className="rounded-2xl p-6 border space-y-3"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-500/10 text-green-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>100% Verified Escort</h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Certified and background-checked dispatch riders ensuring document and parcel safety.
                </p>
              </div>

              <div
                className="rounded-2xl p-6 border space-y-3"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-pink-500/10 text-pink-400">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Live Map Telemetry</h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Watch your package move live on the satellite map with dynamic ETA.
                </p>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>

      <FloatingWhatsApp />
    </>
  );
}
