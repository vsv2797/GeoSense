# 🌍 GeoSense — Climate Change visualization platform

**Live Demo:** [vsv2797.github.io/climate_change-app](https://vsv2797.github.io/climate_change-app)

---

## Why This Project Exists

Climate change is one of the defining challenges of our time, but for most people it remains abstract — numbers in a report, graphs in a paper. This project started from a simple frustration: there are incredible datasets out there on air quality, temperature anomalies, and atmospheric pollution, but very few tools that make them feel *real* and *immediate* to a general audience.

GeoSense is an attempt to bridge that gap. It's a browser-based, zero-installation intelligence platform that lets you explore the state of the planet in three dimensions — from country-level air pollution and climate risk indices to live Earth-observation satellites actively scanning the planet from orbit.

The project is built entirely from web technologies with no backend server required. Everything runs in the browser, which means anyone with a link can open it instantly. For a geoinformatics student, it was also a useful exercise in combining spatial data, real-time APIs, and 3D rendering into something meaningful.

---

## What It Does

The platform is split into three views:

**1. Climate Risk Globe (`index.html`)**
An interactive 3D Earth rendered with a blue-marble texture and a rotating cloud layer. Countries are shaded by climate metrics including PM2.5 particulate matter, PM10 pollutants, Carbon Monoxide (CO), Nitrogen Dioxide (NO₂), and a temperature index. You can rotate, zoom, and click any country to inspect its readings. The globe auto-rotates and the atmosphere glows with a light-blue tint to give a sense of scale.

**2. Pulse Dashboard (`climate.html`)**
A choropleth-style dashboard showing country-level climate scores on a WebGL globe. The left panel shows a ranked list of critical impact zones and global aggregate statistics. Clicking a country opens a detailed inspector panel on the right showing live local weather fetched from an external API, a multivariate telemetry breakdown, and a global impact rank.

**3. Orbital Tracker (`orbital.html`)**
A live satellite tracker that fetches real Two-Line Element (TLE) data from CelesTrak and plots the current positions of Earth observation satellites in real time around the globe. You can filter between Optical and Radar (SAR) sensor types. Clicking a satellite shows its live orbital velocity, altitude, inclination, orbital period, a ground coverage footprint ring, and the full orbital trajectory path — all pulled and computed live. Wikipedia summaries for satellites like Sentinel-1, Sentinel-2, Landsat 8/9, and RADARSAT are fetched automatically.

---

## How to Run It Locally

Since this is a fully static project with no npm, build step, or server dependency, running it locally takes about 30 seconds.

### Option 1 — VS Code Live Server (recommended)

1. Clone or download the repository:
   ```bash
   git clone https://github.com/vsv2797/climate_change-app.git
   cd climate_change-app
   ```
2. Open the folder in any IDE.
3. Install the **Live Server** extension (by Ritwick Dey) from the Extensions panel.
4. Right-click `index.html` and select **"Open with Live Server"**.
5. Your browser will open at `http://127.0.0.1:5500/index.html`.

> The Orbital Tracker fetches live TLE data from CelesTrak. This requires an active internet connection and will not work if you open the HTML file directly as a `file://` URL due to browser CORS restrictions. Live Server sidesteps this.

### Option 2 — Python HTTP Server

```bash
git clone https://github.com/vsv2797/climate_change-app.git
cd climate_change-app
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.
