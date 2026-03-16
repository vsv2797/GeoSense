/* ═══════════════════════════════════════════════════════════════
   main.js  —  Entry point. Boots everything in correct order.
   ─────────────────────────────────────────────────────────────
   Load order:  data.js → engine.js → globe.js → ui.js → main.js
   ─────────────────────────────────────────────────────────────
   CHANGELOG:
   ✅ [R4]  Single entry point — only file that imports all others
   ✅ [R8]  Zoom badge updates every 100ms showing current mode
            and which GeoJSON resolution tier is active
   ═══════════════════════════════════════════════════════════════ */
"use strict";

(function bootstrap() {

  const canvas = document.getElementById("globe");
  if (!canvas) { console.error("ClimateRisk: #globe canvas not found."); return; }

  // 1. Start renderer (begins animation loop + loads world-simple.geojson)
  GlobeRenderer.init(canvas);

  // 2. Build UI panels and wire all events
  UI.init(canvas);

  // 3. ✅ [R8] Zoom badge — updates mode label + active resolution tier
  const badge = document.getElementById("zoom-badge");
  if (badge) {
    setInterval(() => {
      const z = GlobeState.zoom;
      if (z < 2.2) {
        badge.textContent = "🌍 Globe — scroll to zoom in";
        badge.style.color = "#00e5ff";
      } else if (z < 4.0) {
        badge.textContent = "🗺️ Map View — drag to pan";
        badge.style.color = "#00ff88";
      } else {
        badge.textContent = "🔍 Detail View — high-res borders active";
        badge.style.color = "#ffaa00";
      }
    }, 100);
  }

  // Dev info
  console.log("%cClimateRisk.live", "color:#00e5ff;font-size:16px;font-weight:bold;");
  console.log(`%c${DATA.length} countries · ${METRICS.length} metrics · 3-tier GeoJSON`, "color:#445566;");

})();
