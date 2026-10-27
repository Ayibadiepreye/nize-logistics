# Self-hosted routing (our own OSRM engine)

This is the runbook for replacing the public OSRM demo
(`router.project-osrm.org`) with our own routing server. Doing so fixes the two
things the demo can't: **accuracy in Nigeria** (the demo's extract is weak
outside Europe) and **reliability** (it is rate-limited and shared).

## Why this is not on the free Render tier

OSRM loads the whole road graph into RAM and must stay up to answer. Render's
**free** web service spins down after ~15 min of no traffic, so it cannot hold
an OSRM process alive. You need a box that stays on 24/7:

- **Cheapest:** a small VPS (Hetzner CX21, Clouding, DigitalOcean basic) —
  ~€4–6 / month, 2–4 GB RAM. Nigeria's extract fits comfortably.
- **Or** Render's *paid* web plan ($7/mo) with a fixed instance — workable but
  pricier per GB than a VPS.

The app already switches to it with **one env var, `OSRM_URL`** — no code
change, and the route cache + live rerouting keep working against it.

## One-time setup on the VPS (Ubuntu 22.04, ~2 GB RAM)

```bash
sudo apt-get update && sudo apt-get -y install docker.io
sudo systemctl enable --now docker

mkdir -p /opt/osrm && cd /opt/osrm

# 1) Download the OSM extract. Nigeria first; if coverage looks thin in a city,
#    use the wider West Africa extract instead and re-run the two commands below.
#    Geofabrik: https://download.geofabrik.de/africa.html
curl -OJL https://download.geofabrik.de/africa/nigeria-latest.osm.pbf

# 2) Extract the road network (car profile).
docker run -t -v "$PWD:/data" -p 5000:5000 osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/nigeria-latest.osm.pbf

# 3) Build the routing graph.
docker run -t -v "$PWD:/data" -p 5000:5000 osrm/osrm-backend \
  osrm-process /data/nigeria-latest.osrm

# 4) Serve it (this is what the app will hit).
docker run -d --name osrm -p 5000:5000 -v "$PWD:/data" \
  --restart always osrm/osrm-backend osrm-routed --algorithm mld /data/nigeria-latest.osrm
```

Test it from the VPS:

```bash
curl "http://127.0.0.1:5000/route/v1/driving/7.0498,4.8156;7.062,4.825?overview=full&geometries=geojson"
```

A route with `distance` and `duration` = it's live.

## Point the backend at it

Set on the backend's environment (Render env var, or the VPS's `.env`):

```
OSRM_URL=http://<your-vps-ip>:5000
```

Restart the backend. `/health` will then report `"routing":"osrm-selfhosted"`,
and both the route cache and the rider live-route will use it.

## Keep the map fresh (optional, quarterly)

```bash
cd /opt/osrm
curl -OJL https://download.geofabrik.de/africa/nigeria-latest.osm.pbf
docker stop osrm
docker rm osrm
# re-run osrm-extract, osrm-process, osrm-routed from above
```

## Notes

- The app's plausibility guard (`lib/routing.js` → `isPlausible`) still runs, so
  a bad self-hosted answer is caught and falls back to the straight-line
  estimate rather than trusted blindly.
- For production hardening put OSRM behind the same host as the API or a
  reverse proxy, and don't expose port 5000 to the whole internet if you can
  avoid it (bind it and reach it over the private/LAN network, or a tunnel).
- The route cache TTL (24 h) and the live-route recompute are unchanged — they
  simply get faster and uncapped because the engine is local now.
