// 지구 알아보기 모드 — 실제 국가 경계 지구본 + 대륙/나라 정보 + 비행기 여행
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import { glowSprite, glowTexture, labelSprite, canvasTexture } from './sprites.js';

const R = 5; // 지구본 반지름
const DEG = Math.PI / 180;

// 4~7세용 나라 12개 (대표 도시 좌표)
export const COUNTRIES = [
  { id: 'korea',     name: '한국',     flag: '🇰🇷', lat: 37.5,  lon: 127.0,  color: '#7ec8ff', fact: '우리가 사는 나라예요! 안녕하세요!' },
  { id: 'japan',     name: '일본',     flag: '🇯🇵', lat: 35.7,  lon: 139.7,  color: '#ffb3c1', fact: '초밥이랑 후지산이 유명해요!' },
  { id: 'china',     name: '중국',     flag: '🇨🇳', lat: 39.9,  lon: 116.4,  color: '#ff8a80', fact: '귀여운 판다가 사는 나라예요!' },
  { id: 'india',     name: '인도',     flag: '🇮🇳', lat: 28.6,  lon: 77.2,   color: '#ffd180', fact: '하얀 궁전 타지마할이 있어요!' },
  { id: 'egypt',     name: '이집트',   flag: '🇪🇬', lat: 30.0,  lon: 31.2,   color: '#ffe082', fact: '사막에 커다란 피라미드가 있어요!' },
  { id: 'kenya',     name: '케냐',     flag: '🇰🇪', lat: -1.3,  lon: 36.8,   color: '#a5d6a7', fact: '사자랑 코끼리가 뛰어노는 곳이에요!' },
  { id: 'france',    name: '프랑스',   flag: '🇫🇷', lat: 48.9,  lon: 2.4,    color: '#90caf9', fact: '뾰족한 에펠탑이 있는 나라예요!' },
  { id: 'uk',        name: '영국',     flag: '🇬🇧', lat: 51.5,  lon: -0.1,   color: '#b39ddb', fact: '커다란 시계탑 빅벤이 있어요!' },
  { id: 'italy',     name: '이탈리아', flag: '🇮🇹', lat: 41.9,  lon: 12.5,   color: '#c5e1a5', fact: '피자랑 스파게티가 태어난 나라예요!' },
  { id: 'usa',       name: '미국',     flag: '🇺🇸', lat: 40.7,  lon: -74.0,  color: '#81d4fa', fact: '자유의 여신상이 있는 아주 큰 나라예요!' },
  { id: 'brazil',    name: '브라질',   flag: '🇧🇷', lat: -22.9, lon: -43.2,  color: '#aed581', fact: '아마존 밀림과 축구의 나라예요!' },
  { id: 'australia', name: '호주',     flag: '🇦🇺', lat: -33.9, lon: 151.2,  color: '#ffcc80', fact: '캥거루랑 코알라가 살아요!' },
];

const CONTINENTS = [
  { name: '아시아',     lat: 48,  lon: 95,   fact: '아시아는 우리가 사는 제일 큰 대륙이에요!' },
  { name: '유럽',       lat: 54,  lon: 20,   fact: '유럽에는 멋진 성이 아주 많아요!' },
  { name: '아프리카',   lat: 3,   lon: 20,   fact: '아프리카는 사자랑 기린이 사는 뜨거운 대륙이에요!' },
  { name: '북아메리카', lat: 48,  lon: -102, fact: '북아메리카에는 큰 산과 큰 도시가 많아요!' },
  { name: '남아메리카', lat: -12, lon: -60,  fact: '남아메리카에는 아마존 밀림이 있어요!' },
  { name: '오세아니아', lat: -26, lon: 134,  fact: '오세아니아는 바다로 둘러싸인 대륙이에요!' },
  { name: '남극',       lat: -76, lon: 30,   fact: '남극은 펭귄이 사는 제일 추운 곳이에요!' },
];

/**
 * 위도/경도 → 3D 좌표.
 * three.js SphereGeometry의 UV 공식과 동일하게 맞춰 텍스처(등장방형)와 정확히 정합:
 * x = -r·cosφ·sinθ, y = r·cosθ, z = r·sinφ·sinθ (φ = (lon+180)°, θ = (90-lat)°)
 */
