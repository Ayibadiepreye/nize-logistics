import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer" id="contact">
      <div className="container">
        <div className="footer-content">
          {/* Company Info */}
          <div className="footer-column">
            <div className="footer-logo">
              <div className="logo-icon">
                <i className="fas fa-truck-fast"></i>
              </div>
              <div className="logo-text">
                <div className="logo-main">
                  <span className="logo-nize">Nize</span>
                  <span className="logo-logistics">Logistics</span>
                </div>
                <div className="logo-tagline">...Plenty Waka</div>
              </div>
            </div>
            <p className="footer-description">
              Fast Pick-Up & Fast Delivery services across Port Harcourt and surrounding regions. Reliable, fast dispatch riders ensuring your packages arrive safely.
            </p>
            <div className="footer-badges">
              <span className="badge">⚡ Fast Pick-up</span>
              <span className="badge">🚀 Fast Delivery</span>
            </div>
          </div>

          {/* Flyer Hotlines */}
          <div className="footer-column">
            <h4 className="footer-title">Flyer Hotlines</h4>
            <div className="footer-links">
              <a href="tel:2347063980120" className="footer-phone">
                <i className="fas fa-phone"></i> +234 (0) 706 398 0120
              </a>
              <a href="tel:2348076690185" className="footer-phone">
                <i className="fas fa-phone"></i> +234 (0) 807 669 0185
              </a>
              <a href="tel:2348039346596" className="footer-phone">
                <i className="fas fa-phone"></i> +234 (0) 803 934 6596
              </a>
              <a 
                href="https://wa.me/2347063980120?text=Hello%20Nize%20Logistics!%20I'd%20like%20to%20make%20an%20inquiry%20%2F%20book%20a%20delivery%20package." 
                className="footer-whatsapp" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <i className="fab fa-whatsapp"></i> WhatsApp Dispatch Line
              </a>
            </div>
          </div>

          {/* Office Locations */}
          <div className="footer-column">
            <h4 className="footer-title">Office Locations</h4>
            <div className="footer-locations">
              <div className="location">
                <p className="location-label">Headquarters</p>
                <p className="location-address">44 Nsukka Street, Mile 1 Diobu, Port Harcourt, Rivers State</p>
              </div>
              <div className="location">
                <p className="location-label">Branch Office</p>
                <p className="location-address">10 Ekengwon Street, Oroazi, Port Harcourt, Rivers State</p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-column">
            <h4 className="footer-title">Quick Links</h4>
            <ul className="footer-links">
              <li><Link href="/order">› Book a Pick-Up</Link></li>
              <li><Link href="/track">› Live Order Tracking</Link></li>
              <li><Link href="/quotes">› Price Quote Calculator</Link></li>
              <li><Link href="/#services">› Our Logistics Services</Link></li>
              <li><Link href="/about">› About Nize Logistics</Link></li>
              <li><Link href="/#contact">› Contact & Support</Link></li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <p className="copyright">© 2026 Nize Logistics ("...Plenty Waka"). All rights reserved.</p>
          <div className="footer-meta">
            <span><i className="fas fa-clock"></i> Mon - Sat: 7:00 AM - 7:00 PM</span>
            <span><i className="fas fa-check-circle"></i> Verified Dispatch Fleet</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
