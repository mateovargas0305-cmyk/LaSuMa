(function () {
  "use strict";
  var THREE = window.THREE;
  var WORLD = 0.05;            // 1 unidad de mundo = 1 metro * WORLD
  var modal, canvas, hudEl, subEl, loadingEl;
  var renderer, scene, camera, sun, clock;
  var rotors = [];            // pivotes de rotor a animar
  var farm = null;            // grupo que contiene todas las turbinas + terreno
  var raf = 0, isOpen = false, built = false;
  var spinSpeed = 0.9;        // rad/s base, escalado por fc

  // órbita de cámara (esférica alrededor de target)
  var orbit = { theta: 0.85, phi: 1.05, radius: 240, target: new THREE.Vector3(0,0,0) };
  var drag = { on:false, mode:'rotate', x:0, y:0 };
  var pinch = { on:false, d:0 };

  // ── Presets de terreno (relieve + color) ──
  var TERRAINS = {
    pampa:   { name:'Pampa',   ground:0x6f8a4d, sky:0x9ec8ec, a1:1.1, a2:0.5, f1:0.005, f2:0.017, f3:0.020 },
    sierras: { name:'Sierras', ground:0x6e7d56, sky:0x9cc0e0, a1:4.6, a2:2.0, f1:0.009, f2:0.022, f3:0.026 },
    arido:   { name:'Árido',   ground:0xb09869, sky:0xcfd6d2, a1:2.4, a2:1.1, f1:0.007, f2:0.019, f3:0.023 },
    costero: { name:'Costero', ground:0x86a463, sky:0xa9d4ec, a1:0.5, a2:0.25,f1:0.004, f2:0.014, f3:0.017 }
  };
  var currentTerrain = 'pampa';

  function terrainH(x, z) {
    var t = TERRAINS[currentTerrain] || TERRAINS.pampa;
    return (Math.sin(x*t.f1)*Math.cos(z*t.f1)*t.a1
          + Math.sin(x*t.f2+1.3)*t.a2
          + Math.cos(z*t.f3-0.7)*t.a2);
  }

  // ── Geometría de pala (perfil afilado, plano en su grosor) ──
  function bladeGeom(len, rootW, tipW) {
    var s = new THREE.Shape();
    s.moveTo(0, -rootW*0.5);
    s.lineTo(0,  rootW*0.5);
    s.quadraticCurveTo(len*0.45, tipW*1.4, len, tipW*0.55);
    s.lineTo(len, -tipW*0.55);
    s.quadraticCurveTo(len*0.45, -tipW*1.4, 0, -rootW*0.5);
    var g = new THREE.ExtrudeGeometry(s, { depth: rootW*0.28, bevelEnabled:false, curveSegments:6 });
    g.translate(0,0,-rootW*0.14);
    return g;
  }

  var MAT = {};
  function initMaterials() {
    MAT.tower   = new THREE.MeshStandardMaterial({ color:0xf2f4f6, roughness:0.55, metalness:0.1 });
    MAT.nacelle = new THREE.MeshStandardMaterial({ color:0xe8ebef, roughness:0.5,  metalness:0.15 });
    MAT.blade   = new THREE.MeshStandardMaterial({ color:0xfbfcfd, roughness:0.4,  metalness:0.05, side:THREE.DoubleSide });
    MAT.ground  = new THREE.MeshStandardMaterial({ color:0x6f8a4d, roughness:1 });
    MAT.road    = new THREE.MeshStandardMaterial({ color:0xe7ddc8, roughness:0.95, metalness:0, emissive:0x6b5f44, emissiveIntensity:0.5 }); // ripio claro
  }

  // Construye una cinta de camino que sigue el terreno desde una polilínea en metros
  function buildRoadMesh(ptsM, widthW) {
    if (!ptsM || ptsM.length < 2) return null;
    var cl = ptsM.map(function(p){ return { x:p.x*WORLD, y:p.z*WORLD }; });  // centerline (x,z) en mundo
    // resamplear cada ~6 unidades para que la cinta se adapte al relieve
    var step = 6, samples = [];
    for (var i=0;i<cl.length-1;i++){
      var a=cl[i], b=cl[i+1], dx=b.x-a.x, dy=b.y-a.y, L=Math.hypot(dx,dy);
      var n=Math.max(1, Math.ceil(L/step));
      for (var j=0;j<n;j++){ samples.push({ x:a.x+dx*(j/n), y:a.y+dy*(j/n) }); }
    }
    samples.push(cl[cl.length-1]);
    var hw=widthW/2, verts=[], idx=[];
    for (var k=0;k<samples.length;k++){
      var p=samples[k];
      var t = (k<samples.length-1) ? { x:samples[k+1].x-p.x, y:samples[k+1].y-p.y }
                                   : { x:p.x-samples[k-1].x, y:p.y-samples[k-1].y };
      var tl=Math.hypot(t.x,t.y)||1; t.x/=tl; t.y/=tl;
      var nx=-t.y, nz=t.x;  // perpendicular en (x,z)
      var lx=p.x+nx*hw, lz=p.y+nz*hw, rx=p.x-nx*hw, rz=p.y-nz*hw;
      verts.push(lx, terrainH(lx,lz)+0.2, lz,  rx, terrainH(rx,rz)+0.2, rz);
    }
    for (var k2=0;k2<samples.length-1;k2++){
      var a2=k2*2, b2=k2*2+1, c2=k2*2+2, d2=k2*2+3;
      idx.push(a2,b2,c2, c2,b2,d2);
    }
    var g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts,3));
    g.setIndex(idx); g.computeVertexNormals();
    var m=new THREE.Mesh(g, MAT.road); m.receiveShadow=true;
    return m;
  }

  function buildTurbine(diamM) {
    var g = new THREE.Group();
    var R    = diamM*0.5  * WORLD;
    var hubH = diamM*0.92 * WORLD;
    var tBot = diamM*0.020* WORLD, tTop = diamM*0.012*WORLD;

    var tower = new THREE.Mesh(new THREE.CylinderGeometry(tTop, tBot, hubH, 18), MAT.tower);
    tower.position.y = hubH/2; tower.castShadow = true; tower.receiveShadow = true;
    g.add(tower);

    var nl = diamM*0.14*WORLD, nw = diamM*0.05*WORLD, nh = diamM*0.05*WORLD;
    var nac = new THREE.Mesh(new THREE.BoxGeometry(nw, nh, nl), MAT.nacelle);
    nac.position.set(0, hubH, -nl*0.12); nac.castShadow = true;
    g.add(nac);

    var pivot = new THREE.Group();
    pivot.position.set(0, hubH, nl*0.5);
    g.add(pivot);

    var hub = new THREE.Mesh(new THREE.ConeGeometry(diamM*0.03*WORLD, diamM*0.06*WORLD, 14), MAT.nacelle);
    hub.rotation.x = Math.PI/2; hub.position.z = diamM*0.025*WORLD; hub.castShadow = true;
    pivot.add(hub);

    var bg = bladeGeom(R*0.96, diamM*0.05*WORLD, diamM*0.008*WORLD);
    for (var b=0; b<3; b++) {
      var blade = new THREE.Mesh(bg, MAT.blade);
      blade.rotation.z = b * 2*Math.PI/3;
      blade.castShadow = true;
      pivot.add(blade);
    }
    pivot.userData.phase = Math.random()*Math.PI*2;  // desfase leve entre turbinas
    return { group:g, pivot:pivot };
  }

  function buildScene() {
    scene = new THREE.Scene();
    var skyCol = new THREE.Color(0x9ec8ec);
    scene.background = skyCol;
    scene.fog = new THREE.Fog(skyCol, 200, 900);

    camera = new THREE.PerspectiveCamera(48, 1, 0.5, 8000);

    var hemi = new THREE.HemisphereLight(0xcfe7ff, 0x55703f, 0.75);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff2da, 1.55);
    sun.position.set(-220, 320, 200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var d = 420;
    sun.shadow.camera.left=-d; sun.shadow.camera.right=d;
    sun.shadow.camera.top=d;  sun.shadow.camera.bottom=-d;
    sun.shadow.camera.near=1; sun.shadow.camera.far=1400;
    sun.shadow.bias = -0.0004;
    scene.add(sun);

    // disco solar visible
    var sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(30, 16, 16),
      new THREE.MeshBasicMaterial({ color:0xfff6e0, fog:false })
    );
    sunDisc.position.copy(sun.position).multiplyScalar(2.2);
    scene.add(sunDisc);

    initMaterials();
    rebuildFarm();

    renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (renderer.outputColorSpace !== undefined && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    clock = new THREE.Clock();
    built = true;
  }

  // (Re)construye el campo de turbinas + terreno desde window._parkState
  function rebuildFarm() {
    var st = window._parkState;
    if (farm) { scene.remove(farm); disposeGroup(farm); farm = null; rotors = []; }
    if (!st || !st.positions || !st.positions.length) return;

    farm = new THREE.Group();
    rotors = [];

    // bounding box (metros) para escala de terreno y encuadre de cámara
    var minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
    st.positions.forEach(function(p){
      if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x;
      if(p.z<minZ)minZ=p.z; if(p.z>maxZ)maxZ=p.z;
    });
    var spanM = Math.max(maxX-minX, maxZ-minZ, st.distParM*2) + st.diamM*4;

    // aplicar preset de terreno (color de suelo + tinte de cielo/niebla)
    var tcfg = TERRAINS[currentTerrain] || TERRAINS.pampa;
    if (MAT.ground) MAT.ground.color.setHex(tcfg.ground);
    if (scene) {
      var sky = new THREE.Color(tcfg.sky);
      scene.background = sky;
      if (scene.fog) scene.fog.color.copy(sky);
    }

    // terreno con relieve muy suave; lo bastante grande para que su borde quede
    // tapado por la niebla (fog far = 900) y el horizonte se funda con el cielo
    var halfWorld = 1300;
    var segs = 120;
    var gGeo = new THREE.PlaneGeometry(halfWorld*2, halfWorld*2, segs, segs);
    var pos = gGeo.attributes.position;
    for (var i=0;i<pos.count;i++){
      // tras rotar el plano -90° en X, localY → -worldZ; muestreo coherente con las turbinas
      pos.setZ(i, terrainH(pos.getX(i), -pos.getY(i)));
    }
    gGeo.computeVertexNormals();
    var ground = new THREE.Mesh(gGeo, MAT.ground);
    ground.rotation.x = -Math.PI/2;
    ground.receiveShadow = true;
    farm.add(ground);

    // orientación: nacelle alineada al eje del viento
    var yaw = Math.atan2(Math.cos(st.windTravRad), Math.sin(st.windTravRad));

    st.positions.forEach(function(p){
      var t = buildTurbine(st.diamM);
      var wx = p.x*WORLD, wz = p.z*WORLD;
      t.group.position.set(wx, terrainH(wx, wz), wz);
      t.group.rotation.y = yaw;
      farm.add(t.group);
      rotors.push(t.pivot);
    });

    // ── Caminos internos (desde el layout 2D) ──
    if (st.roads && st.roads.length) {
      var roadW = Math.max(22, st.diamM*0.15) * WORLD;
      st.roads.forEach(function(r){
        var rm = buildRoadMesh(r, roadW);
        if (rm) farm.add(rm);
      });
    }

    scene.add(farm);

    // encuadre de cámara: vista 3/4 baja e inmersiva, centrada en el parque
    orbit.target.set(0, st.diamM*0.5*WORLD, 0);
    orbit.theta = 0.7; orbit.phi = 1.18;
    orbit.radius = Math.max(70, spanM*WORLD*0.82 + st.diamM*WORLD*1.2);
    spinSpeed = 0.55 + (st.fc||45)/100 * 1.1;

    // HUD
    if (subEl) subEl.textContent = st.n + ' aerogeneradores · ⌀ rotor ' + Math.round(st.diamM) + ' m';
    if (hudEl) {
      hudEl.innerHTML =
        '<span class="p3d-chip">🌀 <b>'+st.n+'</b> turbinas</span>' +
        '<span class="p3d-chip">⌀ rotor <b>'+Math.round(st.diamM)+' m</b></span>' +
        '<span class="p3d-chip">↔ separación <b>'+Math.round(st.distParM)+' / '+Math.round(st.distTransM)+' m</b></span>' +
        '<span class="p3d-chip">💨 factor de capacidad <b>'+Math.round(st.fc||45)+'%</b></span>';
    }
  }

  function disposeGroup(grp) {
    grp.traverse(function(o){
      if (o.geometry) o.geometry.dispose();
    });
  }

  function updateCamera() {
    var sp = Math.max(0.12, Math.min(Math.PI-0.12, orbit.phi));
    orbit.phi = sp;
    var r = orbit.radius;
    var x = r * Math.sin(sp) * Math.cos(orbit.theta);
    var y = r * Math.cos(sp);
    var z = r * Math.sin(sp) * Math.sin(orbit.theta);
    var t = orbit.target;
    camera.position.set(t.x + x, t.y + Math.max(y, 6), t.z + z);
    camera.lookAt(t.x, t.y, t.z);
  }

  function resize() {
    if (!renderer) return;
    var w = modal.clientWidth, h = modal.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function animate() {
    raf = requestAnimationFrame(animate);
    var dt = clock.getDelta();
    for (var i=0;i<rotors.length;i++) {
      rotors[i].rotation.z += spinSpeed * dt;
    }
    updateCamera();
    renderer.render(scene, camera);
  }

  // ── Interacción ──
  function onDown(e) {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    drag.on = true;
    drag.mode = (e.button === 2) ? 'pan' : 'rotate';
    drag.x = e.clientX; drag.y = e.clientY;
  }
  function onMove(e) {
    if (!drag.on) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.mode === 'rotate') {
      orbit.theta -= dx * 0.006;
      orbit.phi   -= dy * 0.006;
    } else {
      // pan: mover el target en el plano horizontal según los ejes de cámara
      var k = orbit.radius * 0.0016;
      var rightX = -Math.sin(orbit.theta), rightZ =  Math.cos(orbit.theta);
      var fwdX   = -Math.cos(orbit.theta), fwdZ   = -Math.sin(orbit.theta);
      var mr = -dx * k, mf = dy * k;
      orbit.target.x += rightX*mr + fwdX*mf;
      orbit.target.z += rightZ*mr + fwdZ*mf;
    }
  }
  function onUp(e) { drag.on = false; }
  function onWheel(e) {
    e.preventDefault();
    var f = Math.exp((e.deltaY > 0 ? 1 : -1) * 0.12);
    orbit.radius = Math.max(20, Math.min(2000, orbit.radius * f));
  }
  function touchDist(t){ var a=t[0],b=t[1]; return Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY); }
  function onTouchStart(e){
    if (e.touches.length === 2){ pinch.on = true; pinch.d = touchDist(e.touches); drag.on=false; }
  }
  function onTouchMove(e){
    if (pinch.on && e.touches.length === 2){
      e.preventDefault();
      var nd = touchDist(e.touches);
      var f = pinch.d / Math.max(1, nd);
      orbit.radius = Math.max(20, Math.min(2000, orbit.radius * f));
      pinch.d = nd;
    }
  }
  function onTouchEnd(e){ if (e.touches.length < 2) pinch.on = false; }

  function bindEvents() {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive:false });
    canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    canvas.addEventListener('touchstart', onTouchStart, { passive:false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive:false });
    canvas.addEventListener('touchend',   onTouchEnd);
    window.addEventListener('resize', function(){ if (isOpen) resize(); });
    document.addEventListener('keydown', function(e){ if (isOpen && e.key === 'Escape') close(); });
  }

  function open() {
    if (!window.THREE) { alert('No se pudo cargar el motor 3D.'); return; }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    isOpen = true;
    if (loadingEl) loadingEl.style.display = 'flex';
    // construir en el próximo frame para que el modal tenga tamaño
    requestAnimationFrame(function(){
      if (!built) { try { buildScene(); } catch(err){ console.error(err); if(loadingEl) loadingEl.textContent='Error al generar la escena'; return; } }
      else { rebuildFarm(); }
      resize();
      if (loadingEl) loadingEl.style.display = 'none';
      if (!raf) animate();
    });
  }
  function close() {
    isOpen = false;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  document.addEventListener('DOMContentLoaded', function () {
    modal     = document.getElementById('park3d-modal');
    canvas    = document.getElementById('park3d-canvas');
    hudEl     = document.getElementById('p3d-hud');
    subEl     = document.getElementById('p3d-sub');
    loadingEl = document.getElementById('p3d-loading');
    var openBtn = document.getElementById('open-3d-btn');
    var closeBtn= document.getElementById('close-3d-btn');
    if (openBtn)  openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    buildTerrainSelector();
    bindEvents();
  });

  // ── Selector de terreno (chips en el overlay del modal) ──
  function setTerrain(id) {
    if (!TERRAINS[id] || id === currentTerrain) return;
    currentTerrain = id;
    var box = document.getElementById('p3d-terrain');
    if (box) Array.prototype.forEach.call(box.children, function(b){
      b.classList.toggle('active', b.getAttribute('data-terrain') === id);
    });
    if (built && isOpen && scene) rebuildFarm();   // re-genera relieve, color, turbinas y caminos
  }
  function buildTerrainSelector() {
    var box = document.getElementById('p3d-terrain');
    if (!box) return;
    box.innerHTML = '';
    Object.keys(TERRAINS).forEach(function(id){
      var b = document.createElement('button');
      b.className = 'p3d-terrain-btn' + (id === currentTerrain ? ' active' : '');
      b.setAttribute('data-terrain', id);
      b.textContent = TERRAINS[id].name;
      b.addEventListener('click', function(){ setTerrain(id); });
      box.appendChild(b);
    });
  }
})();
