/* ============================================================
   TEACH PLACE – game.js  v2.0
   Lógica completa: nick, leaderboard, 5 tipos de reto,
   3 lenguajes, racha, puntuación ponderada
   ============================================================ */

"use strict";

/* ═══════════════════════════════════════════
   ░░  ESTADO GLOBAL  ░░
   ═══════════════════════════════════════════ */
const state = {
  nick: '',
  avatar: '🤖',
  lang: 'js',
  soundOn: true,
  score: 0,
  lives: 3,
  streak: 0,
  maxStreak: 0,
  totalScore: 0,           // acumulado histórico
  worldScores: {},         // { worldId: { score, stars } }
  currentWorld: null,
  currentLevelIndex: 0,
  answered: false,
  timerSeconds: 60,
  timerMax: 60,
  timerInterval: null,
  dragSource: null,        // para drag & drop
  matchSelected: null,     // para match
  matchCompleted: [],
};

/* ═══════════════════════════════════════════
   ░░  PERSISTENCIA (localStorage)  ░░
   ═══════════════════════════════════════════ */
const STORAGE_KEY = 'teachplace_v2';

function saveData() {
  const data = {
    nick: state.nick,
    avatar: state.avatar,
    lang: state.lang,
    totalScore: state.totalScore,
    maxStreak: state.maxStreak,
    worldScores: state.worldScores,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  saveLeaderboardEntry();
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.nick = data.nick || '';
    state.avatar = data.avatar || '🤖';
    state.lang = data.lang || 'js';
    state.totalScore = data.totalScore || 0;
    state.maxStreak = data.maxStreak || 0;
    state.worldScores = data.worldScores || {};
  } catch(e) {}
}

function saveLeaderboardEntry() {
  if (!state.nick) return;
  try {
    const lb = getLeaderboard();
    const idx = lb.findIndex(e => e.nick === state.nick);
    const entry = {
      nick: state.nick,
      avatar: state.avatar,
      score: state.totalScore,
      maxStreak: state.maxStreak,
      date: new Date().toLocaleDateString('es-CO'),
    };
    if (idx >= 0) lb[idx] = entry;
    else lb.push(entry);
    lb.sort((a,b) => b.score - a.score);
    localStorage.setItem('teachplace_lb', JSON.stringify(lb.slice(0, 50)));
  } catch(e) {}
}

function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem('teachplace_lb') || '[]');
  } catch(e) { return []; }
}

/* ═══════════════════════════════════════════
   ░░  AUDIO  ░░
   ═══════════════════════════════════════════ */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudio() {
  if (!audioCtx) { try { audioCtx = new AudioCtx(); } catch(e) {} }
  return audioCtx;
}

const SFX = {
  beep(freq=440, dur=0.1, type='sine', vol=0.2) {
    if (!state.soundOn) return;
    const ctx = getAudio(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start(); o.stop(ctx.currentTime + dur);
  },
  correct()  { this.beep(523,0.08); setTimeout(()=>this.beep(659,0.08),90); setTimeout(()=>this.beep(784,0.12),180); },
  wrong()    { this.beep(220,0.15,'sawtooth'); setTimeout(()=>this.beep(180,0.2,'sawtooth'),160); },
  alert()    { this.beep(440,0.05,'square',0.1); },
  click()    { this.beep(600,0.04,'triangle',0.08); },
  worldDone(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.beep(f,0.12),i*120)); },
  streak()   { this.beep(880,0.06); setTimeout(()=>this.beep(1100,0.06),70); setTimeout(()=>this.beep(1320,0.1),140); },
};

/* ═══════════════════════════════════════════
   ░░  CONFETTI  ░░
   ═══════════════════════════════════════════ */
const canvas = document.getElementById('confettiCanvas');
const ctx2 = canvas.getContext('2d');
let confetti = [], confettiRAF = null;

function startConfetti() {
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  for (let i = 0; i < 100; i++) confetti.push({
    x: Math.random()*canvas.width, y: -10,
    vx: (Math.random()-0.5)*4, vy: Math.random()*4+2,
    color: `hsl(${Math.random()*360},80%,60%)`,
    size: Math.random()*8+4, rot: Math.random()*360,
  });
  if (!confettiRAF) animateConfetti();
}

function animateConfetti() {
  ctx2.clearRect(0,0,canvas.width,canvas.height);
  confetti = confetti.filter(p => p.y < canvas.height + 20);
  confetti.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.rot += 3;
    ctx2.save(); ctx2.translate(p.x, p.y); ctx2.rotate(p.rot*Math.PI/180);
    ctx2.fillStyle = p.color; ctx2.fillRect(-p.size/2,-p.size/2,p.size,p.size);
    ctx2.restore();
  });
  if (confetti.length > 0) confettiRAF = requestAnimationFrame(animateConfetti);
  else { ctx2.clearRect(0,0,canvas.width,canvas.height); confettiRAF = null; }
}