function latLonToVec3(lat, lon, r, out = new THREE.Vector3()) {
  const theta = (90 - lat) * DEG;
  const phi = (lon + 180) * DEG;
  out.set(
    -r * Math.cos(phi) * Math.sin(theta),
    r * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta)
  );
  return out;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------- 지도 텍스처 (국가 경계) ----------
function drawOcean(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#9fd4e8');   // 극지 바다는 옅게
  g.addColorStop(0.25, '#2a6cb5');
  g.addColorStop(0.5, '#1d5aa8');
  g.addColorStop(0.75, '#2a6cb5');
  g.addColorStop(1, '#bfe2ef');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

async function buildMapTexture(texture) {
  const canvas = texture.image;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'countries-110m.json');
    const topo = await res.json();
    const geo = feature(topo, topo.objects.countries);
    const palette = ['#8fce8f', '#f5c98a', '#efe28a', '#a8cfe8', '#f0a8c0', '#b8df95', '#f5a397', '#c5b3dc', '#ffd97a', '#97d8c8'];
    geo.features.forEach((f, i) => {
      ctx.fillStyle = palette[i % palette.length];
      ctx.strokeStyle = 'rgba(50, 70, 50, 0.55)';
      ctx.lineWidth = 1.4;
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) {
        ctx.beginPath();
        for (const ring of poly) {
          ring.forEach(([lon, lat], j) => {
            const x = ((lon + 180) / 360) * W;
            const y = ((90 - lat) / 180) * H;
            if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
      }
    });
  } catch {
    // 오프라인 폴백: 단순한 초록 대륙 얼룩이라도 그린다
    ctx.fillStyle = '#6aa84f';
    for (const c of CONTINENTS) {
      const x = ((c.lon + 180) / 360) * W;
      const y = ((90 - c.lat) / 180) * H;
      ctx.beginPath();
      ctx.ellipse(x, y, W * 0.06, H * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  texture.needsUpdate = true;
}

function cloudsTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = 0.06 + Math.random() * 0.16;
      const x = Math.random() * w;
      const y = h * 0.12 + Math.random() * h * 0.76;
      ctx.beginPath();
      ctx.ellipse(x, y, 24 + Math.random() * 70, 6 + Math.random() * 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

// ---------- 비행기 (기수 = +Z) ----------
function buildPlane() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf7f7f5, roughness: 0.5 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8a3c, roughness: 0.6 });

  const fus = new THREE.CylinderGeometry(0.035, 0.06, 0.55, 12);
  fus.rotateX(Math.PI / 2); // +Z 방향으로 눕히기 (radiusTop이 기수)
  g.add(new THREE.Mesh(fus, white));

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), white);
  nose.position.z = 0.275;
  g.add(nose);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.018, 0.17), white);
  wing.position.z = 0.03;
  g.add(wing);

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.015, 0.11), orange);
  tailWing.position.z = -0.24;
  g.add(tailWing);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.13), orange);
  fin.position.set(0, 0.08, -0.24);
  g.add(fin);

  return g;
}

