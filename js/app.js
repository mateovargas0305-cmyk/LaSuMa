// ════════ APP: helpers, estado de UI, cálculo del parque, init ════════
// ── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(n, dec) {
  if (n === undefined || isNaN(n)) return '—';
  dec = dec ?? 1;
  if (n >= 1e6)  return (n/1e6).toFixed(dec) + ' M';
  if (n >= 1e3)  return Math.round(n).toLocaleString('es-AR');
  return n.toFixed(dec);
}
function fmtSup(km2) {
  if (km2 < 0.01) return (km2 * 1e6).toFixed(0) + ' m²';
  if (km2 < 1)    return (km2 * 100).toFixed(1) + ' ha';
  return km2.toFixed(2) + ' km²';
}
function updateFill(sliderId, fillId) {
  const sl = document.getElementById(sliderId); if (!sl) return;
  const fill = document.getElementById(fillId);  if (!fill) return;
  const pct = ((parseFloat(sl.value) - parseFloat(sl.min)) / (parseFloat(sl.max) - parseFloat(sl.min))) * 100;
  fill.style.width = pct + '%';
}
function flashEl(id) {
  const el = document.getElementById(id); if (!el) return;
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

// ── COUNT-UP / NUMBER TWEEN ───────────────────────────────────────────────────
// Anima suavemente el texto numérico de un elemento desde su valor previo al
// nuevo. Al arrastrar un slider, los valores se actualizan por frame y la
// animación simplemente “persigue” el objetivo (efecto de número que se asienta).
const _reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const _numTweens = new Map();
let _numRAF = 0;
function setNum(id, value, fmt) {
  const el = document.getElementById(id); if (!el) return;
  if (value == null || (typeof value === 'number' && isNaN(value))) {
    _numTweens.delete(el); el.textContent = '—'; return;
  }
  const prev = _numTweens.get(el);
  if (!prev) {                            // primera vez → instantáneo (sin contar desde 0)
    _numTweens.set(el, { cur: value, target: value, fmt });
    el.textContent = fmt(value);
    return;
  }
  prev.target = value; prev.fmt = fmt;
  if (!_numRAF) _numRAF = requestAnimationFrame(_numStep);
}
function _numStep() {
  let active = false;
  _numTweens.forEach((t, el) => {
    const d = t.target - t.cur;
    const eps = Math.max(1e-6, Math.abs(t.target) * 2e-4);
    if (Math.abs(d) <= eps) { t.cur = t.target; }
    else { t.cur += d * 0.22; active = true; }
    el.textContent = t.fmt(t.cur);
  });
  _numRAF = active ? requestAnimationFrame(_numStep) : 0;
}


// ──────── (coalescing de redibujo, calcParque, controles, informe, export, INIT) ────────
// ── REDRAW COALESCING (rAF) ───────────────────────────────────────────────────
// Los arrastres de sliders y brújulas disparan decenas de eventos `input` por
// segundo; cada uno redibuja el canvas completo del parque. Coalescemos esas
// llamadas a una sola por frame para eliminar el jank sin cambiar resultados.
let _parkScheduled = false, _parkKeepFlag = false;
function scheduleCalcParque(keepPositions) {
  _parkKeepFlag = keepPositions;
  if (_parkScheduled) return;
  _parkScheduled = true;
  requestAnimationFrame(() => {
    _parkScheduled = false;
    calcParque(_parkKeepFlag);
  });
}

let _ecoScheduled = false;
function scheduleCalcEco() {
  if (_ecoScheduled) return;
  _ecoScheduled = true;
  requestAnimationFrame(() => {
    _ecoScheduled = false;
    calcEco();
  });
}

// ── MAIN CALC ─────────────────────────────────────────────────────────────────
function calcParque(keepPositions) {
  const n        = parseInt(document.getElementById('sl-n').value);
  const mw       = parseFloat(document.getElementById('sl-mw').value);
  const fc       = parseInt(document.getElementById('sl-fc').value);
  const sepPar   = parseFloat(document.getElementById('sl-sep-par').value);
  const sepTrans = parseFloat(document.getElementById('sl-sep-trans').value);
  const diam     = parseInt(document.getElementById('sl-diam').value);
  const hog      = parseFloat(document.getElementById('sl-hog').value);
  const co2f     = parseFloat(document.getElementById('sl-co2f').value);
  const precio   = parseFloat(document.getElementById('sl-precio')?.value ?? sharedState.precio);

  // Labels
  document.getElementById('out-n').textContent         = n;
  document.getElementById('out-mw').textContent        = mw.toFixed(1)+' MW';
  document.getElementById('out-fc').textContent        = fc+' %';
  document.getElementById('out-sep-par').textContent   = sepPar.toFixed(1)+' D';
  document.getElementById('out-sep-trans').textContent = sepTrans.toFixed(1)+' D';
  document.getElementById('out-diam').textContent      = diam+' m';
  document.getElementById('out-hog').textContent       = hog.toFixed(1)+' MWh/año';
  document.getElementById('out-co2f').textContent      = co2f.toFixed(2)+' kg/kWh';

  ['n','mw','fc','diam','hog','co2f'].forEach(id=>updateFill('sl-'+id,'fill-'+id));
  updateFill('sl-sep-par','fill-sep-par');
  updateFill('sl-sep-trans','fill-sep-trans');

  const potTotal=n*mw, horas=8760*(fc/100), gwhAnio=potTotal*horas/1000;
  const mwhAnio  = gwhAnio * 1000;
  const hogares=Math.round(mwhAnio/hog), co2t=Math.round(gwhAnio*co2f*1000);
  const gwhUnit=gwhAnio/n, gwh25=gwhAnio*25/1000;
  const ventaAnual = mwhAnio * precio; // U$S/año

  setNum('r-mw',    potTotal, v=>v.toFixed(1)+' MW');
  setNum('r-gwh',   gwhAnio,  v=>v.toFixed(1)+' GWh');
  setNum('r-hog-n', hogares,  v=>fmt(v,0));
  document.getElementById('r-hog-unit').textContent= 'a '+hog.toFixed(1)+' MWh/año';
  setNum('r-gwh-u', gwhUnit,  v=>v.toFixed(2)+' GWh');
  setNum('r-co2',   co2t,     v=>fmt(v,0)+' t');
  document.getElementById('r-co2-sub').textContent = 'factor '+co2f.toFixed(2)+' kg CO₂/kWh';
  setNum('r-horas', horas,    v=>v.toFixed(0)+' hs');
  setNum('r-25y',   gwh25,    v=>v.toFixed(2)+' TWh');

  // Draw diagram — returns supKm2
  let diag;
  if (keepPositions) {
    const sN=lastN,sP=lastSepPar,sT=lastSepTrans,sD=lastDiam;
    lastN=n;lastSepPar=sepPar;lastSepTrans=sepTrans;lastDiam=diam;
    diag=drawParkDiagram(n,diam,sepPar,sepTrans);
    lastN=sN;lastSepPar=sP;lastSepTrans=sT;lastDiam=sD;
  } else {
    diag=drawParkDiagram(n,diam,sepPar,sepTrans);
  }

  // ── FIX 4: Use hull area when manual, grid area otherwise ──
  let supKm2 = diag.supKm2;
  const huellaKm2 = supKm2*0.02;
  const densidad  = potTotal/Math.max(supKm2,0.001);
  const distParM  = sepPar*diam, distTransM=sepTrans*diam;
  const CANVAS_AR = 930/480;
  const filas2 = diag.rows;
  const cols2  = diag.cols;
  
document.getElementById('r-dist').textContent    = `↑${distParM.toFixed(0)} m / →${distTransM.toFixed(0)} m`;
  document.getElementById('r-sup').textContent     = fmtSup(supKm2);
  document.getElementById('r-huella').textContent  = fmtSup(huellaKm2);
  document.getElementById('r-dens').textContent    = densidad.toFixed(2)+' MW/km²';
  document.getElementById('r-libre').textContent   = '~98%';
  document.getElementById('r-layout').textContent = filas2 + ' × ' + cols2;
   document.getElementById('r-layout-sub').textContent =
    	(useStagger ? 'Desfasado' : 'Alineado') +
   	 (parkRotDeg !== 0 ? ' · ' + (parkRotDeg > 0 ? '+' : '') + parkRotDeg + '° Rot.' : ' · Sin Rotación');
  document.getElementById('land-bar-fill').style.width='2%';
  document.getElementById('land-bar-text').textContent='~2% infra';
  document.getElementById('formula-live').innerHTML=
    `<span>${n}</span> × <span>${mw.toFixed(1)} MW</span> × <span>8.760 hs</span> × <span>${fc}%</span> / 1000 = <span style="color:var(--accent)">${gwhAnio.toFixed(1)} GWh/año</span>`;

  if(!keepPositions) ['r-mw','r-gwh','r-hog-n'].forEach(flashEl);

  // Parámetros para el loop de animación (palas + viento)
  parkParams = { n, diam, sepPar, sepTrans, fc };

  // Update shared state for eco tab
  sharedState = { potTotal, gwhAnio, mwhAnio, fc, n, mw };
  // Refresh eco tab if visible
  if (document.getElementById('tab-eco').classList.contains('active')) calcEco();
}

// ── ROWS CONTROL ─────────────────────────────────────────────────────────────
function initRowsControl() {
  const decBtn   = document.getElementById('rows-dec-btn');
  const incBtn   = document.getElementById('rows-inc-btn');
  const resetBtn = document.getElementById('rows-reset-btn');
  const display  = document.getElementById('rows-display');
  const dispVal  = document.getElementById('rows-display-val');

  // Get current auto rows for clamping
  function getCurrentAutoRows() {
    const n  = parseInt(document.getElementById('sl-n').value);
    const sepPar   = parseFloat(document.getElementById('sl-sep-par').value);
    const sepTrans = parseFloat(document.getElementById('sl-sep-trans').value);
    const diam = parseInt(document.getElementById('sl-diam').value);
    const distParM = sepPar*diam, distTransM = sepTrans*diam;
    const W=930, H=480;
    const autoCols = Math.max(1, Math.ceil(Math.sqrt(n*(distTransM/distParM)*(W/H))));
    return Math.ceil(n / autoCols);
  }

  function applyRows(r) {
    const n = parseInt(document.getElementById('sl-n').value);
    userRows = Math.max(1, Math.min(n, r));
    calcParque(true);
  }

  function resetAuto() {
    userRows = null;
    calcParque(true);
  }

  decBtn.addEventListener('click', () => {
    const cur = userRows ?? getCurrentAutoRows();
    applyRows(cur - 1);
  });

  incBtn.addEventListener('click', () => {
    const cur = userRows ?? getCurrentAutoRows();
    applyRows(cur + 1);
  });

  resetBtn.addEventListener('click', resetAuto);

  // ── Option B: click display → inline editable input ──
  let editing = false;

  display.addEventListener('click', () => {
    if (editing) return;
    editing = true;

    const cur = userRows ?? getCurrentAutoRows();

    // Replace span with input
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'rows-input-edit';
    inp.value = cur;
    inp.min = 1;
    inp.max = parseInt(document.getElementById('sl-n').value);

    dispVal.style.display = 'none';
    display.querySelector('.rows-display-label').style.display = 'none';
    display.appendChild(inp);
    inp.focus();
    inp.select();

    function commit() {
      if (!editing) return;
      editing = false;
      const v = parseInt(inp.value);
      display.removeChild(inp);
      dispVal.style.display = '';
      display.querySelector('.rows-display-label').style.display = '';
      if (!isNaN(v) && v >= 1) applyRows(v);
      else calcParque(true); // just redraw to restore display
    }

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') { editing=false; inp.value=cur; commit(); }
    });
    inp.addEventListener('blur', commit);
    inp.addEventListener('click', e => e.stopPropagation());
  });
}

