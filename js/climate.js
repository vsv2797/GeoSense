/* ═══════════════ DATA & STATE ═══════════════ */
let DATA = [];
let GEOJSON_DATA = null;

const METRICS = [
  { key: "pm10", label: "PM10", icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'><path d='M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z'/></svg>" },
  { key: "pm2_5", label: "PM2.5", icon: "<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='currentColor' stroke-width='2' viewBox='0 0 24 24'><circle cx='12' cy='12' r='4'/><path d='M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41'/></svg>" },
  { key: "co", label: "CO", icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'><path d='M18 5H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 12H6V7h12v10zM8 9h8v2H8zm0 4h5v2H8z'/></svg>" },
  { key: "no2", label: "NO2", icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'><path d='M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z'/></svg>" },
  { key: "temp", label: "TEMP °C", icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z'/></svg>" }
];

let curMetric = "pm10";

/* COLOUR & LABELING */
function sColor(s, k) {
  if (k === "pm2_5") {
    if (s >= 50) return "#ff2244"; if (s >= 35) return "#ff6600"; if (s >= 20) return "#ffaa00"; if (s >= 10) return "#ccdd00"; return "#44ee88";
  } else if (k === "pm10") {
    if (s >= 100) return "#ff2244"; if (s >= 75) return "#ff6600"; if (s >= 50) return "#ffaa00"; if (s >= 20) return "#ccdd00"; return "#44ee88";
  } else if (k === "co") {
    if (s >= 1000) return "#ff2244"; if (s >= 600) return "#ff6600"; if (s >= 300) return "#ffaa00"; if (s >= 150) return "#ccdd00"; return "#44ee88";
  } else if (k === "no2") {
    if (s >= 100) return "#ff2244"; if (s >= 50) return "#ff6600"; if (s >= 25) return "#ffaa00"; if (s >= 10) return "#ccdd00"; return "#44ee88";
  } else if (k === "pop_den") {
    if (s >= 500) return "#ff2244"; if (s >= 200) return "#ff6600"; if (s >= 50) return "#ffaa00"; if (s >= 20) return "#ccdd00"; return "#44ee88";
  } else if (k === "temp") {
    if (s <= 0) return "#8b5cf6"; if (s <= 15) return "#3b82f6"; if (s <= 25) return "#10b981"; if (s <= 35) return "#f59e0b"; return "#ef4444";
  }
  return "#44ee88";
}

function sLabel(s, k) {
  if (k === "pm2_5") {
    if (s >= 50) return "HAZARDOUS"; if (s >= 35) return "UNHEALTHY"; if (s >= 20) return "POOR"; if (s >= 10) return "MODERATE"; return "SAFE";
  } else if (k === "pm10") {
    if (s >= 100) return "HAZARDOUS"; if (s >= 75) return "UNHEALTHY"; if (s >= 50) return "POOR"; if (s >= 20) return "MODERATE"; return "SAFE";
  } else if (k === "co") {
    if (s >= 1000) return "HAZARDOUS"; if (s >= 600) return "UNHEALTHY"; if (s >= 300) return "POOR"; if (s >= 150) return "MODERATE"; return "SAFE";
  } else if (k === "no2") {
    if (s >= 100) return "HAZARDOUS"; if (s >= 50) return "UNHEALTHY"; if (s >= 25) return "POOR"; if (s >= 10) return "MODERATE"; return "SAFE";
  } else if (k === "pop_den") {
    if (s >= 500) return "EXTREME"; if (s >= 200) return "VERY HIGH"; if (s >= 50) return "HIGH"; if (s >= 20) return "MODERATE"; return "LOW";
  } else if (k === "temp") {
    if (s <= 0) return "FREEZING"; if (s <= 15) return "COLD"; if (s <= 25) return "MILD"; if (s <= 35) return "HOT"; return "EXTREME HEAT";
  }
  return "SAFE";
}

/* STATS */
function gAvg(k) { if (!DATA.length) return 0; return (DATA.reduce((a, c) => a + (c.scores[k] || 0), 0) / DATA.length).toFixed(1) }
function topN(k, n) { return [...DATA].sort((a, b) => (b.scores[k] || 0) - (a.scores[k] || 0)).slice(0, n) }
function rankOf(c, k) { return [...DATA].sort((a, b) => (b.scores[k] || 0) - (a.scores[k] || 0)).findIndex(x => x.iso === c.iso) + 1 }

const THERMAL_COLORS = [
    [139, 92, 246], // Deep Purple
    [59, 130, 246], // Blue 
    [16, 185, 129], // Green
    [245, 158, 11], // Orange
    [239, 68, 68]   // Hot Red
];

function getThermalColor(temp, alpha = 0.9) {
    let t = (temp + 30) / 80;
    t = Math.max(0, Math.min(1, t));
    const maxIdx = THERMAL_COLORS.length - 1;
    const scaledT = t * maxIdx;
    const i = Math.floor(scaledT);
    if (i >= maxIdx) return `rgba(${THERMAL_COLORS[maxIdx][0]}, ${THERMAL_COLORS[maxIdx][1]}, ${THERMAL_COLORS[maxIdx][2]}, ${alpha})`;
    const frac = scaledT - i;
    const r = Math.round(THERMAL_COLORS[i][0] * (1 - frac) + THERMAL_COLORS[i+1][0] * frac);
    const g = Math.round(THERMAL_COLORS[i][1] * (1 - frac) + THERMAL_COLORS[i+1][1] * frac);
    const b = Math.round(THERMAL_COLORS[i][2] * (1 - frac) + THERMAL_COLORS[i+1][2] * frac);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ═══════════════ GLOBE GL SETUP ═══════════════ */
let mx = -9999, my = -9999;
document.getElementById('globe-wrap').addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  const t = document.getElementById("tooltip");
  if (t && t.style.display === "block") {
    t.style.left = (mx + 16) + "px"; t.style.top = (my - 54) + "px";
  }
});

const world = Globe()(document.getElementById('globe-viz'))
  .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
  .backgroundColor('#00000000') 
  .showAtmosphere(true)
  .atmosphereColor('lightskyblue')
  .atmosphereAltitude(0.15)
  .polygonLabel(({ properties: d }) => {
    let html = `<div style="background: rgba(4,8,15,0.96); border: 1px solid rgba(0,229,255,0.28); border-radius: 10px; padding: 9px 13px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
    <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px; color:#fff;">${d.ADMIN || d.NAME} (${d.ISO_A3})</div>`;
    const countryData = DATA.find(c => c.iso === d.ISO_A3);
    if (countryData) {
      const val = countryData.scores[curMetric] || 0;
      const mItem = METRICS.find(m => m.key == curMetric);
      html += `<div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; margin-bottom: 2px; display:flex; align-items:center; gap:5px;"><span style="width:12px; height:12px; display:inline-block; color:#cbd5e1;">${mItem.icon}</span> ${mItem.label}: <span style="color:${sColor(val, curMetric)}; font-weight:bold;">${val}</span></div>`;
    } else {
      html += `<div style="font-size: 10px; color: #8899aa;">No Data</div>`;
    }
    return html + '</div>';
  })
  .polygonsTransitionDuration(500)
  .polygonAltitude(feat => DATA.find(c => c.iso === feat.properties.ISO_A3) ? 0.012 : 0.005)
  .polygonCapColor(feat => {
    const c = DATA.find(c => c.iso === feat.properties.ISO_A3);
    if (!c) return 'rgba(20,30,40,0.1)';
    if (curMetric === 'temp') return 'rgba(0,0,0,0.0)'; // fully transparent so heatmap shines through
    const val = c.scores[curMetric] || 0;
    return sColor(val, curMetric) + 'a0'; 
  })
  .polygonSideColor(feat => {
    return 'rgba(0, 0, 0, 0.5)';
  })
  .polygonStrokeColor(feat => {
      // Show borders so they "fill" the country mentally!
      return 'rgba(255, 255, 255, 0.15)';
  })
  .heatmapPointLat('lat')
  .heatmapPointLng('lng')
  .heatmapPointWeight('weight')
  .heatmapBaseAltitude(0.01)
  .heatmapBandwidth(2)
  .heatmapColorSaturation(2.5)
  .onPolygonHover((feat, prevFeat) => {
    world.polygonAltitude(d => d === feat ? 0.06 : (DATA.find(c => c.iso === d.properties.ISO_A3) ? 0.012 : 0.005));
    if (feat) {
        world.polygonStrokeColor(d => d === feat ? '#00e5ff' : 'rgba(255, 255, 255, 0.15)');
    } else {
        world.polygonStrokeColor(d => 'rgba(255, 255, 255, 0.15)');
    }
    const t = document.getElementById("tooltip"); if (t) t.style.display = "none";
  })
  .onPolygonClick((feat) => {
    const countryData = DATA.find(c => c.iso === feat.properties.ISO_A3);
    if (countryData) openDetail(countryData);
  });

let airQualityCache = {};

Promise.all([
  fetch('https://unpkg.com/globe.gl/example/datasets/ne_110m_admin_0_countries.geojson').then(r => r.json()),
  fetch('https://restcountries.com/v3.1/all?fields=cca3,latlng,population,area,flags').then(r => r.json())
]).then(([geojson, restCountries]) => {
  const rcMap = {};
  restCountries.forEach(rc => rcMap[rc.cca3] = rc);

  geojson.features.forEach(f => {
    const iso = f.properties.ISO_A3;
    const rc = rcMap[iso];
    if (rc && rc.latlng && rc.latlng.length === 2) {
      const lat = rc.latlng[0];
      const lng = rc.latlng[1];
      const popDensity = rc.area ? (rc.population / rc.area) : 0;
      f.properties.centroid_lat = lat;
      f.properties.centroid_lng = lng;

      DATA.push({
        iso: iso, name: f.properties.ADMIN || f.properties.NAME, cont: f.properties.CONTINENT,
        lat: lat, lng: lng, pop: rc.population, area: rc.area, flag_url: rc.flags?.svg || rc.flags?.png || "",
        scores: { pop_den: Math.round(popDensity * 10) / 10, pm10: 0, pm2_5: 0, co: 0, no2: 0, temp: 0 },
        cause: popDensity > 200 ? "High urban density emissions." : ""
      });
    }
  });

  DATA = DATA.filter(d => !isNaN(d.lat) && !isNaN(d.lng)).sort((a, b) => a.name.localeCompare(b.name));
  GEOJSON_DATA = geojson;
  world.polygonsData(geojson.features);

  const chunkSize = 50;
  const fetchPromises = [];
  for (let i = 0; i < DATA.length; i += chunkSize) {
    const chunk = DATA.slice(i, i + chunkSize);
    const lats = chunk.map(c => parseFloat(c.lat).toFixed(2)).join(',');
    const lngs = chunk.map(c => parseFloat(c.lng).toFixed(2)).join(',');
    
    fetchPromises.push(
      Promise.all([
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide`),
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m`)
      ])
        .then(responses => Promise.all(responses.map(r => r.json())))
        .then(([aqData, tempData]) => {
          const aqRes = Array.isArray(aqData) ? aqData : [aqData];
          const tmpRes = Array.isArray(tempData) ? tempData : [tempData];
          chunk.forEach((c, idx) => {
             const aq = aqRes[idx]?.current;
             if (aq) {
               c.scores.pm10 = Math.round(aq.pm10 || 0);
               c.scores.pm2_5 = Math.round(aq.pm2_5 || 0);
               c.scores.co = Math.round(aq.carbon_monoxide || 0);
               c.scores.no2 = Math.round(aq.nitrogen_dioxide || 0);
               if (c.scores.pm10 > 50) c.cause = "High atmospheric particulate accumulation.";
               if (c.scores.co > 500) c.cause = "Severe industrial & vehicular carbon monoxide.";
             }
             const tmp = tmpRes[idx]?.current;
             if(tmp) {
                 c.scores.temp = Math.round(tmp.temperature_2m || 0);
             }
             airQualityCache[c.iso] = true;
          });
        }).catch(e => console.error("Batch fetch err", e))
    );
  }

  Promise.all(fetchPromises).then(() => {
    buildMetricBtns();
    selectMetric('pm2_5'); 
    world.polygonCapColor(world.polygonCapColor()); 
  });
});

world.controls().autoRotate = true;
world.controls().autoRotateSpeed = 0.5;
world.controls().enableDamping = true;

window.addEventListener('resize', () => {
  const wrap = document.getElementById('globe-wrap');
  if (wrap) world.width(wrap.offsetWidth).height(wrap.offsetHeight);
});
setTimeout(() => {
  const wrap = document.getElementById('globe-wrap');
  if (wrap) world.width(wrap.offsetWidth).height(wrap.offsetHeight);
}, 100);

// Topography Layer Toggle
let showSatellite = false;
const btnAtm = document.getElementById('btn-atm');
if(btnAtm) {
    btnAtm.addEventListener('click', () => {
        showSatellite = !showSatellite;
        if(showSatellite || curMetric === 'temp') {
            world.polygonsData([]);
            // Note: In satellite or temp mode, we wipe polygons natively
            if (curMetric === 'temp') {
                world.polygonsData([...GEOJSON_DATA.features]); // Reput them for click detection if in thermal map
            }
        } else {
            world.polygonsData([...GEOJSON_DATA.features]);
        }
        btnAtm.querySelector('span').innerText = `[ MAP: ${showSatellite ? 'SATELLITE' : 'DATA CHOROPLETH'} ]`;
        btnAtm.style.color = showSatellite ? '#00e5ff' : '#cbd5e1';
    });
}

// Solar System Illumination
setTimeout(() => {
    const dLight = world.scene().children.find(obj3d => obj3d.type === 'DirectionalLight');
    if (dLight) {
        // Clone the light natively so we bypass importing an external Three.js instance
        const sunLight = dLight.clone();
        sunLight.intensity = 2.5;
        world.scene().add(sunLight);
        
        // Mute the default camera tracking light
        dLight.intensity = 0;
        
        // Tune ambient lighting directly on the internal scene
        const aLight = world.scene().children.find(obj3d => obj3d.type === 'AmbientLight');
        if (aLight) {
            aLight.intensity = 0.4;
        }

        function syncSun() {
            const t = new Date();
            const hours = t.getUTCHours() + t.getUTCMinutes() / 60;
            const days = (t - new Date(t.getUTCFullYear(), 0, 0)) / 86400000;
            
            // Solar declination
            const dec = 23.44 * Math.sin((360 / 365.24) * (days - 81) * Math.PI / 180);
            
            // Equation of time approximation to adjust longitude
            const eot = 9.87 * Math.sin(2 * (360 / 365.24) * (days - 81) * Math.PI / 180) - 7.53 * Math.cos((360 / 365.24) * (days - 81) * Math.PI / 180) - 1.5 * Math.sin((360 / 365.24) * (days - 81) * Math.PI / 180);
            
            const lng = 180 - (hours - 12) * 15 - eot/4;
            const lat = dec;

            // Cartesian projection for light casting
            const r = 300;
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lng + 180) * (Math.PI / 180);
            sunLight.position.set(
                -r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta)
            );
        }
        setInterval(syncSun, 60000);
        syncSun();
    }
}, 500);

