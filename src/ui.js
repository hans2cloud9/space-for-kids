// DOM 오버레이 UI — 큰 이모지 버튼, 행성 이름, 자막, 시작 화면

/** 찾았다! 꽃가루 터뜨리기 */
export function burstConfetti(emojis = ['⭐', '✨', '🎉', '💖', '🌟']) {
  for (let i = 0; i < 28; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.fontSize = `${20 + Math.random() * 22}px`;
    piece.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}
export function createUI({ kids, onSaveKids, onSpeed, onLevel, onHome, onSoundToggle, onStart, onLaunch, onBoost, onEarth }) {
  const $ = (id) => document.getElementById(id);

  const nameDisplay = $('name-display');
  const subtitle = $('subtitle');
  let nameTimer = null;
  let subTimer = null;

  // 시간 버튼
  const speedButtons = [
    [$('speed-slow'), 0.5],
    [$('speed-normal'), 5],
    [$('speed-fast'), 50],
  ];
  for (const [btn, speed] of speedButtons) {
    btn.addEventListener('click', () => {
      speedButtons.forEach(([b]) => b.classList.remove('active'));
      btn.classList.add('active');
      onSpeed(speed);
    });
  }

  // 레벨 버튼
  const levelButtons = [1, 2, 3, 4].map((n) => $(`level-${n}`));
  levelButtons.forEach((btn, idx) => {
    btn.addEventListener('click', () => onLevel(idx + 1));
  });

  $('btn-home').addEventListener('click', onHome);

  const soundBtn = $('btn-sound');
  soundBtn.addEventListener('click', () => {
    const nowMuted = onSoundToggle();
    soundBtn.textContent = nowMuted ? '🔇' : '🔊';
  });

  // ---------- 시작 화면 (이름 등록 + 출발) ----------
  const overlay = $('start-overlay');
  for (let i = 0; i < 40; i++) {
    const star = document.createElement('div');
    star.className = 'twinkle';
    const s = 1 + Math.random() * 3;
    star.style.width = star.style.height = `${s}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.animationDelay = `${Math.random() * 2.4}s`;
    overlay.appendChild(star);
  }

  const startPanel = $('start-panel');
  const regPanel = $('register-panel');
  const nameInputs = $('name-inputs');
  const startTitle = $('start-title');

  function applyTitle(names) {
    startTitle.innerHTML = '';
    if (names?.length) {
      startTitle.appendChild(document.createTextNode(`${names.join(' · ')}의`));
      startTitle.appendChild(document.createElement('br'));
    }
    startTitle.appendChild(document.createTextNode('우주 여행'));
  }

  function addNameInput(value = '') {
    if (nameInputs.children.length >= 4) return null;
    const inp = document.createElement('input');
    inp.className = 'name-input';
    inp.type = 'text';
    inp.maxLength = 8;
    inp.placeholder = '아이 이름';
    inp.value = value;
    nameInputs.appendChild(inp);
    return inp;
  }

  function showRegister(prefill) {
    startPanel.style.display = 'none';
    regPanel.style.display = 'flex';
    nameInputs.innerHTML = '';
    const names = prefill?.length ? prefill : [''];
    names.forEach((n) => addNameInput(n));
  }

  function showStart(names) {
    applyTitle(names);
    regPanel.style.display = 'none';
    startPanel.style.display = 'flex';
  }

  let currentKids = kids;
  if (currentKids) showStart(currentKids);
  else showRegister(null); // 첫 실행: 등록 화면부터

  $('add-name').addEventListener('click', () => addNameInput('')?.focus());
  $('edit-names').addEventListener('click', () => showRegister(currentKids));

  $('start-btn').addEventListener('click', () => {
    overlay.classList.add('hidden');
    onStart();
  });

  $('register-btn').addEventListener('click', () => {
    const names = [...nameInputs.querySelectorAll('.name-input')]
      .map((i) => i.value.trim())
      .filter(Boolean);
    if (names.length === 0) {
      const first = nameInputs.querySelector('.name-input');
      first?.classList.add('shake');
      setTimeout(() => first?.classList.remove('shake'), 400);
      first?.focus();
      return;
    }
    const wasFirst = !currentKids;
    currentKids = names;
    onSaveKids(names, wasFirst); // 첫 등록이면 즉시 진행, 변경이면 main이 reload
    applyTitle(names);
    overlay.classList.add('hidden');
    onStart();
  });

  function showName(text, ms = 3500) {
    nameDisplay.textContent = text;
    nameDisplay.classList.add('show');
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => nameDisplay.classList.remove('show'), ms);
  }

  function showSubtitle(text, ms = 4500) {
    subtitle.textContent = text;
    subtitle.classList.add('show');
    clearTimeout(subTimer);
    subTimer = setTimeout(() => subtitle.classList.remove('show'), ms);
  }

  function setActiveLevel(n) {
    levelButtons.forEach((b, i) => b.classList.toggle('active', i + 1 === n));
  }

  // ---------- 로켓 여행 모드 ----------
  $('btn-launch').addEventListener('click', () => onLaunch?.());
  $('btn-earth').addEventListener('click', () => onEarth?.());

  const boostBtn = $('btn-boost');
  boostBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    boostBtn.classList.add('boosting');
    onBoost?.(true);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
    boostBtn.addEventListener(ev, () => {
      boostBtn.classList.remove('boosting');
      onBoost?.(false);
    });
  }

  const destBar = $('dest-bar');

  /** 목적지 바 구성 — items: {id, name, color, emoji?} */
  function setDestinations(items, onPick) {
    destBar.innerHTML = '';
    for (const item of items) {
      const btn = document.createElement('button');
      btn.className = 'dest-btn';
      btn.dataset.dest = item.id;
      btn.style.setProperty('--dc', item.color);
      btn.innerHTML = item.emoji
        ? `<span class="dest-emoji">${item.emoji}</span><span>${item.name}</span>`
        : `<div class="dest-dot"></div><span>${item.name}</span>`;
      btn.addEventListener('click', () => onPick(item.id));
      destBar.appendChild(btn);
    }
  }

  function setActiveDest(id) {
    destBar.querySelectorAll('.dest-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.dest === id));
  }

  /** ship 모드 진입/이탈 시 UI 전환 */
  function setShipMode(on) {
    destBar.classList.toggle('show', on);
    boostBtn.classList.toggle('show', on);
    document.getElementById('time-controls').style.display = on ? 'none' : 'flex';
    document.getElementById('level-controls').style.display = on ? 'none' : 'flex';
    $('btn-launch').classList.toggle('active', on);
  }

  /** earth(지구 알아보기) 모드 진입/이탈 시 UI 전환 */
  function setEarthMode(on) {
    destBar.classList.toggle('show', on);
    boostBtn.classList.remove('show');
    document.getElementById('time-controls').style.display = on ? 'none' : 'flex';
    document.getElementById('level-controls').style.display = on ? 'none' : 'flex';
    document.getElementById('quest-controls').style.display = on ? 'none' : 'flex';
    $('btn-launch').style.display = on ? 'none' : 'flex';
    $('btn-earth').classList.toggle('active', on);
  }

  /** 아이별 별찾기 버튼 동적 생성 — kids: {id, name, display, color} */
  function buildQuestButtons(kidDefs, onPick) {
    const wrap = document.getElementById('quest-controls');
    wrap.innerHTML = '';
    for (const k of kidDefs) {
      const b = document.createElement('button');
      b.className = 'big-btn quest-btn';
      b.style.setProperty('--qc', k.color);
      b.title = `${k.display} 별 찾기`;
      const star = document.createTextNode('⭐');
      const span = document.createElement('span');
      span.textContent = k.name.slice(0, 3);
      b.append(star, span);
      b.addEventListener('click', () => onPick(k.id));
      wrap.appendChild(b);
    }
  }

  return {
    showName, showSubtitle, setActiveLevel, setDestinations, setActiveDest,
    setShipMode, setEarthMode, buildQuestButtons,
  };
}
