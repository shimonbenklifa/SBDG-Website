/* =========================================================
   SB DEVELOPMENT GROUP — interactive 3D massing model
   A stylised city board (Manhattan-inspired) with extruded
   buildings; the four SBDG developments rise as highlighted
   towers you can hover, select, and fly to.

   Built on Three.js (r128). Fully self-contained and degrades
   gracefully: if WebGL or Three is unavailable, the portfolio
   list below remains the experience.
   ========================================================= */
(function () {
  'use strict';

  var mapEl = document.getElementById('map');
  if (!mapEl) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined';

  function fail() { mapEl.classList.add('is-fallback'); }
  if (typeof window.THREE === 'undefined') { fail(); return; }

  // WebGL support check
  try {
    var test = document.createElement('canvas');
    if (!(test.getContext('webgl') || test.getContext('experimental-webgl'))) { fail(); return; }
  } catch (e) { fail(); return; }

  var THREE = window.THREE;
  var canvas = document.getElementById('mapCanvas');
  var tip = document.getElementById('mapTip');
  var loading = document.getElementById('mapLoading');
  var panel = document.getElementById('mapPanel');

  /* ---------- world / board parameters ---------- */
  var W = 80, H = 120;                 // board dimensions (x, z)
  var renderer, scene, camera, controls;
  var buildings, towers = [], markers = [];
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2(-2, -2);
  var hovered = null, selected = -1;
  var clock = new THREE.Clock();
  var introT = 0, introDur = 1.9, introDone = false, started = false;
  var visible = false, focusing = false;

  /* ---------- Manhattan-ish silhouette (normalised u,v) ---------- */
  var ISLAND = [
    [0.46,0.03],[0.52,0.03],[0.56,0.09],[0.585,0.20],[0.605,0.31],
    [0.66,0.42],[0.645,0.52],[0.61,0.62],[0.565,0.72],[0.52,0.82],
    [0.485,0.91],[0.455,0.965],[0.435,0.92],[0.415,0.82],[0.39,0.72],
    [0.355,0.60],[0.335,0.48],[0.355,0.36],[0.38,0.24],[0.42,0.12]
  ];
  var PARK = { u0: 0.45, u1: 0.525, v0: 0.30, v1: 0.47 };

  // four highlighted developments (normalised positions on the board)
  var PROJECTS = [
    { name: 'Vela',          loc: 'Edgewater · Miami',   value: '$300M',   u: 0.60, v: 0.27, h: 26, color: 0x9fc0d6 },
    { name: 'Cove Miami',    loc: 'Edgewater · Miami',   value: '$200M',   u: 0.575, v: 0.38, h: 20, color: 0x8ea88f },
    { name: 'Silver Star',   loc: 'Long Island City',    value: '135K SF', u: 0.40, v: 0.60, h: 15, color: 0x9fc0d6 },
    { name: 'The LIC',       loc: 'Long Island City',    value: '86 Units',u: 0.435, v: 0.55, h: 17, color: 0x8ea88f }
  ];

  function uvToWorld(u, v) { return { x: (u - 0.5) * W, z: (v - 0.5) * H }; }

  function pointInPoly(u, v, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      var hit = ((yi > v) !== (yj > v)) && (u < (xj - xi) * (v - yi) / (yj - yi) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }
  function inPark(u, v) { return u > PARK.u0 && u < PARK.u1 && v > PARK.v0 && v < PARK.v1; }

  /* ---------- board texture (water, island, streets, park, labels) ---------- */
  function makeBoardTexture() {
    var cw = 1024, ch = Math.round(cw * H / W);
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var x = c.getContext('2d');

    // water
    x.fillStyle = '#16222e'; x.fillRect(0, 0, cw, ch);

    // island fill
    x.beginPath();
    ISLAND.forEach(function (p, i) {
      var px = p[0] * cw, py = p[1] * ch;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    });
    x.closePath();
    x.fillStyle = '#e8edf1'; x.fill();

    // clip to island for streets + park
    x.save(); x.clip();

    // street grid
    x.strokeStyle = 'rgba(60,92,114,0.16)'; x.lineWidth = 1;
    for (var gx = 0; gx <= cw; gx += cw / 16) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, ch); x.stroke(); }
    for (var gy = 0; gy <= ch; gy += ch / 40) { x.beginPath(); x.moveTo(0, gy); x.lineTo(cw, gy); x.stroke(); }
    // a Broadway-ish diagonal
    x.strokeStyle = 'rgba(60,92,114,0.22)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0.5 * cw, 0.18 * ch); x.lineTo(0.40 * cw, 0.62 * ch); x.stroke();

    // Central Park
    x.fillStyle = '#aebfa6';
    roundRect(x, PARK.u0 * cw, PARK.v0 * ch, (PARK.u1 - PARK.u0) * cw, (PARK.v1 - PARK.v0) * ch, 6);
    x.fill();
    x.restore();

    // labels
    x.fillStyle = 'rgba(150,170,185,0.55)';
    x.font = '600 13px Inter, sans-serif';
    label(x, 'HUDSON RIVER', 0.16 * cw, 0.42 * ch, -Math.PI / 2.05, 6);
    label(x, 'EAST RIVER', 0.84 * cw, 0.5 * ch, Math.PI / 2.05, 6);
    x.fillStyle = 'rgba(80,110,90,0.65)';
    label(x, 'CENTRAL PARK', (PARK.u0 + 0.012) * cw, (PARK.v0 + PARK.v1) / 2 * ch, Math.PI / 2, 5);

    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function label(ctx, text, px, py, rot, sp) {
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var total = 0, w = [];
    for (var i = 0; i < text.length; i++) { w[i] = ctx.measureText(text[i]).width + sp; total += w[i]; }
    var cx = -total / 2;
    for (var k = 0; k < text.length; k++) { ctx.fillText(text[k], cx + w[k] / 2, 0); cx += w[k]; }
    ctx.restore();
  }

  /* ---------- soft round glow sprite for markers ---------- */
  function glowSprite(color) {
    var s = 128, c = document.createElement('canvas'); c.width = c.height = s;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    var col = new THREE.Color(color);
    var rgb = Math.round(col.r * 255) + ',' + Math.round(col.g * 255) + ',' + Math.round(col.b * 255);
    g.addColorStop(0, 'rgba(' + rgb + ',0.9)');
    g.addColorStop(0.3, 'rgba(' + rgb + ',0.4)');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    var tex = new THREE.CanvasTexture(c);
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return new THREE.Sprite(mat);
  }

  /* ---------- build the scene ---------- */
  function build() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1016);
    scene.fog = new THREE.Fog(0x0d1016, 90, 260);

    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    camera.position.set(58, 52, 74);

    sizeRenderer();

    // controls
    if (THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.minDistance = 42; controls.maxDistance = 150;
      controls.minPolarAngle = 0.18; controls.maxPolarAngle = 1.18;
      controls.autoRotate = true; controls.autoRotateSpeed = 0.45;
      controls.rotateSpeed = 0.6; controls.target.set(0, 4, 0);
    }

    // lighting
    scene.add(new THREE.HemisphereLight(0xbcd2e4, 0x141a20, 0.7));
    var key = new THREE.DirectionalLight(0xfff3e2, 1.15);
    key.position.set(46, 78, 34);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1; key.shadow.camera.far = 260;
    key.shadow.camera.left = -90; key.shadow.camera.right = 90;
    key.shadow.camera.top = 90; key.shadow.camera.bottom = -90;
    key.shadow.bias = -0.0004;
    scene.add(key);
    var fill = new THREE.DirectionalLight(0x9fc0d6, 0.35);
    fill.position.set(-40, 30, -30); scene.add(fill);

    // board
    var board = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshStandardMaterial({ map: makeBoardTexture(), roughness: 0.96, metalness: 0 })
    );
    board.rotation.x = -Math.PI / 2;
    board.receiveShadow = true;
    scene.add(board);

    // subtle water glow plane underneath the edges
    var water = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 3, H * 3),
      new THREE.MeshStandardMaterial({ color: 0x0f1820, roughness: 0.6, metalness: 0.1 })
    );
    water.rotation.x = -Math.PI / 2; water.position.y = -0.4;
    scene.add(water);

    buildBuildings();
    buildTowers();

    // pointer + resize
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', function () { mapEl.classList.add('grabbing'); });
    window.addEventListener('pointerup', function () { mapEl.classList.remove('grabbing'); });
    renderer.domElement.addEventListener('pointerleave', function () { pointer.set(-2, -2); setHover(null); });
    renderer.domElement.addEventListener('click', onClick);
    window.addEventListener('resize', sizeRenderer);

    // panel buttons
    if (panel) {
      panel.querySelectorAll('.map__proj').forEach(function (btn) {
        var idx = parseInt(btn.getAttribute('data-proj'), 10);
        btn.addEventListener('click', function () { focusProject(idx); });
        btn.addEventListener('mouseenter', function () { setHover(towers[idx]); });
        btn.addEventListener('mouseleave', function () { setHover(null); });
      });
    }

    if (loading) loading.classList.add('hide');
    requestAnimationFrame(tick);
  }

  /* ---------- generic buildings (instanced) ---------- */
  function buildBuildings() {
    var data = [];
    var step = 2.15;
    for (var u = 0.30; u <= 0.70; u += step / W) {
      for (var v = 0.03; v <= 0.97; v += step / H) {
        var ju = u + (Math.random() - 0.5) * 0.012;
        var jv = v + (Math.random() - 0.5) * 0.008;
        if (!pointInPoly(ju, jv, ISLAND)) continue;
        if (inPark(ju, jv)) continue;
        // erode toward shoreline so edges read clean
        if (!pointInPoly(ju + 0.012, jv, ISLAND) || !pointInPoly(ju - 0.012, jv, ISLAND)) { if (Math.random() < 0.6) continue; }
        if (Math.random() < 0.18) continue;
        var w = uvToWorld(ju, jv);
        // height bias: taller downtown (v~0.8) + midtown (v~0.42)
        var downtown = Math.exp(-Math.pow((jv - 0.82) / 0.10, 2));
        var midtown = Math.exp(-Math.pow((jv - 0.42) / 0.12, 2));
        var base = 1.4 + Math.random() * 3;
        var h = base + (downtown * 13 + midtown * 9) * (0.5 + Math.random() * 0.8);
        data.push({ x: w.x, z: w.z, w: 1.1 + Math.random() * 0.7, d: 1.1 + Math.random() * 0.7, h: h });
      }
    }

    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshStandardMaterial({ color: 0xdfe6ec, roughness: 0.82, metalness: 0.02 });
    buildings = new THREE.InstancedMesh(geo, mat, data.length);
    buildings.castShadow = true; buildings.receiveShadow = true;
    buildings.userData.data = data;

    var col = new THREE.Color();
    for (var i = 0; i < data.length; i++) {
      var t = 0.86 + Math.random() * 0.14;
      col.setRGB(t, t * 0.995, t * 0.98 + 0.02);
      buildings.setColorAt(i, col);
    }
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    scene.add(buildings);
    updateBuildings(0); // start flat
  }

  var _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function updateBuildings(progress) {
    if (!buildings) return;
    var data = buildings.userData.data;
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      // stagger by normalised distance from centre
      var stag = Math.min(1, (Math.abs(d.z) / (H * 0.6) + Math.abs(d.x) / (W * 0.6)) * 0.5);
      var local = Math.max(0, Math.min(1, (progress * 1.5 - stag * 0.5)));
      var h = Math.max(0.001, d.h * easeOut(local));
      _p.set(d.x, h / 2, d.z); _q.identity(); _s.set(d.w, h, d.d);
      _m.compose(_p, _q, _s);
      buildings.setMatrixAt(i, _m);
    }
    buildings.instanceMatrix.needsUpdate = true;
  }

  /* ---------- highlighted project towers ---------- */
  function buildTowers() {
    PROJECTS.forEach(function (p, i) {
      var w = uvToWorld(p.u, p.v);
      var grp = new THREE.Group();
      grp.position.set(w.x, 0, w.z);

      var mat = new THREE.MeshStandardMaterial({
        color: p.color, roughness: 0.35, metalness: 0.1,
        emissive: new THREE.Color(p.color).multiplyScalar(0.25), emissiveIntensity: 0.0
      });
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, p.h, 2.2), mat);
      mesh.position.y = p.h / 2; mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData = { idx: i, name: p.name, loc: p.loc, value: p.value, topY: p.h, mat: mat, base: p.h };
      grp.add(mesh);

      // beacon line
      var beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 10, 6),
        new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.5 })
      );
      beam.position.y = p.h + 5; grp.add(beam);

      // floating glow + ring
      var glow = glowSprite(p.color); glow.scale.set(6, 6, 1); glow.position.y = p.h + 11; grp.add(glow);
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.5, 0.08, 8, 40),
        new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.85 })
      );
      ring.rotation.x = Math.PI / 2; ring.position.y = p.h + 11; grp.add(ring);

      grp.userData = { mesh: mesh, ring: ring, glow: glow, beam: beam, base: p.h };
      grp.scale.y = 0.001; // grow in during intro
      scene.add(grp);
      towers.push(mesh);
      markers.push(grp);
    });
  }

  /* ---------- interaction ---------- */
  function onPointerMove(e) {
    var r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }
  function setHover(mesh) {
    if (hovered === mesh) return;
    hovered = mesh;
    document.body.classList.toggle('cursor-hover', !!mesh && window.matchMedia('(hover:hover)').matches);
    if (mesh) {
      var u = mesh.userData;
      tip.innerHTML = '<b>' + u.name + '</b><i>' + u.value + '</i>';
      tip.classList.add('show');
      renderer.domElement.style.cursor = 'pointer';
    } else {
      tip.classList.remove('show');
      renderer.domElement.style.cursor = '';
    }
  }
  function onClick() {
    if (hovered) focusProject(hovered.userData.idx);
  }

  function focusProject(idx) {
    selected = idx;
    if (panel) panel.querySelectorAll('.map__proj').forEach(function (b, i) { b.classList.toggle('active', i === idx); });
    var w = uvToWorld(PROJECTS[idx].u, PROJECTS[idx].v);
    var targetPos = new THREE.Vector3(w.x, PROJECTS[idx].h * 0.45, w.z);
    // camera offset framing the tower
    var camPos = new THREE.Vector3(w.x + 26, PROJECTS[idx].h * 0.9 + 22, w.z + 32);
    focusing = true;
    if (controls) controls.autoRotate = false;

    if (hasGSAP && !reduce) {
      gsap.to(camera.position, { x: camPos.x, y: camPos.y, z: camPos.z, duration: 1.3, ease: 'power3.inOut' });
      gsap.to(controls ? controls.target : camera, {
        x: targetPos.x, y: targetPos.y, z: targetPos.z, duration: 1.3, ease: 'power3.inOut',
        onUpdate: function () { if (controls) controls.update(); },
        onComplete: function () { focusing = false; setTimeout(function () { if (controls) controls.autoRotate = true; }, 2600); }
      });
    } else {
      camera.position.copy(camPos);
      if (controls) { controls.target.copy(targetPos); controls.update(); }
      focusing = false;
    }
  }

  /* ---------- sizing ---------- */
  function sizeRenderer() {
    if (!renderer) return;
    var r = mapEl.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  }

  /* ---------- render loop ---------- */
  function tick() {
    requestAnimationFrame(tick);
    var dt = Math.min(clock.getDelta(), 0.05);

    if (started && !introDone) {
      introT += dt;
      var p = Math.min(1, introT / introDur);
      updateBuildings(p);
      var tp = Math.min(1, Math.max(0, (p - 0.25) / 0.7));
      markers.forEach(function (g, i) {
        var local = Math.max(0, Math.min(1, tp * 1.3 - i * 0.08));
        g.scale.y = Math.max(0.001, easeOut(local));
      });
      if (p >= 1) { introDone = true; }
    }

    if (!visible) return; // skip rendering when off-screen

    var time = clock.elapsedTime;
    // pulse markers
    markers.forEach(function (g, i) {
      if (!introDone) return;
      var s = 1 + Math.sin(time * 2 + i) * 0.12;
      g.userData.ring.scale.set(s, s, s);
      g.userData.ring.rotation.z += dt * 0.6;
      g.userData.glow.material.opacity = 0.6 + Math.sin(time * 2 + i) * 0.25;
      g.position.y = Math.sin(time * 1.4 + i) * 0.3;
    });

    // hover raycast (skip while user is orbiting fast handled by controls)
    if (introDone && !focusing) {
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(towers, false);
      setHover(hits.length ? hits[0].object : null);
    }

    // ease tower emphasis
    towers.forEach(function (m) {
      var on = (m === hovered) || (m.userData.idx === selected);
      m.userData.mat.emissiveIntensity += ((on ? 0.6 : 0.0) - m.userData.mat.emissiveIntensity) * 0.15;
      var sx = m.scale.x + (((m === hovered) ? 1.06 : 1.0) - m.scale.x) * 0.15;
      m.scale.x = sx; m.scale.z = sx;
    });

    // position tooltip over hovered tower
    if (hovered && tip.classList.contains('show')) {
      var wp = new THREE.Vector3();
      hovered.getWorldPosition(wp); wp.y = hovered.userData.base + 4;
      wp.project(camera);
      var r = renderer.domElement.getBoundingClientRect();
      tip.style.left = (( wp.x * 0.5 + 0.5) * r.width) + 'px';
      tip.style.top = ((-wp.y * 0.5 + 0.5) * r.height) + 'px';
    }

    if (controls) controls.update();
    renderer.render(scene, camera);
  }

  /* ---------- start when scrolled into view ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      visible = en.isIntersecting;
      if (en.isIntersecting && !started) { started = true; if (reduce) { updateBuildings(1); markers.forEach(function(g){g.scale.y=1;}); introDone = true; } }
    });
  }, { threshold: 0.08 });

  try {
    build();
    io.observe(mapEl);
  } catch (err) {
    if (window.console) console.warn('Map init failed:', err);
    fail();
  }

})();