function stopConfetti() { confetti = []; ctx2.clearRect(0,0,canvas.width,canvas.height); confettiRAF = null; }

/* ═══════════════════════════════════════════
   ░░  TOAST  ░░
   ═══════════════════════════════════════════ */
function toast(msg, type='info', dur=2500) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(()=>el.remove(), 400); }, dur);
}

/* ═══════════════════════════════════════════
   ░░  AMBIENT  ░░
   ═══════════════════════════════════════════ */
function buildAmbient() {
  const icons = ['⚙️','🤖','💻','🔑','📡','⚡','🛠️','🗄️','🚀','🐍','☕','🟨'];
  const layer = document.getElementById('ambientLayer');
  for (let i = 0; i < 18; i++) {
    const el = document.createElement('div'); el.className = 'ambient-icon';
    el.textContent = icons[Math.floor(Math.random()*icons.length)];
    el.style.left = Math.random()*100+'%';
    el.style.animationDuration = (18+Math.random()*22)+'s';
    el.style.animationDelay = -(Math.random()*30)+'s';
    el.style.fontSize = (1.5+Math.random()*2)+'rem';
    layer.appendChild(el);
  }
}

/* ═══════════════════════════════════════════
   ░░  SCREENS  ░░
   ═══════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ═══════════════════════════════════════════
   ░░  SCREEN 0: NICKNAME  ░░
   ═══════════════════════════════════════════ */
function initNickScreen() {
  const row = document.getElementById('nickAvatarsRow');
  AVATARS.forEach(av => {
    const btn = document.createElement('button');
    btn.className = 'avatar-btn'; btn.textContent = av;
    if (av === state.avatar) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      state.avatar = av;
      document.querySelectorAll('.avatar-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('nickAvatar').textContent = av;
      SFX.click();
    });
    row.appendChild(btn);
  });

  const inp = document.getElementById('nickInput');
  const counter = document.getElementById('nickCounter');
  inp.value = state.nick;
  counter.textContent = `${state.nick.length}/20`;

  inp.addEventListener('input', () => {
    state.nick = inp.value.trim();
    counter.textContent = `${inp.value.length}/20`;
    document.getElementById('nickAvatar').textContent = state.avatar;
  });

  inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirmNick(); });
  document.getElementById('btnNickOk').addEventListener('click', confirmNick);

  if (state.nick) inp.value = state.nick;
}

function confirmNick() {
  const val = document.getElementById('nickInput').value.trim();
  if (!val) { toast('⚠️ Ingresa un nombre para continuar.', 'warn'); return; }
  state.nick = val;
  saveData();
  SFX.click();
  showScreen('screenHome');
  buildHome();
  updateHeaderPlayer();
}

/* ═══════════════════════════════════════════
   ░░  SCREEN 1: HOME  ░░
   ═══════════════════════════════════════════ */
function buildHome() {
  const grid = document.getElementById('worldsGrid');
  grid.innerHTML = '';
  const langData = LANG_DATA[state.lang];

  WORLDS_BASE.forEach(w => {
    const ld = langData[w.id];
    if (!ld) return;
    const ws = state.worldScores[`${state.lang}_${w.id}`];
    const done = ws && ws.stars > 0;
    const card = document.createElement('div');
    card.className = 'world-card' + (done ? ' world-done' : '');
    card.style.setProperty('--wc', w.color);

    const starsHtml = [1,2,3].map(s => `<span class="star ${ws && ws.stars >= s ? 'lit':''}">★</span>`).join('');

    card.innerHTML = `
      <div class="wc-glow"></div>
      <div class="wc-icon">${w.icon}</div>
      <div class="wc-info">
        <div class="wc-num">Mundo ${w.id}</div>
        <div class="wc-name">${w.name}</div>
        <div class="wc-desc">${w.shortDesc}</div>
        <div class="wc-levels">${ld.levels.length} niveles</div>
      </div>
      <div class="wc-stars">${starsHtml}</div>
      ${ws ? `<div class="wc-score">🏆 ${ws.score} pts</div>` : ''}
      ${done ? '<div class="wc-badge">✔ Completado</div>' : ''}
    `;
    card.addEventListener('click', () => openLesson(w, ld));
    grid.appendChild(card);
  });

  // Stats header
  document.getElementById('statWorlds').textContent = WORLDS_BASE.filter(w => LANG_DATA[state.lang][w.id]).length;
  document.getElementById('statLevels').textContent = WORLDS_BASE.reduce((s,w) => {
    const d = LANG_DATA[state.lang][w.id]; return d ? s + d.levels.length : s;
  }, 0);
  document.getElementById('statScore').textContent = state.totalScore;
  document.getElementById('statStreak').textContent = state.maxStreak + '🔥';
}

