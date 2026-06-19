// ── SHARED STATE ──────────────────────────────────────────────────────────────
let sharedState = { potTotal:0, gwhAnio:0, mwhAnio:0, fc:45, n:15, mw:6.2 };

// OPEX input mode: 'desg' = desagregado por componentes · 'pct' = % del CAPEX (modo simple)
let opexMode = 'desg';

// ── TAB SWITCHING ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.getElementById('tab-btn-'+tab).classList.add('active');
  if (tab === 'eco') { calcEco(); animateCashflowIn(); }
}

// ── FINANCIAL MODEL ───────────────────────────────────────────────────────────
// Proyección año a año: degradación de energía, OPEX (desagregado o % CAPEX),
// EBITDA, amortización acelerada RIGI, quebrantos trasladables (FIFO con
// vencimiento) e impuesto a las ganancias. Devuelve una fila por año.
function buildProjection(p) {
  // Amortización acelerada (RIGI)
  const mueblesTot   = p.mueblesPct/100 * p.capex;        // bienes muebles
  const civilTot     = (1 - p.mueblesPct/100) * p.capex;  // obra civil / infra
  const mueblesAnnual = p.mueblesAnos > 0 ? mueblesTot / p.mueblesAnos : 0;
  const civilAnnual   = p.civilAnos  > 0 ? civilTot   / p.civilAnos   : 0;

  // OPEX fijo (modo desagregado): O&M + seguros + cargos fijos
  const opexFijo = p.om * p.potTotalKw          // O&M Vestas (USD/kW-año × kW)
                 + p.seg/100 * p.capex          // seguros (% CAPEX)
                 + (p.cammesa + p.admin + p.bop) * 1e6; // cargos fijos (M USD → USD)

  const rows = [];
  let losses = []; // quebrantos: { year, amt } — más antiguos primero (FIFO)

  for (let t = 1; t <= p.vida; t++) {
    const factor  = Math.pow(1 - p.degrad/100, t-1);
    const energia = p.e1 * factor;               // MWh del año t
    const ingreso = energia * p.precio;          // USD
    const arrend  = p.opexMode === 'desg' ? p.arrend/100 * ingreso : 0;
    const opex    = p.opexMode === 'desg'
                  ? opexFijo + arrend
                  : p.capex * p.opexPct/100;
    const ebitda  = ingreso - opex;

    // Base imponible = EBITDA − amortización del año
    const amort = (t <= p.mueblesAnos ? mueblesAnnual : 0)
                + (t <= p.civilAnos  ? civilAnnual   : 0);
    const base  = ebitda - amort;

    // Vencimiento de quebrantos: utilizable hasta el año (origen + vencimiento)
    losses = losses.filter(l => t <= l.year + p.quebVenc);

    let taxable = 0, usedLoss = 0;
    if (base < 0) {
      losses.push({ year: t, amt: -base });      // se genera quebranto
    } else {
      taxable = base;
      for (const l of losses) {                  // compensar FIFO (más antiguos primero)
        if (taxable <= 0) break;
        const use = Math.min(taxable, l.amt);
        l.amt -= use; taxable -= use; usedLoss += use;
      }
      losses = losses.filter(l => l.amt > 1e-6);
    }
    const tax = Math.max(0, taxable) * p.alicuota/100;

    rows.push({
      t, energia, ingreso, arrend, opex, ebitda, amort, base, usedLoss, tax,
      flowPre:  ebitda,        // flujo antes de impuestos (operativo)
      flowPost: ebitda - tax   // flujo después de impuestos (inversor)
    });
  }
  return rows;
}

// VAN sobre una serie de flujos (key = 'flowPre' | 'flowPost')
function npvOf(rows, key, capex, rate) {
  let v = -capex;
  rows.forEach(r => v += r[key] / Math.pow(1 + rate/100, r.t));
  return v;
}

// TIR por bisección. Null si los flujos sin descontar no cubren el CAPEX.
function irrOf(rows, key, capex) {
  let sum = 0; rows.forEach(r => sum += r[key]);
  if (sum <= capex) return null;
  let lo = 0, hi = 5.0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    npvOf(rows, key, capex, mid*100) > 0 ? (lo = mid) : (hi = mid);
    if (hi - lo < 1e-9) break;
  }
  return (lo + hi) / 2 * 100;
}

