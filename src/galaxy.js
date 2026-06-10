// 우리은하 + 국부은하군 — 물리 계산이 아닌 파티클 연출 (스케일 체험이 목적)
import * as THREE from 'three';
import { glowTexture, ringTexture, labelSprite } from './sprites.js';

/** 나선은하 파티클 생성기 */
function spiralGalaxy({
  count = 50000, radius = 3000, arms = 2, spin = 4.2,
  thickness = 0.05, innerColor = '#ffd9a0', outerColor = '#9bb8ff', bulgeColor = '#ffe9c2',
  size = 14,
}) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const cIn = new THREE.Color(innerColor);
  const cOut = new THREE.Color(outerColor);
  const cBulge = new THREE.Color(bulgeColor);
  const tmp = new THREE.Color();

  const bulgeCount = Math.floor(count * 0.22);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    if (i < bulgeCount) {
      // 중심 벌지: 납작한 가우시안 구
      const r = Math.pow(Math.random(), 2) * radius * 0.22;
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      positions[i3] = r * s * Math.cos(t);
      positions[i3 + 1] = r * u * 0.45;
      positions[i3 + 2] = r * s * Math.sin(t);
      tmp.copy(cBulge).lerp(cIn, Math.random() * 0.5);
    } else {
      // 나선팔
      const t = Math.pow(Math.random(), 0.72);
      const r = t * radius;
      const armAngle = ((i % arms) / arms) * Math.PI * 2;
      const angle = armAngle + (r / radius) * spin;
      // 팔에서 벗어나는 산포 (멀수록 넓게)
      const spread = (Math.pow(Math.random(), 2.2) * (Math.random() < 0.5 ? 1 : -1)) * (0.12 + t * 0.25) * radius;
      const sx = Math.cos(angle) * r + Math.cos(angle + Math.PI / 2) * spread;
      const sz = Math.sin(angle) * r + Math.sin(angle + Math.PI / 2) * spread;
      const sy = (Math.pow(Math.random(), 2.5) * (Math.random() < 0.5 ? 1 : -1)) * radius * thickness * (1 - t * 0.5);
      positions[i3] = sx; positions[i3 + 1] = sy; positions[i3 + 2] = sz;
      tmp.copy(cIn).lerp(cOut, Math.min(1, t * 1.15));
    }
    colors[i3] = tmp.r; colors[i3 + 1] = tmp.g; colors[i3 + 2] = tmp.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size, sizeAttenuation: true, vertexColors: true,
    map: glowTexture('#ffffff', '#ffffff'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

/** 작은 불규칙은하(마젤란은하용) 블롭 */
function blobGalaxy({ count = 2500, radius = 450, color = '#cfd8ff', size = 12 }) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.pow(Math.random(), 1.6) * radius;
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = r * s * Math.cos(t);
    positions[i * 3 + 1] = r * u * 0.6;
    positions[i * 3 + 2] = r * s * Math.sin(t);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size, sizeAttenuation: true, color: new THREE.Color(color),
    map: glowTexture('#ffffff', '#ffffff'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

/** 레벨 3: 우리은하 — 태양(월드 원점)이 나선팔 위에 오도록 중심을 비껴 배치 */
export function createMilkyWay(scene) {
  const group = new THREE.Group();
  group.position.set(-1600, 0, 0); // 은하 중심 ← 태양은 원점
  scene.add(group);

  const points = spiralGalaxy({ count: 60000, radius: 3000, arms: 2, spin: 4.4 });
  group.add(points);

  // "우리 태양은 여기!" 마커 (월드 원점 = 태양 위치)
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({
    map: ringTexture('#ffd966'), transparent: true, depthWrite: false,
  }));
  marker.scale.setScalar(220);
  scene.add(marker);

  const markerLabel = labelSprite('우리 태양은 여기!', { color: '#ffe9a8', scale: 260 });
  markerLabel.position.set(0, 300, 0);
  scene.add(markerLabel);

  const nameLabel = labelSprite('우리은하', { color: '#cfe0ff', scale: 1500 });
  nameLabel.position.set(0, 2400, 0);
  group.add(nameLabel);

  let t = 0;
  function update(dt) {
    t += dt;
    group.rotation.y += dt * 0.004; // 아주 천천히 회전 (연출)
    const pulse = 1 + Math.sin(t * 3) * 0.18;
    marker.scale.setScalar(220 * pulse);
  }

  function setFade(camDist) {
    const fadeIn = THREE.MathUtils.smoothstep(camDist, 350, 1100);
    points.material.opacity = fadeIn;
    group.visible = fadeIn > 0.01;
    // 마커는 은하 뷰에서만 (가까우면 숨김, 은하군 뷰에선 작아서 의미 없으니 퇴장)
    const mk = THREE.MathUtils.smoothstep(camDist, 700, 1500) * (1 - THREE.MathUtils.smoothstep(camDist, 9000, 18000));
    marker.material.opacity = mk;
    markerLabel.material.opacity = mk * 0.95;
    marker.visible = markerLabel.visible = mk > 0.01;
    // 은하 이름표는 은하군 뷰에서
    const nm = THREE.MathUtils.smoothstep(camDist, 7000, 14000);
    nameLabel.material.opacity = nm;
    nameLabel.visible = nm > 0.01;
  }

  return { group, update, setFade };
}

/** 레벨 4: 국부은하군 — 안드로메다 + 대·소마젤란은하 */
export function createLocalGroup(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const items = []; // {obj, rotSpeed, axis}

  // 안드로메다 (우리은하보다 큼)
  const andromeda = new THREE.Group();
  const m31 = spiralGalaxy({
    count: 16000, radius: 3800, arms: 2, spin: 4.0,
    innerColor: '#ffd9b0', outerColor: '#a8c0ff', size: 26,
  });
  andromeda.add(m31);
  andromeda.position.set(20000, 6500, -24000);
  andromeda.rotation.set(0.6, 0.3, 0.35);
  group.add(andromeda);
  items.push({ obj: andromeda, points: m31, rotSpeed: 0.005 });

  const m31Label = labelSprite('안드로메다은하', { color: '#ffd9b0', scale: 1900 });
  m31Label.position.set(20000, 11500, -24000);
  group.add(m31Label);

  // 대마젤란은하 / 소마젤란은하 (우리은하 근처의 작은 친구들)
  const lmc = blobGalaxy({ count: 3000, radius: 520, color: '#cfd8ff', size: 16 });
  lmc.position.set(2600, -1100, 2700);
  group.add(lmc);
  items.push({ obj: lmc, points: lmc, rotSpeed: 0.01 });

  const smc = blobGalaxy({ count: 1800, radius: 330, color: '#bcd0f5', size: 14 });
  smc.position.set(4100, -1600, 3500);
  group.add(smc);
  items.push({ obj: smc, points: smc, rotSpeed: 0.012 });

  const magLabel = labelSprite('마젤란은하', { color: '#cfd8ff', scale: 1300 });
  magLabel.position.set(3300, -2700, 3100);
  group.add(magLabel);

  const labels = [m31Label, magLabel];

  function update(dt) {
    for (const it of items) it.obj.rotation.y += dt * it.rotSpeed;
  }

  function setFade(camDist) {
    const fadeIn = THREE.MathUtils.smoothstep(camDist, 5000, 12000);
    group.visible = fadeIn > 0.01;
    for (const it of items) it.points.material.opacity = fadeIn;
    for (const l of labels) l.material.opacity = fadeIn * 0.95;
  }

  return { group, update, setFade };
}