function spinTo(lat, lng) { world.pointOfView({ lat, lng, altitude: 1.2 }, 1000); }

/* ═══════════════ UI DYNAMICS ═══════════════ */
function buildMetricBtns() {
  const el = document.getElementById("metric-btns"); el.innerHTML = "";
  METRICS.forEach(m => {
    const avg = gAvg(m.key);
    const btn = document.createElement("div"); 
    btn.className = "metric-btn"; 
    btn.id = "mb-" + m.key;
    btn.onclick = () => selectMetric(m.key);
    btn.innerHTML = `
      <div class="btn-icon">${m.icon}</div>
      <div class="btn-title">${m.label}</div>
      <div class="btn-value">Avg: ${avg}</div>
    `;
    el.appendChild(btn);
  });
}

function selectMetric(key) {
  curMetric = key; 
  const m = METRICS.find(x => x.key === key);
  METRICS.forEach(x => { 
    const b = document.getElementById("mb-" + x.key); 
    if (!b) return; 
    b.classList.toggle("active", x.key === key); 
  });
  
  const mb = document.getElementById("metric-badge"); 
  if (mb) { 
    mb.innerHTML = `<span style="opacity:0.7">TRACKING:</span> ${m.label.toUpperCase()}`; 
  }
  
  updateGlobalDistribution();
  updateTopList(); 
  if (selCountry) openDetail(selCountry);
  
  // Trigger the massive polygon transformation animation!
  if (showSatellite && curMetric !== "temp") {
      world.polygonsData([]); 
  } else {
      world.polygonsData([...GEOJSON_DATA.features]);
  }

  if (curMetric === "temp") {
      let heatData = [];
      DATA.forEach(c => {
         let w = (c.scores.temp + 30) / 80;
         w = Math.max(0.05, Math.min(1.0, w));
         
         const feat = GEOJSON_DATA.features.find(f => f.properties.ISO_A3 === c.iso);
         if (feat && feat.geometry) {
             function emitRing(ring) {
                 // Dynamically sample the border points natively aligned to the map mesh
                 const step = Math.max(1, Math.floor(ring.length / 15)); 
                 for (let i = 0; i < ring.length; i += step) {
                     heatData.push({
                         lat: ring[i][1],
                         lng: ring[i][0],
                         weight: w
                     });
                 }
             }
             if (feat.geometry.type === 'Polygon') {
                 feat.geometry.coordinates.forEach(emitRing);
             } else if (feat.geometry.type === 'MultiPolygon') {
                 feat.geometry.coordinates.forEach(poly => poly.forEach(emitRing));
             }
             
             // Inject the Core centroid recursively to solidfy interior country glow
             if (c.lat && c.lng) {
                 heatData.push({ lat: parseFloat(c.lat), lng: parseFloat(c.lng), weight: w });
                 
                 // If enormous continent-tier country, seed intermediate density interpolations
                 if (c.area > 300000 && feat.geometry.type === 'Polygon') {
                     const ring = feat.geometry.coordinates[0];
                     const step = Math.max(1, Math.floor(ring.length / 8));
                     for (let i = 0; i < ring.length; i += step) {
                         const midLat = (parseFloat(c.lat) + ring[i][1]) / 2;
                         const midLng = (parseFloat(c.lng) + ring[i][0]) / 2;
                         heatData.push({ lat: midLat, lng: midLng, weight: w });
                     }
                 }
             }
         }
      });
      world.heatmapsData([heatData]);
  } else {
      world.heatmapsData([]);
  }
}

