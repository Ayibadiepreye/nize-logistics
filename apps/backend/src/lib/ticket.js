// Ticket generation is optional - requires puppeteer
// If not available, tickets will be text-based only

export async function generateTicketImage(order) {
  // Puppeteer removed for faster deployment
  // Can be re-enabled later if needed
  console.log('Ticket image generation disabled - Puppeteer not installed');
  return null;
}
