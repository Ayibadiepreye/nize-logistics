import puppeteer from 'puppeteer';
import { uploadToCloudinary } from './cloudinary.js';

export async function generateTicketImage(order) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Caveat:wght@600&family=JetBrains+Mono:wght@500&display=swap');
        
        body { 
          font-family: 'Poppins', sans-serif; 
          padding: 40px; 
          width: 700px; 
          background: linear-gradient(135deg, #1E5BBA 0%, #2A9D9F 100%);
          margin: 0;
        }
        .ticket {
          background: white;
          color: #0D1B3D;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .logo { 
          font-size: 48px; 
          font-weight: 800; 
          color: #1E5BBA; 
          margin-bottom: 5px;
        }
        .logistics { color: #E91E5C; }
        .tagline { 
          font-family: 'Caveat', cursive; 
          color: #2A9D9F; 
          font-size: 26px;
          margin-bottom: 30px;
        }
        .ticket-id { 
          font-family: 'JetBrains Mono', monospace; 
          font-size: 36px; 
          color: #E91E5C; 
          text-align: center;
          margin: 30px 0;
          padding: 20px;
          background: #F5F5F5;
          border-radius: 12px;
          font-weight: 700;
        }
        .section {
          margin: 25px 0;
          padding: 20px;
          background: #F8FAFF;
          border-radius: 12px;
        }
        .section-title {
          font-size: 14px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
          font-weight: 600;
        }
        .section-value {
          font-size: 16px;
          color: #0D1B3D;
          font-weight: 600;
          line-height: 1.6;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin: 15px 0;
          padding: 15px;
          background: white;
          border-radius: 8px;
        }
        .label { 
          color: #64748b; 
          font-size: 14px;
        }
        .value { 
          font-weight: 700;
          color: #0D1B3D;
          font-size: 16px;
        }
        .price {
          color: #10B981;
          font-size: 32px;
          font-weight: 800;
          text-align: center;
          margin: 20px 0;
        }
        .footer { 
          text-align: center; 
          margin-top: 30px; 
          padding-top: 20px;
          border-top: 2px solid #E8F0FC;
          color: #64748b; 
          font-size: 13px;
        }
        .qr-placeholder {
          width: 120px;
          height: 120px;
          background: #E8F0FC;
          border-radius: 12px;
          margin: 20px auto;
        }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="logo">Nize <span class="logistics">LOGISTICS</span></div>
        <div class="tagline">...Plenty Waka</div>
        
        <div class="ticket-id">${order.ticketId}</div>
        
        <div class="section">
          <div class="section-title">📍 Pickup Location</div>
          <div class="section-value">${order.pickupAddress}</div>
        </div>
        
        <div class="section">
          <div class="section-title">📍 Drop-off Location</div>
          <div class="section-value">${order.dropoffAddress}</div>
        </div>
        
        <div class="row">
          <span class="label">Distance</span>
          <span class="value">${order.distanceKm} km</span>
        </div>
        
        <div class="row">
          <span class="label">Payment Method</span>
          <span class="value">${order.paymentMethod.toUpperCase()}</span>
        </div>
        
        <div class="price">₦${parseFloat(order.totalPrice).toLocaleString()}</div>
        
        <div class="footer">
          Track your delivery: nizelogistics.com/track/${order.ticketId}<br>
          #NO.11 Udi Street, Mile 1 Diobu • 10 Ekerewon Street, Onua<br>
          +234 (0) 706 398 0120 • +234 (0) 807 669 0182
        </div>
      </div>
    </body>
    </html>
  `;
  
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 780, height: 1200 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.screenshot({ 
      type: 'png',
      fullPage: true
    });
    
    const url = await uploadToCloudinary(buffer, `ticket-${order.ticketId}.png`);
    return url;
  } finally {
    await browser.close();
  }
}