// ── INFORME IMPRIMIBLE / PDF ───────────────────────────────────────────────────
function generarInforme() {
  // 1) Asegurar cálculos frescos sin re-randomizar el layout del parque
  try { calcParque(true); } catch (e) {}
  try { calcEco(); } catch (e) {}

  const txt = id => { const el = document.getElementById(id); return el ? el.textContent.trim() : '—'; };
  const set = (repId, val) => { const el = document.getElementById(repId); if (el) el.textContent = val; };

  // 2) Fecha del informe
  set('rep-fecha', new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }));

  // 3) Titulares (valores ya formateados desde el dimensionado)
  set('rep-pot', txt('e-potTotal') + ' MW');
  set('rep-gen', txt('e-gwhAnio') + ' GWh/año');
  set('rep-fc',  txt('e-fc') + ' %');

  // 4) Mapear KPIs económicos: { idInforme: idOrigen }
  const map = {
    'rep-capex': 'e-capex', 'rep-ingreso': 'e-ingreso', 'rep-opex': 'e-opex-val',
    'rep-ebitda': 'e-flujo', 'rep-payback': 'e-payback', 'rep-payback-disc': 'e-payback-disc',
    'rep-lcoe': 'e-lcoe', 'rep-flujoacum': 'e-flujoacum-post',
    'rep-van': 'e-van', 'rep-van-post': 'e-van-post',
    'rep-tir': 'e-tir', 'rep-tir-post': 'e-tir-post',
    'rep-ganancia': 'e-ganancia', 'rep-park-info': 'diagram-info',
    'rep-precio': 'out-precio', 'rep-inversion': 'out-inversion',
    'rep-wacc': 'out-wacc', 'rep-degrad': 'out-degrad', 'rep-vida': 'out-vida',
    'rep-alicuota': 'out-alicuota',
    // Parámetros de dimensionado (entradas)
    'rep-n': 'out-n', 'rep-mw': 'out-mw', 'rep-diam': 'out-diam',
    'rep-seppar': 'out-sep-par', 'rep-septrans': 'out-sep-trans',
    'rep-wind': 'out-wind-dir', 'rep-rot': 'out-park-rot',
    'rep-hog': 'out-hog', 'rep-co2f': 'out-co2f',
    // Resultados del dimensionado (salidas)
    'rep-hogares': 'r-hog-n', 'rep-co2': 'r-co2', 'rep-horas': 'r-horas',
    'rep-gwhu': 'r-gwh-u', 'rep-25y': 'r-25y', 'rep-sup': 'r-sup',
    'rep-huella': 'r-huella', 'rep-dens': 'r-dens', 'rep-dist': 'r-dist',
    'rep-layout': 'r-layout'
  };
  Object.entries(map).forEach(([rep, src]) => set(rep, txt(src)));

  // Separación combinada (filas · entre turbinas)
  set('rep-sep', txt('out-sep-par') + ' · ' + txt('out-sep-trans'));

  // OPEX: respetar el modo activo para no contradecir el KPI en M U$S.
  // En modo desagregado el % del slider no aplica → mostrar el OPEX real.
  set('rep-opexpct', opexMode === 'desg'
    ? 'Desagregado · ' + txt('e-opex-val') + ' U$S/año'
    : txt('out-opex'));

  // 5) Capturar los gráficos canvas como imágenes
  const snap = (canvasId, imgId) => {
    const c = document.getElementById(canvasId);
    const img = document.getElementById(imgId);
    if (c && img) { try { img.src = c.toDataURL('image/png'); } catch (e) {} }
  };
  cashflowHover = -1; redrawCashflow();   // gráfico limpio (sin tooltip / barrido) para el PDF
  snap('park-canvas', 'rep-img-park');
  snap('cashflow-canvas', 'rep-img-cashflow');

  // 6) Nombre sugerido del PDF: el navegador usa document.title como nombre
  //    de archivo. Lo cambiamos temporalmente para incluir la potencia y lo
  //    restauramos al terminar de imprimir.
  const tituloPrevio = document.title;
  const pot = txt('e-potTotal');
  document.title = `Parque LaSuMa - ${pot} MW - Informe`;
  const restaurarTitulo = () => {
    document.title = tituloPrevio;
    window.removeEventListener('afterprint', restaurarTitulo);
  };
  window.addEventListener('afterprint', restaurarTitulo);

  // 7) Imprimir → el usuario elige "Guardar como PDF". Esperar un frame
  //    para que las imágenes recién asignadas estén pintadas.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.print();
    setTimeout(restaurarTitulo, 1500); // respaldo si afterprint no dispara
  }));
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
function exportarParque() {
  // Collect current slider values
  const sliders = [
    'sl-n','sl-mw','sl-fc','sl-sep-par','sl-sep-trans',
    'sl-diam','sl-hog','sl-co2f',
    'sl-precio','sl-inversion','sl-opex','sl-wacc','sl-degrad','sl-vida',
    'sl-alicuota','sl-mueblespct'
  ];
  // Inputs numéricos sin slider asociado (OPEX desagregado + esquema fiscal)
  const numInputs = [
    'num-om','num-arrend','num-seg','num-cammesa','num-admin','num-bop',
    'num-mueblesanos','num-civilanos','num-quebvenc'
  ];
  const vals = {};
  [...sliders, ...numInputs].forEach(id => {
    const el = document.getElementById(id);
    if (el) vals[id] = el.value;
  });

  // Get current state
  const potTotal = sharedState.potTotal || (parseInt(vals['sl-n']) * parseFloat(vals['sl-mw']));
  const fileName = `Parque LaSuMa - ${potTotal.toFixed(1)} MW.html`;

  // Read full HTML source and patch all slider values + windDeg + userRows
  let html = document.documentElement.outerHTML;

  // Patch each slider / number-input value=
  [...sliders, ...numInputs].forEach(id => {
    // Replace value="X" for the specific input id
    // Use a regex that matches the input tag with this id
    const re = new RegExp(
      `(id="${id}"[^>]*?)\\bvalue="[^"]*"`,
      'g'
    );
    html = html.replace(re, `$1value="${vals[id]}"`);
    // Also handle value= before id= ordering
    const re2 = new RegExp(
      `(\\bvalue="[^"]*")((?:[^>]*?)id="${id}")`,
      'g'
    );
    html = html.replace(re2, `value="${vals[id]}"$2`);
  });

  // Patch windDeg initial value in JS
  html = html.replace(
    /let windDeg\s*=\s*[\d.]+;/,
    `let windDeg = ${windDeg};`
  );

  // Patch parkRotDeg initial value in JS
  html = html.replace(
    /let parkRotDeg\s*=\s*-?[\d.]+;/,
    `let parkRotDeg = ${parkRotDeg};`
  );

  // Patch userRows initial value in JS
  html = html.replace(
    /let userRows\s*=\s*[^;]+;/,
    `let userRows = ${userRows === null ? 'null' : userRows};`
  );

  // Patch useStagger initial value in JS
  html = html.replace(
    /let useStagger\s*=\s*[^;]+;/,
    `let useStagger = ${useStagger};`
  );

  // Patch opexMode initial value in JS
  html = html.replace(
    /let opexMode\s*=\s*'[^']*';/,
    `let opexMode = '${opexMode}';`
  );

  // Trigger download
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── INIT ──────────────────────────────────────────────────────────────────────

