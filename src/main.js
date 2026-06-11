// 우주 여행 — 아이들을 위한 우주 시뮬레이션 (태양계 케플러 궤도 + 은하 스케일 여행)
import * as THREE from 'three';
import { createCameraRig, levelFor, LEVELS } from './camera.js';
import { createSolarSystem } from './solarSystem.js';
import { createBackdrop, createNeighborhood } from './stars.js';
import { createMilkyWay, createLocalGroup } from './galaxy.js';
import { createUI, burstConfetti } from './ui.js';
import { createStarGame } from './starGame.js';
import { loadKids, saveKids, affectionate, KID_COLORS } from './profile.js';
import { createRocket } from './rocket.js';
import { createEarthWorld } from './earth.js';
import { PLANET_SPECS } from './solarSystem.js';
import { speak, startAmbient, setMuted, isMuted, unlockAudio } from './audio.js';

// 받침 규칙: '으로/로'
function roParticle(word) {
  const last = word.charCodeAt(word.length - 1);
  const jong = (last - 0xac00) % 28;
  return jong === 0 || jong === 8 ? '로' : '으로'; // 받침 없음 또는 ㄹ받침 → 로
}

// ---------- 기본 세팅 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#02040f');

const rig = createCameraRig(renderer);

// ---------- 월드 구성 ----------
createBackdrop(scene);
const solar = createSolarSystem(scene);
const hood = createNeighborhood(scene);
const milky = createMilkyWay(scene);
const local = createLocalGroup(scene);

// ---------- 상태 ----------
let started = false;
let simDays = 0;       // J2000 기준 경과일 (임의 시작점)
let daysPerSec = 5;    // ▶️ 보통
let currentLevel = 1;
let narrTimer = null; // 레벨이 '안정'된 뒤에만 내레이션
let lastCelebrationAt = -1e9; // 별 찾기 축하 직후엔 레벨 안내 억제
let mode = 'explore';  // 'explore' | 'ship'(로켓 여행) | 'earth'(지구 알아보기)
let prevDaysPerSec = 5;
let launching = false; // 카운트다운 중 중복 방지

// ---------- 아이 프로필 (localStorage 저장 — 한 번만 등록) ----------
let kids = loadKids(); // ['태경', '창민'] 형태 | null이면 등록 화면

// ---------- UI ----------
const ui = createUI({
  kids,
  onSaveKids: (names, wasFirst) => {
    saveKids(names);
    if (!wasFirst) { location.reload(); return; } // 이름 변경: 깨끗하게 다시 시작
    kids = names;
    initGame(names); // 첫 등록: 바로 게임 구성하고 출발
  },
  onSpeed: (v) => { daysPerSec = v; },
  onLevel: (n) => {
    const lv = LEVELS[n - 1];
    rig.stopFollow();
    rig.flyTo(lv.dist, new THREE.Vector3(0, 0, 0), 2.4);
  },
  onHome: () => {
    if (mode === 'ship') { exitShipMode(); return; }
    if (mode === 'earth') { exitEarthMode(); return; }
    rig.stopFollow();
    rig.flyTo(22, new THREE.Vector3(0, 0, 0), 2.0);
  },
  onLaunch: () => startLaunch(),
  onBoost: (b) => rocket.setBoost(b),
  onEarth: () => enterEarthMode(),
  onSoundToggle: () => {
    setMuted(!isMuted());
    return isMuted();
  },
  onStart: () => {
    started = true;
    startAmbient();
    // iOS에서 음성 목록 로드 트리거
    window.speechSynthesis?.getVoices();
    setTimeout(() => speak('우주 여행을 떠나요! 행성을 콕 눌러 보세요.'), 300);
    ui.showSubtitle('행성을 콕 눌러 보세요!');
  },
});

// ---------- 별 찾기 게임 ----------
let game = null; // 등록된 아이 이름으로 구성 (첫 실행은 등록 후 생성)