function getDistributionData(metricKey) {
    let counts = { safe: 0, moderate: 0, poor: 0, unhealthy: 0, hazardous: 0 };
    DATA.forEach(c => {
        const lbl = sLabel(c.scores[metricKey] || 0, metricKey);
        if(lbl === "SAFE" || lbl === "LOW" || lbl === "FREEZING") counts.safe++;
        else if(lbl === "MODERATE" || lbl === "COLD") counts.moderate++;
        else if(lbl === "POOR" || lbl === "HIGH" || lbl === "MILD") counts.poor++;
        else if(lbl === "UNHEALTHY" || lbl === "VERY HIGH" || lbl === "HOT") counts.unhealthy++;
        else counts.hazardous++; // HAZARDOUS, EXTREME, EXTREME HEAT
    });
    return counts;
}

function updateGlobalDistribution() {
    const el = document.getElementById("dist-stats");
    if(!el) return;
    const totals = getDistributionData(curMetric);
    const total = DATA.length || 1;
    
    el.innerHTML = `
      <div class="dist-title">DISTRIBUTION OUT OF ${DATA.length} REPORTED REGIONS</div>
      
      <div class="dist-row"><span>HAZARDOUS</span><span style="color:#ff2244">${totals.hazardous}</span></div>
      <div class="dist-bar-bg"><div class="dist-bar-fill" style="width:${(totals.hazardous/total)*100}%; background:#ff2244"></div></div>
      
      <div class="dist-row"><span>UNHEALTHY</span><span style="color:#ff6600">${totals.unhealthy}</span></div>
      <div class="dist-bar-bg"><div class="dist-bar-fill" style="width:${(totals.unhealthy/total)*100}%; background:#ff6600"></div></div>
      
      <div class="dist-row"><span>MODERATE/POOR</span><span style="color:#ffaa00">${totals.poor + totals.moderate}</span></div>
      <div class="dist-bar-bg"><div class="dist-bar-fill" style="width:${((totals.poor+totals.moderate)/total)*100}%; background:#ffaa00"></div></div>
      
      <div class="dist-row"><span>SAFE</span><span style="color:#44ee88">${totals.safe}</span></div>
      <div class="dist-bar-bg"><div class="dist-bar-fill" style="width:${(totals.safe/total)*100}%; background:#44ee88"></div></div>
    `;
}

