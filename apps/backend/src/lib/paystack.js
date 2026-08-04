import axios from 'axios';

const BASE_URL = 'https://api.paystack.co';

export async function initializeTransaction({ email, amount, reference, callback_url }) {
  try {
    const response = await axios.post(
      `${BASE_URL}/transaction/initialize`,
      {
        email,
        amount: Math.round(parseFloat(amount) * 100), // Convert to kobo
        reference,
        callback_url,
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.data;
  } catch (error) {
    console.error('Paystack initialization error:', error.response?.data || error.message);
    throw new Error('Payment initialization failed');
  }
}

export async function verifyTransaction(reference) {
  try {
    const response = await axios.get(
      `${BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    return response.data.data;
  } catch (error) {
    console.error('Paystack verification error:', error.response?.data || error.message);
    throw new Error('Payment verification failed');
  }
}
