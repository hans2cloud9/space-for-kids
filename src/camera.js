// 카메라 리그: OrbitControls + 줌 레벨 판정 + 부드러운 이동(flyTo) + 행성 추적
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const LEVELS = [
  { id: 1, max: 40,     dist: 22,    narration: '여기는 태양계예요! 행성을 콕 눌러 보세요.' },
  { id: 2, max: 500,    dist: 200,   narration: '와, 태양이 작아졌어요. 반짝이는 건 모두 이웃 별들이에요.' },
  { id: 3, max: 9000,   dist: 5200,  narration: '여기는 우리은하예요! 별이 아주아주 많죠?' },
  { id: 4, max: 120000, dist: 46000, narration: '은하 친구들이 보여요. 저기 큰 건 안드로메다은하예요!' },
];

export function levelFor(dist) {
  for (const lv of LEVELS) if (dist < lv.max) return lv.id;
  return 4;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function createCameraRig(renderer) {
  const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 0.05, 600000
  );
  camera.position.set(0, 10, 20);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false; // 아이들이 길 잃지 않게
  controls.minDistance = 0.4;
  controls.maxDistance = 110000;
  controls.zoomSpeed = 1.1;

  // flyTo 상태
  let fly = null; // {t, dur, fromTarget, toTarget, fromR, toR, dir}
  // 추적 상태
  let follow = null; // {getPos: (v)=>v, dist}
  // 수동 모드 (ship 모드 — 외부에서 카메라를 직접 제어)
  let manual = false;

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();

  function flyTo(dist, target = new THREE.Vector3(0, 0, 0), dur = 2.0) {
    follow = null;
    const dir = vA.copy(camera.position).sub(controls.target).normalize().clone();
    fly = {
      t: 0, dur,
      fromTarget: controls.target.clone(), toTarget: target.clone(),
      fromR: camera.position.distanceTo(controls.target), toR: dist,
      dir,
    };
  }

  function followBody(getPos, dist) {
    fly = null;
    follow = { getPos, dist, settled: false };
  }

  function stopFollow() {
    follow = null;
  }

  /** ship 모드: OrbitControls·flyTo·follow 전부 끄고 외부가 카메라를 직접 제어 */
  function setManual(on) {
    manual = on;
    controls.enabled = !on;
    fly = null;
    follow = null;
    if (!on) {
      // explore 복귀: 타깃을 원점으로 재정렬
      controls.target.set(0, 0, 0);
      camera.fov = 55;
      camera.updateProjectionMatrix();
    }
  }

  function update(dt) {
    if (manual) return;
    if (fly) {
      fly.t += dt;
      const k = easeInOutCubic(Math.min(fly.t / fly.dur, 1));
      const target = vA.copy(fly.fromTarget).lerp(fly.toTarget, k);
      const r = THREE.MathUtils.lerp(fly.fromR, fly.toR, k);
      controls.target.copy(target);
      camera.position.copy(target).addScaledVector(fly.dir, r);
      if (fly.t >= fly.dur) fly = null;
    } else if (follow) {
      follow.getPos(vB);
      // 타깃을 행성으로 끌어가고 카메라도 같은 만큼 이동 (상대 시점 유지)
      const alpha = 1 - Math.exp(-5 * dt);
      vA.copy(vB).sub(controls.target).multiplyScalar(alpha);
      controls.target.add(vA);
      camera.position.add(vA);
      // 거리도 목표 거리로 부드럽게
      const cur = camera.position.distanceTo(controls.target);
      const want = follow.dist;
      if (!follow.settled) {
        const r = THREE.MathUtils.lerp(cur, want, alpha);
        const dir = vA.copy(camera.position).sub(controls.target).normalize();
        camera.position.copy(controls.target).addScaledVector(dir, r);
        if (Math.abs(cur - want) < want * 0.05) follow.settled = true;
      }
      // 사용자가 줌아웃으로 빠져나가면 추적 해제
      if (cur > follow.dist * 14) follow = null;
    }
    controls.update();
  }

  function distance() {
    return camera.position.length(); // 태양(원점) 기준 — 줌 레벨/페이드 판정용
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  return {
    camera, controls, flyTo, followBody, stopFollow, setManual, update, distance, onResize,
    isFollowing: () => !!follow,
  };
}
