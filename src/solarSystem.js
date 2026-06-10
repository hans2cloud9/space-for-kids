// 태양 + 8행성 + 달 + 토성 고리 — 케플러 궤도로 공전
import * as THREE from 'three';
import { planetPosition, moonPosition, orbitPoints } from './kepler.js';
import { canvasTexture, glowSprite } from './sprites.js';

const DEG = Math.PI / 180;

// 시각 데이터: size(씬 유닛, 과장 스케일·상대 크기 순서는 유지), rotDays(자전주기, 음수=역자전)
export const PLANET_SPECS = [
  { key: 'mercury', name: '수성',   size: 0.080, rotDays: 58.6,   color: '#9c8f85', fact: '태양이랑 제일 가까운 행성이에요!' },
  { key: 'venus',   name: '금성',   size: 0.128, rotDays: -243,   color: '#e8c89a', fact: '제일 뜨겁고 반짝반짝 빛나요!' },
  { key: 'earth',   name: '지구',   size: 0.130, rotDays: 0.997,  color: '#4d8fd1', fact: '우리가 사는 곳이에요!' },
  { key: 'mars',    name: '화성',   size: 0.095, rotDays: 1.026,  color: '#d1603d', fact: '빨간 행성이에요. 로봇 친구들이 탐험하고 있어요!' },
  { key: 'jupiter', name: '목성',   size: 0.435, rotDays: 0.414,  color: '#d6a877', fact: '태양계에서 제일 큰 행성이에요!' },
  { key: 'saturn',  name: '토성',   size: 0.394, rotDays: 0.444,  color: '#e3cf9e', fact: '멋진 고리를 가지고 있어요!' },
  { key: 'uranus',  name: '천왕성', size: 0.260, rotDays: -0.718, color: '#9fd8de', fact: '옆으로 누워서 빙글빙글 돌아요!', tilt: 98 },
  { key: 'neptune', name: '해왕성', size: 0.250, rotDays: 0.671,  color: '#4666d1', fact: '제일 멀리 있는 파란 행성이에요!' },
];

// ---------- 절차적 행성 텍스처 ----------

function rand(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function bandsTexture(colors, { blur = true, seed = 7 } = {}) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const r = rand(seed);
    const n = colors.length;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(0, (i / n) * h, w, h / n + 2);
    }
    if (blur) {
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = colors[Math.floor(r() * n)];
        const y = r() * h;
        ctx.fillRect(0, y, w, 3 + r() * 8);
      }
      ctx.globalAlpha = 1;
    }
  });
}

