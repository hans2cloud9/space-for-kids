// SpaceX 스타일 로켓 — 지구 발사대에서 발사, 목적지 자동비행 + 수동 조향 + 부스터
import * as THREE from 'three';
import { glowSprite, glowTexture } from './sprites.js';
import { planetPosition } from './kepler.js';

const EARTH_SIZE = 0.13;          // solarSystem.js의 지구 size와 동일
const MODEL_FORWARD = new THREE.Vector3(0, 1, 0); // 모델 기수 방향 = +Y
const LIFTOFF_DUR = 4.0;
const RISE_DIST = 0.9;            // 발사 상승 거리(씬 유닛)

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------- 외형 (절차 생성) ----------
function buildRocketMesh() {
  const g = new THREE.Group();
  const L = 0.055, R = L * 0.075;
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.55 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.7 });
  const gray = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.8 });

  const add = (geo, mat, y) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    g.add(m);
    return m;
  };

  // 엔진 노즐 → 1단 본체 → 검은 인터스테이지 → 2단 → 노즈콘
  add(new THREE.CylinderGeometry(R * 0.55, R * 0.85, L * 0.06, 12), gray, L * 0.03);
  add(new THREE.CylinderGeometry(R, R, L * 0.56, 16), white, L * 0.06 + L * 0.28);
  add(new THREE.CylinderGeometry(R * 1.01, R * 1.01, L * 0.07, 16), black, L * 0.62 + L * 0.035);
  add(new THREE.CylinderGeometry(R * 0.99, R, L * 0.17, 16), white, L * 0.69 + L * 0.085);
  add(new THREE.CylinderGeometry(0.0015, R * 0.99, L * 0.14, 16), white, L * 0.86 + L * 0.07);

  // 그리드핀 4개 (인터스테이지 부근)
  const finGeo = new THREE.BoxGeometry(R * 0.9, L * 0.05, 0.0022);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(finGeo, black);
    const a = (i / 4) * Math.PI * 2;
    fin.position.set(Math.cos(a) * R * 1.3, L * 0.6, Math.sin(a) * R * 1.3);
    fin.rotation.y = -a;
    g.add(fin);
  }
  g.userData.length = L;
  return g;
}