function updateTopList() {
  const el = document.getElementById("top-list"); 
  if(!el) return;
  el.innerHTML = "";
  topN(curMetric, 5).forEach((c, i) => {
    const s = c.scores[curMetric];
    const col = sColor(s, curMetric);
    // Find the max score among top 5 to scale the bar
    const maxScore = topN(curMetric, 5)[0].scores[curMetric] || 1;
    const widthPct = Math.min(100, Math.max(10, (s / maxScore) * 100));

    const item = document.createElement("div"); 
    item.className = "leader-item";
    item.style.borderLeftColor = col;
    item.innerHTML = `
      <div class="leader-bg-bar" style="width: ${widthPct}%; background: ${col}25;"></div>
      <div class="leader-content">
          <div class="leader-country" style="display:flex; align-items:center;">
              ${c.flag_url ? `<img src="${c.flag_url}" style="width:14px; height:10px; margin-right:6px; object-fit:cover; border-radius:1px;">` : `<span class="leader-flag">${c.iso}</span>`}
              ${c.name}
          </div>
          <div class="leader-score" style="color:${col}">${s}</div>
      </div>
    `;
    item.onclick = () => openDetail(c); 
    el.appendChild(item);
  });
}

function updateStats() {
    // legacy, overridden by dynamic Distribution Chart
}