// Payback. rate=null → simple (sin descontar); rate=wacc → descontado.
function paybackOf(rows, key, capex, rate) {
  let acum = 0;
  for (const r of rows) {
    acum += rate == null ? r[key] : r[key] / Math.pow(1 + rate/100, r.t);
    if (acum >= capex) return r.t;
  }
  return null;
}

// LCOE = (CAPEX + Σ OPEX descontado) / Σ energía descontada  [USD/MWh]
function lcoeOf(rows, capex, rate) {
  let pvOpex = 0, pvE = 0;
  rows.forEach(r => {
    const df = Math.pow(1 + rate/100, r.t);
    pvOpex += r.opex / df;
    pvE    += r.energia / df;
  });
  return pvE > 0 ? (capex + pvOpex) / pvE : null;
}

// ── ESTADO DEL GRÁFICO DE CASHFLOW (animación de entrada + tooltip) ───────────
let cashflowState = null;   // series + escalas, para mapear el hover
let cashflowLast  = null;   // últimos {rows, capex, wacc} para redibujar
let cashflowHover = -1;     // índice de año bajo el cursor (−1 = ninguno)
let _cashflowRAF  = 0;

// ── CASHFLOW CHART ────────────────────────────────────────────────────────────
// prog ∈ [0,1] controla el barrido animado de entrada (clip horizontal).
function drawCashflowChart(rows, capex, wacc, prog) {
  const canvas = document.getElementById('cashflow-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // Nitidez en pantallas de alta densidad: el buffer interno se escala por DPR
  // mientras el dibujo sigue en coordenadas lógicas (W×H constantes).
  const W = 580, H = 220;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const padL=56, padR=24, padT=22, padB=38;
  const cW = W-padL-padR, cH = H-padT-padB;
  const vida = rows.length;

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#f8faf8'; ctx.fillRect(0,0,W,H);

  // Series acumuladas: pre-impuestos (simple), post-impuestos (simple) y post-impuestos descontado
  const pre=[-capex], post=[-capex], postDisc=[-capex];
  rows.forEach((r,i) => {
    pre.push(pre[i] + r.flowPre);
    post.push(post[i] + r.flowPost);
    postDisc.push(postDisc[i] + r.flowPost / Math.pow(1+wacc/100, r.t));
  });

  const allVals = [...pre, ...post, ...postDisc];
  const minV = Math.min(...allVals), maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const xS = i => padL + (i/vida)*cW;
  const yS = v => padT + cH - ((v-minV)/range)*cH;

  if (prog == null) prog = 1;
  cashflowLast  = { rows, capex, wacc };
  cashflowState = { pre, post, postDisc, capex, wacc, vida, minV, maxV, padL, padT, cW, cH, xS, yS };

  // Y-axis grid lines + labels
  const nTicks = 5;
  for (let i=0; i<=nTicks; i++) {
    const v = minV + (maxV-minV)*i/nTicks;
    const y = yS(v);
    ctx.strokeStyle='rgba(0,0,0,0.06)'; ctx.lineWidth=1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+cW,y); ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.font="9px 'DM Mono',monospace";
    ctx.textAlign='right'; ctx.textBaseline='middle';
    const lbl = Math.abs(v)>=1e6 ? (v/1e6).toFixed(1)+'M' : (v/1e3).toFixed(0)+'k';
    ctx.fillText(lbl, padL-4, y);
  }

  // Zero line
  if (minV < 0 && maxV > 0) {
    const y0 = yS(0);
    ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(padL,y0); ctx.lineTo(padL+cW,y0); ctx.stroke();
    ctx.setLineDash([]);
  }

  // X-axis labels
  ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.textAlign='center'; ctx.textBaseline='top';
  const step = vida <= 20 ? 5 : 10;
  for (let t=0; t<=vida; t+=step)
    ctx.fillText(t+'a', xS(t), padT+cH+6);

  // ── Curvas, con barrido de entrada animado (clip horizontal) ──
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT-8, Math.max(0, cW*prog), cH+16);
  ctx.clip();

  // Relleno bajo la curva post-impuestos — degradado vertical
  const fillGrad = ctx.createLinearGradient(0, padT, 0, padT+cH);
  fillGrad.addColorStop(0, 'rgba(26,79,160,0.20)');
  fillGrad.addColorStop(1, 'rgba(26,79,160,0.01)');
  ctx.beginPath();
  post.forEach((v,i) => i===0 ? ctx.moveTo(xS(i),yS(v)) : ctx.lineTo(xS(i),yS(v)));
  ctx.lineTo(xS(vida), yS(Math.max(0,minV)));
  ctx.lineTo(xS(0),    yS(Math.max(0,minV)));
  ctx.closePath();
  ctx.fillStyle=fillGrad; ctx.fill();

  // Pre-tax line (verde — operativo)
  ctx.beginPath();
  pre.forEach((v,i) => i===0 ? ctx.moveTo(xS(i),yS(v)) : ctx.lineTo(xS(i),yS(v)));
  ctx.strokeStyle='rgba(26,122,48,0.7)'; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.setLineDash([]); ctx.stroke();

  // Post-tax line (azul sólido — inversor) con leve glow
  ctx.save();
  ctx.shadowColor='rgba(26,79,160,0.35)'; ctx.shadowBlur=6;
  ctx.beginPath();
  post.forEach((v,i) => i===0 ? ctx.moveTo(xS(i),yS(v)) : ctx.lineTo(xS(i),yS(v)));
  ctx.strokeStyle='rgba(26,79,160,0.92)'; ctx.lineWidth=2.5; ctx.lineJoin='round'; ctx.setLineDash([]); ctx.stroke();
  ctx.restore();

  // Post-tax discounted line (azul punteado)
  ctx.beginPath();
  postDisc.forEach((v,i) => i===0 ? ctx.moveTo(xS(i),yS(v)) : ctx.lineTo(xS(i),yS(v)));
  ctx.strokeStyle='rgba(26,79,160,0.5)'; ctx.lineWidth=1.5; ctx.setLineDash([5,3]); ctx.stroke();
  ctx.setLineDash([]);

  // Payback markers (post-impuestos)
  const pb  = paybackOf(rows, 'flowPost', capex, null);
  const pbd = paybackOf(rows, 'flowPost', capex, wacc);
  [[pb,'rgba(26,79,160,0.9)','PB'],[pbd,'rgba(26,79,160,0.6)','PBD']].forEach(([yr,col,lbl])=>{
    if (!yr) return;
    const xp=xS(yr), yp=yS(0);
    ctx.beginPath(); ctx.arc(xp,yp,5,0,Math.PI*2);
    ctx.fillStyle=col; ctx.fill();
    ctx.fillStyle=col; ctx.font="bold 9px 'DM Mono',monospace";
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText(lbl+' '+yr+'a', xp, yp-9);
  });

  ctx.restore(); // fin del clip de barrido

  // Legend
  const lx=padL+10, ly=padT+4;
  ctx.fillStyle='rgba(255,255,255,0.88)';
  ctx.beginPath(); ctx.roundRect(lx-6,ly-4,182,56,4); ctx.fill();
  ctx.strokeStyle='rgba(26,122,48,0.7)'; ctx.lineWidth=2; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(lx,ly+8); ctx.lineTo(lx+18,ly+8); ctx.stroke();
  ctx.fillStyle='#0f1f0f'; ctx.font="10px 'DM Mono',monospace"; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText('Acum. antes de imp.', lx+24, ly+8);
  ctx.strokeStyle='rgba(26,79,160,0.85)'; ctx.lineWidth=2.5; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(lx,ly+25); ctx.lineTo(lx+18,ly+25); ctx.stroke();
  ctx.fillText('Acum. después de imp.', lx+24, ly+25);
  ctx.strokeStyle='rgba(26,79,160,0.55)'; ctx.lineWidth=1.5; ctx.setLineDash([5,3]);
  ctx.beginPath(); ctx.moveTo(lx,ly+42); ctx.lineTo(lx+18,ly+42); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText('Después de imp. descontado', lx+24, ly+42);

  // Tooltip interactivo, por encima de todo (solo con el gráfico ya completo)
  if (prog >= 1 && cashflowHover >= 0 && cashflowHover <= vida) drawCashflowTooltip(ctx);
}

