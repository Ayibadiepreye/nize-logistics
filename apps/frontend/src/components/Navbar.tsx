'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Navbar() {
  const [isDark, setIsDark] = useState(true); // Default to dark mode
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDark(false);
      document.body.classList.remove('dark-theme');
    } else {
      // Default to dark if no saved theme or saved as dark
      setIsDark(true);
      document.body.classList.add('dark-theme');
      if (!savedTheme) {
        localStorage.setItem('theme', 'dark');
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    if (newTheme) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="header" id="header">
      <div className="container">
        <div className="header-content">
          {/* Logo */}
          <Link href="/" className="logo">
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
          </Link>

          {/* Navigation Menu */}
          <nav className={`nav ${isMobileMenuOpen ? 'active' : ''}`} id="nav">
            <Link href="/" className="nav-link active">Home</Link>
            <Link href="/order" className="nav-link">Book Delivery</Link>
            <Link href="/track" className="nav-link">Track Order</Link>
            <Link href="/quotes" className="nav-link">Quotes</Link>
            <a href="#services" className="nav-link">Services</a>
            <Link href="/about" className="nav-link">About</Link>
            <a href="#contact" className="nav-link">Contact</a>
          </nav>

          {/* Header Actions */}
          <div className="header-actions">
            <button className="theme-toggle" id="themeToggle" onClick={toggleTheme}>
              <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'}></i>
            </button>
            <a 
              href="https://wa.me/2347063980120?text=Hello%20Nize%20Logistics!%20I'd%20like%20to%20make%20an%20inquiry%20%2F%20book%20a%20delivery%20package." 
              className="whatsapp-icon" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <i className="fab fa-whatsapp"></i>
            </a>
            <Link href="/order" className="btn btn-primary btn-sm">Book Now</Link>
            <button 
              className="mobile-menu-toggle" 
              id="mobileMenuToggle"
              onClick={toggleMobileMenu}
            >
              <i className={isMobileMenuOpen ? 'fas fa-times' : 'fas fa-bars'}></i>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
