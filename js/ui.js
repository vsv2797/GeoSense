/* ═══════════════════════════════════════════════════════════════
   ui.js  —  DOM builders, panel updates, all event handlers
   ─────────────────────────────────────────────────────────────
   CHANGELOG:
   ✅ [R1]  Metric selector buttons (heat/drought/precip/cri)
   ✅ [R1]  Right detail panel with score, trend, sparkline, rank
   ✅ [R4]  Pure UI layer — no canvas math, reads engine.js helpers
   ✅ [R5]  GitHub Pages compatible (no framework dependencies)
   ✅ [R7]  Scroll-to-zoom: globe ↔ flat map transition
   ✅ [R7]  Pan in flat-map mode (drag pans map, not rotates globe)
   ✅ [R7]  Touch: pinch-to-zoom + single-finger drag
   ✅ [R7]  Auto-spin stops on zoom-in, resumes on zoom-out
   ✅ [R8]  Zoom badge shows current mode + tier loading status
   ═══════════════════════════════════════════════════════════════ */
"use strict";

const UI = (() => {

  let currentMetric   = "heat";
  let selectedCountry = null;

  /* ══ METRIC BUTTONS ════════════════════════════════════════════ */

  function buildMetricButtons() {
    const el = document.getElementById("metric-buttons");
    if (!el) return;
    el.innerHTML = "";

    METRICS.forEach(m => {
      const avg = globalAvg(m.key);
      const btn = document.createElement("button");
      btn.className = "idx-btn";
      btn.id        = "mb-" + m.key;
      btn.innerHTML = `
        <span class="idx-icon">${m.icon}</span>
        <div class="idx-info">
          <div class="idx-label">${m.label}</div>
          <div class="idx-avg">avg ${avg}/100</div>
        </div>
        <div class="idx-score" style="color:${m.color}">${avg}</div>`;
      btn.addEventListener("click", () => selectMetric(m.key));
      el.appendChild(btn);
    });
  }

  function selectMetric(key) {
    currentMetric = key;
    const m = METRICS.find(x => x.key === key);

    // Highlight active button
    METRICS.forEach(x => {
      const b = document.getElementById("mb-" + x.key);
      if (!b) return;
      b.classList.toggle("active", x.key === key);
      b.style.borderColor = x.key === key ? m.color + "55" : "";
      b.style.background  = x.key === key ? m.bg : "";
    });

    // Update metric badge overlay on globe
    const badge = document.getElementById("metric-badge");
    if (badge) {
      badge.textContent       = m.icon + " " + m.label.toUpperCase();
      badge.style.color       = m.color;
      badge.style.borderColor = m.color + "44";
    }

    GlobeRenderer.setMetric(key);
    updateTopList();
    updateStats();
    if (selectedCountry) openDetail(selectedCountry);
  }

  /* ══ TOP-RISK LIST ═════════════════════════════════════════════ */

  function updateTopList() {
    const el = document.getElementById("top-list");
    if (!el) return;
    el.innerHTML = "";

    topN(currentMetric, 6).forEach((c, i) => {
      const s   = c.scores[currentMetric];
      const row = document.createElement("div");
      row.className = "top-row";
      row.innerHTML = `
        <div class="top-rank">#${i+1}</div>
        <div class="top-flag">${c.flag}</div>
        <div class="top-name">${c.name}</div>
        <div class="top-score" style="color:${scoreToColor(s)}">${s}</div>`;
      row.addEventListener("click", () => openDetail(c));
      el.appendChild(row);
    });
  }

  /* ══ GLOBAL STATS ══════════════════════════════════════════════ */

  function updateStats() {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set("stat-avg",     globalAvg(currentMetric) + "/100");
    set("stat-extreme", countAbove(currentMetric, 80));
    set("stat-severe",  countAbove(currentMetric, 65));
    set("country-count","LIVE · " + DATA.length + " COUNTRIES");
  }

  /* ══ DETAIL PANEL ══════════════════════════════════════════════ */

  function openDetail(country) {
    selectedCountry = country;
    GlobeRenderer.setSelected(country.iso);
    GlobeState.spinToFace(country.lat, country.lng);

    const s   = country.scores[currentMetric];
    const col = scoreToColor(s);

    const set = (id, v)  => { const e = document.getElementById(id); if (e) e.textContent = v; };
    const clr = (id, c)  => { const e = document.getElementById(id); if (e) e.style.color  = c; };

    set("d-flag",  country.flag);
    set("d-name",  country.name);
    set("d-iso",   country.iso + " · " + country.cont);
    set("d-score", s);           clr("d-score", col);
    set("d-risk",  scoreToLabel(s) + " RISK"); clr("d-risk", col);
    set("d-trend", (country.trend > 0 ? "↑" : "↓") + " " + Math.abs(country.trend) + "% 7-day");
    clr("d-trend", country.trend > 0 ? "#ff3355" : "#00ff88");

    // Metric breakdown bars
    const dm = document.getElementById("d-metrics");
    if (dm) {
      dm.innerHTML = "";
      METRICS.forEach(m => {
        const ms = country.scores[m.key], mc = scoreToColor(ms);
        const row = document.createElement("div");
        row.className = "metric-row";
        row.innerHTML = `
          <div class="metric-hdr">
            <span class="metric-name">${m.icon} ${m.label}</span>
            <span class="metric-val" style="color:${mc}">${ms}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${ms}%; background:${mc}"></div>
          </div>`;
        dm.appendChild(row);
      });
    }

    // Global rank
    const rank = rankOf(country, currentMetric);
    set("d-rank",   "#" + rank);
    set("d-rankof", "of " + DATA.length + " countries");

    // Sparkline
    drawSparkline(country, currentMetric, col);

    // Open panel
    const rp = document.getElementById("right-panel");
    if (rp) rp.classList.add("open");
  }

  function closeDetail() {
    selectedCountry = null;
    GlobeRenderer.setSelected(null);
    const rp = document.getElementById("right-panel");
    if (rp) rp.classList.remove("open");
  }

  /* ══ SPARKLINE ═════════════════════════════════════════════════ */

  function drawSparkline(country, key, color) {
    const idx  = COUNTRIES.findIndex(c => c.iso === country.iso);
    const hist = generateHistory(idx, key);
    const c2   = document.getElementById("spark-canvas");
    if (!c2) return;
    const ctx2 = c2.getContext("2d");
    const W = c2.width, H = c2.height;
    ctx2.clearRect(0, 0, W, H);

    const mn  = Math.min(...hist);
    const mx2 = Math.max(...hist) || 1;
    const px  = i => 4 + (i / (hist.length-1)) * (W-8);
    const py  = v => H - 6 - ((v - mn) / (mx2 - mn)) * (H-12);

    // Area fill
    ctx2.beginPath();
    hist.forEach((v, i) => i ? ctx2.lineTo(px(i), py(v)) : ctx2.moveTo(px(i), py(v)));
    ctx2.lineTo(W-4, H); ctx2.lineTo(4, H); ctx2.closePath();
    ctx2.fillStyle = color + "22"; ctx2.fill();

    // Line
    ctx2.beginPath();
    hist.forEach((v, i) => i ? ctx2.lineTo(px(i), py(v)) : ctx2.moveTo(px(i), py(v)));
    ctx2.strokeStyle = color; ctx2.lineWidth = 1.5; ctx2.stroke();
  }

  /* ══ TOOLTIP ═══════════════════════════════════════════════════ */

  function updateTooltip(country, screenX, screenY) {
    const el = document.getElementById("tooltip");
    if (!el) return;
    if (!country) { el.style.display = "none"; return; }

    const s   = country.scores[currentMetric];
    const col = scoreToColor(s);

    const tf = document.getElementById("t-flag");
    const tn = document.getElementById("t-name");
    const ts = document.getElementById("t-score");
    if (tf) tf.textContent  = country.flag;
    if (tn) tn.textContent  = country.name;
    if (ts) { ts.textContent = s + "/100 · " + scoreToLabel(s); ts.style.color = col; }

    el.style.display = "block";
    el.style.left    = (screenX + 16) + "px";
    el.style.top     = (screenY - 54) + "px";
  }

  /* ══ CANVAS EVENTS ═════════════════════════════════════════════ */

  function attachEvents(canvas) {

    /* ── Mouse move ── */
    canvas.addEventListener("mousemove", e => {
      const rect = canvas.getBoundingClientRect();
      const x    = e.clientX - rect.left;
      const y    = e.clientY - rect.top;
      GlobeRenderer.setMouse(x, y);

      if (GlobeState.dragging) {
        const dx = x - GlobeState.lastX;
        const dy = y - GlobeState.lastY;

        if (GlobeRenderer.isMapMode()) {
          // ✅ [R7] Flat map — drag pans the map
          GlobeState.panX += dx;
          GlobeState.panY += dy;
        } else {
          // Globe — drag rotates the globe
          GlobeState.velY += dx * 0.007;
          GlobeState.velX += dy * 0.007;
        }
        GlobeState.lastX = x;
        GlobeState.lastY = y;
      }

      const hov = GlobeRenderer.getHovered();
      updateTooltip(hov, e.clientX, e.clientY);
      canvas.style.cursor = hov ? "pointer" : (GlobeState.dragging ? "grabbing" : "crosshair");
    });

    canvas.addEventListener("mouseleave", () => {
      GlobeRenderer.clearMouse();
      GlobeState.dragging = false;
      updateTooltip(null);
    });

    canvas.addEventListener("mousedown", e => {
      const rect = canvas.getBoundingClientRect();
      GlobeState.dragging  = true;
      GlobeState.autoSpin  = false;
      GlobeState.lastX     = e.clientX - rect.left;
      GlobeState.lastY     = e.clientY - rect.top;
      canvas.style.cursor  = "grabbing";
    });

    window.addEventListener("mouseup", () => {
      GlobeState.dragging = false;
      canvas.style.cursor = "crosshair";
      setTimeout(() => { if (GlobeState.zoom < 1.5) GlobeState.autoSpin = true; }, 3000);
    });

    /* ── Click → select country ── */
    canvas.addEventListener("click", e => {
      // Ignore if user just dragged
      if (!GlobeRenderer.isMapMode() && Math.abs(GlobeState.velY) > 0.05) return;
      const rect = canvas.getBoundingClientRect();
      const hit  = GlobeRenderer.hitTest(
        e.clientX - rect.left, e.clientY - rect.top,
        canvas.offsetWidth, canvas.offsetHeight
      );
      if (hit) openDetail(hit);
    });

    /* ── ✅ [R7] Scroll → zoom in/out, switch globe ↔ map mode ── */
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const delta    = e.deltaY > 0 ? -0.18 : 0.18;
      const prevZoom = GlobeState.zoom;
      GlobeState.zoom = Math.max(0.7, Math.min(8, GlobeState.zoom + delta));

      // Reset pan + re-enable auto-spin when zooming back out to globe
      if (GlobeState.zoom < 1.5 && prevZoom >= 1.5) {
        GlobeState.panX     = 0;
        GlobeState.panY     = 0;
        GlobeState.autoSpin = true;
      }
      // Stop auto-spin when entering map mode
      if (GlobeState.zoom >= 2.2) GlobeState.autoSpin = false;
    }, { passive: false });

    /* ── ✅ [R7] Touch: single-finger drag + pinch-to-zoom ── */
    let lastTouchDist = null;

    canvas.addEventListener("touchstart", e => {
      const rect = canvas.getBoundingClientRect();
      if (e.touches.length === 1) {
        GlobeState.dragging  = true;
        GlobeState.autoSpin  = false;
        GlobeState.lastX     = e.touches[0].clientX - rect.left;
        GlobeState.lastY     = e.touches[0].clientY - rect.top;
      } else if (e.touches.length === 2) {
        GlobeState.dragging = false;
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    canvas.addEventListener("touchmove", e => {
      const rect = canvas.getBoundingClientRect();
      if (e.touches.length === 1 && GlobeState.dragging) {
        const tx = e.touches[0].clientX - rect.left;
        const ty = e.touches[0].clientY - rect.top;
        const dx = tx - GlobeState.lastX, dy = ty - GlobeState.lastY;
        if (GlobeRenderer.isMapMode()) {
          GlobeState.panX += dx; GlobeState.panY += dy;
        } else {
          GlobeState.velY += dx * 0.007; GlobeState.velX += dy * 0.007;
        }
        GlobeState.lastX = tx; GlobeState.lastY = ty;
      } else if (e.touches.length === 2 && lastTouchDist !== null) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        GlobeState.zoom = Math.max(0.7, Math.min(8, GlobeState.zoom + (dist - lastTouchDist) * 0.01));
        lastTouchDist   = dist;
        if (GlobeState.zoom >= 2.2) GlobeState.autoSpin = false;
      }
    }, { passive: true });

    canvas.addEventListener("touchend", () => {
      GlobeState.dragging = false;
      lastTouchDist       = null;
      setTimeout(() => { if (GlobeState.zoom < 1.5) GlobeState.autoSpin = true; }, 3000);
    });

    /* ── Close button ── */
    document.getElementById("close-btn")?.addEventListener("click", closeDetail);
  }

  /* ── Public API ─────────────────────────────────────────────── */
  return {
    init(canvasEl) {
      buildMetricButtons();
      selectMetric("heat");
      attachEvents(canvasEl);
    },
    selectMetric,
    openDetail,
  };

})();