function speckleTexture(base, speck, count = 220, seed = 3) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const r = rand(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = speck;
      ctx.globalAlpha = 0.15 + r() * 0.3;
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 2 + r() * 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

function earthTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const r = rand(42);
    ctx.fillStyle = '#2e6fc4'; // 바다
    ctx.fillRect(0, 0, w, h);
    // 대륙 (초록 얼룩)
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#5a9b46' : '#4a8a3c';
      ctx.globalAlpha = 0.95;
      const cx = r() * w, cy = h * 0.15 + r() * h * 0.7;
      ctx.beginPath();
      for (let j = 0; j < 7; j++) {
        const a = (j / 7) * Math.PI * 2;
        const rad = 14 + r() * 34;
        ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.6);
      }
      ctx.closePath();
      ctx.fill();
    }
    // 극지방
    ctx.fillStyle = '#eef6ff';
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0, 0, w, 16);
    ctx.fillRect(0, h - 16, w, 16);
    // 구름
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.18 + r() * 0.25;
      ctx.beginPath();
      ctx.ellipse(r() * w, r() * h, 18 + r() * 40, 5 + r() * 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

function jupiterTexture() {
  const tex = bandsTexture(
    ['#caa178', '#e8d6b8', '#b98a5e', '#e3c9a0', '#a87850', '#e8d6b8', '#caa178', '#d9bf95'],
    { seed: 11 }
  );
  const ctx = tex.image.getContext('2d');
  // 대적점
  ctx.fillStyle = '#c4543a';
  ctx.beginPath();
  ctx.ellipse(360, 165, 38, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  tex.needsUpdate = true;
  return tex;
}

function sunTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const r = rand(99);
    ctx.fillStyle = '#ffb83d';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = i % 2 ? '#ffd76b' : '#ff9526';
      ctx.globalAlpha = 0.2 + r() * 0.3;
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 3 + r() * 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

const TEXTURE_MAKERS = {
  mercury: () => speckleTexture('#9c8f85', '#6e6258', 260, 5),
  venus:   () => bandsTexture(['#e8c89a', '#f0d9b0', '#dcb886', '#ecd2a4'], { seed: 8 }),
  earth:   earthTexture,
  mars:    () => speckleTexture('#cf5f3a', '#8f3d24', 180, 13),
  jupiter: jupiterTexture,
  saturn:  () => bandsTexture(['#e3cf9e', '#efe0b8', '#d8c08a', '#e9d7a8'], { seed: 21 }),
  uranus:  () => bandsTexture(['#9fd8de', '#b3e2e7', '#92cfd6'], { blur: false }),
  neptune: () => bandsTexture(['#4666d1', '#5b7ade', '#3a55b8', '#5273d8'], { seed: 31 }),
};

function ringTexture() {
  return canvasTexture(256, 32, (ctx, w, h) => {
    // 가로 방향 = 고리 반지름 방향
    const bands = [
      [0.0, 'rgba(180,160,120,0)'], [0.15, 'rgba(225,205,160,0.85)'],
      [0.4, 'rgba(190,170,130,0.5)'], [0.5, 'rgba(120,105,80,0.1)'],
      [0.62, 'rgba(235,215,170,0.9)'], [0.85, 'rgba(200,180,140,0.6)'],
      [1.0, 'rgba(180,160,120,0)'],
    ];
    const g = ctx.createLinearGradient(0, 0, w, 0);
    bands.forEach(([p, c]) => g.addColorStop(p, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// ---------- 빌드 ----------

export function createSolarSystem(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // 태양
  const sunSize = 0.55;
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(sunSize, 48, 32),
    new THREE.MeshBasicMaterial({ map: sunTexture() })
  );
  group.add(sun);

  const sunGlow = glowSprite('#ffaa33', '#fff6d8', 3.2);
  group.add(sunGlow);

  const light = new THREE.PointLight(0xfff2dd, 3.2, 0, 0);
  group.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  // 궤도선 그룹
  const orbitLines = new THREE.Group();
  group.add(orbitLines);

  const bodies = [];      // 업데이트 대상
  const hitMeshes = [];   // 탭 판정용 (보이지 않는 큰 구)

  function addHitSphere(parent, radius, payload) {
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.userData = payload;
    parent.add(hit);
    hitMeshes.push(hit);
  }

  addHitSphere(group, sunSize * 1.6, { name: '태양', fact: '모두에게 빛을 주는 별이에요!', size: sunSize, followDist: 4.5, getPos: (v) => v.set(0, 0, 0) });

  for (const spec of PLANET_SPECS) {
    const pivot = new THREE.Group(); // 위치 담당
    group.add(pivot);

    const tiltGroup = new THREE.Group(); // 자전축 기울기
    if (spec.tilt) tiltGroup.rotation.z = spec.tilt * DEG;
    pivot.add(tiltGroup);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(spec.size, 40, 28),
      new THREE.MeshStandardMaterial({ map: TEXTURE_MAKERS[spec.key](), roughness: 0.9, metalness: 0 })
    );
    tiltGroup.add(mesh);

    // 토성 고리
    if (spec.key === 'saturn') {
      const ringGeo = new THREE.RingGeometry(spec.size * 1.35, spec.size * 2.3, 96);
      // RingGeometry uv를 반지름 방향으로 다시 매핑
      const pos = ringGeo.attributes.position;
      const uv = ringGeo.attributes.uv;
      const inner = spec.size * 1.35, outer = spec.size * 2.3;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
      }
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ map: ringTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2 + 27 * DEG; // 토성 기울기
      pivot.add(ring);
    }

    // 달 (지구에만)
    let moonPivot = null;
    if (spec.key === 'earth') {
      moonPivot = new THREE.Group();
      pivot.add(moonPivot);
      const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 24, 16),
        new THREE.MeshStandardMaterial({ map: speckleTexture('#b9b4ae', '#7e7a74', 160, 17), roughness: 1 })
      );
      moonPivot.add(moonMesh);
      addHitSphere(moonPivot, 0.2, {
        name: '달', fact: '지구의 단짝 친구예요!', size: 0.045, followDist: 0.7,
        getPos: (v) => moonPivot.getWorldPosition(v),
      });
      bodies.push({ kind: 'moon', pivot: moonPivot, mesh: moonMesh });
    }

    addHitSphere(pivot, Math.max(spec.size * 2.4, 0.28), {
      name: spec.name, fact: spec.fact, size: spec.size, followDist: Math.max(spec.size * 8, 1.1),
      getPos: (v) => pivot.getWorldPosition(v),
    });

    // 궤도선
    const pts = orbitPoints(spec.key);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: new THREE.Color(spec.color), transparent: true, opacity: 0.35 })
    );
    orbitLines.add(line);

    bodies.push({ kind: 'planet', spec, pivot, mesh });
  }

  const tmp = { x: 0, y: 0, z: 0 };

  function update(simDays) {
    sun.rotation.y = (Math.PI * 2 * simDays) / 25.4;
    for (const b of bodies) {
      if (b.kind === 'planet') {
        planetPosition(b.spec.key, simDays, tmp);
        b.pivot.position.set(tmp.x, tmp.y, tmp.z);
        b.mesh.rotation.y = (Math.PI * 2 * simDays) / b.spec.rotDays;
      } else if (b.kind === 'moon') {
        moonPosition(simDays, 0.32, tmp);
        b.pivot.position.set(tmp.x, tmp.y, tmp.z);
        b.mesh.rotation.y = (Math.PI * 2 * simDays) / 27.32;
      }
    }
  }

  function setFade(camDist) {
    // 멀어지면 태양계 통째로 숨김 (이후엔 은하 뷰의 태양 마커가 역할을 이어받음)
    group.visible = camDist < 700;
    const lineOp = (1 - THREE.MathUtils.smoothstep(camDist, 25, 70)) * 0.35;
    orbitLines.children.forEach((l) => (l.material.opacity = lineOp));
    // 태양 글로우는 멀어질수록 살짝 키워서 '빛나는 점'으로 유지
    const g = 3.2 + Math.min(camDist * 0.06, 14);
    sunGlow.scale.setScalar(g);
    sunGlow.material.opacity = 1 - THREE.MathUtils.smoothstep(camDist, 420, 680);
  }

  return { group, hitMeshes, update, setFade };
}
