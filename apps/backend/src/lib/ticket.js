// Simple ticket generation - returns ticket URL
// No image generation to avoid heavy dependencies

export async function generateTicketImage(order) {
  try {
    // Instead of generating an image, we return a URL to view the ticket
    // The frontend will display the ticket beautifully
    const ticketUrl = `${process.env.FRONTEND_URL}/ticket/${order.ticketId}`;
    
    console.log(`Ticket generated for order ${order.ticketId}: ${ticketUrl}`);
    
    return ticketUrl;
    
  } catch (error) {
    console.error('Error generating ticket:', error);
    return null;
  }
}
