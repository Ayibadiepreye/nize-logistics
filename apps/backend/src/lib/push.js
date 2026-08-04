import webpush from 'web-push';

// Configure VAPID keys
webpush.setVapidDetails(
  'mailto:' + (process.env.EMAIL_FROM || 'admin@nizelogistics.com'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function sendPushNotification(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log('📲 Push notification sent');
  } catch (error) {
    console.error('Push notification error:', error);
    if (error.statusCode === 410) {
      // Subscription expired
      return { expired: true };
    }
    throw error;
  }
}

export function generateVAPIDKeys() {
  return webpush.generateVAPIDKeys();
}
