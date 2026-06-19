// ── WIND STATE ────────────────────────────────────────────────────────────────
let windDeg = 225; // meteorological: FROM direction, 0=N, 90=E, 180=S, 270=O

function degToLabel(deg) {
  const d = ((deg % 360) + 360) % 360;
  return ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'][Math.round(d/22.5)%16];
}

// ── COMPASS ───────────────────────────────────────────────────────────────────
function initCompass() {
  const canvas = document.getElementById('compass-canvas');
  const ctx    = canvas.getContext('2d');
  const CX = 60, CY = 60, R = 50;
  let dragging = false;

  function drawCompass() {
    ctx.clearRect(0, 0, 120, 120);

    // Background
    const bg = ctx.createRadialGradient(CX,CY,0,CX,CY,R+4);
    bg.addColorStop(0,'#f4f8f4'); bg.addColorStop(1,'#e8f0e8');
    ctx.beginPath(); ctx.arc(CX,CY,R+4,0,Math.PI*2);
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle='rgba(26,79,160,0.2)'; ctx.lineWidth=1.5; ctx.stroke();

    // Ticks
    for (let i=0;i<36;i++) {
      const a = i*10*Math.PI/180, isCard = i%9===0;
      const r1 = R-(isCard?10:5), r2=R-1;
      ctx.beginPath();
      ctx.moveTo(CX+Math.sin(a)*r1, CY-Math.cos(a)*r1);
      ctx.lineTo(CX+Math.sin(a)*r2, CY-Math.cos(a)*r2);
      ctx.strokeStyle = isCard?'rgba(26,79,160,0.5)':'rgba(26,79,160,0.18)';
      ctx.lineWidth = isCard?1.5:0.8; ctx.stroke();
    }

    // Cardinal labels
    ctx.font="bold 9px 'DM Mono',monospace"; ctx.textAlign='center'; ctx.textBaseline='middle';
    [['N',0],['E',90],['S',180],['O',270]].forEach(([lbl,deg])=>{
      const a=deg*Math.PI/180, lr=R-18;
      ctx.fillStyle = lbl==='N'?'#c0392b':'rgba(26,79,160,0.7)';
      ctx.fillText(lbl, CX+Math.sin(a)*lr, CY-Math.cos(a)*lr);
    });

    // Arrow: tail at windDeg side (origin), head pointing where wind TRAVELS (windDeg+180)
    const fromRad = windDeg*Math.PI/180;
    const tailX = CX+Math.sin(fromRad)*(R-22), tailY = CY-Math.cos(fromRad)*(R-22);
    const toRad  = (windDeg+180)*Math.PI/180;
    const headX  = CX+Math.sin(toRad)*(R-22),  headY = CY-Math.cos(toRad)*(R-22);

    ctx.beginPath(); ctx.moveTo(tailX,tailY); ctx.lineTo(headX,headY);
    ctx.strokeStyle='#1a4fa0'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.stroke();

    // Arrowhead at head
    const ah=8, ang=Math.atan2(headY-tailY,headX-tailX);
    ctx.beginPath();
    ctx.moveTo(headX,headY);
    ctx.lineTo(headX-ah*Math.cos(ang-0.42),headY-ah*Math.sin(ang-0.42));
    ctx.lineTo(headX-ah*Math.cos(ang+0.42),headY-ah*Math.sin(ang+0.42));
    ctx.closePath(); ctx.fillStyle='#1a4fa0'; ctx.fill();

    // Center dot
    ctx.beginPath(); ctx.arc(CX,CY,4,0,Math.PI*2);
    ctx.fillStyle='#fff'; ctx.fill();
    ctx.strokeStyle='#1a4fa0'; ctx.lineWidth=1.5; ctx.stroke();
  }

  function angleFromEvent(e) {
    const rect=canvas.getBoundingClientRect();
    const sx=canvas.width/rect.width, sy=canvas.height/rect.height;
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    const cy=e.touches?e.touches[0].clientY:e.clientY;
    const x=(cx-rect.left)*sx-CX, y=(cy-rect.top)*sy-CY;
    return (((Math.atan2(x,-y)*180/Math.PI)%360)+360)%360;
  }

  function updateDir(e) {
    windDeg = Math.round(angleFromEvent(e)/5)*5;
    document.getElementById('out-wind-dir').textContent = `${windDeg}°  (${degToLabel(windDeg)})`;
    drawCompass();
    if (window._drawParkCompass) window._drawParkCompass();
    scheduleCalcParque(false);
  }

  canvas.addEventListener('mousedown', e=>{dragging=true;updateDir(e);});
  canvas.addEventListener('mousemove', e=>{if(dragging)updateDir(e);});
  canvas.addEventListener('mouseup',   ()=>{dragging=false;});
  canvas.addEventListener('mouseleave',()=>{dragging=false;});
  canvas.addEventListener('touchstart',e=>{dragging=true;updateDir(e);e.preventDefault();},{passive:false});
  canvas.addEventListener('touchmove', e=>{if(dragging)updateDir(e);e.preventDefault();},{passive:false});
  canvas.addEventListener('touchend',  ()=>{dragging=false;});

  drawCompass();
}

// ── PARK ROTATION STATE ───────────────────────────────────────────────────────
let parkRotDeg = 0; // offset rotation of park grid relative to wind direction

