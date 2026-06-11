// 지구 알아보기 모드 — 실제 국가 경계 지구본 + 대륙/나라 정보 + 비행기 여행
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import { glowSprite, glowTexture, labelSprite, canvasTexture } from './sprites.js';

const R = 5; // 지구본 반지름
const DEG = Math.PI / 180;

// 4~7세용 나라 24개 (대표 도시 좌표 + 명소·동물·음식)
// kind/photo는 도착 사진 카드용. photo 없거나 로드 실패 시 이모지 폴백.
export const COUNTRIES = [
  { id: 'korea',     name: '한국',     flag: '🇰🇷', lat: 37.5,  lon: 127.0,  color: '#7ec8ff', emoji: '🏯', landmark: '경복궁', photo: 'korea.jpg',     fact: '우리가 사는 나라예요! 안녕하세요!',        animal: '🐯 호랑이가 옛날이야기에 나와요',    food: '🥟 김치랑 불고기가 맛있어요' },
  { id: 'japan',     name: '일본',     flag: '🇯🇵', lat: 35.7,  lon: 139.7,  color: '#ffb3c1', emoji: '🗻', landmark: '후지산', photo: 'japan.jpg',     fact: '초밥이랑 후지산이 유명해요!',            animal: '🐒 눈에서 목욕하는 원숭이가 살아요', food: '🍣 초밥이 유명해요' },
  { id: 'china',     name: '중국',     flag: '🇨🇳', lat: 39.9,  lon: 116.4,  color: '#ff8a80', emoji: '🐼', landmark: '만리장성', photo: 'china.jpg',   fact: '귀여운 판다가 사는 나라예요!',          animal: '🐼 대나무를 먹는 판다가 살아요',     food: '🥟 만두가 맛있어요' },
  { id: 'india',     name: '인도',     flag: '🇮🇳', lat: 28.6,  lon: 77.2,   color: '#ffd180', emoji: '🕌', landmark: '타지마할', photo: 'india.jpg',   fact: '하얀 궁전 타지마할이 있어요!',          animal: '🐘 코끼리가 사람들과 함께 살아요',   food: '🍛 향긋한 카레가 유명해요' },
  { id: 'egypt',     name: '이집트',   flag: '🇪🇬', lat: 30.0,  lon: 31.2,   color: '#ffe082', emoji: '🔺', landmark: '피라미드', photo: 'egypt.jpg',   fact: '사막에 커다란 피라미드가 있어요!',      animal: '🐪 사막을 걷는 낙타가 있어요',       food: '🫓 납작한 빵을 먹어요' },
  { id: 'kenya',     name: '케냐',     flag: '🇰🇪', lat: -1.3,  lon: 36.8,   color: '#a5d6a7', emoji: '🦁', landmark: '사바나 초원', photo: 'kenya.jpg', fact: '사자랑 코끼리가 뛰어노는 곳이에요!',    animal: '🦁 사자와 기린이 뛰어놀아요',        food: '🌽 옥수수죽을 먹어요' },
  { id: 'france',    name: '프랑스',   flag: '🇫🇷', lat: 48.9,  lon: 2.4,    color: '#90caf9', emoji: '🗼', landmark: '에펠탑', photo: 'france.jpg',    fact: '뾰족한 에펠탑이 있는 나라예요!',        animal: '🐓 닭이 나라의 상징이에요',          food: '🥐 크루아상이 맛있어요' },
  { id: 'uk',        name: '영국',     flag: '🇬🇧', lat: 51.5,  lon: -0.1,   color: '#b39ddb', emoji: '🕰️', landmark: '빅벤', photo: 'uk.jpg',          fact: '커다란 시계탑 빅벤이 있어요!',          animal: '🐶 불독이 영국 강아지예요',          food: '🍟 피시앤칩스를 먹어요' },
  { id: 'italy',     name: '이탈리아', flag: '🇮🇹', lat: 41.9,  lon: 12.5,   color: '#c5e1a5', emoji: '🏛️', landmark: '콜로세움', photo: 'italy.jpg',  fact: '피자랑 스파게티가 태어난 나라예요!',    animal: '🐺 늑대 이야기가 유명해요',          food: '🍕 피자와 스파게티가 태어났어요' },
  { id: 'usa',       name: '미국',     flag: '🇺🇸', lat: 40.7,  lon: -74.0,  color: '#81d4fa', emoji: '🗽', landmark: '자유의 여신상', photo: 'usa.jpg', fact: '자유의 여신상이 있는 아주 큰 나라예요!', animal: '🦅 흰머리수리가 상징이에요',         food: '🍔 햄버거가 유명해요' },
  { id: 'brazil',    name: '브라질',   flag: '🇧🇷', lat: -22.9, lon: -43.2,  color: '#aed581', emoji: '⛪', landmark: '예수상', photo: 'brazil.jpg',    fact: '아마존 밀림과 축구의 나라예요!',        animal: '🦜 알록달록 투칸 새가 살아요',       food: '⚽ 축구를 제일 좋아해요' },
  { id: 'australia', name: '호주',     flag: '🇦🇺', lat: -33.9, lon: 151.2,  color: '#ffcc80', emoji: '🎭', landmark: '오페라 하우스', photo: 'australia.jpg', fact: '캥거루랑 코알라가 살아요!',    animal: '🦘 캥거루와 코알라가 살아요',        food: '🍖 바비큐를 즐겨 먹어요' },
  { id: 'thailand',  name: '태국',     flag: '🇹🇭', lat: 13.7,  lon: 100.5,  color: '#ffd54f', emoji: '🛕', landmark: '왓아룬 사원', photo: 'thailand.jpg', fact: '코끼리가 많은 따뜻한 나라예요!',  animal: '🐘 코끼리가 친구처럼 지내요',        food: '🍜 팟타이 국수가 맛있어요' },
  { id: 'vietnam',   name: '베트남',   flag: '🇻🇳', lat: 21.0,  lon: 105.8,  color: '#ff8a65', emoji: '⛰️', landmark: '하롱베이', photo: 'vietnam.jpg', fact: '바다에 멋진 바위섬이 많아요!',         animal: '🐃 물소가 논에서 일을 도와요',       food: '🍜 쌀국수가 유명해요' },
  { id: 'indonesia', name: '인도네시아', flag: '🇮🇩', lat: -6.2, lon: 106.8, color: '#80cbc4', emoji: '🛕', landmark: '보로부두르', photo: 'indonesia.jpg', fact: '섬이 아주아주 많은 나라예요!',     animal: '🦧 오랑우탄이 나무에 살아요',        food: '🍚 볶음밥 나시고렝을 먹어요' },
  { id: 'saudi',     name: '사우디아라비아', flag: '🇸🇦', lat: 24.7, lon: 46.7, color: '#ffb74d', emoji: '🕋', landmark: '사막 도시', photo: 'saudi.jpg', fact: '뜨거운 사막이 펼쳐진 나라예요!',    animal: '🐪 낙타를 타고 사막을 다녀요',       food: '🌴 달콤한 대추야자를 먹어요' },
  { id: 'germany',   name: '독일',     flag: '🇩🇪', lat: 52.5,  lon: 13.4,   color: '#bcaaa4', emoji: '🏰', landmark: '노이슈반슈타인 성', photo: 'germany.jpg', fact: '동화 속 같은 멋진 성이 있어요!', animal: '🦅 독수리가 상징이에요',     food: '🌭 소시지를 즐겨 먹어요' },
  { id: 'spain',     name: '스페인',   flag: '🇪🇸', lat: 40.4,  lon: -3.7,   color: '#ffab91', emoji: '⛪', landmark: '사그라다 파밀리아', photo: 'spain.jpg', fact: '신나는 축제가 많은 나라예요!',    animal: '🐂 용감한 소가 유명해요',            food: '🥘 빠에야 밥 요리가 맛있어요' },
  { id: 'russia',    name: '러시아',   flag: '🇷🇺', lat: 55.8,  lon: 37.6,   color: '#9fa8da', emoji: '⛪', landmark: '성 바실리 성당', photo: 'russia.jpg', fact: '세상에서 제일 큰 나라예요!',      animal: '🐻 커다란 불곰이 살아요',            food: '🥧 따끈한 만두 펠메니를 먹어요' },
  { id: 'canada',    name: '캐나다',   flag: '🇨🇦', lat: 45.4,  lon: -75.7,  color: '#ef9a9a', emoji: '🍁', landmark: '단풍 숲', photo: 'canada.jpg',   fact: '단풍잎이 상징인 나라예요!',            animal: '🦫 부지런한 비버가 살아요',          food: '🥞 단풍 시럽을 팬케이크에 발라요' },
  { id: 'mexico',    name: '멕시코',   flag: '🇲🇽', lat: 19.4,  lon: -99.1,  color: '#a5d6a7', emoji: '🔺', landmark: '치첸이트사', photo: 'mexico.jpg', fact: '옛날 신비한 피라미드가 있어요!',     animal: '🦅 독수리와 선인장이 깃발에 있어요', food: '🌮 타코가 유명해요' },
  { id: 'argentina', name: '아르헨티나', flag: '🇦🇷', lat: -34.6, lon: -58.4, color: '#90caf9', emoji: '💃', landmark: '탱고의 거리', photo: 'argentina.jpg', fact: '신나는 탱고 춤의 나라예요!',    animal: '🐆 재규어가 숲에 살아요',            food: '🥩 맛있는 소고기 구이를 먹어요' },
  { id: 'southafrica', name: '남아프리카공화국', flag: '🇿🇦', lat: -33.9, lon: 18.4, color: '#ffd54f', emoji: '⛰️', landmark: '테이블 마운틴', photo: 'southafrica.jpg', fact: '평평한 산과 바다가 멋져요!', animal: '🐧 따뜻한 곳에 펭귄이 살아요', food: '🍖 숯불 고기 브라이를 먹어요' },
  { id: 'newzealand', name: '뉴질랜드', flag: '🇳🇿', lat: -41.3, lon: 174.8, color: '#80deea', emoji: '🥝', landmark: '초록 언덕', photo: 'newzealand.jpg', fact: '초록 언덕과 양이 많은 나라예요!', animal: '🥝 날지 못하는 키위 새가 살아요',  food: '🐑 양이 사람보다 많아요' },
];