function updateHeaderPlayer() {
  document.getElementById('headerNick').textContent = state.nick || 'Player';
  document.getElementById('headerAvatar').textContent = state.avatar;
}

/* ─── Language tabs ─── */
document.getElementById('langTabs').addEventListener('click', e => {
  const tab = e.target.closest('[data-lang]');
  if (!tab) return;
  state.lang = tab.dataset.lang;
  document.querySelectorAll('.lang-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  saveData();
  buildHome();
  SFX.click();
});

/* ─── Theme & Sound ─── */
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('btnTheme').textContent = isDark ? '☀️' : '🌙';
}

function toggleSound(btn) {
  state.soundOn = !state.soundOn;
  btn.textContent = state.soundOn ? '🔊' : '🔇';
  document.getElementById('btnGameSound').textContent = btn.textContent;
}

/* ═══════════════════════════════════════════
   ░░  SCREEN 2: LECCIÓN  ░░
   ═══════════════════════════════════════════ */
function openLesson(world, langData) {
  state.currentWorld = world;
  state.currentLangData = langData;

  const meta = LANG_META[state.lang];
  document.getElementById('lessonBadge').textContent = `${world.icon} Mundo ${world.id} · ${meta.label}`;
  document.getElementById('lessonBadge').style.background = world.color + '33';
  document.getElementById('lessonBadge').style.color = world.color;
  document.getElementById('lessonTitle').textContent = world.name;
  document.getElementById('lessonIntro').textContent = langData.intro;
  document.getElementById('lessonKeyText').textContent = langData.key;

  const cg = document.getElementById('conceptsGrid'); cg.innerHTML = '';
  langData.concepts.forEach(c => {
    const div = document.createElement('div'); div.className = 'concept-card';
    div.innerHTML = `<span class="cc-icon">${c.icon}</span><strong>${c.name}</strong><p>${c.desc}</p>`;
    cg.appendChild(div);
  });

  // Level map
  const lmap = document.getElementById('levelMap'); lmap.innerHTML = '';
  langData.levels.forEach((lv, i) => {
    const node = document.createElement('div'); node.className = 'lmap-node';
    const ws = state.worldScores[`${state.lang}_${world.id}`];
    if (ws && i < ws.completed) node.classList.add('lmap-done');
    const typeIcon = { mc:'🔘', order:'↕️', match:'🔗', bug:'🐛', fill:'✏️' }[lv.type] || '❓';
    node.innerHTML = `<span class="lmap-icon">${typeIcon}</span><span class="lmap-n">${i+1}</span>`;
    node.title = `Nivel ${i+1}: ${lv.type.toUpperCase()} – ${lv.mission}`;
    lmap.appendChild(node);
    if (i < langData.levels.length-1) {
      const sep = document.createElement('div'); sep.className = 'lmap-sep'; lmap.appendChild(sep);
    }
  });

  showScreen('screenLesson');
  SFX.click();
}

/* ═══════════════════════════════════════════
   ░░  JUEGO: INICIO  ░░
   ═══════════════════════════════════════════ */
function startGame() {
  state.lives = 3;
  state.score = 0;
  state.streak = 0;
  state.currentLevelIndex = 0;
  showScreen('screenGame');
  const meta = LANG_META[state.lang];
  document.getElementById('gameWorldLabel').textContent = `${state.currentWorld.icon} ${state.currentWorld.name}`;
  loadLevel();
}