function initParkCompass() {
  const canvas = document.getElementById('park-compass-canvas');
  const ctx    = canvas.getContext('2d');
  const CX = 60, CY = 60, R = 50;
  let dragging = false;

  function drawParkCompass() {
    ctx.clearRect(0, 0, 120, 120);

    // Background — green tint to differentiate from wind compass
    const bg = ctx.createRadialGradient(CX,CY,0,CX,CY,R+4);
    bg.addColorStop(0,'#f4f8f4'); bg.addColorStop(1,'#e8f4ec');
    ctx.beginPath(); ctx.arc(CX,CY,R+4,0,Math.PI*2);
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle='rgba(26,122,48,0.25)'; ctx.lineWidth=1.5; ctx.stroke();

    // Ticks — green tones
    for (let i=0;i<36;i++) {
      const a = i*10*Math.PI/180, isCard = i%9===0;
      const r1 = R-(isCard?10:5), r2=R-1;
      ctx.beginPath();
      ctx.moveTo(CX+Math.sin(a)*r1, CY-Math.cos(a)*r1);
      ctx.lineTo(CX+Math.sin(a)*r2, CY-Math.cos(a)*r2);
      ctx.strokeStyle = isCard?'rgba(26,122,48,0.5)':'rgba(26,122,48,0.18)';
      ctx.lineWidth = isCard?1.5:0.8; ctx.stroke();
    }

    // Draw wind reference arrow (faint blue — shows wind direction as reference)
    const windTravelRad = ((windDeg+180) - 90) * Math.PI / 180;
    const wRefX1 = CX + Math.cos(windTravelRad) * (R-22);
    const wRefY1 = CY + Math.sin(windTravelRad) * (R-22);
    const wRefX2 = CX - Math.cos(windTravelRad) * (R-22);
    const wRefY2 = CY - Math.sin(windTravelRad) * (R-22);
    ctx.beginPath(); ctx.moveTo(wRefX2, wRefY2); ctx.lineTo(wRefX1, wRefY1);
    ctx.strokeStyle='rgba(26,79,160,0.18)'; ctx.lineWidth=1.5; ctx.setLineDash([3,3]); ctx.stroke();
    ctx.setLineDash([]);

    // Park grid arrow — offset by parkRotDeg from wind travel direction
    const parkRad = windTravelRad + parkRotDeg * Math.PI / 180;
    const headX = CX + Math.cos(parkRad) * (R-22);
    const headY = CY + Math.sin(parkRad) * (R-22);
    const tailX = CX - Math.cos(parkRad) * (R-22);
    const tailY = CY - Math.sin(parkRad) * (R-22);

    ctx.beginPath(); ctx.moveTo(tailX,tailY); ctx.lineTo(headX,headY);
    ctx.strokeStyle='#1a7a30'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.stroke();

    // Arrowhead
    const ah=8, ang=Math.atan2(headY-tailY,headX-tailX);
    ctx.beginPath();
    ctx.moveTo(headX,headY);
    ctx.lineTo(headX-ah*Math.cos(ang-0.42),headY-ah*Math.sin(ang-0.42));
    ctx.lineTo(headX-ah*Math.cos(ang+0.42),headY-ah*Math.sin(ang+0.42));
    ctx.closePath(); ctx.fillStyle='#1a7a30'; ctx.fill();

    // Center dot
    ctx.beginPath(); ctx.arc(CX,CY,4,0,Math.PI*2);
    ctx.fillStyle='#fff'; ctx.fill();
    ctx.strokeStyle='#1a7a30'; ctx.lineWidth=1.5; ctx.stroke();

    // Offset label in center
    if (parkRotDeg !== 0) {
      ctx.font="bold 8px 'DM Mono',monospace"; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='rgba(26,122,48,0.7)';
      ctx.fillText((parkRotDeg>0?'+':'')+parkRotDeg+'°', CX, CY+18);
    }
  }

  function angleFromEvent(e) {
    const rect=canvas.getBoundingClientRect();
    const sx=canvas.width/rect.width, sy=canvas.height/rect.height;
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    const cy=e.touches?e.touches[0].clientY:e.clientY;
    const x=(cx-rect.left)*sx-CX, y=(cy-rect.top)*sy-CY;
    // Angle in canvas coords (0=right, CW+)
    return Math.atan2(y, x) * 180 / Math.PI;
  }

  function updateParkRot(e) {
    // Canvas angle of dragged position
    const dragAngle = angleFromEvent(e);
    // Wind travel direction in canvas coords
    const windTravelCanvas = ((windDeg+180) - 90);
    // parkRotDeg = drag angle - wind travel angle, snapped to 5°
    let diff = dragAngle - windTravelCanvas;
    // Normalise to -180..+180
    diff = ((diff + 180) % 360 + 360) % 360 - 180;
    parkRotDeg = Math.round(diff / 5) * 5;

    const lbl = parkRotDeg === 0
      ? '0°  (alineado al viento)'
      : (parkRotDeg > 0 ? '+' : '') + parkRotDeg + '° respecto al viento';
    document.getElementById('out-park-rot').textContent = lbl;
    drawParkCompass();
    scheduleCalcParque(false);
  }

  canvas.addEventListener('mousedown', e=>{dragging=true; updateParkRot(e);});
  canvas.addEventListener('mousemove', e=>{if(dragging) updateParkRot(e);});
  canvas.addEventListener('mouseup',   ()=>{dragging=false;});
  canvas.addEventListener('mouseleave',()=>{dragging=false;});
  canvas.addEventListener('touchstart',e=>{dragging=true;updateParkRot(e);e.preventDefault();},{passive:false});
  canvas.addEventListener('touchmove', e=>{if(dragging)updateParkRot(e);e.preventDefault();},{passive:false});
  canvas.addEventListener('touchend',  ()=>{dragging=false;});

  // Reset button
  document.getElementById('park-rot-reset').addEventListener('click', () => {
    parkRotDeg = 0;
    document.getElementById('out-park-rot').textContent = '0°  (alineado al viento)';
    drawParkCompass();
    calcParque(false);
  });

  drawParkCompass();
  // Expose redraw so wind compass changes can refresh park compass too
  window._drawParkCompass = drawParkCompass;
}

// ── VIEWPORT STATE (pan/zoom) ─────────────────────────────────────────────────
let vp = { scale: 1, tx: 0, ty: 0 };
const VP_MIN = 0.25, VP_MAX = 8;
function vpReset() { vp.scale=1; vp.tx=0; vp.ty=0; }
// screen pixel → world (canvas-coordinate) pixel
function screenToWorld(sx, sy, canvas) {
  const rect = canvas.getBoundingClientRect();
  const cx = (sx - rect.left) * (canvas.width  / rect.width);
  const cy = (sy - rect.top)  * (canvas.height / rect.height);
  return { x: (cx - vp.tx) / vp.scale, y: (cy - vp.ty) / vp.scale };
}