function initGame(names) {
  const kidDefs = names.map((n, i) => ({
    id: `kid${i}`,
    name: n,
    display: affectionate(n), // 태경 → 태경이
    color: KID_COLORS[i % KID_COLORS.length],
  }));
  game = createStarGame(scene, {
    kids: kidDefs,
    onStart: (q) => {
      const msg = `${q.name} 별이 우주에 숨었어요! 화살표를 따라 찾아보세요!`;
      speak(msg);
      ui.showSubtitle(msg);
      if (mode === 'ship') refreshDestBar(); // 목적지 바에 별 추가
    },
    onFound: (q) => {
      lastCelebrationAt = performance.now();
      if (mode === 'ship') setTimeout(refreshDestBar, 100); // 찾은 별은 목적지에서 제거
      burstConfetti();
      ui.showName(`${q.name} 별 🎉`);
      const msg = `우와! ${q.name} 별을 찾았어요! 정말 잘했어요!`;
      speak(msg);
      ui.showSubtitle(msg);
    },
  });
  ui.buildQuestButtons(kidDefs, (id) => {
    if (started) game.start(id);
  });
}

if (kids) initGame(kids);

// ---------- 로켓 여행 모드 ----------
const rocket = createRocket(scene);

const DEST_ORDER = ['태양', '수성', '금성', '지구', '달', '화성', '목성', '토성', '천왕성', '해왕성', '명왕성'];
const DEST_EXTRA = { 태양: { color: '#ffb83d', emoji: '☀️' }, 달: { color: '#b9b4ae', emoji: '🌙' } };
let destItems = []; // {id, name, color, emoji?, data?(hitMesh userData), quest?}

function buildDestItems() {
  const bodies = solar.hitMeshes
    .map((h) => h.userData)
    .filter((d) => !d.isSatellite) // 위성은 너무 작아 로켓 목적지에서 제외
    .filter((d, i, arr) => arr.findIndex((x) => x.name === d.name) === i)
    .sort((a, b) => DEST_ORDER.indexOf(a.name) - DEST_ORDER.indexOf(b.name))
    .map((d) => ({
      id: d.name, name: d.name, data: d,
      color: PLANET_SPECS.find((s) => s.name === d.name)?.color || DEST_EXTRA[d.name]?.color,
      emoji: DEST_EXTRA[d.name]?.emoji || null,
    }));
  const stars = (game?.quests ?? [])
    .filter((q) => q.active)
    .map((q) => ({ id: `quest-${q.id}`, name: `${q.name} 별`, color: q.color, emoji: '⭐', quest: q }));
  destItems = [...bodies, ...stars];
  return destItems;
}

function refreshDestBar() {
  ui.setDestinations(buildDestItems(), (id) => {
    const item = destItems.find((i) => i.id === id);
    if (item) pickDest(item);
  });
  ui.setActiveDest(rocket.target ? `dest-${rocket.target.name}` : null);
}

function pickDest(item) {
  if (mode !== 'ship' || launching) return;
  let t;
  if (item.quest) {
    const q = item.quest;
    t = {
      name: item.name, fact: '', silent: true, // 별 도착 축하는 starGame found가 담당
      getPos: (v) => v.copy(q.star.position),
      arriveR: 16, orbitR: 8,
    };
  } else {
    const d = item.data;
    const orbitR = Math.max(d.size * 3, 0.16); // 행성 크기에 비례한 궤도 (행성이 화면에 크게)
    t = {
      name: d.name, fact: d.fact,
      getPos: d.getPos,
      arriveR: orbitR + 0.3, orbitR,
    };
  }
  rocket.setTarget(t);
  ui.setActiveDest(item.id);
  speak(`${t.name}${roParticle(t.name)} 출발!`);
  ui.showSubtitle(`${t.name}까지 슝~ 날아가요!`);
}

rocket.onArrive = (t) => {
  ui.setActiveDest(null);
  if (t.silent) return; // 게임 별: found 축하가 곧 발동
  ui.showName(t.name);
  speak(`${t.name} 도착! ${t.fact}`);
  ui.showSubtitle(t.fact);
};

function enterShipMode() {
  if (mode === 'ship') return;
  mode = 'ship';
  prevDaysPerSec = daysPerSec;
  daysPerSec = 0.5; // 비행 중엔 행성이 도망가지 않게
  rig.setManual(true);
  ui.setShipMode(true);
  refreshDestBar();
}