let selCountry = null;
function openDetail(c) {
  world.controls().autoRotate = false;
  selCountry = c; spinTo(c.lat, c.lng);

  const sid = document.getElementById.bind(document);
  if(!sid("d-flag")) return;
  
  if (c.flag_url) {
      sid("d-flag").innerHTML = `<img src="${c.flag_url}" style="height: 24px; border-radius: 2px; border: 1px solid #1f2d3d; object-fit: cover;">`;
  } else {
      sid("d-flag").innerHTML = `[${c.iso}]`;
  }
  
  sid("d-name").textContent = c.name;
  sid("d-iso").textContent = (c.cont || "Global").toUpperCase();

  const refreshDetailUI = () => {
    const s = c.scores[curMetric] || 0, col = sColor(s, curMetric), lbl = sLabel(s, curMetric);
    sid("d-score").textContent = s; sid("d-score").style.color = col;
    sid("d-risk").textContent = lbl + " ZONE"; sid("d-risk").style.color = col;
    
    const dm = sid("d-metrics"); dm.innerHTML = "";
    METRICS.forEach(m => { 
        const ms = c.scores[m.key] || 0; 
        const mc = sColor(ms, m.key); 
        const row = document.createElement("div"); 
        row.className = "mlist-row"; 
        row.innerHTML = `<span class="mlist-lbl"><span class="mlist-icon">${m.icon}</span> ${m.label}</span><span class="mlist-val" style="color:${mc}">${ms}</span>`; 
        dm.appendChild(row) 
    });
    sid("d-rank").textContent = "#" + rankOf(c, curMetric);
    sid("d-rankof").textContent = "of " + DATA.length + " regions";
  };

  if (sid("d-cause")) sid("d-cause").textContent = c.cause || "Multiple compounding factors.";

  if (sid("d-w-icon")) {
    sid("d-w-icon").textContent = "⏳";
    sid("d-w-desc").textContent = "Fetching Live APIs...";

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${parseFloat(c.lat).toFixed(2)}&longitude=${parseFloat(c.lng).toFixed(2)}&current_weather=true`)
      .then(r => r.json())
      .then(data => {
        if (data && data.current_weather) {
          const w = data.current_weather;
          sid("d-w-icon").innerHTML = "<svg viewBox='0 0 24 24' width='24' height='24' fill='#cbd5e1'><path d='M12 2.02A10 10 0 1 0 22 12c0-5.52-4.48-10-10-9.98zm0 18A8 8 0 1 1 20 12a8 8 0 0 1-8 8zm1-13h-2v6h5v-2h-3z'/></svg>";
          sid("d-w-desc").textContent = `${w.temperature}°C (WIND: ${w.windspeed}KM/H)`;
        } else {
          sid("d-w-icon").innerHTML = "Err"; sid("d-w-desc").textContent = "N/A";
        }
      }).catch(e => { sid("d-w-icon").innerHTML = "Err"; sid("d-w-desc").textContent = "API Err"; });
  }

  refreshDetailUI();
  const rPanel = document.getElementById("right"); if(rPanel) rPanel.classList.add("active");
}

function closeDetail() {
  world.controls().autoRotate = true;
  selCountry = null; 
  const rPanel = document.getElementById("right"); if(rPanel) rPanel.classList.remove("active");
}

const cbtn = document.getElementById("close-btn");
if(cbtn) cbtn.addEventListener("click", closeDetail);

buildMetricBtns(); selectMetric("pm2_5");
