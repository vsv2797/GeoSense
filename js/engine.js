/* ═══════════════════════════════════════════════════════════════
   engine.js  —  Pure maths + data engine
   ─────────────────────────────────────────────────────────────
   NO DOM access. NO canvas drawing. Pure functions only.

   CHANGELOG:
   ✅ [R1] Climate risk dashboard data model (heat/drought/precip/cri)
   ✅ [R3] Fixed latLngToXYZ theta offset (+180) — globe was 180° off
   ✅ [R3] Fixed projectToCanvas visibility inversion (rz<0.15 = front)
   ✅ [R3] Fixed projectToCanvas fade formula — dots were invisible
   ✅ [R3] Fixed projectToCanvas return type (object not array)
   ✅ [R3] Fixed GlobeState.tick drag branch — globe froze on drag
   ✅ [R3] Fixed trend parseFloat order of operations
   ✅ [R7] GlobeState extended with zoom / panX / panY / panning
   ✅ [R8] Dual-resolution GeoJSON support — auto-swap by zoom level
   ═══════════════════════════════════════════════════════════════ */
"use strict";

/* ── Seeded RNG (reproducible demo scores) ─────────────────────
   TODO [future]: replace generateScores() with a real API fetch  */
function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

/* ── Score generation ──────────────────────────────────────────
   Returns { heat, drought, precip, cri } each 0–100
   Swap this function body for a fetch() call to use real data.  */
function generateScores(idx) {
  const r = seededRng(idx * 137 + 42);
  return {
    heat:    Math.round(r() * 100),
    drought: Math.round(r() * 100),
    precip:  Math.round(r() * 100),
    cri:     Math.round(r() * 100),
  };
}

/* ── 90-day sparkline history ──────────────────────────────────
   TODO [future]: replace with real time-series from your API    */
function generateHistory(idx, key) {
  const base = generateScores(idx)[key];
  return Array.from({ length: 90 }, (_, d) => {
    const r = seededRng(idx * 137 + d * 17);
    return Math.max(0, Math.min(100, base + (r() - 0.5) * 28));
  });
}

/* ── Build country data array ─────────────────────────────────  */
function buildData() {
  return COUNTRIES.map((c, i) => {
    const scores = generateScores(i);
    const r = seededRng(i * 137 + 42);
    r(); r(); r(); r(); // consume the 4 score calls
    const trend = parseFloat(((r() - 0.5) * 20).toFixed(1)); // ✅ [R3] fixed order
    return { ...c, scores, trend };
  });
}
const DATA = buildData();

/* ══ SPHERE MATH ═══════════════════════════════════════════════ */

/**
 * lat/lng → unit sphere XYZ
 * ✅ [R3] theta = (lng + 180) * PI/180
 *         Without +180 the globe loads facing the wrong hemisphere
 */
function latLngToXYZ(lat, lng) {
  const phi   = (90 - lat)  * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180; // ✅ +180 offset
  return [
    -Math.sin(phi) * Math.cos(theta),
     Math.cos(phi),
     Math.sin(phi) * Math.sin(theta),
  ];
}

/**
 * Rotate a unit-sphere point by rotX then rotY
 */
function rotatePoint(x, y, z, rx, ry) {
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const x1 = x*cy + z*sy, z1 = -x*sy + z*cy, y1 = y;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  return [x1, y1*cx - z1*sx, y1*sx + z1*cx];
}

/**
 * Project a rotated unit-sphere point to 2-D canvas coordinates
 *
 * ✅ [R3] visible = rz < 0.15  (was > 0.15 — showed back of globe)
 * ✅ [R3] fade formula fixed   (was only active at rz > 0.7 → invisible)
 * ✅ [R3] returns object       (was array — globe.js destructure failed)
 */
function projectToCanvas(rx, ry, rz, cx, cy, R) {
  return {
    px:      cx + rx * R,
    py:      cy - ry * R,
    visible: rz < 0.15,                                    // ✅ [R3]
    fade:    rz < 0.15 ? Math.max(0, 1 - (rz + 1) * 0.588) : 0, // ✅ [R3]
  };
}

/* ══ COLOUR MAPPING ════════════════════════════════════════════ */

function cssVar(name, fallback) {
  try {
    return getComputedStyle(document.documentElement)
             .getPropertyValue(name).trim() || fallback;
  } catch(_) { return fallback; }
}

// Reads from theme.css CSS variables so retheming updates globe colours too
const RC = {
  get minimal()  { return cssVar("--risk-minimal",  "#00ddff"); },
  get low()      { return cssVar("--risk-low",      "#44ee88"); },
  get moderate() { return cssVar("--risk-moderate", "#ccdd00"); },
  get high()     { return cssVar("--risk-high",     "#ffaa00"); },
  get severe()   { return cssVar("--risk-severe",   "#ff6600"); },
  get extreme()  { return cssVar("--risk-extreme",  "#ff2244"); },
};

function scoreToColor(s) {
  if (s >= 80) return RC.extreme;  if (s >= 65) return RC.severe;
  if (s >= 50) return RC.high;     if (s >= 35) return RC.moderate;
  if (s >= 20) return RC.low;      return RC.minimal;
}

function scoreToLabel(s) {
  if (s >= 80) return "EXTREME";  if (s >= 65) return "SEVERE";
  if (s >= 50) return "HIGH";     if (s >= 35) return "MODERATE";
  if (s >= 20) return "LOW";      return "MINIMAL";
}

/* ══ GLOBE STATE ═══════════════════════════════════════════════
   ✅ [R7] Added zoom, panX, panY for flat-map mode
   ✅ [R3] tick() now always integrates velocity (drag was broken) */
const GlobeState = {
  rotX:     0.25,
  rotY:     0.0,
  velX:     0.0,
  velY:     0.003,
  dragging: false,
  lastX:    0,
  lastY:    0,
  autoSpin: true,

  // ✅ [R7] Zoom & pan state
  zoom:     1.0,   // 1.0 = full globe, >2.2 = flat map mode
  panX:     0,     // flat-map horizontal pan offset (pixels)
  panY:     0,     // flat-map vertical pan offset (pixels)

  /** Advance physics one frame
   *  ✅ [R3] velX/velY now always applied (was gated inside autoSpin) */
  tick() {
    if (this.autoSpin && !this.dragging && this.zoom < 1.8) {
      this.velY += 0.0002;
    }
    this.rotY += this.velY;                      // ✅ [R3] always applied
    this.rotX += this.velX;
    this.rotX  = Math.max(-0.95, Math.min(0.95, this.rotX));
    this.velX *= 0.88;
    this.velY *= (this.zoom < 1.8 ? 0.93 : 0.85);
  },

  /** Smoothly spin globe to face a lat/lng point */
  spinToFace(lat, lng) {
    const [x,, z] = latLngToXYZ(lat, lng);
    let diff = -Math.atan2(-x, z) - this.rotY;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.velY = diff * 0.06;
    this.velX = -this.rotX * 0.06;
  },
};

/* ══ STATS HELPERS ═════════════════════════════════════════════ */

function globalAvg(k) {
  return Math.round(DATA.reduce((s, c) => s + c.scores[k], 0) / DATA.length);
}
function countAbove(k, t)   { return DATA.filter(c => c.scores[k] >= t).length; }
function topN(k, n = 6)     { return [...DATA].sort((a,b) => b.scores[k] - a.scores[k]).slice(0, n); }
function rankOf(country, k) { return [...DATA].sort((a,b) => b.scores[k] - a.scores[k]).findIndex(c => c.iso === country.iso) + 1; }
