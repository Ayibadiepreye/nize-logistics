'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import Icon from '@/components/Icon';

export default function TrackPage() {
  const router = useRouter();
  const [ticketId, setTicketId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketId.trim()) {
      router.push(`/track/${ticketId.toUpperCase().trim()}`);
    }
  };

  return (
    <>
      <Navbar />
      
      <main className="min-h-screen flex flex-col">
        <section className="flex-1 py-8 px-4" style={{ background: 'var(--bg-subtle)' }}>
          <div className="container">
            <div className="max-w-md mx-auto">
              <div className="card">
                <div className="text-center mb-6">
                  <div style={{ 
                    width: '80px', 
                    height: '80px',
                    background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    boxShadow: 'var(--shadow-md)',
                    fontSize: '36px',
                    color: 'white'
                  }}>
                    <Icon name="search-location" />
                  </div>
                  <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Track Your Package</h1>
                  <p style={{ color: 'var(--text-secondary)' }}>Enter your tracking ID to see real-time updates</p>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      Tracking ID
                    </label>
                    <input
                      type="text"
                      value={ticketId}
                      onChange={(e) => setTicketId(e.target.value.toUpperCase())}
                      className="input"
                      style={{ textAlign: 'center', fontSize: '18px', fontWeight: 600, letterSpacing: '1px' }}
                      placeholder="NZ-8402"
                      required
                    />
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                      Format: NZ-XXXX
                    </p>
                  </div>

                  <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                    <Icon name="location-arrow" /> Track Package
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
