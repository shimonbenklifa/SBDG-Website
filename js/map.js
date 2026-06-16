/* =========================================================
   SB DEVELOPMENT GROUP — interactive 3D massing model
   Two real boards: New York (Manhattan, the East River, and
   Long Island City) and Miami (the mainland, Biscayne Bay,
   and Margaret Pace Park). Each places the firm's actual
   developments where they really stand.

   Three.js (r128). Self-contained, with a graceful fallback
   to the portfolio list if WebGL is unavailable.
   ========================================================= */
(function () {
  'use strict';

  var mapEl = document.getElementById('map');
  if (!mapEl) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined';

  function fail() { mapEl.classList.add('is-fallback'); }
  if (typeof window.THREE === 'undefined') { fail(); return; }
  try {
    var test = document.createElement('canvas');
    if (!(test.getContext('webgl') || test.getContext('experimental-webgl'))) { fail(); return; }
  } catch (e) { fail(); return; }

  var THREE = window.THREE;
  var canvas = document.getElementById('mapCanvas');
  var tip = document.getElementById('mapTip');
  var loading = document.getElementById('mapLoading');
  var panel = document.getElementById('mapPanel');
  var cityLabelEl = document.getElementById('mapCityLabel');

  var W = 80, H = 120;             // board size (x, z)
  var BLUE = 0x9fc0d6, SAGE = 0x8ea88f;

  /* ================= CITY DEFINITIONS ================= */
  var CITIES = {
    ny: {
      label: 'New York',
      // A focused view of the East River corridor: Manhattan at full scale on
      // the west, the river with Roosevelt Island and the bridges, and a
      // detailed Long Island City / Queens on the east where the towers sit.
      land: [
        // Manhattan — east shore (down) then west shore (up); Battery at the tip
        [[0.30,0.05],[0.34,0.09],[0.385,0.18],[0.41,0.28],[0.425,0.38],[0.43,0.47],[0.425,0.55],[0.405,0.63],[0.375,0.72],[0.34,0.80],[0.305,0.88],[0.275,0.93],[0.235,0.88],[0.215,0.80],[0.195,0.70],[0.175,0.60],[0.165,0.50],[0.165,0.40],[0.175,0.30],[0.195,0.20],[0.235,0.10]],
        // Queens + Brooklyn — Hunters Point peninsula juts west, Newtown Creek notch below it
        [[0.58,0.06],[0.98,0.04],[0.98,0.96],[0.46,0.96],[0.455,0.90],[0.47,0.84],[0.495,0.78],[0.515,0.71],[0.535,0.63],[0.55,0.56],[0.515,0.46],[0.53,0.34],[0.55,0.22]],
        // Roosevelt Island
        [[0.47,0.32],[0.485,0.32],[0.49,0.50],[0.475,0.50]],
        // New Jersey (far bank of the Hudson)
        [[0.0,0.02],[0.05,0.02],[0.035,0.98],[0.0,0.98]]
      ],
      park: { u0:0.27, u1:0.355, v0:0.165, v1:0.335, color:'#aebfa6' },
      bridges: [
        { a:[0.425,0.375], b:[0.525,0.40] }, // Queensboro / 59th St
        { a:[0.405,0.63],  b:[0.515,0.70] }, // Williamsburg
        { a:[0.375,0.72],  b:[0.485,0.81] }, // Manhattan
        { a:[0.355,0.76],  b:[0.465,0.85] }  // Brooklyn
      ],
      labels: [
        { t:'HUDSON RIVER', u:0.085, v:0.55, rot:-Math.PI/2, c:'rgba(120,150,170,0.6)' },
        { t:'EAST RIVER', u:0.47, v:0.585, rot:-Math.PI/2, c:'rgba(120,150,170,0.55)' },
        { t:'CENTRAL PARK', u:0.312, v:0.25, rot:-Math.PI/2, c:'rgba(80,110,90,0.75)', size:10 },
        { t:'MANHATTAN', u:0.285, v:0.60, rot:-Math.PI/2, c:'rgba(150,170,185,0.42)' },
        { t:'MIDTOWN', u:0.345, v:0.40, rot:0, c:'rgba(150,170,185,0.34)', size:8 },
        { t:'LONG ISLAND CITY', u:0.71, v:0.42, rot:0, c:'rgba(150,170,185,0.6)' },
        { t:'HUNTERS POINT', u:0.555, v:0.51, rot:0, c:'rgba(150,170,185,0.4)', size:7 },
        { t:'ASTORIA', u:0.74, v:0.17, rot:0, c:'rgba(150,170,185,0.38)', size:9 },
        { t:'QUEENS', u:0.87, v:0.30, rot:0, c:'rgba(150,170,185,0.38)' },
        { t:'GREENPOINT', u:0.635, v:0.62, rot:0, c:'rgba(150,170,185,0.36)', size:8 },
        { t:'WILLIAMSBURG', u:0.65, v:0.74, rot:0, c:'rgba(150,170,185,0.36)', size:8 },
        { t:'DUMBO', u:0.55, v:0.87, rot:0, c:'rgba(150,170,185,0.36)', size:7 },
        { t:'BROOKLYN', u:0.78, v:0.92, rot:0, c:'rgba(150,170,185,0.45)' },
        { t:'NEW JERSEY', u:0.02, v:0.5, rot:-Math.PI/2, c:'rgba(150,170,185,0.30)', size:9 },
        { t:'59TH ST BRIDGE', u:0.49, v:0.355, rot:0, c:'rgba(165,185,200,0.6)', size:8 },
        { t:'WILLIAMSBURG BR', u:0.475, v:0.655, rot:0.28, c:'rgba(165,185,200,0.55)', size:7 },
        { t:'MANHATTAN BR', u:0.445, v:0.76, rot:0.3, c:'rgba(165,185,200,0.5)', size:7 },
        { t:'BROOKLYN BR', u:0.43, v:0.80, rot:0.3, c:'rgba(165,185,200,0.5)', size:7 }
      ],
      tall: [
        { u:0.33,  v:0.45, su:0.05,  sv:0.11, amp:17 },  // midtown
        { u:0.30,  v:0.85, su:0.04,  sv:0.06, amp:14 },  // lower manhattan
        { u:0.585, v:0.42, su:0.05,  sv:0.07, amp:13 },  // long island city
        { u:0.60,  v:0.90, su:0.05,  sv:0.06, amp:9 }    // downtown brooklyn
      ],
      // Long Island City cluster (Dutch Kills) + The Dime in Williamsburg.
      // Tower heights are scaled from each building's real story count.
      projects: [
        { name:'Silver Star', value:'10 Stories', u:0.585, v:0.34,  h:8,  color:BLUE },
        { name:'NOVA',        value:'24 Stories', u:0.575, v:0.40,  h:19, color:SAGE },
        { name:'DŌMI',        value:'12 Stories', u:0.600, v:0.43,  h:10, color:BLUE },
        { name:'Rise LIC',    value:'11 Stories', u:0.588, v:0.455, h:9,  color:SAGE },
        { name:'The Dime',    value:'23 Stories', u:0.55,  v:0.71,  h:18, color:BLUE }
      ]
    },
    mia: {
      label: 'Miami',
      land: [
        // Edgewater mainland (left), waterfront on its right edge
        [[0.04,0.05],[0.46,0.05],[0.50,0.20],[0.485,0.45],[0.50,0.65],[0.47,0.85],[0.44,0.95],[0.04,0.95]],
        // Miami Beach barrier island (far right strip)
        [[0.88,0.10],[0.96,0.08],[0.96,0.92],[0.88,0.90]]
      ],
      park: { u0:0.455, u1:0.50, v0:0.30, v1:0.40, color:'#a9c0a4' }, // Margaret Pace Park (waterfront)
      labels: [
        { t:'BISCAYNE BAY', u:0.70, v:0.52, rot:-Math.PI/2, c:'rgba(120,150,170,0.6)' },
        { t:'EDGEWATER', u:0.26, v:0.42, rot:0, c:'rgba(150,170,185,0.55)' },
        { t:'MARGARET PACE PARK', u:0.452, v:0.35, rot:-Math.PI/2, c:'rgba(80,110,90,0.7)', size:7 },
        { t:'DOWNTOWN MIAMI', u:0.28, v:0.82, rot:0, c:'rgba(150,170,185,0.45)', size:9 },
        { t:'MIAMI BEACH', u:0.92, v:0.5, rot:Math.PI/2, c:'rgba(150,170,185,0.5)' }
      ],
      tall: [
        { u:0.28, v:0.82, su:0.07, sv:0.09, amp:16 },  // downtown Miami (south)
        { u:0.36, v:0.45, su:0.10, sv:0.20, amp:6 },   // edgewater body
        { u:0.47, v:0.45, su:0.04, sv:0.14, amp:10 }   // waterfront cluster
      ],
      projects: [
        { name:'Vela',     value:'55 Stories', u:0.474, v:0.50, h:40, color:BLUE },
        { name:'The Cove', value:'40 Stories', u:0.482, v:0.43, h:30, color:SAGE }
      ]
    }
  };

  var renderer, scene, camera, controls, water;
  var cityGroup = null, buildings = null, towers = [], markers = [];
  var cfg = CITIES.ny, currentKey = 'ny';
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2(-2, -2);
  var hovered = null, selected = -1;
  var clock = new THREE.Clock();
  var introT = 0, introDur = 1.8, introDone = false, started = false;
  var visible = false, focusing = false;

  function uvToWorld(u, v) { return { x: (u - 0.5) * W, z: (v - 0.5) * H }; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function pointInPoly(u, v, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > v) !== (yj > v)) && (u < (xj - xi) * (v - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function inAnyLand(u, v) { for (var i = 0; i < cfg.land.length; i++) if (pointInPoly(u, v, cfg.land[i])) return true; return false; }
  function inPark(u, v) { var p = cfg.park; return p && u > p.u0 && u < p.u1 && v > p.v0 && v < p.v1; }
  function heightBias(u, v) {
    var s = 0;
    for (var i = 0; i < cfg.tall.length; i++) {
      var t = cfg.tall[i];
      s += t.amp * Math.exp(-(Math.pow((u - t.u) / t.su, 2) + Math.pow((v - t.v) / t.sv, 2)) / 2);
    }
    return s;
  }

  /* ---------- board texture ---------- */
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a+r,b); x.arcTo(a+w,b,a+w,b+h,r); x.arcTo(a+w,b+h,a,b+h,r); x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }
  function label(x, text, px, py, rot, sp) {
    x.save(); x.translate(px, py); x.rotate(rot); x.textAlign='center'; x.textBaseline='middle';
    var w=[], total=0; for (var i=0;i<text.length;i++){ w[i]=x.measureText(text[i]).width+sp; total+=w[i]; }
    var c=-total/2; for (var k=0;k<text.length;k++){ x.fillText(text[k], c+w[k]/2, 0); c+=w[k]; }
    x.restore();
  }
  function makeBoardTexture() {
    var cw = 1024, ch = Math.round(cw * H / W);
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var x = c.getContext('2d');
    x.fillStyle = '#16222e'; x.fillRect(0, 0, cw, ch);   // water

    cfg.land.forEach(function (poly, idx) {
      x.beginPath();
      poly.forEach(function (p, i) { var px=p[0]*cw, py=p[1]*ch; i?x.lineTo(px,py):x.moveTo(px,py); });
      x.closePath();
      x.fillStyle = idx === 0 ? '#e8edf1' : '#dfe5ea'; x.fill();
      x.save(); x.clip();
      x.strokeStyle = 'rgba(60,92,114,0.14)'; x.lineWidth = 1;
      for (var gx=0; gx<=cw; gx+=cw/18){ x.beginPath(); x.moveTo(gx,0); x.lineTo(gx,ch); x.stroke(); }
      for (var gy=0; gy<=ch; gy+=ch/46){ x.beginPath(); x.moveTo(0,gy); x.lineTo(cw,gy); x.stroke(); }
      x.restore();
    });

    if (cfg.park) {
      x.fillStyle = cfg.park.color;
      roundRect(x, cfg.park.u0*cw, cfg.park.v0*ch, (cfg.park.u1-cfg.park.u0)*cw, (cfg.park.v1-cfg.park.v0)*ch, 6);
      x.fill();
    }

    // bridges (drawn over the water gaps)
    if (cfg.bridges) {
      x.lineCap = 'round';
      cfg.bridges.forEach(function (b) {
        var ax=b.a[0]*cw, ay=b.a[1]*ch, bx=b.b[0]*cw, by=b.b[1]*ch;
        x.strokeStyle = 'rgba(178,200,216,0.5)'; x.lineWidth = 3.5;
        x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
        x.strokeStyle = 'rgba(20,32,44,0.55)'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
      });
    }

    cfg.labels.forEach(function (l) {
      x.font = '600 ' + (l.size || 13) + 'px Inter, sans-serif';
      x.fillStyle = l.c; label(x, l.t, l.u*cw, l.v*ch, l.rot, l.size ? 4 : 6);
    });

    var tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function glowSprite(color) {
    var s=128, c=document.createElement('canvas'); c.width=c.height=s; var x=c.getContext('2d');
    var g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2); var col=new THREE.Color(color);
    var rgb=Math.round(col.r*255)+','+Math.round(col.g*255)+','+Math.round(col.b*255);
    g.addColorStop(0,'rgba('+rgb+',0.9)'); g.addColorStop(0.3,'rgba('+rgb+',0.4)'); g.addColorStop(1,'rgba('+rgb+',0)');
    x.fillStyle=g; x.fillRect(0,0,s,s);
    var tex=new THREE.CanvasTexture(c);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
  }

  /* ---------- scene scaffold (built once) ---------- */
  function initScene() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1016);
    scene.fog = new THREE.Fog(0x0d1016, 95, 270);

    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    camera.position.set(60, 60, 84);
    sizeRenderer();

    if (THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
      controls.minDistance = 44; controls.maxDistance = 155;
      controls.minPolarAngle = 0.18; controls.maxPolarAngle = 1.12;
      controls.autoRotate = true; controls.autoRotateSpeed = 0.45; controls.rotateSpeed = 0.6;
      controls.target.set(0, 4, 0);
    }

    scene.add(new THREE.HemisphereLight(0xbcd2e4, 0x141a20, 0.7));
    var key = new THREE.DirectionalLight(0xfff3e2, 1.15);
    key.position.set(46, 80, 34); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1; key.shadow.camera.far = 280;
    key.shadow.camera.left = -95; key.shadow.camera.right = 95; key.shadow.camera.top = 95; key.shadow.camera.bottom = -95;
    key.shadow.bias = -0.0004; scene.add(key);
    var fill = new THREE.DirectionalLight(0x9fc0d6, 0.35); fill.position.set(-40, 30, -30); scene.add(fill);

    water = new THREE.Mesh(new THREE.PlaneGeometry(W*3, H*3),
      new THREE.MeshStandardMaterial({ color: 0x0f1820, roughness: 0.6, metalness: 0.1 }));
    water.rotation.x = -Math.PI/2; water.position.y = -0.4; scene.add(water);

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', function () { mapEl.classList.add('grabbing'); });
    window.addEventListener('pointerup', function () { mapEl.classList.remove('grabbing'); });
    renderer.domElement.addEventListener('pointerleave', function () { pointer.set(-2,-2); setHover(null); });
    renderer.domElement.addEventListener('click', function () { if (hovered) focusProject(hovered.userData.idx); });
    window.addEventListener('resize', sizeRenderer);

    wirePanel();
    buildCity('ny', true);
    if (loading) loading.classList.add('hide');
    requestAnimationFrame(tick);
  }

  /* ---------- build / rebuild a city ---------- */
  function disposeGroup(g) {
    g.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  function buildCity(key, first) {
    if (!first && key === currentKey) return;
    currentKey = key; cfg = CITIES[key];

    if (cityGroup) { scene.remove(cityGroup); disposeGroup(cityGroup); }
    cityGroup = new THREE.Group(); scene.add(cityGroup);
    towers = []; markers = []; hovered = null; selected = -1;
    if (tip) tip.classList.remove('show');

    // board
    var board = new THREE.Mesh(new THREE.PlaneGeometry(W, H),
      new THREE.MeshStandardMaterial({ map: makeBoardTexture(), roughness: 0.96, metalness: 0 }));
    board.rotation.x = -Math.PI/2; board.receiveShadow = true; cityGroup.add(board);

    buildBuildings();
    buildTowers();

    // intro
    introT = 0; introDone = false;
    if (reduce) { updateBuildings(1); markers.forEach(function (m) { m.scale.y = 1; }); introDone = true; }

    // ui sync
    if (cityLabelEl) cityLabelEl.textContent = cfg.label;
    if (panel) {
      panel.querySelectorAll('.map__city').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-city') === key); });
      panel.querySelectorAll('.map__list').forEach(function (l) { l.hidden = l.getAttribute('data-citylist') !== key; });
      panel.querySelectorAll('.map__proj').forEach(function (b) { b.classList.remove('active'); });
    }
  }

  function buildBuildings() {
    var data = [], step = 1.95;
    for (var u = 0.03; u <= 0.97; u += step / W) {
      for (var v = 0.03; v <= 0.97; v += step / H) {
        var ju = u + (Math.random()-0.5)*0.012, jv = v + (Math.random()-0.5)*0.008;
        if (!inAnyLand(ju, jv) || inPark(ju, jv)) continue;
        if (!inAnyLand(ju+0.013, jv) || !inAnyLand(ju-0.013, jv)) { if (Math.random() < 0.55) continue; }
        if (Math.random() < 0.16) continue;
        var w = uvToWorld(ju, jv);
        var h = 1.3 + Math.random()*2.6 + heightBias(ju, jv) * (0.55 + Math.random()*0.7);
        data.push({ x:w.x, z:w.z, w:1.05+Math.random()*0.7, d:1.05+Math.random()*0.7, h:h });
      }
    }
    var mat = new THREE.MeshStandardMaterial({ color: 0xdfe6ec, roughness: 0.82, metalness: 0.02 });
    buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), mat, data.length);
    buildings.castShadow = true; buildings.receiveShadow = true; buildings.userData.data = data;
    var col = new THREE.Color();
    for (var i = 0; i < data.length; i++) { var t = 0.86 + Math.random()*0.14; col.setRGB(t, t*0.995, t*0.98+0.02); buildings.setColorAt(i, col); }
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    cityGroup.add(buildings);
    updateBuildings(0);
  }

  var _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  function updateBuildings(progress) {
    if (!buildings) return; var data = buildings.userData.data;
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var stag = Math.min(1, (Math.abs(d.z)/(H*0.6) + Math.abs(d.x)/(W*0.6)) * 0.5);
      var local = Math.max(0, Math.min(1, progress*1.5 - stag*0.5));
      var h = Math.max(0.001, d.h * easeOut(local));
      _p.set(d.x, h/2, d.z); _q.identity(); _s.set(d.w, h, d.d); _m.compose(_p, _q, _s);
      buildings.setMatrixAt(i, _m);
    }
    buildings.instanceMatrix.needsUpdate = true;
  }

  function buildTowers() {
    cfg.projects.forEach(function (p, i) {
      var w = uvToWorld(p.u, p.v); var grp = new THREE.Group(); grp.position.set(w.x, 0, w.z);
      var mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.35, metalness: 0.1,
        emissive: new THREE.Color(p.color).multiplyScalar(0.25), emissiveIntensity: 0.0 });
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(1.7, p.h, 1.7), mat);
      mesh.position.y = p.h/2; mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData = { idx: i, name: p.name, value: p.value, base: p.h, mat: mat };
      grp.add(mesh);
      var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,7,6),
        new THREE.MeshBasicMaterial({ color:p.color, transparent:true, opacity:0.45 }));
      beam.position.y = p.h + 3.5; grp.add(beam);
      var glow = glowSprite(p.color); glow.scale.set(4,4,1); glow.position.y = p.h + 7.5; grp.add(glow);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(1.05,0.06,8,36),
        new THREE.MeshBasicMaterial({ color:p.color, transparent:true, opacity:0.85 }));
      ring.rotation.x = Math.PI/2; ring.position.y = p.h + 7.5; grp.add(ring);
      grp.userData = { ring: ring, glow: glow };
      grp.scale.y = reduce ? 1 : 0.001;
      cityGroup.add(grp); towers.push(mesh); markers.push(grp);
    });
  }

  /* ---------- interaction ---------- */
  function onPointerMove(e) {
    var r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX-r.left)/r.width)*2 - 1;
    pointer.y = -((e.clientY-r.top)/r.height)*2 + 1;
  }
  function setHover(mesh) {
    if (hovered === mesh) return; hovered = mesh;
    document.body.classList.toggle('cursor-hover', !!mesh && window.matchMedia('(hover:hover)').matches);
    if (mesh) {
      tip.innerHTML = '<b>'+mesh.userData.name+'</b><i>'+mesh.userData.value+'</i>';
      tip.classList.add('show'); renderer.domElement.style.cursor = 'pointer';
    } else { tip.classList.remove('show'); renderer.domElement.style.cursor = ''; }
  }
  function focusProject(idx) {
    selected = idx;
    if (panel) panel.querySelectorAll('.map__list[data-citylist="'+currentKey+'"] .map__proj').forEach(function (b, i) { b.classList.toggle('active', i === idx); });
    var p = cfg.projects[idx], w = uvToWorld(p.u, p.v);
    var target = new THREE.Vector3(w.x, p.h*0.45, w.z);
    var camPos = new THREE.Vector3(w.x + 26, p.h*0.9 + 22, w.z + 32);
    focusing = true; if (controls) controls.autoRotate = false;
    if (hasGSAP && !reduce) {
      gsap.to(camera.position, { x:camPos.x, y:camPos.y, z:camPos.z, duration:1.3, ease:'power3.inOut' });
      gsap.to(controls ? controls.target : camera, { x:target.x, y:target.y, z:target.z, duration:1.3, ease:'power3.inOut',
        onUpdate: function () { if (controls) controls.update(); },
        onComplete: function () { focusing = false; setTimeout(function () { if (controls) controls.autoRotate = true; }, 2800); } });
    } else { camera.position.copy(camPos); if (controls) { controls.target.copy(target); controls.update(); } focusing = false; }
  }

  function wirePanel() {
    if (!panel) return;
    panel.querySelectorAll('.map__city').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-city');
        if (key === currentKey) return;
        buildCity(key);
        if (controls) { controls.autoRotate = true; controls.target.set(0,4,0); }
      });
    });
    panel.querySelectorAll('.map__proj').forEach(function (btn) {
      var idx = parseInt(btn.getAttribute('data-proj'), 10);
      var city = btn.getAttribute('data-city');
      btn.addEventListener('click', function () {
        if (city !== currentKey) { buildCity(city); setTimeout(function () { focusProject(idx); }, 650); }
        else focusProject(idx);
      });
      btn.addEventListener('mouseenter', function () { if (city === currentKey && towers[idx]) setHover(towers[idx]); });
      btn.addEventListener('mouseleave', function () { setHover(null); });
    });
  }

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
      introT += dt; var pr = Math.min(1, introT / introDur);
      updateBuildings(pr);
      var tp = Math.min(1, Math.max(0, (pr - 0.25) / 0.7));
      markers.forEach(function (g, i) { g.scale.y = Math.max(0.001, easeOut(Math.max(0, Math.min(1, tp*1.3 - i*0.1)))); });
      if (pr >= 1) introDone = true;
    }

    if (!visible) return;
    var time = clock.elapsedTime;

    markers.forEach(function (g, i) {
      if (!introDone) return;
      var s = 1 + Math.sin(time*2 + i)*0.12;
      g.userData.ring.scale.set(s, s, s); g.userData.ring.rotation.z += dt*0.6;
      g.userData.glow.material.opacity = 0.6 + Math.sin(time*2 + i)*0.25;
      g.position.y = Math.sin(time*1.4 + i)*0.3;
    });

    if (introDone && !focusing) {
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(towers, false);
      setHover(hits.length ? hits[0].object : null);
    }

    towers.forEach(function (m) {
      var on = (m === hovered) || (m.userData.idx === selected);
      m.userData.mat.emissiveIntensity += ((on ? 0.6 : 0.0) - m.userData.mat.emissiveIntensity) * 0.15;
      var sx = m.scale.x + (((m === hovered) ? 1.06 : 1.0) - m.scale.x) * 0.15;
      m.scale.x = sx; m.scale.z = sx;
    });

    if (hovered && tip.classList.contains('show')) {
      var wp = new THREE.Vector3(); hovered.getWorldPosition(wp); wp.y = hovered.userData.base + 4; wp.project(camera);
      var r = renderer.domElement.getBoundingClientRect();
      tip.style.left = ((wp.x*0.5 + 0.5) * r.width) + 'px';
      tip.style.top = ((-wp.y*0.5 + 0.5) * r.height) + 'px';
    }

    if (controls) controls.update();
    renderer.render(scene, camera);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      visible = en.isIntersecting;
      if (en.isIntersecting && !started) started = true;
    });
  }, { threshold: 0.08 });

  try { initScene(); io.observe(mapEl); }
  catch (err) { if (window.console) console.warn('Map init failed:', err); fail(); }

})();
