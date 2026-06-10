// 케플러 궤도 계산
// NASA JPL "Approximate Positions of the Planets" J2000 궤도 요소 (1800–2050 유효)
// a[AU], e, i[deg], L[deg], peri(근일점 경도)[deg], node(승교점 경도)[deg], Lrate[deg/century]

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

// 아이용 거리 압축: 실제 AU 거리 r → r^0.55 * 1.6 (씬 유닛)
// 행성 간 간격 비율을 줄여 수성~해왕성이 한 화면에 들어오게 한다
const DIST_EXP = 0.55;
const DIST_SCALE = 1.6;

export function compressDistance(rAU) {
  return Math.pow(rAU, DIST_EXP) * DIST_SCALE;
}

export const ORBITAL_ELEMENTS = {
  mercury: { a: 0.38709927, e: 0.20563593, i: 7.00497902, L: 252.25032350, peri: 77.45779628, node: 48.33076593, Lrate: 149472.67411175 },
  venus:   { a: 0.72333566, e: 0.00677672, i: 3.39467605, L: 181.97909950, peri: 131.60246718, node: 76.67984255, Lrate: 58517.81538729 },
  earth:   { a: 1.00000261, e: 0.01671123, i: -0.00001531, L: 100.46457166, peri: 102.93768193, node: 0.0, Lrate: 35999.37244981 },
  mars:    { a: 1.52371034, e: 0.09339410, i: 1.84969142, L: -4.55343205, peri: -23.94362959, node: 49.55953891, Lrate: 19140.30268499 },
  jupiter: { a: 5.20288700, e: 0.04838624, i: 1.30439695, L: 34.39644051, peri: 14.72847983, node: 100.47390909, Lrate: 3034.74612775 },
  saturn:  { a: 9.53667594, e: 0.05386179, i: 2.48599187, L: 49.95424423, peri: 92.59887831, node: 113.66242448, Lrate: 1222.49362201 },
  uranus:  { a: 19.18916464, e: 0.04725744, i: 0.77263783, L: 313.23810451, peri: 170.95427630, node: 74.01692503, Lrate: 428.48202785 },
  neptune: { a: 30.06992276, e: 0.00859048, i: 1.77004347, L: -55.12002969, peri: 44.96476227, node: 131.78422574, Lrate: 218.45945325 },
};

// 케플러 방정식 M = E - e·sinE 를 뉴턴법으로 풀이
function solveKepler(M, e) {
  M = ((M % TWO_PI) + TWO_PI) % TWO_PI;
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 10; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E;
}

// 궤도면 좌표(xp, yp) → 황도 좌표 → three.js 좌표(Y-up)
function orbitalToScene(el, xp, yp, out) {
  const w = (el.peri - el.node) * DEG; // 근일점 인수
  const O = el.node * DEG;
  const I = el.i * DEG;
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(O), sO = Math.sin(O);
  const cI = Math.cos(I), sI = Math.sin(I);

  const xe = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const ye = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const ze = (sw * sI) * xp + (cw * sI) * yp;

  // 황도면(xy) → three.js: X=xe, Y=ze(위), Z=-ye
  out.x = xe; out.y = ze; out.z = -ye;
  return out;
}

/**
 * J2000 기준 경과일(days)에서의 행성 위치 (씬 유닛, 거리 압축 적용)
 * out: {x,y,z} 객체에 결과를 채운다
 */
export function planetPosition(key, days, out) {
  const el = ORBITAL_ELEMENTS[key];
  const T = days / 36525; // 율리우스 세기
  const L = el.L + el.Lrate * T;
  const M = (L - el.peri) * DEG; // 평균 근점이각
  const E = solveKepler(M, el.e);

  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  orbitalToScene(el, xp, yp, out);

  // 거리 압축 (방향 유지, 반지름만 압축)
  const r = Math.hypot(out.x, out.y, out.z);
  if (r > 0) {
    const s = compressDistance(r) / r;
    out.x *= s; out.y *= s; out.z *= s;
  }
  return out;
}

/** 궤도선용 샘플 점들 (압축 동일 적용) */
export function orbitPoints(key, segments = 256) {
  const el = ORBITAL_ELEMENTS[key];
  const pts = [];
  const tmp = { x: 0, y: 0, z: 0 };
  for (let s = 0; s <= segments; s++) {
    const E = (s / segments) * TWO_PI;
    const xp = el.a * (Math.cos(E) - el.e);
    const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
    orbitalToScene(el, xp, yp, tmp);
    const r = Math.hypot(tmp.x, tmp.y, tmp.z);
    const s2 = r > 0 ? compressDistance(r) / r : 1;
    pts.push(tmp.x * s2, tmp.y * s2, tmp.z * s2);
  }
  return pts;
}

/** 달: 지구 중심 케플러 궤도 (시각용 — 거리는 보기 좋게 고정 오프셋) */
export function moonPosition(days, visualDist, out) {
  const period = 27.321661; // 항성월
  const e = 0.0549;
  const M = (TWO_PI * days) / period + 2.36; // 위상 오프셋
  const E = solveKepler(M, e);
  const xp = Math.cos(E) - e;
  const yp = Math.sqrt(1 - e * e) * Math.sin(E);
  const r = Math.hypot(xp, yp);
  const s = visualDist / (r || 1);
  const incl = 5.14 * DEG;
  out.x = xp * s;
  out.y = yp * s * Math.sin(incl);
  out.z = -yp * s * Math.cos(incl);
  return out;
}
