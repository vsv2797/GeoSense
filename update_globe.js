const fs = require('fs');
const file = './index.html';
const content = fs.readFileSync(file, 'utf8');

const startMarker = '/* ═══════════════ GLOBE STATE ═══════════════ */';
const endMarker = 'render();\n';
const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker) + endMarker.length;

if (startIndex === -1 || endIndex === -1) {
    console.log('Markers not found');
    process.exit(1);
}

const globeSetup = `/* ═══════════════ GLOBE GL SETUP ═══════════════ */
let mx=-9999, my=-9999;
document.getElementById('globe-wrap').addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  const t = document.getElementById("tooltip");
  if(t && t.style.display==="block"){
    t.style.left=(mx+16)+"px";t.style.top=(my-54)+"px";
  }
});

const world = Globe()(document.getElementById('globe-viz'))
  .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .backgroundColor('#04080f')
  .polygonsData(GEOJSON_DATA.features)
  .polygonCapColor(() => 'rgba(255, 255, 255, 0)')
  .polygonSideColor(() => 'rgba(255, 255, 255, 0.05)')
  .polygonStrokeColor(() => '#334455')
  .polygonAltitude(0.005)
  .onPolygonHover((feat, prevFeat) => {
    if (feat) {
      const country = DATA.find(c => c.iso === feat.properties.iso);
      if (country) { updateTooltip(country, mx, my); } else { updateTooltip(null); }
    } else { updateTooltip(null); }
  })
  .onPolygonClick((feat) => {
    const country = DATA.find(c => c.iso === feat.properties.iso);
    if(country) openDetail(country);
  })
  .pointsData(DATA)
  .pointLat('lat')
  .pointLng('lng')
  .pointColor(d => sColor(d.scores[curMetric]))
  .pointRadius(d => Math.max(0.2, (d.scores[curMetric]/100) * 1.5))
  .pointAltitude(0.006)
  .pointResolution(32)
  .onPointClick(d => openDetail(d));

world.controls().autoRotate = true;
world.controls().autoRotateSpeed = 0.5;
world.controls().enableDamping = true;

window.addEventListener('resize', () => {
  const wrap = document.getElementById('globe-wrap');
  if(wrap) world.width(wrap.offsetWidth).height(wrap.offsetHeight);
});
setTimeout(() => {
  const wrap = document.getElementById('globe-wrap');
  if(wrap) world.width(wrap.offsetWidth).height(wrap.offsetHeight);
}, 100);

function spinTo(lat, lng) {
  world.pointOfView({ lat, lng, altitude: 1.2 }, 1000);
}
`;

let newContent = content.substring(0, startIndex) + globeSetup + content.substring(endIndex);

// Also remove events from main events section to closeDetail
const startEvent = '/* ═══════════════ EVENTS ═══════════════ */';
const endEvent = 'document.getElementById("close-btn").addEventListener("click",closeDetail);';
const startEvIdx = newContent.indexOf(startEvent);
const endEvIdx = newContent.indexOf(endEvent);

if (startEvIdx !== -1 && endEvIdx !== -1) {
    const replacementEvents = `/* ═══════════════ EVENTS ═══════════════ */\n`;
    newContent = newContent.substring(0, startEvIdx) + replacementEvents + newContent.substring(endEvIdx);
}

fs.writeFileSync(file, newContent, 'utf8');
console.log('Update successful');
