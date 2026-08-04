'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { Package, Edit, XCircle, AlertTriangle } from 'lucide-react';

export default function OrderManagement() {
  const { orderId } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const { data } = await api.get(`/tracking/${order?.ticketId || orderId}`);
      setOrder(data.order);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Order not found');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }

    setCancelling(true);
    try {
      await api.post(`/orders/${orderId}/cancel`, { reason: cancelReason });
      alert('✅ Order cancelled successfully!');
      router.push('/');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel order');
    } finally {
      setCancelling(false);
      setShowCancelModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="card max-w-md text-center">
            <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <a href="/" className="btn btn-primary">
              Go Home
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const canCancel = ['pending', 'assigned'].includes(order.status);
  const canEdit = ['pending', 'assigned'].includes(order.status);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="card mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">Manage Order</h1>
                <p className="font-mono text-xl text-primary">{order.ticketId}</p>
              </div>
              <span className={`badge badge-${order.status} text-lg`}>
                {order.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Order Details */}
          <div className="card mb-6">
            <h2 className="text-2xl font-bold mb-4">Order Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Pickup Address</p>
                <p className="font-semibold">{order.pickupAddress}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Dropoff Address</p>
                <p className="font-semibold">{order.dropoffAddress}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Sender</p>
                <p className="font-semibold">{order.senderName}</p>
                <p className="text-sm text-gray-500">{order.senderPhone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Recipient</p>
                <p className="font-semibold">{order.recipientName}</p>
                <p className="text-sm text-gray-500">{order.recipientPhone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Distance</p>
                <p className="font-bold text-lg">{order.distanceKm} km</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Price</p>
                <p className="font-bold text-lg text-teal">₦{parseFloat(order.totalPrice).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-semibold">{order.paymentMethod.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Status</p>
                <p className={`font-semibold ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {order.paymentStatus.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          {(canCancel || canEdit) && (
            <div className="card">
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <AlertTriangle className="w-6 h-6 mr-2 text-yellow-600" />
                Order Actions
              </h2>

              <div className="space-y-4">
                {canEdit && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-bold mb-2 flex items-center">
                      <Edit className="w-5 h-5 mr-2 text-primary" />
                      Edit Order
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      You can update pickup/dropoff addresses, contact numbers, and notes before the rider picks up the package.
                    </p>
                    <button
                      onClick={() => router.push(`/order/${orderId}/edit`)}
                      className="btn btn-primary"
                    >
                      Edit Order Details
                    </button>
                  </div>
                )}

                {canCancel && (
                  <div className="p-4 bg-red-50 rounded-lg">
                    <h3 className="font-bold mb-2 flex items-center text-red-700">
                      <XCircle className="w-5 h-5 mr-2" />
                      Cancel Order
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Cancel this order before pickup. {order.paymentStatus === 'paid' && 'Refunds will be processed within 3-5 business days.'}
                    </p>
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="btn btn-accent"
                    >
                      Cancel Order
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {order.status === 'cancelled' && (
            <div className="card bg-red-50 border-2 border-red-200">
              <div className="flex items-start gap-4">
                <XCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-red-700 mb-2">Order Cancelled</h3>
                  {order.cancellationReason && (
                    <p className="text-gray-700"><span className="font-semibold">Reason:</span> {order.cancellationReason}</p>
                  )}
                  {order.paymentStatus === 'refunded' && (
                    <p className="text-green-700 font-semibold mt-2">✅ Refund processed</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-red-700 flex items-center">
              <XCircle className="w-6 h-6 mr-2" />
              Cancel Order
            </h2>
            <p className="text-gray-600 mb-4">
              Please provide a reason for cancelling this order:
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="input mb-4"
              rows={4}
              placeholder="E.g., Changed plans, wrong address, etc."
              required
            />
            {order.paymentStatus === 'paid' && (
              <div className="p-3 bg-blue-50 rounded-lg mb-4 text-sm">
                <p className="font-semibold text-blue-800">Refund Information:</p>
                <p className="text-gray-700">Amount: ₦{parseFloat(order.totalPrice).toLocaleString()}</p>
                <p className="text-gray-700">Processing time: 3-5 business days</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="btn btn-outline flex-1"
                disabled={cancelling}
              >
                Keep Order
              </button>
              <button
                onClick={handleCancel}
                className="btn btn-accent flex-1"
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
