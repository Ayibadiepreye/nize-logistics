'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import api from '@/lib/api';
import Link from 'next/link';
import { Truck, Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

      if (data.user.role === 'admin' || data.user.role === 'super_admin') {
        router.push('/admin');
      } else if (data.user.role === 'rider') {
        router.push('/rider');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      
      <main className="min-h-screen flex flex-col justify-center py-12 px-4" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-md w-full mx-auto">
          {/* Main Login Card */}
          <div
            className="rounded-3xl p-8 md:p-10 border shadow-2xl space-y-6 backdrop-blur-md"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
          >
            {/* Header Icon & Title */}
            <div className="text-center space-y-3">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #0066ff 0%, #ff3366 100%)',
                  boxShadow: '0 8px 24px rgba(0, 102, 255, 0.4)',
                }}
              >
                <Truck className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Welcome Back
              </h1>
              <p className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>
                Sign in to your Nize Logistics control center
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="p-4 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input pl-10 text-xs font-medium w-full"
                    placeholder="admin@nizelogistics.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input pl-10 pr-10 text-xs font-medium w-full"
                    placeholder="Enter your secret password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-lg w-full font-bold shadow-lg"
              >
                {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
              </button>
            </form>

            <div className="pt-2 text-center">
              <Link
                href="/track"
                className="text-xs font-bold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
              >
                Looking to track a package? Click here <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