function loadLevel() {
  const lvl = state.currentLangData.levels[state.currentLevelIndex];
  state.answered = false;
  stopConfetti();

  // Topbar
  document.getElementById('gameLevelLabel').textContent =
    `Nivel ${state.currentLevelIndex + 1}/${state.currentLangData.levels.length}`;

  // Progress
  const pct = (state.currentLevelIndex / state.currentLangData.levels.length) * 100;
  document.getElementById('progressFill').style.width = pct + '%';

  // HUD
  updateHUD();

  // Streak badge
  document.getElementById('gameStreak').textContent = `🔥 ×${state.streak}`;

  // Mission tag
  document.getElementById('missionTag').textContent = lvl.mission;
  document.getElementById('missionTag').style.background = state.currentWorld.color + '33';
  document.getElementById('missionTag').style.color = state.currentWorld.color;

  // Challenge type badge
  const typeLabels = { mc:'Multiple Choice', order:'Ordenar Bloques', match:'Emparejar', bug:'Encontrar Bug', fill:'Completar Código' };
  const typeColors = { mc:'#5865F2', order:'#FEE75C', match:'#57F287', bug:'#ED4245', fill:'#EB459E' };
  const cbadge = document.getElementById('challengeBadge');
  cbadge.textContent = `${{'mc':'🔘','order':'↕️','match':'🔗','bug':'🐛','fill':'✏️'}[lvl.type]} ${typeLabels[lvl.type]}`;
  cbadge.style.background = (typeColors[lvl.type] || '#888') + '33';
  cbadge.style.color = typeColors[lvl.type] || '#888';

  // Question
  document.getElementById('gameQuestion').textContent = lvl.question;

  // Fragment (code)
  const fragEl = document.getElementById('gameFragment');
  if (lvl.fragment && lvl.fragment.trim()) {
    fragEl.textContent = lvl.fragment;
    fragEl.style.display = 'block';
  } else {
    fragEl.style.display = 'none';
  }

  // Hint
  document.getElementById('hintText').textContent = lvl.hint || '';
  document.getElementById('gameHint').style.display = lvl.hint ? 'flex' : 'none';

  // Hide all challenge zones
  ['zoneMultiple','zoneOrder','zoneMatch','zoneBug','zoneFill'].forEach(z => {
    document.getElementById(z).classList.add('hidden');
  });

  // Render the right type
  switch(lvl.type) {
    case 'mc':    renderMC(lvl);    break;
    case 'order': renderOrder(lvl); break;
    case 'match': renderMatch(lvl); break;
    case 'bug':   renderBug(lvl);   break;
    case 'fill':  renderFill(lvl);  break;
  }

  // Timer
  clearInterval(state.timerInterval);
  state.timerSeconds = lvl.time || 60;
  state.timerMax = state.timerSeconds;
  updateTimerUI();
  state.timerInterval = setInterval(tickTimer, 1000);

  // Animate card in
  const card = document.getElementById('gameCard');
  card.style.animation = 'none';
  requestAnimationFrame(() => { card.style.animation = ''; card.classList.add('card-enter'); });
  setTimeout(() => card.classList.remove('card-enter'), 400);
}

/* ─────────────────────────────────────────
   TIPO 1: MULTIPLE CHOICE
───────────────────────────────────────── */
function renderMC(lvl) {
  document.getElementById('zoneMultiple').classList.remove('hidden');
  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';
  // shuffle options but track correct
  const indices = lvl.options.map((_,i)=>i);
  const shuffled = [...indices].sort(()=>Math.random()-0.5);
  shuffled.forEach(origIdx => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = lvl.options[origIdx];
    btn.dataset.orig = origIdx;
    btn.addEventListener('click', () => selectMC(origIdx, btn, lvl));
    grid.appendChild(btn);
  });
}

function selectMC(idx, btn, lvl) {
  if (state.answered) return;
  state.answered = true;
  clearInterval(state.timerInterval);
  SFX.click();

  const allBtns = document.querySelectorAll('.option-btn');
  allBtns.forEach(b => { b.disabled = true; if(parseInt(b.dataset.orig)===lvl.correct) b.classList.add('correct'); });

  if (idx === lvl.correct) {
    btn.classList.add('correct');
    handleCorrect(lvl);
  } else {
    btn.classList.add('wrong');
    handleWrong(lvl);
  }
}

/* ─────────────────────────────────────────
   TIPO 2: ORDER (DRAG-AND-DROP)
───────────────────────────────────────── */
function renderOrder(lvl) {
  document.getElementById('zoneOrder').classList.remove('hidden');
  const list = document.getElementById('sortableList');
  list.innerHTML = '';

  // Shuffle
  const shuffled = [...lvl.orderBlocks].map((t,i) => ({text:t, origIdx:i})).sort(()=>Math.random()-0.5);

  shuffled.forEach((item, i) => {
    const block = document.createElement('div');
    block.className = 'sort-block';
    block.draggable = true;
    block.dataset.idx = i;
    block.innerHTML = `<span class="sort-handle">⠿</span><pre class="sort-code">${escHtml(item.text)}</pre>`;
    block.dataset.orig = item.origIdx;

    // Touch drag
    block.addEventListener('dragstart', e => { state.dragSource = block; block.classList.add('dragging'); });
    block.addEventListener('dragend',   () => block.classList.remove('dragging'));
    block.addEventListener('dragover',  e => { e.preventDefault(); block.classList.add('drag-over'); });
    block.addEventListener('dragleave', () => block.classList.remove('drag-over'));
    block.addEventListener('drop', e => {
      e.preventDefault(); block.classList.remove('drag-over');
      if (state.dragSource && state.dragSource !== block) {
        const allBlocks = [...list.querySelectorAll('.sort-block')];
        const srcIdx = allBlocks.indexOf(state.dragSource);
        const dstIdx = allBlocks.indexOf(block);
        if (srcIdx < dstIdx) list.insertBefore(state.dragSource, block.nextSibling);
        else list.insertBefore(state.dragSource, block);
      }
    });
    list.appendChild(block);
  });

  document.getElementById('btnCheckOrder').onclick = () => checkOrder(lvl);
}

