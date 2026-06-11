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

// voices는 비동기로 로드된다(Chrome/Safari는 첫 getVoices()가 빈 배열).
// voiceschanged로 캐시해 두고, 한국어 voice를 안정적으로 찾는다.
let voiceCache = [];
function refreshVoices() {
  if ('speechSynthesis' in window) voiceCache = window.speechSynthesis.getVoices() || [];
}
if ('speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}
function koVoice() {
  if (!voiceCache.length) refreshVoices();
  return voiceCache.find((v) => v.lang?.startsWith('ko') || /korean|한국/i.test(v.name || ''));
}

function utter(text) {
  const synth = window.speechSynthesis;
  synth.resume();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = 0.95;
  u.pitch = 1.15;
  const ko = koVoice();
  if (ko) u.voice = ko;
  synth.speak(u);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    if (synth.speaking || synth.pending) { synth.cancel(); synth.resume(); }
  }, 12000);
}

export function speak(text) {
  if (muted || !('speechSynthesis' in window) || !text) return;
  const synth = window.speechSynthesis;
  clearTimeout(pendingSpeak);
  clearTimeout(watchdog);
  // 이미 말하는 중일 때만 cancel + 지연(크롬 먹통 버그 방어).
  // 한가할 땐 지연 없이 즉시 발화 — 모바일(iOS/아이패드)에서 사용자 제스처
  // 컨텍스트를 유지해야 첫 음성이 차단되지 않는다.
  if (synth.speaking || synth.pending) {
    synth.cancel();
    pendingSpeak = setTimeout(() => utter(text), 90);
  } else {
    utter(text);
  }
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