// Parque sliders
document.querySelectorAll('#tab-parque input[type=range]').forEach(sl=>{
  sl.addEventListener('input',()=>scheduleCalcParque(false));
});

// Decimales por input
const ecoDec = id => (id.includes('inversion') ? 2 : id.includes('mueblespct') ? 0 : 1);

// Eco sliders — only recalc eco
['sl-inversion','sl-opex','sl-wacc','sl-degrad','sl-vida','sl-precio','sl-alicuota','sl-mueblespct'].forEach(id=>{
  const sl = document.getElementById(id);
  if (!sl) return;
  sl.addEventListener('input', () => {
    const numId = id.replace('sl-','num-');
    const numEl = document.getElementById(numId);
    if (numEl) numEl.value = parseFloat(sl.value).toFixed(ecoDec(id));
    scheduleCalcEco();
  });
});

[['num-inversion','sl-inversion'],['num-opex','sl-opex'],['num-wacc','sl-wacc'],['num-precio','sl-precio'],
 ['num-alicuota','sl-alicuota'],['num-mueblespct','sl-mueblespct']].forEach(([numId,slId])=>{
  const numEl = document.getElementById(numId);
  const slEl  = document.getElementById(slId);
  if (!numEl || !slEl) return;
  numEl.addEventListener('input', () => {
    const v = parseFloat(numEl.value);
    if (!isNaN(v)) { slEl.value = Math.min(parseFloat(slEl.max), Math.max(parseFloat(slEl.min), v)); }
    scheduleCalcEco();
  });
  numEl.addEventListener('change', () => {
    const v = parseFloat(numEl.value);
    if (!isNaN(v)) {
      const clamped = Math.min(parseFloat(slEl.max), Math.max(parseFloat(slEl.min), v));
      numEl.value = clamped.toFixed(ecoDec(numId));
      slEl.value  = clamped;
    }
    calcEco();
  });
});

