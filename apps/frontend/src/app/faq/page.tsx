'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import Icon from '@/components/Icon';

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      category: 'General',
      questions: [
        {
          q: 'What areas do you cover?',
          a: 'We currently cover all areas within Port Harcourt and surrounding regions in Rivers State. For specific locations outside our usual coverage, please contact us to confirm availability.'
        },
        {
          q: 'How fast is your delivery?',
          a: 'Express deliveries are picked up within 15-30 minutes and delivered based on distance. Same-day delivery is available for most locations within Port Harcourt.'
        },
        {
          q: 'What are your operating hours?',
          a: 'We operate Monday to Saturday, 7:00 AM to 7:00 PM. For urgent deliveries outside these hours, please call our hotline.'
        }
      ]
    },
    {
      category: 'Ordering & Booking',
      questions: [
        {
          q: 'How do I book a delivery?',
          a: 'You can book through our website, call our hotlines (+234 706 398 0120, +234 807 669 0185 or +234 803 934 6596), or message us on WhatsApp. Simply provide pickup and delivery addresses, package details, and your preferred pickup time.'
        },
        {
          q: 'Can I schedule a pickup for later?',
          a: 'Yes! You can schedule pickups for any time during our operating hours. Just select "Scheduled" when creating your order and choose your preferred date and time.'
        },
        {
          q: 'What information do I need to provide?',
          a: 'You need: sender name and phone, recipient name and phone, pickup address, delivery address, and package description. Optional: special instructions and preferred pickup time.'
        }
      ]
    },
    {
      category: 'Pricing & Payment',
      questions: [
        {
          q: 'How much does delivery cost?',
          a: 'Pricing is based on distance. Our base fare starts at ₦1,000 for deliveries within 3km, plus ₦120 per additional kilometer. Use our Quotes page for an instant estimate.'
        },
        {
          q: 'What payment methods do you accept?',
          a: 'We accept online payment via Paystack (card, bank transfer, USSD) and Cash on Delivery (COD). For COD, the recipient pays the rider upon delivery.'
        },
        {
          q: 'Are there any hidden fees?',
          a: 'No hidden fees! The price quoted is the price you pay. All costs are transparent and shown upfront before you confirm your order.'
        },
        {
          q: 'Can I get a refund if my package is delayed?',
          a: 'Yes. If we fail to deliver within the promised timeframe due to our fault, you are eligible for a full refund. Contact our support team with your tracking ID.'
        }
      ]
    },
    {
      category: 'Tracking & Delivery',
      questions: [
        {
          q: 'How do I track my package?',
          a: 'You will receive a unique tracking ID (format: NZ-XXXX) via SMS/email after booking. Enter this ID on our Track page to see real-time updates and rider location.'
        },
        {
          q: 'Will I be notified about delivery status?',
          a: 'Yes! You receive SMS/email notifications at every stage: order confirmed, rider assigned, picked up, on the way, and delivered.'
        },
        {
          q: 'What if the recipient is not available?',
          a: 'Our rider will call the recipient. If unavailable, the rider waits for 10 minutes. If still no response, the package is returned and rescheduled for the next day (additional fees may apply).'
        },
        {
          q: 'Can I change the delivery address after booking?',
          a: 'Yes, but only before the rider picks up the package. Contact us immediately via phone or WhatsApp to update the address.'
        }
      ]
    },
    {
      category: 'Package Safety',
      questions: [
        {
          q: 'Are my packages insured?',
          a: 'Yes! All packages are automatically insured up to ₦50,000. For higher-value items, please inform us during booking for additional coverage.'
        },
        {
          q: 'What items can you deliver?',
          a: 'We deliver documents, parcels, food, e-commerce goods, and personal items. We DO NOT deliver: illegal items, hazardous materials, live animals, or perishables without proper packaging.'
        },
        {
          q: 'What if my package is damaged or lost?',
          a: 'Report immediately via phone or our website. We investigate within 24 hours. If damage/loss is confirmed as our fault, you receive full compensation based on declared value.'
        }
      ]
    },
    {
      category: 'Riders',
      questions: [
        {
          q: 'Are your riders verified?',
          a: 'Yes! All riders undergo thorough background checks, training, and verification. They are equipped with branded uniforms and ID cards for easy identification.'
        },
        {
          q: 'Can I contact the rider directly?',
          a: 'Yes. Once a rider is assigned, you receive their phone number and can contact them directly for real-time updates.'
        }
      ]
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  let globalIndex = 0;

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
                <Icon name="question-circle" />
              </div>
              <h1 style={{ fontSize: '48px', fontWeight: 800, marginBottom: '24px', color: 'white' }}>
                Frequently Asked Questions
              </h1>
              <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.9)', maxWidth: '700px', margin: '0 auto' }}>
                Find answers to common questions about our delivery services
              </p>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-8 px-4" style={{ background: 'var(--bg-subtle)' }}>
          <div className="container" style={{ maxWidth: '900px' }}>
            {faqs.map((category, catIdx) => (
              <div key={catIdx} style={{ marginBottom: '48px' }}>
                <h2 style={{ 
                  fontSize: '28px', 
                  fontWeight: 700, 
                  marginBottom: '24px', 
                  color: 'var(--brand)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <Icon name="folder" />
                  {category.category}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {category.questions.map((faq, qIdx) => {
                    const currentIndex = globalIndex++;
                    const isOpen = openIndex === currentIndex;
                    return (
                      <div 
                        key={qIdx} 
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <button
                          onClick={() => toggleFAQ(currentIndex)}
                          style={{
                            width: '100%',
                            padding: '20px 24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'var(--text-primary)',
                            fontSize: '16px',
                            fontWeight: 600
                          }}
                        >
                          <span>{faq.q}</span>
                          <Icon
                            name="chevron-down"
                            style={{
                              color: 'var(--brand)',
                              transition: 'transform 0.2s ease',
                              transform: isOpen ? 'rotate(180deg)' : 'none',
                              flexShrink: 0,
                            }}
                          />
                        </button>
                        {isOpen && (
                          <div style={{
                            padding: '0 24px 20px 24px',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.7',
                            fontSize: '15px',
                            animation: 'fadeIn 0.3s ease'
                          }}>
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Still Have Questions */}
        <section className="py-8 px-4">
          <div className="container" style={{ maxWidth: '700px', textAlign: 'center' }}>
            <div className="card" style={{ padding: '48px 32px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
                Still Have Questions?
              </h2>
              <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '32px' }}>
                Our support team is here to help! Reach out via phone, WhatsApp, or email
              </p>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a href="tel:+2347063980120" className="btn btn-primary">
                  <Icon name="phone" /> Call Us
                </a>
                <a 
                  href="https://wa.me/2347063980120?text=Hello%20Nize%20Logistics!%20I%20have%20a%20question." 
                  className="btn btn-success"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="whatsapp" /> WhatsApp
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