function checkOrder(lvl) {
  if (state.answered) return;
  const blocks = [...document.querySelectorAll('.sort-block')];
  const userOrder = blocks.map(b => parseInt(b.dataset.orig));
  const correct = userOrder.every((v, i) => v === lvl.correctOrder[i]);

  state.answered = true;
  clearInterval(state.timerInterval);

  if (correct) {
    blocks.forEach(b => b.classList.add('correct'));
    handleCorrect(lvl);
  } else {
    blocks.forEach((b,i) => {
      b.classList.add(parseInt(b.dataset.orig) === lvl.correctOrder[i] ? 'correct' : 'wrong');
    });
    handleWrong(lvl);
  }
}

/* ─────────────────────────────────────────
   TIPO 3: MATCH PAIRS
───────────────────────────────────────── */
function renderMatch(lvl) {
  document.getElementById('zoneMatch').classList.remove('hidden');
  const cols = document.getElementById('matchColumns'); cols.innerHTML = '';
  state.matchSelected = null; state.matchCompleted = [];

  const leftCol = document.createElement('div'); leftCol.className = 'match-col match-left';
  const rightCol = document.createElement('div'); rightCol.className = 'match-col match-right';

  const leftItems  = lvl.matchPairs.map((_,i)=>i).sort(()=>Math.random()-0.5);
  const rightItems = lvl.matchPairs.map((_,i)=>i).sort(()=>Math.random()-0.5);

  leftItems.forEach(i => {
    const el = createMatchItem(lvl.matchPairs[i].left,  i, 'left');
    leftCol.appendChild(el);
  });
  rightItems.forEach(i => {
    const el = createMatchItem(lvl.matchPairs[i].right, i, 'right');
    rightCol.appendChild(el);
  });

  cols.appendChild(leftCol); cols.appendChild(rightCol);
  document.getElementById('btnCheckMatch').onclick = () => checkMatch(lvl);
}

function createMatchItem(text, pairIdx, side) {
  const el = document.createElement('div');
  el.className = 'match-item';
  el.dataset.pair = pairIdx;
  el.dataset.side = side;
  el.textContent = text;
  el.addEventListener('click', () => onMatchClick(el));
  return el;
}

function onMatchClick(el) {
  if (state.answered) return;
  const side = el.dataset.side;
  SFX.click();

  // Already matched
  if (el.classList.contains('match-matched')) return;

  if (!state.matchSelected) {
    // Select first item
    document.querySelectorAll('.match-item').forEach(e => e.classList.remove('match-active'));
    el.classList.add('match-active');
    state.matchSelected = el;
  } else {
    const prev = state.matchSelected;
    if (prev === el) { prev.classList.remove('match-active'); state.matchSelected = null; return; }

    if (prev.dataset.side === side) {
      // Same side — re-select
      document.querySelectorAll('.match-item').forEach(e => e.classList.remove('match-active'));
      el.classList.add('match-active');
      state.matchSelected = el;
      return;
    }

    if (prev.dataset.pair === el.dataset.pair) {
      // Correct pair!
      prev.classList.remove('match-active'); prev.classList.add('match-matched');
      el.classList.add('match-matched');
      state.matchCompleted.push(parseInt(prev.dataset.pair));
      state.matchSelected = null;
      SFX.correct();
      if (state.matchCompleted.length === document.querySelectorAll('.match-left .match-item').length) {
        // All matched!
        setTimeout(() => checkMatch({ matchPairs: [] }, true), 400);
      }
    } else {
      // Wrong pair
      prev.classList.add('match-wrong'); el.classList.add('match-wrong');
      setTimeout(() => { prev.classList.remove('match-active','match-wrong'); el.classList.remove('match-wrong'); }, 700);
      state.matchSelected = null;
      SFX.wrong();
    }
  }
}

