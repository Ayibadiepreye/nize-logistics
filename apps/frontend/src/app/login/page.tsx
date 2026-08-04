'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import api from '@/lib/api';
import Link from 'next/link';

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', formData);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user.role === 'admin') {
        router.push('/admin');
      } else if (data.user.role === 'rider') {
        router.push('/rider');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      
      <main className="min-h-screen flex flex-col">
        <section className="flex-1 py-8 px-4" style={{ background: 'var(--bg-secondary)' }}>
          <div className="container">
            <div className="max-w-md mx-auto">
              <div className="card">
                <div className="text-center mb-6">
                  <div className="logo-icon mx-auto mb-4" style={{ width: '60px', height: '60px', fontSize: '28px' }}>
                    <i className="fas fa-truck-fast"></i>
                  </div>
                  <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Welcome Back</h1>
                  <p style={{ color: 'var(--text-secondary)' }}>Sign in to access your dashboard</p>
                </div>

                {error && (
                  <div style={{ 
                    background: 'rgba(255, 51, 102, 0.1)', 
                    border: '1px solid var(--accent)', 
                    color: 'var(--accent)',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    marginBottom: '24px',
                    fontSize: '14px'
                  }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input"
                      placeholder="Enter your email"
                      required
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      Password
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input"
                      placeholder="Enter your password"
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%' }}
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
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
