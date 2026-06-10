// 음성(TTS) + 잔잔한 우주 앰비언트 (WebAudio 생성음 — 외부 파일 없음)
let muted = false;
let ctx = null;
let ambientGain = null;

export function isMuted() {
  return muted;
}

export function setMuted(v) {
  muted = v;
  if (muted) {
    window.speechSynthesis?.cancel();
    if (ambientGain) ambientGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
  } else {
    unlockAudio(); // 소리 다시 켤 때 잠든 오디오도 같이 깨움
    if (ambientGain) ambientGain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.8);
  }
}

/** 한국어 음성으로 읽어주기 */
let pendingSpeak = null;
let watchdog = null;

export function speak(text) {
  if (muted || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  clearTimeout(pendingSpeak);
  clearTimeout(watchdog);
  synth.cancel();
  // 크롬 버그 방어: cancel() 직후 바로 speak()하면 엔진이 먹통으로 끼는 경우가 있어
  // 한 박자 쉬고, paused 상태로 굳어 있으면 resume으로 깨운 뒤 말한다
  pendingSpeak = setTimeout(() => {
    synth.resume();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.95;
    u.pitch = 1.15;
    const ko = synth.getVoices().find((v) => v.lang?.startsWith('ko'));
    if (ko) u.voice = ko;
    synth.speak(u);
    // 워치독: 시작도 못 하고 12초 넘게 끼어 있으면 큐를 비워 다음 음성을 살린다
    watchdog = setTimeout(() => {
      if (synth.speaking || synth.pending) {
        synth.cancel();
        synth.resume();
      }
    }, 12000);
  }, 80);
}

/** 사용자 제스처마다 호출 — 잠든 오디오(탭 전환·iOS 절전 등) 깨우기 */
export function unlockAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
  if ('speechSynthesis' in window && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
}

/** 잔잔한 패드 사운드 (detune된 사인파 + 느린 LFO) */
export function startAmbient() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();

  ambientGain = ctx.createGain();
  ambientGain.gain.value = 0;
  ambientGain.connect(ctx.destination);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  lp.connect(ambientGain);

  const freqs = [65.4, 98.0, 130.8, 196.0]; // C2, G2, C3, G3
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    osc.detune.value = (Math.random() - 0.5) * 8;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    osc.connect(g).connect(lp);
    osc.start();

    // 아주 느린 볼륨 흔들림
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.1;
    lfo.connect(lfoGain).connect(g.gain);
    lfo.start();
  }

  if (!muted) ambientGain.gain.setTargetAtTime(0.05, ctx.currentTime, 1.5);

  // 탭에 돌아왔을 때 잠든 오디오 자동 복구
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) unlockAudio();
  });
}
