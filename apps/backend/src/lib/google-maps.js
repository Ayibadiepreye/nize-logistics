import axios from 'axios';

const API_KEY = () => process.env.GOOGLE_MAPS_API_KEY;

/**
 * Get driving distance and duration between two points using Google Distance Matrix API.
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @returns {Promise<{ distanceKm: number, durationMinutes: number, distanceText: string, durationText: string }>}
 */
export async function getDistanceMatrix(origin, destination) {
  const key = API_KEY();
  if (!key) {
    console.warn('⚠️  GOOGLE_MAPS_API_KEY not set — falling back to Haversine');
    return haversineFallback(origin, destination);
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        origins: `${origin.lat},${origin.lng}`,
        destinations: `${destination.lat},${destination.lng}`,
        mode: 'driving',
        units: 'metric',
        key,
      },
    });

    const data = response.data;

    if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
      console.warn('Distance Matrix API error:', data.status);
      return haversineFallback(origin, destination);
    }

    const element = data.rows[0].elements[0];

    if (element.status !== 'OK') {
      console.warn('Distance Matrix element error:', element.status);
      return haversineFallback(origin, destination);
    }

    return {
      distanceKm: element.distance.value / 1000,
      durationMinutes: Math.ceil(element.duration.value / 60),
      distanceText: element.distance.text,
      durationText: element.duration.text,
    };
  } catch (error) {
    console.error('Distance Matrix API error:', error.message);
    return haversineFallback(origin, destination);
  }
}

/**
 * Get directions (route polyline) between two points using Google Directions API.
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @returns {Promise<{ polyline: string, distanceKm: number, durationMinutes: number, steps: Array } | null>}
 */
export async function getDirections(origin, destination) {
  const key = API_KEY();
  if (!key) {
    return null;
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: 'driving',
        units: 'metric',
        key,
      },
    });

    const data = response.data;

    if (data.status !== 'OK' || !data.routes?.[0]) {
      console.warn('Directions API error:', data.status);
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    return {
      polyline: route.overview_polyline.points,
      distanceKm: leg.distance.value / 1000,
      durationMinutes: Math.ceil(leg.duration.value / 60),
      distanceText: leg.distance.text,
      durationText: leg.duration.text,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      steps: leg.steps.map(step => ({
        instruction: step.html_instructions,
        distance: step.distance.text,
        duration: step.duration.text,
      })),
    };
  } catch (error) {
    console.error('Directions API error:', error.message);
    return null;
  }
}

/**
 * Geocode an address to lat/lng using Google Geocoding API.
 * @param {string} address
 * @returns {Promise<{ lat: number, lng: number, formattedAddress: string } | null>}
 */
export async function geocodeAddress(address) {
  const key = API_KEY();
  if (!key) {
    return null;
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address,
        region: 'ng',
        key,
      },
    });

    const data = response.data;

    if (data.status !== 'OK' || !data.results?.[0]) {
      return null;
    }

    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    };
  } catch (error) {
    console.error('Geocoding API error:', error.message);
    return null;
  }
}

/**
 * Reverse geocode lat/lng to address using Google Geocoding API.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ formattedAddress: string, placeId: string } | null>}
 */
export async function reverseGeocode(lat, lng) {
  const key = API_KEY();
  if (!key) {
    return null;
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        latlng: `${lat},${lng}`,
        key,
      },
    });

    const data = response.data;

    if (data.status !== 'OK' || !data.results?.[0]) {
      return null;
    }

    const result = data.results[0];
    return {
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    };
  } catch (error) {
    console.error('Reverse Geocoding API error:', error.message);
    return null;
  }
}

/**
 * Haversine fallback for distance calculation when Google Maps API is unavailable.
 */
function haversineFallback(origin, destination) {
  const R = 6371;
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
  const dLon = ((destination.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.cos((destination.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;

  // Estimate driving time: ~30 km/h average in Nigerian city traffic
  const durationMinutes = Math.ceil((distanceKm / 30) * 60);

  return {
    distanceKm,
    durationMinutes,
    distanceText: `${distanceKm.toFixed(1)} km`,
    durationText: `${durationMinutes} mins`,
  };
}