function checkMatch(lvl, autoComplete = false) {
  if (state.answered) return;
  const total = document.querySelectorAll('.match-left .match-item').length;
  if (autoComplete || state.matchCompleted.length === total) {
    state.answered = true;
    clearInterval(state.timerInterval);
    handleCorrect(lvl);
  } else {
    // Incomplete — mark wrong missing
    document.querySelectorAll('.match-item:not(.match-matched)').forEach(e => e.classList.add('match-wrong'));
    state.answered = true;
    clearInterval(state.timerInterval);
    handleWrong(lvl);
  }
}

/* ─────────────────────────────────────────
   TIPO 4: FIND THE BUG
───────────────────────────────────────── */
function renderBug(lvl) {
  document.getElementById('zoneBug').classList.remove('hidden');
  const container = document.getElementById('bugLines'); container.innerHTML = '';

  lvl.bugLines.forEach((line, i) => {
    const el = document.createElement('div');
    el.className = 'bug-line';
    el.innerHTML = `<span class="bug-ln">${i+1}</span><pre class="bug-code">${escHtml(line)}</pre>`;
    el.addEventListener('click', () => selectBugLine(i, el, lvl));
    container.appendChild(el);
  });
}

function selectBugLine(idx, el, lvl) {
  if (state.answered) return;
  state.answered = true;
  clearInterval(state.timerInterval);
  SFX.click();

  const allLines = document.querySelectorAll('.bug-line');
  allLines[lvl.correctBug].classList.add('correct');

  if (idx === lvl.correctBug) {
    el.classList.add('correct');
    handleCorrect(lvl);
  } else {
    el.classList.add('wrong');
    handleWrong(lvl);
  }
}

/* ─────────────────────────────────────────
   TIPO 5: FILL IN THE BLANK
───────────────────────────────────────── */
function renderFill(lvl) {
  document.getElementById('zoneFill').classList.remove('hidden');
  const wrap = document.getElementById('fillWrap'); wrap.innerHTML = '';
  const opts  = document.getElementById('fillOptions'); opts.innerHTML = '';

  // Fragment with blank placeholder
  const frag = lvl.fragment || '';
  const parts = frag.split('___BLANK___');
  parts.forEach((part, i) => {
    const span = document.createElement('pre');
    span.className = 'fill-text';
    span.textContent = part;
    wrap.appendChild(span);
    if (i < parts.length - 1) {
      const blank = document.createElement('span');
      blank.className = 'fill-blank';
      blank.id = 'fillBlank';
      blank.textContent = '___?___';
      wrap.appendChild(blank);
    }
  });

  // Options (shuffled)
  const shuffled = [...lvl.fillOptions].sort(()=>Math.random()-0.5);
  shuffled.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'fill-opt-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => selectFill(opt, btn, lvl));
    opts.appendChild(btn);
  });
}

function selectFill(val, btn, lvl) {
  if (state.answered) return;
  state.answered = true;
  clearInterval(state.timerInterval);
  SFX.click();

  const blank = document.getElementById('fillBlank');

  document.querySelectorAll('.fill-opt-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === lvl.correctFill) b.classList.add('correct');
  });

  blank.textContent = val;

  if (val === lvl.correctFill) {
    btn.classList.add('correct');
    blank.classList.add('fill-correct');
    handleCorrect(lvl);
  } else {
    btn.classList.add('wrong');
    blank.textContent = val + ' ✗';
    blank.classList.add('fill-wrong');
    handleWrong(lvl);
  }
}

/* ═══════════════════════════════════════════
   ░░  RESULTADO COMÚN  ░░
   ═══════════════════════════════════════════ */
function handleCorrect(lvl) {
  state.streak++;
  if (state.streak > state.maxStreak) state.maxStreak = state.streak;
  document.getElementById('gameStreak').textContent = `🔥 ×${state.streak}`;

  const streakBonus = Math.min(state.streak - 1, 5) * 20;
  const timeBonus = Math.floor(state.timerSeconds * 1.5);
  const basePoints = 100;
  const total = basePoints + timeBonus + streakBonus;
  state.score += total;

  SFX.correct();
  if (state.streak >= 3) SFX.streak();
  startConfetti();

  const bonusText = streakBonus > 0 ? ` (+${streakBonus} racha 🔥)` : '';
  const xpText = `+${basePoints} base  +${timeBonus} velocidad${bonusText}  = +${total} pts`;

  showFeedback(true, '✅ ¡Correcto!', lvl.explanation, lvl.remember, false, xpText);
}

function handleWrong(lvl) {
  state.streak = 0;
  document.getElementById('gameStreak').textContent = `🔥 ×0`;
  state.lives--;
  SFX.wrong();
  updateHUD();
  showFeedback(false, '❌ Incorrecto', lvl.explanation, lvl.remember, false, '');
}

