'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import Link from 'next/link';

export default function Home() {
  const [trackInput, setTrackInput] = useState('');

  const handleTrack = () => {
    const orderId = trackInput.trim();
    if (!orderId) {
      alert('Please enter an Order ID');
      return;
    }
    const orderIdPattern = /^NZ-\d{4}$/i;
    if (!orderIdPattern.test(orderId)) {
      alert('Invalid Order ID format. Use format: NZ-8402');
      return;
    }
    window.location.href = `/track/${orderId}`;
  };

  return (
    <>
      <Navbar />
      
      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="hero" id="home">
          <div className="container">
            <div className="hero-content">
              {/* Left Content */}
              <div className="hero-left">
                <h1 className="hero-title">
                  Swift Logistics<br />
                  For <span className="highlight">"...Plenty<br />Waka"</span>
                </h1>
                <p className="hero-description">
                  Nize Logistics provides instant, safe, and trackable pick-up & delivery services across Port Harcourt and Rivers State. Your documents, parcels, and e-commerce goods delivered fast!
                </p>
                <div className="hero-buttons">
                  <Link href="/order" className="btn btn-primary btn-lg">
                    <i className="fas fa-rocket"></i> Book Delivery
                  </Link>
                  <a 
                    href="https://wa.me/2347063980120?text=Hi%20Nize%20Logistics!%20I%20want%20to%20request%20a%20fast%20pickup." 
                    className="btn btn-success btn-lg" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <i className="fab fa-whatsapp"></i> Quick Contact
                  </a>
                </div>
                
                {/* Quick Track */}
                <div className="quick-track">
                  <div className="track-input-wrapper">
                    <input 
                      type="text" 
                      className="track-input" 
                      placeholder="Enter Order ID (e.g. NZ-8402)..."
                      value={trackInput}
                      onChange={(e) => setTrackInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleTrack()}
                    />
                    <button className="btn btn-primary" onClick={handleTrack}>Track</button>
                  </div>
                </div>
              </div>

              {/* Right Content - Fleet Card */}
              <div className="hero-right">
                <div className="fleet-card">
                  <div className="fleet-icon">
                    <i className="fas fa-motorcycle"></i>
                  </div>
                  <div className="fleet-header">
                    <h3>Active Fleet Dispatch</h3>
                    <p>Riders Standing By in Port Harcourt</p>
                  </div>
                  <div className="fleet-contact">
                    <p className="fleet-label">Direct Flyer Order Lines:</p>
                    <a href="tel:2347063980120" className="fleet-phone">
                      <span className="phone-icon"><i className="fas fa-phone"></i></span>
                      <span className="phone-number">+234 (0) 706 398 0120</span>
                      <span className="phone-action">Call Now</span>
                    </a>
                    <a href="tel:2348076690185" className="fleet-phone">
                      <span className="phone-icon"><i className="fas fa-phone"></i></span>
                      <span className="phone-number">+234 (0) 807 669 0185</span>
                      <span className="phone-action">Call Now</span>
                    </a>
                    <a href="tel:2348039346596" className="fleet-phone">
                      <span className="phone-icon"><i className="fas fa-phone"></i></span>
                      <span className="phone-number">+234 (0) 803 934 6596</span>
                      <span className="phone-action">Call Now</span>
                    </a>
                  </div>
                  <div className="fleet-locations">
                    <p className="locations-title">Port Harcourt Offices</p>
                    <p className="location-item">
                      📍 <strong>Mile 1 Diobu:</strong> #11 Udi Street<br />
                      📍 <strong>Oroazi:</strong> 10 Ekengwon Street
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="stats">
          <div className="container">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-clock"></i>
                </div>
                <h3 className="stat-number">15-30 Mins</h3>
                <p className="stat-label">Fast Express Pickup</p>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-motorcycle"></i>
                </div>
                <h3 className="stat-number">100% Verified</h3>
                <p className="stat-label">Trusted Dispatch Riders</p>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-box-open"></i>
                </div>
                <h3 className="stat-number">10,000+</h3>
                <p className="stat-label">Successful Deliveries</p>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-hand-holding-dollar"></i>
                </div>
                <h3 className="stat-number">Fair Pricing</h3>
                <p className="stat-label">No Hidden Charges</p>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="services" id="services">
          <div className="container">
            <div className="section-header">
              <span className="section-label">What We Do Best</span>
              <h2 className="section-title">Tailored Pick-Up & Delivery Solutions</h2>
              <p className="section-description">
                Whether you need a confidential document delivered across town or bulk merchandise sent to clients, Nize Logistics handles it smoothly.
              </p>
            </div>

            <div className="services-grid">
              {/* Service 1 */}
              <div className="service-card">
                <div className="service-icon">
                  <i className="fas fa-bolt"></i>
                </div>
                <h3 className="service-title">Same-Day Express Delivery</h3>
                <p className="service-description">
                  Urgent package? Our dispatch riders prioritize your item for immediate pickup and direct door-to-door transit without delay.
                </p>
              </div>

              {/* Service 2 */}
              <div className="service-card">
                <div className="service-icon service-icon-red">
                  <i className="fas fa-file-alt"></i>
                </div>
                <h3 className="service-title">Document & Parcel Dispatch</h3>
                <p className="service-description">
                  Secure escort for legal contracts, certificates, office files, and sensitive bank documents with recipient phone verification.
                </p>
              </div>

              {/* Service 3 */}
              <div className="service-card">
                <div className="service-icon service-icon-green">
                  <i className="fas fa-shopping-bag"></i>
                </div>
                <h3 className="service-title">E-Commerce & Merchant Logistics</h3>
                <p className="service-description">
                  Dedicated delivery support for online vendors, fashion boutiques, electronics retailers, and food vendors with Pay-on-Delivery option.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta">
          <div className="container">
            <div className="cta-content">
              <div className="cta-left">
                <span className="cta-label">Need a package moved right now?</span>
                <h3 className="cta-title">Call Nize Logistics Hotline</h3>
                <p className="cta-description">Our dispatch team in Port Harcourt is ready to handle your pickup immediately.</p>
              </div>
              <div className="cta-right">
                <a href="tel:+2347063980120" className="btn btn-outline-light btn-lg">
                  <i className="fas fa-phone"></i> 0706 398 0120
                </a>
                <Link href="/order" className="btn btn-danger btn-lg">
                  <i className="fas fa-calendar-check"></i> Book Online
                </Link>
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