// Tooltip: guía vertical + puntos sobre las series + caja con valores del año
function drawCashflowTooltip(ctx) {
  const s = cashflowState; if (!s) return;
  const idx = cashflowHover;
  const x = s.xS(idx);
  ctx.save();
  // Guía vertical
  ctx.strokeStyle='rgba(26,79,160,0.35)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(x, s.padT); ctx.lineTo(x, s.padT+s.cH); ctx.stroke();
  ctx.setLineDash([]);
  // Puntos sobre cada serie
  [[s.pre[idx],'rgba(26,122,48,0.95)'],[s.post[idx],'rgba(26,79,160,0.95)'],[s.postDisc[idx],'rgba(26,79,160,0.55)']]
    .forEach(([v,c])=>{
      ctx.beginPath(); ctx.arc(x, s.yS(v), 3.6, 0, Math.PI*2);
      ctx.fillStyle=c; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.stroke();
    });
  // Caja de valores
  const money = v => Math.abs(v)>=1e6 ? (v/1e6).toFixed(2)+'M' : (v/1e3).toFixed(0)+'k';
  const lines = ['Año '+idx, 'Antes imp.: '+money(s.pre[idx]), 'Después imp.: '+money(s.post[idx]), 'Desc.: '+money(s.postDisc[idx])];
  ctx.font="9px 'DM Mono',monospace"; ctx.textAlign='left'; ctx.textBaseline='top';
  let tw=0; lines.forEach(l=> tw=Math.max(tw, ctx.measureText(l).width));
  const bw=tw+16, bh=lines.length*13+8;
  let bx = x+12; if (bx+bw > s.padL+s.cW) bx = x-12-bw;
  const by = s.padT+4;
  ctx.fillStyle='rgba(255,255,255,0.96)'; ctx.strokeStyle='rgba(26,79,160,0.25)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill(); ctx.stroke();
  lines.forEach((l,i)=>{
    ctx.fillStyle = i===0 ? '#0f1f0f' : 'rgba(0,0,0,0.66)';
    ctx.font = (i===0?'bold ':'')+"9px 'DM Mono',monospace";
    ctx.fillText(l, bx+8, by+6+i*13);
  });
  ctx.restore();
}