// ── TURBINE STATE ─────────────────────────────────────────────────────────────
let turbinePositions = [];
let autoPositions    = [];
let manuallyMoved    = false;
let useStagger       = true;  // true = quincunx, false = aligned grid
let userRows         = null;
let dragIdx = -1, dragOffX = 0, dragOffY = 0;
let lastN=0, lastSepPar=0, lastSepTrans=0, lastDiam=0, lastUserRows=null, lastParkRot=0, lastStagger=true;

// ── ROAD STATE ────────────────────────────────────────────────────────────────
// Caminos internos: cada camino es una polilínea de puntos {x,z} en METROS reales
// (mismo sistema que window._parkState.positions). Se dibujan en el 2D y viajan al 3D.
let roads        = [];      // [ [ {x,z}, … ], … ]
let currentRoad  = null;    // polilínea en edición (mientras drawingRoad)
let drawingRoad  = false;   // modo "dibujar camino" activo
let roadPreview  = null;    // {x,z} metros: punto bajo el cursor (rubber-band)
// Transform del layout (px↔metros), actualizado en cada drawParkDiagram
let _layout = { cx: 465, cy: 240, scaleUsed: 1, diamM: 162 };

function _pxToM(px, py)  { return { x:(px-_layout.cx)/_layout.scaleUsed, z:(py-_layout.cy)/_layout.scaleUsed }; }
function _mToPx(m)       { return { x: _layout.cx + m.x*_layout.scaleUsed, y: _layout.cy + m.z*_layout.scaleUsed }; }

function toggleRoadDraw() {
  drawingRoad = !drawingRoad;
  if (!drawingRoad) finalizeRoad();       // al apagar el modo, cierra el tramo en curso
  const btn = document.getElementById('road-draw-btn');
  const cv  = document.getElementById('park-canvas');
  if (btn) { drawingRoad ? btn.classList.add('active') : btn.classList.remove('active');
             btn.textContent = drawingRoad ? '✓ Terminar' : '✏ Dibujar camino'; }
  if (cv)  cv.style.cursor = drawingRoad ? 'crosshair' : 'default';
  const hint = document.getElementById('road-hint');
  if (hint) hint.style.display = drawingRoad ? 'inline' : 'none';
  calcParque(true);
}

function finalizeRoad() {
  if (currentRoad && currentRoad.length >= 2) {
    // dedupe del último punto (doble clic deja dos puntos casi iguales)
    const a = currentRoad[currentRoad.length-1], b = currentRoad[currentRoad.length-2];
    if (Math.hypot(a.x-b.x, a.z-b.z) < _layout.diamM*0.3) currentRoad.pop();
    if (currentRoad.length >= 2) roads.push(currentRoad);
  }
  currentRoad = null; roadPreview = null;
}

function addRoadPoint(mPt) {
  if (!currentRoad) currentRoad = [];
  currentRoad.push(mPt);
}

function clearRoads() {
  roads = []; currentRoad = null; roadPreview = null;
  calcParque(true);
}

// Camino automático: anillo perimetral (envolvente convexa) algo afuera de las turbinas
function autoRoadPerimeter() {
  if (turbinePositions.length < 3) return;
  const hull = convexHull(turbinePositions.map(p=>({x:p.x,y:p.y})));
  if (hull.length < 3) return;
  const cgx = hull.reduce((s,p)=>s+p.x,0)/hull.length;
  const cgy = hull.reduce((s,p)=>s+p.y,0)/hull.length;
  const marginPx = (_layout.diamM*0.9) * _layout.scaleUsed;   // ~0.9·D afuera
  const ring = hull.map(p=>{
    const dx=p.x-cgx, dy=p.y-cgy, L=Math.hypot(dx,dy)||1;
    const ox=p.x+dx/L*marginPx, oy=p.y+dy/L*marginPx;
    return _pxToM(ox, oy);
  });
  ring.push(ring[0]);   // cerrar el anillo
  roads = [ring];
  currentRoad = null; roadPreview = null;
  calcParque(true);
}

function toggleStagger() {
  useStagger = !useStagger;
  const btn = document.getElementById('stagger-toggle-btn');
  btn.textContent = useStagger ? '⊟ Desfase' : '⊞ Alineado';
  useStagger ? btn.classList.add('active') : btn.classList.remove('active');
  resetTurbinePositions();
  calcParque(false);
}

function resetTurbinePositions() {
  turbinePositions = autoPositions.map(p=>({x:p.x,y:p.y}));
  manuallyMoved = false;
}

// ── CONVEX HULL (Graham scan) for manual area ─────────────────────────────────
function convexHull(pts) {
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort((a,b)=>a.x!==b.x?a.x-b.x:a.y-b.y);
  const cross=(O,A,B)=>(A.x-O.x)*(B.y-O.y)-(A.y-O.y)*(B.x-O.x);
  const lower=[], upper=[];
  for (const p of sorted) {
    while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0) lower.pop();
    lower.push(p);
  }
  for (let i=sorted.length-1;i>=0;i--) {
    const p=sorted[i];
    while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

function polygonArea(pts) { // shoelace, returns m²
  let a=0;
  for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length;a+=pts[i].x*pts[j].y-pts[j].x*pts[i].y;}
  return Math.abs(a/2);
}

