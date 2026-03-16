/* ═══════════════════════════════════════════════════════════════
   globe.js  —  Canvas renderer (globe + flat map)
   ─────────────────────────────────────────────────────────────
   CHANGELOG:
   ✅ [R2] Interactive 3D globe with country dots + spikes
   ✅ [R3] resize() uses ctx.setTransform() — no scale accumulation
   ✅ [R3] hitTest() uses explicit xyz[0],xyz[1],xyz[2] — no bad spread
   ✅ [R4] Separated from UI logic — renderer only, no DOM panel touches
   ✅ [R6] Country borders rendered from GeoJSON on sphere surface
   ✅ [R7] Dual mode: globe (zoom<2.2) ↔ flat map (zoom≥2.2)
   ✅ [R7] Pan support in flat-map mode
   ✅ [R7] Globe ocean matches reference Earth photo (deep blue gradient)
   ✅ [R7] Country land fills coloured by risk score on sphere
   ✅ [R7] Auto-stops rotation when zoomed in; resumes on zoom out
   ✅ [R8] Three GeoJSON tiers loaded progressively by zoom level:
           zoom < 2.2  → world-simple.geojson  (610 KB)
           zoom 2.2–4  → world-medium.geojson  (1.4 MB)
           zoom ≥ 4    → world-detail.geojson  (4.3 MB)
   ═══════════════════════════════════════════════════════════════ */
"use strict";

