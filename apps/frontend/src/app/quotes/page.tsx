'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import AddressPicker, { type PickedPoint } from '@/components/AddressPicker';
import MapPreview from '@/components/MapPreview';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import api, { apiError } from '@/lib/api';
import { naira } from '@/lib/format';
import { decodePlusCode } from '@/lib/plusCode';

export default function QuotesPage() {
  const router = useRouter();
  const [distance, setDistance] = useState('');
  const [quote, setQuote] = useState<{ distance: string; price: string; breakdown: any } | null>(null);

  // Address-based quote — priced on real road distance from the backend rather
  // than a straight line between the two pins.
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupPlusCode, setPickupPlusCode] = useState('');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [pickupPoint, setPickupPoint] = useState<PickedPoint | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffPlusCode, setDropoffPlusCode] = useState('');
  const [dropoffLat, setDropoffLat] = useState<number | null>(null);
  const [dropoffLng, setDropoffLng] = useState<number | null>(null);
  const [dropoffPoint, setDropoffPoint] = useState<PickedPoint | null>(null);
  const [addressQuote, setAddressQuote] = useState<{
    distanceKm: number;
    totalPrice: number;
    durationMinutes: number | null;
    pricing: { baseFare: number; perKmRate: number; minimumFare: number };
  } | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState('');

  const calculateAddressQuote = async () => {
    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      setAddressError('Capture both a pickup and a drop-off point — tap the map or use the location button.');
      return;
    }

    setAddressLoading(true);
    setAddressError('');

    try {
      const { data } = await api.post('/orders/quote', {
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng
      });
      setAddressQuote(data);
    } catch (err) {
      setAddressError(apiError(err, 'Could not calculate that route. Please try again.'));
    } finally {
      setAddressLoading(false);
    }
  };

  const calculateQuote = () => {
    const dist = parseFloat(distance);
    if (isNaN(dist) || dist <= 0) {
      alert('Please enter a valid distance');
      return;
    }

    const baseFare = 500;
    const perKmRate = 120;
    const minimumFare = 1000;
    const price = Math.max(minimumFare, baseFare + dist * perKmRate);

    setQuote({
      distance: dist.toFixed(2),
      price: price.toFixed(2),
      breakdown: {
        baseFare,
        distanceFare: dist * perKmRate,
        minimumFare
      }
    });
  };

  return (
    <>
      <Navbar />
      
      <main className="min-h-screen flex flex-col">
        {/* Hero Section */}
        <section className="py-8 px-4" style={{ background: 'var(--brand)' }}>
          <div className="container" style={{ maxWidth: '1280px' }}>
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ 
                width: '100px', 
                height: '100px',
                background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))',
                borderRadius: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 32px',
                boxShadow: 'var(--shadow-md)',
                fontSize: '48px',
                color: 'white'
              }}>
                <Icon name="calculator" />
              </div>
              <h1 style={{ fontSize: '48px', fontWeight: 800, marginBottom: '24px', color: 'white' }}>
                Get an Instant Quote
              </h1>
              <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.9)', maxWidth: '700px', margin: '0 auto' }}>
                Calculate delivery costs based on distance - transparent pricing, no hidden fees
              </p>
            </div>
          </div>
        </section>

        {/* Address-Based Calculator */}
        <section className="py-8 px-4" style={{ background: 'var(--bg-subtle)' }}>
          <div className="container" style={{ maxWidth: '1200px' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Quote by Address
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
                Pick two addresses and we'll price the real road distance, not a straight line.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '24px',
                alignItems: 'start'
              }}
            >
              {/* Left: address inputs + result */}
              <div className="card">
                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    marginBottom: '20px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <Icon name="map-marker-alt" style={{ color: 'var(--brand)', marginRight: '8px' }} />
                  Enter Your Addresses
                </h3>

                <div style={{ display: 'grid', gap: '16px' }}>
                  <AddressPicker
                    title="Pickup location"
                    address={pickupAddress}
                    onAddressChange={setPickupAddress}
                    placeName=""
                    onPlaceNameChange={() => {}}
                    plusCode={pickupPlusCode}
                    onPlusCodeChange={(v) => {
                      setPickupPlusCode(v);
                      const decoded = decodePlusCode(v.trim().toUpperCase());
                      if (decoded) {
                        setPickupPoint({ lat: decoded.lat, lng: decoded.lng, plusCode: v.trim().toUpperCase() });
                        setPickupLat(decoded.lat);
                        setPickupLng(decoded.lng);
                      }
                    }}
                    point={pickupPoint}
                    onPointChange={(p) => {
                      setPickupPoint(p);
                      setPickupLat(p.lat);
                      setPickupLng(p.lng);
                    }}
                    icon="pickup"
                    allowGpsCapture
                  />

                  <AddressPicker
                    title="Drop-off location"
                    address={dropoffAddress}
                    onAddressChange={setDropoffAddress}
                    placeName=""
                    onPlaceNameChange={() => {}}
                    plusCode={dropoffPlusCode}
                    onPlusCodeChange={(v) => {
                      setDropoffPlusCode(v);
                      const decoded = decodePlusCode(v.trim().toUpperCase());
                      if (decoded) {
                        setDropoffPoint({ lat: decoded.lat, lng: decoded.lng, plusCode: v.trim().toUpperCase() });
                        setDropoffLat(decoded.lat);
                        setDropoffLng(decoded.lng);
                      }
                    }}
                    point={dropoffPoint}
                    onPointChange={(p) => {
                      setDropoffPoint(p);
                      setDropoffLat(p.lat);
                      setDropoffLng(p.lng);
                    }}
                    icon="dropoff"
                  />
                </div>

                <button
                  onClick={calculateAddressQuote}
                  disabled={!pickupLat || !dropoffLat || addressLoading}
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', marginTop: '20px', opacity: !pickupLat || !dropoffLat ? 0.6 : 1 }}
                >
                  <Icon name="road" /> {addressLoading ? 'Calculating...' : 'Get Accurate Quote'}
                </button>

                {addressError && (
                  <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '12px' }}>
                    <Icon name="info-circle" style={{ marginRight: '6px' }} />
                    {addressError}
                  </p>
                )}

                {addressQuote && (
                  <div
                    style={{
                      marginTop: '24px',
                      padding: '24px',
                      background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))',
                      borderRadius: '16px',
                      color: 'white'
                    }}
                  >
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Estimated Price</p>
                      <p style={{ fontSize: '48px', fontWeight: 800 }}>₦{naira(addressQuote.totalPrice)}</p>
                      <p style={{ fontSize: '15px', opacity: 0.9, marginTop: '6px' }}>
                        {Number(addressQuote.distanceKm).toFixed(2)} km
                        {addressQuote.durationMinutes
                          ? ` • about ${Math.round(addressQuote.durationMinutes)} min drive`
                          : ''}
                      </p>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '16px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', opacity: 0.9 }}>
                        Price Breakdown:
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                          fontSize: '14px'
                        }}
                      >
                        <span>Base Fare</span>
                        <span>₦{naira(addressQuote.pricing.baseFare)}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                          fontSize: '14px'
                        }}
                      >
                        <span>
                          Distance ({Number(addressQuote.distanceKm).toFixed(2)} km × ₦
                          {naira(addressQuote.pricing.perKmRate)}/km)
                        </span>
                        <span>₦{naira(Math.max(0, addressQuote.totalPrice - addressQuote.pricing.baseFare))}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          paddingTop: '8px',
                          borderTop: '1px solid rgba(255,255,255,0.2)',
                          fontSize: '16px',
                          fontWeight: 600
                        }}
                      >
                        <span>Total</span>
                        <span>₦{naira(addressQuote.totalPrice)}</span>
                      </div>
                      {addressQuote.totalPrice <= addressQuote.pricing.minimumFare && (
                        <p style={{ fontSize: '12px', marginTop: '12px', opacity: 0.85, fontStyle: 'italic' }}>
                          * Minimum fare of ₦{naira(addressQuote.pricing.minimumFare)} applies
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => router.push('/order')}
                      style={{
                        width: '100%',
                        marginTop: '20px',
                        padding: '14px',
                        background: 'white',
                        color: 'var(--brand)',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                      onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      <Icon name="rocket" /> Book This Delivery
                    </button>
                  </div>
                )}
              </div>

              {/* Right: route preview */}
              <div className="card" style={{ padding: '16px' }}>
                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    marginBottom: '16px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <Icon name="map-marker-alt" style={{ color: 'var(--brand)', marginRight: '8px' }} />
                  Route Preview
                </h3>
                <div style={{ height: '420px', borderRadius: '12px', overflow: 'hidden' }}>
                  <MapPreview
                    pickupLat={pickupLat || undefined}
                    pickupLng={pickupLng || undefined}
                    dropoffLat={dropoffLat || undefined}
                    dropoffLng={dropoffLng || undefined}
                  />
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                  The route and fare update as soon as both addresses are chosen.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Distance-Based Calculator */}
        <section className="py-8 px-4">
          <div className="container" style={{ maxWidth: '700px' }}>
            <div className="card">
              <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px', color: 'var(--text-primary)' }}>
                Distance-Based Calculator
              </h2>
              
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Enter Distance (km)
                </label>
                <input
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  className="input"
                  placeholder="e.g., 5.5"
                  min="0"
                  step="0.1"
                  style={{ fontSize: '18px' }}
                />
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  <Icon name="info-circle" /> Don't know the distance? Use our{' '}
                  <a href="/order" style={{ color: 'var(--brand)', fontWeight: 600 }}>order form</a> with address autocomplete
                </p>
              </div>

              <button 
                onClick={calculateQuote}
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
              >
                <Icon name="calculator" /> Calculate Price
              </button>

              {quote && (
                <div style={{ 
                  marginTop: '32px',
                  padding: '24px',
                  background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))',
                  borderRadius: '16px',
                  color: 'white'
                }}>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Estimated Price</p>
                    <p style={{ fontSize: '48px', fontWeight: 800 }}>₦{parseFloat(quote.price).toLocaleString()}</p>
                    <p style={{ fontSize: '16px', opacity: 0.9 }}>for {quote.distance} km</p>
                  </div>

                  <div style={{ 
                    borderTop: '1px solid rgba(255,255,255,0.2)',
                    paddingTop: '16px'
                  }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', opacity: 0.9 }}>Price Breakdown:</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                      <span>Base Fare</span>
                      <span>₦{quote.breakdown.baseFare.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                      <span>Distance ({quote.distance} km × ₦120/km)</span>
                      <span>₦{quote.breakdown.distanceFare.toFixed(0).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: '16px', fontWeight: 600 }}>
                      <span>Total</span>
                      <span>₦{parseFloat(quote.price).toLocaleString()}</span>
                    </div>
                    {parseFloat(quote.price) === quote.breakdown.minimumFare && (
                      <p style={{ fontSize: '12px', marginTop: '12px', opacity: 0.8, fontStyle: 'italic' }}>
                        * Minimum fare of ₦{quote.breakdown.minimumFare.toLocaleString()} applies
                      </p>
                    )}
                  </div>

                  <button 
                    onClick={() => router.push('/order')}
                    style={{
                      width: '100%',
                      marginTop: '20px',
                      padding: '14px',
                      background: 'white',
                      color: 'var(--brand)',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <Icon name="rocket" /> Book This Delivery
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Pricing Info */}
        <section className="py-8 px-4">
          <div className="container" style={{ maxWidth: '900px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '32px', textAlign: 'center', color: 'var(--text-primary)' }}>
              Our Pricing Structure
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              <div className="card">
                <div style={{ 
                  width: '56px',
                  height: '56px',
                  background: 'var(--brand)',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px',
                  marginBottom: '16px'
                }}>
                  <Icon name="hand-holding-dollar" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
                  Base Fare
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
                  Starting at <strong>₦500</strong> for all deliveries, covering our operational costs
                </p>
              </div>

              <div className="card">
                <div style={{ 
                  width: '56px',
                  height: '56px',
                  background: 'var(--brand-hover)',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px',
                  marginBottom: '16px'
                }}>
                  <Icon name="road" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
                  Per Kilometer
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
                  <strong>₦120 per km</strong> calculated based on actual distance traveled
                </p>
              </div>

              <div className="card">
                <div style={{ 
                  width: '56px',
                  height: '56px',
                  background: 'var(--success)',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px',
                  marginBottom: '16px'
                }}>
                  <Icon name="check-circle" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
                  Minimum Fare
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
                  Minimum charge of <strong>₦1,000</strong> for all deliveries within Port Harcourt
                </p>
              </div>
            </div>

            <div className="card" style={{ marginTop: '32px', padding: '24px', background: 'var(--brand-subtle)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
                <Icon name="info-circle" style={{ color: 'var(--brand)' }} /> Good to Know
              </h3>
              <ul style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.8', paddingLeft: '20px' }}>
                <li>No hidden charges - the price you see is what you pay</li>
                <li>Prices shown are estimates based on straight-line distance</li>
                <li>Actual price may vary slightly based on rider route</li>
                <li>All packages up to ₦50,000 are automatically insured</li>
                <li>Bulk discounts available for businesses - contact us</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