// ---------- 메인 ----------
export function createEarthWorld(renderer, { onArrive } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#04070f');

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  latLonToVec3(37.5, 127.0, 13.5, camera.position); // 한국이 보이는 위치에서 시작

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 6.5;
  controls.maxDistance = 22;
  controls.enabled = false; // earth 모드에서만 켬

  // 조명
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
  sun.position.set(8, 5, 6);
  scene.add(sun);

  // 별 배경
  {
    const N = 1500, positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u), r = 150;
      positions[i * 3] = r * s * Math.cos(t);
      positions[i * 3 + 1] = r * u;
      positions[i * 3 + 2] = r * s * Math.sin(t);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: false, color: 0xcfe0ff, transparent: true, opacity: 0.8, depthWrite: false,
    })));
  }

  // 지구본
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 2048; mapCanvas.height = 1024;
  drawOcean(mapCanvas.getContext('2d'), 2048, 1024);
  const mapTex = new THREE.CanvasTexture(mapCanvas);
  mapTex.colorSpace = THREE.SRGBColorSpace;
  buildMapTexture(mapTex); // 비동기로 국가 경계 그려넣기

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 96, 64),
    new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.85 })
  );
  scene.add(globe);

  // 구름층 + 대기 글로우
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.02, 48, 32),
    new THREE.MeshStandardMaterial({ map: cloudsTexture(), transparent: true, opacity: 0.85, depthWrite: false })
  );
  scene.add(clouds);

  const atmo = glowSprite('#7fb8ff', '#cfe6ff', R * 2.75);
  atmo.material.opacity = 0.5;
  scene.add(atmo);

  // 대륙 라벨 (탭하면 소개) — 가까이 가면 사라짐
  const continentSprites = CONTINENTS.map((c) => {
    const sp = labelSprite(c.name, { color: '#ffffff', scale: 0.85 });
    latLonToVec3(c.lat, c.lon, R * 1.07, sp.position);
    sp.material.opacity = 0.92;
    scene.add(sp);
    return { ...c, kind: 'continent', sprite: sp, aspect: sp.scale.x / sp.scale.y };
  });

  // 나라 마커 (점 + 국기 라벨) — 줌에 따라 크기 조절
  const countryMarkers = COUNTRIES.map((c) => {
    const dot = glowSprite(c.color, '#ffffff', 0.34);
    latLonToVec3(c.lat, c.lon, R * 1.01, dot.position);
    scene.add(dot);
    const label = labelSprite(`${c.flag} ${c.name}`, { color: '#fff', scale: 0.55 });
    label.position.copy(dot.position).multiplyScalar(1.06);
    scene.add(label);
    return { ...c, kind: 'country', sprite: dot, label, aspect: label.scale.x / label.scale.y };
  });

  /** 카메라 거리에 맞춰 라벨/마커 크기·표시 조절 (클로즈업에서 안 겹치게) */
  function updateLabelScales() {
    const camDist = camera.position.length();
    const zoom = THREE.MathUtils.clamp((camDist - R) / 9, 0.32, 1.25);
    for (const m of countryMarkers) {
      m.sprite.scale.setScalar(0.34 * (0.4 + zoom));
      const h = 0.55 * (0.35 + zoom * 0.85);
      m.label.scale.set(m.aspect * h, h, 1);
    }
    const contOp = THREE.MathUtils.smoothstep(camDist, R + 2.6, R + 5.5) * 0.92;
    for (const c of continentSprites) {
      c.sprite.material.opacity = contOp;
      c.sprite.visible = contOp > 0.03;
      const h = 0.85 * (0.4 + zoom);
      c.sprite.scale.set(c.aspect * h, h, 1);
    }
  }

  // 비행기 + 컨트레일
  const plane = buildPlane();
  plane.scale.setScalar(1.25);
  scene.add(plane);

  const TRAIL_N = 220;
  const trailPos = new Float32Array(TRAIL_N * 3);
  const trailCol = new Float32Array(TRAIL_N * 3);
  const trailAge = new Float32Array(TRAIL_N).fill(1e9);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({
    size: 0.09, sizeAttenuation: true, vertexColors: true,
    map: glowTexture('#ffffff', '#ffffff'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  trail.frustumCulled = false;
  scene.add(trail);
  let trailHead = 0, emitAcc = 0;

  // ---------- 상태 ----------
  let currentCountry = COUNTRIES[0]; // 서울에서 시작
  let flight = null; // {to, a, b, axis, angle, dur, t}
  let cloudSpin = 0;

  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
  const camGoal = new THREE.Vector3();

  function parkPlane(c) {
    latLonToVec3(c.lat, c.lon, R * 1.03, plane.position);
    plane.up.copy(plane.position).normalize();
    tmp.set(0, R * 2, 0); // 대충 북쪽을 바라보게
    plane.lookAt(tmp);
  }
  parkPlane(currentCountry);

  function pathPoint(k, out) {
    const f = flight;
    out.copy(f.a).applyAxisAngle(f.axis, f.angle * k);
    const alt = R * (1.03 + Math.sin(Math.PI * k) * (0.06 + 0.16 * (f.angle / Math.PI)));
    return out.multiplyScalar(alt);
  }

  /** 비행 시작 — 성공하면 나라 객체 반환 (출발 멘트는 main이 담당) */
  function flyTo(id) {
    const to = COUNTRIES.find((c) => c.id === id);
    if (!to || flight || to === currentCountry) return null;
    const a = latLonToVec3(currentCountry.lat, currentCountry.lon, 1, new THREE.Vector3());
    const b = latLonToVec3(to.lat, to.lon, 1, new THREE.Vector3());
    const angle = a.angleTo(b);
    const axis = new THREE.Vector3().crossVectors(a, b);
    if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0); else axis.normalize();
    flight = { to, a, b, axis, angle, dur: 3 + (angle / Math.PI) * 8, t: 0 };
    controls.enabled = false;
    trailAge.fill(1e9);
    return to;
  }

  function emitTrail() {
    trailPos[trailHead * 3] = plane.position.x;
    trailPos[trailHead * 3 + 1] = plane.position.y;
    trailPos[trailHead * 3 + 2] = plane.position.z;
    trailAge[trailHead] = 0;
    trailHead = (trailHead + 1) % TRAIL_N;
  }

  function updateTrail(dt) {
    const LIFE = 3.0;
    for (let i = 0; i < TRAIL_N; i++) {
      trailAge[i] += dt;
      const k = Math.max(0, 1 - trailAge[i] / LIFE) * 0.9;
      trailCol[i * 3] = k; trailCol[i * 3 + 1] = k; trailCol[i * 3 + 2] = k;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
  }

  // ---------- 모드/루프 ----------
  let active = false;

  function enter() {
    active = true;
    controls.enabled = !flight;
  }

  function exit() {
    active = false;
    controls.enabled = false;
  }

  function update(dt) {
    if (!active) return;
    cloudSpin += dt * 0.006;
    clouds.rotation.y = cloudSpin;
    updateLabelScales();

    if (flight) {
      flight.t += dt;
      const k = easeInOutCubic(Math.min(flight.t / flight.dur, 1));
      pathPoint(k, plane.position);
      // 자세: 진행 방향 바라보기
      pathPoint(Math.min(k + 0.004, 1), tmp);
      plane.up.copy(plane.position).normalize();
      if (tmp.distanceToSquared(plane.position) > 1e-9) plane.lookAt(tmp);

      emitAcc += dt;
      if (emitAcc > 0.05) { emitTrail(); emitAcc = 0; }

      // 추적 카메라: 비행기 뒤·위
      tmp2.copy(tmp).sub(plane.position).normalize();        // forward
      tmp3.copy(plane.position).normalize();                 // 표면 법선
      camGoal.copy(plane.position).addScaledVector(tmp2, -2.6).addScaledVector(tmp3, 1.5);
      camera.position.lerp(camGoal, 1 - Math.exp(-4 * dt));
      camera.lookAt(plane.position);

      if (flight.t >= flight.dur) {
        currentCountry = flight.to;
        parkPlane(currentCountry);
        const arrived = flight.to;
        flight = null;
        controls.enabled = true;
        onArrive?.(arrived);
      }
    } else {
      controls.update();
    }
    updateTrail(dt);
  }

  /** 화면픽셀 탭 판정 — 나라 마커(60px) 우선, 대륙 라벨(70px) 차선. 지구 뒷면은 제외 */
  function tapAt(clientX, clientY) {
    const W = window.innerWidth, H = window.innerHeight;
    let best = null, bestD = 1e9;
    const check = (item, pos, radius) => {
      // 카메라 쪽을 향한 면인지 (뒷면 마커 탭 방지)
      tmp.copy(pos).normalize();
      tmp2.copy(camera.position).sub(pos);
      if (tmp.dot(tmp2) < 0) return;
      tmp3.copy(pos).project(camera);
      if (tmp3.z > 1) return;
      const px = ((tmp3.x + 1) / 2) * W;
      const py = ((1 - tmp3.y) / 2) * H;
      const d = Math.hypot(clientX - px, clientY - py);
      if (d < radius && d < bestD) { best = item; bestD = d; }
    };
    for (const m of countryMarkers) check(m, m.sprite.position, 60);
    if (!best) for (const c of continentSprites) check(c, c.sprite.position, 70);
    return best;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  const destItems = COUNTRIES.map((c) => ({ id: c.id, name: c.name, color: c.color, emoji: c.flag }));

  return {
    scene, camera, controls, enter, exit, update, flyTo, tapAt, onResize, destItems,
    get flying() { return !!flight; },
    get current() { return currentCountry; },
  };
}