// Inputs numéricos sin slider (OPEX desagregado + años/vencimiento fiscal)
['num-om','num-arrend','num-seg','num-cammesa','num-admin','num-bop',
 'num-mueblesanos','num-civilanos','num-quebvenc'].forEach(id=>{
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', calcEco);
});

// Aplicar el estado visual del modo OPEX según `opexMode`
function applyOpexModeUI() {
  const btn  = document.getElementById('opex-mode-btn');
  const desg = document.getElementById('opex-desg');
  const pct  = document.getElementById('opex-pct');
  if (!btn || !desg || !pct) return;
  if (opexMode === 'desg') {
    desg.style.display = ''; pct.style.display = 'none';
    btn.textContent = '⊞ Desagregado'; btn.classList.add('active');
  } else {
    desg.style.display = 'none'; pct.style.display = '';
    btn.textContent = '% CAPEX'; btn.classList.remove('active');
  }
}

// Toggle modo OPEX: desagregado ↔ % CAPEX
function toggleOpexMode() {
  opexMode = opexMode === 'desg' ? 'pct' : 'desg';
  applyOpexModeUI();
  calcEco();
}

applyOpexModeUI();
initCompass();
initParkCompass();
initCanvasDrag();
initRowsControl();
initCashflowHover();
calcParque(false);

// Animación: palas girando + partículas de viento
initWindParticles();
requestAnimationFrame(parkAnimLoop);