// ── WIND TURBINE ICON ─────────────────────────────────────────────────────────
// Draws a top-view wind turbine icon: hub + 3 blades
function drawTurbineIcon(ctx, x, y, size, windTravRad, isHovered) {
  ctx.save();
  ctx.translate(x, y);

  // Glow
  const grd = ctx.createRadialGradient(0,0,0,0,0,size*2.5);
  grd.addColorStop(0, isHovered?'rgba(26,79,160,0.3)':'rgba(26,122,48,0.22)');
  grd.addColorStop(1,'rgba(26,122,48,0)');
  ctx.beginPath(); ctx.arc(0,0,size*2.5,0,Math.PI*2);
  ctx.fillStyle=grd; ctx.fill();

  // 3 blades — rotated so blades face perpendicular to wind travel (logical orientation)
  const bladeColor   = isHovered ? 'rgba(26,79,160,0.82)' : 'rgba(26,90,40,0.82)';
  const bladeStroke  = isHovered ? 'rgba(26,79,160,0.4)'  : 'rgba(26,90,40,0.3)';
  const bladeLen = size * 2.4;
  const bladeW   = size * 0.38;

  const spin = bladePhase + x * 0.012;   // giro animado + leve desfase por turbina
  for (let b=0;b<3;b++) {
    const angle = windTravRad + (b * 2*Math.PI/3) + Math.PI/2 + spin;
    ctx.save();
    ctx.rotate(angle);
    // Blade shape: tapered from hub outward
    ctx.beginPath();
    ctx.moveTo(0, size*0.4);
    ctx.bezierCurveTo(bladeW, size*0.6, bladeW*0.7, bladeLen*0.7, 0, bladeLen);
    ctx.bezierCurveTo(-bladeW*0.4, bladeLen*0.7, -bladeW*0.5, size*0.6, 0, size*0.4);
    ctx.closePath();
    ctx.fillStyle   = bladeColor;
    ctx.strokeStyle = bladeStroke;
    ctx.lineWidth   = 0.5;
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // Hub circle
  ctx.beginPath(); ctx.arc(0,0,size,0,Math.PI*2);
  ctx.fillStyle   = isHovered?'#1a4fa0':'#1a7a30';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 1.5;
  ctx.fill(); ctx.stroke();

  ctx.restore();
}

// ── ANIMACIÓN DEL PARQUE: palas girando + partículas de viento ────────────────
let bladePhase   = 0;                 // fase de giro de las palas (rad)
let parkWakeRad  = -Math.PI / 4;      // dirección de avance del viento (coords canvas)
let windParticles = [];
let parkParams   = { n:15, diam:162, sepPar:7, sepTrans:4, fc:45 };
const PARK_W = 930, PARK_H = 480;     // dimensiones lógicas del canvas del parque

function initWindParticles() {
  windParticles = [];
  const N = 48;
  for (let i = 0; i < N; i++) {
    windParticles.push({
      x: Math.random() * PARK_W,
      y: Math.random() * PARK_H,
      len: 7 + Math.random() * 20,
      a:   0.05 + Math.random() * 0.13,
      v:   0.035 + Math.random() * 0.075   // px por ms (base)
    });
  }
}

function advanceWindParticles(dt, fc) {
  const dirx = Math.cos(parkWakeRad), diry = Math.sin(parkWakeRad);
  const boost = 0.5 + (fc || 45) / 100;     // más viento aparente con mayor factor de capacidad
  const M = 28;
  for (const p of windParticles) {
    const step = p.v * boost * dt;
    p.x += dirx * step;
    p.y += diry * step;
    // wrap-around dentro del área lógica (con margen)
    if (p.x < -M) p.x = PARK_W + M; else if (p.x > PARK_W + M) p.x = -M;
    if (p.y < -M) p.y = PARK_H + M; else if (p.y > PARK_H + M) p.y = -M;
  }
}

// Dibuja las estelas de viento en coords de pantalla (detrás de las turbinas)
function drawWindParticles(ctx) {
  if (!windParticles.length) return;
  const dirx = Math.cos(parkWakeRad), diry = Math.sin(parkWakeRad);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3;
  for (const p of windParticles) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - dirx * p.len, p.y - diry * p.len);
    ctx.strokeStyle = 'rgba(26,79,160,' + p.a.toFixed(3) + ')';
    ctx.stroke();
  }
  ctx.restore();
}

// Loop continuo: gira palas y arrastra partículas mientras el tab del parque
// esté visible. Throttle ~48fps y pausa si la pestaña no se ve o el doc está oculto.
let _parkLastFrame = 0;
function parkAnimActive() {
  if (document.hidden) return false;
  const tab = document.getElementById('tab-parque');
  return tab && tab.classList.contains('active');
}
function parkAnimLoop(now) {
  requestAnimationFrame(parkAnimLoop);
  if (!parkAnimActive()) { _parkLastFrame = now; return; }
  if (!_parkLastFrame) _parkLastFrame = now;          // primer frame: inicializa el reloj
  const dt = Math.min(60, now - _parkLastFrame);
  if (dt < 28) return;                 // aún no toca redibujar (cap ~35fps); no resetea el reloj
  _parkLastFrame = now;
  bladePhase += 0.0013 * dt * (0.45 + (parkParams.fc || 45) / 100);
  advanceWindParticles(dt, parkParams.fc);
  drawParkDiagram(parkParams.n, parkParams.diam, parkParams.sepPar, parkParams.sepTrans);
}

