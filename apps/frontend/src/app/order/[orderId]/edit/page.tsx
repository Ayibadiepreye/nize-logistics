'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { Edit, Save, X } from 'lucide-react';

export default function EditOrder() {
  const { orderId } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    pickupAddress: '',
    dropoffAddress: '',
    senderPhone: '',
    recipientPhone: '',
    notes: '',
    scheduledPickupAt: '',
  });

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const { data } = await api.get(`/tracking/${orderId}`);
      const orderData = data.order;
      
      setOrder(orderData);
      setFormData({
        pickupAddress: orderData.pickupAddress || '',
        dropoffAddress: orderData.dropoffAddress || '',
        senderPhone: orderData.senderPhone || '',
        recipientPhone: orderData.recipientPhone || '',
        notes: orderData.notes || '',
        scheduledPickupAt: orderData.scheduledPickupAt 
          ? new Date(orderData.scheduledPickupAt).toISOString().slice(0, 16) 
          : '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Order not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api.put(`/orders/${orderId}`, formData);
      alert('✅ Order updated successfully!');
      router.push(`/order/${orderId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (confirm('Discard changes?')) {
      router.push(`/order/${orderId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="card max-w-md text-center">
            <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <a href="/" className="btn btn-primary">Go Home</a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const canEdit = ['pending', 'assigned'].includes(order?.status);

  if (!canEdit) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="card max-w-md text-center">
            <X className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Cannot Edit Order</h2>
            <p className="text-gray-600 mb-4">
              Orders can only be edited before pickup (Status: {order?.status})
            </p>
            <button onClick={() => router.push(`/order/${orderId}`)} className="btn btn-primary">
              Back to Order
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="card mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Edit className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold">Edit Order</h1>
            </div>
            <p className="text-gray-600">Make changes before the rider picks up your package</p>
            <p className="font-mono text-lg text-primary mt-2">{order.ticketId}</p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Edit Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Location Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Pickup Address *
                  </label>
                  <input
                    type="text"
                    value={formData.pickupAddress}
                    onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
                    className="input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {order.pickupAddress}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Dropoff Address *
                  </label>
                  <input
                    type="text"
                    value={formData.dropoffAddress}
                    onChange={(e) => setFormData({ ...formData, dropoffAddress: e.target.value })}
                    className="input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {order.dropoffAddress}
                  </p>
                </div>

                {order.pickupType === 'scheduled' && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Scheduled Pickup Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.scheduledPickupAt}
                      onChange={(e) => setFormData({ ...formData, scheduledPickupAt: e.target.value })}
                      className="input"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-bold mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Sender Phone *
                  </label>
                  <input
                    type="tel"
                    value={formData.senderPhone}
                    onChange={(e) => setFormData({ ...formData, senderPhone: e.target.value })}
                    className="input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {order.senderPhone}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Recipient Phone *
                  </label>
                  <input
                    type="tel"
                    value={formData.recipientPhone}
                    onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                    className="input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {order.recipientPhone}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-bold mb-4">Additional Notes</h2>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input"
                rows={4}
                placeholder="Any special instructions or changes..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleCancel}
                className="btn btn-outline flex-1"
                disabled={saving}
              >
                <X className="w-5 h-5 mr-2" />
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={saving}
              >
                <Save className="w-5 h-5 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

          {/* Warning */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Note:</strong> Changes will be reflected immediately. If a rider has already been assigned, 
              they will be notified of the updates.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
