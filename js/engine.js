// engine-3.js - FIXED VERSION
// ClimateRisk.live - Global Climate Intelligence Engine
// FIXED: Proper globe orientation, realistic rotation speed

'use strict';

// Seeded pseudo-random (reproducible demo data)
// Replace generateScores() with a real API call when ready.
function seededRng(seed) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Score generation (TODO: swap this for a fetch to your real data endpoint)
// Expected shape: { heat, drought, precip, cri } 0-100 each
function generateScores(countryIndex) {
  const r = seededRng(countryIndex * 137 + 42);
  return {
    heat: Math.round(r() * 100),
    drought: Math.round(r() * 100),
    precip: Math.round(r() * 100),
    cri: Math.round(r() * 100),
  };
}

// Historical sparkline data (90 days) - TODO replace with real time-series
function generateHistory(countryIndex, metricKey) {
  const base = generateScores(countryIndex)[metricKey];
  return Array.from({ length: 90 }, (_, d) => {
    const r = seededRng(countryIndex * 137 + d * 17);
    return Math.max(0, Math.min(100, base + (r() - 0.5) * 28));
  });
}

// Build the full DATA array - Merges COUNTRIES from data.js with computed scores
function buildData() {
  return COUNTRIES.map((c, i) => {
    const scores = generateScores(i);
    const r = seededRng(i * 137 + 42);
    r(); r(); r(); r(); // advance past the four score calls
    const trend = parseFloat((r() - 0.5) * 20).toFixed(1);
    return { ...c, scores, trend };
  });
}

const DATA = buildData();

// GLOBE MATHS
// Convert geographic coordinates to a unit sphere XYZ vector
// param: number lat (-90...90), lng (-180...180)
// returns: [number,number,number] x,y,z
function latLngToXYZ(lat, lng) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = lng * Math.PI / 180;
  return [
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  ];
}

// Rotate a point on the unit sphere by rotX then rotY
// returns: [number,number,number] rotated x,y,z
function rotatePoint(x, y, z, rotX, rotY) {
  // Rotate around Y axis
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  const x1 = x * cosY + z * sinY;
  const z1 = -x * sinY + z * cosY;
  const y1 = y;
  
  // Rotate around X axis
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;
  
  return [x1, y2, z2];
}

// Project a rotated unit-sphere point to 2-D canvas space
// param: rx,ry,rz (rotated), cx,cy (canvas centre), R (globe radius px)
// returns: px,py,fade,visible
function projectToCanvas(rx, ry, rz, cx, cy, R) {
  const px = cx + rx * R;
  const py = cy - ry * R;
  const visible = rz > 0.15;
  const fade = visible ? Math.max(0, 1 - Math.max(0, (rz - 0.7) / 0.3)) : 0;
  return [px, py, fade, visible];
}

// COLOUR MAPPING
// Map a 0-100 risk score to a hex colour string (reads CSS vars)
const RISKCOLORS = {
  get minimal() { return cssVar('--risk-minimal', '#00ddff'); },
  get low() { return cssVar('--risk-low', '#44ee88'); },
  get moderate() { return cssVar('--risk-moderate', '#ccdd00'); },
  get high() { return cssVar('--risk-high', '#ffaa00'); },
  get severe() { return cssVar('--risk-severe', '#ff6600'); },
  get extreme() { return cssVar('--risk-extreme', '#ff2244'); },
};

function cssVar(name, fallback) {
  if (typeof getComputedStyle === 'undefined') return fallback;
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim() || fallback;
}

function scoreToColor(score) {
  if (score >= 80) return RISKCOLORS.extreme;
  if (score >= 65) return RISKCOLORS.severe;
  if (score >= 50) return RISKCOLORS.high;
  if (score >= 35) return RISKCOLORS.moderate;
  if (score >= 20) return RISKCOLORS.low;
  return RISKCOLORS.minimal;
}

function scoreToLabel(score) {
  if (score >= 80) return 'EXTREME';
  if (score >= 65) return 'SEVERE';
  if (score >= 50) return 'HIGH';
  if (score >= 35) return 'MODERATE';
  if (score >= 20) return 'LOW';
  return 'MINIMAL';
}

// ROTATION STATE - ✅ FIXED: Proper orientation + realistic speed
const GlobeState = {
  rotX: 0.15,     // ✅ Natural tilt (was 0.3 = sideways)
  rotY: 0.0,
  velX: 0.0,
  velY: 0.0008,   // ✅ Earth-realistic (~2min/revolution)
  dragging: false,
  lastX: 0,
  lastY: 0,
  autoSpin: true,
};

// FIXED: Realistic constant-speed rotation (no acceleration)
GlobeState.tick = function() {
  if (this.autoSpin && !this.dragging) {
    this.velY = 0.0008;  // ✅ Constant speed (no += accel)
    this.rotY += this.velY;
    this.rotX += this.velX * 0.92;  // Gentle damping
    this.rotX = Math.max(-0.35, Math.min(0.35, this.rotX)); // ✅ Tighter tilt clamp
    this.velX *= 0.95;
    this.velY *= 0.995;  // Near-constant
  }
};

// Spin the globe to face a geographic point
GlobeState.spinToFace = function(lat, lng) {
  const [x, , z] = latLngToXYZ(lat, lng);
  const target = -Math.atan2(-x, z);
  let diff = target - this.rotY;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  this.velY = diff * 0.045;
};

// STATS HELPERS
function globalAvg(metricKey) {
  const total = DATA.reduce((s, c) => s + c.scores[metricKey], 0);
  return Math.round(total / DATA.length);
}

function countAbove(metricKey, threshold) {
  return DATA.filter(c => c.scores[metricKey] >= threshold).length;
}

function topN(metricKey, n = 6) {
  return [...DATA]
    .sort((a, b) => b.scores[metricKey] - a.scores[metricKey])
    .slice(0, n);
}

function rankOf(country, metricKey) {
  return [...DATA]
    .sort((a, b) => b.scores[metricKey] - a.scores[metricKey])
    .findIndex(c => c.iso === country.iso) + 1;
}
