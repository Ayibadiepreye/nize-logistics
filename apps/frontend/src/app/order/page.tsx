'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import AddressPicker, { type PickedPoint } from '@/components/AddressPicker';
import MapPreview from '@/components/MapPreview';
import api from '@/lib/api';
import Icon from '@/components/Icon';
import { decodePlusCode, encodePlusCode, isValidPlusCode } from '@/lib/plusCode';

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
    pickupLat: '',
    pickupLng: '',
    pickupPlusCode: '',
    dropoffAddress: '',
    dropoffLat: '',
    dropoffLng: '',
    dropoffPlusCode: '',
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
  const [estimating, setEstimating] = useState(false);
  /**
   * Where the map should fly to.
   *
   * Set whenever a location code is entered — by GPS or by hand — so the map
   * moves to the point the customer just gave rather than waiting for a click.
   * `nonce` lets the same coordinates be re-issued.
   */
  const [focusPoint, setFocusPoint] = useState<{
    lat: number;
    lng: number;
    nonce: number;
  } | null>(null);
  /** The road path between the endpoints, drawn once both codes are known. */
  const [routeGeometry, setRouteGeometry] = useState<{
    type: 'LineString';
    coordinates: number[][];
  } | null>(null);

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /** Apply a captured pin to one endpoint of the form. */
  const applyPoint = (field: 'pickup' | 'dropoff', point: PickedPoint) => {
    updateField(`${field}Lat`, point.lat.toString());
    updateField(`${field}Lng`, point.lng.toString());
    updateField(`${field}PlusCode`, point.plusCode);
    // Land the pin on the map immediately.
    setFocusPoint((prev) => ({
      lat: point.lat,
      lng: point.lng,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  };

  /**
   * A location code typed or pasted by hand.
   *
   * Decoding here rather than at the server means the map moves straight away
   * and a bad code is caught while the customer is still looking at the field.
   */
  const handlePlusCodeChange = (field: 'pickup' | 'dropoff', raw: string) => {
    const cleaned = raw.trim().toUpperCase();
    updateField(`${field}PlusCode`, cleaned);

    if (!cleaned || !isValidPlusCode(cleaned)) return;
    const decoded = decodePlusCode(cleaned);
    if (!decoded) return;

    updateField(`${field}Lat`, decoded.lat.toString());
    updateField(`${field}Lng`, decoded.lng.toString());
    setFocusPoint((prev) => ({
      lat: decoded.lat,
      lng: decoded.lng,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  };

  /**
   * The customer dragged a pin to nudge it onto the right gate.
   *
   * The code is re-derived from wherever the pin landed, because the code is what
   * gets stored and priced — leaving it stale would mean the map and the fare
   * describe two different places.
   */
  const handleMarkerMove = (from: [number, number], to: { lat: number; lng: number }) => {
    const field: 'pickup' | 'dropoff' =
      Math.abs(from[0] - parseFloat(formData.pickupLat || '0')) < 1e-9 &&
      Math.abs(from[1] - parseFloat(formData.pickupLng || '0')) < 1e-9
        ? 'pickup'
        : 'dropoff';

    const plusCode = encodePlusCode(to.lat, to.lng) || '';

    updateField(`${field}Lat`, to.lat.toString());
    updateField(`${field}Lng`, to.lng.toString());
    updateField(`${field}PlusCode`, plusCode);
  };

  /** The pin currently captured for an endpoint, if any. */
  const pointFor = (field: 'pickup' | 'dropoff'): PickedPoint | null => {
    const lat = parseFloat(formData[`${field}Lat`]);
    const lng = parseFloat(formData[`${field}Lng`]);
    const plusCode = formData[`${field}PlusCode`];
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !plusCode) return null;
    return { lat, lng, plusCode };
  };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      // A fare cannot be computed without coordinates, and a delivery cannot be
      // found without them either — so both endpoints must have a real pin.
      if (!pointFor('pickup')) {
        setError('Enter a location code for the pickup — tap "Get My Location Code" or paste one.');
        return;
      }
      if (!pointFor('dropoff')) {
        setError('Enter a location code for the drop-off — paste the code the receiver sends you.');
        return;
      }
      // The rider navigates by the written address, not by the code. A pin with
      // no description tells them where but not which gate to stop at.
      if (!formData.pickupAddress.trim()) {
        setError('Describe the pickup place — the rider needs to know which gate or landmark.');
        return;
      }
      if (!formData.dropoffAddress.trim()) {
        setError('Describe the drop-off place — the rider needs to know which gate or landmark.');
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

  // Price on real road distance from the backend's routing engine.
  const calculateEstimate = useCallback(async () => {
    const pickupLat = parseFloat(formData.pickupLat);
    const pickupLng = parseFloat(formData.pickupLng);
    const dropoffLat = parseFloat(formData.dropoffLat);
    const dropoffLng = parseFloat(formData.dropoffLng);

    if (isNaN(pickupLat) || isNaN(pickupLng) || isNaN(dropoffLat) || isNaN(dropoffLng)) {
      return;
    }

    setEstimating(true);
    try {
      const { data } = await api.post('/pricing/calculate', {
        pickupLat: formData.pickupLat,
        pickupLng: formData.pickupLng,
        dropoffLat: formData.dropoffLat,
        dropoffLng: formData.dropoffLng,
      });

      setPriceEstimate({
        distance: data.distance.km.toFixed(2),
        distanceText: data.distance.text,
        price: data.price.total.toFixed(2),
        duration: data.duration.text,
        durationMinutes: data.duration.minutes,
      });

      // The routing engine already traced the road path while pricing this trip.
      // Keep it so the map can draw the route the customer is paying for.
      setRouteGeometry(data.route?.geometry ?? null);
    } catch (err) {
      // Fallback to Haversine calculation
      const R = 6371;
      const dLat = ((dropoffLat - pickupLat) * Math.PI) / 180;
      const dLon = ((dropoffLng - pickupLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((pickupLat * Math.PI) / 180) *
          Math.cos((dropoffLat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      const price = Math.max(1000, 500 + distance * 120);

      setPriceEstimate({
        distance: distance.toFixed(2),
        distanceText: `${distance.toFixed(1)} km`,
        price: price.toFixed(2),
        duration: `~${Math.ceil((distance / 30) * 60)} mins`,
        durationMinutes: Math.ceil((distance / 30) * 60),
      });

      // No routing engine answer, so fall back to a straight line between the
      // two pins rather than showing no path at all.
      setRouteGeometry({
        type: 'LineString',
        coordinates: [
          [pickupLng, pickupLat],
          [dropoffLng, dropoffLat],
        ],
      });
    } finally {
      setEstimating(false);
    }
  }, [formData.pickupLat, formData.pickupLng, formData.dropoffLat, formData.dropoffLng]);

  // Auto-calculate when coordinates change
  useEffect(() => {
    calculateEstimate();
  }, [calculateEstimate]);

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
                        background: s < step ? 'var(--brand)' : '#e5e7eb'
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
                  <Icon name="map-marker-alt" style={{ color: 'var(--brand)', marginRight: '8px' }} />
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

                  <AddressPicker
                    title="Pickup location *"
                    address={formData.pickupAddress}
                    onAddressChange={(v) => updateField('pickupAddress', v)}
                    plusCode={formData.pickupPlusCode}
                    onPlusCodeChange={(v) => handlePlusCodeChange('pickup', v)}
                    point={pointFor('pickup')}
                    onPointChange={(p) => applyPoint('pickup', p)}
                    icon="pickup"
                    allowGpsCapture
                    hint="Tap “Get My Location Code” to fill this from your GPS, or paste a code."
                  />

                  <div style={{ marginTop: '16px' }}>
                    <AddressPicker
                      title="Drop-off location *"
                      address={formData.dropoffAddress}
                      onAddressChange={(v) => updateField('dropoffAddress', v)}
                      plusCode={formData.dropoffPlusCode}
                      onPlusCodeChange={(v) => handlePlusCodeChange('dropoff', v)}
                      point={pointFor('dropoff')}
                      onPointChange={(p) => applyPoint('dropoff', p)}
                      icon="dropoff"
                      hint="The receiver captures their own code and sends it to you — paste it here."
                    />
                  </div>

                  <div className="p-4 bg-primary-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">Estimated Distance</p>
                        <p className="text-2xl font-bold text-primary">
                          {estimating ? '...' : priceEstimate?.distance || '0'} km
                        </p>
                        {priceEstimate?.duration && (
                          <p className="text-xs text-gray-500 mt-1">🕐 {priceEstimate.duration} drive</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Estimated Price</p>
                        <p className="text-2xl font-bold text-teal">
                          ₦{estimating ? '...' : parseFloat(priceEstimate?.price || '0').toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ height: '500px', padding: '16px' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Route Preview</h3>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {routeGeometry ? 'Showing the road path between both pins' : 'Enter both location codes to see the route'}
                  </span>
                </div>
                <div style={{ height: 'calc(100% - 40px)' }}>
                  <MapPreview
                    pickupLat={parseFloat(formData.pickupLat)}
                    pickupLng={parseFloat(formData.pickupLng)}
                    dropoffLat={parseFloat(formData.dropoffLat)}
                    dropoffLng={parseFloat(formData.dropoffLng)}
                    pickupAddress={formData.pickupAddress}
                    dropoffAddress={formData.dropoffAddress}
                    routeGeometry={routeGeometry}
                    focusPoint={focusPoint}
                    draggableMarkers
                    onMarkerMove={handleMarkerMove}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact Info */}
          {step === 2 && (
            <div className="card">
              <h2 className="text-2xl font-bold mb-6 flex items-center" style={{ color: 'var(--text-primary)' }}>
                <Icon name="user" style={{ color: 'var(--brand)', marginRight: '8px' }} />
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
                <Icon name="box" style={{ color: 'var(--brand)', marginRight: '8px' }} />
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
                <Icon name="credit-card" style={{ color: 'var(--brand)', marginRight: '8px' }} />
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
                    <p className="text-4xl font-bold">₦{parseFloat(priceEstimate?.price || '0').toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">Distance</p>
                    <p className="text-2xl font-bold">{priceEstimate?.distance || '0'} km</p>
                    {priceEstimate?.duration && (
                      <p className="text-sm opacity-75 mt-1">🕐 {priceEstimate.duration}</p>
                    )}
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