// Redibuja el gráfico completo con el último dataset (para hover)
function redrawCashflow() {
  if (cashflowLast) drawCashflowChart(cashflowLast.rows, cashflowLast.capex, cashflowLast.wacc, 1);
}

// Barrido de entrada animado (se dispara al abrir el tab económico)
function animateCashflowIn() {
  if (!cashflowLast) return;
  if (_cashflowRAF) cancelAnimationFrame(_cashflowRAF);
  const dur = 680, t0 = performance.now();
  const last = cashflowLast;
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    drawCashflowChart(last.rows, last.capex, last.wacc, eased);
    _cashflowRAF = p < 1 ? requestAnimationFrame(step) : 0;
  };
  _cashflowRAF = requestAnimationFrame(step);
}

// Hover / scrub sobre el gráfico → muestra el tooltip del año
function initCashflowHover() {
  const canvas = document.getElementById('cashflow-canvas'); if (!canvas) return;
  const idxFromEvent = e => {
    const s = cashflowState; if (!s) return -1;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * (580 / rect.width);
    const idx = Math.round((cx - s.padL) / s.cW * s.vida);
    return (idx >= 0 && idx <= s.vida) ? idx : -1;
  };
  const onMove = e => {
    const i = idxFromEvent(e);
    if (i !== cashflowHover) { cashflowHover = i; redrawCashflow(); }
    if (e.touches && e.cancelable) e.preventDefault();
  };
  const onLeave = () => { if (cashflowHover !== -1) { cashflowHover = -1; redrawCashflow(); } };
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('touchstart', onMove, { passive:false });
  canvas.addEventListener('touchmove',  onMove, { passive:false });
  canvas.addEventListener('touchend',   onLeave);
}

