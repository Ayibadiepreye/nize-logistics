'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import GoogleAddressInput from '@/components/GoogleAddressInput';
import MapPreview from '@/components/MapPreview';
import api from '@/lib/api';

// Dynamically import map to avoid SSR issues
// No longer needed - using MapPreview directly

export default function CreateOrder() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    pickupType: 'immediate',
    scheduledPickupAt: '',
    pickupAddress: '',
    pickupLat: '4.8156',
    pickupLng: '7.0498',
    dropoffAddress: '',
    dropoffLat: '4.8200',
    dropoffLng: '7.0600',
    senderName: '',
    senderPhone: '',
    senderWhatsapp: '',
    recipientName: '',
    recipientPhone: '',
    recipientWhatsapp: '',
    recipientEmail: '',
    description: '',
    notes: '',
    paymentMethod: 'paystack',
  });

  const [priceEstimate, setPriceEstimate] = useState<any>(null);

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!formData.pickupAddress || !formData.dropoffAddress) {
        setError('Please enter both pickup and dropoff addresses');
        return;
      }
    } else if (step === 2) {
      if (!formData.senderName || !formData.senderPhone || !formData.recipientName || !formData.recipientPhone) {
        setError('Please fill all required contact fields');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/orders', formData);

      if (formData.paymentMethod === 'paystack' && data.payment) {
        // Redirect to Paystack
        window.location.href = data.payment.authorization_url;
      } else {
        // COD - redirect to tracking
        router.push(`/track/${data.order.ticketId}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = () => {
    const R = 6371;
    const lat1 = parseFloat(formData.pickupLat);
    const lon1 = parseFloat(formData.pickupLng);
    const lat2 = parseFloat(formData.dropoffLat);
    const lon2 = parseFloat(formData.dropoffLng);

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    const baseFare = 500;
    const perKmRate = 120;
    const minimumFare = 1000;
    const price = Math.max(minimumFare, baseFare + distance * perKmRate);

    return { distance: distance.toFixed(2), price: price.toFixed(2) };
  };

  const estimate = calculateDistance();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Progress Bar */}
          <div className="card mb-6">
            <div className="flex items-center mb-4">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center" style={{ flex: s < 4 ? 1 : '0 0 auto' }}>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                      s <= step ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {s}
                  </div>
                  {s < 4 && (
                    <div 
                      className="h-1 mx-2 transition-all"
                      style={{ 
                        flex: 1,
                        background: s < step ? 'var(--primary)' : '#e5e7eb'
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 text-sm font-semibold text-center">
              <span className={step >= 1 ? 'text-primary' : 'text-gray-500'}>Locations</span>
              <span className={step >= 2 ? 'text-primary' : 'text-gray-500'}>Contact</span>
              <span className={step >= 3 ? 'text-primary' : 'text-gray-500'}>Package</span>
              <span className={step >= 4 ? 'text-primary' : 'text-gray-500'}>Payment</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Locations */}
          {step === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="text-2xl font-bold mb-6 flex items-center" style={{ color: 'var(--text-primary)' }}>
                  <i className="fas fa-map-marker-alt" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                  Pickup & Delivery
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Pickup Type</label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="immediate"
                          checked={formData.pickupType === 'immediate'}
                          onChange={(e) => updateField('pickupType', e.target.value)}
                          className="mr-2"
                        />
                        Immediate
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="scheduled"
                          checked={formData.pickupType === 'scheduled'}
                          onChange={(e) => updateField('pickupType', e.target.value)}
                          className="mr-2"
                        />
                        Scheduled
                      </label>
                    </div>
                  </div>

                  {formData.pickupType === 'scheduled' && (
                    <div>
                      <label className="block text-sm font-semibold mb-2">Pickup Date & Time</label>
                      <input
                        type="datetime-local"
                        value={formData.scheduledPickupAt}
                        onChange={(e) => updateField('scheduledPickupAt', e.target.value)}
                        className="input"
                      />
                    </div>
                  )}

                  <GoogleAddressInput
                    value={formData.pickupAddress}
                    onChange={(address, lat, lng) => {
                      updateField('pickupAddress', address);
                      updateField('pickupLat', lat.toString());
                      updateField('pickupLng', lng.toString());
                    }}
                    placeholder="Enter pickup address"
                    label="Pickup Address *"
                    showCurrentLocation={true}
                  />

                  <div style={{ marginTop: '16px' }}>
                    <GoogleAddressInput
                      value={formData.dropoffAddress}
                      onChange={(address, lat, lng) => {
                        updateField('dropoffAddress', address);
                        updateField('dropoffLat', lat.toString());
                        updateField('dropoffLng', lng.toString());
                      }}
                      placeholder="Enter dropoff address"
                      label="Dropoff Address *"
                    />
                  </div>

                  <div className="p-4 bg-primary-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">Estimated Distance</p>
                        <p className="text-2xl font-bold text-primary">{estimate.distance} km</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Estimated Price</p>
                        <p className="text-2xl font-bold text-teal">₦{parseFloat(estimate.price).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ height: '500px', padding: '16px' }}>
                <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Map Preview</h3>
                <div style={{ height: 'calc(100% - 40px)' }}>
                  <MapPreview
                    pickupLat={parseFloat(formData.pickupLat)}
                    pickupLng={parseFloat(formData.pickupLng)}
                    dropoffLat={parseFloat(formData.dropoffLat)}
                    dropoffLng={parseFloat(formData.dropoffLng)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact Info */}
          {step === 2 && (
            <div className="card">
              <h2 className="text-2xl font-bold mb-6 flex items-center" style={{ color: 'var(--text-primary)' }}>
                <i className="fas fa-user" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                Contact Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-primary">Sender Details</h3>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={formData.senderName}
                      onChange={(e) => updateField('senderName', e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Phone *</label>
                    <input
                      type="tel"
                      value={formData.senderPhone}
                      onChange={(e) => updateField('senderPhone', e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">WhatsApp (Optional)</label>
                    <input
                      type="tel"
                      value={formData.senderWhatsapp}
                      onChange={(e) => updateField('senderWhatsapp', e.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-accent">Recipient Details</h3>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={formData.recipientName}
                      onChange={(e) => updateField('recipientName', e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Phone *</label>
                    <input
                      type="tel"
                      value={formData.recipientPhone}
                      onChange={(e) => updateField('recipientPhone', e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">WhatsApp (Optional)</label>
                    <input
                      type="tel"
                      value={formData.recipientWhatsapp}
                      onChange={(e) => updateField('recipientWhatsapp', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Email (Optional)</label>
                    <input
                      type="email"
                      value={formData.recipientEmail}
                      onChange={(e) => updateField('recipientEmail', e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Package Details */}
          {step === 3 && (
            <div className="card">
              <h2 className="text-2xl font-bold mb-6 flex items-center" style={{ color: 'var(--text-primary)' }}>
                <i className="fas fa-box" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                Package Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    className="input"
                    placeholder="E.g., Documents, Electronics, Food"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Special Instructions / Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    className="input"
                    rows={4}
                    placeholder="Any special handling instructions..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 4 && (
            <div className="card">
              <h2 className="text-2xl font-bold mb-6 flex items-center" style={{ color: 'var(--text-primary)' }}>
                <i className="fas fa-credit-card" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                Payment Method
              </h2>

              <div className="space-y-4 mb-6">
                <label className="card cursor-pointer hover:border-primary border-2 transition-colors">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      value="paystack"
                      checked={formData.paymentMethod === 'paystack'}
                      onChange={(e) => updateField('paymentMethod', e.target.value)}
                      className="mr-4"
                    />
                    <div>
                      <p className="font-bold">Pay Online (Paystack)</p>
                      <p className="text-sm text-gray-600">Card, Bank Transfer, USSD</p>
                    </div>
                  </div>
                </label>

                <label className="card cursor-pointer hover:border-primary border-2 transition-colors">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      value="cod"
                      checked={formData.paymentMethod === 'cod'}
                      onChange={(e) => updateField('paymentMethod', e.target.value)}
                      className="mr-4"
                    />
                    <div>
                      <p className="font-bold">Cash on Delivery</p>
                      <p className="text-sm text-gray-600">Pay when package is delivered</p>
                    </div>
                  </div>
                </label>
              </div>

              <div className="p-6 bg-gradient-to-r from-primary to-teal text-white rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm opacity-90">Total Amount</p>
                    <p className="text-4xl font-bold">₦{parseFloat(estimate.price).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">Distance</p>
                    <p className="text-2xl font-bold">{estimate.distance} km</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6">
            {step > 1 && (
              <button onClick={handleBack} className="btn btn-outline">
                Back
              </button>
            )}
            {step < 4 ? (
              <button onClick={handleNext} className="btn btn-primary ml-auto">
                Next
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} className="btn btn-accent ml-auto">
                {loading ? 'Processing...' : formData.paymentMethod === 'paystack' ? 'Proceed to Payment' : 'Create Order'}
              </button>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
