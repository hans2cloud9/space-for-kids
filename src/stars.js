// 배경 별 + 항성 근방 뷰(레벨 2)의 이웃 별들
import * as THREE from 'three';
import { glowSprite, glowTexture, labelSprite } from './sprites.js';

/** 아주 먼 배경 별 (항상 보임) */
export function createBackdrop(scene) {
  const COUNT = 5000;
  const R = 250000;
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const palette = [new THREE.Color('#ffffff'), new THREE.Color('#cfe0ff'), new THREE.Color('#ffe9c9'), new THREE.Color('#ffd2d2')];

  for (let i = 0; i < COUNT; i++) {
    // 구면 균등 분포
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = R * s * Math.cos(t);
    positions[i * 3 + 1] = R * u;
    positions[i * 3 + 2] = R * s * Math.sin(t);
    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 2.2, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.85, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return points;
}

// 실제 이웃/유명 별들 — 거리(광년)는 분위기용 배치 기준
const NEIGHBOR_STARS = [
  { name: '프록시마센타우리', ly: 4.2, color: '#ff9c7a', dir: [0.7, -0.2, 0.6] },
  { name: '알파센타우리', ly: 4.4, color: '#fff3c4', dir: [0.75, -0.15, 0.55] },
  { name: '바너드별', ly: 6.0, color: '#ffb08a', dir: [-0.5, 0.3, 0.8] },
  { name: '시리우스', ly: 8.6, color: '#cfe4ff', dir: [-0.8, -0.35, -0.4] },
  { name: '프로키온', ly: 11.5, color: '#fdf6dd', dir: [-0.6, 0.1, -0.75] },
  { name: '알타이르', ly: 16.7, color: '#e8f1ff', dir: [0.2, 0.6, -0.75] },
  { name: '베가', ly: 25, color: '#dceaff', dir: [0.1, 0.8, 0.5] },
  { name: '아르크투루스', ly: 37, color: '#ffcf8a', dir: [-0.3, 0.7, 0.6] },
  { name: '카펠라', ly: 43, color: '#fff0c0', dir: [0.55, 0.5, -0.65] },
  { name: '북극성', ly: 433, color: '#f4f8ff', dir: [0.05, 0.95, 0.1] },
  { name: '베텔게우스', ly: 548, color: '#ff8a5e', dir: [-0.85, 0.2, 0.45] },
];

/** 레벨 2: 태양이 점이 되고 이웃 별들이 나타남 */
export function createNeighborhood(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const fadeables = []; // {mat, base}

  for (const star of NEIGHBOR_STARS) {
    const dist = 60 + Math.min(star.ly, 80) * 3.4; // 멀수록 멀리(압축), 60~330 유닛
    const dir = new THREE.Vector3(...star.dir).normalize();
    const pos = dir.multiplyScalar(dist);

    const sprite = glowSprite(star.color, '#ffffff', 9);
    sprite.position.copy(pos);
    group.add(sprite);
    fadeables.push({ mat: sprite.material, base: 1 });

    const label = labelSprite(star.name, { color: '#cfe0ff', scale: 11 });
    label.position.copy(pos).add(new THREE.Vector3(0, 13, 0));
    group.add(label);
    fadeables.push({ mat: label.material, base: 0.9 });
  }

  // 사이사이 이름 없는 잔별들
  const COUNT = 400;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 70 + Math.random() * 300;
    positions[i * 3] = r * s * Math.cos(t);
    positions[i * 3 + 1] = r * u * 0.7;
    positions[i * 3 + 2] = r * s * Math.sin(t);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 3, sizeAttenuation: true, color: 0xbfd4ff,
    map: glowTexture('#ffffff', '#ffffff'), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  group.add(dust);
  fadeables.push({ mat: dust.material, base: 0.8 });

  function setFade(camDist) {
    // 40~70에서 등장, 600~1400에서 퇴장
    const fadeIn = THREE.MathUtils.smoothstep(camDist, 35, 75);
    const fadeOut = 1 - THREE.MathUtils.smoothstep(camDist, 600, 1400);
    const op = fadeIn * fadeOut;
    group.visible = op > 0.01;
    for (const f of fadeables) f.mat.opacity = op * f.base;
  }

  return { group, setFade };
}
