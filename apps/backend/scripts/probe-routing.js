/**
 * Real-behaviour probe for the OSM routing layer.
 *
 * Runs against the live public OSRM server and prints what actually came back,
 * including whether the plausibility guard caught a bad answer.
 *
 *   node scripts/probe-routing.js
 */
import { resolveRoute, straightLineKm } from '../src/lib/routing.js';

const CASES = [
  { name: 'PH centre -> Airport', from: { lat: 4.8156, lng: 7.0498 }, to: { lat: 4.8748, lng: 7.0083 } },
  { name: 'PH -> Mall area', from: { lat: 4.8156, lng: 7.0498 }, to: { lat: 4.7900, lng: 7.0300 } },
  { name: 'Ikeja -> MMIA (known bad)', from: { lat: 6.6018, lng: 3.3515 }, to: { lat: 6.5774, lng: 3.3212 } },
  { name: 'Isiokpo -> PH (known bad)', from: { lat: 4.9700, lng: 7.0000 }, to: { lat: 4.8156, lng: 7.0498 } },
  { name: 'Lagos island -> Lekki', from: { lat: 6.4541, lng: 3.4247 }, to: { lat: 6.4365, lng: 3.4513 } },
  { name: 'Wigwe Univ -> PH', from: { lat: 4.9700, lng: 7.0000 }, to: { lat: 4.8156, lng: 7.0498 } },
];

console.log('OSRM endpoint:', process.env.OSRM_URL || 'https://router.project-osrm.org');
console.log('='.repeat(96));
console.log(
  'ROUTE'.padEnd(30),
  'STRAIGHT'.padStart(9),
  'RESULT'.padStart(9),
  'TIME'.padStart(7),
  'SRC'.padStart(8)
);
console.log('-'.repeat(96));

for (const c of CASES) {
  const straight = straightLineKm(c.from, c.to);
  const r = await resolveRoute(c.from, c.to);
  console.log(
    c.name.slice(0, 29).padEnd(30),
    `${straight.toFixed(1)}km`.padStart(9),
    `${r.distanceKm.toFixed(1)}km`.padStart(9),
    `${r.durationMinutes}m`.padStart(7),
    r.source.padStart(8)
  );
  if (r.note) console.log('    ↳ ' + r.note);
}

console.log('='.repeat(96));
console.log('geometry types returned:');
for (const c of CASES.slice(0, 3)) {
  const r = await resolveRoute(c.from, c.to);
  console.log(
    `  ${c.name.slice(0, 26).padEnd(26)} ${r.geometry ? r.geometry.type : 'null'}` +
      ` coords=${r.geometry?.coordinates?.length ?? 0}`
  );
}
