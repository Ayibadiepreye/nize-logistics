import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';

export default function AboutPage() {
  return (
    <>
      <Navbar />
      
      <main className="min-h-screen flex flex-col">
        {/* Hero Section */}
        <section className="py-8 px-4" style={{ background: 'var(--bg-hero)' }}>
          <div className="container" style={{ maxWidth: '1280px' }}>
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ 
                width: '100px', 
                height: '100px',
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                borderRadius: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 32px',
                boxShadow: 'var(--shadow-glow)',
                fontSize: '48px',
                color: 'white'
              }}>
                <i className="fas fa-truck-fast"></i>
              </div>
              <h1 style={{ fontSize: '48px', fontWeight: 800, marginBottom: '24px', color: 'white' }}>
                About Nize Logistics
              </h1>
              <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.9)', maxWidth: '700px', margin: '0 auto' }}>
                ...Plenty Waka - Your trusted partner for fast, reliable delivery services across Port Harcourt
              </p>
            </div>
          </div>
        </section>

        {/* Our Story */}
        <section className="py-8 px-4" style={{ background: 'var(--bg-secondary)' }}>
          <div className="container" style={{ maxWidth: '900px' }}>
            <div className="card">
              <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '24px', color: 'var(--text-primary)' }}>
                Our Story
              </h2>
              <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '16px' }}>
                <p style={{ marginBottom: '16px' }}>
                  Nize Logistics was born from a simple observation: Port Harcourt needed a reliable, 
                  fast, and trustworthy delivery service that understands the local terrain and urgency 
                  of getting packages from point A to point B.
                </p>
                <p style={{ marginBottom: '16px' }}>
                  Founded in 2024, we started with just a handful of dispatch riders and a commitment 
                  to excellence. Our tagline "...Plenty Waka" reflects our Nigerian heritage and our 
                  promise - we have plenty of vehicles, plenty of routes, and plenty of determination 
                  to get your packages delivered on time.
                </p>
                <p>
                  Today, we serve businesses and individuals across Port Harcourt and Rivers State, 
                  handling everything from urgent documents to e-commerce deliveries with the same 
                  level of care and professionalism.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="py-8 px-4">
          <div className="container" style={{ maxWidth: '1280px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              <div className="card">
                <div style={{ 
                  width: '60px', 
                  height: '60px',
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px',
                  fontSize: '28px',
                  color: 'white'
                }}>
                  <i className="fas fa-bullseye"></i>
                </div>
                <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
                  Our Mission
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                  To provide fast, reliable, and affordable delivery services that connect businesses 
                  and individuals across Port Harcourt, while creating employment opportunities for 
                  our local riders.
                </p>
              </div>

              <div className="card">
                <div style={{ 
                  width: '60px', 
                  height: '60px',
                  background: 'linear-gradient(135deg, var(--accent), var(--primary))',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px',
                  fontSize: '28px',
                  color: 'white'
                }}>
                  <i className="fas fa-eye"></i>
                </div>
                <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
                  Our Vision
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                  To become the leading logistics provider in Rivers State and expand across Nigeria, 
                  known for our speed, reliability, and exceptional customer service.
                </p>
              </div>

              <div className="card">
                <div style={{ 
                  width: '60px', 
                  height: '60px',
                  background: 'linear-gradient(135deg, var(--success), var(--secondary))',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px',
                  fontSize: '28px',
                  color: 'white'
                }}>
                  <i className="fas fa-heart"></i>
                </div>
                <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
                  Our Values
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                  Speed, Reliability, Transparency, Customer-First Approach, and Integrity in every 
                  delivery we make.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-8 px-4" style={{ background: 'var(--bg-secondary)' }}>
          <div className="container" style={{ maxWidth: '900px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px', textAlign: 'center', color: 'var(--text-primary)' }}>
              Why Choose Nize Logistics?
            </h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              {[
                { icon: 'fa-clock', title: 'Fast Delivery', desc: '15-30 minute pickup time for express orders' },
                { icon: 'fa-shield-alt', title: 'Package Insurance', desc: 'Every package is insured for your peace of mind' },
                { icon: 'fa-map-marked-alt', title: 'Real-Time Tracking', desc: 'Track your package from pickup to delivery' },
                { icon: 'fa-users', title: 'Verified Riders', desc: '100% background-checked and trained dispatch riders' },
                { icon: 'fa-money-bill-wave', title: 'Flexible Payment', desc: 'Pay online or cash on delivery' },
                { icon: 'fa-headset', title: '24/7 Support', desc: 'Our support team is always ready to assist you' }
              ].map((item, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', 
                  gap: '20px', 
                  padding: '20px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px'
                }}>
                  <div style={{ 
                    width: '48px',
                    height: '48px',
                    background: 'var(--primary)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '20px',
                    flexShrink: 0
                  }}>
                    <i className={`fas ${item.icon}`}></i>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                      {item.title}
                    </h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-8 px-4">
          <div className="container" style={{ maxWidth: '800px', textAlign: 'center' }}>
            <div className="card" style={{ padding: '48px 32px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
                Ready to Experience the Difference?
              </h2>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '32px' }}>
                Join thousands of satisfied customers who trust Nize Logistics for their delivery needs
              </p>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a href="/order" className="btn btn-primary btn-lg">
                  <i className="fas fa-rocket"></i> Book a Delivery
                </a>
                <a href="tel:+2347063980120" className="btn btn-success btn-lg">
                  <i className="fas fa-phone"></i> Call Us Now
                </a>
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
