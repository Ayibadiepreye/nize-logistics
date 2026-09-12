import express from 'express';
import { db } from '../lib/db/index.js';
import { pricingConfig } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { getDistanceMatrix, getDirections } from '../lib/google-maps.js';

const router = express.Router();

// Calculate delivery price using Google Maps Distance Matrix (public endpoint)
router.post('/calculate', async (req, res, next) => {
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;

    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      return res.status(400).json({ error: 'Pickup and dropoff coordinates are required' });
    }

    const origin = { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) };
    const destination = { lat: parseFloat(dropoffLat), lng: parseFloat(dropoffLng) };

    // Validate coordinates
    if (isNaN(origin.lat) || isNaN(origin.lng) || isNaN(destination.lat) || isNaN(destination.lng)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Get driving distance via Google Maps (falls back to Haversine)
    const distanceData = await getDistanceMatrix(origin, destination);

    // Get pricing config from database
    const [pricing] = await db.select().from(pricingConfig).where(eq(pricingConfig.id, 1));
    const baseFare = parseFloat(pricing?.baseFare || 500);
    const perKmRate = parseFloat(pricing?.perKmRate || 120);
    const minimumFare = parseFloat(pricing?.minimumFare || 1000);

    const totalPrice = Math.max(minimumFare, baseFare + (distanceData.distanceKm * perKmRate));

    // Get route directions (polyline for map rendering)
    const directions = await getDirections(origin, destination);

    res.json({
      distance: {
        km: parseFloat(distanceData.distanceKm.toFixed(2)),
        text: distanceData.distanceText,
      },
      duration: {
        minutes: distanceData.durationMinutes,
        text: distanceData.durationText,
      },
      price: {
        total: parseFloat(totalPrice.toFixed(2)),
        breakdown: {
          baseFare,
          distanceFare: parseFloat((distanceData.distanceKm * perKmRate).toFixed(2)),
          perKmRate,
          minimumFare,
        },
      },
      route: directions ? {
        polyline: directions.polyline,
        startAddress: directions.startAddress,
        endAddress: directions.endAddress,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

// Get current pricing configuration (public)
router.get('/config', async (req, res, next) => {
  try {
    const [pricing] = await db.select().from(pricingConfig).where(eq(pricingConfig.id, 1));

    res.json({
      pricing: {
        baseFare: parseFloat(pricing?.baseFare || 500),
        perKmRate: parseFloat(pricing?.perKmRate || 120),
        minimumFare: parseFloat(pricing?.minimumFare || 1000),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
