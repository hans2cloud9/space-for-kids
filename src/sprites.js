// 캔버스 기반 스프라이트/텍스처 헬퍼 (외부 에셋 없이 전부 절차 생성)
import * as THREE from 'three';

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 부드러운 원형 글로우 텍스처 */
export function glowTexture(color = '#ffffff', inner = '#ffffff') {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.25, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function glowSprite(color, inner, scale) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(color, inner),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.setScalar(scale);
  return sp;
}

/** 한글 라벨 스프라이트 */
export function labelSprite(text, { size = 64, color = '#ffffff', scale = 1 } = {}) {
  const pad = 20;
  const font = `${size}px Jua, 'Apple SD Gothic Neo', sans-serif`;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const tw = Math.ceil(measure.measureText(text).width) + pad * 2;
  const th = size + pad * 2;

  const tex = canvasTexture(tw, th, (ctx) => {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.fillText(text, tw / 2, th / 2);
  });

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set((tw / th) * scale, scale, 1);
  return sp;
}

/** 펄스 링 텍스처 (태양 위치 마커용) */
export function ringTexture(color = '#ffd966') {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2);
    ctx.stroke();
  });
}