/* ═══════════════════════════════════════════
   ░░  TIMER  ░░
   ═══════════════════════════════════════════ */
function tickTimer() {
  state.timerSeconds--;
  updateTimerUI();
  if (state.timerSeconds <= 10) {
    SFX.alert();
    document.getElementById('timerDisplay').classList.add('urgent');
    document.getElementById('timerFill').classList.add('urgent');
  }
  if (state.timerSeconds <= 0) {
    clearInterval(state.timerInterval);
    if (!state.answered) {
      state.answered = true;
      state.lives--;
      state.streak = 0;
      updateHUD();
      const lvl = state.currentLangData.levels[state.currentLevelIndex];
      showFeedback(false, '⏰ Tiempo agotado', 'No respondiste a tiempo.', lvl.remember, true, '');
    }
  }
}

function updateTimerUI() {
  const pct = (state.timerSeconds / state.timerMax) * 100;
  document.getElementById('timerFill').style.width = pct + '%';
  document.getElementById('timerDisplay').textContent = state.timerSeconds;
  if (state.timerSeconds > 10) {
    document.getElementById('timerDisplay').classList.remove('urgent');
    document.getElementById('timerFill').classList.remove('urgent');
  }
}

function updateHUD() {
  document.getElementById('scoreDisplay').textContent = state.score;
  const livesEl = document.getElementById('livesDisplay'); livesEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const h = document.createElement('span');
    h.textContent = i < state.lives ? '❤️' : '🖤';
    livesEl.appendChild(h);
  }
}

/* ═══════════════════════════════════════════
   ░░  FEEDBACK MODAL  ░░
   ═══════════════════════════════════════════ */
function showFeedback(correct, title, body, remember, timeOut, xpText) {
  const modal = document.getElementById('feedbackModal');
  const card  = document.getElementById('modalCard');

  document.getElementById('modalEmoji').textContent  = correct ? '🎉' : (timeOut ? '⏰' : '💡');
  document.getElementById('modalTitle').textContent  = title;
  document.getElementById('modalBody').textContent   = body;
  document.getElementById('modalRemember').textContent = remember || '';
  document.getElementById('modalXP').textContent    = xpText || '';
  document.getElementById('modalXP').style.display  = xpText ? 'block' : 'none';

  card.className = 'modal-card ' + (correct ? 'correct-modal' : 'wrong-modal');

  const isLast = state.currentLevelIndex >= state.currentLangData.levels.length - 1;
  const isDead = state.lives <= 0;
  const btnNext = document.getElementById('btnModalNext');

  if (isDead)      btnNext.textContent = '💀 Sin vidas — Reintentar mundo';
  else if (isLast) btnNext.textContent = '🏆 ¡Completar Mundo!';
  else             btnNext.textContent = '→ Siguiente nivel';

  modal.classList.remove('hidden');
}

document.getElementById('btnModalNext').addEventListener('click', () => {
  document.getElementById('feedbackModal').classList.add('hidden');
  stopConfetti();

  if (state.lives <= 0) {
    state.lives = 3; state.score = 0; state.streak = 0; state.currentLevelIndex = 0;
    loadLevel(); return;
  }

  state.currentLevelIndex++;

  if (state.currentLevelIndex >= state.currentLangData.levels.length) {
    // World complete
    const stars = state.lives === 3 ? 3 : state.lives >= 1 ? 2 : 1;
    const key = `${state.lang}_${state.currentWorld.id}`;
    const prev = state.worldScores[key];
    if (!prev || state.score > prev.score) {
      state.worldScores[key] = { score: state.score, stars, completed: state.currentLangData.levels.length };
    }
    state.totalScore += state.score;
    saveData();

    SFX.worldDone();
    startConfetti();
    const starsHtml = [1,2,3].map(i=>`<span class="done-star ${i<=stars?'lit':''}">★</span>`).join('');
    document.getElementById('worldDoneStars').innerHTML = starsHtml;
    document.getElementById('worldDoneMsg').textContent =
      `¡Completaste "${state.currentWorld.name}" con ${state.score} puntos!`;
    document.getElementById('worldDoneModal').classList.remove('hidden');
  } else {
    loadLevel();
  }
});

document.getElementById('btnWorldDone').addEventListener('click', () => {
  document.getElementById('worldDoneModal').classList.add('hidden');
  stopConfetti();
  clearInterval(state.timerInterval);
  showScreen('screenHome');
  buildHome();
  updateHeaderPlayer();
  toast(`🏆 ¡Mundo completado! +${state.score} pts`, 'success', 3000);
});