function exitShipMode() {
  if (mode !== 'ship') return;
  mode = 'explore';
  launching = false;
  rocket.deactivate();
  daysPerSec = prevDaysPerSec;
  rig.setManual(false);
  ui.setShipMode(false);
  rig.flyTo(22, new THREE.Vector3(0, 0, 0), 2.0);
}

function startLaunch() {
  if (!started || launching) return;
  enterShipMode();
  launching = true;
  rocket.clearTarget();
  ui.setActiveDest(null);
  rocket.toPad(simDays);

  const steps = [
    [400, '3', '셋'], [1400, '2', '둘'], [2400, '1', '하나'],
    [3400, '발사! 🚀', '발사!'],
  ];
  for (const [delay, big, say] of steps) {
    setTimeout(() => {
      if (mode !== 'ship') return;
      ui.showName(big, 900);
      speak(say);
      if (say === '발사!') rocket.liftoff();
    }, delay);
  }
  setTimeout(() => {
    if (mode !== 'ship') return;
    launching = false;
    const msg = '우주선이 출발했어요! 아래에서 가고 싶은 곳을 골라 보세요!';
    speak(msg);
    ui.showSubtitle(msg);
  }, 3400 + 4200);
}

// ---------- 지구 알아보기 모드 ----------
const earth = createEarthWorld(renderer, {
  onArrive: (c) => {
    ui.setActiveDest(null);
    ui.showName(`${c.flag} ${c.name}`);
    const stripEmoji = (s) => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/gu, '').trim();
    const lines = [`${c.name} 도착!`, c.fact, c.animal, c.food].filter(Boolean).map(stripEmoji);
    speak(lines.join(' '));
    ui.showSubtitle(c.fact);
    ui.showPhotoCard(c);
  },
});

function setQuestChipsHidden(hidden) {
  document.querySelectorAll('.quest-chip').forEach((c) => {
    c.style.visibility = hidden ? 'hidden' : '';
  });
}

function startEarthFlight(id) {
  const c = earth.flyTo(id);
  if (!c) return;
  ui.setActiveDest(id);
  speak(`${c.name}${roParticle(c.name)} 출발! 비행기가 날아가요!`);
  ui.showSubtitle(`${c.flag} ${c.name}까지 비행기 타고 슝~!`);
}

function enterEarthMode() {
  if (!started || mode === 'earth') return;
  if (mode === 'ship') exitShipMode();
  mode = 'earth';
  rig.setManual(true); // 우주 컨트롤 정지
  earth.enter();
  ui.setEarthMode(true);
  ui.setDestinations(earth.destItems, (id) => startEarthFlight(id));
  setQuestChipsHidden(true);
  const msg = '지구에 왔어요! 가고 싶은 나라를 골라 보세요!';
  speak(msg);
  ui.showSubtitle(msg);
  ui.showName('🌍 지구');
}

function exitEarthMode() {
  if (mode !== 'earth') return;
  mode = 'explore';
  earth.exit();
  rig.setManual(false);
  ui.setEarthMode(false);
  ui.hidePhotoCard();
  setQuestChipsHidden(false);
  rig.flyTo(22, new THREE.Vector3(0, 0, 0), 2.0);
}

// ---------- 행성 탭 ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = null;

let lastDrag = null;

// 어떤 터치든 잠든 오디오를 깨운다 (탭 전환·절전 후 무음 방지)
window.addEventListener('pointerdown', unlockAudio, { capture: true });

renderer.domElement.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
  lastDrag = { x: e.clientX, y: e.clientY };
});

// ship 모드 수동 조향: 드래그로 로켓 기수 돌리기
renderer.domElement.addEventListener('pointermove', (e) => {
  if (mode !== 'ship' || !downPos || !lastDrag) return;
  const dx = e.clientX - lastDrag.x;
  const dy = e.clientY - lastDrag.y;
  lastDrag = { x: e.clientX, y: e.clientY };
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  if (moved > 10) {
    rocket.setDragging(true);
    rocket.steer(dx, dy);
  }
});

function raycastBody(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, rig.camera);
  const hits = raycaster.intersectObjects(solar.hitMeshes, false);
  return hits.length ? hits[0].object.userData : null;
}