// ── PARK LAYOUT DIAGRAM ───────────────────────────────────────────────────────
function drawParkDiagram(n, diam, sepPar, sepTrans) {
  const canvas = document.getElementById('park-canvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#dceadc'; ctx.fillRect(0,0,W,H);

  // Partículas de viento — en coords de PANTALLA, detrás de la grilla/turbinas
  parkWakeRad = (((windDeg + 180) % 360) - 90) * Math.PI / 180;
  drawWindParticles(ctx);

  // Apply viewport (pan/zoom) transform — all drawing is in world coords
  ctx.save();
  ctx.translate(vp.tx, vp.ty);
  ctx.scale(vp.scale, vp.scale);

  // Grid — draw in world coords, extended so it covers the visible area regardless of pan/zoom
  const gridStep = 40;
  const wx0 = -vp.tx/vp.scale, wy0 = -vp.ty/vp.scale;
  const wx1 = (W-vp.tx)/vp.scale, wy1 = (H-vp.ty)/vp.scale;
  ctx.strokeStyle='rgba(120,160,120,0.2)'; ctx.lineWidth=0.5/vp.scale;
  for(let x=Math.floor(wx0/gridStep)*gridStep;x<wx1;x+=gridStep){ctx.beginPath();ctx.moveTo(x,wy0);ctx.lineTo(x,wy1);ctx.stroke();}
  for(let y=Math.floor(wy0/gridStep)*gridStep;y<wy1;y+=gridStep){ctx.beginPath();ctx.moveTo(wx0,y);ctx.lineTo(wx1,y);ctx.stroke();}

  // Spacings in metres
  const distParM   = sepPar   * diam;
  const distTransM = sepTrans * diam;

  // ── COORDINATE SYSTEM (used consistently throughout) ──────────────────────
  // Canvas: x=right, y=DOWN, rotation positive=clockwise
  // Meteorological: windDeg=FROM direction, 0=N, 90=E, 180=S, 270=W
  // travelDeg: direction wind goes TO (opposite of FROM)
  // Canvas angle for a met direction d: canvasRad(d) = (d - 90) * PI/180
  //   → met 0°(N) = canvas -90° = pointing UP  ✓
  //   → met 90°(E) = canvas 0° = pointing RIGHT ✓
  //   → met 180°(S) = canvas 90° = pointing DOWN ✓
  //   → met 270°(W) = canvas 180° = pointing LEFT ✓

  const travelDeg   = (windDeg + 180) % 360;          // where wind goes TO (met)
  const wakeRad     = (travelDeg - 90) * Math.PI / 180; // canvas angle of wake/wind travel
  // Grid rotation = wind travel direction + park rotation offset (independent)
  const gridRot     = wakeRad + parkRotDeg * Math.PI / 180;

  // ── Grid cols/rows — userRows overrides auto, n is always fixed ──
  const autoRows = Math.max(1, Math.round(Math.sqrt(n * (distParM / distTransM) * (H / W))));
  const rows     = userRows != null ? Math.max(1, Math.min(n, userRows)) : autoRows;
  const cols     = Math.ceil(n / rows);

  // Update rows control widget
  const dispVal  = document.getElementById('rows-display-val');
  const resetBtn = document.getElementById('rows-reset-btn');
  if (dispVal) {
    if (userRows == null) {
      dispVal.textContent = `${rows} (auto)`;
      dispVal.className = 'rows-display-val auto-mode';
      if (resetBtn) resetBtn.classList.add('hidden');
    } else {
      dispVal.textContent = rows;
      dispVal.className = 'rows-display-val user-mode';
      if (resetBtn) resetBtn.classList.remove('hidden');
    }
  }

  // ── Scale: fixed to total park area, independent of cols/rows layout ──
  // Always scale based on total n turbines spread across the full area,
  // so reorganizing rows never changes the zoom level.
  const totalW_m = Math.max(1, cols-1) * distTransM + (useStagger ? distTransM * 0.5 : 0);
  const totalH_m = Math.max(1, rows-1) * distParM;

  // ── FIX 3: Scale from rotated bounding box ──
  // When a rectangle of size (gW,gH) is rotated by θ, its axis-aligned bounding box is:
  //   W' = gW|cosθ| + gH|sinθ|,  H' = gW|sinθ| + gH|cosθ|
  const padX=80, padY=60, availW=W-padX*2, availH=H-padY*2;
  const cosA=Math.abs(Math.cos(gridRot)), sinA=Math.abs(Math.sin(gridRot));

  const denom_w = totalW_m*cosA + totalH_m*sinA;
  const denom_h = totalW_m*sinA + totalH_m*cosA;
  const scaleW  = denom_w > 0 ? availW / denom_w : 1;
  const scaleH  = denom_h > 0 ? availH / denom_h : 1;
  const scaleUsed = Math.min(scaleW, scaleH);

  // Canvas centre
  const cx = W/2, cy = H/2;
  _layout = { cx, cy, scaleUsed, diamM: diam };   // para convertir px↔metros en los caminos

  // ── Auto positions: staggered grid rotated around centre ──
  // Odd rows (r=1,3,5…) are shifted +distTransM/2 in the transverse direction
  // so each turbine sits in the gap between the two upwind ones → avoids direct wake impact
  const newAuto = [];
  let count = 0;
  for (let r=0; r<rows&&count<n; r++) {
    const stagger = (useStagger && r % 2 === 1) ? distTransM * 0.5 * scaleUsed : 0;
    for (let c=0; c<cols&&count<n; c++) {
      const lx = (c-(cols-1)/2) * distTransM * scaleUsed + stagger;
      const ly = (r-(rows-1)/2) * distParM   * scaleUsed;
      const rx = cx + lx*(-Math.sin(gridRot)) + ly*(Math.cos(gridRot));
      const ry = cy + lx*( Math.cos(gridRot)) + ly*(Math.sin(gridRot));
      newAuto.push({x:rx, y:ry, idx:count});
      count++;
    }
  }
  autoPositions = newAuto;

  // Reset positions if params changed — includes userRows so layout redraws on row change
  const paramsChanged = (n!==lastN || sepPar!==lastSepPar || sepTrans!==lastSepTrans || diam!==lastDiam || userRows!==lastUserRows || parkRotDeg!==lastParkRot || useStagger!==lastStagger);
  if (paramsChanged || turbinePositions.length!==n) {
    if (n !== lastN) userRows = null;
    resetTurbinePositions();
    lastN=n; lastSepPar=sepPar; lastSepTrans=sepTrans; lastDiam=diam; lastUserRows=userRows; lastParkRot=parkRotDeg; lastStagger=useStagger;
  }

  const positions = turbinePositions.length===n ? turbinePositions : autoPositions;

  // ── Export park state for the 3D view (coords in REAL METRES, centred on parque) ──
  // Pixel positions → metres: (px - centre) / scaleUsed. Honra el arrastre manual.
  window._parkState = {
    positions: positions.map(p => ({ x:(p.x-cx)/scaleUsed, z:(p.y-cy)/scaleUsed })),
    diamM: diam,
    distParM, distTransM,
    windTravRad: wakeRad,   // ángulo de viaje del viento en el plano (x=cos, z=sin)
    fc: parkParams.fc,
    roads: roads.map(r => r.map(p => ({ x:p.x, z:p.z }))),   // caminos en metros reales
    n
  };
  if (window._park3dOnState) window._park3dOnState();

  // Turbine display size
  const hubR_px = Math.max(4, Math.min(distTransM*scaleUsed*0.06, 12));

  // Influence radius (half of parallel spacing)
  const influenceR_px = (distParM/2) * scaleUsed;

  // ── FIX 2: Wake in correct direction — FROM turbine in wind TRAVEL direction ──
  // windTravRad is canvas angle of travel direction (0=right, +clockwise)
  // The ellipse center goes in that direction from the turbine
  const wakeLen = Math.min(influenceR_px * 3, distParM * scaleUsed * 1.1);

  // ── INFLUENCE CIRCLES ──
  positions.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x,p.y,influenceR_px,0,Math.PI*2);
    ctx.strokeStyle='rgba(26,122,48,0.18)'; ctx.lineWidth=1;
    ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(p.x,p.y,influenceR_px,0,Math.PI*2);
    ctx.fillStyle='rgba(26,122,48,0.04)'; ctx.fill();
  });

  // ── WAKES — ellipse from turbine, extending in wakeRad direction ──
  // ctx is in world space. wakeRad is canvas angle (0=right, CW+).
  // After ctx.rotate(wakeRad), +X points downwind. Ellipse at (wakeLen/2, 0) straddles origin→forward.
  positions.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(wakeRad);
    const grad = ctx.createLinearGradient(0, 0, wakeLen, 0);
    grad.addColorStop(0, 'rgba(26,79,160,0.28)');
    grad.addColorStop(1, 'rgba(26,79,160,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(wakeLen/2, 0, wakeLen/2, influenceR_px*0.30, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });

  // ── ROADS (caminos internos) ──
  // Se dibujan debajo de las turbinas. Cada camino: polilínea en metros → px.
  const roadWpx = Math.max(3, (Math.max(8, diam*0.07)) * scaleUsed);  // ancho en px
  function strokeRoad(ptsM, opts) {
    if (!ptsM || ptsM.length < 1) return;
    ctx.beginPath();
    ptsM.forEach((m,i) => { const q=_mToPx(m); i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y); });
    ctx.lineJoin='round'; ctx.lineCap='round';
    if (opts && opts.preview) {
      ctx.strokeStyle='rgba(120,100,70,0.55)'; ctx.lineWidth=roadWpx;
      ctx.setLineDash([8/vp.scale, 6/vp.scale]); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.strokeStyle='rgba(70,58,42,0.85)'; ctx.lineWidth=roadWpx; ctx.stroke();           // borde
      ctx.strokeStyle='rgba(190,170,135,0.95)'; ctx.lineWidth=Math.max(1.5,roadWpx*0.62); ctx.stroke(); // ripio
    }
    // vértices (solo en edición)
    if (opts && opts.nodes) {
      ptsM.forEach(m=>{ const q=_mToPx(m); ctx.beginPath(); ctx.arc(q.x,q.y,roadWpx*0.6,0,Math.PI*2);
        ctx.fillStyle='rgba(26,79,160,0.85)'; ctx.fill(); });
    }
  }
  roads.forEach(r => strokeRoad(r));
  if (currentRoad && currentRoad.length) {
    const live = roadPreview ? currentRoad.concat([roadPreview]) : currentRoad;
    strokeRoad(live, { preview:true });
    strokeRoad(currentRoad, { nodes:true });
  }

  // ── TURBINE ICONS ──
  positions.forEach((p,i) => {
    drawTurbineIcon(ctx, p.x, p.y, hubR_px, wakeRad, i===dragIdx);
  });

  // ── CONVEX HULL POLYGON + SIDE DIMENSIONS ──
  // Always draw hull from current positions (auto or manual)
  if (positions.length >= 3) {
    const hull = convexHull(positions);
    if (hull.length >= 3) {
      // Draw polygon — thin dashed line
      ctx.save();
      ctx.strokeStyle = 'rgba(80,80,80,0.35)';
      ctx.lineWidth   = 1 / vp.scale;         // stay thin regardless of zoom
      ctx.setLineDash([6/vp.scale, 4/vp.scale]);
      ctx.beginPath();
      hull.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // Side length labels
      ctx.font = `${Math.max(8, 9/vp.scale)}px 'DM Mono', monospace`;
      ctx.fillStyle = 'rgba(60,60,60,0.55)';
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < hull.length; i++) {
        const a = hull[i];
        const b = hull[(i+1) % hull.length];

        // Length in metres (pixels / scaleUsed)
        const lenPx = Math.hypot(b.x - a.x, b.y - a.y);
        const lenM  = lenPx / scaleUsed;
        const lbl   = lenM >= 1000
          ? (lenM/1000).toFixed(2) + ' km'
          : Math.round(lenM) + ' m';

        // Midpoint of side
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;

        // Normal offset — push label slightly outside the polygon
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        // Outward normal (rotate 90° — choose direction away from centroid)
        const cx_hull = hull.reduce((s,p)=>s+p.x,0)/hull.length;
        const cy_hull = hull.reduce((s,p)=>s+p.y,0)/hull.length;
        let nx = -dy/len, ny = dx/len;
        // Flip if normal points inward
        if ((mx+nx*10 - cx_hull)*nx + (my+ny*10 - cy_hull)*ny < 0) { nx=-nx; ny=-ny; }
        const offset = 14 / vp.scale;

        // Tiny background pill for readability
        const tw = ctx.measureText(lbl).width;
        const th = Math.max(8, 9/vp.scale);
        const px2 = mx + nx*offset, py2 = my + ny*offset;
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.beginPath();
        ctx.roundRect(px2 - tw/2 - 3/vp.scale, py2 - th/2 - 2/vp.scale,
                      tw + 6/vp.scale, th + 4/vp.scale, 3/vp.scale);
        ctx.fill();

        ctx.fillStyle = 'rgba(60,60,60,0.6)';
        ctx.fillText(lbl, px2, py2);
      }
      ctx.restore();
    }
  }

  // ── END VIEWPORT TRANSFORM — HUD overlays drawn in screen coords ──
  ctx.restore();

  // ── SCALE BAR ──
  const scaleBarTargetPx=120;
  const effectiveScale = scaleUsed * vp.scale; // metres per screen pixel
  const rounds=[100,200,500,1000,2000,5000,10000];
  let scaleBarM=rounds.reduce((prev,cur)=>Math.abs(cur-scaleBarTargetPx/effectiveScale)<Math.abs(prev-scaleBarTargetPx/effectiveScale)?cur:prev);
  const scaleBarPx=scaleBarM*effectiveScale;
  const sbX=W-padX-scaleBarPx, sbY=H-28;
  ctx.fillStyle='rgba(255,255,255,0.85)';
  ctx.beginPath();ctx.roundRect(sbX-10,sbY-14,scaleBarPx+20,28,5);ctx.fill();
  ctx.strokeStyle='#1a4fa0';ctx.lineWidth=2;ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(sbX,sbY+4);ctx.lineTo(sbX+scaleBarPx,sbY+4);ctx.stroke();
  [sbX,sbX+scaleBarPx].forEach(tx=>{ctx.beginPath();ctx.moveTo(tx,sbY-2);ctx.lineTo(tx,sbY+10);ctx.stroke();});
  ctx.fillStyle='#1a4fa0';ctx.font="bold 11px 'DM Mono',monospace";ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillText(scaleBarM>=1000?(scaleBarM/1000)+' km':scaleBarM+' m', sbX+scaleBarPx/2, sbY-5);

  // ── MINI ROSE ──
  const roseX=44, roseY=H-44, roseR=22;
  ctx.beginPath();ctx.arc(roseX,roseY,roseR+4,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.88)';ctx.fill();
  ctx.beginPath();ctx.arc(roseX,roseY,roseR,0,Math.PI*2);ctx.strokeStyle='rgba(26,79,160,0.3)';ctx.lineWidth=1;ctx.stroke();
  ctx.font="9px 'DM Mono',monospace";ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#c0392b';ctx.fillText('N',roseX,roseY-roseR+8);
  ctx.fillStyle='rgba(26,79,160,0.6)';
  ctx.fillText('S',roseX,roseY+roseR-8);ctx.fillText('E',roseX+roseR-8,roseY);ctx.fillText('O',roseX-roseR+8,roseY);

  const roseFromRad=(windDeg-90)*Math.PI/180, roseToRad=(travelDeg-90)*Math.PI/180;
  const tailX=roseX+Math.cos(roseFromRad)*roseR*0.75, tailY=roseY+Math.sin(roseFromRad)*roseR*0.75;
  const headX=roseX+Math.cos(roseToRad)*roseR*0.75,   headY=roseY+Math.sin(roseToRad)*roseR*0.75;
  ctx.beginPath();ctx.moveTo(tailX,tailY);ctx.lineTo(headX,headY);
  ctx.strokeStyle='#1a4fa0';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.stroke();
  const ah=7, ang=Math.atan2(headY-tailY,headX-tailX);
  ctx.beginPath();ctx.moveTo(headX,headY);
  ctx.lineTo(headX-ah*Math.cos(ang-0.4),headY-ah*Math.sin(ang-0.4));
  ctx.lineTo(headX-ah*Math.cos(ang+0.4),headY-ah*Math.sin(ang+0.4));
  ctx.closePath();ctx.fillStyle='#1a4fa0';ctx.fill();
  const windLbl=degToLabel(windDeg);
  ctx.font="bold 9px 'DM Mono',monospace";ctx.fillStyle='#1a4fa0';ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillText(`Viento ${windLbl}`,roseX,roseY+roseR+14);

  // ── INFO: update legend label ──
  let supKm2;
  if (manuallyMoved && positions.length >= 3) {
    const hull = convexHull(positions);
    const areaPx2 = polygonArea(hull);
    supKm2 = areaPx2 / (scaleUsed * scaleUsed) / 1e6;
  } else {
    supKm2 = (totalW_m/1000) * (totalH_m/1000);
  }
  const windLbl2 = degToLabel(windDeg);
  const manualTag = manuallyMoved ? ' · manual' : '';
  document.getElementById('diagram-info').textContent =
    `${n} turbinas · ${rows}×${cols}${manualTag} · ↑${sepPar}D · →${sepTrans}D · ≈ ${supKm2.toFixed(2)} km²`;

  return { cols, rows, distParM, distTransM, supKm2 };
}

