// Single Google Maps loader to prevent multiple script loads

let googleMapsPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  // Return existing promise if already loading/loaded
  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  // Check if already loaded
  if (typeof window !== 'undefined' && window.google?.maps) {
    return Promise.resolve();
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps API key is missing'));
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    // Check again in case it loaded between checks
    if (window.google?.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      resolve();
    };
    
    script.onerror = () => {
      googleMapsPromise = null; // Reset so it can be retried
      reject(new Error('Failed to load Google Maps'));
    };
    
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