const GlobeRenderer = (() => {

  let canvas, ctx;
  let frame  = 0;
  let metric = "heat";
  let selISO = null;
  let hovered = null;
  let mx = -9999, my = -9999;

  /* ── ✅ [R8] Three-tier GeoJSON resolution system ───────────────
     Each tier is loaded once (lazily) and cached.
     globe.js picks the right tier each frame based on GlobeState.zoom */
  const GeoTiers = {
    simple: { file: "js/world-simple.geojson", minZoom: 0,   maxZoom: 2.2,  data: null, loading: false, loaded: false },
    medium: { file: "js/world-medium.geojson", minZoom: 2.2, maxZoom: 4.0,  data: null, loading: false, loaded: false },
    detail: { file: "js/world-detail.geojson", minZoom: 4.0, maxZoom: 999,  data: null, loading: false, loaded: false },
  };

  /** Load a tier lazily — only fetches when first needed */
  function loadTier(tier) {
    if (tier.loading || tier.loaded) return;
    tier.loading = true;
    fetch(tier.file)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(gj => {
        tier.data    = gj.features || [];
        tier.loaded  = true;
        tier.loading = false;
        console.log(`✅ Loaded ${tier.file} (${tier.data.length} features)`);
      })
      .catch(e => {
        tier.loading = false;
        console.warn(`⚠️  Could not load ${tier.file}:`, e.message);
      });
  }

  /** Return the best available features for the current zoom level.
   *  Triggers a load for the ideal tier; falls back to any loaded tier. */
  function getBorderFeatures() {
    const z = GlobeState.zoom;

    // Determine ideal tier
    let ideal;
    if      (z < 2.2) ideal = GeoTiers.simple;
    else if (z < 4.0) ideal = GeoTiers.medium;
    else              ideal = GeoTiers.detail;

    // Always pre-load simple so globe never shows empty
    loadTier(GeoTiers.simple);

    // Trigger load for ideal tier if not yet loaded
    if (!ideal.loaded) loadTier(ideal);

    // Return ideal data if ready, else fall back to simple
    if (ideal.loaded) return ideal.data;
    if (GeoTiers.simple.loaded) return GeoTiers.simple.data;
    return [];
  }

  /* ── ✅ [R3] Resize — setTransform resets scale, never accumulates */
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w   = canvas.parentElement.offsetWidth;
    const h   = canvas.parentElement.offsetHeight;
    canvas.width        = w * dpr;
    canvas.height       = h * dpr;
    canvas.style.width  = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // ✅ [R3] always resets first
  }

  /* ── Globe radius helper ────────────────────────────────────── */
  function globeR(W, H) { return Math.min(W, H) * 0.39; }

  /* ══ GLOBE MODE DRAWING ════════════════════════════════════════ */

  /** Stars — fixed seed so positions never flicker between frames */
  function drawStars(W, H) {
    const sr = seededRng(7777);
    for (let i = 0; i < 200; i++) {
      ctx.globalAlpha = 0.1 + sr() * 0.5;
      ctx.fillStyle   = "#aac8ff";
      ctx.beginPath();
      ctx.arc(sr() * W, sr() * H, sr() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Thin blue atmosphere rim around the globe */
  function drawAtmosphere(cx, cy, R) {
    const g = ctx.createRadialGradient(cx, cy, R * 0.88, cx, cy, R * 1.32);
    g.addColorStop(0,   "rgba(30,160,255,0)");
    g.addColorStop(0.4, "rgba(30,160,255,0.09)");
    g.addColorStop(1,   "rgba(0,60,200,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.32, 0, Math.PI * 2); ctx.fill();
  }

  /** ✅ [R7] Deep ocean sphere — matches reference Earth photo colour */
  function drawOcean(cx, cy, R) {
    const g = ctx.createRadialGradient(cx - R*0.25, cy - R*0.25, 0, cx, cy, R);
    g.addColorStop(0,   "#1a4a7a");
    g.addColorStop(0.5, "#0d3060");
    g.addColorStop(1,   "#061528");
    ctx.fillStyle   = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(60,180,255,0.25)";
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  }

  /** Faint lat/lng grid lines on sphere */
  function drawGrid(cx, cy, R) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = "rgba(100,200,255,0.06)";
    ctx.lineWidth   = 0.5;

    for (let lat = -75; lat <= 75; lat += 30) {
      ctx.beginPath(); let go = false;
      for (let lng = 0; lng <= 360; lng += 3) {
        const [x,y,z]    = latLngToXYZ(lat, lng);
        const [rx,ry,rz] = rotatePoint(x, y, z, GlobeState.rotX, GlobeState.rotY);
        if (rz > 0.0) { go = false; continue; }
        const px = cx + rx*R, py = cy - ry*R;
        go ? ctx.lineTo(px, py) : ctx.moveTo(px, py); go = true;
      }
      ctx.stroke();
    }
    for (let lng = 0; lng < 360; lng += 30) {
      ctx.beginPath(); let go = false;
      for (let lat = -88; lat <= 88; lat += 3) {
        const [x,y,z]    = latLngToXYZ(lat, lng);
        const [rx,ry,rz] = rotatePoint(x, y, z, GlobeState.rotX, GlobeState.rotY);
        if (rz > 0.0) { go = false; continue; }
        const px = cx + rx*R, py = cy - ry*R;
        go ? ctx.lineTo(px, py) : ctx.moveTo(px, py); go = true;
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** ✅ [R6][R7] Draw country land fills + borders on sphere surface
   *  Uses getBorderFeatures() which picks correct resolution tier     */
  function drawLandOnSphere(cx, cy, R) {
    const features = getBorderFeatures();
    if (!features.length) return;

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();

    features.forEach(feat => {
      const iso  = feat.properties.iso || feat.properties["ISO3166-1-Alpha-3"] || "";
      const geom = feat.geometry;
      if (!geom) return;

      const country    = DATA.find(c => c.iso === iso);
      const score      = country ? country.scores[metric] : null;
      const col        = score !== null ? scoreToColor(score) : "#1e6040";
      const isSelected = iso === selISO;
      const isHov      = hovered && hovered.iso === iso;

      const rings = geom.type === "Polygon"
        ? geom.coordinates
        : geom.type === "MultiPolygon"
          ? geom.coordinates.flat(1) : [];

      rings.forEach(ring => {
        ctx.beginPath();
        let started = false;
        for (const [lng, lat] of ring) {
          const [x,y,z]    = latLngToXYZ(lat, lng);
          const [rx,ry,rz] = rotatePoint(x, y, z, GlobeState.rotX, GlobeState.rotY);
          if (rz > 0.05) { started = false; continue; }
          const px = cx + rx*R, py = cy - ry*R;
          started ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          started = true;
        }
        ctx.closePath();

        // Fill with risk colour
        ctx.globalAlpha = isSelected ? 0.88 : isHov ? 0.72 : 0.55;
        ctx.fillStyle   = score !== null ? col : "#1e5535";
        ctx.fill();

        // Border lines
        ctx.globalAlpha = 1;
        ctx.strokeStyle = isSelected ? "#00e5ff" : isHov ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.22)";
        ctx.lineWidth   = isSelected ? 1.8 : 0.5;
        ctx.stroke();
      });
    });

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Specular highlight — gives sphere a realistic lit look */
  function drawSpecular(cx, cy, R) {
    const sp = ctx.createRadialGradient(
      cx - R*0.42, cy - R*0.4, 0,
      cx - R*0.3,  cy - R*0.3, R * 0.8
    );
    sp.addColorStop(0, "rgba(200,230,255,0.12)");
    sp.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sp;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  }

  /** Country dots + spikes — only drawn at zoom < 2.0 */
  function drawDots(cx, cy, R) {
    const pts = DATA.map(c => {
      const [x,y,z]    = latLngToXYZ(c.lat, c.lng);
      const [rx,ry,rz] = rotatePoint(x, y, z, GlobeState.rotX, GlobeState.rotY);
      const { px, py, fade } = projectToCanvas(rx, ry, rz, cx, cy, R);
      const s   = c.scores[metric];
      return { c, px, py, rz, fade, s,
               col:   scoreToColor(s),
               isSel: selISO === c.iso,
               isHov: hovered && hovered.iso === c.iso };
    }).filter(p => p.fade > 0.01).sort((a, b) => b.rz - a.rz);

    pts.forEach(({ c, px, py, fade, s, col, isSel, isHov }) => {
      const r = 3 + (s / 100) * 10;
      ctx.globalAlpha = fade * 0.9;

      // Pulse glow for high-risk countries
      if (s > 55) {
        const pulse = 0.4 + Math.sin(frame * 0.08 + c.lat * 0.4) * 0.3;
        const gr    = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
        gr.addColorStop(0, col + "66"); gr.addColorStop(1, "transparent");
        ctx.globalAlpha = fade * pulse * 0.45;
        ctx.fillStyle   = gr;
        ctx.beginPath(); ctx.arc(px, py, r*3, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = fade * 0.9;
      }

      // Selection ring
      if (isSel) {
        ctx.strokeStyle = "#00e5ff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, r+7, 0, Math.PI*2); ctx.stroke();
      }
      // Hover ring
      if (isHov && !isSel) {
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, r+4, 0, Math.PI*2); ctx.stroke();
      }

      // Spike (extrusion proportional to score)
      const fac = 1 + (s / 100) * 0.28;
      const [sx,sy,sz] = latLngToXYZ(c.lat, c.lng);
      const [srx,sry,srz] = rotatePoint(sx*fac, sy*fac, sz*fac, GlobeState.rotX, GlobeState.rotY);
      if (srz < 0.18) {
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx+srx*R, cy-sry*R); ctx.stroke();
        ctx.fillStyle   = col;
        ctx.beginPath(); ctx.arc(cx+srx*R, cy-sry*R, 2.5, 0, Math.PI*2); ctx.fill();
      }

      // Main dot
      const dg = ctx.createRadialGradient(px-r*0.3, py-r*0.3, 0, px, py, r);
      dg.addColorStop(0, col+"ff"); dg.addColorStop(1, col+"99");
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();

      // ISO label for selected or extreme-risk countries
      if (isSel || s >= 78) {
        ctx.globalAlpha = fade;
        ctx.fillStyle   = "#fff";
        ctx.font        = `bold ${isSel ? 11 : 9}px monospace`;
        ctx.textAlign   = "center";
        ctx.fillText(c.iso, px, py - r - 4);
      }
      ctx.globalAlpha = 1;
    });

    return pts;
  }

  /* ══ ✅ [R7] FLAT MAP MODE (zoom ≥ 2.2) ════════════════════════
     Equirectangular projection with pan.
     ✅ [R8] Automatically upgrades to higher-res GeoJSON as zoom > 4 */

  /** Convert lng/lat to flat-map canvas pixel */
  function lngLatToMap(lng, lat, W, H) {
    const scale = GlobeState.zoom * Math.min(W, H) * 0.39;
    const cx    = W/2 + GlobeState.panX;
    const cy    = H/2 + GlobeState.panY;
    return [cx + (lng/180)*scale, cy - (lat/90)*scale*0.5];
  }

  function drawFlatMap(W, H) {
    const { zoom, panX, panY } = GlobeState;
    const scale = zoom * Math.min(W, H) * 0.39;
    const cx    = W/2 + panX;
    const cy    = H/2 + panY;

    // Ocean background
    ctx.fillStyle = "#061a35";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "rgba(100,200,255,0.06)"; ctx.lineWidth = 0.5;
    for (let lat = -90; lat <= 90; lat += 30) {
      const y = cy - (lat/90)*scale*0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let lng = -180; lng <= 180; lng += 30) {
      const x = cx + (lng/180)*scale;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    const features = getBorderFeatures(); // ✅ [R8] picks right tier by zoom
    if (!features.length) {
      ctx.fillStyle = "#00e5ff44"; ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Loading map data…", W/2, H/2);
    }

    features.forEach(feat => {
      const iso     = feat.properties.iso || feat.properties["ISO3166-1-Alpha-3"] || "";
      const geom    = feat.geometry;
      if (!geom) return;

      const country    = DATA.find(c => c.iso === iso);
      const score      = country ? country.scores[metric] : null;
      const isSelected = iso === selISO;
      const isHov      = hovered && hovered.iso === iso;

      const rings = geom.type === "Polygon"
        ? geom.coordinates
        : geom.type === "MultiPolygon"
          ? geom.coordinates.flat(1) : [];

      rings.forEach(ring => {
        ctx.beginPath();
        ring.forEach(([lng, lat], i) => {
          const x = cx + (lng/180)*scale;
          const y = cy - (lat/90)*scale*0.5;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.closePath();

        ctx.globalAlpha = isSelected ? 0.9 : isHov ? 0.78 : 0.58;
        ctx.fillStyle   = score !== null ? scoreToColor(score) : "#1e5535";
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = isSelected ? "#00e5ff" : isHov ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)";
        ctx.lineWidth   = isSelected ? 2 : zoom >= 4 ? 0.8 : 0.5;
        ctx.stroke();
      });

      // Country labels at zoom ≥ 3.5
      if (zoom >= 3.5 && country && score !== null) {
        const [lx, ly] = lngLatToMap(country.lng, country.lat, W, H);
        if (lx > 0 && lx < W && ly > 0 && ly < H) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle   = "#fff";
          ctx.font        = `bold ${Math.min(13, zoom*2.2)}px monospace`;
          ctx.textAlign   = "center";
          ctx.fillText(country.iso, lx, ly);
          ctx.fillStyle = scoreToColor(score);
          ctx.font      = `${Math.min(11, zoom*1.8)}px monospace`;
          ctx.fillText(score, lx, ly + 14);
        }
      }
      ctx.globalAlpha = 1;
    });

    // Dots on map
    const pts = [];
    DATA.forEach(c => {
      const [px, py] = lngLatToMap(c.lng, c.lat, W, H);
      if (px < -20 || px > W+20 || py < -20 || py > H+20) return;
      const s   = c.scores[metric];
      const col = scoreToColor(s);
      const r   = Math.max(3, 3 + (s/100) * 7);
      const isSel = selISO === c.iso;
      const isHov = hovered && hovered.iso === c.iso;

      if (isSel) {
        ctx.strokeStyle = "#00e5ff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, r+8, 0, Math.PI*2); ctx.stroke();
      }
      if (isHov && !isSel) {
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, r+5, 0, Math.PI*2); ctx.stroke();
      }

      const dg = ctx.createRadialGradient(px-r*0.3, py-r*0.3, 0, px, py, r);
      dg.addColorStop(0, col+"ff"); dg.addColorStop(1, col+"aa");
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();

      pts.push({ c, px, py, s });
    });

    return pts;
  }

  /* ══ MAIN RENDER LOOP ══════════════════════════════════════════ */
  let lastPts = [];

  function render() {
    requestAnimationFrame(render);
    frame++;
    GlobeState.tick();

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;

    ctx.clearRect(0, 0, W, H);

    if (GlobeState.zoom < 2.2) {
      // ── GLOBE MODE ──────────────────────────────────────────
      const cx = W/2, cy = H/2;
      const R  = globeR(W, H) * GlobeState.zoom;

      ctx.fillStyle = "#04080f";
      ctx.fillRect(0, 0, W, H);

      drawStars(W, H);
      drawAtmosphere(cx, cy, R);
      drawOcean(cx, cy, R);
      drawGrid(cx, cy, R);
      drawLandOnSphere(cx, cy, R);
      drawSpecular(cx, cy, R);
      lastPts = drawDots(cx, cy, R);

    } else {
      // ── FLAT MAP MODE ────────────────────────────────────────
      lastPts = drawFlatMap(W, H);
    }

    hovered = findHovered(lastPts);
  }

  function findHovered(pts) {
    const hitR = GlobeState.zoom >= 2.2 ? 20 : 24;
    let best = null, bestD = hitR;
    pts.forEach(p => {
      const d = Math.hypot(mx - p.px, my - p.py);
      if (d < bestD) { bestD = d; best = p.c; }
    });
    return best;
  }

  /* ══ PUBLIC API ════════════════════════════════════════════════ */
  return {
    init(el) {
      canvas = el;
      ctx    = el.getContext("2d");
      resize();
      window.addEventListener("resize", resize);
      // Pre-load the globe tier immediately; others load on demand
      loadTier(GeoTiers.simple);
      render();
    },

    setMetric(k)   { metric = k; },
    setSelected(i) { selISO = i; },
    getHovered()   { return hovered; },
    setMouse(x, y) { mx = x; my = y; },
    clearMouse()   { mx = -9999; my = -9999; },
    isMapMode()    { return GlobeState.zoom >= 2.2; },

    /** ✅ [R3] hitTest with explicit xyz[0..2] — no bad array spread */
    hitTest(x, y, W, H) {
      if (GlobeState.zoom >= 2.2) {
        // Flat map hit test
        const scale = GlobeState.zoom * Math.min(W,H) * 0.39;
        const cx    = W/2 + GlobeState.panX;
        const cy    = H/2 + GlobeState.panY;
        let best = null, bestD = 22;
        DATA.forEach(c => {
          const px = cx + (c.lng/180)*scale;
          const py = cy - (c.lat/90)*scale*0.5;
          const d  = Math.hypot(x-px, y-py);
          if (d < bestD) { bestD = d; best = c; }
        });
        return best;
      } else {
        // Sphere hit test
        const R  = globeR(W,H) * GlobeState.zoom;
        const cx = W/2, cy = H/2;
        let best = null, bestD = 26;
        DATA.forEach(c => {
          const xyz = latLngToXYZ(c.lat, c.lng);          // [x,y,z]
          const rot = rotatePoint(                          // ✅ [R3] explicit
            xyz[0], xyz[1], xyz[2],
            GlobeState.rotX, GlobeState.rotY
          );
          if (rot[2] >= 0.15) return; // back of globe
          const px = cx + rot[0]*R, py = cy - rot[1]*R;
          const d  = Math.hypot(x-px, y-py);
          if (d < bestD) { bestD = d; best = c; }
        });
        return best;
      }
    },
  };

})();