// ── CANVAS INTERACTIONS (pan, zoom, turbine drag) ─────────────────────────────
function initCanvasDrag() {
  const canvas = document.getElementById('park-canvas');

  // Get world-space position from mouse/touch event
  function getWorld(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return screenToWorld(clientX, clientY, canvas);
  }

  // Get raw screen-pixel position (canvas-relative, unscaled by devicePixelRatio)
  function getScreen(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width  / rect.width;
    const sy = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX-rect.left)*sx, y: (clientY-rect.top)*sy };
  }

  function findNearest(worldPos) {
    // Search radius in world pixels — scales with zoom so it feels consistent
    const hitR = 35 / vp.scale;
    let minD=Infinity, idx=-1;
    turbinePositions.forEach((p,i)=>{
      const d=Math.hypot(p.x-worldPos.x, p.y-worldPos.y);
      if(d<minD){minD=d;idx=i;}
    });
    return minD<hitR ? idx : -1;
  }

  // Punto de camino en METROS a partir del evento, con snap a la turbina más cercana
  function roadSnapM(e) {
    const wp = getWorld(e);
    const idx = findNearest(wp);
    const px = idx >= 0 ? turbinePositions[idx] : wp;
    return _pxToM(px.x, px.y);
  }

  // Clic en modo dibujo → agrega un punto al camino en curso
  canvas.addEventListener('click', e => {
    if (!drawingRoad) return;
    addRoadPoint(roadSnapM(e));
    roadPreview = null;
    calcParque(true);
  });

  let panStart = null; // {x,y} in screen coords when pan started
  let panVpStart = null; // {tx,ty} at pan start

  canvas.addEventListener('mousedown', e => {
    if (drawingRoad) { e.preventDefault(); return; }   // en modo dibujo no se hace pan/drag
    const wp = getWorld(e);
    dragIdx = findNearest(wp);
    if (dragIdx >= 0) {
      // Turbine drag
      dragOffX = turbinePositions[dragIdx].x - wp.x;
      dragOffY = turbinePositions[dragIdx].y - wp.y;
      canvas.style.cursor = 'grabbing';
    } else {
      // Pan
      const sp = getScreen(e);
      panStart   = { x: sp.x, y: sp.y };
      panVpStart = { tx: vp.tx, ty: vp.ty };
      canvas.style.cursor = 'move';
    }
    e.preventDefault();
  });

  canvas.addEventListener('mousemove', e => {
    if (drawingRoad) { roadPreview = roadSnapM(e); calcParque(true); return; }  // rubber-band
    const wp = getWorld(e);
    if (dragIdx >= 0) {
      turbinePositions[dragIdx].x = wp.x + dragOffX;
      turbinePositions[dragIdx].y = wp.y + dragOffY;
      manuallyMoved = true;
      calcParque(true);
    } else if (panStart) {
      const sp = getScreen(e);
      vp.tx = panVpStart.tx + (sp.x - panStart.x);
      vp.ty = panVpStart.ty + (sp.y - panStart.y);
      calcParque(true);
    } else {
      canvas.style.cursor = findNearest(wp) >= 0 ? 'grab' : 'default';
    }
  });

  canvas.addEventListener('mouseup', () => {
    dragIdx=-1; panStart=null; panVpStart=null;
    canvas.style.cursor='default';
  });
  canvas.addEventListener('mouseleave', () => {
    dragIdx=-1; panStart=null; panVpStart=null;
    canvas.style.cursor='default';
  });

  // Double-click: termina el camino (en modo dibujo) o resetea posiciones
  canvas.addEventListener('dblclick', () => {
    if (drawingRoad) { finalizeRoad(); calcParque(true); return; }
    resetTurbinePositions();
    calcParque(true);
  });

  // ── WHEEL ZOOM ──
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const sp = getScreen(e);
    const factor = e.deltaY < 0 ? 1.15 : 1/1.15;
    const newScale = Math.min(VP_MAX, Math.max(VP_MIN, vp.scale * factor));
    // Zoom toward cursor position
    vp.tx = sp.x - (sp.x - vp.tx) * (newScale / vp.scale);
    vp.ty = sp.y - (sp.y - vp.ty) * (newScale / vp.scale);
    vp.scale = newScale;
    calcParque(true);
  }, { passive: false });

  // ── TOUCH ──
  let touchPanStart=null, touchVpStart=null, pinchDist0=null, pinchScale0=null, pinchMid0=null;

  canvas.addEventListener('touchstart', e => {
    if (drawingRoad && e.touches.length === 1) {   // tap agrega punto al camino
      addRoadPoint(roadSnapM(e)); roadPreview = null; calcParque(true);
      e.preventDefault(); return;
    }
    if (e.touches.length === 1) {
      const wp = getWorld(e);
      dragIdx = findNearest(wp);
      if (dragIdx >= 0) {
        dragOffX=turbinePositions[dragIdx].x-wp.x;
        dragOffY=turbinePositions[dragIdx].y-wp.y;
      } else {
        const sp=getScreen(e);
        touchPanStart={x:sp.x,y:sp.y};
        touchVpStart={tx:vp.tx,ty:vp.ty};
      }
    } else if (e.touches.length === 2) {
      dragIdx=-1; touchPanStart=null;
      const t0=e.touches[0], t1=e.touches[1];
      pinchDist0=Math.hypot(t1.clientX-t0.clientX,t1.clientY-t0.clientY);
      pinchScale0=vp.scale;
      const rect=canvas.getBoundingClientRect();
      const sx=canvas.width/rect.width, sy=canvas.height/rect.height;
      pinchMid0={
        x:((t0.clientX+t1.clientX)/2-rect.left)*sx,
        y:((t0.clientY+t1.clientY)/2-rect.top)*sy
      };
    }
    e.preventDefault();
  }, {passive:false});

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length===1 && dragIdx>=0) {
      const wp=getWorld(e);
      turbinePositions[dragIdx].x=wp.x+dragOffX;
      turbinePositions[dragIdx].y=wp.y+dragOffY;
      manuallyMoved=true; calcParque(true);
    } else if (e.touches.length===1 && touchPanStart) {
      const sp=getScreen(e);
      vp.tx=touchVpStart.tx+(sp.x-touchPanStart.x);
      vp.ty=touchVpStart.ty+(sp.y-touchPanStart.y);
      calcParque(true);
    } else if (e.touches.length===2 && pinchDist0!=null) {
      const t0=e.touches[0],t1=e.touches[1];
      const dist=Math.hypot(t1.clientX-t0.clientX,t1.clientY-t0.clientY);
      const newScale=Math.min(VP_MAX,Math.max(VP_MIN,pinchScale0*(dist/pinchDist0)));
      vp.tx=pinchMid0.x-(pinchMid0.x-vp.tx)*(newScale/vp.scale);
      vp.ty=pinchMid0.y-(pinchMid0.y-vp.ty)*(newScale/vp.scale);
      vp.scale=newScale; calcParque(true);
    }
    e.preventDefault();
  },{passive:false});

  canvas.addEventListener('touchend', ()=>{
    dragIdx=-1;touchPanStart=null;touchVpStart=null;pinchDist0=null;
  });

  // ── ZOOM BUTTONS ──
  document.getElementById('zoom-in-btn').addEventListener('click',()=>{
    const s=Math.min(VP_MAX,vp.scale*1.4);
    vp.tx=canvas.width/2-(canvas.width/2-vp.tx)*(s/vp.scale);
    vp.ty=canvas.height/2-(canvas.height/2-vp.ty)*(s/vp.scale);
    vp.scale=s; calcParque(true);
  });
  document.getElementById('zoom-out-btn').addEventListener('click',()=>{
    const s=Math.max(VP_MIN,vp.scale/1.4);
    vp.tx=canvas.width/2-(canvas.width/2-vp.tx)*(s/vp.scale);
    vp.ty=canvas.height/2-(canvas.height/2-vp.ty)*(s/vp.scale);
    vp.scale=s; calcParque(true);
  });
  document.getElementById('zoom-reset-btn').addEventListener('click',()=>{
    vpReset(); calcParque(true);
  });
}
