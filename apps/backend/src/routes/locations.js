import express from 'express';
import { db } from '../lib/db/index.js';
import { locations } from '../lib/db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { encodePlusCode, isValidPlusCode, decodePlusCode } from '../lib/plusCode.js';
import { latSchema, lngSchema } from '../lib/validate.js';

const router = express.Router();

/**
 * Place cache.
 *
 * Nigeria has almost no machine-readable address data, so the platform keeps its
 * own record of every place a customer or rider has ever pinned. That cache is
 * the company's own map, and it is the one asset a competitor cannot copy.
 *
 *   POST /api/locations   save a place (customer pin, rider capture, or admin entry)
 *   GET  /api/locations   list places, most-used first
 *   GET  /api/locations/:id
 *   POST /api/locations/:id/use   record that an order used this place
 */

/** A Plus Code is 10 characters (~14 m). Longer codes are accepted and trimmed. */
const PLUS_CODE_LENGTH = 10;

const saveLocationSchema = {
  label: { required: true, min: 2, max: 120 },
  lat: { required: true },
  lng: { required: true },
  plusCode: { required: false },
  source: { required: false },
};

/**
 * Validate and normalise a place payload.
 * Returns { ok, value, error }.
 */
function parsePlace(body) {
  const label = String(body?.label ?? '').trim();
  if (label.length < saveLocationSchema.label.min) {
    return { ok: false, error: 'Give this place a short name' };
  }
  if (label.length > saveLocationSchema.label.max) {
    return { ok: false, error: 'That name is too long' };
  }

  let lat;
  let lng;
  try {
    lat = latSchema.parse(body?.lat);
    lng = lngSchema.parse(body?.lng);
  } catch {
    return { ok: false, error: 'Valid latitude and longitude are required' };
  }

  // Derive the code from the coordinates when the caller did not supply one.
  // This is the normal path: the customer drops a pin and the code is computed.
  let plusCode = body?.plusCode ? String(body.plusCode).trim().toUpperCase() : null;
  if (plusCode && !isValidPlusCode(plusCode)) {
    return { ok: false, error: 'That does not look like a valid location code' };
  }
  if (!plusCode) {
    plusCode = encodePlusCode(lat, lng, PLUS_CODE_LENGTH);
  }

  const source = ['customer', 'rider', 'admin'].includes(body?.source)
    ? body.source
    : 'customer';

  return { ok: true, value: { label, lat, lng, plusCode, source } };
}

/**
 * POST /api/locations
 *
 * Save a place. Anonymous by design: a customer placing an order has no account,
 * and the sender is often the person who needs to save the address.
 */
router.post('/', async (req, res, next) => {
  try {
    const parsed = parsePlace(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const { label, lat, lng, plusCode, source } = parsed.value;

    // The same coordinates already saved are returned rather than duplicated, so
    // repeated pinning of the same gate does not pile up rows.
    const existing = await db
      .select()
      .from(locations)
      .where(eq(locations.plusCode, plusCode))
      .limit(1);

    if (existing[0]) {
      return res.json({
        location: {
          id: existing[0].id,
          label: existing[0].label,
          plusCode: existing[0].plusCode,
          lat: parseFloat(existing[0].lat),
          lng: parseFloat(existing[0].lng),
          source: existing[0].source,
          useCount: existing[0].useCount,
        },
        existing: true,
      });
    }

    const [created] = await db
      .insert(locations)
      .values({
        label,
        plusCode,
        lat: lat.toFixed(7),
        lng: lng.toFixed(7),
        source,
        createdById: req.user?.id ?? null,
      })
      .returning();

    res.status(201).json({
      location: {
        id: created.id,
        label: created.label,
        plusCode: created.plusCode,
        lat: parseFloat(created.lat),
        lng: parseFloat(created.lng),
        source: created.source,
        useCount: created.useCount,
      },
      existing: false,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/locations
 *
 * The place cache, most-used first. Used to offer "places you have used before"
 * in the booking form, which is the rider flywheel surfacing itself.
 *
 * Query: ?q= searches labels, ?limit= caps results (default 50, max 200).
 */
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const q = String(req.query.q ?? '').trim();

    const rows = q
      ? await db
          .select()
          .from(locations)
          .where(sql`${locations.label} ILIKE ${'%' + q + '%'}`)
          .orderBy(desc(locations.useCount), desc(locations.lastUsedAt))
          .limit(limit)
      : await db
          .select()
          .from(locations)
          .orderBy(desc(locations.useCount), desc(locations.lastUsedAt))
          .limit(limit);

    res.json({
      locations: rows.map((r) => ({
        id: r.id,
        label: r.label,
        plusCode: r.plusCode,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lng),
        source: r.source,
        useCount: r.useCount,
        lastUsedAt: r.lastUsedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/locations/resolve?code=…
 *
 * Decode a Plus Code to coordinates. Lets a customer paste a code a rider or
 * dispatcher read out to them, without any geocoding service.
 *
 * Declared BEFORE `GET /:id` on purpose: Express matches in registration order,
 * so a literal path must be registered ahead of the parameterised one or it is
 * swallowed as an id.
 */
router.get('/resolve', async (req, res, next) => {
  try {
    const code = String(req.query.code ?? '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ error: 'A location code is required' });
    }

    const decoded = decodePlusCode(code);
    if (!decoded.valid) {
      return res.status(400).json({ error: 'That does not look like a valid location code' });
    }

    res.json({
      location: {
        plusCode: code,
        lat: decoded.lat,
        lng: decoded.lng,
        precisionMeters: 14,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/locations/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, req.params.id))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: 'Place not found' });
    }

    res.json({
      location: {
        id: row.id,
        label: row.label,
        plusCode: row.plusCode,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        source: row.source,
        useCount: row.useCount,
        lastUsedAt: row.lastUsedAt,
        createdAt: row.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/locations/:id/use
 *
 * Record that an order used this place, and bump its use count. This is what
 * makes the cache into a map: the places that actually get delivered to rise to
 * the top and are offered back to the next customer.
 */
router.post('/:id/use', async (req, res, next) => {
  try {
    const [row] = await db
      .update(locations)
      .set({
        useCount: sql`${locations.useCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(locations.id, req.params.id))
      .returning();

    if (!row) {
      return res.status(404).json({ error: 'Place not found' });
    }

    res.json({
      location: {
        id: row.id,
        label: row.label,
        plusCode: row.plusCode,
        useCount: row.useCount,
        lastUsedAt: row.lastUsedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