/* ═══════════════════════════════════════════
   ░░  LEADERBOARD  ░══════════════════════════
   ═══════════════════════════════════════════ */
function openLeaderboard() {
  document.getElementById('leaderboardPanel').classList.remove('hidden');
  document.getElementById('panelBackdrop').classList.remove('hidden');
  renderLeaderboard('global');
}

function closeLeaderboard() {
  document.getElementById('leaderboardPanel').classList.add('hidden');
  document.getElementById('panelBackdrop').classList.add('hidden');
}

function renderLeaderboard(tab) {
  const body = document.getElementById('leaderboardBody'); body.innerHTML = '';
  let entries = getLeaderboard();

  if (tab === 'weekly') {
    const today = new Date();
    const weekAgo = new Date(today - 7*24*60*60*1000);
    entries = entries.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date.split('/').reverse().join('-'));
      return d >= weekAgo;
    });
  }

  if (tab === 'personal') {
    // Show personal world scores
    body.innerHTML = '<div class="lb-personal">';
    let html = '';
    WORLDS_BASE.forEach(w => {
      const ws = state.worldScores[`${state.lang}_${w.id}`];
      const stars = ws ? [1,2,3].map(s=>`<span class="${ws.stars>=s?'lit':''}">★</span>`).join('') : '☆☆☆';
      html += `<div class="lb-world-row">
        <span>${w.icon} Mundo ${w.id}</span>
        <span class="lb-stars">${stars}</span>
        <span>${ws ? ws.score+' pts' : '—'}</span>
      </div>`;
    });
    body.innerHTML = html || '<p class="lb-empty">Aún no has completado ningún mundo.</p>';
    return;
  }

  if (!entries.length) {
    body.innerHTML = '<p class="lb-empty">Sé el primero en la tabla. ¡Juega ahora!</p>'; return;
  }

  entries.slice(0, 20).forEach((e, i) => {
    const isMe = e.nick === state.nick;
    const medals = ['🥇','🥈','🥉'];
    const pos = i < 3 ? medals[i] : `#${i+1}`;
    const row = document.createElement('div');
    row.className = 'lb-row' + (isMe ? ' lb-me' : '');
    row.innerHTML = `
      <span class="lb-pos">${pos}</span>
      <span class="lb-av">${e.avatar || '🤖'}</span>
      <span class="lb-nick">${escHtml(e.nick)}</span>
      <span class="lb-streak">🔥${e.maxStreak||0}</span>
      <span class="lb-score">${e.score}</span>
    `;
    body.appendChild(row);
  });
}

document.getElementById('btnLeaderboard').addEventListener('click', openLeaderboard);
document.getElementById('btnCloseLeaderboard').addEventListener('click', closeLeaderboard);
document.getElementById('panelBackdrop').addEventListener('click', closeLeaderboard);

document.getElementById('leaderboardPanel').querySelectorAll('[data-ltab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-ltab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderLeaderboard(btn.dataset.ltab);
  });
});

/* ═══════════════════════════════════════════
   ░░  UTILS  ░░
   ═══════════════════════════════════════════ */
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ═══════════════════════════════════════════
   ░░  NAVIGATION BUTTONS  ░░
   ═══════════════════════════════════════════ */
document.getElementById('btnLessonBack').addEventListener('click', () => showScreen('screenHome'));
document.getElementById('btnStartWorld').addEventListener('click', startGame);
document.getElementById('btnGameHome').addEventListener('click', () => {
  clearInterval(state.timerInterval);
  showScreen('screenHome');
  buildHome();
});

document.getElementById('btnTheme').addEventListener('click', toggleTheme);
document.getElementById('btnSound').addEventListener('click', function() { toggleSound(this); });
document.getElementById('btnGameSound').addEventListener('click', function() {
  state.soundOn = !state.soundOn;
  this.textContent = state.soundOn ? '🔊' : '🔇';
  document.getElementById('btnSound').textContent = this.textContent;
});

document.getElementById('btnPlayerPill').addEventListener('click', () => {
  // Allow nick change
  showScreen('screenNick');
  initNickScreen();
});

/* ═══════════════════════════════════════════
   ░░  INIT  ░░
   ═══════════════════════════════════════════ */
function init() {
  loadData();
  buildAmbient();

  if (!state.nick) {
    showScreen('screenNick');
    initNickScreen();
  } else {
    showScreen('screenHome');
    buildHome();
    updateHeaderPlayer();
  }

  // Set lang tab
  document.querySelectorAll('.lang-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.lang === state.lang);
  });
}

init();