renderer.domElement.addEventListener('pointerup', (e) => {
  rocket.setDragging(false);
  if (!downPos || !started) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  lastDrag = null;
  if (moved > 10) return; // 드래그는 무시

  // --- earth 모드: 탭 = 나라 비행 / 대륙 소개 ---
  if (mode === 'earth') {
    const hit = earth.tapAt(e.clientX, e.clientY);
    if (!hit) return;
    if (hit.kind === 'country' || hit.kind === 'wonder') {
      startEarthFlight(hit.id);
    } else {
      ui.showName(hit.name);
      speak(hit.fact);
      ui.showSubtitle(hit.fact);
    }
    return;
  }

  const quest = game?.tapAt(e.clientX, e.clientY, rig.camera);

  // --- ship 모드: 탭 = 로켓 목적지 지정 ---
  if (mode === 'ship') {
    if (launching) return;
    if (quest) {
      const item = destItems.find((i) => i.quest === quest);
      if (item) pickDest(item);
      return;
    }
    const data = raycastBody(e);
    if (data) {
      const item = destItems.find((i) => i.name === data.name);
      if (item) pickDest(item);
    }
    return;
  }

  // --- explore 모드: 기존 동작 ---
  // 게임 별 탭: 어느 줌 레벨에서든 → 카메라가 별로 날아감 (도착하면 '찾았다!' 발동)
  if (quest) {
    speak(`${quest.name} 별을 발견했어요! 가 볼까요?`);
    rig.flyTo(15, quest.star.position.clone(), 2.4);
    return;
  }

  if (rig.distance() > 60) return; // 행성 탭은 태양계 뷰에서만
  const data = raycastBody(e);
  if (!data) return;

  ui.showName(data.name);
  // 받침 유무에 따라 '이에요/예요' 선택
  const last = data.name.charCodeAt(data.name.length - 1);
  const particle = (last - 0xac00) % 28 > 0 ? '이에요' : '예요';
  speak(`${data.name}${particle}! ${data.fact}`);
  ui.showSubtitle(data.fact);
  rig.followBody(data.getPos, data.followDist);
});

// ---------- 루프 ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  // 지구 알아보기 모드: 별도 씬만 렌더 (우주는 일시정지)
  if (mode === 'earth') {
    earth.update(dt);
    renderer.render(earth.scene, earth.camera);
    return;
  }

  if (started) simDays += daysPerSec * dt;

  solar.update(simDays);
  milky.update(dt);
  local.update(dt);
  rig.update(dt);
  if (mode === 'ship') {
    rocket.update(dt, simDays);
    rocket.applyCamera(rig.camera, dt);
  }
  if (game) game.update(dt, rig.camera);

  // 거리 기반 크로스페이드 + 레벨 판정
  const d = rig.distance();
  solar.setFade(d);
  hood.setFade(d);
  milky.setFade(d);
  local.setFade(d);

  const lv = levelFor(d);
  if (lv !== currentLevel) {
    currentLevel = lv;
    ui.setActiveLevel(lv);
    if (started) {
      // 레벨을 휙휙 지나칠 땐 잠잠히 있다가, 1초간 머무르면 그 레벨을 소개
      clearTimeout(narrTimer);
      narrTimer = setTimeout(() => {
        if (mode === 'ship') return; // 로켓 여행 중엔 레벨 안내 생략
        if (performance.now() - lastCelebrationAt < 5000) return; // 축하 중엔 조용히
        const text = LEVELS[currentLevel - 1].narration;
        speak(text);
        ui.showSubtitle(text);
      }, 1000);
    }
  }

  renderer.render(scene, rig.camera);
}
animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.onResize();
  earth.onResize();
});

// 자동 테스트용 훅 (?test 파라미터가 있을 때만)
if (new URLSearchParams(location.search).has('test')) {
  window.__test = {
    rig, rocket, earth, solar,
    get game() { return game; },
    startEarthFlight,
    enterShipMode, enterEarthMode,
    mode: () => mode,
    pick: (name) => {
      const item = destItems.find((i) => i.name === name);
      if (item) pickDest(item);
    },
  };
}