// ── MAIN ECO CALC ─────────────────────────────────────────────────────────────
const numVal = (id, def) => {
  const el = document.getElementById(id);
  const v = el ? parseFloat(el.value) : NaN;
  return isNaN(v) ? def : v;
};

function calcEco() {
  // Read eco sliders
  const wacc    = parseFloat(document.getElementById('sl-wacc').value);
  const inver   = parseFloat(document.getElementById('sl-inversion').value);
  const opexPct = parseFloat(document.getElementById('sl-opex').value);
  const vida    = parseInt(document.getElementById('sl-vida').value);
  const degrad  = parseFloat(document.getElementById('sl-degrad').value);
  const precio  = parseFloat(document.getElementById('sl-precio').value);

  // OPEX desagregado
  const om      = numVal('num-om', 36);        // USD/kW-año
  const arrend  = numVal('num-arrend', 3);     // % de ingresos
  const seg     = numVal('num-seg', 0.4);      // % CAPEX
  const cammesa = numVal('num-cammesa', 0.30); // M USD
  const admin   = numVal('num-admin', 0.30);   // M USD
  const bop     = numVal('num-bop', 0.20);     // M USD

  // Parámetros fiscales (RIGI)
  const alicuota   = numVal('num-alicuota', 25);   // %
  const mueblesPct = numVal('num-mueblespct', 75); // % CAPEX
  const mueblesAnos= Math.max(1, Math.round(numVal('num-mueblesanos', 2)));
  const civilAnos  = Math.max(1, Math.round(numVal('num-civilanos', 12)));
  const quebVenc   = Math.max(0, Math.round(numVal('num-quebvenc', 5)));

  // Pull from shared parque state
  const { potTotal, mwhAnio, gwhAnio, fc, n, mw } = sharedState;

  // ── Labels & fill ──
  document.getElementById('out-inversion').textContent = inver.toFixed(2)+' M U$S/MW';
  document.getElementById('out-opex').textContent      = opexPct.toFixed(1)+' % CAPEX';
  document.getElementById('out-wacc').textContent      = wacc.toFixed(1)+' %';
  document.getElementById('out-degrad').textContent    = degrad.toFixed(1)+' %/año';
  document.getElementById('out-vida').textContent      = vida+' años';
  document.getElementById('out-precio').textContent    = precio.toFixed(1)+' U$S/MWh';
  document.getElementById('out-alicuota').textContent  = alicuota.toFixed(1)+' %';
  document.getElementById('out-mueblespct').textContent= mueblesPct.toFixed(0)+' %';
  const civilPctEl = document.getElementById('out-civilpct');
  if (civilPctEl) civilPctEl.textContent = (100-mueblesPct).toFixed(0)+' %';

  // Sync number inputs
  document.getElementById('num-inversion').value = inver.toFixed(2);
  document.getElementById('num-opex').value      = opexPct.toFixed(1);
  document.getElementById('num-wacc').value      = wacc.toFixed(1);
  document.getElementById('num-precio').value    = precio.toFixed(1);
  document.getElementById('num-alicuota').value  = alicuota.toFixed(1);
  document.getElementById('num-mueblespct').value= mueblesPct.toFixed(0);

  ['inversion','opex','wacc','degrad','vida','precio','alicuota','mueblespct']
    .forEach(id => updateFill('sl-'+id,'fill-'+id));

  // Read-only from parque
  setNum('e-potTotal', potTotal, v=>v.toFixed(1));
  setNum('e-gwhAnio',  gwhAnio,  v=>v.toFixed(1));
  document.getElementById('e-fc').textContent       = fc;

  // Venta anual (año 1)
  const ventaAnual = mwhAnio * precio;
  setNum('e-venta', ventaAnual, v => v >= 1e6
    ? 'U$S ' + (v/1e6).toFixed(2) + ' M'
    : 'U$S ' + Math.round(v).toLocaleString('es-AR'));
  document.getElementById('e-venta-sub').textContent = gwhAnio.toFixed(1)+' GWh/año × '+precio.toFixed(1)+' U$S/MWh';

  // ── Build projection ──
  const capex = potTotal * inver * 1e6;          // U$S
  const proj  = buildProjection({
    capex, e1: mwhAnio, precio, vida, degrad,
    potTotalKw: potTotal * 1000,
    opexMode, om, arrend, seg, cammesa, admin, bop, opexPct,
    alicuota, mueblesPct, mueblesAnos, civilAnos, quebVenc
  });
  const r1 = proj[0] || { ingreso:0, opex:0, ebitda:0 };

  // VAN / TIR antes y después de impuestos
  const vanPre  = npvOf(proj, 'flowPre',  capex, wacc);
  const vanPost = npvOf(proj, 'flowPost', capex, wacc);
  const tirPre  = irrOf(proj, 'flowPre',  capex);
  const tirPost = irrOf(proj, 'flowPost', capex);
  const lcoe    = lcoeOf(proj, capex, wacc);

  // Paybacks (post-impuestos)
  const pb  = paybackOf(proj, 'flowPost', capex, null);
  const pbd = paybackOf(proj, 'flowPost', capex, wacc);

  // Flujo neto acumulado post-impuestos (sin descontar) y ganancia neta
  const sumPost = proj.reduce((a,r)=>a+r.flowPost, 0);
  const gananciaNeta = sumPost - capex;

  // ── KPI display ──
  setNum('e-capex',         capex/1e6,     v=>v.toFixed(2)+' M');
  setNum('e-ingreso',       r1.ingreso/1e6,v=>v.toFixed(2)+' M');
  setNum('e-opex-val',      r1.opex/1e6,   v=>v.toFixed(2)+' M');
  setNum('e-flujo',         r1.ebitda/1e6, v=>v.toFixed(2)+' M');
  setNum('e-flujoacum-post',sumPost/1e6,   v=>v.toFixed(1)+' M');

  // Ganancia neta (post-impuestos)
  setNum('e-ganancia', gananciaNeta/1e6, v=>(v>=0?'+':'−')+Math.abs(v).toFixed(1)+' M U$S');
  document.getElementById('e-ganancia').className = 'eco-kpi-val-big '+(gananciaNeta>=0?'positive':'negative');

  // VAN antes / después
  setNum('e-van', vanPre/1e6, v=>v.toFixed(2)+' M');
  document.getElementById('e-van').className = 'eco-kpi-val '+(vanPre>=0?'green':'red');
  setNum('e-van-post', vanPost/1e6, v=>v.toFixed(2)+' M');
  document.getElementById('e-van-post').className = 'eco-kpi-val '+(vanPost>=0?'green':'red');

  // TIR antes / después
  setNum('e-tir', tirPre, v=>v.toFixed(2)+' %');
  document.getElementById('e-tir').className = 'eco-kpi-val '+(tirPre!=null?(tirPre>wacc?'green':'gold'):'red');
  setNum('e-tir-post', tirPost, v=>v.toFixed(2)+' %');
  document.getElementById('e-tir-post').className = 'eco-kpi-val '+(tirPost!=null?(tirPost>wacc?'green':'gold'):'red');

  // LCOE
  setNum('e-lcoe', lcoe, v=>v.toFixed(2)+' U$S');
  document.getElementById('e-lcoe').className = 'eco-kpi-val '+(lcoe!=null && lcoe<precio?'green':'gold');

  // Paybacks
  const pbEl = document.getElementById('e-payback');
  pbEl.textContent = pb!=null ? pb+' años' : '> vida útil';
  pbEl.className   = 'eco-kpi-val '+(pb==null?'red':pb<=vida*0.4?'green':'gold');

  const pbdEl = document.getElementById('e-payback-disc');
  pbdEl.textContent = pbd!=null ? pbd+' años' : '> vida útil';
  pbdEl.className   = 'eco-kpi-val '+(pbd==null?'red':pbd<=vida*0.5?'green':'gold');

  // Chart
  drawCashflowChart(proj, capex, wacc);
}