// 자연 명소 — 나라와 별개로 지구본 위 마커. 탭/비행 시 사진 카드.
export const NATURAL_WONDERS = [
  { id: 'amazon',  name: '아마존 밀림',       flag: '🌳', lat: -3.5,  lon: -62.0, color: '#66bb6a', emoji: '🌳', landmark: '세계 최대 밀림', photo: 'wonder-amazon.jpg',  fact: '세상에서 제일 큰 밀림이에요!',     animal: '🐆 재규어와 원숭이가 살아요', food: '🦋 나비와 새가 가득해요', isWonder: true },
  { id: 'sahara',  name: '사하라 사막',       flag: '🏜️', lat: 23.0,  lon: 13.0,  color: '#ffca28', emoji: '🏜️', landmark: '세계 최대 사막', photo: 'wonder-sahara.jpg',  fact: '끝없이 펼쳐진 모래 사막이에요!',   animal: '🐪 낙타가 모래언덕을 걸어요', food: '☀️ 낮에는 아주 뜨거워요', isWonder: true },
  { id: 'everest', name: '에베레스트산',     flag: '🏔️', lat: 28.0,  lon: 86.9,  color: '#b0bec5', emoji: '🏔️', landmark: '세계에서 가장 높은 산', photo: 'wonder-everest.jpg', fact: '세상에서 제일 높은 산이에요!', animal: '🐐 산양이 바위를 뛰어다녀요', food: '❄️ 꼭대기는 항상 눈이 쌓여 있어요', isWonder: true },
  { id: 'reef',    name: '그레이트배리어리프', flag: '🐠', lat: -18.3, lon: 147.7, color: '#4dd0e1', emoji: '🐠', landmark: '세계 최대 산호초', photo: 'wonder-reef.jpg',    fact: '바닷속 알록달록 산호 정원이에요!', animal: '🐠 니모 같은 물고기가 살아요', food: '🐢 바다거북도 헤엄쳐요', isWonder: true },
  { id: 'niagara', name: '나이아가라 폭포',   flag: '💧', lat: 43.1,  lon: -79.1, color: '#4fc3f7', emoji: '💧', landmark: '거대한 폭포', photo: 'wonder-niagara.jpg', fact: '엄청난 물이 쏟아지는 폭포예요!',   animal: '🌈 물안개에 무지개가 떠요', food: '🚤 배를 타고 가까이 가요', isWonder: true },
  { id: 'aurora',  name: '오로라',           flag: '🌌', lat: 69.0,  lon: 18.0,  color: '#9575cd', emoji: '🌌', landmark: '밤하늘의 빛',  photo: 'wonder-aurora.jpg',  fact: '밤하늘에 춤추는 색깔 빛이에요!',   animal: '🦌 순록이 눈밭에 살아요', food: '✨ 추운 북쪽 나라에서 보여요', isWonder: true },
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

  // 나라 + 자연 명소 마커 (점 + 라벨) — 줌에 따라 크기 조절
  const PLACES = [...COUNTRIES, ...NATURAL_WONDERS];
  const placeMarkers = PLACES.map((c) => {
    const dot = glowSprite(c.color, '#ffffff', 0.34);
    latLonToVec3(c.lat, c.lon, R * 1.01, dot.position);
    scene.add(dot);
    const label = labelSprite(`${c.flag} ${c.name}`, { color: '#fff', scale: 0.55 });
    label.position.copy(dot.position).multiplyScalar(1.06);
    scene.add(label);
    return { ...c, kind: c.isWonder ? 'wonder' : 'country', sprite: dot, label, aspect: label.scale.x / label.scale.y };
  });

  /** 카메라 거리에 맞춰 라벨/마커 크기·표시 조절 (클로즈업에서 안 겹치게) */
  function updateLabelScales() {
    const camDist = camera.position.length();
    const zoom = THREE.MathUtils.clamp((camDist - R) / 9, 0.32, 1.25);
    for (const m of placeMarkers) {
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
    const to = PLACES.find((c) => c.id === id);
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
    for (const m of placeMarkers) check(m, m.sprite.position, 60);
    if (!best) for (const c of continentSprites) check(c, c.sprite.position, 70);
    return best;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  const destItems = PLACES.map((c) => ({ id: c.id, name: c.name, color: c.color, emoji: c.flag }));

  return {
    scene, camera, controls, enter, exit, update, flyTo, tapAt, onResize, destItems,
    get flying() { return !!flight; },
    get current() { return currentCountry; },
  };
}
