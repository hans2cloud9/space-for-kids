// 별 찾기 게임 — 태경이 별 / 창민이 별이 랜덤 위치에 숨고, 화살표를 따라 찾아간다
import * as THREE from 'three';
import { glowSprite, labelSprite } from './sprites.js';

const EDGE_MARGIN = 80;   // 화살표 칩이 화면 가장자리에서 떨어지는 거리(px)
const FOUND_DIST = 22;    // 이 거리 안으로 오면 '찾았다!'
const MIN_SPAWN = 70;     // 별이 숨는 거리 범위 (씬 유닛)
const MAX_SPAWN = 260;

export function createStarGame(scene, { kids, onStart, onFound }) {
  const quests = [];
  const v = new THREE.Vector3();

  // kid: {id, name(원래 이름), display(애칭형: 태경이), color}
  function makeQuest(kid) {
    const { id, display: name, color } = kid;
    const star = glowSprite(color, '#ffffff', 5);
    star.visible = false;
    scene.add(star);

    const label = labelSprite(`${name} 별`, { color, scale: 4 });
    label.visible = false;
    scene.add(label);

    // 방향 화살표 칩 (동적 생성)
    const el = document.createElement('div');
    el.className = 'quest-chip';
    el.style.setProperty('--qc', color);
    const arrowEl = document.createElement('span');
    arrowEl.className = 'qa-arrow';
    arrowEl.textContent = '➤';
    const labelEl = document.createElement('span');
    labelEl.textContent = `${name} 별`;
    el.append(arrowEl, labelEl);
    document.body.appendChild(el);

    return {
      id, name, color, star, label, el, arrowEl,
      labelAspect: label.scale.x / label.scale.y,
      active: false, celebrateT: 0, t: Math.random() * 10,
    };
  }

  for (const kid of kids) quests.push(makeQuest(kid));

  /** 별을 랜덤 위치로 숨기고 게임 시작 */
  function start(id) {
    const q = quests.find((q) => q.id === id);
    const dist = MIN_SPAWN + Math.random() * (MAX_SPAWN - MIN_SPAWN);
    const az = Math.random() * Math.PI * 2;
    const elv = (Math.random() * 2 - 1) * (Math.PI / 6); // 고도각 ±30° — 좌우 회전 위주로 찾기 쉽게
    q.star.position.set(
      dist * Math.cos(elv) * Math.cos(az),
      dist * Math.sin(elv),
      dist * Math.cos(elv) * Math.sin(az)
    );
    q.star.visible = true;
    q.label.visible = true;
    q.active = true;
    q.celebrateT = 0;
    q.el.style.display = 'flex';
    onStart?.(q);
  }

  function found(q) {
    q.active = false;
    q.celebrateT = 3.5;
    q.el.style.display = 'none';
    onFound?.(q);
  }

  function updateArrow(q, camera) {
    v.copy(q.star.position).project(camera);
    const behind = v.z > 1;
    let nx = v.x, ny = v.y;
    if (behind) { nx = -nx; ny = -ny; }

    const W = window.innerWidth, H = window.innerHeight;
    const onScreen = !behind && Math.abs(nx) < 0.9 && Math.abs(ny) < 0.85;

    let px, py, rot;
    if (onScreen) {
      // 별 바로 위에 떠서 아래(별)를 가리킴
      px = ((nx + 1) / 2) * W;
      py = ((1 - ny) / 2) * H - 56;
      rot = Math.PI / 2;
    } else {
      // 화면 가장자리에 붙어 별 방향을 가리킴
      const sx = nx * (W / 2);
      const sy = -ny * (H / 2);
      const f = Math.min(
        (W / 2 - EDGE_MARGIN) / Math.max(Math.abs(sx), 1e-6),
        (H / 2 - EDGE_MARGIN) / Math.max(Math.abs(sy), 1e-6)
      );
      px = W / 2 + sx * f;
      py = H / 2 + sy * f;
      rot = Math.atan2(sy, sx);
    }
    q.el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
    q.arrowEl.style.transform = `rotate(${rot}rad)`;
  }

  function update(dt, camera) {
    for (const q of quests) {
      if (!q.star.visible) continue;
      q.t += dt;

      const dCam = camera.position.distanceTo(q.star.position);
      // 카메라 거리에 비례한 크기 → 어느 줌 레벨에서도 보임 (화면상 크기 일정)
      const base = Math.max(2.5, dCam * 0.055);
      let pulse;
      if (q.active) {
        pulse = 1 + Math.sin(q.t * 9) * 0.3; // 빠른 반짝임
        q.star.material.opacity = 0.7 + 0.3 * Math.sin(q.t * 9);
      } else if (q.celebrateT > 0) {
        q.celebrateT -= dt;
        pulse = 1.4 + Math.sin(q.t * 14) * 0.5; // 축하 폭죽 펄스
        q.star.material.opacity = 1;
      } else {
        pulse = 1 + Math.sin(q.t * 2) * 0.08; // 평소엔 은은하게
        q.star.material.opacity = 0.9;
      }
      q.star.scale.setScalar(base * pulse);

      const lh = base * 0.9;
      q.label.scale.set(q.labelAspect * lh, lh, 1);
      q.label.position.copy(q.star.position);
      q.label.position.y += base * 1.1;

      if (q.active) {
        updateArrow(q, camera);
        if (dCam < FOUND_DIST) found(q);
      }
    }
  }

  /** 화면 픽셀 기준 탭 판정 — 활성 퀘스트 별이 탭 지점 56px 안에 있으면 그 퀘스트 반환 */
  function tapAt(clientX, clientY, camera) {
    for (const q of quests) {
      if (!q.active) continue;
      v.copy(q.star.position).project(camera);
      if (v.z > 1) continue; // 카메라 뒤
      const px = ((v.x + 1) / 2) * window.innerWidth;
      const py = ((1 - v.y) / 2) * window.innerHeight;
      if (Math.hypot(clientX - px, clientY - py) < 56) return q;
    }
    return null;
  }

  return { start, update, tapAt, quests };
}