// ---------- 로켓 ----------
export function createRocket(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const mesh = buildRocketMesh();
  group.add(mesh);
  const L = mesh.userData.length;

  // 엔진 화염 (세로로 길쭉한 글로우)
  const flame = glowSprite('#ff8c3a', '#fff3c0', 1);
  flame.position.y = -L * 0.22;
  flame.material.opacity = 0;
  group.add(flame);

  // 비행 트레일 (링버퍼 파티클 — additive라 검정으로 페이드 = 투명화)
  const TRAIL_N = 160;
  const trailPos = new Float32Array(TRAIL_N * 3);
  const trailCol = new Float32Array(TRAIL_N * 3);
  const trailAge = new Float32Array(TRAIL_N).fill(1e9);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({
    size: 0.02, sizeAttenuation: true, vertexColors: true,
    map: glowTexture('#ffffff', '#ffffff'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  trail.visible = false;
  trail.frustumCulled = false;
  scene.add(trail);
  let trailHead = 0, emitAcc = 0;

  // 발사 연기
  const smokes = [];
  for (let i = 0; i < 22; i++) {
    const s = glowSprite('#9aa0a8', '#cfd2d6', 0.1);
    s.visible = false;
    scene.add(s);
    smokes.push({ sp: s, vel: new THREE.Vector3(), life: 0 });
  }

  // ---------- 상태 ----------
  let state = 'idle'; // idle | pad | liftoff | cruise | orbiting
  let liftT = 0;
  const padDir = new THREE.Vector3(0, 0.62, 0.79).normalize(); // 발사장 방향 (지구 로컬 고정)
  const sideDir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const pos = group.position;
  let speed = 0;
  let boost = false;
  let dragging = false;
  let target = null; // {name, fact, getPos(v), arriveR, orbitR, isQuestStar}
  let onArrive = null;

  // 궤도 돌기 기저
  const orbU = new THREE.Vector3(), orbV = new THREE.Vector3(), orbW = new THREE.Vector3();
  let orbAng = 0;

  // 카메라 추적
  const camPos = new THREE.Vector3();
  let camInit = false;
  let fovTarget = 55;

  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tpos = new THREE.Vector3();
  const fwdV = new THREE.Vector3(), axisV = new THREE.Vector3(), desiredV = new THREE.Vector3();
  const earthV = { x: 0, y: 0, z: 0 };
  const dq = new THREE.Quaternion();

  const forward = (out) => out.copy(MODEL_FORWARD).applyQuaternion(q);

  function earthPos(simDays, out) {
    planetPosition('earth', simDays, earthV);
    return out.set(earthV.x, earthV.y, earthV.z);
  }

  // 주의: dir로 tmp/tmp2를 넘기지 말 것 — 전용 벡터(fwdV/axisV)만 내부 사용
  function turnToward(dir, maxTurn) {
    forward(fwdV);
    const angle = fwdV.angleTo(dir);
    if (angle < 1e-4) return;
    axisV.crossVectors(fwdV, dir);
    if (axisV.lengthSq() < 1e-10) axisV.set(0, 1, 0);
    axisV.normalize();
    dq.setFromAxisAngle(axisV, Math.min(angle, maxTurn));
    q.premultiply(dq);
  }

  function emitTrail(strength) {
    forward(tmp);
    trailPos[trailHead * 3] = pos.x - tmp.x * L * 0.4;
    trailPos[trailHead * 3 + 1] = pos.y - tmp.y * L * 0.4;
    trailPos[trailHead * 3 + 2] = pos.z - tmp.z * L * 0.4;
    trailAge[trailHead] = 0;
    trailHead = (trailHead + 1) % TRAIL_N;
    void strength;
  }

  function updateTrail(dt) {
    const LIFE = 1.6;
    for (let i = 0; i < TRAIL_N; i++) {
      trailAge[i] += dt;
      const k = Math.max(0, 1 - trailAge[i] / LIFE);
      // 주황 → 검정(additive에서 투명)
      trailCol[i * 3] = 1.0 * k;
      trailCol[i * 3 + 1] = 0.55 * k;
      trailCol[i * 3 + 2] = 0.25 * k;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
  }

  function burstSmoke(base, dir) {
    for (const s of smokes) {
      s.sp.visible = true;
      s.life = 1.4 + Math.random() * 1.2;
      s.sp.position.copy(base).addScaledVector(dir, -0.01);
      // 발사대 주변 사방으로
      tmp2.set(Math.random() - 0.5, Math.random() * 0.15, Math.random() - 0.5).normalize();
      s.vel.copy(tmp2).multiplyScalar(0.05 + Math.random() * 0.07);
      s.sp.scale.setScalar(0.04 + Math.random() * 0.05);
      s.sp.material.opacity = 0.5;
    }
  }

  function updateSmoke(dt) {
    for (const s of smokes) {
      if (!s.sp.visible) continue;
      s.life -= dt;
      if (s.life <= 0) { s.sp.visible = false; continue; }
      s.sp.position.addScaledVector(s.vel, dt);
      s.sp.scale.multiplyScalar(1 + dt * 1.2);
      s.sp.material.opacity = Math.min(0.5, s.life * 0.35);
    }
  }

  // ---------- 공개 API ----------

  /** 발사대에 로켓 세우기 (카운트다운 동안 유지) */
  function toPad(simDays) {
    state = 'pad';
    group.visible = true;
    trail.visible = true;
    trailAge.fill(1e9);
    earthPos(simDays, tmp);
    pos.copy(tmp).addScaledVector(padDir, EARTH_SIZE * 1.02);
    q.setFromUnitVectors(MODEL_FORWARD, padDir);
    sideDir.crossVectors(padDir, new THREE.Vector3(0, 1, 0)).normalize();
    if (sideDir.lengthSq() < 0.1) sideDir.set(1, 0, 0);
    speed = 0;
    target = null;
    camInit = false;
  }

  function liftoff() {
    if (state !== 'pad') return;
    state = 'liftoff';
    liftT = 0;
    earthPos(0, tmp); // 위치는 update에서 매 프레임 갱신
    burstSmoke(pos, padDir);
  }

  function setTarget(t) {
    target = t;
    if (state === 'orbiting') state = 'cruise';
  }

  function clearTarget() { target = null; }

  function steer(dxPx, dyPx) {
    if (state !== 'cruise') return;
    // yaw: 월드 Y축, pitch: 기수 기준 오른쪽 축
    dq.setFromAxisAngle(tmp2.set(0, 1, 0), -dxPx * 0.0035);
    q.premultiply(dq);
    forward(tmp);
    tmp2.crossVectors(tmp, new THREE.Vector3(0, 1, 0));
    if (tmp2.lengthSq() > 1e-8) {
      tmp2.normalize();
      dq.setFromAxisAngle(tmp2, -dyPx * 0.0035);
      q.premultiply(dq);
    }
  }

  function setBoost(b) { boost = b; }
  function setDragging(b) { dragging = b; }

  function deactivate() {
    state = 'idle';
    group.visible = false;
    trail.visible = false;
    target = null;
    for (const s of smokes) s.sp.visible = false;
  }

  // ---------- 메인 업데이트 ----------
  function update(dt, simDays) {
    if (state === 'idle') return;

    let thrust = 0;

    if (state === 'pad') {
      earthPos(simDays, tmp);
      pos.copy(tmp).addScaledVector(padDir, EARTH_SIZE * 1.02);
      thrust = 0;
    } else if (state === 'liftoff') {
      liftT += dt;
      const k = easeInOutCubic(Math.min(liftT / LIFTOFF_DUR, 1));
      earthPos(simDays, tmp);
      pos.copy(tmp).addScaledVector(padDir, EARTH_SIZE * 1.02 + k * RISE_DIST);
      // 중력 선회 연출: 후반부에 진행 방향으로 살짝 기울임
      if (liftT > LIFTOFF_DUR * 0.4) {
        tmp2.copy(padDir).addScaledVector(sideDir, 0.5).normalize();
        turnToward(tmp2, dt * 0.5);
      }
      thrust = 1;
      emitAcc += dt;
      if (emitAcc > 0.03) { emitTrail(1); emitAcc = 0; }
      if (liftT >= LIFTOFF_DUR) {
        state = 'cruise';
        speed = 0.4;
      }
    } else if (state === 'cruise') {
      let desiredSpeed = 0.5;
      if (target) {
        target.getPos(tpos);
        const dist = pos.distanceTo(tpos);
        if (dist < target.arriveR) {
          // 궤도 진입
          state = 'orbiting';
          orbW.set(0, 1, 0);
          orbU.copy(pos).sub(tpos);
          orbU.addScaledVector(orbW, -orbU.dot(orbW)).normalize(); // 수평면 투영
          if (orbU.lengthSq() < 0.1) orbU.set(1, 0, 0);
          orbV.crossVectors(orbW, orbU);
          orbAng = 0;
          onArrive?.(target);
        } else {
          if (!dragging) {
            desiredV.copy(tpos).sub(pos).normalize();
            turnToward(desiredV, dt * 1.4);
          }
          // 멀수록 빠르게, 가까우면 감속 (arrive)
          desiredSpeed = THREE.MathUtils.clamp(dist * 0.3, 0.35, 9);
        }
      }
      const maxBoost = boost ? 2.5 : 1;
      speed = THREE.MathUtils.lerp(speed, desiredSpeed * maxBoost, 1 - Math.exp(-2.5 * dt));
      forward(tmp);
      pos.addScaledVector(tmp, speed * dt);
      thrust = Math.min(1, speed * 1.5) * (boost ? 1.6 : 1);
      emitAcc += dt;
      if (emitAcc > 0.04) { emitTrail(thrust); emitAcc = 0; }
    } else if (state === 'orbiting') {
      target.getPos(tpos);
      orbAng += dt * 0.45;
      const r = target.orbitR;
      tmp.copy(orbU).multiplyScalar(Math.cos(orbAng)).addScaledVector(orbV, Math.sin(orbAng));
      pos.copy(tpos).addScaledVector(tmp, r);
      // 기수 = 궤도 접선 방향
      tmp2.copy(orbU).multiplyScalar(-Math.sin(orbAng)).addScaledVector(orbV, Math.cos(orbAng));
      turnToward(tmp2, dt * 2.5);
      thrust = 0.15;
    }

    group.quaternion.copy(q);

    // 화염
    const fw = L * (0.35 + thrust * 0.5);
    flame.scale.set(L * 0.45 * (0.7 + thrust * 0.5), fw, 1);
    flame.material.opacity = Math.min(1, thrust * 1.2);
    flame.position.y = -L * 0.05 - fw * 0.45;

    updateTrail(dt);
    updateSmoke(dt);
  }

  /** 추적 카메라 — ship 모드에서 매 프레임 호출 */
  function applyCamera(camera, dt) {
    forward(tmp);
    let lookX = pos.x + tmp.x * 0.25, lookY = pos.y + tmp.y * 0.25, lookZ = pos.z + tmp.z * 0.25;
    if (state === 'pad' || state === 'liftoff') {
      // 발사대 옆 고정 시점 → 상승하면 점점 추적 시점으로
      const blend = state === 'liftoff' ? easeInOutCubic(Math.min(liftT / LIFTOFF_DUR, 1)) : 0;
      tmp2.copy(pos).addScaledVector(sideDir, 0.45).addScaledVector(padDir, 0.1); // 측면 뷰
      const chase = new THREE.Vector3().copy(pos).addScaledVector(tmp, -0.55).addScaledVector(padDir, 0.16);
      tmp2.lerp(chase, blend);
    } else if (state === 'orbiting' && target) {
      // 행성이 화면에 잡히게: 로켓 어깨 너머로 행성을 바라보는 구도
      target.getPos(tpos);
      tmp2.copy(pos).sub(tpos).normalize(); // 행성 → 로켓 바깥 방향
      tmp2.multiplyScalar(target.orbitR * 0.9).add(pos);
      tmp2.y += target.orbitR * 0.45;
      lookX = tpos.x; lookY = tpos.y; lookZ = tpos.z;
    } else {
      tmp2.copy(pos).addScaledVector(tmp, -0.55);
      tmp2.y += 0.18;
    }
    if (!camInit) { camPos.copy(tmp2); camInit = true; }
    camPos.lerp(tmp2, 1 - Math.exp(-6 * dt));
    camera.position.copy(camPos);
    camera.lookAt(lookX, lookY, lookZ);

    fovTarget = boost && state === 'cruise' ? 63 : 55;
    if (Math.abs(camera.fov - fovTarget) > 0.1) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, fovTarget, 1 - Math.exp(-4 * dt));
      camera.updateProjectionMatrix();
    }
  }

  return {
    toPad, liftoff, setTarget, clearTarget, steer, setBoost, setDragging,
    deactivate, update, applyCamera,
    get state() { return state; },
    get target() { return target; },
    get speed() { return speed; },
    get position() { return pos; },
    set onArrive(fn) { onArrive = fn; },
  };
}
