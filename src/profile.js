// 아이 이름 프로필 — localStorage에 저장해 매번 입력하지 않게
const KEY = 'space-kids-profile-v1';

export const KID_COLORS = ['#ff8ad2', '#7ed0ff', '#9dff8a', '#ffd966'];
export const MAX_KIDS = 4;

/** 저장된 아이 이름 배열 (없으면 null → 등록 화면) */
export function loadKids() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (!Array.isArray(v)) return null;
    const names = v.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim()).slice(0, MAX_KIDS);
    return names.length ? names : null;
  } catch {
    return null;
  }
}

export function saveKids(names) {
  try {
    localStorage.setItem(KEY, JSON.stringify(names.slice(0, MAX_KIDS)));
  } catch {
    // 시크릿 모드 등 저장 불가 환경 — 이번 세션만 사용
  }
}

/** 애칭형: 받침 있으면 '이' 붙임 (태경→태경이, 소라→소라) */
export function affectionate(name) {
  const last = name.charCodeAt(name.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return name; // 한글이 아니면 그대로
  return (last - 0xac00) % 28 > 0 ? `${name}이` : name;
}
